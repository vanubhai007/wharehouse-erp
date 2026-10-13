const mongoose = require('mongoose');
const fileSchema = require('./shared/fileSchema');
const { DISPATCH_STATUS } = require('../config/constants');

const dispatchSchema = new mongoose.Schema(
  {
    dispatchNumber: { type: String, required: true, unique: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    saleProposal: { type: mongoose.Schema.Types.ObjectId, ref: 'SaleProposal', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer', required: true },

    deliveryAddress: { type: String, required: true },
    deliveryContactName: { type: String },
    deliveryContactPhone: { type: String },

    transporterName: { type: String },
    trackingReference: { type: String },

    status: { type: String, enum: DISPATCH_STATUS, default: 'Pending' },

    scheduledDate: { type: Date },
    dispatchedDate: { type: Date },
    deliveredDate: { type: Date },

    outboundLogisticsCost: { type: Number, default: 0, min: 0 },

    deliveryProof: [fileSchema],

    deliveryConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Dispatch', dispatchSchema);
