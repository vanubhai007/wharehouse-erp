const request = require('supertest');
const mongoose = require('mongoose');
const { startTestDb, stopTestDb } = require('./testUtils');
const { resetRateLimits } = require('../middleware/rateLimit');
const { parsePdf } = require('./helpers/pdfText');
const { ROLES, ALL_ROLES } = require('../config/constants');
const { formatINR } = require('../services/pdfService');

let app;
const tokens = {};
const ids = {};

const { ADMIN, WAREHOUSE_MANAGER, ACCOUNTS, SALES_MANAGER, OWNER_APPROVER } = ROLES;
const COSTS = [ADMIN, WAREHOUSE_MANAGER, ACCOUNTS, OWNER_APPROVER];
const SALES = [ADMIN, ACCOUNTS, SALES_MANAGER, OWNER_APPROVER];
const FINANCE = [ADMIN, ACCOUNTS, OWNER_APPROVER];

// The 10 Reports tabs: route, PDF title, filename stem, column headers, a
// seeded value that must appear, and the roles allowed (same as fix (b)).
const REPORTS = [
  { path: 'inventory', title: 'Current Inventory Report', base: 'current-inventory-report', headers: ['Item ID', 'Name', 'Category', 'Owner', 'Status', 'Location', 'Purchase Cost', 'Est. Resale Value'], sample: 'ITM-T0001', roles: ALL_ROLES },
  { path: 'cost-sheet', title: 'Item-wise Cost Sheet', base: 'item-wise-cost-sheet', headers: ['Item ID', 'Item Name', 'Base Cost', 'Rental', 'Refurbishment', 'Marketing', 'Logistics', 'Commission', 'Other', 'Total Cost'], sample: 'ITM-T0002', roles: COSTS },
  { path: 'expenses', title: 'Expense Report', base: 'expense-report', headers: ['Date', 'Item', 'Category', 'Vendor', 'Payment Status', 'Amount'], sample: 'Ad Agency', roles: COSTS },
  { path: 'refurbishment', title: 'Refurbishment Report', base: 'refurbishment-report', headers: ['Item', 'Work', 'Assigned To', 'Cost', 'Status'], sample: 'Replace battery', roles: ALL_ROLES },
  { path: 'sales', title: 'Sales Report', base: 'sales-report', headers: ['Proposal #', 'Item', 'Buyer', 'Price', 'Margin', 'Status'], sample: 'SP-T0001', roles: SALES },
  { path: 'pending-approvals', title: 'Pending Approvals', base: 'pending-approvals', headers: ['Proposal #', 'Requested', 'Decision'], sample: 'SP-T0002', roles: ALL_ROLES },
  { path: 'outstanding-payments', title: 'Outstanding Payments', base: 'outstanding-payments', headers: ['Invoice #', 'Buyer', 'Grand Total', 'Paid', 'Balance', 'Status'], sample: 'HRW-INV-T1', roles: FINANCE },
  { path: 'settlements', title: 'Commission & Settlement Report', base: 'commission-settlement-report', headers: ['Item', 'Owner', 'Commission', 'Owner Payable', 'Status'], sample: 'Patel Traders', roles: FINANCE },
  { path: 'dispatch', title: 'Dispatch Report', base: 'dispatch-report', headers: ['Dispatch #', 'Item', 'Buyer', 'Status'], sample: 'HRW-DSP-T1', roles: ALL_ROLES },
  { path: 'audit', title: 'Audit / Activity Log', base: 'audit-activity-log', headers: ['When', 'Entity', 'Action', 'By'], sample: 'CREATE', roles: [ADMIN] },
];

const istToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// Collects binary responses (PDFs) into a Buffer.
const binary = (res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

function getPdf(path, role = ADMIN) {
  return request(app).get(`/api/reports/${path}`).set('Authorization', `Bearer ${tokens[role]}`).buffer(true).parse(binary);
}

function getJson(path, role = ADMIN) {
  return request(app).get(`/api/reports/${path}`).set('Authorization', `Bearer ${tokens[role]}`);
}

async function pdfText(path) {
  const res = await getPdf(path);
  expect(res.status).toBe(200);
  const parsed = parsePdf(res.body);
  return { res, parsed, text: parsed.allTexts.join('\n'), joined: parsed.allTexts.join(' ') };
}

// This file sends more PDF exports per user than the per-minute limit allows.
beforeEach(() => resetRateLimits());

beforeAll(async () => {
  await startTestDb();
  app = require('../app');

  await request(app).post('/api/auth/register').send({ name: 'Admin', email: 'admin@reportpdf.com', password: 'AdminPass123', role: ADMIN });
  for (const role of ALL_ROLES) {
    const email = role === ADMIN ? 'admin@reportpdf.com' : `${role.replace(/[^a-z]/gi, '').toLowerCase()}@reportpdf.com`;
    const password = role === ADMIN ? 'AdminPass123' : 'RolePass123';
    if (role !== ADMIN) await request(app).post('/api/users').set('Authorization', `Bearer ${tokens[ADMIN]}`).send({ name: role, email, password, role });
    const login = await request(app).post('/api/auth/login').send({ email, password });
    tokens[role] = login.body.data.token;
    ids[role] = login.body.data.user._id;
  }

  const Customer = require('../models/Customer');
  const WarehouseLocation = require('../models/WarehouseLocation');
  const Item = require('../models/Item');
  const Expense = require('../models/Expense');
  const Refurbishment = require('../models/Refurbishment');
  const Buyer = require('../models/Buyer');
  const SaleProposal = require('../models/SaleProposal');
  const Approval = require('../models/Approval');
  const Invoice = require('../models/Invoice');
  const Settlement = require('../models/Settlement');
  const Dispatch = require('../models/Dispatch');

  const location = await WarehouseLocation.create({ code: 'A-01', warehouseName: 'Main Warehouse', zone: 'A', areaSqFt: 100 });
  const owner1 = await Customer.create({ customerId: 'CUST-T1', name: 'Ramesh Patel', businessName: 'Patel Traders', phone: '9000000001' });
  const owner2 = await Customer.create({ customerId: 'CUST-T2', name: 'Kiran Shah', businessName: 'Shah & Sons', phone: '9000000002' });
  const item1 = await Item.create({ itemId: 'ITM-T0001', name: 'Steel Rack', category: 'Furniture', owner: owner1._id, status: 'In Warehouse', purchaseCost: 1000, estimatedResaleValue: 1500, currentLocation: location._id });
  const item2 = await Item.create({ itemId: 'ITM-T0002', name: 'Laptop', category: 'Electronics', owner: owner2._id, status: 'Available for Sale', purchaseCost: 25000.5 });
  ids.owner1 = owner1._id;

  await Expense.create({ item: item1._id, category: 'Marketing', amount: 250, date: new Date('2026-10-01T06:00:00Z'), vendor: 'Ad Agency', paymentStatus: 'Paid' });
  await Expense.create({ item: item2._id, category: 'Refurbishment', amount: 1200.75, date: new Date('2026-10-05T06:00:00Z'), vendor: 'Repair Hub' });
  await Refurbishment.create({ item: item2._id, workDescription: 'Replace battery', assignedTo: 'Vendor A', startDate: new Date('2026-10-02'), repairCost: 1200.75, status: 'In Progress' });

  const buyer = await Buyer.create({ buyerId: 'BUY-T1', name: 'Asha Mehta', businessName: 'Mehta Logistics', phone: '9000000003' });
  const sp1 = await SaleProposal.create({ proposalNumber: 'SP-T0001', item: item1._id, buyer: buyer._id, proposedPrice: 5000, discountAmount: 500, marginAmount: 1000, status: 'Converted' });
  const sp2 = await SaleProposal.create({ proposalNumber: 'SP-T0002', item: item2._id, buyer: buyer._id, proposedPrice: 30000, status: 'Approval Pending' });
  await Approval.create({ saleProposal: sp2._id, requestedBy: ids[ADMIN], decision: 'Pending' });
  await Invoice.create({
    invoiceNumber: 'HRW-INV-T1', item: item1._id, buyer: buyer._id,
    lineItems: [{ description: 'Steel Rack', quantity: 1, unitPrice: 4500, taxableAmount: 4500, gstAmount: 810, lineTotal: 5310 }],
    subtotal: 4500, taxableAmount: 4500, gstAmount: 810, grandTotal: 5310, amountPaid: 1000, paymentStatus: 'Partially Paid',
  });
  await Settlement.create({ saleProposal: sp1._id, item: item1._id, owner: owner1._id, salePrice: 4500, totalItemCost: 1250, commissionType: 'percent', commissionRate: 10, commissionAmount: 450, ownerPayable: 4050, status: 'Pending' });
  await Dispatch.create({ dispatchNumber: 'HRW-DSP-T1', item: item1._id, saleProposal: sp1._id, buyer: buyer._id, deliveryAddress: 'Ahmedabad', status: 'Dispatched' });
}, 60000);

afterAll(async () => {
  await stopTestDb();
});

describe('PDF download on all 10 report tabs', () => {
  test.each(REPORTS.map((r) => [r.path, r]))('%s: valid PDF with title, headers, data, IST timestamp and page numbers', async (path, report) => {
    const { res, parsed, joined } = await pdfText(`${path}?format=pdf`);
    expect(res.headers['content-type']).toMatch(/^application\/pdf/);
    expect(res.headers['content-disposition']).toBe(`attachment; filename="${report.base}-${istToday()}.pdf"`);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(joined).toContain(report.title);
    report.headers.forEach((h) => expect(joined).toContain(h));
    expect(joined).toContain(report.sample);
    expect(joined).toMatch(/Generated: \d{2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} (am|pm) IST/);
    expect(joined).toMatch(/Page 1 of \d+/);
    // English-only: no rupee sign, only the built-in Helvetica fonts.
    expect(joined).not.toContain('₹');
    expect([...new Set(parsed.baseFonts)].sort()).toEqual(['Helvetica', 'Helvetica-Bold']);
  });
});

describe('PDF totals match the JSON report calculations', () => {
  test('current inventory: purchase cost and resale value totals', async () => {
    const json = (await getJson('inventory')).body.data;
    const { parsed, joined } = await pdfText('inventory?format=pdf');
    expect(parsed.allTexts).toContain(formatINR(json.reduce((s, i) => s + i.purchaseCost, 0)));
    expect(parsed.allTexts).toContain(formatINR(json.reduce((s, i) => s + (i.estimatedResaleValue || 0), 0)));
    expect(parsed.allTexts).toContain('Rs. 25,000.50');
    expect(joined).toContain('A-01');
  });

  test('cost sheet: total cost column', async () => {
    const json = (await getJson('cost-sheet')).body.data;
    const { parsed } = await pdfText('cost-sheet?format=pdf');
    expect(parsed.allTexts).toContain(formatINR(json.reduce((s, x) => s + x.costSheet.totalCost, 0)));
  });

  test('expenses: grand total and totals by category', async () => {
    const json = (await getJson('expenses')).body.data;
    const { parsed, joined } = await pdfText('expenses?format=pdf');
    expect(parsed.allTexts).toContain(formatINR(json.grandTotal));
    for (const [category, total] of Object.entries(json.totalsByCategory)) {
      expect(joined).toContain(`Total: ${category}`);
      expect(parsed.allTexts).toContain(formatINR(total));
    }
  });

  test('sales: total sales value of converted proposals', async () => {
    const json = (await getJson('sales')).body.data;
    const { parsed, joined } = await pdfText('sales?format=pdf');
    expect(joined).toContain('Total Sales Value (converted)');
    expect(parsed.allTexts).toContain(formatINR(json.totalSalesValue));
    expect(json.totalSalesValue).toBe(4500);
  });

  test('outstanding payments: total outstanding', async () => {
    const json = (await getJson('outstanding-payments')).body.data;
    const { parsed } = await pdfText('outstanding-payments?format=pdf');
    expect(parsed.allTexts).toContain(formatINR(json.totalOutstanding));
    expect(json.totalOutstanding).toBe(4310);
  });

  test('settlements: commission, owner payable and pending totals', async () => {
    const { totals } = (await getJson('settlements')).body.data;
    const { parsed, joined } = await pdfText('settlements?format=pdf');
    for (const label of ['Total Commission', 'Total Owner Payable', 'Pending Owner Payable']) expect(joined).toContain(label);
    expect(parsed.allTexts).toContain(formatINR(totals.totalCommission));
    expect(parsed.allTexts).toContain(formatINR(totals.totalOwnerPayable));
    expect(parsed.allTexts).toContain(formatINR(totals.totalPending));
  });
});

describe('filters are applied and printed', () => {
  test('expenses filtered by category contain only that category', async () => {
    const { joined } = await pdfText('expenses?category=Marketing&format=pdf');
    expect(joined).toContain('Filters: Category = Marketing');
    expect(joined).toContain('Ad Agency');
    expect(joined).not.toContain('Repair Hub');
  });

  test('expenses filtered by date print the date in IST and exclude earlier rows', async () => {
    const { joined } = await pdfText('expenses?from=2026-10-03&format=pdf');
    expect(joined).toContain('Filters: From = 03 Oct 2026');
    expect(joined).toContain('Repair Hub');
    expect(joined).not.toContain('Ad Agency');
  });

  test('sales filtered by status', async () => {
    const { joined } = await pdfText('sales?status=Converted&format=pdf');
    expect(joined).toContain('Filters: Status = Converted');
    expect(joined).toContain('SP-T0001');
    expect(joined).not.toContain('SP-T0002');
  });

  test('inventory filtered by status and by owner (owner shown by name)', async () => {
    const byStatus = await pdfText(`inventory?status=${encodeURIComponent('In Warehouse')}&format=pdf`);
    expect(byStatus.joined).toContain('ITM-T0001');
    expect(byStatus.joined).not.toContain('ITM-T0002');

    const byOwner = await pdfText(`inventory?owner=${ids.owner1}&format=pdf`);
    expect(byOwner.joined).toContain('Filters: Owner = Patel Traders');
    expect(byOwner.joined).not.toContain('ITM-T0002');
  });

  test('an empty result prints the no-records message', async () => {
    const { joined } = await pdfText('dispatch?status=Closed&format=pdf');
    expect(joined).toContain('Filters: Status = Closed');
    expect(joined).toContain('No records match the selected filters.');
  });
});

describe('CSV is removed and JSON is unchanged', () => {
  test.each(['inventory', 'cost-sheet', 'expenses', 'sales', 'outstanding-payments'])('%s?format=csv returns 400', async (path) => {
    const res = await getJson(`${path}?format=csv`);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Unsupported export format. Use format=pdf.');
  });

  test('any other format value is rejected too', async () => {
    for (const format of ['xlsx', 'PDF', '']) {
      const res = await getJson(`audit?format=${format}`);
      expect([format, res.status]).toEqual([format, 400]);
    }
  });

  test('requests without a format still return the existing JSON shape', async () => {
    const expenses = (await getJson('expenses')).body;
    expect(expenses.success).toBe(true);
    expect(Object.keys(expenses.data).sort()).toEqual(['expenses', 'grandTotal', 'totalsByCategory']);
    expect(expenses.data.grandTotal).toBe(1450.75);
    const inventory = (await getJson('inventory')).body;
    expect(Array.isArray(inventory.data)).toBe(true);
    expect(inventory.data[0]).toHaveProperty('purchaseCost');
  });
});

describe('role permissions are unchanged for PDF downloads', () => {
  for (const report of REPORTS) {
    for (const role of ALL_ROLES) {
      const expected = report.roles.includes(role) ? 200 : 403;
      test(`${role} -> ${report.path}?format=pdf is ${expected}`, async () => {
        const res = await getPdf(`${report.path}?format=pdf`, role);
        expect(res.status).toBe(expected);
        if (expected === 200) expect(res.headers['content-type']).toMatch(/^application\/pdf/);
      });
    }
  }

  test('requests without a login are rejected', async () => {
    const res = await request(app).get('/api/reports/inventory?format=pdf');
    expect(res.status).toBe(401);
  });
});

describe('large totals stay on one line in the inventory and cost-sheet reports', () => {
  beforeAll(async () => {
    const Item = require('../models/Item');
    const Customer = require('../models/Customer');
    const owner = await Customer.findOne({ customerId: 'CUST-T1' });
    await Item.create({ itemId: 'ITM-T9001', name: 'Gas Turbine Unit', category: 'Machinery', owner: owner._id, status: 'In Warehouse', purchaseCost: 98765432.1, estimatedResaleValue: 120000000 });
  });

  test('current inventory: crore totals match the JSON and are not split', async () => {
    const json = (await getJson('inventory')).body.data;
    const { parsed } = await pdfText('inventory?format=pdf');
    expect(parsed.allTexts).toContain(formatINR(json.reduce((s, i) => s + i.purchaseCost, 0)));
    expect(parsed.allTexts).toContain(formatINR(json.reduce((s, i) => s + (i.estimatedResaleValue || 0), 0)));
    expect(parsed.allTexts).toContain('Rs. 9,87,65,432.10');
    expect(parsed.allTexts.filter((t) => t.trim() === 'Rs.')).toEqual([]);
  });

  test('cost sheet: every crore total matches the JSON and is not split', async () => {
    const json = (await getJson('cost-sheet')).body.data;
    const { parsed } = await pdfText('cost-sheet?format=pdf');
    for (const key of ['baseCost', 'rental', 'refurbishment', 'marketing', 'logistics', 'commission', 'other', 'totalCost']) {
      expect(parsed.allTexts).toContain(formatINR(json.reduce((s, x) => s + (x.costSheet[key] || 0), 0)));
    }
    expect(json.reduce((s, x) => s + x.costSheet.totalCost, 0)).toBeGreaterThan(10000000);
    expect(parsed.allTexts.filter((t) => t.trim() === 'Rs.')).toEqual([]);
  });
});

describe('long reports paginate', () => {
  test('audit log: 500-entry limit kept, multiple pages, headers repeated on every page', async () => {
    const AuditLog = require('../models/AuditLog');
    await AuditLog.insertMany(Array.from({ length: 600 }, (_, i) => ({
      entityType: 'Item', entityId: new mongoose.Types.ObjectId(), action: `BULK_${String(i).padStart(3, '0')}`, performedByName: 'Loader',
    })));
    const { parsed, joined } = await pdfText('audit?format=pdf');
    const n = parsed.pages.length;
    expect(n).toBeGreaterThan(1);
    parsed.pages.forEach((page, i) => {
      expect(page.texts.filter((t) => t === `Page ${i + 1} of ${n}`)).toHaveLength(1);
      expect(page.texts.filter((t) => t === 'When')).toHaveLength(1);
    });
    expect(parsed.allTexts.filter((t) => /^BULK_\d{3}$/.test(t)).length).toBeLessThanOrEqual(500);
    expect(joined).toContain('Most recent 500 entries (same limit as the on-screen log)');
    expect(parsed.allTexts).toContain('500');
  });
});

describe('cost sheet PDF: Commission column', () => {
  // Amount columns in the order they are printed (after Item ID and Item Name).
  const AMOUNT_KEYS = ['baseCost', 'rental', 'refurbishment', 'marketing', 'logistics', 'commission', 'other', 'totalCost'];
  const paise = (text) => Math.round(Number(text.replace(/^Rs\. /, '').replace(/,/g, '')) * 100);

  // The text drawn on one table row: cells on the same baseline as the row's
  // first cell, left to right; the last 8 are the amount columns.
  function amountsOnRow(parsed, firstCell) {
    for (const page of parsed.pages) {
      const anchor = page.items.find((it) => it.text === firstCell);
      if (!anchor) continue;
      const cells = page.items.filter((it) => Math.abs(it.y - anchor.y) < 0.01 && it.x >= anchor.x).sort((a, b) => a.x - b.x);
      return { cells, amounts: Object.fromEntries(cells.slice(-8).map((it, i) => [AMOUNT_KEYS[i], it.text])) };
    }
    throw new Error(`row ${firstCell} not found`);
  }

  // Every item row and the totals row: the components add up to Total Cost (in paise).
  function expectRowsReconcile(parsed, firstCells) {
    for (const first of firstCells) {
      const { amounts } = amountsOnRow(parsed, first);
      const parts = AMOUNT_KEYS.slice(0, -1).reduce((s, key) => s + paise(amounts[key]), 0);
      expect({ row: first, total: paise(amounts.totalCost) }).toEqual({ row: first, total: parts });
    }
  }

  beforeAll(async () => {
    const Item = require('../models/Item');
    const Expense = require('../models/Expense');
    const t1 = await Item.findOne({ itemId: 'ITM-T0001' });
    const t2 = await Item.findOne({ itemId: 'ITM-T0002' });
    await Expense.create({ item: t1._id, category: 'Commission', amount: 2500.25, date: new Date('2026-10-10T06:00:00Z'), vendor: 'Agent A' });
    await Expense.create({ item: t2._id, category: 'Commission', amount: 1800.5, date: new Date('2026-10-11T06:00:00Z'), vendor: 'Agent B' });
    await Expense.create({ item: t2._id, category: 'Other', amount: 300.4, date: new Date('2026-10-12T06:00:00Z'), vendor: 'Misc' });
  });

  test('Commission is printed between Logistics and Other, landscape, at the normal 8.5 pt', async () => {
    const { parsed } = await pdfText('cost-sheet?format=pdf');
    expect(parsed.pages[0].mediaBox.slice(2)).toEqual([841.89, 595.28]);
    const header = Object.fromEntries(parsed.pages[0].items.filter((it) => ['Logistics', 'Commission', 'Other', 'Total Cost'].includes(it.text)).map((it) => [it.text, it]));
    expect(header.Logistics.x).toBeLessThan(header.Commission.x);
    expect(header.Commission.x).toBeLessThan(header.Other.x);
    expect(header.Other.x).toBeLessThan(header['Total Cost'].x);
    expect(header.Commission.size).toBe(8.5);
    const { cells } = amountsOnRow(parsed, 'ITM-T0001');
    expect(cells).toHaveLength(10);
    cells.forEach((cell) => expect(cell.size).toBe(8.5));
  });

  test('each Commission value and the Commission total match the cost sheet data', async () => {
    const json = (await getJson('cost-sheet')).body.data;
    const { parsed } = await pdfText('cost-sheet?format=pdf');
    for (const sheet of json) {
      const { amounts } = amountsOnRow(parsed, sheet.item.itemId);
      expect(amounts.commission).toBe(formatINR(sheet.costSheet.commission));
      expect(amounts.totalCost).toBe(formatINR(sheet.costSheet.totalCost));
    }
    expect(amountsOnRow(parsed, 'ITM-T0001').amounts.commission).toBe('Rs. 2,500.25');
    expect(amountsOnRow(parsed, 'ITM-T0002').amounts.commission).toBe('Rs. 1,800.50');
    const totals = amountsOnRow(parsed, 'Total').amounts;
    expect(totals.commission).toBe(formatINR(json.reduce((s, x) => s + x.costSheet.commission, 0)));
    expect(totals.commission).toBe('Rs. 4,300.75');
  });

  test('Total Cost still includes commission, and every row adds up', async () => {
    const json = (await getJson('cost-sheet')).body.data;
    const t1 = json.find((x) => x.item.itemId === 'ITM-T0001').costSheet;
    const withoutCommission = t1.baseCost + t1.rental + t1.refurbishment + t1.marketing + t1.logistics + t1.other;
    expect(t1.totalCost).toBeCloseTo(withoutCommission + 2500.25, 2);
    const { parsed } = await pdfText('cost-sheet?format=pdf');
    expectRowsReconcile(parsed, [...json.map((x) => x.item.itemId), 'Total']);
  });

  test('crore amounts in all 8 amount columns step the table font down and stay complete on one line', async () => {
    const Item = require('../models/Item');
    const Expense = require('../models/Expense');
    const owner = await require('../models/Customer').findOne({ customerId: 'CUST-T1' });
    const big = await Item.create({ itemId: 'ITM-T9100', name: 'Power Transformer', category: 'Machinery', owner: owner._id, status: 'In Warehouse', purchaseCost: 87654321.15 });
    const categories = { 'Warehouse Rental': 12345678.25, Refurbishment: 23456789.35, Marketing: 34567890.45, 'Inbound Logistics': 45678901.55, Commission: 56789012.65, Other: 67890123.75 };
    for (const [category, amount] of Object.entries(categories)) {
      await Expense.create({ item: big._id, category, amount, date: new Date('2026-10-15T06:00:00Z'), vendor: 'Bulk' });
    }

    const json = (await getJson('cost-sheet')).body.data;
    const { parsed } = await pdfText('cost-sheet?format=pdf');
    expect(parsed.pages[0].mediaBox.slice(2)).toEqual([841.89, 595.28]);
    const bigRow = amountsOnRow(parsed, 'ITM-T9100');
    const sizes = new Set(bigRow.cells.map((c) => c.size));
    expect(sizes.size).toBe(1);
    const [size] = sizes;
    expect(size).toBeLessThan(8.5);
    expect(size).toBeGreaterThanOrEqual(7.5);
    expect(amountsOnRow(parsed, 'Total').cells.every((c) => c.size === size)).toBe(true);

    // Every value complete on one line: exactly the formatted JSON value, no split "Rs.".
    const sheet = json.find((x) => x.item.itemId === 'ITM-T9100').costSheet;
    AMOUNT_KEYS.forEach((key) => expect(bigRow.amounts[key]).toBe(formatINR(sheet[key])));
    expect(bigRow.amounts.commission).toBe('Rs. 5,67,89,012.65');
    const totals = amountsOnRow(parsed, 'Total').amounts;
    AMOUNT_KEYS.forEach((key) => expect(totals[key]).toBe(formatINR(json.reduce((s, x) => s + (x.costSheet[key] || 0), 0))));
    expect(parsed.allTexts.filter((t) => t.trim() === 'Rs.')).toEqual([]);
    expectRowsReconcile(parsed, [...json.map((x) => x.item.itemId), 'Total']);
  });
});
