const { body } = require('express-validator');
const { CUSTOMER_TYPES } = require('../config/constants');

const customerValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email'),
  body('customerType').optional().isIn(CUSTOMER_TYPES).withMessage('Invalid customer type'),
];

module.exports = { customerValidator };
