const Dispatch = require('../models/Dispatch');
const SaleProposal = require('../models/SaleProposal');
const Item = require('../models/Item');
const Buyer = require('../models/Buyer');
const Expense = require('../models/Expense');
const Settings = require('../models/Settings');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recordAudit } = require('../utils/audit');
const { generateYearlyId } = require('../utils/idGenerator');
const { mapUploadedFiles } = require('../utils/fileMapper');
const { generateDispatchNotePdf } = require('../services/pdfService');
const { events } = require('../services/notificationService');

const listDispatches = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const dispatches = await Dispatch.find(filter)
    .populate('item', 'itemId name status')
    .populate('buyer', 'buyerId name businessName')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: dispatches });
});

const getDispatch = asyncHandler(async (req, res) => {
  const dispatch = await Dispatch.findById(req.params.id).populate('item').populate('buyer').populate('saleProposal');
  if (!dispatch) throw ApiError.notFound('Dispatch not found');
  res.json({ success: true, data: dispatch });
});

// A dispatch can only be requested once the sale has actually been invoiced
// (proposal.status === 'Converted'), which itself was only reachable after
// owner approval - this is the "block dispatch until approval" rule.
const createDispatch = asyncHandler(async (req, res) => {
  const proposal = await SaleProposal.findById(req.body.saleProposal).populate('item').populate('buyer');
  if (!proposal) throw ApiError.badRequest('Invalid sale proposal');
  if (proposal.status !== 'Converted') {
    throw ApiError.forbidden(`Dispatch cannot be created until the sale is approved and invoiced (current status: '${proposal.status}')`);
  }

  const existing = await Dispatch.findOne({ saleProposal: proposal._id });
  if (existing) {
    return res.status(200).json({ success: true, data: existing, message: 'A dispatch already exists for this sale' });
  }

  const settings = await Settings.getSettings();
  const dispatchNumber = await generateYearlyId(settings.dispatchNotePrefix, 'dispatch');

  const dispatch = await Dispatch.create({
    dispatchNumber,
    item: proposal.item._id,
    saleProposal: proposal._id,
    buyer: proposal.buyer._id,
    deliveryAddress: req.body.deliveryAddress,
    deliveryContactName: req.body.deliveryContactName,
    deliveryContactPhone: req.body.deliveryContactPhone,
    transporterName: req.body.transporterName,
    trackingReference: req.body.trackingReference,
    scheduledDate: req.body.scheduledDate,
    outboundLogisticsCost: req.body.outboundLogisticsCost || 0,
    createdBy: req.user._id,
  });

  const item = await Item.findById(proposal.item._id);
  if (item.status === 'Sold') {
    const from = item.status;
    item.status = 'Dispatch Pending';
    item.statusHistory.push({ from, to: 'Dispatch Pending', changedBy: req.user._id, changedByName: req.user.name, remarks: `Dispatch ${dispatchNumber} created` });
    await item.save();
  }

  await recordAudit({ entityType: 'Dispatch', entityId: dispatch._id, action: 'CREATE', user: req.user });
  res.status(201).json({ success: true, data: dispatch });
});

const updateDispatch = asyncHandler(async (req, res) => {
  const dispatch = await Dispatch.findById(req.params.id);
  if (!dispatch) throw ApiError.notFound('Dispatch not found');
  const { transporterName, trackingReference, scheduledDate, deliveryContactName, deliveryContactPhone, notes } = req.body;
  if (transporterName !== undefined) dispatch.transporterName = transporterName;
  if (trackingReference !== undefined) dispatch.trackingReference = trackingReference;
  if (scheduledDate !== undefined) dispatch.scheduledDate = scheduledDate;
  if (deliveryContactName !== undefined) dispatch.deliveryContactName = deliveryContactName;
  if (deliveryContactPhone !== undefined) dispatch.deliveryContactPhone = deliveryContactPhone;
  if (notes !== undefined) dispatch.notes = notes;
  await dispatch.save();
  res.json({ success: true, data: dispatch });
});

// Marks the item as physically dispatched - logs the outbound logistics
// cost as an Expense so it feeds the item's cost sheet, and advances the
// item lifecycle status.
const markDispatched = asyncHandler(async (req, res) => {
  const dispatch = await Dispatch.findById(req.params.id);
  if (!dispatch) throw ApiError.notFound('Dispatch not found');
  if (dispatch.status !== 'Pending' && dispatch.status !== 'Scheduled') {
    throw ApiError.conflict(`Cannot mark dispatched from status '${dispatch.status}'`);
  }

  dispatch.status = 'Dispatched';
  dispatch.dispatchedDate = new Date();
  if (req.body.outboundLogisticsCost !== undefined) dispatch.outboundLogisticsCost = req.body.outboundLogisticsCost;
  if (req.body.transporterName) dispatch.transporterName = req.body.transporterName;
  if (req.body.trackingReference) dispatch.trackingReference = req.body.trackingReference;
  await dispatch.save();

  if (dispatch.outboundLogisticsCost > 0) {
    await Expense.create({
      item: dispatch.item,
      category: 'Outbound Logistics',
      amount: dispatch.outboundLogisticsCost,
      date: dispatch.dispatchedDate,
      vendor: dispatch.transporterName,
      notes: `Dispatch ${dispatch.dispatchNumber}`,
      dedupeKey: `dispatch:${dispatch._id}`,
      createdBy: req.user._id,
    });
  }

  const item = await Item.findById(dispatch.item).populate('owner');
  const from = item.status;
  item.status = 'Dispatched';
  item.dispatchedDate = dispatch.dispatchedDate;
  item.statusHistory.push({ from, to: 'Dispatched', changedBy: req.user._id, changedByName: req.user.name, remarks: `Dispatch ${dispatch.dispatchNumber}` });
  await item.save();

  const buyer = await Buyer.findById(dispatch.buyer);
  events.dispatchScheduled(dispatch, buyer).catch(() => {});

  await recordAudit({ entityType: 'Dispatch', entityId: dispatch._id, action: 'DISPATCHED', user: req.user });
  res.json({ success: true, data: dispatch });
});

const addDeliveryProof = asyncHandler(async (req, res) => {
  const dispatch = await Dispatch.findById(req.params.id);
  if (!dispatch) throw ApiError.notFound('Dispatch not found');
  if (!req.files || req.files.length === 0) throw ApiError.badRequest('No files uploaded');
  dispatch.deliveryProof.push(...mapUploadedFiles(req.files, req.user._id, 'Delivery proof'));
  await dispatch.save();
  res.status(201).json({ success: true, data: dispatch });
});

// Final confirmation of delivery closes the item lifecycle.
const confirmDelivery = asyncHandler(async (req, res) => {
  const dispatch = await Dispatch.findById(req.params.id);
  if (!dispatch) throw ApiError.notFound('Dispatch not found');
  if (dispatch.status !== 'Dispatched') {
    throw ApiError.conflict(`Delivery can only be confirmed once the item has been dispatched (current status: '${dispatch.status}')`);
  }

  dispatch.status = 'Delivered';
  dispatch.deliveredDate = new Date();
  dispatch.deliveryConfirmedBy = req.user._id;
  await dispatch.save();

  const item = await Item.findById(dispatch.item);
  const from = item.status;
  item.status = 'Closed';
  item.statusHistory.push({ from, to: 'Closed', changedBy: req.user._id, changedByName: req.user.name, remarks: `Delivery confirmed for dispatch ${dispatch.dispatchNumber}` });
  await item.save();

  dispatch.status = 'Closed';
  await dispatch.save();

  const buyer = await Buyer.findById(dispatch.buyer);
  events.deliveryConfirmed(dispatch, buyer).catch(() => {});

  await recordAudit({ entityType: 'Dispatch', entityId: dispatch._id, action: 'DELIVERY_CONFIRMED', user: req.user });
  res.json({ success: true, data: dispatch });
});

const downloadDispatchNote = asyncHandler(async (req, res) => {
  const dispatch = await Dispatch.findById(req.params.id).populate('item');
  if (!dispatch) throw ApiError.notFound('Dispatch not found');
  const settings = await Settings.getSettings();
  generateDispatchNotePdf(res, dispatch, dispatch.item, settings);
});

module.exports = {
  listDispatches,
  getDispatch,
  createDispatch,
  updateDispatch,
  markDispatched,
  addDeliveryProof,
  confirmDelivery,
  downloadDispatchNote,
};
