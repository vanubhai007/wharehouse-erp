const mongoose = require('mongoose');
const { SALES_INQUIRY_SOURCE, SALES_INQUIRY_STATUS, INQUIRY_PRIORITY } = require('../config/constants');

// General sales lead/inquiry capture. ALL business and product information
// is entered manually by the user - a product does NOT need to exist in
// inventory (productName/productId are free text, not a ref), and manually
// entered prices (expectedPrice, mrp, hrMartPrice) are never auto-replaced
// by inventory data. A SalesInquiry may optionally reference a registered
// Buyer once linked/converted, but is never required to.
const salesInquirySchema = new mongoose.Schema(
  {
    inquiryNumber: { type: String, required: true, unique: true, index: true },

    // Contact / business information (all manual)
    contactName: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },

    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer' }, // set once linked/converted

    // Product information (all manual - never required to exist in Inventory)
    productName: { type: String, required: true, trim: true },
    productId: { type: String, trim: true }, // free text reference, not an Item _id
    quantity: { type: Number, default: 1, min: 0.01 },
    expectedPrice: { type: Number, min: 0 }, // expected price / budget
    mrp: { type: Number, min: 0 },
    hrMartPrice: { type: Number, min: 0 },

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

salesInquirySchema.index({ contactName: 'text', phone: 'text', email: 'text', company: 'text', productName: 'text', productId: 'text' });
salesInquirySchema.index({ status: 1, priority: 1 });

module.exports = mongoose.model('SalesInquiry', salesInquirySchema);
