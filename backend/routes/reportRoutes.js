const express = require('express');
const ctrl = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');
const { REPORT_ACCESS } = require('../config/constants');
const { limitReportPdfExport: pdfLimits } = require('../middleware/rateLimit');

const router = express.Router();
router.use(protect);

const canViewOperational = authorize(...REPORT_ACCESS.operational);
const canViewCosts = authorize(...REPORT_ACCESS.costs);
const canViewSales = authorize(...REPORT_ACCESS.sales);
const canViewFinance = authorize(...REPORT_ACCESS.finance);
const canViewAudit = authorize(...REPORT_ACCESS.audit);

router.get('/inventory', canViewOperational, pdfLimits(ctrl.currentInventory));
router.get('/inventory/owner-wise', canViewOperational, ctrl.ownerWiseInventory);
router.get('/cost-sheet', canViewCosts, pdfLimits(ctrl.costSheetReport));
router.get('/expenses', canViewCosts, pdfLimits(ctrl.expenseReport));
router.get('/refurbishment', canViewOperational, pdfLimits(ctrl.refurbishmentReport));
router.get('/sales', canViewSales, pdfLimits(ctrl.salesReport));
router.get('/pending-approvals', canViewOperational, pdfLimits(ctrl.pendingApprovalsReport));
router.get('/outstanding-payments', canViewFinance, pdfLimits(ctrl.paymentOutstandingReport));
router.get('/settlements', canViewFinance, pdfLimits(ctrl.settlementReport));
router.get('/dispatch', canViewOperational, pdfLimits(ctrl.dispatchReport));
router.get('/audit', canViewAudit, pdfLimits(ctrl.auditReport));

module.exports = router;
