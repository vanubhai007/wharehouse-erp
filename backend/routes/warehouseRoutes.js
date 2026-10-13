const express = require('express');
const ctrl = require('../controllers/warehouseController');
const validate = require('../middleware/validate');
const { locationValidator } = require('../validators/warehouseValidators');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

const canManage = authorize(ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER);

router.get('/locations', ctrl.listLocations);
router.post('/locations', canManage, locationValidator, validate, ctrl.createLocation);
router.put('/locations/:id', canManage, ctrl.updateLocation);
router.delete('/locations/:id', canManage, ctrl.deleteLocation);
router.get('/occupancy-map', ctrl.getOccupancyMap);
router.get('/rental-report', ctrl.getRentalReport);

module.exports = router;
