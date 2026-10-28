const request = require('supertest');
const { startTestDb, stopTestDb } = require('./testUtils');
const { resetRateLimits } = require('../middleware/rateLimit');
const { parsePdf } = require('./helpers/pdfText');
const { ROLES, ALL_ROLES } = require('../config/constants');
const { formatINR } = require('../services/pdfService');

let app;
const tokens = {};
const ids = {};

const HEADERS = ['Item ID', 'Name', 'SKU', 'Category', 'Owner', 'Status', 'Location', 'Condition', 'Received', 'Purchase Cost', 'Est. Resale Value'];
const istToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const binary = (res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

const qs = (params = {}) => {
  const s = new URLSearchParams(params).toString();
  return s ? `?${s}` : '';
};

function exportPdf(params, role = ROLES.ADMIN) {
  return request(app).get(`/api/items/export/pdf${qs(params)}`).set('Authorization', `Bearer ${tokens[role]}`).buffer(true).parse(binary);
}

function listItems(params, role = ROLES.ADMIN) {
  return request(app).get(`/api/items${qs(params)}`).set('Authorization', `Bearer ${tokens[role]}`);
}

async function pdfOf(params) {
  const res = await exportPdf(params);
  expect(res.status).toBe(200);
  const parsed = parsePdf(res.body);
  const texts = parsed.allTexts;
  return { res, parsed, texts, joined: texts.join(' '), itemIds: texts.filter((t) => /^ITM-/.test(t)) };
}

// This file sends more PDF exports per user than the per-minute limit allows.
beforeEach(() => resetRateLimits());

beforeAll(async () => {
  await startTestDb();
  app = require('../app');

  await request(app).post('/api/auth/register').send({ name: 'Admin', email: 'admin@invpdf.com', password: 'AdminPass123', role: ROLES.ADMIN });
  for (const role of ALL_ROLES) {
    const email = role === ROLES.ADMIN ? 'admin@invpdf.com' : `${role.replace(/[^a-z]/gi, '').toLowerCase()}@invpdf.com`;
    const password = role === ROLES.ADMIN ? 'AdminPass123' : 'RolePass123';
    if (role !== ROLES.ADMIN) await request(app).post('/api/users').set('Authorization', `Bearer ${tokens[ROLES.ADMIN]}`).send({ name: role, email, password, role });
    tokens[role] = (await request(app).post('/api/auth/login').send({ email, password })).body.data.token;
  }

  const Customer = require('../models/Customer');
  const WarehouseLocation = require('../models/WarehouseLocation');
  const Item = require('../models/Item');
  const location = await WarehouseLocation.create({ code: 'A-01', warehouseName: 'Main Warehouse', zone: 'A', areaSqFt: 100 });
  const patel = await Customer.create({ customerId: 'CUST-I1', name: 'Ramesh Patel', businessName: 'Patel Traders', phone: '9000000011' });
  const shah = await Customer.create({ customerId: 'CUST-I2', name: 'Kiran Shah', businessName: 'Shah & Sons', phone: '9000000012' });
  Object.assign(ids, { patel: patel._id, shah: shah._id, location: location._id });

  await Item.create({ itemId: 'ITM-I0001', name: 'Steel Rack', sku: 'RACK-01', category: 'Furniture', owner: patel._id, status: 'In Warehouse', purchaseCost: 4500, estimatedResaleValue: 6200, currentLocation: location._id, receivedDate: new Date('2026-10-01T06:00:00Z'), condition: 'Good' });
  await Item.create({ itemId: 'ITM-I0002', name: 'Dell Laptop', sku: 'LAP-02', category: 'Electronics', owner: shah._id, status: 'Available for Sale', purchaseCost: 38000.5, condition: 'Fair' });
  await Item.create({ itemId: 'ITM-I0003', name: 'Office Chair', category: 'Furniture', owner: shah._id, status: 'In Warehouse', purchaseCost: 6500, estimatedResaleValue: 8000 });
  await Item.create({ itemId: 'ITM-I0004', name: 'Old Printer', category: 'Electronics', owner: patel._id, status: 'Sold', purchaseCost: 1000, isArchived: true });
}, 60000);

afterAll(async () => {
  await stopTestDb();
});

describe('Inventory PDF export', () => {
  test('downloads the full (non-archived) list as a branded, English-only PDF', async () => {
    const { res, parsed, texts, joined, itemIds } = await pdfOf({});
    expect(res.headers['content-type']).toMatch(/^application\/pdf/);
    expect(res.headers['content-disposition']).toBe(`attachment; filename="inventory-${istToday()}.pdf"`);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(joined).toContain('Inventory');
    HEADERS.forEach((h) => expect(joined).toContain(h));
    expect(itemIds.sort()).toEqual(['ITM-I0001', 'ITM-I0002', 'ITM-I0003']);
    expect(joined).not.toContain('Filters:');
    expect(joined).toMatch(/Generated: .+ IST/);
    expect(joined).toMatch(/Page 1 of \d+/);
    expect(joined).not.toContain('₹');
    expect([...new Set(parsed.baseFonts)].sort()).toEqual(['Helvetica', 'Helvetica-Bold']);
  });

  test('shows the item details and correct totals', async () => {
    const { texts, joined } = await pdfOf({});
    for (const value of ['Steel Rack', 'RACK-01', 'Patel Traders', 'Shah & Sons', 'A-01', 'Good', 'Fair', '01 Oct 2026', 'Rs. 38,000.50']) {
      expect(joined).toContain(value);
    }
    expect(texts).toContain(formatINR(4500 + 38000.5 + 6500)); // purchase cost total
    expect(texts).toContain(formatINR(6200 + 8000)); // resale value total (missing values count as 0)
    expect(texts).toContain('-'); // missing SKU / location / resale value
    expect(joined).toContain('Items');
    expect(texts).toContain('3');
  });
});

describe('Inventory PDF uses the same filters as the list', () => {
  test('status filter', async () => {
    const { joined, itemIds } = await pdfOf({ status: 'In Warehouse' });
    expect(itemIds.sort()).toEqual(['ITM-I0001', 'ITM-I0003']);
    expect(joined).toContain('Filters: Status = In Warehouse');
  });

  test('search by item name', async () => {
    const { joined, itemIds } = await pdfOf({ search: 'rack' });
    expect(itemIds).toEqual(['ITM-I0001']);
    expect(joined).toContain('Filters: Search = "rack"');
  });

  test('search by owner name (existing owner lookup)', async () => {
    const { itemIds } = await pdfOf({ search: 'Shah' });
    expect(itemIds.sort()).toEqual(['ITM-I0002', 'ITM-I0003']);
  });

  test('search and status together', async () => {
    const { joined, itemIds } = await pdfOf({ search: 'shah', status: 'In Warehouse' });
    expect(itemIds).toEqual(['ITM-I0003']);
    expect(joined).toContain('Filters: Search = "shah"; Status = In Warehouse');
  });

  test('category, owner and location filters print readable names', async () => {
    const byOwner = await pdfOf({ owner: String(ids.patel), category: 'Furniture' });
    expect(byOwner.itemIds).toEqual(['ITM-I0001']);
    expect(byOwner.joined).toContain('Category = Furniture; Owner = Patel Traders');

    const byLocation = await pdfOf({ currentLocation: String(ids.location) });
    expect(byLocation.itemIds).toEqual(['ITM-I0001']);
    expect(byLocation.joined).toContain('Filters: Location = A-01');
  });

  test('archived items appear only when includeArchived=true', async () => {
    const { joined, itemIds } = await pdfOf({ includeArchived: 'true' });
    expect(itemIds).toContain('ITM-I0004');
    expect(joined).toContain('Archived items = Included');
  });

  test.each([
    [{}],
    [{ status: 'In Warehouse' }],
    [{ search: 'shah' }],
    [{ search: 'ITM-I000' }],
    [{ category: 'Furniture' }],
    [{ includeArchived: 'true' }],
  ])('returns exactly the items the list returns for %j', async (params) => {
    const list = await listItems({ ...params, limit: 100 });
    const listIds = list.body.data.map((i) => i.itemId).sort();
    const { itemIds } = await pdfOf(params);
    expect(itemIds.sort()).toEqual(listIds);
  });

  test('a filter with no matches prints the no-records message', async () => {
    const { joined, itemIds } = await pdfOf({ search: 'zzz-no-such-item' });
    expect(itemIds).toEqual([]);
    expect(joined).toContain('No records match the selected filters.');
  });
});

describe('permissions and routes', () => {
  test.each(ALL_ROLES)('%s can download the inventory PDF (same as viewing the list)', async (role) => {
    expect((await listItems({}, role)).status).toBe(200);
    const res = await exportPdf({}, role);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^application\/pdf/);
  });

  test('requests without a login are rejected', async () => {
    expect((await request(app).get('/api/items/export/pdf')).status).toBe(401);
  });

  test('the old CSV export route no longer exists', async () => {
    const res = await request(app).get('/api/items/export/csv').set('Authorization', `Bearer ${tokens[ROLES.ADMIN]}`);
    expect(res.status).toBe(404);
  });
});

describe('existing Inventory list API is unchanged', () => {
  test('keeps its paginated response shape and excludes archived items by default', async () => {
    const res = await listItems({ limit: 2, page: 2 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toHaveProperty('owner.businessName');
  });

  test('status, owner-name search and includeArchived still filter the list', async () => {
    expect((await listItems({ status: 'In Warehouse' })).body.data.map((i) => i.itemId).sort()).toEqual(['ITM-I0001', 'ITM-I0003']);
    expect((await listItems({ search: 'patel' })).body.data.map((i) => i.itemId)).toEqual(['ITM-I0001']);
    expect((await listItems({ includeArchived: 'true' })).body.pagination.total).toBe(4);
  });
});

describe('large amounts stay on one line', () => {
  test('crore-sized row amounts and totals are each printed on a single line', async () => {
    const Item = require('../models/Item');
    const costs = [45678901.25, 98765432.1, 18600250.5];
    const resale = [52000000, 105000000.75, 21000000];
    await Item.insertMany(costs.map((purchaseCost, i) => ({
      itemId: `ITM-H000${i + 1}`, name: `High value machine ${i + 1}`, category: 'HighValue', owner: ids.patel, status: 'In Warehouse',
      purchaseCost, estimatedResaleValue: resale[i],
    })));
    const { texts, itemIds } = await pdfOf({ category: 'HighValue' });
    expect(itemIds.sort()).toEqual(['ITM-H0001', 'ITM-H0002', 'ITM-H0003']);
    const totalCost = costs.reduce((s, c) => s + c, 0);
    const totalResale = resale.reduce((s, c) => s + c, 0);
    expect(texts).toContain(formatINR(totalCost)); // Rs. 16,30,44,583.85 - exact, unrounded
    expect(texts).toContain(formatINR(totalResale));
    costs.forEach((c) => expect(texts).toContain(formatINR(c)));
    expect(texts.filter((t) => t.trim() === 'Rs.')).toEqual([]);
  });
});

describe('long inventory exports paginate', () => {
  test('150 items: all rows once, header and page numbers on every page', async () => {
    const Item = require('../models/Item');
    await Item.insertMany(Array.from({ length: 150 }, (_, i) => ({
      itemId: `ITM-B${String(i).padStart(4, '0')}`, name: `Bulk item ${i}`, category: 'Bulk', owner: ids.shah, status: 'In Warehouse', purchaseCost: 100,
    })));
    const { parsed, itemIds } = await pdfOf({ category: 'Bulk' });
    const n = parsed.pages.length;
    expect(n).toBeGreaterThan(1);
    parsed.pages.forEach((page, i) => {
      expect(page.texts.filter((t) => t === `Page ${i + 1} of ${n}`)).toHaveLength(1);
      expect(page.texts.filter((t) => t === 'Item ID')).toHaveLength(1);
    });
    expect(itemIds).toHaveLength(150);
    expect(new Set(itemIds).size).toBe(150);
    expect(parsed.allTexts).toContain(formatINR(15000));
  });
});
