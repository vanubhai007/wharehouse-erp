const mongoose = require('mongoose');

// A sale proposal captures the commercial terms for selling a specific item
// to a specific buyer, together with a cost snapshot so margin is visible
// to authorized staff before it goes for owner approval.
const saleProposalSchema = new mongoose.Schema(
  {
    proposalNumber: { type: String, required: true, unique: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer', required: true },

    proposedPrice: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    gstPercent: { type: Number, default: 0, min: 0 },

    // Cost snapshot taken from the item's live cost sheet at proposal time
    // (see services/costService.js). Kept here so margin reporting stays
    // accurate even if later expenses are added to the item.
    costSnapshot: {
      baseCost: { type: Number, default: 0 },
      rental: { type: Number, default: 0 },
      refurbishment: { type: Number, default: 0 },
      marketing: { type: Number, default: 0 },
      logistics: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
      totalCost: { type: Number, default: 0 },
    },
    marginAmount: { type: Number, default: 0 },
    marginPercent: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Approval Pending', 'Approved', 'Rejected', 'Converted', 'Cancelled'],
      default: 'Draft',
    },

    requiresApproval: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SaleProposal', saleProposalSchema);
