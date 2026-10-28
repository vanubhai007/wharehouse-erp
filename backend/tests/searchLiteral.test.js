const request = require('supertest');
const { startTestDb, stopTestDb } = require('./testUtils');
const { parsePdf } = require('./helpers/pdfText');
const { ROLES } = require('../config/constants');
const { escapeRegex, searchRegex } = require('../utils/searchRegex');

// Search text is matched literally (case-insensitive substring) in every list
// that takes ?search=: regex metacharacters are plain characters, and text
// that is not a valid regex (e.g. "+91", "(") no longer causes a 500.

let app;
let token;

const binary = (res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};
const get = (path, query) => request(app).get(path).query(query).set('Authorization', `Bearer ${token}`);

// Per list: the special record S (holding "C++ Traders (Pvt) Ltd", "+91 98765 43210"
// and "a.b@x.com" in searched fields), a decoy D holding "aXb@x.com" where S has
// "a.b@x.com", and two plain records FOO ("foo widget") and BAR ("bar widget").
// `ids` maps each record's _id to its label once seeded.
const ENDPOINTS = [
  { name: 'inventory', path: '/api/items', ids: {} },
  { name: 'buyers', path: '/api/buyers', ids: {} },
  { name: 'buyer enquiries', path: '/api/buyers/enquiries', ids: {} },
  { name: 'customers', path: '/api/customers', ids: {} },
  { name: 'sales inquiries', path: '/api/sales-inquiries', ids: {} },
  { name: 'users', path: '/api/users', ids: {} },
];
const endpoint = (name) => ENDPOINTS.find((e) => e.name === name);

async function seed() {
  const Item = require('../models/Item');
  const Buyer = require('../models/Buyer');
  const BuyerEnquiry = require('../models/BuyerEnquiry');
  const Customer = require('../models/Customer');
  const SalesInquiry = require('../models/SalesInquiry');
  const User = require('../models/User');
  const S = 'C++ Traders (Pvt) Ltd';
  const PHONE = '+91 98765 43210';
  const records = (make) => ({ S: make(S, PHONE, 'a.b@x.com', 1), D: make('Decoy record', '9000000002', 'aXb@x.com', 2), FOO: make('foo widget', '9000000003', 'foo@y.com', 3), BAR: make('bar widget', '9000000004', 'bar@y.com', 4) });
  const store = async (name, docs) => {
    for (const [label, doc] of Object.entries(docs)) endpoint(name).ids[String((await doc)._id)] = label;
  };

  // Items belong to an owner whose name matches none of the searches, so
  // only the items' own fields decide the inventory results here.
  const neutral = await Customer.create({ customerId: 'CUST-S0', name: 'Neutral Owner', phone: '9000000000' });
  await store('inventory', records((name, phone, email, n) => Item.create({ itemId: `ITM-S${n}`, name, serialNumber: phone, sku: email, category: 'Test', owner: neutral._id, purchaseCost: 100 })));
  await store('buyers', records((name, phone, email, n) => Buyer.create({ buyerId: `BUY-S${n}`, name, phone, businessName: email })));
  await store('buyer enquiries', records((name, phone, email) => BuyerEnquiry.create({ buyerName: name, phone, email, productName: 'Generator' })));
  await store('customers', records((name, phone, email, n) => Customer.create({ customerId: `CUST-S${n}`, name, phone, email })));
  await store('sales inquiries', records((name, phone, email, n) => SalesInquiry.create({ inquiryNumber: `INQ-S${n}`, contactName: name, phone, email, productName: 'Generator' })));
  // Users are searched by name and email only, so the phone text goes in the name.
  await store('users', records((name, phone, email) => User.create({ name: `${name} ${phone}`, email, password: 'UserPass123', role: ROLES.WAREHOUSE_STAFF })));
}

beforeAll(async () => {
  await startTestDb();
  app = require('../app');
  await request(app).post('/api/auth/register').send({ name: 'Admin', email: 'admin@search.com', password: 'AdminPass123', role: ROLES.ADMIN });
  token = (await request(app).post('/api/auth/login').send({ email: 'admin@search.com', password: 'AdminPass123' })).body.data.token;
  await seed();
}, 60000);

afterAll(async () => {
  await stopTestDb();
});

describe('searchRegex helper', () => {
  test('escapes every regex metacharacter', () => {
    const special = '.*+?^${}()|[]\\';
    expect(escapeRegex(special)).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
    expect(searchRegex(special).test(`before ${special} after`)).toBe(true);
    expect(searchRegex('a.b').test('aXb')).toBe(false);
    expect(searchRegex('foo|bar').test('foo')).toBe(false);
    expect(searchRegex('foo|bar').test('x foo|bar y')).toBe(true);
  });

  test('keeps plain text unchanged and matches case-insensitively anywhere', () => {
    expect(escapeRegex('ITM-I000 Steel rack')).toBe('ITM-I000 Steel rack');
    expect(searchRegex('steel RACK').test('Old Steel Rack 2')).toBe(true);
    expect(searchRegex('C++').flags).toBe('i');
  });

  test('turns non-string input into text the same way as before', () => {
    expect(searchRegex(['a', 'b']).source).toBe(new RegExp(['a', 'b'], 'i').source); // "a,b"
    expect(searchRegex({ x: 1 }).test('[object Object]')).toBe(true);
  });
});

describe.each(ENDPOINTS.map((e) => [e.name, e]))('%s search is literal', (name, ep) => {
  async function labels(search) {
    const res = await get(ep.path, { search });
    expect(res.status).toBe(200);
    return res.body.data.map((doc) => ep.ids[String(doc._id)]).filter(Boolean).sort();
  }

  test.each([
    ['C++', ['S']],
    ['(Pvt)', ['S']],
    ['+91 98765', ['S']],
    ['traders', ['S']], // case-insensitive, partial
    ['TRADERS (PVT', ['S']],
    ['a.b@x.com', ['S']], // "." is literal: the decoy "aXb@x.com" is not matched
    ['foo|bar', []], // "|" is literal, not "foo or bar"
    ['widget', ['BAR', 'FOO']], // plain search unchanged
  ])('search %j finds %j', async (search, expected) => {
    expect(await labels(search)).toEqual(expected);
  });

  test.each(['(', '[', '\\', '*', '(a+)+$'])('search %j is not read as a pattern (200, no error)', async (search) => {
    const found = await labels(search);
    expect(found).toEqual(search === '(' ? ['S'] : []);
  });
});

describe('inventory: owner lookup and PDF export use the literal search too', () => {
  test('owner names with special characters are found literally', async () => {
    const Customer = require('../models/Customer');
    const Item = require('../models/Item');
    const owner = await Customer.create({ customerId: 'CUST-S9', name: 'Mehta [Group]', businessName: 'Mehta & Co. (Exports)', phone: '9000000009' });
    await Item.create({ itemId: 'ITM-S9', name: 'Plain crate', category: 'Test', owner: owner._id, purchaseCost: 50 });
    const ids = async (search) => (await get('/api/items', { search })).body.data.map((i) => i.itemId);
    expect(await ids('[Group]')).toEqual(['ITM-S9']);
    expect(await ids('Co. (Exports)')).toEqual(['ITM-S9']);
    expect(await ids('Co.X')).toEqual([]);
  });

  test('the inventory PDF export accepts special characters and lists only literal matches', async () => {
    // "(" also matches ITM-S9 through its owner "Mehta & Co. (Exports)" (added above).
    for (const [search, expected] of [['C++', ['ITM-S1']], ['(', ['ITM-S1', 'ITM-S9']], ['a.b@x.com', ['ITM-S1']], ['foo|bar', []]]) {
      const res = await get('/api/items/export/pdf', { search }).buffer(true).parse(binary);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/^application\/pdf/);
      const texts = parsePdf(res.body).allTexts;
      expect(texts.filter((t) => /^ITM-S\d$/.test(t)).sort()).toEqual(expected);
      expect(texts.join(' ')).toContain(`Search = "${search}"`);
    }
  });
});
