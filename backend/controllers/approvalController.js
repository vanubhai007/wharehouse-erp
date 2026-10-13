const Approval = require('../models/Approval');
const SaleProposal = require('../models/SaleProposal');
const Item = require('../models/Item');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recordAudit } = require('../utils/audit');
const { APPROVAL_ROLES } = require('../config/constants');
const { events } = require('../services/notificationService');

const listPending = asyncHandler(async (req, res) => {
  const approvals = await Approval.find({ decision: 'Pending' })
    .populate({
      path: 'saleProposal',
      populate: [
        { path: 'item', select: 'itemId name owner', populate: { path: 'owner', select: 'customerId name businessName email phone' } },
        { path: 'buyer', select: 'buyerId name businessName' },
      ],
    })
    .sort({ createdAt: -1 });
  res.json({ success: true, data: approvals });
});

const listAll = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.decision) filter.decision = req.query.decision;
  const approvals = await Approval.find(filter).populate('saleProposal').sort({ createdAt: -1 });
  res.json({ success: true, data: approvals });
});

// Only an authorized approver (Owner/Approver or Admin) may record a
// decision. The decision is appended, never edited, giving an immutable
// audit trail alongside the global AuditLog entry.
const decide = asyncHandler(async (req, res) => {
  if (!APPROVAL_ROLES.includes(req.user.role)) {
    throw ApiError.forbidden('Only an Owner/Approver or Admin may approve or reject a sale proposal');
  }

  const approval = await Approval.findById(req.params.id).populate('saleProposal');
  if (!approval) throw ApiError.notFound('Approval request not found');
  if (approval.decision !== 'Pending') {
    throw ApiError.conflict(`This approval request has already been decided: '${approval.decision}'`);
  }

  const { decision, remarks } = req.body;
  if (!['Approved', 'Rejected'].includes(decision)) {
    throw ApiError.badRequest("Decision must be 'Approved' or 'Rejected'");
  }

  approval.decision = decision;
  approval.decidedBy = req.user._id;
  approval.decidedByName = req.user.name;
  approval.decidedAt = new Date();
  approval.remarks = remarks;
  await approval.save();

  const proposal = await SaleProposal.findById(approval.saleProposal._id);
  const item = await Item.findById(proposal.item).populate('owner');

  if (decision === 'Approved') {
    proposal.status = 'Approved';
    const from = item.status;
    item.status = 'Approved';
    item.statusHistory.push({ from, to: 'Approved', changedBy: req.user._id, changedByName: req.user.name, remarks });
  } else {
    proposal.status = 'Rejected';
    const from = item.status;
    item.status = 'Available for Sale';
    item.statusHistory.push({ from, to: 'Available for Sale', changedBy: req.user._id, changedByName: req.user.name, remarks: `Rejected: ${remarks || 'no remarks'}` });
  }
  await proposal.save();
  await item.save();

  await recordAudit({
    entityType: 'Approval',
    entityId: approval._id,
    action: 'DECIDE',
    user: req.user,
    toValue: { decision, remarks },
  });

  events.approvalDecision(proposal, item.owner).catch(() => {});

  res.json({ success: true, data: { approval, proposal } });
});

module.exports = { listPending, listAll, decide };
