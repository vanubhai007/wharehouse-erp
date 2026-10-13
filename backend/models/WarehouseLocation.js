const mongoose = require('mongoose');

// A bin/location is the smallest storage unit an item occupies.
// zone > aisle > rack > bin hierarchy, each with its own sq.ft capacity so
// occupancy % and the visual warehouse map can be computed at any level.
const warehouseLocationSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true }, // e.g. "A-01-R2-B3"
    warehouseName: { type: String, required: true, default: 'Main Warehouse' },
    zone: { type: String, required: true },
    aisle: { type: String },
    rack: { type: String },
    bin: { type: String },
    areaSqFt: { type: Number, required: true, min: 0 },
    ratePerSqFtPerMonth: { type: Number }, // overrides Settings.defaultRatePerSqFtPerMonth when set
    isActive: { type: Boolean, default: true },
    notes: { type: String },
  },
  { timestamps: true }
);

warehouseLocationSchema.virtual('occupiedAreaSqFt').get(function () {
  return this._occupiedAreaSqFt || 0;
});

module.exports = mongoose.model('WarehouseLocation', warehouseLocationSchema);
