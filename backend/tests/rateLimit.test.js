const request = require('supertest');
const { startTestDb, stopTestDb } = require('./testUtils');
const {
  parseTrustProxy,
  clientKey,
  FixedWindowCounter,
  resetRateLimits,
  setRateLimitClock,
} = require('../middleware/rateLimit');

let app;
let AuditLog;
let User;
let clock;
let defaultTrustProxy;

const MINUTE = 60 * 1000;
const PASSWORD = 'UserPass123';
const GENERIC = { success: true, message: 'If that account exists, a reset link has been sent.' };

// supertest connects from 127.0.0.1. With app trust proxy = 1 (one trusted
// hop), Express uses the right-most X-Forwarded-For entry as the client IP.
const from = (ip, req) => req.set('X-Forwarded-For', ip);
const login = (ip, email, password) => from(ip, request(app).post('/api/auth/login')).send({ email, password });
const forgot = (ip, email) => from(ip, request(app).post('/api/auth/forgot-password')).send({ email });

beforeAll(async () => {
  await startTestDb();
  app = require('../app');
  defaultTrustProxy = app.get('trust proxy'); // as configured by app.js, before any test changes it
  AuditLog = require('../models/AuditLog');
  User = require('../models/User');
  const admin = await request(app).post('/api/auth/register').send({ name: 'Admin', email: 'admin@limits.com', password: 'AdminPass123', role: 'Admin' });
  for (const name of ['alice', 'bob', 'carol', 'dave']) {
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${admin.body.data.token}`)
      .send({ name, email: `${name}@limits.com`, password: PASSWORD, role: 'Warehouse Staff' });
  }
}, 60000);

afterAll(async () => {
  app.set('trust proxy', false);
  setRateLimitClock(null);
  await stopTestDb();
});

beforeEach(() => {
  resetRateLimits();
  clock = Date.now();
  setRateLimitClock(() => clock);
  // Same value app.js applies for TRUST_PROXY=1.
  app.set('trust proxy', parseTrustProxy('1'));
});

function expect429(res, message) {
  expect(res.status).toBe(429);
  expect(res.body.message).toMatch(message);
  const retryAfter = Number(res.headers['retry-after']);
  expect(Number.isInteger(retryAfter)).toBe(true);
  return retryAfter;
}

describe('login limits', () => {
  test('5 failures per IP+email, then 429 with Retry-After - even for the correct password', async () => {
    for (let i = 0; i < 5; i += 1) expect((await login('198.51.100.1', 'alice@limits.com', 'wrong')).status).toBe(401);

    const blocked = await login('198.51.100.1', 'alice@limits.com', 'wrong');
    expect(expect429(blocked, /Too many failed sign-in attempts\. Please try again in 15 minutes\./)).toBe(900);
    expect((await login('198.51.100.1', 'alice@limits.com', PASSWORD)).status).toBe(429);

    clock += 10 * MINUTE;
    expect(Number((await login('198.51.100.1', 'alice@limits.com', PASSWORD)).headers['retry-after'])).toBe(300);

    clock += 5 * MINUTE + 1000;
    const after = await login('198.51.100.1', 'alice@limits.com', PASSWORD);
    expect(after.status).toBe(200);
    expect(after.body.data.token).toBeTruthy();
  });

  test('a successful login clears the IP+email failure counter', async () => {
    for (let i = 0; i < 4; i += 1) expect((await login('198.51.100.2', 'bob@limits.com', 'wrong')).status).toBe(401);
    expect((await login('198.51.100.2', 'bob@limits.com', PASSWORD)).status).toBe(200);
    for (let i = 0; i < 5; i += 1) expect((await login('198.51.100.2', 'bob@limits.com', 'wrong')).status).toBe(401);
    expect((await login('198.51.100.2', 'bob@limits.com', 'wrong')).status).toBe(429);
  });

  test('one email being locked does not affect other emails or other IPs', async () => {
    for (let i = 0; i < 5; i += 1) await login('198.51.100.3', 'carol@limits.com', 'wrong');
    expect((await login('198.51.100.3', 'carol@limits.com', PASSWORD)).status).toBe(429);
    expect((await login('198.51.100.3', 'dave@limits.com', PASSWORD)).status).toBe(200);
    expect((await login('198.51.100.4', 'carol@limits.com', PASSWORD)).status).toBe(200);
  });

  test('50 failures from one IP across many emails, then 429 for every email', async () => {
    for (let i = 0; i < 50; i += 1) expect((await login('198.51.100.5', `nobody${i}@limits.com`, 'wrong')).status).toBe(401);
    expect429(await login('198.51.100.5', 'new-target@limits.com', 'wrong'), /Too many failed sign-in attempts/);
    expect((await login('198.51.100.5', 'alice@limits.com', PASSWORD)).status).toBe(429);
  });

  test('validation errors do not count as failed attempts', async () => {
    for (let i = 0; i < 8; i += 1) expect((await login('198.51.100.6', 'not-an-email', 'x')).status).toBe(400);
    expect((await login('198.51.100.6', 'alice@limits.com', PASSWORD)).status).toBe(200);
  });

  test('concurrent guesses cannot slip past the limit', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => login('198.51.100.7', 'alice@limits.com', 'wrong')));
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 401)).toHaveLength(5);
    expect(statuses.filter((s) => s === 429)).toHaveLength(7);
  });
});

describe('forgot-password limits', () => {
  test('5 requests per IP, then 429 with Retry-After (regardless of email)', async () => {
    for (let i = 0; i < 5; i += 1) expect((await forgot('198.51.100.10', `person${i}@limits.com`)).status).toBe(200);
    const blocked = await forgot('198.51.100.10', 'alice@limits.com');
    expect(expect429(blocked, /Too many password reset requests\. Please try again in 15 minutes\./)).toBe(900);

    clock += 15 * MINUTE + 1000;
    expect((await forgot('198.51.100.10', 'alice@limits.com')).status).toBe(200);
  });

  test('per-email limit: 4th request gets the identical generic response and sends nothing', async () => {
    const responses = [];
    for (let i = 0; i < 4; i += 1) responses.push(await forgot(`198.51.100.${20 + i}`, 'bob@limits.com'));

    for (const res of responses.slice(0, 3)) {
      expect(res.status).toBe(200);
      expect(res.body.demoResetUrl).toBeTruthy();
    }
    expect(responses[3].status).toBe(200);
    expect(responses[3].body).toEqual(GENERIC);
    expect(responses[3].headers['retry-after']).toBeUndefined();
    const bob = await User.findOne({ email: 'bob@limits.com' });
    expect(await AuditLog.countDocuments({ action: 'PASSWORD_RESET_REQUESTED', entityId: bob._id })).toBe(3);

    clock += 60 * MINUTE + 1000;
    expect((await forgot('198.51.100.30', 'bob@limits.com')).body.demoResetUrl).toBeTruthy();
  });

  test('a limited registered email and an unknown email get exactly the same response', async () => {
    for (let i = 0; i < 3; i += 1) {
      await forgot(`198.51.100.${40 + i}`, 'carol@limits.com');
      await forgot(`198.51.100.${40 + i}`, 'ghost@limits.com');
    }
    const limitedKnown = await forgot('198.51.100.50', 'carol@limits.com');
    const limitedUnknown = await forgot('198.51.100.51', 'ghost@limits.com');
    const freshUnknown = await forgot('198.51.100.52', 'never-seen@limits.com');

    for (const res of [limitedKnown, limitedUnknown, freshUnknown]) {
      expect(res.status).toBe(200);
      expect(res.body).toEqual(GENERIC);
      expect(res.headers['retry-after']).toBeUndefined();
    }
  });

  test('the per-email limit ignores letter case', async () => {
    for (const email of ['Dave@limits.com', 'DAVE@LIMITS.COM', 'dave@LIMITS.com']) {
      expect((await forgot('198.51.100.60', email)).status).toBe(200);
    }
    expect((await forgot('198.51.100.61', 'dave@limits.com')).body).toEqual(GENERIC);
  });
});

describe('first-admin setup limit', () => {
  test('10 requests per IP, then 429 with Retry-After', async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await from('198.51.100.70', request(app).post('/api/auth/register')).send({ name: 'X', email: `x${i}@limits.com`, password: 'Password123', role: 'Admin' });
      expect(res.status).toBe(403); // users already exist, so setup is closed anyway
    }
    const blocked = await from('198.51.100.70', request(app).post('/api/auth/register')).send({ name: 'X', email: 'x@limits.com', password: 'Password123', role: 'Admin' });
    expect(expect429(blocked, /Too many setup attempts/)).toBe(900);
  });
});

describe('client IP identification', () => {
  test('with proxy trust disabled, a spoofed X-Forwarded-For cannot escape the limit', async () => {
    app.set('trust proxy', parseTrustProxy(undefined));
    for (let i = 0; i < 5; i += 1) {
      expect((await login(`203.0.113.${i}`, 'alice@limits.com', 'wrong')).status).toBe(401);
    }
    // Every request carried a different forwarded IP, yet they all counted against the real connection.
    expect((await login('203.0.113.99', 'alice@limits.com', 'wrong')).status).toBe(429);
    expect((await request(app).post('/api/auth/login').send({ email: 'alice@limits.com', password: PASSWORD })).status).toBe(429);
  });

  test('with TRUST_PROXY=1, a spoofed left-most IP cannot bypass the limit', async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await login(`10.0.0.${i}, 203.0.113.7`, 'alice@limits.com', 'wrong');
      expect(res.status).toBe(401);
    }
    expect((await login('1.2.3.4, 203.0.113.7', 'alice@limits.com', PASSWORD)).status).toBe(429);
    // A different real client (as recorded by the trusted proxy) is unaffected.
    expect((await login('1.2.3.4, 203.0.113.8', 'alice@limits.com', PASSWORD)).status).toBe(200);
  });

  test('IPv6 clients in the same /64 share a limit; another /64 does not', async () => {
    for (let i = 0; i < 5; i += 1) await login(`2001:db8:aa:bb::${i + 1}`, 'bob@limits.com', 'wrong');
    expect((await login('2001:db8:aa:bb:ffff:1:2:3', 'bob@limits.com', PASSWORD)).status).toBe(429);
    expect((await login('2001:db8:aa:cc::1', 'bob@limits.com', PASSWORD)).status).toBe(200);
  });

  test('TRUST_PROXY only accepts a hop count of 0-5', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('5')).toBe(5);
    for (const value of [undefined, '', 'true', 'TRUE', '6', '-1', '1.5', ' 1', 'abc', '10.0.0.0/8']) {
      expect(parseTrustProxy(value)).toBe(0);
    }
  });

  test('app.js does not trust forwarded headers when TRUST_PROXY is unset', () => {
    expect(process.env.TRUST_PROXY).toBeUndefined();
    expect(defaultTrustProxy).toBe(false);
  });

  test('clientKey normalises IPv4-mapped and groups IPv6 addresses by /64', () => {
    expect(clientKey({ ip: '::ffff:192.0.2.1' })).toBe('192.0.2.1');
    expect(clientKey({ ip: '192.0.2.1' })).toBe('192.0.2.1');
    expect(clientKey({ ip: '2001:0db8:0000:0001:0000:0000:0000:0001' })).toBe('2001:db8:0:1::/64');
    expect(clientKey({ ip: '2001:db8:0:1::abcd' })).toBe('2001:db8:0:1::/64');
    expect(clientKey({ ip: '::1' })).toBe('0:0:0:0::/64');
    expect(clientKey({ ip: 'fe80::1%eth0' })).toBe('fe80:0:0:0::/64');
  });
});

describe('endpoints and flows that are not limited', () => {
  test('reset-password/:token has no rate limit', async () => {
    for (let i = 0; i < 20; i += 1) {
      const res = await from('198.51.100.80', request(app).post('/api/auth/reset-password/not-a-real-token')).send({ password: 'Whatever123' });
      expect(res.status).toBe(400);
    }
  });

  test('a normal login, /me and the full forgot/reset flow still work', async () => {
    const signIn = await login('198.51.100.90', 'dave@limits.com', PASSWORD);
    expect(signIn.status).toBe(200);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${signIn.body.data.token}`);
    expect(me.status).toBe(200);

    const link = await forgot('198.51.100.90', 'dave@limits.com');
    const token = link.body.demoResetUrl.split('/reset-password/')[1];
    expect((await request(app).post(`/api/auth/reset-password/${token}`).send({ password: 'DaveNewPass456' })).status).toBe(200);
    expect((await login('198.51.100.90', 'dave@limits.com', 'DaveNewPass456')).status).toBe(200);
  });
});

describe('counter store', () => {
  test('expired entries are dropped and the number of keys stays bounded', () => {
    const counter = new FixedWindowCounter({ windowMs: MINUTE, max: 2, maxKeys: 3 });
    ['a', 'b', 'c'].forEach((k) => counter.hit(k));
    expect(counter.entries.size).toBe(3);

    clock += MINUTE + 1;
    counter.hit('d'); // full, but a, b and c have expired
    expect([...counter.entries.keys()]).toEqual(['d']);

    ['e', 'f', 'g', 'h'].forEach((k) => counter.hit(k)); // live keys beyond the cap evict the oldest
    expect(counter.entries.size).toBeLessThanOrEqual(3);
    expect(counter.entries.has('h')).toBe(true);
  });

  test('hit reports whether the request is within the limit', () => {
    const counter = new FixedWindowCounter({ windowMs: MINUTE, max: 2 });
    expect([counter.hit('k'), counter.hit('k'), counter.hit('k')]).toEqual([true, true, false]);
    expect(counter.isLimited('k')).toBe(true);
    clock += MINUTE;
    expect(counter.isLimited('k')).toBe(false);
  });
});
