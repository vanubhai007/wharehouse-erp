const request = require('supertest');
const mongoose = require('mongoose');
const { startTestDb, stopTestDb } = require('./testUtils');
const { resetRateLimits } = require('../middleware/rateLimit');

let app;
let User;
let Counter;

const ORIGINAL = { NODE_ENV: process.env.NODE_ENV, SETUP_TOKEN: process.env.SETUP_TOKEN };
const SETUP_TOKEN = 'a3f1c9e07b2d4c8e9f60a1b2c3d4e5f6';
const CLOSED = 'Registration is closed. Ask an Admin to create your account.';

function setEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function register(fields = {}) {
  return request(app)
    .post('/api/auth/register')
    .send({ name: 'Owner', email: 'owner@bootstrap.com', password: 'OwnerPass123', role: 'Admin', ...fields });
}

const claim = () => Counter.findById('admin-bootstrap').lean();

beforeAll(async () => {
  await startTestDb();
  app = require('../app');
  User = require('../models/User');
  ({ Counter } = require('../models/Counter'));
}, 60000);

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  resetRateLimits(); // this file sends many setup requests from one IP on purpose
  // Fresh, empty database for every test (indexes are kept).
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
});

afterEach(() => {
  setEnv('NODE_ENV', ORIGINAL.NODE_ENV);
  setEnv('SETUP_TOKEN', ORIGINAL.SETUP_TOKEN);
  jest.restoreAllMocks();
});

describe('development/test setup without SETUP_TOKEN', () => {
  test('the first request creates the Admin; later requests are refused', async () => {
    const first = await register();
    expect(first.status).toBe(201);
    expect(first.body.data.user.role).toBe('Admin');

    const second = await register({ email: 'second@bootstrap.com' });
    expect(second.status).toBe(403);
    expect(second.body.message).toBe(CLOSED);
    expect(await User.countDocuments()).toBe(1);
  });

  test('works in development too, and a client-supplied role is ignored', async () => {
    setEnv('NODE_ENV', 'development');
    const res = await register({ role: 'Warehouse Staff' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('Admin');
  });
});

describe('SETUP_TOKEN enforcement', () => {
  test('production without SETUP_TOKEN disables setup and creates nothing', async () => {
    setEnv('NODE_ENV', 'production');
    setEnv('SETUP_TOKEN', undefined);
    const res = await register();
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Initial setup is disabled/);
    expect(await User.countDocuments()).toBe(0);
    expect(await claim()).toBeNull();
  });

  test.each([['staging'], [undefined]])('NODE_ENV=%s without SETUP_TOKEN is also disabled', async (nodeEnv) => {
    setEnv('NODE_ENV', nodeEnv);
    setEnv('SETUP_TOKEN', undefined);
    expect((await register()).status).toBe(403);
    expect(await User.countDocuments()).toBe(0);
  });

  test('production requires the exact token; rejected attempts leave no claim behind', async () => {
    setEnv('NODE_ENV', 'production');
    setEnv('SETUP_TOKEN', SETUP_TOKEN);

    for (const setupToken of [undefined, '', 'wrong', `${SETUP_TOKEN.slice(0, -1)}x`, `${SETUP_TOKEN}extra`, 12345]) {
      const res = await register(setupToken === undefined ? {} : { setupToken });
      expect([setupToken, res.status]).toEqual([setupToken, 403]);
      expect(res.body.message).toMatch(/valid setup token is required/);
    }
    expect(await User.countDocuments()).toBe(0);
    expect(await claim()).toBeNull();

    const ok = await register({ setupToken: SETUP_TOKEN });
    expect(ok.status).toBe(201);
    expect(ok.body.data.user.role).toBe('Admin');
  });

  test('once configured, the token is required in development as well', async () => {
    setEnv('NODE_ENV', 'development');
    setEnv('SETUP_TOKEN', SETUP_TOKEN);
    expect((await register()).status).toBe(403);
    expect((await register({ setupToken: SETUP_TOKEN })).status).toBe(201);
  });
});

describe('one-time bootstrap claim', () => {
  test('concurrent requests on an empty database create exactly one Admin', async () => {
    const claimAttempts = jest.spyOn(Counter, 'create');
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => register({ email: `owner${i}@bootstrap.com` }))
    );

    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 403)).toHaveLength(9);
    expect(await User.countDocuments()).toBe(1);
    expect(await User.countDocuments({ role: 'Admin' })).toBe(1);
    // More than one request got past the "no users yet" check, so the unique
    // claim - not timing luck - is what limited setup to a single Admin.
    expect(claimAttempts.mock.calls.length).toBeGreaterThan(1);
    expect(await claim()).not.toBeNull();
  });

  test('a request that loses the claim cannot remove the winner\'s claim', async () => {
    // Another request currently holds the claim (its user creation is still in flight).
    await Counter.create({ _id: 'admin-bootstrap', seq: 111 });
    const res = await register();
    expect(res.status).toBe(403);
    expect(await claim()).toEqual({ _id: 'admin-bootstrap', seq: 111, __v: 0 });
    expect(await User.countDocuments()).toBe(0);
  });

  test('a failed user creation releases only its own claim, so setup can be retried', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(User, 'create').mockRejectedValueOnce(new Error('simulated database failure'));

    const failed = await register();
    expect(failed.status).toBe(500);
    expect(await User.countDocuments()).toBe(0);
    expect(await claim()).toBeNull();

    const retry = await register();
    expect(retry.status).toBe(201);
    expect(await User.countDocuments({ role: 'Admin' })).toBe(1);
  });

  test('a failure after an Admin was written keeps the claim, so setup cannot reopen', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(User, 'create').mockImplementationOnce(async () => {
      await User.collection.insertOne({ name: 'Owner', email: 'owner@bootstrap.com', password: 'x', role: 'Admin', isActive: true });
      throw new Error('simulated failure after the write');
    });

    expect((await register()).status).toBe(500);
    expect(await claim()).not.toBeNull();
    expect((await register({ email: 'attacker@bootstrap.com' })).status).toBe(403);
    expect(await User.countDocuments()).toBe(1);
  });

  test('after a successful setup the claim stays, even if every user is later removed', async () => {
    expect((await register()).status).toBe(201);
    await User.deleteMany({});
    const res = await register({ email: 'late@bootstrap.com' });
    expect(res.status).toBe(403);
    expect(await User.countDocuments()).toBe(0);
  });

  test('an existing deployment with users and no claim stays closed', async () => {
    await User.create({ name: 'Existing Admin', email: 'existing@bootstrap.com', password: 'ExistingPass123', role: 'Admin' });
    const res = await register();
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(CLOSED);
    expect(await claim()).toBeNull();
  });
});

describe('Admin accounts after setup', () => {
  test('only an Admin can create further users; a non-Admin cannot create an Admin', async () => {
    const admin = await register();
    const adminToken = admin.body.data.token;
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Staff', email: 'staff@bootstrap.com', password: 'StaffPass123', role: 'Warehouse Staff' });
    const staffLogin = await request(app).post('/api/auth/login').send({ email: 'staff@bootstrap.com', password: 'StaffPass123' });

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${staffLogin.body.data.token}`)
      .send({ name: 'Sneaky', email: 'sneaky@bootstrap.com', password: 'SneakyPass123', role: 'Admin' });
    expect(res.status).toBe(403);
    expect(await User.countDocuments({ role: 'Admin' })).toBe(1);

    // Existing Admin login is unaffected.
    const login = await request(app).post('/api/auth/login').send({ email: 'owner@bootstrap.com', password: 'OwnerPass123' });
    expect(login.status).toBe(200);
  });
});
