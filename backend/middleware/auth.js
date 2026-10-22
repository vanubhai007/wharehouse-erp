const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const { fingerprintMatches } = require('../utils/passwordFingerprint');

// Verifies the JWT and attaches req.user (without password hash).
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('No authentication token provided');
  }
  const token = header.split(' ')[1];

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const user = await User.findById(payload.id);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('User account not found or disabled');
  }

  // The token must carry the fingerprint of the user's current password hash,
  // so tokens issued before a password change/reset (or without one) are
  // rejected. The hash is read separately so req.user never holds it.
  const credentials = await User.findById(payload.id).select('password').lean();
  if (!credentials || !fingerprintMatches(payload.pwv, credentials.password, 'access')) {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.');
  }
  req.user = user;
  next();
});

// Restricts a route to the given roles. Usage: authorize('Admin', 'Owner/Approver')
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!roles.includes(req.user.role)) {
    throw ApiError.forbidden(`Role '${req.user.role}' is not permitted to perform this action`);
  }
  next();
};

module.exports = { protect, authorize };
