const Settlement = require('../models/Settlement');
const SaleProposal = require('../models/SaleProposal');
const Payment = require('../models/Payment');
const Settings = require('../models/Settings');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recordAudit } = require('../utils/audit');

const listSettlements = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.owner) filter.owner = req.query.owner;
  if (req.query.status) filter.status = req.query.status;
  const settlements = await Settlement.find(filter)
    .populate('item', 'itemId name')
    .populate('owner', 'customerId name businessName')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: settlements });
});

// Commission formula (CONFIRM WITH BUSINESS - safe default implemented):
//   commissionAmount = commissionType === 'percent'
//     ? salePrice * commissionRate / 100
//     : commissionRate (a flat fixed amount)
//   ownerPayable = salePrice - commissionAmount
// Commission is applied exactly once, on the final sale price recorded on
// the invoice/proposal - never combined with any other deduction here, and
// never recomputed after a settlement is created (one settlement per
// proposal, enforced by the unique index on SaleProposal.settlement).
const createSettlement = asyncHandler(async (req, res) => {
  const proposal = await SaleProposal.findById(req.body.saleProposal).populate('item');
  if (!proposal) throw ApiError.badRequest('Invalid sale proposal');
  if (proposal.status !== 'Converted') {
    throw ApiError.conflict(`Settlement can only be created once the sale is invoiced (current status: '${proposal.status}')`);
  }

  const existing = await Settlement.findOne({ saleProposal: proposal._id });
  if (existing) {
    return res.status(200).json({ success: true, data: existing, message: 'Settlement already exists for this sale' });
  }

  const settings = await Settings.getSettings();
  const commissionType = req.body.commissionType || settings.defaultCommissionType;
  const commissionRate = req.body.commissionRate !== undefined ? req.body.commissionRate : settings.defaultCommissionPercent;
  const salePrice = proposal.proposedPrice - proposal.discountAmount;

  const commissionAmount =
    commissionType === 'fixed' ? commissionRate : Math.round(((salePrice * commissionRate) / 100) * 100) / 100;
  const ownerPayable = Math.round((salePrice - commissionAmount) * 100) / 100;

  const settlement = await Settlement.create({
    saleProposal: proposal._id,
    item: proposal.item._id,
    owner: proposal.item.owner,
    salePrice,
    totalItemCost: proposal.costSnapshot.totalCost,
    commissionBasis: 'Sale Price',
    commissionType,
    commissionRate,
    commissionAmount,
    ownerPayable,
    createdBy: req.user._id,
  });

  await recordAudit({ entityType: 'Settlement', entityId: settlement._id, action: 'CREATE', user: req.user, toValue: { ownerPayable, commissionAmount } });
  res.status(201).json({ success: true, data: settlement });
});

// Marks a settlement as paid out to the owner and logs a Payable payment
// entry so it shows up in the owner's transaction history.
const markSettled = asyncHandler(async (req, res) => {
  const settlement = await Settlement.findById(req.params.id);
  if (!settlement) throw ApiError.notFound('Settlement not found');
  if (settlement.status === 'Settled') throw ApiError.conflict('This settlement has already been paid out');

  settlement.status = 'Settled';
  settlement.settledAt = new Date();
  settlement.settledBy = req.user._id;
  settlement.paymentReference = req.body.paymentReference;
  settlement.notes = req.body.notes;
  await settlement.save();

  await Payment.create({
    item: settlement.item,
    direction: 'Payable',
    amount: settlement.ownerPayable,
    mode: req.body.mode || 'Bank Transfer',
    referenceNumber: req.body.paymentReference,
    notes: `Settlement payout for sale proposal ${settlement.saleProposal}`,
    recordedBy: req.user._id,
  });

  await recordAudit({ entityType: 'Settlement', entityId: settlement._id, action: 'SETTLE', user: req.user });
  res.json({ success: true, data: settlement });
});

module.exports = { listSettlements, createSettlement, markSettled };
