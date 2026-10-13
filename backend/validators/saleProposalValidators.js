const { body } = require('express-validator');

const saleProposalValidator = [
  body('item').notEmpty().withMessage('Item is required'),
  body('buyer').notEmpty().withMessage('Buyer is required'),
  body('proposedPrice').isFloat({ gt: 0 }).withMessage('Proposed price must be greater than 0'),
  body('discountAmount').optional().isFloat({ min: 0 }),
  body('gstPercent').optional().isFloat({ min: 0 }),
];

module.exports = { saleProposalValidator };
