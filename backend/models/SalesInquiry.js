const mongoose = require('mongoose');
const { SALES_INQUIRY_SOURCE, SALES_INQUIRY_STATUS, INQUIRY_PRIORITY } = require('../config/constants');

// A product the prospect is interested in. Only a reference is stored -
// name/price/etc. are always read live from the Item it points to, never
// duplicated here, so inquiry records can't go stale or show a hardcoded price.
const interestedItemSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    quantity: { type: Number, default: 1, min: 1 },
    notes: { type: String },
  },
  { _id: false }
);

// General sales lead/inquiry capture. Distinct from BuyerEnquiry (which
// tracks an existing, registered Buyer's interest + price negotiation on a
// specific item): a SalesInquiry is for a prospect who may not be a
// registered Buyer yet - it can optionally reference one once linked, and
// can be converted into a full Buyer record once qualified.
const salesInquirySchema = new mongoose.Schema(
  {
    inquiryNumber: { type: String, required: true, unique: true, index: true },

    contactName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    company: { type: String, trim: true },

    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer' }, // set once linked/converted

    items: [interestedItemSchema],

    source: { type: String, enum: SALES_INQUIRY_SOURCE, default: 'Other' },
    status: { type: String, enum: SALES_INQUIRY_STATUS, default: 'New' },
    priority: { type: String, enum: INQUIRY_PRIORITY, default: 'Medium' },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    followUpDate: { type: Date },
    notes: { type: String },

    convertedToBuyer: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer' },
    convertedAt: { type: Date },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

salesInquirySchema.index({ contactName: 'text', phone: 'text', email: 'text', company: 'text' });
salesInquirySchema.index({ status: 1, priority: 1 });

module.exports = mongoose.model('SalesInquiry', salesInquirySchema);
