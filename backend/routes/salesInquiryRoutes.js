const express = require('express');
const ctrl = require('../controllers/salesInquiryController');
const validate = require('../middleware/validate');
const { salesInquiryValidator, statusUpdateValidator } = require('../validators/salesInquiryValidators');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

const canManage = authorize(ROLES.ADMIN, ROLES.SALES_MANAGER);

router.get('/', ctrl.listInquiries);
router.post('/', canManage, salesInquiryValidator, validate, ctrl.createInquiry);
router.get('/:id', ctrl.getInquiry);
router.put('/:id', canManage, salesInquiryValidator, validate, ctrl.updateInquiry);
router.post('/:id/status', canManage, statusUpdateValidator, validate, ctrl.updateStatus);
router.post('/:id/convert-to-buyer', canManage, ctrl.convertToBuyer);

module.exports = router;
