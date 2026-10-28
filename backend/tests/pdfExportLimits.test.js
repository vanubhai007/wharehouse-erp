const http = require('http');
const request = require('supertest');
const { startTestDb, stopTestDb } = require('./testUtils');
const { ROLES } = require('../config/constants');
const { resetRateLimits, setRateLimitClock, pdfExportsInProgressCount } = require('../middleware/rateLimit');

// Lets a test hold PDF renders open: while mockRenderGate is set, every PDF
// export waits on it inside generateTablePdf (after its data was fetched).
// mockRenderError makes the next render fail.
let mockRenderGate = null;
let mockRenderError = null;
const mockRenders = { started: 0, finished: 0 };
jest.mock('../services/pdfService', () => {
  const actual = jest.requireActual('../services/pdfService');
  return {
    ...actual,
    generateTablePdf: jest.fn(async (...args) => {
      mockRenders.started += 1;
      try {
        if (mockRenderGate) await mockRenderGate.promise;
        if (mockRenderError) {
          const err = mockRenderError;
          mockRenderError = null;
          throw err;
        }
        return await actual.generateTablePdf(...args);
      } finally {
        mockRenders.finished += 1;
      }
    }),
  };
});

let app;
let server;
let Item;
let AuditLog;
const tokens = {};
let ownerId;

const binary = (res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};
const get = (path, user = 'admin') => request(app).get(path).set('Authorization', `Bearer ${tokens[user]}`).buffer(true).parse(binary);
const jsonOf = (res) => JSON.parse(res.body.toString());
const DISPATCH_PDF = '/api/reports/dispatch?format=pdf'; // empty report: a cheap PDF

async function waitFor(check, what) {
  const end = Date.now() + 10000;
  while (!check()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function openGate() {
  let release;
  const promise = new Promise((resolve) => { release = resolve; });
  mockRenderGate = { promise, release };
}

function releaseGate() {
  mockRenderGate.release();
  mockRenderGate = null;
}

beforeAll(async () => {
  await startTestDb();
  app = require('../app');
  server = app.listen(0);
  Item = require('../models/Item');
  AuditLog = require('../models/AuditLog');
  const Customer = require('../models/Customer');

  await request(app).post('/api/auth/register').send({ name: 'Admin', email: 'admin@limits.com', password: 'AdminPass123', role: ROLES.ADMIN });
  tokens.admin = (await request(app).post('/api/auth/login').send({ email: 'admin@limits.com', password: 'AdminPass123' })).body.data.token;
  const others = { accounts: ROLES.ACCOUNTS, manager: ROLES.WAREHOUSE_MANAGER, staff: ROLES.WAREHOUSE_STAFF };
  for (const [key, role] of Object.entries(others)) {
    const email = `${key}@limits.com`;
    await request(app).post('/api/users').set('Authorization', `Bearer ${tokens.admin}`).send({ name: key, email, password: 'RolePass123', role });
    tokens[key] = (await request(app).post('/api/auth/login').send({ email, password: 'RolePass123' })).body.data.token;
  }
  ownerId = (await Customer.create({ customerId: 'CUST-L1', name: 'Limit Owner', phone: '9000000021' }))._id;
}, 60000);

beforeEach(() => {
  resetRateLimits();
  mockRenderGate = null;
  mockRenderError = null;
});

afterAll(async () => {
  setRateLimitClock(null);
  await new Promise((resolve) => server.close(resolve));
  await stopTestDb();
});

describe('PDF exports per user per minute', () => {
  test('10 PDF exports are allowed; the 11th gets 429 with Retry-After, across PDF endpoints', async () => {
    for (let i = 0; i < 10; i += 1) expect((await get(DISPATCH_PDF)).status).toBe(200);
    const limited = await get(DISPATCH_PDF);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(Number(limited.headers['retry-after'])).toBeLessThanOrEqual(60);
    expect(jsonOf(limited).message).toBe('Too many PDF exports. Please try again in a minute.');
    expect(limited.headers['content-type']).toMatch(/application\/json/);
    expect((await get('/api/items/export/pdf')).status).toBe(429); // the same limit covers the inventory export
  });

  test('the limit is per user, and resets after the minute', async () => {
    let clock = Date.now();
    setRateLimitClock(() => clock);
    try {
      for (let i = 0; i < 10; i += 1) expect((await get(DISPATCH_PDF)).status).toBe(200);
      expect((await get(DISPATCH_PDF)).status).toBe(429);
      expect((await get(DISPATCH_PDF, 'accounts')).status).toBe(200);
      clock += 61 * 1000;
      expect((await get(DISPATCH_PDF)).status).toBe(200);
    } finally {
      setRateLimitClock(null);
    }
  });

  test('JSON report and list requests are never limited, even after the PDF limit is reached', async () => {
    for (let i = 0; i < 10; i += 1) await get(DISPATCH_PDF);
    expect((await get(DISPATCH_PDF)).status).toBe(429);
    for (let i = 0; i < 20; i += 1) {
      expect((await get('/api/reports/dispatch')).status).toBe(200);
      expect((await get('/api/items')).status).toBe(200);
    }
    expect((await get('/api/reports/inventory/owner-wise?format=pdf')).status).toBe(200); // JSON-only route
  });

  test('refused requests (403 forbidden, 400 bad format, 401) do not count', async () => {
    for (let i = 0; i < 12; i += 1) {
      expect((await get('/api/reports/expenses?format=pdf', 'staff')).status).toBe(403);
      expect((await get('/api/reports/dispatch?format=csv', 'staff')).status).toBe(400);
    }
    expect((await request(app).get(DISPATCH_PDF)).status).toBe(401);
    for (let i = 0; i < 10; i += 1) expect((await get(DISPATCH_PDF, 'staff')).status).toBe(200);
    expect((await get(DISPATCH_PDF, 'staff')).status).toBe(429);
  });
});

describe('At most 2 PDF exports at once', () => {
  test('a third export gets 503 with Retry-After: 5 and does not use up the user\'s limit', async () => {
    openGate();
    const startedBefore = mockRenders.started;
    const first = get(DISPATCH_PDF).then((r) => r);
    const second = get(DISPATCH_PDF, 'accounts').then((r) => r);
    await waitFor(() => mockRenders.started === startedBefore + 2, 'two renders to start');
    expect(pdfExportsInProgressCount()).toBe(2);

    for (let i = 0; i < 12; i += 1) {
      const busy = await get(DISPATCH_PDF, 'manager');
      expect(busy.status).toBe(503);
      expect(busy.headers['retry-after']).toBe('5');
      expect(busy.headers['content-type']).toMatch(/application\/json/);
      expect(jsonOf(busy).message).toBe('The server is busy creating other PDF reports. Please try again in a few seconds.');
    }
    expect(mockRenders.started).toBe(startedBefore + 2); // nothing else was rendered
    // JSON requests are not held back while the PDF slots are full.
    expect((await get('/api/reports/dispatch', 'manager')).status).toBe(200);
    expect((await get('/api/items', 'manager')).status).toBe(200);

    releaseGate();
    expect((await first).status).toBe(200);
    expect((await second).status).toBe(200);
    expect(pdfExportsInProgressCount()).toBe(0);
    // The 12 busy responses did not count: the full limit of 10 is still there.
    for (let i = 0; i < 10; i += 1) expect((await get(DISPATCH_PDF, 'manager')).status).toBe(200);
    expect((await get(DISPATCH_PDF, 'manager')).status).toBe(429);
  });

  test('an aborted download keeps its slot until its render finishes, so a third render cannot start', async () => {
    openGate();
    const startedBefore = mockRenders.started;
    const finishedBefore = mockRenders.finished;
    const { port } = server.address();

    // Client 1 starts a PDF export and drops the connection mid-render.
    let serverSawClose = false;
    server.once('connection', (socket) => socket.once('close', () => { serverSawClose = true; }));
    const aborted = http.get({ port, path: DISPATCH_PDF, headers: { Authorization: `Bearer ${tokens.admin}` } });
    aborted.on('error', () => {});
    await waitFor(() => mockRenders.started === startedBefore + 1, 'the first render to start');
    aborted.destroy();
    await waitFor(() => serverSawClose, 'the server to see the connection close');
    expect(mockRenders.finished).toBe(finishedBefore); // its render is still running
    expect(pdfExportsInProgressCount()).toBe(1);

    // Client 2 takes the second slot; a third export is refused.
    const second = get(DISPATCH_PDF, 'accounts').then((r) => r);
    await waitFor(() => mockRenders.started === startedBefore + 2, 'the second render to start');
    const third = await get(DISPATCH_PDF, 'manager');
    expect(third.status).toBe(503);
    expect(mockRenders.started).toBe(startedBefore + 2);
    expect(pdfExportsInProgressCount()).toBe(2);

    // Once both renders (including the abandoned one) finish, slots free up.
    releaseGate();
    expect((await second).status).toBe(200);
    await waitFor(() => mockRenders.finished === finishedBefore + 2, 'both renders to finish');
    await waitFor(() => pdfExportsInProgressCount() === 0, 'both slots to be freed');
    expect((await get(DISPATCH_PDF, 'manager')).status).toBe(200);
  });

  test('a failed render frees its slot (no leak)', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      mockRenderError = new Error('render failed');
      const failed = await get(DISPATCH_PDF);
      expect(failed.status).toBe(500);
      expect(failed.headers['content-type']).toMatch(/application\/json/);
    } finally {
      errorSpy.mockRestore();
    }
    expect(pdfExportsInProgressCount()).toBe(0);
    expect((await get(DISPATCH_PDF)).status).toBe(200);
  });
});

describe('PDF row limit (2,000) - counted before fetching', () => {
  test('exactly 2,000 matching items export; 2,001 are refused with 413 before any fetch', async () => {
    const docs = Array.from({ length: 2000 }, (_, i) => ({
      itemId: `ITM-L${String(i).padStart(5, '0')}`, name: `Bulk item ${i}`, category: 'Bulk', owner: ownerId, purchaseCost: 100,
    }));
    await Item.insertMany(docs);

    const ok = await get('/api/items/export/pdf?category=Bulk');
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toMatch(/^application\/pdf/);
    expect(pdfExportsInProgressCount()).toBe(0);

    await Item.create({ itemId: 'ITM-L02000', name: 'One too many', category: 'Bulk', owner: ownerId, purchaseCost: 100 });
    const findSpy = jest.spyOn(Item, 'find');
    try {
      const startedBefore = mockRenders.started;
      for (const path of ['/api/items/export/pdf?category=Bulk', '/api/reports/inventory?format=pdf&category=Bulk', '/api/reports/cost-sheet?format=pdf']) {
        const res = await get(path);
        expect(res.status).toBe(413);
        expect(res.headers['content-type']).toMatch(/application\/json/);
        expect(jsonOf(res).message).toBe('This report has 2,001 matching records, more than the 2,000 that can be exported as a PDF. Narrow the filters (for example the date range or status) and try again.');
      }
      expect(findSpy).not.toHaveBeenCalled(); // counted, never fetched
      expect(mockRenders.started).toBe(startedBefore); // no PDF was started
    } finally {
      findSpy.mockRestore();
    }
    expect(pdfExportsInProgressCount()).toBe(0); // 413s free their slots

    // The JSON report is not row-limited.
    const json = await get('/api/reports/inventory?category=Bulk');
    expect(json.status).toBe(200);
    expect(jsonOf(json).data).toHaveLength(2001);
  }, 60000);

  test('the audit PDF keeps its 500-entry limit and is never refused for size', async () => {
    const now = Date.now();
    await AuditLog.insertMany(Array.from({ length: 2100 }, (_, i) => ({
      entityType: 'Item', entityId: ownerId, action: `BULK_${i}`, performedByName: 'Tester', createdAt: new Date(now - i * 1000),
    })));
    const res = await get('/api/reports/audit?format=pdf');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^application\/pdf/);
    const layout = await require('../services/pdfService').generateTablePdf.mock.results.at(-1).value;
    expect(layout.rowsRendered).toBe(500);
  }, 60000);
});
