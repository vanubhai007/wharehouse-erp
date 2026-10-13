const mongoose = require('mongoose');

// Immutable audit trail for create/update/approval/payment/dispatch actions.
// Documents are never updated or deleted after insert.
const auditLogSchema = new mongoose.Schema(
  {
    entityType: { type: String, required: true, index: true }, // e.g. "Item", "SaleProposal"
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, required: true }, // e.g. "CREATE", "STATUS_CHANGE", "APPROVE", "PAYMENT"
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedByName: { type: String },
    fromValue: { type: mongoose.Schema.Types.Mixed },
    toValue: { type: mongoose.Schema.Types.Mixed },
    remarks: { type: String },
  },
  { timestamps: true }
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
