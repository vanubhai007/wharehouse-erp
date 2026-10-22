const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startTestDb, stopTestDb } = require('./testUtils');
const { passwordFingerprint } = require('../utils/passwordFingerprint');

let app;
let User;
let adminToken;
let setupUser;
let userSeq = 0;

const SESSION_EXPIRED = 'Your session has expired. Please sign in again.';

beforeAll(async () => {
  await startTestDb();
  app = require('../app');
  User = require('../models/User');
  const admin = await request(app).post('/api/auth/register').send({ name: 'Admin', email: 'admin@tokens.com', password: 'AdminPass123', role: 'Admin' });
  adminToken = admin.body.data.token;
  setupUser = admin.body.data.user;
}, 60000);

afterAll(async () => {
  await stopTestDb();
});

const me = (token) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });
const asAdmin = (req) => req.set('Authorization', `Bearer ${adminToken}`);

// Creates a Warehouse Staff user and returns { id, email, password, token }.
async function createUser() {
  userSeq += 1;
  const email = `user${userSeq}@tokens.com`;
  const password = 'UserPass123';
  const created = await asAdmin(request(app).post('/api/users')).send({ name: `User ${userSeq}`, email, password, role: 'Warehouse Staff' });
  const res = await login(email, password);
  expect(res.status).toBe(200);
  return { id: created.body.data._id, email, password, token: res.body.data.token };
}

async function requestResetToken(email) {
  const res = await request(app).post('/api/auth/forgot-password').send({ email });
  expect(res.body.demoResetUrl).toBeTruthy();
  return res.body.demoResetUrl.split('/reset-password/')[1];
}

const resetWith = (resetToken, password) => request(app).post(`/api/auth/reset-password/${resetToken}`).send({ password });

async function storedHash(id) {
  return (await User.findById(id).select('+password')).password;
}

describe('Admin password reset (POST /api/users/:id/reset-password)', () => {
  test('rejects the old token everywhere and accepts a token from a new login', async () => {
    const user = await createUser();
    expect((await me(user.token)).status).toBe(200);

    const reset = await asAdmin(request(app).post(`/api/users/${user.id}/reset-password`)).send({ password: 'NewUserPass456' });
    expect(reset.status).toBe(200);

    const oldMe = await me(user.token);
    expect(oldMe.status).toBe(401);
    expect(oldMe.body.message).toBe(SESSION_EXPIRED);
    expect((await request(app).get('/api/items').set('Authorization', `Bearer ${user.token}`)).status).toBe(401);

    expect((await login(user.email, user.password)).status).toBe(401);
    const fresh = await login(user.email, 'NewUserPass456');
    expect(fresh.status).toBe(200);
    expect((await me(fresh.body.data.token)).status).toBe(200);
  });

  test('an Admin resetting their own password must sign in again', async () => {
    const admin2 = await asAdmin(request(app).post('/api/users')).send({ name: 'Admin Two', email: 'admin2@tokens.com', password: 'AdminTwo123', role: 'Admin' });
    const token = (await login('admin2@tokens.com', 'AdminTwo123')).body.data.token;

    const reset = await request(app)
      .post(`/api/users/${admin2.body.data._id}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'AdminTwoNew456' });
    expect(reset.status).toBe(200);

    expect((await me(token)).status).toBe(401);
    const fresh = await login('admin2@tokens.com', 'AdminTwoNew456');
    expect((await me(fresh.body.data.token)).status).toBe(200);
  });
});

describe('Self-service reset (forgot-password link)', () => {
  test('rejects the old access token and accepts a token from a new login', async () => {
    const user = await createUser();
    const resetToken = await requestResetToken(user.email);

    expect((await resetWith(resetToken, 'ResetPass789')).status).toBe(200);

    const oldMe = await me(user.token);
    expect(oldMe.status).toBe(401);
    expect(oldMe.body.message).toBe(SESSION_EXPIRED);
    const fresh = await login(user.email, 'ResetPass789');
    expect(fresh.status).toBe(200);
    expect((await me(fresh.body.data.token)).status).toBe(200);
  });

  test('a reset link works once; reusing it is rejected and the password stays as set', async () => {
    const user = await createUser();
    const resetToken = await requestResetToken(user.email);

    expect((await resetWith(resetToken, 'FirstReset111')).status).toBe(200);
    const reuse = await resetWith(resetToken, 'AttackerPass222');
    expect(reuse.status).toBe(400);
    expect(reuse.body.message).toBe('Reset link is invalid or has expired');

    expect((await login(user.email, 'AttackerPass222')).status).toBe(401);
    expect((await login(user.email, 'FirstReset111')).status).toBe(200);
  });

  test('older unused reset links stop working after a successful reset', async () => {
    const user = await createUser();
    const olderLink = await requestResetToken(user.email);
    const newerLink = await requestResetToken(user.email);

    expect((await resetWith(newerLink, 'NewerReset333')).status).toBe(200);
    expect((await resetWith(olderLink, 'OlderReset444')).status).toBe(400);
    expect((await login(user.email, 'NewerReset333')).status).toBe(200);
  });

  test('an Admin password reset also invalidates outstanding reset links', async () => {
    const user = await createUser();
    const link = await requestResetToken(user.email);
    await asAdmin(request(app).post(`/api/users/${user.id}/reset-password`)).send({ password: 'AdminSet555' });
    expect((await resetWith(link, 'LinkReset666')).status).toBe(400);
  });

  test('an access-token fingerprint cannot be used as a reset-link fingerprint', async () => {
    const user = await createUser();
    const forged = jwt.sign(
      { id: user.id, purpose: 'reset', pwv: passwordFingerprint(await storedHash(user.id), 'access') },
      process.env.JWT_RESET_SECRET,
      { expiresIn: '15m' }
    );
    expect((await resetWith(forged, 'ForgedReset777')).status).toBe(400);
  });
});

describe('sessions that must stay valid', () => {
  test('logging in again does not sign out the earlier session', async () => {
    const user = await createUser();
    expect((await login(user.email, user.password)).status).toBe(200);
    expect((await me(user.token)).status).toBe(200);
  });

  test('profile and role changes keep the token valid and still apply immediately', async () => {
    const user = await createUser();
    const update = await asAdmin(request(app).put(`/api/users/${user.id}`)).send({ name: 'Renamed', role: 'Accounts' });
    expect(update.status).toBe(200);

    const res = await me(user.token);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Renamed', role: 'Accounts' });
    // Role checks use the current role: Accounts can now record payments, Warehouse Staff cannot.
    const payment = await request(app).post('/api/payments').set('Authorization', `Bearer ${user.token}`).send({ direction: 'Receivable', amount: 10 });
    expect(payment.status).toBe(201);
  });

  test('a deactivated user is still rejected immediately', async () => {
    const user = await createUser();
    await asAdmin(request(app).post(`/api/users/${user.id}/deactivate`));
    const res = await me(user.token);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('User account not found or disabled');
  });
});

describe('rejected tokens', () => {
  test('a token issued before this change (no pwv claim) is rejected', async () => {
    const user = await createUser();
    const legacy = jwt.sign({ id: user.id, role: 'Warehouse Staff' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const res = await me(legacy);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe(SESSION_EXPIRED);
  });

  test('a token with a tampered or another user\'s pwv is rejected', async () => {
    const user = await createUser();
    const other = await createUser();
    const tampered = jwt.sign({ id: user.id, role: 'Warehouse Staff', pwv: 'AAAAAAAAAAAAAAAAAAAAAA' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const borrowed = jwt.sign(
      { id: user.id, role: 'Warehouse Staff', pwv: jwt.decode(other.token).pwv },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    expect((await me(tampered)).status).toBe(401);
    expect((await me(borrowed)).status).toBe(401);
  });

  test('an expired token is still rejected', async () => {
    const user = await createUser();
    const expired = jwt.sign(
      { id: user.id, role: 'Warehouse Staff', pwv: jwt.decode(user.token).pwv, exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET
    );
    const res = await me(expired);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid or expired token');
  });
});

describe('no password data is exposed', () => {
  test('tokens carry only a short keyed fingerprint, never the hash', async () => {
    const user = await createUser();
    const hash = await storedHash(user.id);
    const payload = jwt.decode(user.token);

    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'id', 'pwv', 'role']);
    expect(payload.pwv).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(hash);
    expect(serialized).not.toContain(hash.slice(7, 29)); // the bcrypt salt/hash body
  });

  test('login, setup and /me responses never include the password or fingerprint', async () => {
    const user = await createUser();
    const loginRes = await login(user.email, user.password);
    const meRes = await me(loginRes.body.data.token);
    for (const body of [setupUser, loginRes.body.data.user, meRes.body.data]) {
      expect(body._id).toBeTruthy();
      expect(body.password).toBeUndefined();
      expect(body.pwv).toBeUndefined();
    }
  });

  test('the token from first-admin setup works immediately', async () => {
    expect((await me(adminToken)).status).toBe(200);
  });
});
