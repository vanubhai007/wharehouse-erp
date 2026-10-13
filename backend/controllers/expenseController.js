const crypto = require('crypto');
const Expense = require('../models/Expense');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recordAudit } = require('../utils/audit');
const { mapUploadedFiles } = require('../utils/fileMapper');

function buildDedupeKey({ item, category, date, amount, vendor }) {
  const day = new Date(date || Date.now()).toISOString().slice(0, 10);
  return crypto.createHash('md5').update(`${item}|${category}|${day}|${amount}|${vendor || ''}`).digest('hex');
}

const listExpenses = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.item) filter.item = req.query.item;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = new Date(req.query.from);
    if (req.query.to) filter.date.$lte = new Date(req.query.to);
  }
  const expenses = await Expense.find(filter).populate('item', 'itemId name').sort({ date: -1 });
  res.json({ success: true, data: expenses });
});

const createExpense = asyncHandler(async (req, res) => {
  const dedupeKey = buildDedupeKey(req.body);
  if (!req.body.force) {
    const existing = await Expense.findOne({ dedupeKey });
    if (existing) {
      throw ApiError.conflict(
        'A very similar expense (same item, category, date, amount and vendor) already exists. Resubmit with force=true to add it anyway.'
      );
    }
  }
  const expense = await Expense.create({ ...req.body, dedupeKey, createdBy: req.user._id });
  await recordAudit({ entityType: 'Expense', entityId: expense._id, action: 'CREATE', user: req.user, toValue: expense.toObject() });
  res.status(201).json({ success: true, data: expense });
});

const updateExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) throw ApiError.notFound('Expense not found');
  const { amount, category, date, vendor, paymentStatus, notes } = req.body;
  if (amount !== undefined) expense.amount = amount;
  if (category !== undefined) expense.category = category;
  if (date !== undefined) expense.date = date;
  if (vendor !== undefined) expense.vendor = vendor;
  if (paymentStatus !== undefined) expense.paymentStatus = paymentStatus;
  if (notes !== undefined) expense.notes = notes;
  expense.dedupeKey = buildDedupeKey(expense);
  await expense.save();
  await recordAudit({ entityType: 'Expense', entityId: expense._id, action: 'UPDATE', user: req.user });
  res.json({ success: true, data: expense });
});

const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) throw ApiError.notFound('Expense not found');
  if (expense.isSystemGenerated) throw ApiError.badRequest('System-generated rental charges cannot be deleted manually');
  await expense.deleteOne();
  await recordAudit({ entityType: 'Expense', entityId: req.params.id, action: 'DELETE', user: req.user });
  res.json({ success: true, message: 'Expense deleted' });
});

const addReceipts = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) throw ApiError.notFound('Expense not found');
  if (!req.files || req.files.length === 0) throw ApiError.badRequest('No files uploaded');
  expense.receipts.push(...mapUploadedFiles(req.files, req.user._id, 'Receipt'));
  await expense.save();
  res.status(201).json({ success: true, data: expense });
});

module.exports = { listExpenses, createExpense, updateExpense, deleteExpense, addReceipts };
