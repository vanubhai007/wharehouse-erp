const mongoose = require('mongoose');

// Tracks a buyer's interest in an item and the negotiation history before a
// formal SaleProposal is created.
const negotiationEntrySchema = new mongoose.Schema(
  {
    proposedPrice: { type: Number, required: true },
    note: { type: String },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const buyerEnquirySchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer', required: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    status: { type: String, enum: ['Open', 'Negotiating', 'Converted', 'Closed'], default: 'Open' },
    negotiationHistory: [negotiationEntrySchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BuyerEnquiry', buyerEnquirySchema);
