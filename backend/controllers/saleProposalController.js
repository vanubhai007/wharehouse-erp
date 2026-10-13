const SaleProposal = require('../models/SaleProposal');
const Approval = require('../models/Approval');
const Item = require('../models/Item');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recordAudit } = require('../utils/audit');
const { generateYearlyId } = require('../utils/idGenerator');
const { getItemCostSheet } = require('../services/costService');
const { events } = require('../services/notificationService');

const listProposals = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.item) filter.item = req.query.item;
  if (req.query.buyer) filter.buyer = req.query.buyer;
  const proposals = await SaleProposal.find(filter)
    .populate('item', 'itemId name status owner estimatedResaleValue')
    .populate('buyer', 'buyerId name businessName')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: proposals });
});

const getProposal = asyncHandler(async (req, res) => {
  const proposal = await SaleProposal.findById(req.params.id)
    .populate('item')
    .populate('buyer');
  if (!proposal) throw ApiError.notFound('Sale proposal not found');
  const approvals = await Approval.find({ saleProposal: proposal._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: { proposal, approvals } });
});

// Creating a proposal snapshots the item's live cost sheet so margin is
// visible to the sales team before it goes for owner approval, and moves
// the item from "Available for Sale" to "Sale Proposed".
const createProposal = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.body.item).populate('owner');
  if (!item) throw ApiError.badRequest('Invalid item');
  if (item.status !== 'Available for Sale') {
    throw ApiError.conflict(`Item must be 'Available for Sale' to propose a sale (current status: '${item.status}')`);
  }

  const costSheet = await getItemCostSheet(item);
  const proposedPrice = req.body.proposedPrice;
  const discountAmount = req.body.discountAmount || 0;
  const netPrice = proposedPrice - discountAmount;
  const marginAmount = Math.round((netPrice - costSheet.totalCost) * 100) / 100;
  const marginPercent = netPrice > 0 ? Math.round((marginAmount / netPrice) * 10000) / 100 : 0;

  const proposalNumber = await generateYearlyId('SP-', 'saleProposal');
  const proposal = await SaleProposal.create({
    proposalNumber,
    item: item._id,
    buyer: req.body.buyer,
    proposedPrice,
    discountAmount,
    gstPercent: req.body.gstPercent || 0,
    costSnapshot: {
      baseCost: costSheet.baseCost,
      rental: costSheet.rental,
      refurbishment: costSheet.refurbishment,
      marketing: costSheet.marketing,
      logistics: costSheet.logistics,
      other: costSheet.other + costSheet.commission,
      totalCost: costSheet.totalCost,
    },
    marginAmount,
    marginPercent,
    status: 'Submitted',
    createdBy: req.user._id,
  });

  const from = item.status;
  item.status = 'Sale Proposed';
  item.statusHistory.push({ from, to: 'Sale Proposed', changedBy: req.user._id, changedByName: req.user.name, remarks: `Sale proposal ${proposalNumber} created` });
  await item.save();

  await recordAudit({ entityType: 'SaleProposal', entityId: proposal._id, action: 'CREATE', user: req.user, toValue: { proposalNumber, proposedPrice } });

  events.saleProposalCreated(proposal, item.owner).catch(() => {});

  res.status(201).json({ success: true, data: proposal });
});

// Submits the proposal for owner approval - creates a new Approval request
// and blocks the item from moving further until a decision is recorded.
const submitForApproval = asyncHandler(async (req, res) => {
  const proposal = await SaleProposal.findById(req.params.id).populate('item');
  if (!proposal) throw ApiError.notFound('Sale proposal not found');
  if (proposal.status !== 'Submitted') {
    throw ApiError.conflict(`Only a 'Submitted' proposal can be sent for approval (current status: '${proposal.status}')`);
  }

  const approval = await Approval.create({ saleProposal: proposal._id, requestedBy: req.user._id });

  proposal.status = 'Approval Pending';
  await proposal.save();

  const item = await Item.findById(proposal.item._id);
  const from = item.status;
  item.status = 'Approval Pending';
  item.statusHistory.push({ from, to: 'Approval Pending', changedBy: req.user._id, changedByName: req.user.name, remarks: `Submitted for owner approval (${proposal.proposalNumber})` });
  await item.save();

  await recordAudit({ entityType: 'SaleProposal', entityId: proposal._id, action: 'SUBMIT_FOR_APPROVAL', user: req.user });
  res.status(201).json({ success: true, data: { proposal, approval } });
});

const cancelProposal = asyncHandler(async (req, res) => {
  const proposal = await SaleProposal.findById(req.params.id).populate('item');
  if (!proposal) throw ApiError.notFound('Sale proposal not found');
  if (['Converted', 'Cancelled'].includes(proposal.status)) {
    throw ApiError.conflict(`Cannot cancel a proposal with status '${proposal.status}'`);
  }
  proposal.status = 'Cancelled';
  await proposal.save();

  const item = await Item.findById(proposal.item._id);
  if (!['Sold', 'Dispatch Pending', 'Dispatched', 'Closed'].includes(item.status)) {
    const from = item.status;
    item.status = 'Available for Sale';
    item.statusHistory.push({ from, to: 'Available for Sale', changedBy: req.user._id, changedByName: req.user.name, remarks: `Proposal ${proposal.proposalNumber} cancelled` });
    await item.save();
  }

  await recordAudit({ entityType: 'SaleProposal', entityId: proposal._id, action: 'CANCEL', user: req.user });
  res.json({ success: true, data: proposal });
});

module.exports = { listProposals, getProposal, createProposal, submitForApproval, cancelProposal };
