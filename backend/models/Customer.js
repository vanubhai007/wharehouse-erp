const mongoose = require('mongoose');
const fileSchema = require('./shared/fileSchema');
const { CUSTOMER_TYPES } = require('../config/constants');

// NOTE ON DOMAIN MODEL (confirm with business):
// In this ERP a "Customer" and an "Owner" are the same entity: the party
// who consigns assets into the warehouse, approves their sale, and is paid
// out. customerType distinguishes Individual/Business owners from Vendors.
// A separate "Buyer" model (models/Buyer.js) represents the purchasing side.
const customerSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    businessName: { type: String, trim: true },
    customerType: { type: String, enum: CUSTOMER_TYPES, default: 'Individual Owner' },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String },
    contactPerson: { type: String },
    gstin: { type: String },
    billingDetails: { type: String },
    agreement: {
      number: { type: String },
      startDate: { type: Date },
      endDate: { type: Date },
      ratePerSqFtPerMonth: { type: Number }, // overrides global default when set
      notes: { type: String },
    },
    documents: [fileSchema],
    photos: [fileSchema],
    notes: { type: String },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

customerSchema.index({ name: 'text', businessName: 'text', phone: 'text', email: 'text' });

module.exports = mongoose.model('Customer', customerSchema);
