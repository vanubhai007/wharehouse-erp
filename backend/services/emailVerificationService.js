const crypto = require('crypto');
const { sendEmail } = require('./notificationService');

// Six-digit email verification codes for public sign-up. Only an HMAC of the
// code (keyed with JWT_SECRET and bound to the user id) is stored, so a
// database leak does not reveal codes. Codes are never logged or returned by
// the API - they only appear in the email itself.
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS_PER_CODE = 5;
const MAX_CODES_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

const generateCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

function hashCode(userId, code) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`email-verification:${userId}:${code}`).digest('hex');
}

function codeMatches(storedHash, userId, code) {
  if (typeof storedHash !== 'string' || typeof code !== 'string') return false;
  const a = Buffer.from(storedHash, 'hex');
  const b = Buffer.from(hashCode(userId, code), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Prepares a new code for `user` (whose emailVerification was loaded) unless
// the resend cooldown or the hourly limit applies. Returns { code, fields }
// to store, or null when no code may be sent now. A new code replaces the old
// one and resets its attempt count.
function prepareCode(user, now = Date.now()) {
  const current = user.emailVerification || {};
  if (current.sentAt && now - current.sentAt.getTime() < RESEND_COOLDOWN_MS) return null;
  const windowOpen = current.windowStart && now - current.windowStart.getTime() < HOUR_MS;
  const sendCount = windowOpen ? current.sendCount || 0 : 0;
  if (sendCount >= MAX_CODES_PER_HOUR) return null;
  const code = generateCode();
  return {
    code,
    fields: {
      codeHash: hashCode(user._id, code),
      expiresAt: new Date(now + CODE_TTL_MS),
      attempts: 0,
      sentAt: new Date(now),
      windowStart: windowOpen ? current.windowStart : new Date(now),
      sendCount: sendCount + 1,
    },
  };
}

// Sends the code without waiting for the mail server, so the response time
// does not depend on whether an email was sent (no account enumeration).
// Failures are logged without the code or the address.
function sendCodeEmail(user, code) {
  sendEmail({
    to: user.email,
    subject: 'HR Warehouse - Your verification code',
    html: `<p>Your HR Warehouse verification code is:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>
<p>It expires in 10 minutes. If you did not create an HR Warehouse account, you can ignore this email.</p>`,
  }).catch((err) => console.error(`Verification email for user ${user._id} could not be sent: ${err.message}`));
}

module.exports = {
  CODE_TTL_MS,
  RESEND_COOLDOWN_MS,
  MAX_ATTEMPTS_PER_CODE,
  MAX_CODES_PER_HOUR,
  hashCode,
  codeMatches,
  prepareCode,
  sendCodeEmail,
};
