const express = require('express');
const ctrl = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/inventory', ctrl.currentInventory);
router.get('/inventory/owner-wise', ctrl.ownerWiseInventory);
router.get('/cost-sheet', ctrl.costSheetReport);
router.get('/expenses', ctrl.expenseReport);
router.get('/refurbishment', ctrl.refurbishmentReport);
router.get('/sales', ctrl.salesReport);
router.get('/pending-approvals', ctrl.pendingApprovalsReport);
router.get('/outstanding-payments', ctrl.paymentOutstandingReport);
router.get('/settlements', ctrl.settlementReport);
router.get('/dispatch', ctrl.dispatchReport);
router.get('/audit', ctrl.auditReport);

module.exports = router;
