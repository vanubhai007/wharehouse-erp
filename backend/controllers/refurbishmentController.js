const Refurbishment = require('../models/Refurbishment');
const Item = require('../models/Item');
const Expense = require('../models/Expense');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recordAudit } = require('../utils/audit');
const { mapUploadedFiles } = require('../utils/fileMapper');

const listJobs = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.item) filter.item = req.query.item;
  if (req.query.status) filter.status = req.query.status;
  const jobs = await Refurbishment.find(filter).populate('item', 'itemId name status').sort({ createdAt: -1 });
  res.json({ success: true, data: jobs });
});

const createJob = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.body.item);
  if (!item) throw ApiError.badRequest('Invalid item');

  const job = await Refurbishment.create({ ...req.body, createdBy: req.user._id });

  if (item.status === 'In Warehouse') {
    item.status = 'Under Refurbishment';
    item.statusHistory.push({ from: 'In Warehouse', to: 'Under Refurbishment', changedBy: req.user._id, changedByName: req.user.name, remarks: `Refurbishment job started: ${job.workDescription}` });
    await item.save();
  }

  await recordAudit({ entityType: 'Refurbishment', entityId: job._id, action: 'CREATE', user: req.user, toValue: { item: item.itemId } });
  res.status(201).json({ success: true, data: job });
});

const updateJob = asyncHandler(async (req, res) => {
  const job = await Refurbishment.findById(req.params.id);
  if (!job) throw ApiError.notFound('Refurbishment job not found');
  const { workDescription, assignedTo, repairCost, startDate, notes } = req.body;
  if (workDescription !== undefined) job.workDescription = workDescription;
  if (assignedTo !== undefined) job.assignedTo = assignedTo;
  if (repairCost !== undefined) job.repairCost = repairCost;
  if (startDate !== undefined) job.startDate = startDate;
  if (notes !== undefined) job.notes = notes;
  await job.save();
  res.json({ success: true, data: job });
});

// Marks the job complete, logs the repair cost as a Refurbishment expense
// against the item (so it flows into the cost sheet), and updates the
// item's condition. Moving the item back to "Available for Sale" still
// requires an explicit status-change call so staff can inspect it first.
const completeJob = asyncHandler(async (req, res) => {
  const job = await Refurbishment.findById(req.params.id);
  if (!job) throw ApiError.notFound('Refurbishment job not found');
  if (job.status === 'Completed' || job.status === 'Approved') {
    throw ApiError.conflict('This refurbishment job is already marked complete');
  }

  job.status = 'Completed';
  job.completionDate = req.body.completionDate || new Date();
  if (req.body.conditionAfter) job.conditionAfter = req.body.conditionAfter;
  await job.save();

  if (job.repairCost > 0) {
    await Expense.create({
      item: job.item,
      category: 'Refurbishment',
      amount: job.repairCost,
      date: job.completionDate,
      vendor: job.assignedTo,
      notes: `Refurbishment job: ${job.workDescription}`,
      dedupeKey: `refurb:${job._id}`,
      createdBy: req.user._id,
    });
  }

  if (job.conditionAfter) {
    await Item.findByIdAndUpdate(job.item, { condition: job.conditionAfter });
  }

  await recordAudit({ entityType: 'Refurbishment', entityId: job._id, action: 'COMPLETE', user: req.user });
  res.json({ success: true, data: job });
});

const approveJob = asyncHandler(async (req, res) => {
  const job = await Refurbishment.findById(req.params.id);
  if (!job) throw ApiError.notFound('Refurbishment job not found');
  if (job.status !== 'Completed') throw ApiError.badRequest('Only a completed job can be approved');
  job.status = 'Approved';
  job.approvedBy = req.user._id;
  job.approvedAt = new Date();
  await job.save();
  await recordAudit({ entityType: 'Refurbishment', entityId: job._id, action: 'APPROVE', user: req.user });
  res.json({ success: true, data: job });
});

const addPhotos = asyncHandler(async (req, res) => {
  const job = await Refurbishment.findById(req.params.id);
  if (!job) throw ApiError.notFound('Refurbishment job not found');
  if (!req.files || req.files.length === 0) throw ApiError.badRequest('No files uploaded');
  const target = req.body.target === 'after' ? 'afterPhotos' : 'beforePhotos';
  job[target].push(...mapUploadedFiles(req.files, req.user._id, target));
  await job.save();
  res.status(201).json({ success: true, data: job });
});

module.exports = { listJobs, createJob, updateJob, completeJob, approveJob, addPhotos };
