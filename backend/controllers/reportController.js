const { Parser: CsvParser } = require('json2csv');
const Item = require('../models/Item');
const Expense = require('../models/Expense');
const Refurbishment = require('../models/Refurbishment');
const SaleProposal = require('../models/SaleProposal');
const Invoice = require('../models/Invoice');
const Approval = require('../models/Approval');
const Settlement = require('../models/Settlement');
const Dispatch = require('../models/Dispatch');
const AuditLog = require('../models/AuditLog');
const Settings = require('../models/Settings');
const asyncHandler = require('../utils/asyncHandler');
const { getItemCostSheet } = require('../services/costService');
const { generateInventoryReportPdf } = require('../services/pdfService');

function dateRangeFilter(field, req) {
  const filter = {};
  if (req.query.from || req.query.to) {
    filter[field] = {};
    if (req.query.from) filter[field].$gte = new Date(req.query.from);
    if (req.query.to) filter[field].$lte = new Date(req.query.to);
  }
  return filter;
}

function toCsv(res, filename, rows) {
  const parser = new CsvParser();
  const csv = rows.length ? parser.parse(rows) : '';
  res.header('Content-Type', 'text/csv');
  res.attachment(filename);
  res.send(csv);
}

const currentInventory = asyncHandler(async (req, res) => {
  const filter = { isArchived: false };
  if (req.query.owner) filter.owner = req.query.owner;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.location) filter.currentLocation = req.query.location;
  const items = await Item.find(filter).populate('owner', 'customerId name businessName').populate('currentLocation', 'code zone');

  if (req.query.format === 'csv') {
    return toCsv(res, 'inventory-report.csv', items.map((i) => ({
      itemId: i.itemId, name: i.name, category: i.category, owner: i.owner?.businessName || i.owner?.name || '',
      status: i.status, location: i.currentLocation?.code || '', purchaseCost: i.purchaseCost, estimatedResaleValue: i.estimatedResaleValue,
    })));
  }
  if (req.query.format === 'pdf') {
    const settings = await Settings.getSettings();
    return generateInventoryReportPdf(res, items, settings);
  }
  res.json({ success: true, data: items });
});

// Same dataset, grouped - used for both "customer-wise" and "owner-wise"
// inventory reports since a Customer record represents the owner (see
// models/Customer.js note).
const ownerWiseInventory = asyncHandler(async (req, res) => {
  const filter = { isArchived: false };
  if (req.query.owner) filter.owner = req.query.owner;
  const items = await Item.find(filter).populate('owner', 'customerId name businessName');
  const grouped = {};
  for (const item of items) {
    const key = item.owner ? item.owner._id : 'unassigned';
    if (!grouped[key]) grouped[key] = { owner: item.owner, items: [] };
    grouped[key].items.push(item);
  }
  res.json({ success: true, data: Object.values(grouped) });
});

const costSheetReport = asyncHandler(async (req, res) => {
  const filter = { isArchived: false };
  if (req.query.owner) filter.owner = req.query.owner;
  if (req.query.item) filter._id = req.query.item;
  const items = await Item.find(filter).populate('owner', 'customerId name businessName');
  const sheets = await Promise.all(items.map(async (item) => ({ item: { itemId: item.itemId, name: item.name, owner: item.owner }, costSheet: await getItemCostSheet(item) })));

  if (req.query.format === 'csv') {
    return toCsv(res, 'cost-sheet-report.csv', sheets.map((s) => ({
      itemId: s.item.itemId, name: s.item.name, baseCost: s.costSheet.baseCost, rental: s.costSheet.rental,
      refurbishment: s.costSheet.refurbishment, marketing: s.costSheet.marketing, logistics: s.costSheet.logistics,
      other: s.costSheet.other, totalCost: s.costSheet.totalCost,
    })));
  }
  res.json({ success: true, data: sheets });
});

const expenseReport = asyncHandler(async (req, res) => {
  const filter = { ...dateRangeFilter('date', req) };
  if (req.query.item) filter.item = req.query.item;
  if (req.query.category) filter.category = req.query.category;
  const expenses = await Expense.find(filter).populate('item', 'itemId name owner').sort({ date: -1 });
  const totalsByCategory = {};
  for (const e of expenses) totalsByCategory[e.category] = (totalsByCategory[e.category] || 0) + e.amount;

  if (req.query.format === 'csv') {
    return toCsv(res, 'expense-report.csv', expenses.map((e) => ({ item: e.item?.itemId, category: e.category, amount: e.amount, date: e.date, vendor: e.vendor, paymentStatus: e.paymentStatus })));
  }
  res.json({ success: true, data: { expenses, totalsByCategory, grandTotal: expenses.reduce((s, e) => s + e.amount, 0) } });
});

const refurbishmentReport = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const jobs = await Refurbishment.find(filter).populate('item', 'itemId name').sort({ createdAt: -1 });
  res.json({ success: true, data: jobs });
});

const salesReport = asyncHandler(async (req, res) => {
  const filter = { ...dateRangeFilter('createdAt', req) };
  if (req.query.status) filter.status = req.query.status;
  const proposals = await SaleProposal.find(filter).populate('item', 'itemId name').populate('buyer', 'buyerId name businessName').sort({ createdAt: -1 });
  const totalSalesValue = proposals.filter((p) => p.status === 'Converted').reduce((s, p) => s + (p.proposedPrice - p.discountAmount), 0);

  if (req.query.format === 'csv') {
    return toCsv(res, 'sales-report.csv', proposals.map((p) => ({ proposalNumber: p.proposalNumber, item: p.item?.itemId, buyer: p.buyer?.name, proposedPrice: p.proposedPrice, status: p.status, marginAmount: p.marginAmount })));
  }
  res.json({ success: true, data: { proposals, totalSalesValue } });
});

const pendingApprovalsReport = asyncHandler(async (req, res) => {
  const approvals = await Approval.find({ decision: 'Pending' }).populate('saleProposal').sort({ createdAt: -1 });
  res.json({ success: true, data: approvals });
});

const paymentOutstandingReport = asyncHandler(async (req, res) => {
  const filter = { paymentStatus: { $in: ['Unpaid', 'Partially Paid'] } };
  const invoices = await Invoice.find(filter).populate('buyer', 'buyerId name businessName').populate('item', 'itemId name');
  const totalOutstanding = invoices.reduce((s, i) => s + (i.grandTotal - i.amountPaid), 0);

  if (req.query.format === 'csv') {
    return toCsv(res, 'outstanding-report.csv', invoices.map((i) => ({ invoiceNumber: i.invoiceNumber, buyer: i.buyer?.name, grandTotal: i.grandTotal, amountPaid: i.amountPaid, balance: i.grandTotal - i.amountPaid, paymentStatus: i.paymentStatus })));
  }
  res.json({ success: true, data: { invoices, totalOutstanding } });
});

const settlementReport = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.owner) filter.owner = req.query.owner;
  if (req.query.status) filter.status = req.query.status;
  const settlements = await Settlement.find(filter).populate('item', 'itemId name').populate('owner', 'customerId name businessName').sort({ createdAt: -1 });
  const totals = {
    totalCommission: settlements.reduce((s, x) => s + x.commissionAmount, 0),
    totalOwnerPayable: settlements.reduce((s, x) => s + x.ownerPayable, 0),
    totalPending: settlements.filter((x) => x.status === 'Pending').reduce((s, x) => s + x.ownerPayable, 0),
  };
  res.json({ success: true, data: { settlements, totals } });
});

const dispatchReport = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const dispatches = await Dispatch.find(filter).populate('item', 'itemId name').populate('buyer', 'buyerId name businessName').sort({ createdAt: -1 });
  res.json({ success: true, data: dispatches });
});

const auditReport = asyncHandler(async (req, res) => {
  const filter = { ...dateRangeFilter('createdAt', req) };
  if (req.query.entityType) filter.entityType = req.query.entityType;
  if (req.query.user) filter.performedBy = req.query.user;
  const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(500);
  res.json({ success: true, data: logs });
});

module.exports = {
  currentInventory,
  ownerWiseInventory,
  costSheetReport,
  expenseReport,
  refurbishmentReport,
  salesReport,
  pendingApprovalsReport,
  paymentOutstandingReport,
  settlementReport,
  dispatchReport,
  auditReport,
};
