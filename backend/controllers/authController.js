const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { Counter } = require('../models/Counter');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recordAudit } = require('../utils/audit');
const { sendEmail } = require('../services/notificationService');

function signAccessToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
}

const REGISTRATION_CLOSED = 'Registration is closed. Ask an Admin to create your account.';

// One-time claim document in the counters collection; its unique _id means
// only one request can ever insert it.
const SETUP_CLAIM_ID = 'admin-bootstrap';

function setupTokenMatches(provided, expected) {
  // Hash both sides so the constant-time comparison always sees equal lengths.
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// Initial setup requires SETUP_TOKEN whenever it is configured. Without it,
// setup is only allowed in an explicitly development/test environment.
function assertSetupAllowed(req) {
  const expected = process.env.SETUP_TOKEN;
  if (expected) {
    const provided = req.body.setupToken;
    if (typeof provided !== 'string' || !setupTokenMatches(provided, expected)) {
      throw ApiError.forbidden('A valid setup token is required to create the first Admin account.');
    }
    return;
  }
  if (!['development', 'test'].includes(process.env.NODE_ENV)) {
    throw ApiError.forbidden('Initial setup is disabled. Set SETUP_TOKEN on the server to enable it.');
  }
}

// First-run bootstrap: if there are zero users in the system, allow creating
// the first Admin (with the setup token in production). After that, only an
// existing Admin can create more users (see userController.js).
const register = asyncHandler(async (req, res) => {
  if (await User.exists({})) throw ApiError.forbidden(REGISTRATION_CLOSED);
  assertSetupAllowed(req);

  // Claim the one-time setup slot. Concurrent requests race on the unique
  // _id, so exactly one succeeds; the random nonce identifies the owner.
  const nonce = crypto.randomInt(1, 2 ** 47);
  try {
    await Counter.create({ _id: SETUP_CLAIM_ID, seq: nonce });
  } catch (err) {
    if (err.code === 11000) throw ApiError.forbidden(REGISTRATION_CLOSED);
    throw err;
  }
  if (await User.exists({})) throw ApiError.forbidden(REGISTRATION_CLOSED);

  const { name, email, password } = req.body;
  let user;
  try {
    user = await User.create({ name, email, password, role: 'Admin' });
  } catch (err) {
    // Release only this request's own claim, and only while no user exists,
    // so a failed attempt can never reopen setup after an Admin was created.
    if (!(await User.exists({}))) await Counter.deleteOne({ _id: SETUP_CLAIM_ID, seq: nonce });
    throw err;
  }
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
  // so the flow can still be tested end-to-end - but only in an explicitly
  // non-production environment, since this endpoint is unauthenticated.
  if (emailResult.demo) {
    const demoAllowed = ['development', 'test'].includes(process.env.NODE_ENV);
    if (demoAllowed) {
      response.demoMode = true;
      response.demoResetUrl = resetUrl;
    } else {
      console.warn('Password reset requested but no email provider is configured; reset link was not delivered.');
    }
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
