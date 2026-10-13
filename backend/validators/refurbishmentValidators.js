const { body } = require('express-validator');

const refurbishmentValidator = [
  body('item').notEmpty().withMessage('Item is required'),
  body('workDescription').trim().notEmpty().withMessage('Work description is required'),
  body('assignedTo').trim().notEmpty().withMessage('Assigned staff/vendor is required'),
  body('startDate').notEmpty().withMessage('Start date is required'),
];

module.exports = { refurbishmentValidator };
