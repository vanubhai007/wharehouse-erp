const request = require('supertest');
const mongoose = require('mongoose');
const { startTestDb, stopTestDb } = require('./testUtils');
const { ROLES } = require('../config/constants');

// Paged lists must return every record exactly once even when many records
// share the same createdAt (bulk imports, seed scripts). Sorting by createdAt
// alone leaves the order of ties undefined, so pages can overlap and records
// can be skipped; _id breaks the tie.

let app;
let token;
let Customer;
let Item;
const SAME_TIME = new Date('2026-10-01T06:00:00.000Z');

async function fetchAllPages(path, query = {}) {
  const ids = [];
  let page = 1;
  let totalPages = 1;
  let total = 0;
  do {
    const res = await request(app).get(path).query({ ...query, page, limit: 100 }).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    ids.push(...res.body.data.map((d) => String(d._id)));
    ({ totalPages, total } = res.body.pagination);
    page += 1;
  } while (page <= totalPages);
  return { ids, total, pages: page - 1 };
}

beforeAll(async () => {
  await startTestDb();
  app = require('../app');
  Customer = require('../models/Customer');
  Item = require('../models/Item');
  await request(app).post('/api/auth/register').send({ name: 'Admin', email: 'admin@paging.com', password: 'AdminPass123', role: ROLES.ADMIN });
  token = (await request(app).post('/api/auth/login').send({ email: 'admin@paging.com', password: 'AdminPass123' })).body.data.token;
}, 60000);

afterEach(async () => {
  await Item.deleteMany({});
  await Customer.deleteMany({});
});

afterAll(async () => {
  await stopTestDb();
});

describe('stable pagination with identical createdAt', () => {
  test('owners: 105 owners with the same createdAt (plus 3 newer) are each returned exactly once across pages', async () => {
    const owner = (i, createdAt) => ({
      _id: new mongoose.Types.ObjectId(), customerId: `CUST-P${String(i).padStart(3, '0')}`, name: `Owner ${i}`, phone: `90000${String(i).padStart(5, '0')}`, createdAt, updatedAt: createdAt,
    });
    // 105 owners created at the same instant (e.g. a bulk import), then 3 more
    // afterwards. With createdAt as the only sort key this layout makes the
    // old query skip owners at the page boundary.
    const docs = [
      ...Array.from({ length: 105 }, (_, i) => owner(i, SAME_TIME)),
      ...[1, 2, 3].map((k) => owner(200 + k, new Date(SAME_TIME.getTime() + k * 1000))),
    ];
    // Bypass Mongoose timestamps so every createdAt really is identical.
    await Customer.collection.insertMany(docs);
    expect(await Customer.countDocuments({ createdAt: SAME_TIME })).toBe(105);

    const { ids, total, pages } = await fetchAllPages('/api/customers');
    expect(total).toBe(108);
    expect(pages).toBe(2);
    expect(ids).toHaveLength(108);
    expect(new Set(ids).size).toBe(108);
    expect([...ids].sort()).toEqual(docs.map((d) => String(d._id)).sort());
  });

  test('items: 230 items of one owner with the same createdAt are each returned exactly once across pages', async () => {
    const owner = await Customer.create({ customerId: 'CUST-POWN', name: 'Paging Owner', phone: '9000000099' });
    const other = await Customer.create({ customerId: 'CUST-POTH', name: 'Other Owner', phone: '9000000098' });
    const docs = Array.from({ length: 230 }, (_, i) => ({
      _id: new mongoose.Types.ObjectId(), itemId: `ITM-PG${String(i).padStart(4, '0')}`, name: `Paged item ${i}`, category: 'Bulk', owner: owner._id, purchaseCost: 10, isArchived: false, status: 'Received', createdAt: SAME_TIME, updatedAt: SAME_TIME,
    }));
    await Item.collection.insertMany([
      ...docs,
      { _id: new mongoose.Types.ObjectId(), itemId: 'ITM-PGOTHER', name: 'Other owner item', category: 'Bulk', owner: other._id, purchaseCost: 10, isArchived: false, status: 'Received', createdAt: SAME_TIME, updatedAt: SAME_TIME },
    ]);

    // The owner filter used by owner-wise sticker printing.
    const byOwner = await fetchAllPages('/api/items', { owner: String(owner._id) });
    expect(byOwner.total).toBe(230);
    expect(byOwner.pages).toBe(3);
    expect(byOwner.ids).toHaveLength(230);
    expect(new Set(byOwner.ids).size).toBe(230);
    expect([...byOwner.ids].sort()).toEqual(docs.map((d) => String(d._id)).sort());

    // And the unfiltered inventory list.
    const all = await fetchAllPages('/api/items');
    expect(all.total).toBe(231);
    expect(new Set(all.ids).size).toBe(231);
  });

  test('page order is newest first, then by _id for records created at the same time', async () => {
    const older = await Customer.create({ customerId: 'CUST-OLD', name: 'Older', phone: '9000000097', createdAt: new Date('2026-09-01T00:00:00Z') });
    const ids = Array.from({ length: 3 }, () => new mongoose.Types.ObjectId());
    await Customer.collection.insertMany(ids.map((_id, i) => ({ _id, customerId: `CUST-T${i}`, name: `Tie ${i}`, phone: `900000009${i}`, createdAt: SAME_TIME, updatedAt: SAME_TIME })));
    const res = await request(app).get('/api/customers').query({ limit: 10 }).set('Authorization', `Bearer ${token}`);
    const expected = [...ids.map(String)].sort().reverse();
    expect(res.body.data.map((c) => String(c._id))).toEqual([...expected, String(older._id)]);
  });
});
