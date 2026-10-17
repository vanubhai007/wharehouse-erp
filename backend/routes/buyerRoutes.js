const express = require('express');
const ctrl = require('../controllers/buyerController');
const validate = require('../middleware/validate');
const { buyerValidator } = require('../validators/buyerValidators');
const { buyerEnquiryValidator } = require('../validators/buyerEnquiryValidators');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

const canManage = authorize(ROLES.ADMIN, ROLES.SALES_MANAGER);

router.get('/', ctrl.listBuyers);
router.post('/', canManage, buyerValidator, validate, ctrl.createBuyer);

// Registered before '/:id' so "enquiries" is never matched as a buyer id.
router.get('/enquiries', ctrl.listEnquiries);
router.post('/enquiries', canManage, buyerEnquiryValidator, validate, ctrl.createEnquiry);
router.get('/enquiries/:id', ctrl.getEnquiry);
router.put('/enquiries/:id', canManage, buyerEnquiryValidator, validate, ctrl.updateEnquiry);
router.post('/enquiries/:id/negotiate', canManage, ctrl.addNegotiation);
router.post('/enquiries/:id/status', canManage, ctrl.updateEnquiryStatus);
router.post('/enquiries/:id/convert-to-buyer', canManage, ctrl.convertToBuyer);

router.get('/:id', ctrl.getBuyer);
router.put('/:id', canManage, buyerValidator, validate, ctrl.updateBuyer);

module.exports = router;
