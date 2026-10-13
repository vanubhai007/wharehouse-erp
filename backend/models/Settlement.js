const mongoose = require('mongoose');

// Item-wise / sale-wise settlement record: how much the owner is paid out
// after commission, computed once a sale is invoiced. One settlement per
// sale proposal - creating a second one for the same proposal is blocked
// in the controller to prevent duplicate payouts.
const settlementSchema = new mongoose.Schema(
  {
    saleProposal: { type: mongoose.Schema.Types.ObjectId, ref: 'SaleProposal', required: true, unique: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },

    salePrice: { type: Number, required: true },
    totalItemCost: { type: Number, required: true },
    commissionBasis: { type: String, enum: ['Sale Price', 'Margin'], default: 'Sale Price' },
    commissionType: { type: String, enum: ['percent', 'fixed'], required: true },
    commissionRate: { type: Number, required: true }, // percent value or fixed amount, per commissionType
    commissionAmount: { type: Number, required: true },

    ownerPayable: { type: Number, required: true },
    status: { type: String, enum: ['Pending', 'Settled'], default: 'Pending' },
    settledAt: { type: Date },
    settledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paymentReference: { type: String },
    notes: { type: String },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settlement', settlementSchema);
