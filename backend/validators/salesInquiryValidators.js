const { body } = require('express-validator');
const { SALES_INQUIRY_SOURCE, SALES_INQUIRY_STATUS, INQUIRY_PRIORITY } = require('../config/constants');

const salesInquiryValidator = [
  body('contactName').trim().notEmpty().withMessage('Contact name is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email'),
  body('source').optional().isIn(SALES_INQUIRY_SOURCE).withMessage('Invalid source'),
  body('priority').optional().isIn(INQUIRY_PRIORITY).withMessage('Invalid priority'),
  body('items').optional().isArray().withMessage('Items must be an array'),
  body('items.*.item').optional().notEmpty().withMessage('Each item entry requires an item id'),
];

const statusUpdateValidator = [
  body('status').isIn(SALES_INQUIRY_STATUS).withMessage('Invalid status'),
];

module.exports = { salesInquiryValidator, statusUpdateValidator };
