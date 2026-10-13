const express = require('express');
const ctrl = require('../controllers/settlementController');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

const canManage = authorize(ROLES.ADMIN, ROLES.ACCOUNTS);

router.get('/', ctrl.listSettlements);
router.post('/', canManage, ctrl.createSettlement);
router.post('/:id/settle', canManage, ctrl.markSettled);

module.exports = router;
