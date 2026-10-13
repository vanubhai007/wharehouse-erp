const mongoose = require('mongoose');

// Each approval request/decision cycle for a sale proposal. A proposal can
// be resubmitted after rejection, producing a new Approval document each
// time - decisions are never edited, only appended, giving an immutable
// audit trail (reinforced by AuditLog entries written alongside).
const approvalSchema = new mongoose.Schema(
  {
    saleProposal: { type: mongoose.Schema.Types.ObjectId, ref: 'SaleProposal', required: true, index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requestedAt: { type: Date, default: Date.now },
    decision: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedByName: { type: String },
    decidedAt: { type: Date },
    remarks: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Approval', approvalSchema);
