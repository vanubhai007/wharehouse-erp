const request = require('supertest');
const { startTestDb, stopTestDb } = require('./testUtils');

let app;

beforeAll(async () => {
  await startTestDb();
  app = require('../app');
}, 60000);

afterAll(async () => {
  await stopTestDb();
});

describe('Auth flow', () => {
  test('first registration bootstraps an Admin without a token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'AdminPass123',
      role: 'Admin',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('Admin');
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.password).toBeUndefined();
  });

  test('a second registration attempt is rejected once a user exists', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Someone Else',
      email: 'other@test.com',
      password: 'Password123',
      role: 'Admin',
    });
    expect(res.status).toBe(403);
  });

  test('login succeeds with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'AdminPass123' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });

  test('login fails with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'WrongPassword' });
    expect(res.status).toBe(401);
  });

  test('protected route rejects requests without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('protected route accepts a valid token', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'AdminPass123' });
    const token = login.body.data.token;
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('admin@test.com');
  });

  test('admin can create a new user with a specific role', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'AdminPass123' });
    const token = login.body.data.token;
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Manager One', email: 'manager1@test.com', password: 'ManagerPass123', role: 'Warehouse Manager' });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('Warehouse Manager');
  });

  test('a non-admin role cannot create users', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'manager1@test.com', password: 'ManagerPass123' });
    const token = login.body.data.token;
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Another', email: 'another@test.com', password: 'Password123', role: 'Warehouse Staff' });
    expect(res.status).toBe(403);
  });
});
