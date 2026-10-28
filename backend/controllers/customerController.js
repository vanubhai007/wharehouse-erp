const Customer = require('../models/Customer');
const Item = require('../models/Item');
const Expense = require('../models/Expense');
const Invoice = require('../models/Invoice');
const Settlement = require('../models/Settlement');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recordAudit } = require('../utils/audit');
const { generateCustomerId } = require('../utils/idGenerator');
const { getPagination, buildPaginatedResult } = require('../utils/paginate');
const { searchRegex } = require('../utils/searchRegex');
const { mapUploadedFiles } = require('../utils/fileMapper');
const { sanitizeFileRefs } = require('../utils/fileRefs');

const CUSTOMER_FILE_FIELDS = { documents: 'customers', photos: 'customers' };

const listCustomers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.customerType) filter.customerType = req.query.customerType;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  if (req.query.search) {
    const term = searchRegex(req.query.search);
    filter.$or = [
      { name: term },
      { businessName: term },
      { phone: term },
      { email: term },
      { customerId: term },
    ];
  }
  const [items, total] = await Promise.all([
    // _id breaks createdAt ties so pages never overlap or skip records.
    Customer.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ]);
  res.json({ success: true, ...buildPaginatedResult(items, total, page, limit) });
});

const createCustomer = asyncHandler(async (req, res) => {
  sanitizeFileRefs(req.body, CUSTOMER_FILE_FIELDS, null, req.user);
  const customerId = await generateCustomerId();
  const customer = await Customer.create({ ...req.body, customerId, createdBy: req.user._id });
  await recordAudit({ entityType: 'Customer', entityId: customer._id, action: 'CREATE', user: req.user, toValue: customer.toObject() });
  res.status(201).json({ success: true, data: customer });
});

const getCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound('Customer not found');
  res.json({ success: true, data: customer });
});

// Profile view: customer + linked inventory, expenses summary, invoices and settlements.
const getCustomerProfile = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound('Customer not found');

  const items = await Item.find({ owner: customer._id }).sort({ createdAt: -1 });
  const itemIds = items.map((i) => i._id);

  const [expenses, invoices, settlements] = await Promise.all([
    Expense.find({ item: { $in: itemIds } }).sort({ date: -1 }),
    Invoice.find({ item: { $in: itemIds } }).sort({ invoiceDate: -1 }),
    Settlement.find({ owner: customer._id }).sort({ createdAt: -1 }),
  ]);

  res.json({
    success: true,
    data: {
      customer,
      items,
      expenses,
      invoices,
      settlements,
      summary: {
        totalItems: items.length,
        totalExpenses: expenses.reduce((s, e) => s + e.amount, 0),
        totalInvoiced: invoices.reduce((s, i) => s + i.grandTotal, 0),
        totalSettled: settlements.filter((s) => s.status === 'Settled').reduce((s, x) => s + x.ownerPayable, 0),
        totalPendingSettlement: settlements.filter((s) => s.status === 'Pending').reduce((s, x) => s + x.ownerPayable, 0),
      },
    },
  });
});

// Fields that must never be overwritten by an update request. createdAt is
// the authoritative record-creation timestamp (Phase 3: Created Date) and
// must never shift on edit, however the request body is built.
const CUSTOMER_IMMUTABLE_FIELDS = ['customerId', 'createdAt', 'createdBy', 'isActive'];

const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound('Customer not found');
  const before = customer.toObject();
  sanitizeFileRefs(req.body, CUSTOMER_FILE_FIELDS, customer, req.user);
  const payload = { ...req.body };
  for (const field of CUSTOMER_IMMUTABLE_FIELDS) delete payload[field];
  Object.assign(customer, payload, { updatedBy: req.user._id });
  await customer.save();
  await recordAudit({ entityType: 'Customer', entityId: customer._id, action: 'UPDATE', user: req.user, fromValue: before, toValue: customer.toObject() });
  res.json({ success: true, data: customer });
});

const setActive = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound('Customer not found');
  customer.isActive = req.body.isActive;
  await customer.save();
  await recordAudit({ entityType: 'Customer', entityId: customer._id, action: customer.isActive ? 'ACTIVATE' : 'DEACTIVATE', user: req.user });
  res.json({ success: true, data: customer });
});

const addDocuments = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound('Customer not found');
  if (!req.files || req.files.length === 0) throw ApiError.badRequest('No files uploaded');
  const target = req.body.target === 'photos' ? 'photos' : 'documents';
  const files = mapUploadedFiles(req.files, req.user._id, req.body.label);
  customer[target].push(...files);
  await customer.save();
  res.status(201).json({ success: true, data: customer });
});

const removeDocument = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound('Customer not found');
  customer.documents = customer.documents.filter((d) => String(d._id) !== req.params.fileId);
  customer.photos = customer.photos.filter((d) => String(d._id) !== req.params.fileId);
  await customer.save();
  res.json({ success: true, data: customer });
});

module.exports = {
  listCustomers,
  createCustomer,
  getCustomer,
  getCustomerProfile,
  updateCustomer,
  setActive,
  addDocuments,
  removeDocument,
};
