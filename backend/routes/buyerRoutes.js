const express = require('express');
const ctrl = require('../controllers/buyerController');
const validate = require('../middleware/validate');
const { buyerValidator } = require('../validators/buyerValidators');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

const canManage = authorize(ROLES.ADMIN, ROLES.SALES_MANAGER);

router.get('/', ctrl.listBuyers);
router.post('/', canManage, buyerValidator, validate, ctrl.createBuyer);
router.get('/:id', ctrl.getBuyer);
router.put('/:id', canManage, buyerValidator, validate, ctrl.updateBuyer);
router.post('/enquiries', canManage, ctrl.createEnquiry);
router.post('/enquiries/:id/negotiate', canManage, ctrl.addNegotiation);

module.exports = router;
