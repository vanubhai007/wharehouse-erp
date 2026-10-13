const mongoose = require('mongoose');
const { DEFAULT_SETTINGS } = require('../config/constants');

// Single-document collection holding configurable business rules
// (rental rate, GST%, commission%, invoice numbering prefixes, company info).
// All values here are safe defaults - CONFIRM actual business rules with the
// customer and update via the Settings admin screen / PUT /api/settings.
const settingsSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'default', unique: true },
    defaultRatePerSqFtPerMonth: { type: Number, default: DEFAULT_SETTINGS.defaultRatePerSqFtPerMonth },
    rentalDaysPerMonth: { type: Number, default: DEFAULT_SETTINGS.rentalDaysPerMonth },
    defaultGstPercent: { type: Number, default: DEFAULT_SETTINGS.defaultGstPercent },
    defaultCommissionPercent: { type: Number, default: DEFAULT_SETTINGS.defaultCommissionPercent },
    defaultCommissionType: { type: String, enum: ['percent', 'fixed'], default: DEFAULT_SETTINGS.defaultCommissionType },
    invoicePrefix: { type: String, default: DEFAULT_SETTINGS.invoicePrefix },
    quotationPrefix: { type: String, default: DEFAULT_SETTINGS.quotationPrefix },
    dispatchNotePrefix: { type: String, default: DEFAULT_SETTINGS.dispatchNotePrefix },
    companyName: { type: String, default: DEFAULT_SETTINGS.companyName },
    companyAddress: { type: String, default: DEFAULT_SETTINGS.companyAddress },
    companyGstin: { type: String, default: DEFAULT_SETTINGS.companyGstin },
    companyPhone: { type: String, default: DEFAULT_SETTINGS.companyPhone },
    companyEmail: { type: String, default: DEFAULT_SETTINGS.companyEmail },
    companyLogoUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

async function getSettings() {
  let settings = await mongoose.model('Settings').findOne({ singleton: 'default' });
  if (!settings) {
    settings = await mongoose.model('Settings').create({ singleton: 'default' });
  }
  return settings;
}

settingsSchema.statics.getSettings = getSettings;

module.exports = mongoose.model('Settings', settingsSchema);
