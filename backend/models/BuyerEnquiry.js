const mongoose = require('mongoose');
const { SALES_INQUIRY_SOURCE, BUYER_ENQUIRY_STATUS, INQUIRY_PRIORITY } = require('../config/constants');

// Tracks a potential/registered buyer's interest in a product, with an
// optional running log of price offers exchanged during negotiation.
const negotiationEntrySchema = new mongoose.Schema(
  {
    proposedPrice: { type: Number, required: true },
    note: { type: String },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

// A Buyer Inquiry. ALL buyer and product information is entered manually -
// a user does NOT need to select an existing Buyer or Inventory record to
// create one (`buyer`/`item` below are optional convenience links, set only
// when the staff member explicitly picks or converts to a real record).
// Manually entered quantity/expectedPrice/mrp/hrMartPrice are the source of
// truth and are never silently overwritten by inventory data.
const buyerEnquirySchema = new mongoose.Schema(
  {
    // Optional links to real records - never required.
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer' },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },

    // Buyer / contact information (all manual)
    buyerName: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },

    // Product information (all manual - never required to exist in Inventory)
    productName: { type: String, required: true, trim: true },
    productId: { type: String, trim: true }, // free text reference, not an Item _id
    quantity: { type: Number, default: 1, min: 0.01 },
    expectedPrice: { type: Number, min: 0 }, // expected buying price
    mrp: { type: Number, min: 0 },
    hrMartPrice: { type: Number, min: 0 },

    source: { type: String, enum: SALES_INQUIRY_SOURCE, default: 'Other' },
    priority: { type: String, enum: INQUIRY_PRIORITY, default: 'Medium' },
    status: { type: String, enum: BUYER_ENQUIRY_STATUS, default: 'Open' },
    followUpDate: { type: Date },
    notes: { type: String },

    negotiationHistory: [negotiationEntrySchema],

    convertedToBuyer: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer' },
    convertedAt: { type: Date },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

buyerEnquirySchema.index({ buyerName: 'text', phone: 'text', email: 'text', companyName: 'text', productName: 'text', productId: 'text' });
buyerEnquirySchema.index({ status: 1, priority: 1 });

module.exports = mongoose.model('BuyerEnquiry', buyerEnquirySchema);
