const express = require('express');
const ctrl = require('../controllers/authController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  loginLimiter,
  forgotPasswordIpLimiter,
  setupLimiter,
  signupLimiter,
  verifyEmailLimiter,
  resendVerificationLimiter,
} = require('../middleware/rateLimit');
const {
  loginValidator,
  registerValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  signupValidator,
  verifyEmailValidator,
  resendVerificationValidator,
} = require('../validators/authValidators');

const router = express.Router();

// Rate limits run first, so malformed requests are limited too.
router.post('/register', setupLimiter, registerValidator, validate, ctrl.register);
// Public sign-up (separate from /register, which only creates the first Admin).
router.post('/signup', signupLimiter, signupValidator, validate, ctrl.signup);
router.post('/verify-email', verifyEmailLimiter, verifyEmailValidator, validate, ctrl.verifyEmail);
router.post('/resend-verification', resendVerificationLimiter, resendVerificationValidator, validate, ctrl.resendVerification);
router.post('/login', loginLimiter, loginValidator, validate, ctrl.login);
router.post('/logout', protect, ctrl.logout);
router.get('/me', protect, ctrl.me);
router.post('/forgot-password', forgotPasswordIpLimiter, forgotPasswordValidator, validate, ctrl.forgotPassword);
router.post('/reset-password/:token', resetPasswordValidator, validate, ctrl.resetPassword);

module.exports = router;
