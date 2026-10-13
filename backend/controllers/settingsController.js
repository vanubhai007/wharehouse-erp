const Settings = require('../models/Settings');
const asyncHandler = require('../utils/asyncHandler');
const { recordAudit } = require('../utils/audit');

const getSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSettings();
  res.json({ success: true, data: settings });
});

const updateSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSettings();
  const editableFields = [
    'defaultRatePerSqFtPerMonth',
    'rentalDaysPerMonth',
    'defaultGstPercent',
    'defaultCommissionPercent',
    'defaultCommissionType',
    'invoicePrefix',
    'quotationPrefix',
    'dispatchNotePrefix',
    'companyName',
    'companyAddress',
    'companyGstin',
    'companyPhone',
    'companyEmail',
    'companyLogoUrl',
  ];
  for (const field of editableFields) {
    if (req.body[field] !== undefined) settings[field] = req.body[field];
  }
  await settings.save();
  await recordAudit({ entityType: 'Settings', entityId: settings._id, action: 'UPDATE', user: req.user });
  res.json({ success: true, data: settings });
});

module.exports = { getSettings, updateSettings };
