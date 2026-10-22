const request = require('supertest');
const { startTestDb, stopTestDb } = require('./testUtils');
const { ROLES, ALL_ROLES } = require('../config/constants');

// Only the cloud name is needed for link validation; no real credentials are set.
const CLOUD = 'testcloud';
const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
process.env.CLOUDINARY_CLOUD_NAME = CLOUD;

const BASE = `https://res.cloudinary.com/${CLOUD}`;
const photo = (id, folder = 'refurbishment') => ({
  url: `${BASE}/image/upload/v1700000000/hrwarehouse/${folder}/${id}.jpg`,
  publicId: `hrwarehouse/${folder}/${id}`,
  originalName: `${id}.jpg`,
  label: 'beforePhotos',
});
const LEGACY = { url: 'http://legacy.example.com/old-before.jpg', publicId: 'legacy/old-before', originalName: 'old-before.jpg' };

let app;
let Refurbishment;
const tokens = {};
const userIds = {};
let phoneSeq = 0;

beforeAll(async () => {
  await startTestDb();
  app = require('../app');
  Refurbishment = require('../models/Refurbishment');

  await request(app).post('/api/auth/register').send({ name: 'Admin', email: 'admin@refurb.com', password: 'AdminPass123', role: ROLES.ADMIN });
  for (const role of ALL_ROLES) {
    const email = role === ROLES.ADMIN ? 'admin@refurb.com' : `${role.replace(/[^a-z]/gi, '').toLowerCase()}@refurb.com`;
    const password = role === ROLES.ADMIN ? 'AdminPass123' : 'RolePass123';
    if (role !== ROLES.ADMIN) {
      await request(app).post('/api/users').set('Authorization', `Bearer ${tokens[ROLES.ADMIN]}`).send({ name: role, email, password, role });
    }
    const login = await request(app).post('/api/auth/login').send({ email, password });
    tokens[role] = login.body.data.token;
    userIds[role] = login.body.data.user._id;
  }
}, 60000);

afterAll(async () => {
  await stopTestDb();
  if (originalCloudName === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
  else process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
});

const put = (role, jobId, body) => {
  const req = request(app).put(`/api/refurbishments/${jobId}`);
  return (role ? req.set('Authorization', `Bearer ${tokens[role]}`) : req).send(body);
};

// Creates an item and a refurbishment job for it; returns { jobId, itemId }.
async function createJob() {
  const admin = (r) => r.set('Authorization', `Bearer ${tokens[ROLES.ADMIN]}`);
  phoneSeq += 1;
  const customer = await admin(request(app).post('/api/customers')).send({ name: 'Owner', phone: `91000${String(phoneSeq).padStart(5, '0')}` });
  const item = await admin(request(app).post('/api/items')).send({ name: 'Cabinet', category: 'Furniture', owner: customer.body.data._id, purchaseCost: 800 });
  const job = await admin(request(app).post('/api/refurbishments')).send({
    item: item.body.data._id,
    workDescription: 'Repaint',
    assignedTo: 'Vendor A',
    startDate: '2026-10-01',
    repairCost: 300,
  });
  expect(job.status).toBe(201);
  return { jobId: job.body.data._id, itemId: item.body.data._id };
}

// "Reopening" the job: the refurbishment page loads jobs through this list endpoint.
async function reopen({ jobId, itemId }) {
  const res = await request(app).get(`/api/refurbishments?item=${itemId}`).set('Authorization', `Bearer ${tokens[ROLES.ADMIN]}`);
  return res.body.data.find((j) => j._id === jobId);
}

function expectRejected(res, field) {
  expect(res.status).toBe(400);
  expect(res.body.message).toBe(`Invalid file reference in '${field}'`);
}

describe('saving photos', () => {
  test('before photos saved by Warehouse Staff are still there after reopening', async () => {
    const job = await createJob();
    const res = await put(ROLES.WAREHOUSE_STAFF, job.jobId, { beforePhotos: [photo('b1')] });
    expect(res.status).toBe(200);

    const reopened = await reopen(job);
    expect(reopened.beforePhotos).toHaveLength(1);
    expect(reopened.beforePhotos[0]).toMatchObject({ url: photo('b1').url, publicId: photo('b1').publicId, uploadedBy: userIds[ROLES.WAREHOUSE_STAFF] });
    expect(reopened.afterPhotos).toHaveLength(0);
  });

  test('saving one list never overwrites the other', async () => {
    const job = await createJob();
    await put(ROLES.WAREHOUSE_STAFF, job.jobId, { beforePhotos: [photo('b1')] });
    expect((await put(ROLES.WAREHOUSE_STAFF, job.jobId, { afterPhotos: [photo('a1')] })).status).toBe(200);

    let reopened = await reopen(job);
    expect(reopened.beforePhotos.map((p) => p.publicId)).toEqual(['hrwarehouse/refurbishment/b1']);
    expect(reopened.afterPhotos.map((p) => p.publicId)).toEqual(['hrwarehouse/refurbishment/a1']);

    // Updating before photos again (as the modal does, with the existing entry) leaves after photos alone.
    expect((await put(ROLES.WAREHOUSE_STAFF, job.jobId, { beforePhotos: [...reopened.beforePhotos, photo('b2')] })).status).toBe(200);
    reopened = await reopen(job);
    expect(reopened.beforePhotos.map((p) => p.publicId)).toEqual(['hrwarehouse/refurbishment/b1', 'hrwarehouse/refurbishment/b2']);
    expect(reopened.afterPhotos.map((p) => p.publicId)).toEqual(['hrwarehouse/refurbishment/a1']);
  });

  test('Admin and Warehouse Manager can also save photos', async () => {
    const job = await createJob();
    expect((await put(ROLES.ADMIN, job.jobId, { beforePhotos: [photo('adm1')] })).status).toBe(200);
    const reopened = await reopen(job);
    expect((await put(ROLES.WAREHOUSE_MANAGER, job.jobId, { afterPhotos: [photo('wm1')] })).status).toBe(200);
    expect(reopened.beforePhotos[0].uploadedBy).toBe(userIds[ROLES.ADMIN]);
    expect((await reopen(job)).afterPhotos[0].uploadedBy).toBe(userIds[ROLES.WAREHOUSE_MANAGER]);
  });
});

describe('retaining existing photos', () => {
  test('an existing photo sent back unchanged keeps its _id and link alongside a new one', async () => {
    const job = await createJob();
    await put(ROLES.WAREHOUSE_STAFF, job.jobId, { beforePhotos: [photo('b1')] });
    const existing = (await reopen(job)).beforePhotos[0];

    expect((await put(ROLES.WAREHOUSE_STAFF, job.jobId, { beforePhotos: [existing, photo('b2')] })).status).toBe(200);
    const reopened = await reopen(job);
    expect(reopened.beforePhotos).toHaveLength(2);
    expect(reopened.beforePhotos[0]).toMatchObject({ _id: existing._id, url: existing.url, publicId: existing.publicId });
  });

  test('a legacy photo is kept only when sent back unchanged', async () => {
    const job = await createJob();
    await Refurbishment.updateOne({ _id: job.jobId }, { $push: { beforePhotos: LEGACY } });
    const legacy = (await reopen(job)).beforePhotos[0];

    expect((await put(ROLES.WAREHOUSE_STAFF, job.jobId, { beforePhotos: [legacy, photo('b2')] })).status).toBe(200);
    let reopened = await reopen(job);
    expect(reopened.beforePhotos[0]).toMatchObject({ _id: legacy._id, url: LEGACY.url, publicId: LEGACY.publicId });

    expectRejected(await put(ROLES.WAREHOUSE_STAFF, job.jobId, { beforePhotos: [{ ...legacy, url: 'http://legacy.example.com/other.jpg' }] }), 'beforePhotos');
    expectRejected(await put(ROLES.WAREHOUSE_STAFF, job.jobId, { beforePhotos: [{ ...legacy, publicId: 'legacy/other' }] }), 'beforePhotos');
    reopened = await reopen(job);
    expect(reopened.beforePhotos).toHaveLength(2);
    expect(reopened.beforePhotos[0].url).toBe(LEGACY.url);
  });
});

describe('removing photos', () => {
  test('sending a smaller list removes the omitted photo; an empty list clears it', async () => {
    const job = await createJob();
    await put(ROLES.WAREHOUSE_STAFF, job.jobId, { afterPhotos: [photo('a1'), photo('a2')] });
    const [first] = (await reopen(job)).afterPhotos;

    expect((await put(ROLES.WAREHOUSE_STAFF, job.jobId, { afterPhotos: [first] })).status).toBe(200);
    expect((await reopen(job)).afterPhotos.map((p) => p.publicId)).toEqual(['hrwarehouse/refurbishment/a1']);

    expect((await put(ROLES.WAREHOUSE_STAFF, job.jobId, { afterPhotos: [] })).status).toBe(200);
    expect((await reopen(job)).afterPhotos).toHaveLength(0);
  });
});

describe('rejecting invalid photo references', () => {
  const good = photo('b1');
  test.each([
    ['javascript: URL', { ...good, url: 'javascript:alert(1)' }],
    ['data: URL', { ...good, url: 'data:image/png;base64,iVBORw0KGgo=' }],
    ['external https host', { ...good, url: 'https://evil.example.com/b1.jpg' }],
    ['another Cloudinary account', { ...good, url: good.url.replace(`/${CLOUD}/`, '/othercloud/') }],
    ['approved link from the items folder', photo('b1', 'items')],
    ['URL that does not match its publicId', { ...good, publicId: 'hrwarehouse/refurbishment/zzz999' }],
  ])('rejects %s and leaves the job unchanged', async (label, bad) => {
    const job = await createJob();
    await put(ROLES.WAREHOUSE_STAFF, job.jobId, { beforePhotos: [photo('keep1')] });
    const existing = (await reopen(job)).beforePhotos[0];

    expectRejected(await put(ROLES.WAREHOUSE_STAFF, job.jobId, { beforePhotos: [existing, bad] }), 'beforePhotos');
    expectRejected(await put(ROLES.WAREHOUSE_STAFF, job.jobId, { afterPhotos: [bad] }), 'afterPhotos');

    const reopened = await reopen(job);
    expect(reopened.beforePhotos.map((p) => p.publicId)).toEqual(['hrwarehouse/refurbishment/keep1']);
    expect(reopened.afterPhotos).toHaveLength(0);
  });

  test('rejects a value that is not a list', async () => {
    const job = await createJob();
    expectRejected(await put(ROLES.WAREHOUSE_STAFF, job.jobId, { beforePhotos: photo('b1') }), 'beforePhotos');
  });

  test('an invalid photo list blocks the whole update, including other fields', async () => {
    const job = await createJob();
    expectRejected(await put(ROLES.WAREHOUSE_STAFF, job.jobId, { notes: 'should not save', afterPhotos: [{ url: 'javascript:alert(1)' }] }), 'afterPhotos');
    expect((await reopen(job)).notes).not.toBe('should not save');
  });
});

describe('permissions', () => {
  test.each([ROLES.ACCOUNTS, ROLES.SALES_MANAGER, ROLES.OWNER_APPROVER])('%s cannot change photos', async (role) => {
    const job = await createJob();
    const res = await put(role, job.jobId, { beforePhotos: [photo('b1')] });
    expect(res.status).toBe(403);
    expect((await reopen(job)).beforePhotos).toHaveLength(0);
  });

  test('requests without a login are rejected', async () => {
    const job = await createJob();
    expect((await put(null, job.jobId, { beforePhotos: [photo('b1')] })).status).toBe(401);
    expect((await reopen(job)).beforePhotos).toHaveLength(0);
  });
});

describe('existing update behaviour', () => {
  test('updating only repairCost leaves photos untouched', async () => {
    const job = await createJob();
    await put(ROLES.WAREHOUSE_STAFF, job.jobId, { beforePhotos: [photo('b1')], afterPhotos: [photo('a1')] });
    expect((await put(ROLES.WAREHOUSE_STAFF, job.jobId, { repairCost: 450 })).status).toBe(200);
    const reopened = await reopen(job);
    expect(reopened.repairCost).toBe(450);
    expect(reopened.beforePhotos).toHaveLength(1);
    expect(reopened.afterPhotos).toHaveLength(1);
  });

  test('an unknown job returns 404', async () => {
    const res = await put(ROLES.WAREHOUSE_STAFF, '000000000000000000000000', { beforePhotos: [photo('b1')] });
    expect(res.status).toBe(404);
  });
});
