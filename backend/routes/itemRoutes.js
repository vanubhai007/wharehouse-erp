const express = require('express');
const ctrl = require('../controllers/itemController');
const validate = require('../middleware/validate');
const { itemValidator, statusChangeValidator } = require('../validators/itemValidators');
const { protect, authorize } = require('../middleware/auth');
const { upload, folder, requireCloudinary } = require('../middleware/upload');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

const canManage = authorize(ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.WAREHOUSE_STAFF);

router.get('/', ctrl.listItems);
router.get('/export/csv', ctrl.exportCsv);
router.post('/', canManage, itemValidator, validate, ctrl.createItem);
router.get('/:id', ctrl.getItem);
router.put('/:id', canManage, ctrl.updateItem);
router.post('/:id/archive', canManage, ctrl.archiveItem);
router.post('/:id/status', canManage, statusChangeValidator, validate, ctrl.changeStatus);
router.post('/:id/move-location', canManage, ctrl.moveLocation);
router.get('/:id/cost-sheet', ctrl.getCostSheet);
router.get('/:id/history', ctrl.getHistory);
router.post(
  '/:id/media',
  canManage,
  requireCloudinary,
  (req, res, next) => folder('items')(req, res, next),
  upload.array('files', 10),
  ctrl.addMedia
);
router.delete('/:id/media/:fileId', canManage, ctrl.removeMedia);

module.exports = router;
