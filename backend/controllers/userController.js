const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recordAudit } = require('../utils/audit');
const { getPagination, buildPaginatedResult } = require('../utils/paginate');

const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  if (req.query.search) {
    filter.$or = [
      { name: new RegExp(req.query.search, 'i') },
      { email: new RegExp(req.query.search, 'i') },
    ];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, ...buildPaginatedResult(items, total, page, limit) });
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  const user = await User.create({ name, email, password, role, phone, createdBy: req.user._id });
  await recordAudit({ entityType: 'User', entityId: user._id, action: 'CREATE', user: req.user, toValue: { role } });
  res.status(201).json({ success: true, data: user.toSafeJSON() });
});

const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  res.json({ success: true, data: user });
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');

  const before = { role: user.role, isActive: user.isActive };
  const { name, role, phone, isActive } = req.body;
  if (name !== undefined) user.name = name;
  if (role !== undefined) user.role = role;
  if (phone !== undefined) user.phone = phone;
  if (isActive !== undefined) user.isActive = isActive;
  await user.save();

  await recordAudit({
    entityType: 'User',
    entityId: user._id,
    action: 'UPDATE',
    user: req.user,
    fromValue: before,
    toValue: { role: user.role, isActive: user.isActive },
  });
  res.json({ success: true, data: user.toSafeJSON() });
});

// Admin-initiated password reset (no email flow) - sets a temporary password.
const resetUserPassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  const { password } = req.body;
  if (!password || password.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters');
  }
  user.password = password;
  await user.save();
  await recordAudit({ entityType: 'User', entityId: user._id, action: 'ADMIN_PASSWORD_RESET', user: req.user });
  res.json({ success: true, message: 'Password updated' });
});

const deactivateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (String(user._id) === String(req.user._id)) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }
  user.isActive = false;
  await user.save();
  await recordAudit({ entityType: 'User', entityId: user._id, action: 'DEACTIVATE', user: req.user });
  res.json({ success: true, message: 'User deactivated' });
});

module.exports = { listUsers, createUser, getUser, updateUser, resetUserPassword, deactivateUser };
