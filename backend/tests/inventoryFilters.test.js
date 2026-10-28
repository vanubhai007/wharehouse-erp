const request = require('supertest');
const { startTestDb, stopTestDb } = require('./testUtils');
const { parsePdf } = require('./helpers/pdfText');
const { resetRateLimits } = require('../middleware/rateLimit');
const { ROLES } = require('../config/constants');

// Inventory list and inventory PDF filtered by owner, by one item, or by a
// selection of items (?ids=). Uses the existing export route, so permissions,
// the per-user PDF limit and the 2,000-row limit all still apply.

let app;
let token;
let Item;
const owners = {};
const items = {};

const binary = (res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};
const getList = (query) => request(app).get('/api/items').query(query).set('Authorization', `Bearer ${token}`);
const getPdf = (query) => request(app).get('/api/items/export/pdf').query(query).set('Authorization', `Bearer ${token}`).buffer(true).parse(binary);

async function pdfItemIds(query) {
  const res = await getPdf(query);
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/^application\/pdf/);
  const texts = parsePdf(res.body).allTexts;
  return { ids: texts.filter((t) => /^ITM-F/.test(t)).sort(), joined: texts.join(' ') };
}

beforeAll(async () => {
  await startTestDb();
  app = require('../app');
  Item = require('../models/Item');
  const Customer = require('../models/Customer');
  await request(app).post('/api/auth/register').send({ name: 'Admin', email: 'admin@filters.com', password: 'AdminPass123', role: ROLES.ADMIN });
  token = (await request(app).post('/api/auth/login').send({ email: 'admin@filters.com', password: 'AdminPass123' })).body.data.token;

  owners.patel = await Customer.create({ customerId: 'CUST-F1', name: 'Ramesh Patel', businessName: 'Patel Traders', phone: '9000000031' });
  owners.shah = await Customer.create({ customerId: 'CUST-F2', name: 'Kiran Shah', phone: '9000000032' });
  const make = (itemId, owner, extra = {}) => Item.create({ itemId, name: `Item ${itemId}`, category: 'Test', owner: owner._id, purchaseCost: 100, ...extra });
  items.p1 = await make('ITM-F001', owners.patel, { status: 'In Warehouse' });
  items.p2 = await make('ITM-F002', owners.patel, { status: 'Received' });
  items.p3 = await make('ITM-F003', owners.patel, { isArchived: true });
  items.s1 = await make('ITM-F004', owners.shah, { status: 'In Warehouse' });
}, 60000);

beforeEach(() => resetRateLimits());

afterAll(async () => {
  await stopTestDb();
});

describe('owner filter (list and PDF)', () => {
  test('returns only that owner\'s current items, and combines with status', async () => {
    const list = await getList({ owner: String(owners.patel._id) });
    expect(list.status).toBe(200);
    expect(list.body.data.map((i) => i.itemId).sort()).toEqual(['ITM-F001', 'ITM-F002']);

    const { ids, joined } = await pdfItemIds({ owner: String(owners.patel._id) });
    expect(ids).toEqual(['ITM-F001', 'ITM-F002']);
    expect(joined).toContain('Owner = Patel Traders');
    expect((await pdfItemIds({ owner: String(owners.patel._id), status: 'Received' })).ids).toEqual(['ITM-F002']);
    expect((await pdfItemIds({ owner: String(owners.shah._id) })).ids).toEqual(['ITM-F004']);
  });

  test('an owner PDF is not limited to 200 items (only the 2,000-row PDF limit applies)', async () => {
    const Customer = require('../models/Customer');
    const big = await Customer.create({ customerId: 'CUST-F3', name: 'Bulk Owner', phone: '9000000033' });
    await Item.insertMany(Array.from({ length: 250 }, (_, i) => ({ itemId: `ITM-B${String(i).padStart(3, '0')}`, name: `Bulk ${i}`, category: 'Bulk', owner: big._id, purchaseCost: 10 })));
    const res = await getPdf({ owner: String(big._id) });
    expect(res.status).toBe(200);
    expect(parsePdf(res.body).allTexts.filter((t) => /^ITM-B\d{3}$/.test(t))).toHaveLength(250);
  }, 60000);

  test('an owner with more than 2,000 items is still refused with 413 before fetching', async () => {
    const Customer = require('../models/Customer');
    const huge = await Customer.create({ customerId: 'CUST-F4', name: 'Huge Owner', phone: '9000000034' });
    await Item.insertMany(Array.from({ length: 2001 }, (_, i) => ({ itemId: `ITM-H${String(i).padStart(4, '0')}`, name: `Huge ${i}`, category: 'Huge', owner: huge._id, purchaseCost: 1 })));
    const res = await getPdf({ owner: String(huge._id) });
    expect(res.status).toBe(413);
    expect(JSON.parse(res.body.toString()).message).toContain('2,001 matching records');
  }, 60000);
});

describe('one item or selected items (?ids=)', () => {
  test('one item: the PDF contains only that item and names it in the filters line', async () => {
    const { ids, joined } = await pdfItemIds({ ids: String(items.s1._id) });
    expect(ids).toEqual(['ITM-F004']);
    expect(joined).toContain('Selected items = ITM-F004');
  });

  test('several items: exactly those items, whatever their owner', async () => {
    const { ids, joined } = await pdfItemIds({ ids: [items.p1._id, items.s1._id].join(',') });
    expect(ids).toEqual(['ITM-F001', 'ITM-F004']);
    expect(joined).toContain('Selected items = 2 selected');
    const list = await getList({ ids: [items.p1._id, items.s1._id, items.p1._id].join(',') }); // duplicates are fine
    expect(list.body.data.map((i) => i.itemId).sort()).toEqual(['ITM-F001', 'ITM-F004']);
  });

  test('ids combine with other filters (owner) rather than overriding them', async () => {
    const { ids } = await pdfItemIds({ ids: [items.p1._id, items.s1._id].join(','), owner: String(owners.patel._id) });
    expect(ids).toEqual(['ITM-F001']);
  });

  test('archived items are left out unless includeArchived=true, as for the list', async () => {
    expect((await pdfItemIds({ ids: String(items.p3._id) })).ids).toEqual([]);
    expect((await pdfItemIds({ ids: String(items.p3._id), includeArchived: 'true' })).ids).toEqual(['ITM-F003']);
  });

  test('exactly 200 ids are accepted', async () => {
    const mongoose = require('mongoose');
    const ids = [String(items.p1._id), ...Array.from({ length: 199 }, () => String(new mongoose.Types.ObjectId()))];
    expect((await pdfItemIds({ ids: ids.join(',') })).ids).toEqual(['ITM-F001']);
  });

  test.each([
    ['more than 200 ids', () => Array.from({ length: 201 }, (_, i) => i.toString(16).padStart(24, '0')).join(','), 'Select at most 200 items for one PDF.'],
    ['a malformed id', () => `${items.p1._id},not-an-id`, 'Invalid item selection.'],
    ['a 12-character id', () => 'abcdefghijkl', 'Invalid item selection.'],
    ['an empty selection', () => '', 'No items selected.'],
  ])('%s is rejected with 400 (PDF and list)', async (_, ids, message) => {
    const pdf = await getPdf({ ids: ids() });
    expect(pdf.status).toBe(400);
    expect(JSON.parse(pdf.body.toString()).message).toBe(message);
    const list = await getList({ ids: ids() });
    expect(list.status).toBe(400);
    expect(list.body.message).toBe(message);
  });
});

describe('existing protections still apply', () => {
  test('selected-item exports count towards the 10-per-minute PDF limit', async () => {
    for (let i = 0; i < 10; i += 1) expect((await getPdf({ ids: String(items.p1._id) })).status).toBe(200);
    const limited = await getPdf({ ids: String(items.p1._id) });
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });

  test('requests without a login are rejected', async () => {
    expect((await request(app).get('/api/items/export/pdf').query({ ids: String(items.p1._id) })).status).toBe(401);
    expect((await request(app).get('/api/items').query({ owner: String(owners.patel._id) })).status).toBe(401);
  });
});
