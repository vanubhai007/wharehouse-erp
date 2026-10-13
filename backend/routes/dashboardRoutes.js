const express = require('express');
const ctrl = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/', ctrl.getDashboard);

module.exports = router;
