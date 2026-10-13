const mongoose = require('mongoose');
const { PAYMENT_STATUS } = require('../config/constants');

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    sku: { type: String },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    gstPercent: { type: Number, default: 0, min: 0 },
    taxableAmount: { type: Number, required: true },
    gstAmount: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
  },
  { _id: false }
);

// Snapshots of seller/buyer details are stored on the invoice itself so a
// later change to the Customer/Buyer/Settings record never alters a
// previously issued invoice.
const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['Invoice', 'Quotation'], default: 'Invoice' },

    saleProposal: { type: mongoose.Schema.Types.ObjectId, ref: 'SaleProposal' },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer', required: true },

    seller: {
      name: String,
      address: String,
      gstin: String,
      phone: String,
      email: String,
    },
    buyerSnapshot: {
      name: String,
      address: String,
      gstin: String,
      phone: String,
      email: String,
    },

    invoiceDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date },
    validUntil: { type: Date }, // quotations only

    lineItems: [lineItemSchema],

    subtotal: { type: Number, required: true },
    discountTotal: { type: Number, default: 0 },
    taxableAmount: { type: Number, required: true },
    gstAmount: { type: Number, required: true },
    grandTotal: { type: Number, required: true },

    amountPaid: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUS, default: 'Unpaid' },

    termsAndConditions: { type: String },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

invoiceSchema.virtual('balanceDue').get(function () {
  return Math.max((this.grandTotal || 0) - (this.amountPaid || 0), 0);
});
invoiceSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
