const crypto = require('crypto');

// A short, keyed fingerprint of a user's current (bcrypt) password hash.
// It is embedded in access and reset tokens, so any change to the stored
// password - by any route - invalidates every token issued before it.
// Keyed with JWT_SECRET so the readable token payload reveals nothing usable
// about the hash, and labelled by purpose so an access-token fingerprint can
// never stand in for a reset-token one (or the reverse).
function passwordFingerprint(passwordHash, purpose) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${purpose}:${passwordHash}`)
    .digest()
    .subarray(0, 16)
    .toString('base64url');
}

// Constant-time check that a token's fingerprint matches the current hash.
function fingerprintMatches(provided, passwordHash, purpose) {
  if (typeof provided !== 'string' || typeof passwordHash !== 'string') return false;
  const expected = Buffer.from(passwordFingerprint(passwordHash, purpose));
  const actual = Buffer.from(provided);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = { passwordFingerprint, fingerprintMatches };
