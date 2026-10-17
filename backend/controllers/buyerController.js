const Buyer = require('../models/Buyer');
const BuyerEnquiry = require('../models/BuyerEnquiry');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recordAudit } = require('../utils/audit');
const { generateBuyerId } = require('../utils/idGenerator');
const { getPagination, buildPaginatedResult } = require('../utils/paginate');
const { BUYER_ENQUIRY_STATUS } = require('../config/constants');

const listBuyers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.search) {
    filter.$or = [
      { name: new RegExp(req.query.search, 'i') },
      { businessName: new RegExp(req.query.search, 'i') },
      { phone: new RegExp(req.query.search, 'i') },
    ];
  }
  const [items, total] = await Promise.all([
    Buyer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Buyer.countDocuments(filter),
  ]);
  res.json({ success: true, ...buildPaginatedResult(items, total, page, limit) });
});

const createBuyer = asyncHandler(async (req, res) => {
  const buyerId = await generateBuyerId();
  const buyer = await Buyer.create({ ...req.body, buyerId, createdBy: req.user._id });
  await recordAudit({ entityType: 'Buyer', entityId: buyer._id, action: 'CREATE', user: req.user });
  res.status(201).json({ success: true, data: buyer });
});

const getBuyer = asyncHandler(async (req, res) => {
  const buyer = await Buyer.findById(req.params.id);
  if (!buyer) throw ApiError.notFound('Buyer not found');
  const enquiries = await BuyerEnquiry.find({ buyer: buyer._id }).populate('item', 'itemId name status estimatedResaleValue');
  res.json({ success: true, data: { buyer, enquiries } });
});

const updateBuyer = asyncHandler(async (req, res) => {
  const buyer = await Buyer.findById(req.params.id);
  if (!buyer) throw ApiError.notFound('Buyer not found');
  Object.assign(buyer, req.body);
  await buyer.save();
  await recordAudit({ entityType: 'Buyer', entityId: buyer._id, action: 'UPDATE', user: req.user });
  res.json({ success: true, data: buyer });
});

// Lists Buyer Inquiries (BuyerEnquiry records) across all buyers, for the
// dedicated Buyer Inquiry management page - getBuyer() above already
// returns a single buyer's enquiries inline for their profile page.
const listEnquiries = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.buyer) filter.buyer = req.query.buyer;
  if (req.query.item) filter.item = req.query.item;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.search) {
    filter.$or = [
      { buyerName: new RegExp(req.query.search, 'i') },
      { companyName: new RegExp(req.query.search, 'i') },
      { phone: new RegExp(req.query.search, 'i') },
      { email: new RegExp(req.query.search, 'i') },
      { productName: new RegExp(req.query.search, 'i') },
      { productId: new RegExp(req.query.search, 'i') },
    ];
  }

  const [enquiries, total] = await Promise.all([
    BuyerEnquiry.find(filter)
      .populate('buyer', 'buyerId name businessName phone email')
      .populate('item', 'itemId name sku category estimatedResaleValue mrp hrMartPrice status')
      .populate('convertedToBuyer', 'buyerId name businessName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    BuyerEnquiry.countDocuments(filter),
  ]);
  res.json({ success: true, ...buildPaginatedResult(enquiries, total, page, limit) });
});

const getEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await BuyerEnquiry.findById(req.params.id)
    .populate('buyer', 'buyerId name businessName phone email')
    .populate('item', 'itemId name sku category estimatedResaleValue mrp hrMartPrice status')
    .populate('convertedToBuyer', 'buyerId name businessName')
    .populate('negotiationHistory.by', 'name role');
  if (!enquiry) throw ApiError.notFound('Enquiry not found');
  res.json({ success: true, data: enquiry });
});

const updateEnquiryStatus = asyncHandler(async (req, res) => {
  const enquiry = await BuyerEnquiry.findById(req.params.id);
  if (!enquiry) throw ApiError.notFound('Enquiry not found');
  const { status } = req.body;
  if (!BUYER_ENQUIRY_STATUS.includes(status)) {
    throw ApiError.badRequest('Invalid status');
  }
  enquiry.status = status;
  await enquiry.save();
  await recordAudit({ entityType: 'BuyerEnquiry', entityId: enquiry._id, action: 'STATUS_CHANGE', user: req.user, toValue: status });
  res.json({ success: true, data: enquiry });
});

// All buyer and product details are entered manually - no existing Buyer or
// Item record is required. `buyer`/`item` are only set if the caller
// explicitly supplies one (e.g. picked from a dropdown as a convenience).
const createEnquiry = asyncHandler(async (req, res) => {
  const { proposedPrice, note, ...rest } = req.body;
  const payload = { ...rest, createdBy: req.user._id };
  if (!payload.buyer) delete payload.buyer;
  if (!payload.item) delete payload.item;
  if (proposedPrice !== undefined && proposedPrice !== '') {
    payload.negotiationHistory = [{ proposedPrice, note, by: req.user._id }];
  }
  const enquiry = await BuyerEnquiry.create(payload);
  await recordAudit({ entityType: 'BuyerEnquiry', entityId: enquiry._id, action: 'CREATE', user: req.user });
  res.status(201).json({ success: true, data: enquiry });
});

// Full edit of a buyer inquiry's manually entered fields. Only fields
// present in the request body are touched, so anything left out (e.g. a
// manually entered mrp the user didn't change) is preserved untouched.
const updateEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await BuyerEnquiry.findById(req.params.id);
  if (!enquiry) throw ApiError.notFound('Enquiry not found');

  const immutable = ['convertedToBuyer', 'convertedAt', 'negotiationHistory', 'createdBy'];
  for (const key of Object.keys(req.body)) {
    if (!immutable.includes(key)) enquiry[key] = req.body[key];
  }
  enquiry.updatedBy = req.user._id;
  await enquiry.save();

  await recordAudit({ entityType: 'BuyerEnquiry', entityId: enquiry._id, action: 'UPDATE', user: req.user });
  res.json({ success: true, data: enquiry });
});

const addNegotiation = asyncHandler(async (req, res) => {
  const enquiry = await BuyerEnquiry.findById(req.params.id);
  if (!enquiry) throw ApiError.notFound('Enquiry not found');
  const { proposedPrice, note } = req.body;
  if (proposedPrice === undefined) throw ApiError.badRequest('proposedPrice is required');
  enquiry.negotiationHistory.push({ proposedPrice, note, by: req.user._id });
  enquiry.status = 'Negotiating';
  await enquiry.save();
  res.json({ success: true, data: enquiry });
});

// Converts a buyer inquiry's manually entered contact details into a full
// Buyer record - explicit and opt-in, so no duplicate Buyer is ever
// created automatically just because a name was typed into the form.
const convertToBuyer = asyncHandler(async (req, res) => {
  const enquiry = await BuyerEnquiry.findById(req.params.id);
  if (!enquiry) throw ApiError.notFound('Enquiry not found');
  if (enquiry.convertedToBuyer) {
    throw ApiError.conflict('This inquiry has already been converted to a buyer');
  }

  const buyerId = await generateBuyerId();
  const buyer = await Buyer.create({
    buyerId,
    name: enquiry.buyerName,
    businessName: enquiry.companyName,
    phone: enquiry.phone,
    email: enquiry.email,
    address: enquiry.address,
    createdBy: req.user._id,
  });

  enquiry.convertedToBuyer = buyer._id;
  enquiry.buyer = buyer._id;
  enquiry.convertedAt = new Date();
  enquiry.status = 'Converted';
  await enquiry.save();

  await recordAudit({ entityType: 'BuyerEnquiry', entityId: enquiry._id, action: 'CONVERT_TO_BUYER', user: req.user, toValue: { buyerId } });
  res.status(201).json({ success: true, data: { enquiry, buyer } });
});

module.exports = {
  listBuyers,
  createBuyer,
  getBuyer,
  updateBuyer,
  listEnquiries,
  getEnquiry,
  updateEnquiryStatus,
  createEnquiry,
  updateEnquiry,
  addNegotiation,
  convertToBuyer,
};
