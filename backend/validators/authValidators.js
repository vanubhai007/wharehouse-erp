const { body } = require('express-validator');
const { ALL_ROLES } = require('../config/constants');

const loginValidator = [
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const registerValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(ALL_ROLES).withMessage('Invalid role'),
];

const forgotPasswordValidator = [body('email').isEmail().withMessage('A valid email is required')];

const resetPasswordValidator = [
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

module.exports = { loginValidator, registerValidator, forgotPasswordValidator, resetPasswordValidator };
