const { body } = require('express-validator');
const { PAYMENT_DIRECTION } = require('../config/constants');

const paymentValidator = [
  body('direction').isIn(PAYMENT_DIRECTION).withMessage('Invalid payment direction'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
];

module.exports = { paymentValidator };
