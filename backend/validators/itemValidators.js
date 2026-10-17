const { body } = require('express-validator');

const itemValidator = [
  body('name').trim().notEmpty().withMessage('Item name is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('owner').notEmpty().withMessage('Owner/customer is required'),
  body('purchaseCost').isFloat({ min: 0 }).withMessage('Purchase cost must be a non-negative number'),
  body('trackingType').optional().isIn(['Serialized', 'Batch']),
  body('quantity').optional().isFloat({ min: 0 }),
  body('mrp').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('MRP must be a non-negative number'),
  body('hrMartPrice').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('HR Mart Price must be a non-negative number'),
];

const statusChangeValidator = [
  body('status').notEmpty().withMessage('Target status is required'),
];

module.exports = { itemValidator, statusChangeValidator };
