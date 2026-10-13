const { ITEM_STATUS, ITEM_STATUS_TRANSITIONS, ROLES } = require('../config/constants');

// Pure function (no DB access) so the lifecycle rules can be unit tested in
// isolation. Admin/Warehouse Manager may additionally move an item back
// exactly one step, to correct a mistake.
function isTransitionAllowed(currentStatus, targetStatus, role) {
  if (!ITEM_STATUS.includes(targetStatus)) return false;
  const forwardAllowed = (ITEM_STATUS_TRANSITIONS[currentStatus] || []).includes(targetStatus);
  if (forwardAllowed) return true;

  const currentIndex = ITEM_STATUS.indexOf(currentStatus);
  const targetIndex = ITEM_STATUS.indexOf(targetStatus);
  const isCorrectionRole = [ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER].includes(role);
  return isCorrectionRole && targetIndex === currentIndex - 1;
}

module.exports = { isTransitionAllowed };
