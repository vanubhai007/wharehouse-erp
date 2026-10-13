const { body } = require('express-validator');

const invoiceFromProposalValidator = [
  body('saleProposal').notEmpty().withMessage('Sale proposal is required'),
  body('dueDate').optional().isISO8601(),
];

const quotationValidator = [
  body('item').notEmpty().withMessage('Item is required'),
  body('buyer').notEmpty().withMessage('Buyer is required'),
  body('unitPrice').isFloat({ gt: 0 }).withMessage('Unit price must be greater than 0'),
];

module.exports = { invoiceFromProposalValidator, quotationValidator };
