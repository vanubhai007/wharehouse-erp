const request = require('supertest');
const { startTestDb, stopTestDb } = require('./testUtils');

let app;
let adminToken;
let salesToken;
let approverToken;
let staffToken;
let customerId;
let buyerId;
let itemId;
let proposalId;
let approvalId;

beforeAll(async () => {
  await startTestDb();
  app = require('../app');

  await request(app).post('/api/auth/register').send({ name: 'Admin', email: 'admin@lifecycle.com', password: 'AdminPass123', role: 'Admin' });
  const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@lifecycle.com', password: 'AdminPass123' });
  adminToken = adminLogin.body.data.token;

  const sales = await request(app).post('/api/users').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Sales', email: 'sales@lifecycle.com', password: 'SalesPass123', role: 'Sales/Buyer Manager' });
  const salesLogin = await request(app).post('/api/auth/login').send({ email: 'sales@lifecycle.com', password: 'SalesPass123' });
  salesToken = salesLogin.body.data.token;

  await request(app).post('/api/users').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Approver', email: 'approver@lifecycle.com', password: 'ApproverPass123', role: 'Owner/Approver' });
  const approverLogin = await request(app).post('/api/auth/login').send({ email: 'approver@lifecycle.com', password: 'ApproverPass123' });
  approverToken = approverLogin.body.data.token;

  await request(app).post('/api/users').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Staff', email: 'staff@lifecycle.com', password: 'StaffPass123', role: 'Warehouse Staff' });
  const staffLogin = await request(app).post('/api/auth/login').send({ email: 'staff@lifecycle.com', password: 'StaffPass123' });
  staffToken = staffLogin.body.data.token;
}, 60000);

afterAll(async () => {
  await stopTestDb();
});

test('full sale lifecycle requires owner approval before invoicing, and blocks unauthorized approvers', async () => {
  const customerRes = await request(app)
    .post('/api/customers')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Test Owner', phone: '9000000000' });
  expect(customerRes.status).toBe(201);
  customerId = customerRes.body.data._id;

  const buyerRes = await request(app)
    .post('/api/buyers')
    .set('Authorization', `Bearer ${salesToken}`)
    .send({ name: 'Test Buyer', phone: '9111111111' });
  expect(buyerRes.status).toBe(201);
  buyerId = buyerRes.body.data._id;

  const itemRes = await request(app)
    .post('/api/items')
    .set('Authorization', `Bearer ${staffToken}`)
    .send({ name: 'Test Laptop', category: 'Electronics', owner: customerId, purchaseCost: 20000, status: 'Available for Sale' });
  expect(itemRes.status).toBe(201);
  itemId = itemRes.body.data._id;
  expect(itemRes.body.data.qrCodeUrl).toBeTruthy();

  // Cannot propose a sale on an item that is not Available for Sale
  const badStatusItem = await request(app)
    .post('/api/items')
    .set('Authorization', `Bearer ${staffToken}`)
    .send({ name: 'Not Ready Item', category: 'Electronics', owner: customerId, purchaseCost: 5000 });
  const badProposal = await request(app)
    .post('/api/sale-proposals')
    .set('Authorization', `Bearer ${salesToken}`)
    .send({ item: badStatusItem.body.data._id, buyer: buyerId, proposedPrice: 7000 });
  expect(badProposal.status).toBe(409);

  const proposalRes = await request(app)
    .post('/api/sale-proposals')
    .set('Authorization', `Bearer ${salesToken}`)
    .send({ item: itemId, buyer: buyerId, proposedPrice: 25000, discountAmount: 500, gstPercent: 18 });
  expect(proposalRes.status).toBe(201);
  proposalId = proposalRes.body.data._id;
  expect(proposalRes.body.data.marginAmount).toBeCloseTo(25000 - 500 - 20000, 2);

  const submitRes = await request(app)
    .post(`/api/sale-proposals/${proposalId}/submit-for-approval`)
    .set('Authorization', `Bearer ${salesToken}`);
  expect(submitRes.status).toBe(201);
  approvalId = submitRes.body.data.approval._id;

  // Invoice cannot be created before approval
  const earlyInvoice = await request(app)
    .post('/api/invoices/from-proposal')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ saleProposal: proposalId });
  expect(earlyInvoice.status).toBe(403);

  // Sales Manager is not an authorized approver
  const unauthorizedDecision = await request(app)
    .post(`/api/approvals/${approvalId}/decide`)
    .set('Authorization', `Bearer ${salesToken}`)
    .send({ decision: 'Approved' });
  expect(unauthorizedDecision.status).toBe(403);

  const decision = await request(app)
    .post(`/api/approvals/${approvalId}/decide`)
    .set('Authorization', `Bearer ${approverToken}`)
    .send({ decision: 'Approved', remarks: 'Looks good' });
  expect(decision.status).toBe(200);
  expect(decision.body.data.proposal.status).toBe('Approved');

  // Deciding twice on the same approval is rejected
  const secondDecision = await request(app)
    .post(`/api/approvals/${approvalId}/decide`)
    .set('Authorization', `Bearer ${approverToken}`)
    .send({ decision: 'Rejected' });
  expect(secondDecision.status).toBe(409);

  const invoiceRes = await request(app)
    .post('/api/invoices/from-proposal')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ saleProposal: proposalId });
  expect(invoiceRes.status).toBe(201);
  const invoiceNumber = invoiceRes.body.data.invoiceNumber;
  expect(invoiceRes.body.data.grandTotal).toBeGreaterThan(0);

  // Re-requesting an invoice for the same proposal must not create a duplicate
  const invoiceAgain = await request(app)
    .post('/api/invoices/from-proposal')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ saleProposal: proposalId });
  expect(invoiceAgain.status).toBe(200);
  expect(invoiceAgain.body.data.invoiceNumber).toBe(invoiceNumber);

  // Dispatch cannot be created until the sale is converted (it now is)
  const dispatchRes = await request(app)
    .post('/api/dispatches')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ saleProposal: proposalId, deliveryAddress: '123 Buyer Street' });
  expect(dispatchRes.status).toBe(201);
});
