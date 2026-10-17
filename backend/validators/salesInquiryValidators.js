const { body } = require('express-validator');
const { SALES_INQUIRY_SOURCE, SALES_INQUIRY_STATUS, INQUIRY_PRIORITY } = require('../config/constants');

// All business/product fields are entered manually - productName is the
// only required product field (a product never needs to exist in
// Inventory). Prices are optional but, when given, must be valid numbers.
const salesInquiryValidator = [
  body('contactName').trim().notEmpty().withMessage('Contact name is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email'),
  body('address').optional({ checkFalsy: true }).isString(),
  body('productName').trim().notEmpty().withMessage('Product name / description is required'),
  body('productId').optional({ checkFalsy: true }).isString(),
  body('quantity').optional({ checkFalsy: true }).isFloat({ min: 0.01 }).withMessage('Quantity must be a positive number'),
  body('expectedPrice').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Expected price must be a non-negative number'),
  body('mrp').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('MRP must be a non-negative number'),
  body('hrMartPrice').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('HR Mart Price must be a non-negative number'),
  body('source').optional().isIn(SALES_INQUIRY_SOURCE).withMessage('Invalid source'),
  body('status').optional().isIn(SALES_INQUIRY_STATUS).withMessage('Invalid status'),
  body('priority').optional().isIn(INQUIRY_PRIORITY).withMessage('Invalid priority'),
];

const statusUpdateValidator = [
  body('status').isIn(SALES_INQUIRY_STATUS).withMessage('Invalid status'),
];

module.exports = { salesInquiryValidator, statusUpdateValidator };
