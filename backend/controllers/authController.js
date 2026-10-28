const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { Counter } = require('../models/Counter');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recordAudit } = require('../utils/audit');
const notifications = require('../services/notificationService');
const { passwordFingerprint, fingerprintMatches } = require('../utils/passwordFingerprint');
const { allowResetEmail } = require('../middleware/rateLimit');
const { signInBlock } = require('../utils/accountStatus');
const verification = require('../services/emailVerificationService');
const { ROLES } = require('../config/constants');

const { sendEmail } = notifications;

// `user` must have its password hash loaded. The pwv claim ties the token to
// the current password, so changing or resetting it invalidates the token.
function signAccessToken(user) {
  const pwv = passwordFingerprint(user.password, 'access');
  return jwt.sign({ id: user._id, role: user.role, pwv }, process.env.JWT_SECRET, {
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
  // Checked only after the password, so it reveals nothing about other accounts.
  const blocked = signInBlock(user);
  if (blocked) throw new ApiError(403, blocked.message, { code: blocked.code });
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

const RESET_LINK_SENT = 'If that account exists, a reset link has been sent.';

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  // Per-email limit, checked before any lookup and counted the same way for
  // registered and unknown addresses: when exceeded, nothing is sent but the
  // response is identical, so it reveals nothing about which accounts exist.
  if (!allowResetEmail(email)) {
    return res.json({ success: true, message: RESET_LINK_SENT });
  }
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  // Always respond success to avoid leaking which emails are registered.
  if (!user) {
    return res.json({ success: true, message: RESET_LINK_SENT });
  }
  // pwv makes the link single-use: once the password changes, this link (and
  // every other link issued before the change) no longer matches.
  const pwv = passwordFingerprint(user.password, 'reset');
  const resetToken = jwt.sign({ id: user._id, purpose: 'reset', pwv }, process.env.JWT_RESET_SECRET, {
    expiresIn: process.env.JWT_RESET_EXPIRES_IN || '15m',
  });
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  const emailResult = await sendEmail({
    to: user.email,
    subject: 'HR Warehouse - Password Reset',
    html: `<p>Reset your password using the link below (valid for 15 minutes):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  });
  await recordAudit({ entityType: 'User', entityId: user._id, action: 'PASSWORD_RESET_REQUESTED', user });

  const response = { success: true, message: RESET_LINK_SENT };
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

  const user = await User.findById(payload.id).select('+password');
  if (!user || !fingerprintMatches(payload.pwv, user.password, 'reset')) {
    throw ApiError.badRequest('Reset link is invalid or has expired');
  }

  user.password = password;
  await user.save();
  await recordAudit({ entityType: 'User', entityId: user._id, action: 'PASSWORD_RESET_COMPLETED', user });

  res.json({ success: true, message: 'Password has been reset. You can now log in.' });
});

// ---------------------------------------------------------------------------
// Public sign-up with email verification. A new account starts unverified and
// pending approval, with a placeholder role it can never use: it cannot sign
// in until the emailed code is verified AND an Admin approves it and chooses
// its role (userController.approveUser). Responses never reveal whether an
// email address is registered, and codes never appear in responses or logs.
// ---------------------------------------------------------------------------

// Stored until an Admin approves the account and picks the real role.
const PENDING_PLACEHOLDER_ROLE = ROLES.WAREHOUSE_STAFF;
const SIGNUP_UNAVAILABLE = 'Registration is temporarily unavailable. Please try again later.';
const SIGNUP_SENT = 'If this email address can be registered, we have sent a 6-digit verification code to it. Enter the code to verify your email.';
const RESEND_SENT = 'If a verification is pending for this email address, a new code has been sent. Codes expire after 10 minutes.';
const INVALID_CODE = 'That code is invalid or has expired. Check your latest email or request a new code.';
const COOLDOWN_SECONDS = verification.RESEND_COOLDOWN_MS / 1000;
// Compared against when no account matches, so every request does the same work.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

// Sign-up needs a working email provider (to deliver the code) and an Admin
// (to approve accounts - this also keeps first-Admin setup available).
async function assertSignupAvailable() {
  const adminExists = await User.exists({ role: ROLES.ADMIN, isActive: true, approvalStatus: { $nin: ['pending', 'rejected'] } });
  if (!notifications.emailConfigured || !adminExists) throw new ApiError(503, SIGNUP_UNAVAILABLE);
}

const signup = asyncHandler(async (req, res) => {
  await assertSignupAvailable();
  // Only these fields are read: role, isActive, approval and verification
  // fields in the request are ignored.
  const { name, email, password } = req.body;
  const respond = () => res.status(202).json({ success: true, message: SIGNUP_SENT, resendCooldownSeconds: COOLDOWN_SECONDS });

  const existing = await User.findOne({ email }).select('+password +emailVerification');
  if (existing && existing.emailVerified !== false) {
    // Already registered (verified, or an Admin-created user): change nothing
    // and send nothing, after the same password-hashing work as a new sign-up.
    await bcrypt.hash(password, 10);
    return respond();
  }

  let user = existing;
  if (user) {
    // An unfinished sign-up: the latest details win. Verifying still needs
    // the code from this inbox together with this password.
    user.name = name;
    user.password = password;
  } else {
    user = new User({ name, email, password, role: PENDING_PLACEHOLDER_ROLE, signupSource: 'public', emailVerified: false, approvalStatus: 'pending' });
  }
  const issued = verification.prepareCode(user);
  if (issued) user.emailVerification = issued.fields;
  try {
    await user.save();
  } catch (err) {
    if (err.code === 11000) return respond(); // a parallel sign-up for the same email won
    throw err;
  }
  if (!existing) await recordAudit({ entityType: 'User', entityId: user._id, action: 'SIGNUP', user, toValue: { signupSource: 'public' } });
  if (issued) verification.sendCodeEmail(user, issued.code);
  return respond();
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { email, code, password } = req.body;
  const user = await User.findOne({ email }).select('+password +emailVerification');
  const pending = user && user.emailVerified === false && user.emailVerification && user.emailVerification.codeHash;
  const passwordOk = await bcrypt.compare(password, pending ? user.password : DUMMY_PASSWORD_HASH);
  if (!pending) throw ApiError.badRequest(INVALID_CODE);

  const current = user.emailVerification;
  if (current.expiresAt.getTime() <= Date.now()) throw ApiError.badRequest(INVALID_CODE);
  // Take one attempt atomically before checking, so parallel guesses cannot
  // exceed the limit; a used or replaced code no longer matches the filter.
  const attempt = await User.updateOne(
    { _id: user._id, emailVerified: false, 'emailVerification.codeHash': current.codeHash, 'emailVerification.attempts': { $lt: verification.MAX_ATTEMPTS_PER_CODE } },
    { $inc: { 'emailVerification.attempts': 1 } }
  );
  if (attempt.modifiedCount !== 1 || !passwordOk || !verification.codeMatches(current.codeHash, user._id, code)) {
    throw ApiError.badRequest(INVALID_CODE);
  }
  // Single use: only the request that clears this exact code succeeds.
  const done = await User.updateOne(
    { _id: user._id, emailVerified: false, 'emailVerification.codeHash': current.codeHash },
    { $set: { emailVerified: true }, $unset: { emailVerification: 1 } }
  );
  if (done.modifiedCount !== 1) throw ApiError.badRequest(INVALID_CODE);
  await recordAudit({ entityType: 'User', entityId: user._id, action: 'EMAIL_VERIFIED', user });
  res.json({ success: true, message: 'Your email is verified. An administrator will review your registration - you can sign in once it is approved.' });
});

const resendVerification = asyncHandler(async (req, res) => {
  await assertSignupAvailable();
  const user = await User.findOne({ email: req.body.email }).select('+emailVerification');
  if (user && user.emailVerified === false) {
    const issued = verification.prepareCode(user);
    if (issued) {
      // Only if no other request issued a code in the meantime.
      const previousSentAt = user.emailVerification ? user.emailVerification.sentAt : undefined;
      const updated = await User.updateOne(
        { _id: user._id, emailVerified: false, 'emailVerification.sentAt': previousSentAt === undefined ? { $exists: false } : previousSentAt },
        { $set: { emailVerification: issued.fields } }
      );
      if (updated.modifiedCount === 1) verification.sendCodeEmail(user, issued.code);
    }
  }
  res.json({ success: true, message: RESEND_SENT, resendCooldownSeconds: COOLDOWN_SECONDS });
});

module.exports = { register, login, logout, me, forgotPassword, resetPassword, signup, verifyEmail, resendVerification };
