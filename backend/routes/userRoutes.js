const express = require('express');
const ctrl = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { registerValidator } = require('../validators/authValidators');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(protect, authorize(ROLES.ADMIN));

router.get('/', ctrl.listUsers);
router.post('/', registerValidator, validate, ctrl.createUser);
router.get('/:id', ctrl.getUser);
router.put('/:id', ctrl.updateUser);
router.post('/:id/reset-password', ctrl.resetUserPassword);
router.post('/:id/deactivate', ctrl.deactivateUser);

module.exports = router;
