const express = require('express');
const ctrl = require('../controllers/dispatchController');
const validate = require('../middleware/validate');
const { dispatchValidator } = require('../validators/dispatchValidators');
const { protect, authorize } = require('../middleware/auth');
const { upload, folder, requireCloudinary } = require('../middleware/upload');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

const canManage = authorize(ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SALES_MANAGER);

router.get('/', ctrl.listDispatches);
router.post('/', canManage, dispatchValidator, validate, ctrl.createDispatch);
router.get('/:id', ctrl.getDispatch);
router.put('/:id', canManage, ctrl.updateDispatch);
router.post('/:id/dispatch', canManage, ctrl.markDispatched);
router.post('/:id/confirm-delivery', canManage, ctrl.confirmDelivery);
router.get('/:id/pdf', ctrl.downloadDispatchNote);
router.post(
  '/:id/proof',
  canManage,
  requireCloudinary,
  (req, res, next) => folder('dispatch')(req, res, next),
  upload.array('files', 5),
  ctrl.addDeliveryProof
);

module.exports = router;
