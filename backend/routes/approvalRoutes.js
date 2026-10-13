const express = require('express');
const ctrl = require('../controllers/approvalController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/pending', ctrl.listPending);
router.get('/', ctrl.listAll);
router.post('/:id/decide', ctrl.decide);

module.exports = router;
