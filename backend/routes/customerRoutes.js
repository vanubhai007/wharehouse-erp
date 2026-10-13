const express = require('express');
const ctrl = require('../controllers/customerController');
const validate = require('../middleware/validate');
const { customerValidator } = require('../validators/customerValidators');
const { protect, authorize } = require('../middleware/auth');
const { upload, folder, requireCloudinary } = require('../middleware/upload');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(protect);

const canManage = authorize(ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.ACCOUNTS);

router.get('/', ctrl.listCustomers);
router.post('/', canManage, customerValidator, validate, ctrl.createCustomer);
router.get('/:id', ctrl.getCustomer);
router.get('/:id/profile', ctrl.getCustomerProfile);
router.put('/:id', canManage, customerValidator, validate, ctrl.updateCustomer);
router.post('/:id/active', canManage, ctrl.setActive);
router.post(
  '/:id/documents',
  canManage,
  requireCloudinary,
  (req, res, next) => folder('customers')(req, res, next),
  upload.array('files', 10),
  ctrl.addDocuments
);
router.delete('/:id/documents/:fileId', canManage, ctrl.removeDocument);

module.exports = router;
