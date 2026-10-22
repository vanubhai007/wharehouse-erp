const Item = require('../models/Item');
const Customer = require('../models/Customer');
const WarehouseLocation = require('../models/WarehouseLocation');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recordAudit } = require('../utils/audit');
const { generateItemId } = require('../utils/idGenerator');
const { getPagination, buildPaginatedResult } = require('../utils/paginate');
const { mapUploadedFiles } = require('../utils/fileMapper');
const { sanitizeFileRefs } = require('../utils/fileRefs');
const { generateItemQr } = require('../services/qrService');
const { getItemCostSheet } = require('../services/costService');
const { ITEM_STATUS_TRANSITIONS, ITEM_STATUS } = require('../config/constants');
const { isTransitionAllowed } = require('../utils/statusTransition');
const { Parser: CsvParser } = require('json2csv');

const ITEM_FILE_FIELDS = { photos: 'items', documents: 'items' };

const listItems = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { isArchived: false };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.owner) filter.owner = req.query.owner;
  if (req.query.currentLocation) filter.currentLocation = req.query.currentLocation;
  if (req.query.includeArchived === 'true') delete filter.isArchived;
  if (req.query.search) {
    const term = new RegExp(req.query.search, 'i');
    const or = [{ name: term }, { sku: term }, { itemId: term }, { serialNumber: term }];
    // Owner is a reference, not a text field on Item itself - resolve
    // matching Customer/Owner records first so searching by owner name
    // still works (Phase: inventory search by Owner/customer name).
    const matchingOwners = await Customer.find({ $or: [{ name: term }, { businessName: term }] }, '_id');
    if (matchingOwners.length > 0) or.push({ owner: { $in: matchingOwners.map((o) => o._id) } });
    filter.$or = or;
  }

  const [items, total] = await Promise.all([
    Item.find(filter)
      .populate('owner', 'customerId name businessName')
      .populate('currentLocation', 'code zone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Item.countDocuments(filter),
  ]);
  res.json({ success: true, ...buildPaginatedResult(items, total, page, limit) });
});

const createItem = asyncHandler(async (req, res) => {
  sanitizeFileRefs(req.body, ITEM_FILE_FIELDS, null, req.user);
  const itemId = await generateItemId();
  const payload = { ...req.body, itemId, createdBy: req.user._id };
  // The QR code is always generated server-side below.
  delete payload.qrCodeUrl;
  delete payload.qrCodePublicId;

  payload.statusHistory = [
    { to: payload.status || 'Handover Pending', changedBy: req.user._id, changedByName: req.user.name, remarks: 'Item created' },
  ];

  if (req.body.currentLocation && req.body.storageAreaSqFt) {
    const location = await WarehouseLocation.findById(req.body.currentLocation);
    if (!location) throw ApiError.badRequest('Invalid warehouse location');
    payload.locationHistory = [
      {
        location: location._id,
        areaSqFt: req.body.storageAreaSqFt,
        startDate: req.body.receivedDate || new Date(),
      },
    ];
  }

  const item = await Item.create(payload);

  const qr = await generateItemQr(item.itemId, item._id);
  item.qrCodeUrl = qr.url;
  item.qrCodePublicId = qr.publicId;
  item.barcodeValue = item.itemId;
  await item.save();

  await recordAudit({ entityType: 'Item', entityId: item._id, action: 'CREATE', user: req.user, toValue: { itemId: item.itemId, status: item.status } });
  res.status(201).json({ success: true, data: item });
});

const getItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id)
    .populate('owner')
    .populate('currentLocation')
    .populate('locationHistory.location')
    .populate('statusHistory.changedBy', 'name role');
  if (!item) throw ApiError.notFound('Item not found');
  res.json({ success: true, data: item });
});

const updateItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw ApiError.notFound('Item not found');
  const before = item.toObject();

  const immutable = ['itemId', 'status', 'statusHistory', 'locationHistory', 'qrCodeUrl', 'qrCodePublicId'];
  sanitizeFileRefs(req.body, ITEM_FILE_FIELDS, item, req.user);
  for (const key of Object.keys(req.body)) {
    if (!immutable.includes(key)) item[key] = req.body[key];
  }
  item.updatedBy = req.user._id;
  await item.save();

  await recordAudit({ entityType: 'Item', entityId: item._id, action: 'UPDATE', user: req.user, fromValue: before, toValue: item.toObject() });
  res.json({ success: true, data: item });
});

const archiveItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw ApiError.notFound('Item not found');
  item.isArchived = true;
  await item.save();
  await recordAudit({ entityType: 'Item', entityId: item._id, action: 'ARCHIVE', user: req.user });
  res.json({ success: true, message: 'Item archived' });
});

// Validates and applies a status transition, recording who/when in both
// Item.statusHistory and the global immutable AuditLog.
const changeStatus = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw ApiError.notFound('Item not found');

  const { status: targetStatus, remarks } = req.body;
  if (!ITEM_STATUS.includes(targetStatus)) throw ApiError.badRequest('Unknown status value');

  if (!isTransitionAllowed(item.status, targetStatus, req.user.role)) {
    throw ApiError.badRequest(
      `Cannot move item from '${item.status}' to '${targetStatus}'. Allowed next steps: ${
        (ITEM_STATUS_TRANSITIONS[item.status] || []).join(', ') || 'none'
      }`
    );
  }

  const from = item.status;
  item.status = targetStatus;
  item.statusHistory.push({ from, to: targetStatus, changedBy: req.user._id, changedByName: req.user.name, remarks });

  if (targetStatus === 'Received' && !item.receivedDate) item.receivedDate = new Date();
  if (targetStatus === 'Dispatched') item.dispatchedDate = new Date();

  await item.save();
  await recordAudit({ entityType: 'Item', entityId: item._id, action: 'STATUS_CHANGE', user: req.user, fromValue: from, toValue: targetStatus, remarks });

  res.json({ success: true, data: item });
});

// Moves an item to a new warehouse location, closing out the previous
// locationHistory entry so rental billing is correctly apportioned.
const moveLocation = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw ApiError.notFound('Item not found');
  const { locationId, areaSqFt } = req.body;
  const location = await WarehouseLocation.findById(locationId);
  if (!location) throw ApiError.badRequest('Invalid warehouse location');

  const now = new Date();
  const open = item.locationHistory.find((l) => !l.endDate);
  if (open) open.endDate = now;

  item.locationHistory.push({ location: location._id, areaSqFt: areaSqFt || location.areaSqFt, startDate: now });
  item.currentLocation = location._id;
  item.storageAreaSqFt = areaSqFt || location.areaSqFt;
  await item.save();

  await recordAudit({ entityType: 'Item', entityId: item._id, action: 'LOCATION_CHANGE', user: req.user, toValue: location.code });
  res.json({ success: true, data: item });
});

const addMedia = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw ApiError.notFound('Item not found');
  if (!req.files || req.files.length === 0) throw ApiError.badRequest('No files uploaded');
  const target = req.body.target === 'documents' ? 'documents' : 'photos';
  item[target].push(...mapUploadedFiles(req.files, req.user._id, req.body.label));
  await item.save();
  res.status(201).json({ success: true, data: item });
});

const removeMedia = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw ApiError.notFound('Item not found');
  item.photos = item.photos.filter((p) => String(p._id) !== req.params.fileId);
  item.documents = item.documents.filter((p) => String(p._id) !== req.params.fileId);
  await item.save();
  res.json({ success: true, data: item });
});

const getCostSheet = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw ApiError.notFound('Item not found');
  const sheet = await getItemCostSheet(item);
  res.json({ success: true, data: sheet });
});

const getHistory = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id)
    .populate('statusHistory.changedBy', 'name role')
    .populate('locationHistory.location', 'code zone');
  if (!item) throw ApiError.notFound('Item not found');
  res.json({ success: true, data: { statusHistory: item.statusHistory, locationHistory: item.locationHistory } });
});

const exportCsv = asyncHandler(async (req, res) => {
  const items = await Item.find({ isArchived: false }).populate('owner', 'name businessName customerId').lean();
  const rows = items.map((i) => ({
    itemId: i.itemId,
    name: i.name,
    sku: i.sku,
    category: i.category,
    owner: i.owner ? (i.owner.businessName || i.owner.name) : '',
    status: i.status,
    purchaseCost: i.purchaseCost,
    estimatedResaleValue: i.estimatedResaleValue,
    receivedDate: i.receivedDate,
    condition: i.condition,
  }));
  const parser = new CsvParser();
  const csv = parser.parse(rows);
  res.header('Content-Type', 'text/csv');
  res.attachment('inventory-export.csv');
  res.send(csv);
});

module.exports = {
  listItems,
  createItem,
  getItem,
  updateItem,
  archiveItem,
  changeStatus,
  moveLocation,
  addMedia,
  removeMedia,
  getCostSheet,
  getHistory,
  exportCsv,
};
