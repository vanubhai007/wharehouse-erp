const WarehouseLocation = require('../models/WarehouseLocation');
const Item = require('../models/Item');
const Settings = require('../models/Settings');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recordAudit } = require('../utils/audit');
const { calculateItemRental } = require('../services/rentalService');

const listLocations = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.zone) filter.zone = req.query.zone;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  const locations = await WarehouseLocation.find(filter).sort({ zone: 1, aisle: 1, rack: 1, bin: 1 });
  res.json({ success: true, data: locations });
});

const createLocation = asyncHandler(async (req, res) => {
  const location = await WarehouseLocation.create(req.body);
  await recordAudit({ entityType: 'WarehouseLocation', entityId: location._id, action: 'CREATE', user: req.user });
  res.status(201).json({ success: true, data: location });
});

const updateLocation = asyncHandler(async (req, res) => {
  const location = await WarehouseLocation.findById(req.params.id);
  if (!location) throw ApiError.notFound('Location not found');
  Object.assign(location, req.body);
  await location.save();
  await recordAudit({ entityType: 'WarehouseLocation', entityId: location._id, action: 'UPDATE', user: req.user });
  res.json({ success: true, data: location });
});

const deleteLocation = asyncHandler(async (req, res) => {
  const occupied = await Item.exists({ currentLocation: req.params.id, isArchived: false });
  if (occupied) throw ApiError.conflict('Cannot delete a location that currently holds inventory');
  await WarehouseLocation.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Location deleted' });
});

// Visual warehouse map: every location with its occupied vs available area,
// grouped by zone, based on items whose currentLocation points to it.
const getOccupancyMap = asyncHandler(async (req, res) => {
  const locations = await WarehouseLocation.find({ isActive: true }).lean();
  const occupiedAgg = await Item.aggregate([
    { $match: { isArchived: false, currentLocation: { $ne: null } } },
    { $group: { _id: '$currentLocation', occupiedAreaSqFt: { $sum: '$storageAreaSqFt' }, itemCount: { $sum: 1 } } },
  ]);
  const occupiedMap = new Map(occupiedAgg.map((o) => [String(o._id), o]));

  const result = locations.map((loc) => {
    const occ = occupiedMap.get(String(loc._id));
    const occupiedAreaSqFt = occ ? occ.occupiedAreaSqFt : 0;
    return {
      ...loc,
      occupiedAreaSqFt,
      availableAreaSqFt: Math.max(loc.areaSqFt - occupiedAreaSqFt, 0),
      occupancyPercent: loc.areaSqFt ? Math.min(Math.round((occupiedAreaSqFt / loc.areaSqFt) * 100), 100) : 0,
      itemCount: occ ? occ.itemCount : 0,
    };
  });

  const totals = result.reduce(
    (acc, l) => ({
      totalAreaSqFt: acc.totalAreaSqFt + l.areaSqFt,
      occupiedAreaSqFt: acc.occupiedAreaSqFt + l.occupiedAreaSqFt,
    }),
    { totalAreaSqFt: 0, occupiedAreaSqFt: 0 }
  );
  totals.availableAreaSqFt = totals.totalAreaSqFt - totals.occupiedAreaSqFt;
  totals.occupancyPercent = totals.totalAreaSqFt ? Math.round((totals.occupiedAreaSqFt / totals.totalAreaSqFt) * 100) : 0;

  res.json({ success: true, data: { locations: result, totals } });
});

// Rental report: accumulated rental per item (optionally filtered by
// customer/owner), as of "asOf" (defaults to today).
const getRentalReport = asyncHandler(async (req, res) => {
  const settings = await Settings.getSettings();
  const asOf = req.query.asOf ? new Date(req.query.asOf) : new Date();

  const filter = { isArchived: false };
  if (req.query.owner) filter.owner = req.query.owner;
  if (req.query.item) filter._id = req.query.item;

  const items = await Item.find(filter).populate('owner', 'customerId name businessName').populate('locationHistory.location', 'code zone');

  const rows = items
    .filter((i) => (i.locationHistory || []).length > 0)
    .map((item) => {
      const rental = calculateItemRental(item, settings, asOf);
      return {
        itemId: item.itemId,
        itemName: item.name,
        owner: item.owner ? item.owner.businessName || item.owner.name : '',
        ownerId: item.owner ? item.owner.customerId : '',
        accumulatedRental: rental.amount,
        detail: rental.details,
      };
    });

  const totalRental = rows.reduce((s, r) => s + r.accumulatedRental, 0);
  res.json({ success: true, data: { asOf, rows, totalRental: Math.round(totalRental * 100) / 100 } });
});

module.exports = {
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  getOccupancyMap,
  getRentalReport,
};
