const Buyer = require('../models/Buyer');
const BuyerEnquiry = require('../models/BuyerEnquiry');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recordAudit } = require('../utils/audit');
const { generateBuyerId } = require('../utils/idGenerator');
const { getPagination, buildPaginatedResult } = require('../utils/paginate');

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

  const [enquiries, total] = await Promise.all([
    BuyerEnquiry.find(filter)
      .populate('buyer', 'buyerId name businessName phone email')
      .populate('item', 'itemId name sku category estimatedResaleValue mrp hrMartPrice status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    BuyerEnquiry.countDocuments(filter),
  ]);
  res.json({ success: true, ...buildPaginatedResult(enquiries, total, page, limit) });
});

const updateEnquiryStatus = asyncHandler(async (req, res) => {
  const enquiry = await BuyerEnquiry.findById(req.params.id);
  if (!enquiry) throw ApiError.notFound('Enquiry not found');
  const { status } = req.body;
  if (!['Open', 'Negotiating', 'Converted', 'Closed'].includes(status)) {
    throw ApiError.badRequest('Invalid status');
  }
  enquiry.status = status;
  await enquiry.save();
  await recordAudit({ entityType: 'BuyerEnquiry', entityId: enquiry._id, action: 'STATUS_CHANGE', user: req.user, toValue: status });
  res.json({ success: true, data: enquiry });
});

const createEnquiry = asyncHandler(async (req, res) => {
  const { buyer, item, proposedPrice, note } = req.body;
  const enquiry = await BuyerEnquiry.create({
    buyer,
    item,
    negotiationHistory: proposedPrice ? [{ proposedPrice, note, by: req.user._id }] : [],
    createdBy: req.user._id,
  });
  res.status(201).json({ success: true, data: enquiry });
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

module.exports = {
  listBuyers,
  createBuyer,
  getBuyer,
  updateBuyer,
  listEnquiries,
  updateEnquiryStatus,
  createEnquiry,
  addNegotiation,
};
