const AuditLog = require('../models/AuditLog');

async function recordAudit({ entityType, entityId, action, user, fromValue, toValue, remarks }) {
  await AuditLog.create({
    entityType,
    entityId,
    action,
    performedBy: user && user._id,
    performedByName: user && user.name,
    fromValue,
    toValue,
    remarks,
  });
}

module.exports = { recordAudit };
