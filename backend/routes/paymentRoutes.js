const express = require('express');
const ctrl = require('../controllers/paymentController');
const validate = require('../middleware/validate');
const { paymentValidator } = require('../validators/paymentValidators');
const { protect, authorize } = require('../middleware/auth');
const { upload, folder, requireCloudinary } = require('../middleware/upload');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

const canManage = authorize(ROLES.ADMIN, ROLES.ACCOUNTS);

router.get('/', ctrl.listPayments);
router.post('/', canManage, paymentValidator, validate, ctrl.createPayment);
router.get('/:id/receipt', ctrl.downloadReceipt);
router.post(
  '/:id/proof',
  canManage,
  requireCloudinary,
  (req, res, next) => folder('payments')(req, res, next),
  upload.array('files', 5),
  ctrl.addProof
);

module.exports = router;
