const { body } = require('express-validator');
const { EXPENSE_CATEGORIES } = require('../config/constants');

const expenseValidator = [
  body('item').notEmpty().withMessage('Item is required'),
  body('category').isIn(EXPENSE_CATEGORIES).withMessage('Invalid expense category'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
  body('date').optional().isISO8601().withMessage('Invalid date'),
];

module.exports = { expenseValidator };
