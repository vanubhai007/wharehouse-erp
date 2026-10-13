const mongoose = require('mongoose');

const buyerSchema = new mongoose.Schema(
  {
    buyerId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    businessName: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String },
    gstin: { type: String },
    notes: { type: String },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

buyerSchema.index({ name: 'text', businessName: 'text', phone: 'text', email: 'text' });

module.exports = mongoose.model('Buyer', buyerSchema);
