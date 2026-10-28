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

// Public sign-up / email verification. Emails are trimmed and lower-cased
// (the same form the User model stores) - no other rewriting, so the address
// that receives the code is exactly the one entered.
const signupEmail = () =>
  body('email').isString().withMessage('A valid email address is required').bail().trim().toLowerCase()
    .isLength({ max: 254 }).withMessage('Email address is too long').bail()
    .isEmail().withMessage('A valid email address is required');

const signupValidator = [
  body('name').isString().withMessage('Name is required').bail().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  signupEmail(),
  body('password').isString().withMessage('Password is required').bail().isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters'),
];

const verifyEmailValidator = [
  signupEmail(),
  body('code').isString().withMessage('Enter the 6-digit code').bail().trim().matches(/^\d{6}$/).withMessage('Enter the 6-digit code'),
  body('password').isString().withMessage('Password is required').bail().isLength({ min: 1, max: 128 }).withMessage('Password is required'),
];

const resendVerificationValidator = [signupEmail()];

module.exports = {
  loginValidator,
  registerValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  signupValidator,
  verifyEmailValidator,
  resendVerificationValidator,
};
