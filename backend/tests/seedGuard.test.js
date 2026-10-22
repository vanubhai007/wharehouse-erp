const mongoose = require('mongoose');
const { startTestDb, stopTestDb } = require('./testUtils');

// The seed script must never open its own connection in these tests: the
// connection is replaced by a mock (the in-memory test database is already
// connected), so every check below runs without touching a real database.
jest.mock('../config/db', () => jest.fn(async () => {}));
const connectDB = require('../config/db');
const { run, checkSeedPreconditions, generateDemoPassword } = require('../seed/seed');

const STRONG = 'Str0ng-Seed-Password!';
const ORIGINAL = {
  NODE_ENV: process.env.NODE_ENV,
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD,
  SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL,
};

function setEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

let User;
let logs;

beforeAll(async () => {
  await startTestDb();
  User = require('../models/User');
}, 60000);

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  setEnv('NODE_ENV', 'development');
  setEnv('SEED_ADMIN_PASSWORD', STRONG);
  setEnv('SEED_ADMIN_EMAIL', 'admin@seedtest.com');
  connectDB.mockClear();
  logs = [];
  jest.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
  jest.spyOn(console, 'error').mockImplementation((...args) => logs.push(args.join(' ')));
  // Keep the shared test connection open when the seed script disconnects.
  jest.spyOn(mongoose, 'disconnect').mockResolvedValue();
});

afterEach(() => {
  for (const [name, value] of Object.entries(ORIGINAL)) setEnv(name, value);
  jest.restoreAllMocks();
});

describe('checkSeedPreconditions', () => {
  test('refuses production even with a strong password', () => {
    expect(checkSeedPreconditions({ NODE_ENV: 'production', SEED_ADMIN_PASSWORD: STRONG })).toMatch(/NODE_ENV is "production"/);
  });

  test.each([
    ['missing', undefined, /set SEED_ADMIN_PASSWORD/],
    ['empty', '', /set SEED_ADMIN_PASSWORD/],
    ['the example placeholder', 'ChangeMe123!', /placeholder/],
    ['too short', 'Short1!abcd', /at least 12 characters/],
  ])('refuses an admin password that is %s', (label, password, message) => {
    expect(checkSeedPreconditions({ NODE_ENV: 'development', SEED_ADMIN_PASSWORD: password })).toMatch(message);
  });

  test('allows development and test with a strong password', () => {
    expect(checkSeedPreconditions({ NODE_ENV: 'development', SEED_ADMIN_PASSWORD: STRONG })).toBeNull();
    expect(checkSeedPreconditions({ NODE_ENV: 'test', SEED_ADMIN_PASSWORD: STRONG })).toBeNull();
  });
});

describe('run()', () => {
  test('in production it refuses before connecting to any database', async () => {
    setEnv('NODE_ENV', 'production');
    expect(await run()).toBe(1);
    expect(connectDB).not.toHaveBeenCalled();
    expect(await User.countDocuments()).toBe(0);
    expect(logs.join('\n')).toMatch(/Refusing to seed/);
  });

  test('with the placeholder admin password it refuses before connecting', async () => {
    setEnv('SEED_ADMIN_PASSWORD', 'ChangeMe123!');
    expect(await run()).toBe(1);
    expect(connectDB).not.toHaveBeenCalled();
  });

  test('skips a database that already contains users and changes nothing', async () => {
    await User.create({ name: 'Real User', email: 'real@company.com', password: 'RealUserPass123', role: 'Accounts' });
    expect(await run()).toBe(0);
    expect(connectDB).toHaveBeenCalledTimes(1);
    expect(await User.countDocuments()).toBe(1);
    expect(logs.join('\n')).toMatch(/Seed skipped: the database already contains users/);
  });

  test('seeds an empty database with random demo passwords and never prints the admin password', async () => {
    expect(await run()).toBe(0);
    const output = logs.join('\n');

    expect(await User.countDocuments()).toBe(6);
    expect(output).not.toContain(STRONG);
    const admin = await User.findOne({ email: 'admin@seedtest.com' }).select('+password');
    expect(admin.role).toBe('Admin');
    expect(await admin.comparePassword(STRONG)).toBe(true);

    const demoEmails = ['manager', 'staff', 'accounts', 'sales', 'approver'].map((n) => `${n}@hrwarehouse.com`);
    const printed = demoEmails.map((email) => {
      const line = output.split('\n').find((l) => l.includes(`${email} / `));
      return line.split(`${email} / `)[1].trim();
    });
    expect(new Set(printed).size).toBe(5);
    for (const [i, email] of demoEmails.entries()) {
      expect(printed[i]).toMatch(/^[A-Za-z0-9_-]{16}$/);
      const user = await User.findOne({ email }).select('+password');
      expect(await user.comparePassword(printed[i])).toBe(true);
    }

    // None of the old fixed demo passwords work any more.
    const manager = await User.findOne({ email: 'manager@hrwarehouse.com' }).select('+password');
    expect(await manager.comparePassword('Manager123!')).toBe(false);
  }, 30000);

  test('running it a second time skips the now-seeded database', async () => {
    expect(await run()).toBe(0);
    expect(await run()).toBe(0);
    expect(await User.countDocuments()).toBe(6);
  }, 30000);
});

test('generateDemoPassword returns a fresh 16-character URL-safe password each time', () => {
  const passwords = Array.from({ length: 50 }, () => generateDemoPassword());
  expect(new Set(passwords).size).toBe(50);
  for (const p of passwords) expect(p).toMatch(/^[A-Za-z0-9_-]{16}$/);
});
