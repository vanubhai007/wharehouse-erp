const request = require('supertest');
const jwt = require('jsonwebtoken');
const { startTestDb, stopTestDb } = require('./testUtils');
const { resetRateLimits } = require('../middleware/rateLimit');
const { passwordFingerprint } = require('../utils/passwordFingerprint');
const { ROLES } = require('../config/constants');

// Public sign-up with emailed 6-digit codes. Email delivery is mocked: each
// "sent" message is captured so a test can read the code the way a user
// would read their inbox.
const mockSentEmails = [];
jest.mock('../services/notificationService', () => ({
  emailConfigured: true,
  sendEmail: jest.fn(async (message) => {
    mockSentEmails.push(message);
    return { demo: false, sent: true };
  }),
  sendWhatsApp: jest.fn(async () => ({ demo: true, sent: false })),
  events: {},
}));
const notifications = require('../services/notificationService');

let app;
let User;
let adminToken;
const ADMIN = { name: 'Admin', email: 'admin@signup.test', password: 'AdminPass123' };
const SIGNUP_SENT = 'If this email address can be registered, we have sent a 6-digit verification code to it. Enter the code to verify your email.';
const RESEND_SENT = 'If a verification is pending for this email address, a new code has been sent. Codes expire after 10 minutes.';
const INVALID_CODE = 'That code is invalid or has expired. Check your latest email or request a new code.';

const post = (path, body) => request(app).post(`/api/auth${path}`).send(body);
const signup = (body) => post('/signup', body);
const verify = (body) => post('/verify-email', body);
const resend = (email) => post('/resend-verification', { email });
const login = (email, password) => post('/login', { email, password });
const emailsTo = (to) => mockSentEmails.filter((m) => m.to === to);
const codeIn = (message) => /(\d{6})/.exec(message.html)[1];
const lastCodeFor = (to) => codeIn(emailsTo(to).at(-1));
const stored = (email) => User.findOne({ email }).select('+emailVerification +password');
// Moves the last-sent time back so the 60 s resend cooldown has passed.
const passCooldown = (email) => User.updateOne({ email }, { $set: { 'emailVerification.sentAt': new Date(Date.now() - 61 * 1000) } });
const wrongCode = (code) => String((Number(code) + 1) % 1000000).padStart(6, '0');

async function signupAndGetCode(email, password = 'NewUserPass1', name = 'New User') {
  const res = await signup({ name, email, password });
  expect(res.status).toBe(202);
  return lastCodeFor(email);
}

beforeAll(async () => {
  await startTestDb();
  app = require('../app');
  User = require('../models/User');
}, 60000);

beforeEach(() => {
  resetRateLimits();
  mockSentEmails.length = 0;
  notifications.emailConfigured = true;
});

afterAll(async () => {
  await stopTestDb();
});

describe('availability and first-Admin setup', () => {
  test('sign-up is unavailable until an Admin exists, so it can never block first-Admin setup', async () => {
    const res = await signup({ name: 'Early Bird', email: 'early@signup.test', password: 'EarlyBird123' });
    expect(res.status).toBe(503);
    expect(res.body.message).toBe('Registration is temporarily unavailable. Please try again later.');
    expect(await User.countDocuments({})).toBe(0);
    expect(mockSentEmails).toHaveLength(0);

    // First-Admin setup still works.
    const setup = await post('/register', { ...ADMIN, role: ROLES.ADMIN });
    expect(setup.status).toBe(201);
    adminToken = (await login(ADMIN.email, ADMIN.password)).body.data.token;
    expect(adminToken).toBeTruthy();
    // ...and is then closed as before.
    expect((await post('/register', { name: 'Second', email: 'second@signup.test', password: 'SecondPass1', role: ROLES.ADMIN })).status).toBe(403);
  });

  test('sign-up is unavailable when no email provider is configured', async () => {
    notifications.emailConfigured = false;
    const res = await signup({ name: 'No Mail', email: 'nomail@signup.test', password: 'NoMailPass1' });
    expect(res.status).toBe(503);
    expect(await User.exists({ email: 'nomail@signup.test' })).toBeNull();
  });
});

describe('registration', () => {
  test('creates an unverified, pending account and emails a 6-digit code that is stored only as a hash', async () => {
    const before = Date.now();
    const res = await signup({ name: '  Asha Mehta ', email: '  Asha.Mehta@Example.COM ', password: 'AshaPass123' });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ success: true, message: SIGNUP_SENT, resendCooldownSeconds: 60 });

    const email = 'asha.mehta@example.com';
    expect(emailsTo(email)).toHaveLength(1);
    const code = codeIn(emailsTo(email)[0]);
    expect(code).toMatch(/^\d{6}$/);
    expect(JSON.stringify(res.body)).not.toContain(code);

    const user = await stored(email);
    expect(user).toMatchObject({ name: 'Asha Mehta', signupSource: 'public', emailVerified: false, approvalStatus: 'pending', isActive: true });
    expect(user.emailVerification.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(user.emailVerification)).not.toContain(code);
    expect(user.emailVerification.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 10 * 60 * 1000 - 1000);
    expect(user.emailVerification.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 10 * 60 * 1000 + 1000);
    expect(user.password).not.toBe('AshaPass123');
  });

  test('a sign-up cannot give itself a role, approval, verification or activation', async () => {
    const res = await signup({
      name: 'Sneaky', email: 'sneaky@signup.test', password: 'SneakyPass1',
      role: ROLES.ADMIN, approvalStatus: 'approved', emailVerified: true, isActive: true, signupSource: null, createdBy: 'x',
    });
    expect(res.status).toBe(202);
    const user = await stored('sneaky@signup.test');
    expect(user.role).not.toBe(ROLES.ADMIN);
    expect(user.role).toBe(ROLES.WAREHOUSE_STAFF); // placeholder until an Admin approves
    expect(user).toMatchObject({ approvalStatus: 'pending', emailVerified: false, signupSource: 'public' });
    expect(user.createdBy).toBeUndefined();
    expect((await login('sneaky@signup.test', 'SneakyPass1')).status).toBe(403);
  });

  test.each([
    ['a missing name', { email: 'v1@signup.test', password: 'ValidPass1' }],
    ['an invalid email', { name: 'Valid Name', email: 'not-an-email', password: 'ValidPass1' }],
    ['a short password', { name: 'Valid Name', email: 'v2@signup.test', password: 'short' }],
    ['a non-string email', { name: 'Valid Name', email: { $gt: '' }, password: 'ValidPass1' }],
  ])('rejects %s with 400 and creates nothing', async (_, body) => {
    const res = await signup(body);
    expect(res.status).toBe(400);
    expect(mockSentEmails).toHaveLength(0);
  });
});

describe('email verification', () => {
  test('a correct code verifies once; the account then waits for Admin approval', async () => {
    const email = 'verify.ok@signup.test';
    const code = await signupAndGetCode(email, 'VerifyPass1');

    const wrong = await verify({ email, code: wrongCode(code), password: 'VerifyPass1' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toBe(INVALID_CODE);
    const wrongPassword = await verify({ email, code, password: 'NotMyPassword1' });
    expect(wrongPassword.status).toBe(400);
    expect(wrongPassword.body.message).toBe(INVALID_CODE);

    const ok = await verify({ email, code: ` ${code} `, password: 'VerifyPass1' });
    expect(ok.status).toBe(200);
    expect(ok.body.message).toContain('administrator will review');
    const user = await stored(email);
    expect(user.emailVerified).toBe(true);
    expect(user.emailVerification).toBeUndefined();

    const reused = await verify({ email, code, password: 'VerifyPass1' });
    expect(reused.status).toBe(400);
    expect(reused.body.message).toBe(INVALID_CODE);

    const pending = await login(email, 'VerifyPass1');
    expect(pending.status).toBe(403);
    expect(pending.body.details).toEqual({ code: 'APPROVAL_PENDING' });
  });

  test('an expired code is refused', async () => {
    const email = 'expired@signup.test';
    const code = await signupAndGetCode(email, 'ExpiredPass1');
    await User.updateOne({ email }, { $set: { 'emailVerification.expiresAt': new Date(Date.now() - 1000) } });
    const res = await verify({ email, code, password: 'ExpiredPass1' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(INVALID_CODE);
    expect((await stored(email)).emailVerified).toBe(false);
  });

  test('after 5 wrong attempts the code stops working, even the right one', async () => {
    const email = 'attempts@signup.test';
    const code = await signupAndGetCode(email, 'AttemptsPass1');
    for (let i = 0; i < 5; i += 1) expect((await verify({ email, code: wrongCode(code), password: 'AttemptsPass1' })).status).toBe(400);
    expect((await stored(email)).emailVerification.attempts).toBe(5);
    const res = await verify({ email, code, password: 'AttemptsPass1' });
    expect(res.status).toBe(400);
    expect((await stored(email)).emailVerified).toBe(false);
  });

  test('parallel guesses cannot exceed the 5-attempt limit', async () => {
    const email = 'parallel@signup.test';
    const code = await signupAndGetCode(email, 'ParallelPass1');
    const guesses = Array.from({ length: 12 }, (_, i) => String((Number(code) + 1 + i) % 1000000).padStart(6, '0'));
    const results = await Promise.all(guesses.map((g) => verify({ email, code: g, password: 'ParallelPass1' })));
    expect(results.every((r) => r.status === 400)).toBe(true);
    expect((await stored(email)).emailVerification.attempts).toBe(5);
    expect((await verify({ email, code, password: 'ParallelPass1' })).status).toBe(400);
  });

  test('a code only works for the account it was sent to', async () => {
    const codeA = await signupAndGetCode('owner.a@signup.test', 'OwnerAPass1');
    await signupAndGetCode('owner.b@signup.test', 'OwnerBPass1');
    expect((await verify({ email: 'owner.b@signup.test', code: codeA, password: 'OwnerBPass1' })).status).toBe(400);
  });
});

describe('resending codes', () => {
  test('cooldown: an immediate resend sends nothing; after 60 s a new code replaces the old one', async () => {
    const email = 'resend@signup.test';
    const first = await signupAndGetCode(email, 'ResendPass1');

    const tooSoon = await resend(email);
    expect(tooSoon.status).toBe(200);
    expect(tooSoon.body).toEqual({ success: true, message: RESEND_SENT, resendCooldownSeconds: 60 });
    expect(emailsTo(email)).toHaveLength(1);

    await passCooldown(email);
    const again = await resend(email);
    expect(again.body).toEqual({ success: true, message: RESEND_SENT, resendCooldownSeconds: 60 });
    expect(emailsTo(email)).toHaveLength(2);
    const second = lastCodeFor(email);
    if (second !== first) expect((await verify({ email, code: first, password: 'ResendPass1' })).status).toBe(400);
    expect((await verify({ email, code: second, password: 'ResendPass1' })).status).toBe(200);
  });

  test('at most 5 codes per hour per account', async () => {
    const email = 'hourly@signup.test';
    await signupAndGetCode(email, 'HourlyPass1'); // code 1
    for (let i = 0; i < 6; i += 1) {
      await passCooldown(email);
      await resend(email);
    }
    expect(emailsTo(email)).toHaveLength(5);
    expect((await stored(email)).emailVerification.sendCount).toBe(5);
  });

  test('a new code resets the attempt count', async () => {
    const email = 'reset.attempts@signup.test';
    const code = await signupAndGetCode(email, 'ResetAttempts1');
    for (let i = 0; i < 5; i += 1) await verify({ email, code: wrongCode(code), password: 'ResetAttempts1' });
    await passCooldown(email);
    await resend(email);
    expect((await verify({ email, code: lastCodeFor(email), password: 'ResetAttempts1' })).status).toBe(200);
  });
});

describe('duplicates and account enumeration', () => {
  test('signing up with an existing account\'s email looks identical, sends nothing and changes nothing', async () => {
    const fresh = await signup({ name: 'Fresh Person', email: 'fresh.person@signup.test', password: 'FreshPass123' });
    const taken = await signup({ name: 'Imposter', email: ADMIN.email.toUpperCase(), password: 'ImposterPass1' });
    expect(taken.status).toBe(fresh.status);
    expect(taken.body).toEqual(fresh.body);
    expect(emailsTo(ADMIN.email)).toHaveLength(0);
    const admin = await stored(ADMIN.email);
    expect(admin.name).toBe(ADMIN.name);
    expect(admin.emailVerified).toBeUndefined();
    expect((await login(ADMIN.email, ADMIN.password)).status).toBe(200);
    expect((await login(ADMIN.email, 'ImposterPass1')).status).toBe(401);
    expect(await User.countDocuments({ email: ADMIN.email })).toBe(1);
  });

  test('resend and verify answer the same for unknown, verified and pending addresses', async () => {
    await signupAndGetCode('pending.enum@signup.test', 'PendingEnum1');
    await passCooldown('pending.enum@signup.test');
    const results = await Promise.all(['nobody@signup.test', ADMIN.email, 'pending.enum@signup.test'].map(resend));
    results.forEach((r) => {
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ success: true, message: RESEND_SENT, resendCooldownSeconds: 60 });
    });
    const verifies = await Promise.all(['nobody@signup.test', ADMIN.email, 'pending.enum@signup.test'].map((email) => verify({ email, code: '123456', password: 'Whatever123' })));
    verifies.forEach((r) => {
      expect(r.status).toBe(400);
      expect(r.body.message).toBe(INVALID_CODE);
    });
  });

  test('signing up again before verifying keeps one account; the latest password is the one that verifies', async () => {
    const email = 'twice@signup.test';
    const code = await signupAndGetCode(email, 'FirstPass123', 'First Name');
    const again = await signup({ name: 'Second Name', email, password: 'SecondPass123' });
    expect(again.status).toBe(202);
    expect(emailsTo(email)).toHaveLength(1); // still in the resend cooldown: the first code stays valid
    expect(await User.countDocuments({ email })).toBe(1);
    expect((await verify({ email, code, password: 'FirstPass123' })).status).toBe(400);
    expect((await verify({ email, code, password: 'SecondPass123' })).status).toBe(200);
    expect((await stored(email)).name).toBe('Second Name');
  });

  test('two sign-ups for the same new email at once create one account', async () => {
    const email = 'race@signup.test';
    const results = await Promise.all([1, 2, 3].map((n) => signup({ name: `Racer ${n}`, email, password: `RacerPass${n}xx` })));
    results.forEach((r) => expect(r.status).toBe(202));
    expect(await User.countDocuments({ email })).toBe(1);
  });
});

describe('sign-in rules and Admin approval', () => {
  test('unverified: right password gets "verify your email", wrong password gets the normal 401', async () => {
    const email = 'unverified.login@signup.test';
    await signupAndGetCode(email, 'Unverified123');
    const right = await login(email, 'Unverified123');
    expect(right.status).toBe(403);
    expect(right.body.details).toEqual({ code: 'EMAIL_NOT_VERIFIED' });
    expect(right.body.data).toBeUndefined();
    const wrongPw = await login(email, 'WrongPassword1');
    const unknown = await login('no.such.user@signup.test', 'WrongPassword1');
    expect(wrongPw.status).toBe(401);
    expect(wrongPw.body.message).toBe(unknown.body.message);
  });

  test('approved by an Admin with a chosen role: can sign in with exactly that role', async () => {
    const email = 'approved@signup.test';
    const code = await signupAndGetCode(email, 'ApprovedPass1');
    await verify({ email, code, password: 'ApprovedPass1' });
    const user = await stored(email);

    const approve = await request(app).post(`/api/users/${user._id}/approve`).set('Authorization', `Bearer ${adminToken}`).send({ role: ROLES.ACCOUNTS });
    expect(approve.status).toBe(200);
    expect(approve.body.data).toMatchObject({ role: ROLES.ACCOUNTS, approvalStatus: 'approved', emailVerified: true });
    expect(approve.body.data.emailVerification).toBeUndefined();
    expect(approve.body.data.password).toBeUndefined();

    const signedIn = await login(email, 'ApprovedPass1');
    expect(signedIn.status).toBe(200);
    expect(signedIn.body.data.user.role).toBe(ROLES.ACCOUNTS);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${signedIn.body.data.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);
    // Approved accounts cannot be approved twice, and new sign-ups for this email change nothing.
    expect((await request(app).post(`/api/users/${user._id}/approve`).set('Authorization', `Bearer ${adminToken}`).send({ role: ROLES.ADMIN })).status).toBe(400);
  });

  test('approval rules: Admin only, verified accounts only, valid role only, public sign-ups only', async () => {
    const email = 'rules@signup.test';
    await signupAndGetCode(email, 'RulesPass123');
    const user = await stored(email);
    const approve = (token, body, id = user._id) => request(app).post(`/api/users/${id}/approve`).set('Authorization', `Bearer ${token}`).send(body);

    expect((await approve(adminToken, { role: ROLES.ACCOUNTS })).body.message).toBe('This account has not verified its email address yet.');
    await verify({ email, code: lastCodeFor(email), password: 'RulesPass123' });
    expect((await approve(adminToken, { role: 'Superuser' })).status).toBe(400);
    expect((await approve(adminToken, {})).status).toBe(400);

    // A non-Admin cannot approve anyone.
    await request(app).post('/api/users').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Staff', email: 'staff@signup.test', password: 'StaffPass123', role: ROLES.WAREHOUSE_STAFF });
    const staffLogin = await login('staff@signup.test', 'StaffPass123');
    expect(staffLogin.status).toBe(200); // Admin-created users sign in as before
    expect((await approve(staffLogin.body.data.token, { role: ROLES.ADMIN })).status).toBe(403);
    expect((await request(app).post(`/api/users/${user._id}/reject`).set('Authorization', `Bearer ${staffLogin.body.data.token}`)).status).toBe(403);

    // Admin-created accounts are not part of the sign-up approval flow.
    const staff = await stored('staff@signup.test');
    expect((await approve(adminToken, { role: ROLES.ADMIN }, staff._id)).status).toBe(400);
    expect((await stored(email)).approvalStatus).toBe('pending');
  });

  test('a rejected sign-up cannot sign in', async () => {
    const email = 'rejected@signup.test';
    const code = await signupAndGetCode(email, 'RejectedPass1');
    await verify({ email, code, password: 'RejectedPass1' });
    const user = await stored(email);
    const rejected = await request(app).post(`/api/users/${user._id}/reject`).set('Authorization', `Bearer ${adminToken}`);
    expect(rejected.status).toBe(200);
    const res = await login(email, 'RejectedPass1');
    expect(res.status).toBe(403);
    expect(res.body.details).toEqual({ code: 'REGISTRATION_REJECTED' });
  });

  test('a token for an unverified or unapproved account is refused by every protected route', async () => {
    const email = 'forged@signup.test';
    await signupAndGetCode(email, 'ForgedPass123');
    const user = await stored(email);
    const token = jwt.sign({ id: user._id, role: ROLES.ADMIN, pwv: passwordFingerprint(user.password, 'access') }, process.env.JWT_SECRET);
    for (const path of ['/api/auth/me', '/api/items', '/api/customers', '/api/users']) {
      const res = await request(app).get(path).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.details).toEqual({ code: 'EMAIL_NOT_VERIFIED' });
    }
    await verify({ email, code: lastCodeFor(email), password: 'ForgedPass123' });
    const stillPending = await request(app).get('/api/items').set('Authorization', `Bearer ${token}`);
    expect(stillPending.status).toBe(403);
    expect(stillPending.body.details).toEqual({ code: 'APPROVAL_PENDING' });
  });
});

describe('rate limits and secrecy', () => {
  test('sign-up, verify and resend are rate limited per IP (429 with Retry-After)', async () => {
    for (let i = 0; i < 10; i += 1) expect((await signup({ name: 'Rate Test', email: `rate${i}@signup.test`, password: 'RatePass1234' })).status).toBe(202);
    const blocked = await signup({ name: 'Rate Test', email: 'rate10@signup.test', password: 'RatePass1234' });
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();

    for (let i = 0; i < 20; i += 1) await verify({ email: 'rate0@signup.test', code: '000000', password: 'RatePass1234' });
    expect((await verify({ email: 'rate0@signup.test', code: '000000', password: 'RatePass1234' })).status).toBe(429);

    for (let i = 0; i < 10; i += 1) await resend('rate1@signup.test');
    expect((await resend('rate1@signup.test')).status).toBe(429);
  });

  test('codes never appear in console output or in any API response', async () => {
    const logged = [];
    const spies = ['log', 'info', 'warn', 'error'].map((level) => jest.spyOn(console, level).mockImplementation((...args) => logged.push(args.map(String).join(' '))));
    try {
      const email = 'secret@signup.test';
      const responses = [];
      responses.push(await signup({ name: 'Secret Keeper', email, password: 'SecretPass123' }));
      const first = lastCodeFor(email);
      await passCooldown(email);
      responses.push(await resend(email));
      const second = lastCodeFor(email);
      responses.push(await verify({ email, code: wrongCode(second), password: 'SecretPass123' }));
      responses.push(await verify({ email, code: second, password: 'SecretPass123' }));
      responses.push(await login(email, 'SecretPass123'));
      const everything = [...logged, ...responses.map((r) => JSON.stringify(r.body))].join('\n');
      expect(everything).not.toContain(first);
      expect(everything).not.toContain(second);
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });
});
