const express = require('express');
const ctrl = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');
const { REPORT_ACCESS } = require('../config/constants');

const router = express.Router();
router.use(protect);

const canViewOperational = authorize(...REPORT_ACCESS.operational);
const canViewCosts = authorize(...REPORT_ACCESS.costs);
const canViewSales = authorize(...REPORT_ACCESS.sales);
const canViewFinance = authorize(...REPORT_ACCESS.finance);
const canViewAudit = authorize(...REPORT_ACCESS.audit);

router.get('/inventory', canViewOperational, ctrl.currentInventory);
router.get('/inventory/owner-wise', canViewOperational, ctrl.ownerWiseInventory);
router.get('/cost-sheet', canViewCosts, ctrl.costSheetReport);
router.get('/expenses', canViewCosts, ctrl.expenseReport);
router.get('/refurbishment', canViewOperational, ctrl.refurbishmentReport);
router.get('/sales', canViewSales, ctrl.salesReport);
router.get('/pending-approvals', canViewOperational, ctrl.pendingApprovalsReport);
router.get('/outstanding-payments', canViewFinance, ctrl.paymentOutstandingReport);
router.get('/settlements', canViewFinance, ctrl.settlementReport);
router.get('/dispatch', canViewOperational, ctrl.dispatchReport);
router.get('/audit', canViewAudit, ctrl.auditReport);

module.exports = router;
