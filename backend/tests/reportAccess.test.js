const request = require('supertest');
const { startTestDb, stopTestDb } = require('./testUtils');
const { resetRateLimits } = require('../middleware/rateLimit');
const { ROLES, ALL_ROLES } = require('../config/constants');

let app;
const tokens = {};

// Expected access, written out explicitly (not read from REPORT_ACCESS) so a
// mistake in the constants is caught here.
const { ADMIN, WAREHOUSE_MANAGER, ACCOUNTS, SALES_MANAGER, OWNER_APPROVER } = ROLES;
const COSTS = [ADMIN, WAREHOUSE_MANAGER, ACCOUNTS, OWNER_APPROVER];
const SALES = [ADMIN, ACCOUNTS, SALES_MANAGER, OWNER_APPROVER];
const FINANCE = [ADMIN, ACCOUNTS, OWNER_APPROVER];

const REPORT_ENDPOINTS = {
  '/api/reports/inventory': ALL_ROLES,
  '/api/reports/inventory/owner-wise': ALL_ROLES,
  '/api/reports/cost-sheet': COSTS,
  '/api/reports/expenses': COSTS,
  '/api/reports/refurbishment': ALL_ROLES,
  '/api/reports/sales': SALES,
  '/api/reports/pending-approvals': ALL_ROLES,
  '/api/reports/outstanding-payments': FINANCE,
  '/api/reports/settlements': FINANCE,
  '/api/reports/dispatch': ALL_ROLES,
  '/api/reports/audit': [ADMIN],
};

const COST_CARDS = ['accumulatedRental', 'refurbishmentExpense', 'marketingExpense', 'logisticsExpense', 'totalInventoryCost'];
const OPERATIONAL_CARDS = [
  'totalInventory',
  'totalCustomers',
  'itemsReceived',
  'itemsInWarehouse',
  'warehouseOccupancyPercent',
  'underRefurbishment',
  'availableForSale',
  'pendingApprovals',
  'totalSales',
];

// This file sends more PDF exports per user than the per-minute limit allows.
beforeEach(() => resetRateLimits());

beforeAll(async () => {
  await startTestDb();
  app = require('../app');

  await request(app).post('/api/auth/register').send({ name: 'Admin', email: 'admin@reports.com', password: 'AdminPass123', role: ROLES.ADMIN });
  const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@reports.com', password: 'AdminPass123' });
  tokens[ROLES.ADMIN] = adminLogin.body.data.token;

  for (const role of ALL_ROLES.filter((r) => r !== ROLES.ADMIN)) {
    const email = `${role.replace(/[^a-z]/gi, '').toLowerCase()}@reports.com`;
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tokens[ROLES.ADMIN]}`)
      .send({ name: role, email, password: 'RolePass123', role });
    const login = await request(app).post('/api/auth/login').send({ email, password: 'RolePass123' });
    tokens[role] = login.body.data.token;
  }
}, 60000);

afterAll(async () => {
  await stopTestDb();
});

describe('report access by role', () => {
  test('every role has a login token', () => {
    for (const role of ALL_ROLES) expect(tokens[role]).toBeTruthy();
  });

  for (const [path, allowedRoles] of Object.entries(REPORT_ENDPOINTS)) {
    for (const role of ALL_ROLES) {
      const expected = allowedRoles.includes(role) ? 200 : 403;
      test(`${role} -> GET ${path} is ${expected}`, async () => {
        const res = await request(app).get(path).set('Authorization', `Bearer ${tokens[role]}`);
        expect(res.status).toBe(expected);
      });
    }
  }

  test('Admin can open every report', () => {
    for (const allowedRoles of Object.values(REPORT_ENDPOINTS)) expect(allowedRoles).toContain(ROLES.ADMIN);
  });

  test('PDF export is blocked for roles without access and allowed for roles with access', async () => {
    const denied = await request(app).get('/api/reports/expenses?format=pdf').set('Authorization', `Bearer ${tokens[ROLES.WAREHOUSE_STAFF]}`);
    expect(denied.status).toBe(403);

    const allowed = await request(app).get('/api/reports/expenses?format=pdf').set('Authorization', `Bearer ${tokens[ROLES.ACCOUNTS]}`);
    expect(allowed.status).toBe(200);
    expect(allowed.headers['content-type']).toMatch(/application\/pdf/);
  });

  test('reports and dashboard reject unauthenticated requests', async () => {
    expect((await request(app).get('/api/reports/inventory')).status).toBe(401);
    expect((await request(app).get('/api/dashboard')).status).toBe(401);
  });
});

describe('dashboard figures by role', () => {
  async function dashboardFor(role) {
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${tokens[role]}`);
    expect(res.status).toBe(200);
    return res.body.data;
  }

  test('Admin sees every card, the expense chart flag and recent activity', async () => {
    const data = await dashboardFor(ROLES.ADMIN);
    for (const key of [...OPERATIONAL_CARDS, 'totalSalesValue', ...COST_CARDS]) expect(data.cards[key]).toBeDefined();
    expect(data.recentActivity.length).toBeGreaterThan(0);
    expect(data.access).toEqual({ expenses: true, recentActivity: true });
  });

  test('Warehouse Staff sees only operational figures', async () => {
    const data = await dashboardFor(ROLES.WAREHOUSE_STAFF);
    for (const key of OPERATIONAL_CARDS) expect(data.cards[key]).toBeDefined();
    for (const key of ['totalSalesValue', ...COST_CARDS]) expect(data.cards[key]).toBeUndefined();
    expect(data.charts.expensesByCategory).toEqual([]);
    expect(data.recentActivity).toEqual([]);
    expect(data.access).toEqual({ expenses: false, recentActivity: false });
  });

  test('Sales/Buyer Manager sees sales value but not cost figures', async () => {
    const data = await dashboardFor(ROLES.SALES_MANAGER);
    expect(data.cards.totalSalesValue).toBeDefined();
    for (const key of COST_CARDS) expect(data.cards[key]).toBeUndefined();
    expect(data.access.expenses).toBe(false);
  });

  test('Warehouse Manager sees cost figures but not sales value', async () => {
    const data = await dashboardFor(ROLES.WAREHOUSE_MANAGER);
    for (const key of COST_CARDS) expect(data.cards[key]).toBeDefined();
    expect(data.cards.totalSalesValue).toBeUndefined();
    expect(data.access).toEqual({ expenses: true, recentActivity: false });
  });

  test('Accounts sees every card except recent activity', async () => {
    const data = await dashboardFor(ROLES.ACCOUNTS);
    for (const key of [...OPERATIONAL_CARDS, 'totalSalesValue', ...COST_CARDS]) expect(data.cards[key]).toBeDefined();
    expect(data.recentActivity).toEqual([]);
    expect(data.access).toEqual({ expenses: true, recentActivity: false });
  });
});
