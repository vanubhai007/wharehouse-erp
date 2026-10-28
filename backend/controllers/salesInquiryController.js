const SalesInquiry = require('../models/SalesInquiry');
const Buyer = require('../models/Buyer');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recordAudit } = require('../utils/audit');
const { generateYearlyId, generateBuyerId } = require('../utils/idGenerator');
const { getPagination, buildPaginatedResult } = require('../utils/paginate');
const { searchRegex } = require('../utils/searchRegex');

const listInquiries = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
  if (req.query.search) {
    const term = searchRegex(req.query.search);
    filter.$or = [
      { contactName: term },
      { phone: term },
      { email: term },
      { company: term },
      { inquiryNumber: term },
      { productName: term },
      { productId: term },
    ];
  }
  const [inquiries, total] = await Promise.all([
    SalesInquiry.find(filter)
      .populate('assignedTo', 'name role')
      .populate('convertedToBuyer', 'buyerId name businessName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    SalesInquiry.countDocuments(filter),
  ]);
  res.json({ success: true, ...buildPaginatedResult(inquiries, total, page, limit) });
});

const getInquiry = asyncHandler(async (req, res) => {
  const inquiry = await SalesInquiry.findById(req.params.id)
    .populate('assignedTo', 'name role')
    .populate('buyer', 'buyerId name businessName')
    .populate('convertedToBuyer', 'buyerId name businessName');
  if (!inquiry) throw ApiError.notFound('Sales inquiry not found');
  res.json({ success: true, data: inquiry });
});

const createInquiry = asyncHandler(async (req, res) => {
  const inquiryNumber = await generateYearlyId('SI-', 'salesInquiry');
  const inquiry = await SalesInquiry.create({ ...req.body, inquiryNumber, createdBy: req.user._id });
  await recordAudit({ entityType: 'SalesInquiry', entityId: inquiry._id, action: 'CREATE', user: req.user, toValue: { inquiryNumber } });
  res.status(201).json({ success: true, data: inquiry });
});

const updateInquiry = asyncHandler(async (req, res) => {
  const inquiry = await SalesInquiry.findById(req.params.id);
  if (!inquiry) throw ApiError.notFound('Sales inquiry not found');

  const immutable = ['inquiryNumber', 'convertedToBuyer', 'convertedAt'];
  for (const key of Object.keys(req.body)) {
    if (!immutable.includes(key)) inquiry[key] = req.body[key];
  }
  inquiry.updatedBy = req.user._id;
  await inquiry.save();

  await recordAudit({ entityType: 'SalesInquiry', entityId: inquiry._id, action: 'UPDATE', user: req.user });
  res.json({ success: true, data: inquiry });
});

const updateStatus = asyncHandler(async (req, res) => {
  const inquiry = await SalesInquiry.findById(req.params.id);
  if (!inquiry) throw ApiError.notFound('Sales inquiry not found');
  if (inquiry.status === 'Converted') {
    throw ApiError.conflict('This inquiry has already been converted and its status can no longer be changed');
  }

  const from = inquiry.status;
  inquiry.status = req.body.status;
  if (req.body.followUpDate !== undefined) inquiry.followUpDate = req.body.followUpDate;
  if (req.body.notes !== undefined) inquiry.notes = req.body.notes;
  await inquiry.save();

  await recordAudit({ entityType: 'SalesInquiry', entityId: inquiry._id, action: 'STATUS_CHANGE', user: req.user, fromValue: from, toValue: inquiry.status });
  res.json({ success: true, data: inquiry });
});

// Converts a qualified inquiry's contact details into a full Buyer record,
// so it can go on to be linked to sale proposals like any other buyer.
const convertToBuyer = asyncHandler(async (req, res) => {
  const inquiry = await SalesInquiry.findById(req.params.id);
  if (!inquiry) throw ApiError.notFound('Sales inquiry not found');
  if (inquiry.convertedToBuyer) {
    throw ApiError.conflict('This inquiry has already been converted to a buyer');
  }

  const buyerId = await generateBuyerId();
  const buyer = await Buyer.create({
    buyerId,
    name: inquiry.contactName,
    businessName: inquiry.company,
    phone: inquiry.phone,
    email: inquiry.email,
    createdBy: req.user._id,
  });

  inquiry.convertedToBuyer = buyer._id;
  inquiry.buyer = buyer._id;
  inquiry.convertedAt = new Date();
  inquiry.status = 'Converted';
  await inquiry.save();

  await recordAudit({ entityType: 'SalesInquiry', entityId: inquiry._id, action: 'CONVERT_TO_BUYER', user: req.user, toValue: { buyerId } });
  res.status(201).json({ success: true, data: { inquiry, buyer } });
});

module.exports = { listInquiries, getInquiry, createInquiry, updateInquiry, updateStatus, convertToBuyer };
