const express = require('express');
const ctrl = require('../controllers/invoiceController');
const validate = require('../middleware/validate');
const { invoiceFromProposalValidator, quotationValidator } = require('../validators/invoiceValidators');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

const canManage = authorize(ROLES.ADMIN, ROLES.ACCOUNTS, ROLES.SALES_MANAGER);

router.get('/', ctrl.listInvoices);
router.post('/from-proposal', canManage, invoiceFromProposalValidator, validate, ctrl.createInvoiceFromProposal);
router.post('/quotation', canManage, quotationValidator, validate, ctrl.createQuotation);
router.get('/:id', ctrl.getInvoice);
router.get('/:id/pdf', ctrl.downloadPdf);

module.exports = router;
