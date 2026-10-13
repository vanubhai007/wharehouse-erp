const express = require('express');
const ctrl = require('../controllers/saleProposalController');
const validate = require('../middleware/validate');
const { saleProposalValidator } = require('../validators/saleProposalValidators');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

const canManage = authorize(ROLES.ADMIN, ROLES.SALES_MANAGER);

router.get('/', ctrl.listProposals);
router.post('/', canManage, saleProposalValidator, validate, ctrl.createProposal);
router.get('/:id', ctrl.getProposal);
router.post('/:id/submit-for-approval', canManage, ctrl.submitForApproval);
router.post('/:id/cancel', canManage, ctrl.cancelProposal);

module.exports = router;
