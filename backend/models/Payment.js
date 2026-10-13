const mongoose = require('mongoose');
const fileSchema = require('./shared/fileSchema');
const { PAYMENT_DIRECTION } = require('../config/constants');

const paymentSchema = new mongoose.Schema(
  {
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', index: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', index: true },
    direction: { type: String, enum: PAYMENT_DIRECTION, required: true }, // Receivable (from buyer) | Payable (to owner)
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, required: true, default: Date.now },
    mode: { type: String, enum: ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card', 'Other'], default: 'Bank Transfer' },
    referenceNumber: { type: String },
    proof: [fileSchema],
    notes: { type: String },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
