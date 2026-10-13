const mongoose = require('mongoose');
const fileSchema = require('./shared/fileSchema');
const { EXPENSE_CATEGORIES, PAYMENT_STATUS } = require('../config/constants');

// Item-wise expense entry. Warehouse Rental entries are normally generated
// by the rental calculation service (see services/rentalService.js) rather
// than typed in manually, but manual entry is still allowed for adjustments.
const expenseSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now },
    vendor: { type: String },
    paymentStatus: { type: String, enum: PAYMENT_STATUS, default: 'Unpaid' },
    notes: { type: String },
    receipts: [fileSchema],
    // De-duplication key: same item + category + date + amount + vendor is
    // treated as a likely duplicate and rejected unless forced.
    dedupeKey: { type: String, index: true },
    isSystemGenerated: { type: Boolean, default: false }, // true for auto rental charges
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

expenseSchema.index({ item: 1, category: 1, date: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
