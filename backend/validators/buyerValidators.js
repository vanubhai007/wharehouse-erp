const { body } = require('express-validator');

const buyerValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email'),
];

module.exports = { buyerValidator };
