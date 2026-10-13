const { body } = require('express-validator');

const locationValidator = [
  body('code').trim().notEmpty().withMessage('Location code is required'),
  body('zone').trim().notEmpty().withMessage('Zone is required'),
  body('areaSqFt').isFloat({ gt: 0 }).withMessage('Area (sq ft) must be greater than 0'),
];

module.exports = { locationValidator };
