const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recordAudit } = require('../utils/audit');
const { sendEmail } = require('../services/notificationService');

function signAccessToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
}

// First-run bootstrap: if there are zero users in the system, allow creating
// the first Admin without authentication. After that, only an existing
// Admin can create more users (see userController.js).
const register = asyncHandler(async (req, res) => {
  const existingUserCount = await User.countDocuments();
  if (existingUserCount > 0) {
    throw ApiError.forbidden('Registration is closed. Ask an Admin to create your account.');
  }
  const { name, email, password } = req.body;
  const user = await User.create({ name, email, password, role: 'Admin' });
  await recordAudit({ entityType: 'User', entityId: user._id, action: 'CREATE', user, toValue: { role: 'Admin', bootstrap: true } });
  const token = signAccessToken(user);
  res.status(201).json({ success: true, data: { user: user.toSafeJSON(), token } });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) {
    throw ApiError.forbidden('This account has been disabled. Contact an administrator.');
  }
  user.lastLoginAt = new Date();
  await user.save();
  const token = signAccessToken(user);
  res.json({ success: true, data: { user: user.toSafeJSON(), token } });
});

const logout = asyncHandler(async (req, res) => {
  // JWTs are stateless; the client discards the token. This endpoint exists
  // for a consistent API surface and future server-side session/blacklist support.
  res.json({ success: true, message: 'Logged out' });
});

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user.toSafeJSON() });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });
  // Always respond success to avoid leaking which emails are registered.
  if (!user) {
    return res.json({ success: true, message: 'If that account exists, a reset link has been sent.' });
  }
  const resetToken = jwt.sign({ id: user._id, purpose: 'reset' }, process.env.JWT_RESET_SECRET, {
    expiresIn: process.env.JWT_RESET_EXPIRES_IN || '15m',
  });
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  const emailResult = await sendEmail({
    to: user.email,
    subject: 'HR Warehouse - Password Reset',
    html: `<p>Reset your password using the link below (valid for 15 minutes):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  });
  await recordAudit({ entityType: 'User', entityId: user._id, action: 'PASSWORD_RESET_REQUESTED', user });

  const response = { success: true, message: 'If that account exists, a reset link has been sent.' };
  // Demo mode (no email provider configured): return the token/link directly
  // so the flow can still be tested end-to-end.
  if (emailResult.demo) {
    response.demoMode = true;
    response.demoResetUrl = resetUrl;
  }
  res.json(response);
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_RESET_SECRET);
  } catch (err) {
    throw ApiError.badRequest('Reset link is invalid or has expired');
  }
  if (payload.purpose !== 'reset') {
    throw ApiError.badRequest('Invalid reset token');
  }

  const user = await User.findById(payload.id);
  if (!user) throw ApiError.badRequest('Reset link is invalid or has expired');

  user.password = password;
  await user.save();
  await recordAudit({ entityType: 'User', entityId: user._id, action: 'PASSWORD_RESET_COMPLETED', user });

  res.json({ success: true, message: 'Password has been reset. You can now log in.' });
});

module.exports = { register, login, logout, me, forgotPassword, resetPassword };
