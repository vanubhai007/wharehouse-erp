const mongoose = require('mongoose');
const fileSchema = require('./shared/fileSchema');
const { ITEM_STATUS } = require('../config/constants');

const statusHistoryEntrySchema = new mongoose.Schema(
  {
    from: { type: String },
    to: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedByName: { type: String },
    remarks: { type: String },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Tracks which storage location an item occupied and for how long, so
// rental can be calculated even after the item moves or is dispatched.
const locationHistoryEntrySchema = new mongoose.Schema(
  {
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'WarehouseLocation', required: true },
    areaSqFt: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date }, // null = currently occupying
  },
  { _id: false }
);

const itemSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true, unique: true, index: true },
    sku: { type: String, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    description: { type: String },
    brand: { type: String },
    model: { type: String },
    serialNumber: { type: String, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },

    trackingType: { type: String, enum: ['Serialized', 'Batch'], default: 'Serialized' },
    quantity: { type: Number, default: 1, min: 0 }, // used when trackingType = Batch
    unit: { type: String, default: 'pcs' },

    purchaseSource: { type: String },
    purchaseDate: { type: Date },
    purchaseCost: { type: Number, required: true, min: 0 },
    estimatedResaleValue: { type: Number, min: 0 },
    // Printed on item stickers (see Sticker Generator) - never hardcoded on
    // the frontend, always read live from this record.
    mrp: { type: Number, min: 0 }, // Maximum Retail Price
    hrMartPrice: { type: Number, min: 0 }, // Actual selling price at HR Mart

    status: { type: String, enum: ITEM_STATUS, default: 'Handover Pending' },
    statusHistory: [statusHistoryEntrySchema],

    currentLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'WarehouseLocation' },
    storageAreaSqFt: { type: Number, min: 0 },
    locationHistory: [locationHistoryEntrySchema],

    receivedDate: { type: Date },
    expectedDispatchDate: { type: Date },
    dispatchedDate: { type: Date },

    condition: {
      type: String,
      enum: ['New', 'Good', 'Fair', 'Needs Repair', 'Damaged'],
      default: 'Good',
    },

    photos: [fileSchema],
    documents: [fileSchema],

    qrCodeUrl: { type: String },
    qrCodePublicId: { type: String },
    barcodeValue: { type: String },

    isArchived: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

itemSchema.index({ name: 'text', sku: 'text', serialNumber: 'text', category: 'text' });
itemSchema.index({ owner: 1, status: 1 });
itemSchema.index({ currentLocation: 1 });

module.exports = mongoose.model('Item', itemSchema);
