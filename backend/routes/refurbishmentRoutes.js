const express = require('express');
const ctrl = require('../controllers/refurbishmentController');
const validate = require('../middleware/validate');
const { refurbishmentValidator } = require('../validators/refurbishmentValidators');
const { protect, authorize } = require('../middleware/auth');
const { upload, folder, requireCloudinary } = require('../middleware/upload');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

const canManage = authorize(ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.WAREHOUSE_STAFF);

router.get('/', ctrl.listJobs);
router.post('/', canManage, refurbishmentValidator, validate, ctrl.createJob);
router.put('/:id', canManage, ctrl.updateJob);
router.post('/:id/complete', canManage, ctrl.completeJob);
router.post('/:id/approve', authorize(ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER), ctrl.approveJob);
router.post(
  '/:id/photos',
  canManage,
  requireCloudinary,
  (req, res, next) => folder('refurbishment')(req, res, next),
  upload.array('files', 10),
  ctrl.addPhotos
);

module.exports = router;
