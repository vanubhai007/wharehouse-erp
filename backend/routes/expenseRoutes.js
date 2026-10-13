const express = require('express');
const ctrl = require('../controllers/expenseController');
const validate = require('../middleware/validate');
const { expenseValidator } = require('../validators/expenseValidators');
const { protect, authorize } = require('../middleware/auth');
const { upload, folder, requireCloudinary } = require('../middleware/upload');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

const canManage = authorize(ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.ACCOUNTS);

router.get('/', ctrl.listExpenses);
router.post('/', canManage, expenseValidator, validate, ctrl.createExpense);
router.put('/:id', canManage, ctrl.updateExpense);
router.delete('/:id', canManage, ctrl.deleteExpense);
router.post(
  '/:id/receipts',
  canManage,
  requireCloudinary,
  (req, res, next) => folder('expenses')(req, res, next),
  upload.array('files', 5),
  ctrl.addReceipts
);

module.exports = router;
