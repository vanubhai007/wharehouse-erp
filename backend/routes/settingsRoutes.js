const express = require('express');
const ctrl = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

router.get('/', ctrl.getSettings);
router.put('/', authorize(ROLES.ADMIN), ctrl.updateSettings);

module.exports = router;
