const { body } = require('express-validator');

const dispatchValidator = [
  body('saleProposal').notEmpty().withMessage('Sale proposal is required'),
  body('deliveryAddress').trim().notEmpty().withMessage('Delivery address is required'),
];

module.exports = { dispatchValidator };
