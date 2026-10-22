const request = require('supertest');
const { startTestDb, stopTestDb } = require('./testUtils');
const { PUBLIC_ID_PATTERN, isApprovedFileRef, isApprovedLogoUrl } = require('../utils/fileRefs');

// Only the cloud name is needed for link validation; no real credentials are
// set, so Cloudinary itself stays unconfigured (QR codes fall back to data URLs).
const CLOUD = 'testcloud';
const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
process.env.CLOUDINARY_CLOUD_NAME = CLOUD;

const BASE = `https://res.cloudinary.com/${CLOUD}`;
const imageRef = (folder, id = 'abc123') => ({
  url: `${BASE}/image/upload/v1700000000/hrwarehouse/${folder}/${id}.png`,
  publicId: `hrwarehouse/${folder}/${id}`,
  originalName: `${id}.png`,
  label: 'Photo',
});
const pdfRef = (folder, id = 'doc123') => ({
  url: `${BASE}/raw/upload/v1700000000/hrwarehouse/${folder}/${id}.pdf`,
  publicId: `hrwarehouse/${folder}/${id}.pdf`,
  originalName: `${id}.pdf`,
});
const JS_REF = { url: 'javascript:alert(1)', publicId: 'hrwarehouse/items/abc123' };
const LEGACY = { url: 'http://legacy.example.com/old-scan.jpg', publicId: 'legacy/old-scan', originalName: 'old-scan.jpg' };

let app;
let token;
let adminId;

beforeAll(async () => {
  await startTestDb();
  app = require('../app');
  await request(app).post('/api/auth/register').send({ name: 'Admin', email: 'admin@filerefs.com', password: 'AdminPass123', role: 'Admin' });
  const login = await request(app).post('/api/auth/login').send({ email: 'admin@filerefs.com', password: 'AdminPass123' });
  token = login.body.data.token;
  adminId = login.body.data.user._id;
}, 60000);

afterAll(async () => {
  await stopTestDb();
  if (originalCloudName === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
  else process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
});

const api = {
  post: (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path, body) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
};

// A 400 must come from the file-reference check, not some other validation.
function expectRejected(res) {
  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/Invalid file reference/);
}

// The customer update route validates name and phone, so updates send them too.
const customerUpdate = (customer, documents) => ({ name: customer.name, phone: customer.phone, documents });

let phoneSeq = 0;
async function createCustomer(extra = {}) {
  phoneSeq += 1;
  return api.post('/api/customers', { name: 'Owner', phone: `90000${String(phoneSeq).padStart(5, '0')}`, ...extra });
}

async function createItem(extra = {}) {
  const customer = await createCustomer();
  return api.post('/api/items', { name: 'Desk', category: 'Furniture', owner: customer.body.data._id, purchaseCost: 500, ...extra });
}

// Stores a non-standard ("legacy") file entry directly in MongoDB, bypassing
// the API, then returns the record as the frontend would load it.
async function seedLegacy(Model, id, field, getPath) {
  await Model.updateOne({ _id: id }, { $push: { [field]: LEGACY } });
  const res = await api.get(getPath);
  return res.body.data;
}

describe('file reference validator', () => {
  test('accepts this app\'s image and PDF references', () => {
    expect(isApprovedFileRef(imageRef('items'), 'items')).toBe(true);
    expect(isApprovedFileRef({ url: `${BASE}/image/upload/hrwarehouse/items/abc123`, publicId: 'hrwarehouse/items/abc123' }, 'items')).toBe(true);
    expect(isApprovedFileRef(pdfRef('payments'), 'payments')).toBe(true);
    expect(isApprovedFileRef({ url: `${BASE}/raw/upload/v1/hrwarehouse/payments/doc123.pdf`, publicId: 'hrwarehouse/payments/doc123' }, 'payments')).toBe(true);
  });

  const good = imageRef('items');
  test.each([
    ['javascript: URL', { ...good, url: 'javascript:alert(1)' }],
    ['data: URL', { ...good, url: 'data:image/png;base64,iVBORw0KGgo=' }],
    ['plain http', { ...good, url: good.url.replace('https:', 'http:') }],
    ['look-alike host', { ...good, url: good.url.replace('res.cloudinary.com', 'res.cloudinary.com.evil.com') }],
    ['external host', { ...good, url: good.url.replace('res.cloudinary.com', 'evil.com') }],
    ['credentials in URL', { ...good, url: good.url.replace('https://', 'https://user:pass@') }],
    ['explicit port', { ...good, url: good.url.replace('res.cloudinary.com', 'res.cloudinary.com:8443') }],
    ['query string', { ...good, url: `${good.url}?x=1` }],
    ['fragment', { ...good, url: `${good.url}#x` }],
    ['another Cloudinary account', { ...good, url: good.url.replace(`/${CLOUD}/`, '/othercloud/') }],
    ['video resource type', { ...good, url: good.url.replace('/image/', '/video/') }],
    ['non-upload delivery type', { ...good, url: good.url.replace('/upload/', '/authenticated/') }],
    ['URL for a different public ID', { ...good, url: good.url.replace('abc123', 'zzz999') }],
    ['public ID outside hrwarehouse', { url: `${BASE}/image/upload/other/abc123.png`, publicId: 'other/abc123' }],
    ['path traversal', { url: `${BASE}/image/upload/hrwarehouse/items/../items/abc123.png`, publicId: 'hrwarehouse/items/abc123' }],
    ['encoded characters', { url: `${BASE}/image/upload/hrwarehouse/items/abc%2F123.png`, publicId: 'hrwarehouse/items/abc123' }],
    ['wrong extension for an image', { ...good, url: good.url.replace('.png', '.pdf') }],
    ['missing public ID', { url: good.url }],
    ['non-string URL', { ...good, url: 42 }],
  ])('rejects %s', (label, ref) => {
    expect(isApprovedFileRef(ref, 'items')).toBe(false);
  });

  test('rejects a reference from another folder', () => {
    expect(isApprovedFileRef(imageRef('payments'), 'items')).toBe(false);
  });

  test('approves nothing when no Cloudinary account is configured', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    try {
      expect(isApprovedFileRef(imageRef('items'), 'items')).toBe(false);
    } finally {
      process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
    }
  });

  test('shared public ID pattern accepts IDs with and without a .pdf extension', () => {
    expect(PUBLIC_ID_PATTERN.exec('hrwarehouse/payments/abc123.pdf')[1]).toBe('payments');
    expect(PUBLIC_ID_PATTERN.test('hrwarehouse/payments/abc123')).toBe(true);
    expect(PUBLIC_ID_PATTERN.test('hrwarehouse/payments/../x')).toBe(false);
  });

  test('logo URLs must be images from the configured account', () => {
    expect(isApprovedLogoUrl(`${BASE}/image/upload/v1/brand/logo.png`)).toBe(true);
    expect(isApprovedLogoUrl(`${BASE}/image/upload/logo.png`)).toBe(true);
    expect(isApprovedLogoUrl(`${BASE}/raw/upload/logo.pdf`)).toBe(false);
    expect(isApprovedLogoUrl('https://res.cloudinary.com/othercloud/image/upload/logo.png')).toBe(false);
    expect(isApprovedLogoUrl(`${BASE}/image/upload/w_200,h_100/logo.png`)).toBe(false);
    expect(isApprovedLogoUrl('javascript:alert(1)')).toBe(false);
    expect(isApprovedLogoUrl('https://evil.com/logo.png')).toBe(false);
  });
});

describe('1. POST /api/customers', () => {
  test('stores approved references with uploadedBy set by the server', async () => {
    const res = await createCustomer({
      documents: [{ ...pdfRef('customers'), uploadedBy: '000000000000000000000000', extra: 'dropped' }],
      photos: [imageRef('customers')],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.documents[0]).toMatchObject({ url: pdfRef('customers').url, publicId: pdfRef('customers').publicId, uploadedBy: adminId });
    expect(res.body.data.documents[0].extra).toBeUndefined();
    expect(res.body.data.photos[0].publicId).toBe('hrwarehouse/customers/abc123');
  });

  test('rejects unsafe or wrong-folder references and creates nothing', async () => {
    const Customer = require('../models/Customer');
    const before = await Customer.countDocuments();
    expectRejected(await createCustomer({ documents: [JS_REF] }));
    expectRejected(await createCustomer({ photos: [imageRef('items')] }));
    expectRejected(await createCustomer({ photos: 'not-a-list' }));
    expect(await Customer.countDocuments()).toBe(before);
  });
});

describe('2. PUT /api/customers/:id', () => {
  test('keeps an unchanged legacy reference and adds a new approved one', async () => {
    const Customer = require('../models/Customer');
    const created = await createCustomer();
    const id = created.body.data._id;
    const loaded = await seedLegacy(Customer, id, 'documents', `/api/customers/${id}`);
    const legacy = loaded.documents[0];

    const res = await api.put(`/api/customers/${id}`, customerUpdate(loaded, [legacy, pdfRef('customers')]));
    expect(res.status).toBe(200);
    expect(res.body.data.documents).toHaveLength(2);
    expect(res.body.data.documents[0]).toMatchObject({ _id: legacy._id, url: LEGACY.url, publicId: LEGACY.publicId });
  });

  test('rejects a changed legacy reference or a new unsafe one, leaving the record unchanged', async () => {
    const Customer = require('../models/Customer');
    const created = await createCustomer();
    const id = created.body.data._id;
    const loaded = await seedLegacy(Customer, id, 'documents', `/api/customers/${id}`);
    const legacy = loaded.documents[0];

    expectRejected(await api.put(`/api/customers/${id}`, customerUpdate(loaded, [{ ...legacy, url: 'javascript:alert(1)' }])));
    expectRejected(await api.put(`/api/customers/${id}`, customerUpdate(loaded, [{ ...legacy, publicId: 'legacy/other' }])));
    expectRejected(await api.put(`/api/customers/${id}`, customerUpdate(loaded, [legacy, JS_REF])));
    expectRejected(await api.put(`/api/customers/${id}`, customerUpdate(loaded, [{ ...LEGACY }]))); // legacy URL without its _id
    const stored = await Customer.findById(id);
    expect(stored.documents).toHaveLength(1);
    expect(stored.documents[0].url).toBe(LEGACY.url);
  });

  test('a legacy reference can be removed', async () => {
    const Customer = require('../models/Customer');
    const created = await createCustomer();
    const id = created.body.data._id;
    const loaded = await seedLegacy(Customer, id, 'documents', `/api/customers/${id}`);
    const res = await api.put(`/api/customers/${id}`, customerUpdate(loaded, []));
    expect(res.status).toBe(200);
    expect(res.body.data.documents).toHaveLength(0);
  });
});

describe('3. POST /api/items', () => {
  test('stores approved photos and documents', async () => {
    const res = await createItem({ photos: [imageRef('items')], documents: [pdfRef('items')] });
    expect(res.status).toBe(201);
    expect(res.body.data.photos[0].publicId).toBe('hrwarehouse/items/abc123');
    expect(res.body.data.documents[0].publicId).toBe('hrwarehouse/items/doc123.pdf');
  });

  test('rejects unsafe or wrong-folder references', async () => {
    expectRejected(await createItem({ photos: [JS_REF] }));
    expectRejected(await createItem({ documents: [pdfRef('expenses')] }));
  });

  test('ignores a client-supplied QR code URL and public ID', async () => {
    const res = await createItem({ qrCodeUrl: 'javascript:alert(1)', qrCodePublicId: 'hrwarehouse/qrcodes/fake' });
    expect(res.status).toBe(201);
    expect(res.body.data.qrCodeUrl).toMatch(/^data:image\/png;base64,/);
    expect(res.body.data.qrCodePublicId).not.toBe('hrwarehouse/qrcodes/fake');
  });
});

describe('4. PUT /api/items/:id', () => {
  test('keeps an unchanged legacy reference, accepts new approved ones, rejects changes', async () => {
    const Item = require('../models/Item');
    const created = await createItem();
    const id = created.body.data._id;
    const loaded = await seedLegacy(Item, id, 'photos', `/api/items/${id}`);
    const legacy = loaded.photos[0];

    const ok = await api.put(`/api/items/${id}`, { photos: [legacy, imageRef('items', 'new1')] });
    expect(ok.status).toBe(200);
    expect(ok.body.data.photos).toHaveLength(2);
    expect(ok.body.data.photos[0]).toMatchObject({ _id: legacy._id, url: LEGACY.url });
    expect(ok.body.data.photos[1].uploadedBy).toBe(adminId);

    expectRejected(await api.put(`/api/items/${id}`, { photos: [{ ...legacy, url: 'https://evil.com/x.png' }] }));
    expectRejected(await api.put(`/api/items/${id}`, { documents: [JS_REF] }));
    expect((await Item.findById(id)).photos).toHaveLength(2);

    const removed = await api.put(`/api/items/${id}`, { photos: [] });
    expect(removed.body.data.photos).toHaveLength(0);
  });
});

describe('5. POST /api/expenses', () => {
  test('accepts approved receipts and rejects unsafe or wrong-folder ones', async () => {
    const item = await createItem();
    const base = { item: item.body.data._id, category: 'Other', amount: 100, force: true };
    const ok = await api.post('/api/expenses', { ...base, receipts: [pdfRef('expenses')] });
    expect(ok.status).toBe(201);
    expect(ok.body.data.receipts[0].publicId).toBe('hrwarehouse/expenses/doc123.pdf');
    expectRejected(await api.post('/api/expenses', { ...base, receipts: [JS_REF] }));
    expectRejected(await api.post('/api/expenses', { ...base, receipts: [imageRef('payments')] }));
  });
});

describe('6. POST /api/payments', () => {
  test('accepts approved proof and rejects unsafe or wrong-folder ones', async () => {
    const base = { direction: 'Receivable', amount: 250 };
    const ok = await api.post('/api/payments', { ...base, proof: [imageRef('payments')] });
    expect(ok.status).toBe(201);
    expect(ok.body.data.proof[0].publicId).toBe('hrwarehouse/payments/abc123');
    expectRejected(await api.post('/api/payments', { ...base, proof: [{ url: 'data:image/png;base64,iVBORw0KGgo=', publicId: 'hrwarehouse/payments/abc123' }] }));
    expectRejected(await api.post('/api/payments', { ...base, proof: [imageRef('items')] }));
  });
});

describe('7. POST /api/refurbishments', () => {
  test('accepts approved before/after photos and rejects unsafe ones', async () => {
    const Refurbishment = require('../models/Refurbishment');
    const item = await createItem();
    const base = { item: item.body.data._id, workDescription: 'Polish', assignedTo: 'Vendor', startDate: '2026-10-01' };
    const ok = await api.post('/api/refurbishments', { ...base, beforePhotos: [imageRef('refurbishment')], afterPhotos: [imageRef('refurbishment', 'after1')] });
    expect(ok.status).toBe(201);
    expect(ok.body.data.beforePhotos[0].publicId).toBe('hrwarehouse/refurbishment/abc123');

    const count = await Refurbishment.countDocuments();
    expectRejected(await api.post('/api/refurbishments', { ...base, afterPhotos: [JS_REF] }));
    expectRejected(await api.post('/api/refurbishments', { ...base, beforePhotos: [imageRef('items')] }));
    expect(await Refurbishment.countDocuments()).toBe(count);
  });
});

describe('8. PUT /api/settings (companyLogoUrl)', () => {
  test('accepts empty or an approved logo, rejects unsafe values, keeps an unchanged legacy logo', async () => {
    const Settings = require('../models/Settings');
    const logo = `${BASE}/image/upload/v1/brand/logo.png`;

    const ok = await api.put('/api/settings', { companyLogoUrl: logo });
    expect(ok.status).toBe(200);
    expect(ok.body.data.companyLogoUrl).toBe(logo);

    for (const bad of ['javascript:alert(1)', 'https://evil.com/logo.png', 'https://res.cloudinary.com/othercloud/image/upload/logo.png', `${BASE}/raw/upload/logo.pdf`]) {
      expectRejected(await api.put('/api/settings', { companyLogoUrl: bad }));
    }
    expect((await Settings.getSettings()).companyLogoUrl).toBe(logo);

    expect((await api.put('/api/settings', { companyLogoUrl: '' })).status).toBe(200);

    await Settings.updateOne({}, { companyLogoUrl: 'http://legacy.example.com/logo.png' });
    const legacy = await api.put('/api/settings', { companyLogoUrl: 'http://legacy.example.com/logo.png', companyName: 'HR Warehouse Ltd' });
    expect(legacy.status).toBe(200);
    expect(legacy.body.data.companyName).toBe('HR Warehouse Ltd');
  });
});
