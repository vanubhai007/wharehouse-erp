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
const Customer = require('../models/Customer');
const User = require('../models/User');
const WarehouseLocation = require('../models/WarehouseLocation');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getItemCostSheet } = require('../services/costService');
const { generateTablePdf, assertPdfRowLimit, formatINR, formatDateIST, formatDateTimeIST } = require('../services/pdfService');

const AUDIT_LIMIT = 500;

function dateRangeFilter(field, req) {
  const filter = {};
  if (req.query.from || req.query.to) {
    filter[field] = {};
    if (req.query.from) filter[field].$gte = new Date(req.query.from);
    if (req.query.to) filter[field].$lte = new Date(req.query.to);
  }
  return filter;
}

// Reports export as PDF only (CSV export was replaced by PDF). Requests
// without `format` keep returning JSON; any other format value is rejected.
function wantsPdf(req) {
  const { format } = req.query;
  if (format === undefined) return false;
  if (format === 'pdf') return true;
  throw ApiError.badRequest('Unsupported export format. Use format=pdf.');
}

const partyName = (party) => (party ? party.businessName || party.name : '-');

const FILTER_LABELS = {
  status: 'Status',
  category: 'Category',
  owner: 'Owner',
  location: 'Location',
  item: 'Item',
  from: 'From',
  to: 'To',
  entityType: 'Entity',
  user: 'User',
};

// Readable value for a filter shown on the PDF (IDs are looked up by name).
// The report query has already run with the same values, so IDs are valid here.
async function filterValue(key, value) {
  if (key === 'from' || key === 'to') return formatDateIST(value);
  if (key === 'owner') return partyName(await Customer.findById(value, 'name businessName'));
  if (key === 'item') {
    const item = await Item.findById(value, 'itemId name');
    return item ? `${item.itemId} - ${item.name}` : String(value);
  }
  if (key === 'location') {
    const location = await WarehouseLocation.findById(value, 'code');
    return location ? location.code : String(value);
  }
  if (key === 'user') {
    const user = await User.findById(value, 'name');
    return user ? user.name : String(value);
  }
  return String(value);
}

async function sendReportPdf(req, res, filterKeys, report) {
  const filters = [];
  for (const key of filterKeys) {
    if (req.query[key] !== undefined && req.query[key] !== '') {
      filters.push({ label: FILTER_LABELS[key], value: await filterValue(key, req.query[key]) });
    }
  }
  const settings = await Settings.getSettings();
  await generateTablePdf(res, { settings, filters, ...report });
}

const sum = (rows, pick) => rows.reduce((s, r) => s + (pick(r) || 0), 0);

const currentInventory = asyncHandler(async (req, res) => {
  const pdf = wantsPdf(req);
  const filter = { isArchived: false };
  if (req.query.owner) filter.owner = req.query.owner;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.location) filter.currentLocation = req.query.location;
  if (pdf) await assertPdfRowLimit(Item, filter);
  const items = await Item.find(filter).populate('owner', 'customerId name businessName').populate('currentLocation', 'code zone');

  if (pdf) {
    return sendReportPdf(req, res, ['owner', 'category', 'status', 'location'], {
      title: 'Current Inventory Report',
      filenameBase: 'current-inventory-report',
      columns: [
        { key: 'itemId', label: 'Item ID', minWidth: 55 },
        { key: 'name', label: 'Name', weight: 2.5, minWidth: 100 },
        { key: 'category', label: 'Category', weight: 1.3, minWidth: 65 },
        { key: 'owner', label: 'Owner', weight: 2, minWidth: 85 },
        { key: 'status', label: 'Status', weight: 1.3, minWidth: 70 },
        { key: 'location', label: 'Location', minWidth: 55 },
        { key: 'purchaseCost', label: 'Purchase Cost', weight: 1.4, minWidth: 75, align: 'right' },
        { key: 'resaleValue', label: 'Est. Resale Value', weight: 1.4, minWidth: 75, align: 'right' },
      ],
      rows: items.map((i) => ({
        itemId: i.itemId,
        name: i.name,
        category: i.category,
        owner: partyName(i.owner),
        status: i.status,
        location: i.currentLocation?.code || '-',
        purchaseCost: formatINR(i.purchaseCost),
        resaleValue: i.estimatedResaleValue == null ? '-' : formatINR(i.estimatedResaleValue),
      })),
      totalsRow: {
        itemId: 'Total',
        purchaseCost: formatINR(sum(items, (i) => i.purchaseCost)),
        resaleValue: formatINR(sum(items, (i) => i.estimatedResaleValue)),
      },
      summary: [{ label: 'Items', value: String(items.length) }],
    });
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
  const pdf = wantsPdf(req);
  const filter = { isArchived: false };
  if (req.query.owner) filter.owner = req.query.owner;
  if (req.query.item) filter._id = req.query.item;
  if (pdf) await assertPdfRowLimit(Item, filter);
  const items = await Item.find(filter).populate('owner', 'customerId name businessName');
  const sheets = await Promise.all(items.map(async (item) => ({ item: { itemId: item.itemId, name: item.name, owner: item.owner }, costSheet: await getItemCostSheet(item) })));

  if (pdf) {
    const costKeys = ['baseCost', 'rental', 'refurbishment', 'marketing', 'logistics', 'commission', 'other', 'totalCost'];
    const money = (key) => ({ key, weight: 1, minWidth: 62, align: 'right' });
    const totalsRow = { itemId: 'Total' };
    costKeys.forEach((key) => { totalsRow[key] = formatINR(sum(sheets, (s) => s.costSheet[key])); });
    return sendReportPdf(req, res, ['owner', 'item'], {
      title: 'Item-wise Cost Sheet',
      filenameBase: 'item-wise-cost-sheet',
      columns: [
        { key: 'itemId', label: 'Item ID', minWidth: 55 },
        { key: 'name', label: 'Item Name', weight: 2, minWidth: 90 },
        { ...money('baseCost'), label: 'Base Cost' },
        { ...money('rental'), label: 'Rental' },
        { ...money('refurbishment'), label: 'Refurbishment' },
        { ...money('marketing'), label: 'Marketing' },
        { ...money('logistics'), label: 'Logistics' },
        { ...money('commission'), label: 'Commission' },
        { ...money('other'), label: 'Other' },
        { ...money('totalCost'), label: 'Total Cost' },
      ],
      rows: sheets.map((s) => ({
        itemId: s.item.itemId,
        name: s.item.name,
        ...Object.fromEntries(costKeys.map((key) => [key, formatINR(s.costSheet[key])])),
      })),
      totalsRow,
      summary: [{ label: 'Items', value: String(sheets.length) }],
    });
  }
  res.json({ success: true, data: sheets });
});

const expenseReport = asyncHandler(async (req, res) => {
  const pdf = wantsPdf(req);
  const filter = { ...dateRangeFilter('date', req) };
  if (req.query.item) filter.item = req.query.item;
  if (req.query.category) filter.category = req.query.category;
  if (pdf) await assertPdfRowLimit(Expense, filter);
  const expenses = await Expense.find(filter).populate('item', 'itemId name owner').sort({ date: -1 });
  const totalsByCategory = {};
  for (const e of expenses) totalsByCategory[e.category] = (totalsByCategory[e.category] || 0) + e.amount;
  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

  if (pdf) {
    return sendReportPdf(req, res, ['from', 'to', 'item', 'category'], {
      title: 'Expense Report',
      filenameBase: 'expense-report',
      columns: [
        { key: 'date', label: 'Date', minWidth: 65 },
        { key: 'item', label: 'Item', minWidth: 60 },
        { key: 'category', label: 'Category', weight: 1.5, minWidth: 80 },
        { key: 'vendor', label: 'Vendor', weight: 1.5, minWidth: 80 },
        { key: 'paymentStatus', label: 'Payment Status', minWidth: 70 },
        { key: 'amount', label: 'Amount', weight: 1.2, minWidth: 75, align: 'right' },
      ],
      rows: expenses.map((e) => ({
        date: formatDateIST(e.date),
        item: e.item?.itemId || '-',
        category: e.category,
        vendor: e.vendor || '-',
        paymentStatus: e.paymentStatus,
        amount: formatINR(e.amount),
      })),
      totalsRow: { date: 'Total', amount: formatINR(grandTotal) },
      summary: Object.entries(totalsByCategory).map(([category, total]) => ({ label: `Total: ${category}`, value: formatINR(total) })),
    });
  }
  res.json({ success: true, data: { expenses, totalsByCategory, grandTotal } });
});

const refurbishmentReport = asyncHandler(async (req, res) => {
  const pdf = wantsPdf(req);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (pdf) await assertPdfRowLimit(Refurbishment, filter);
  const jobs = await Refurbishment.find(filter).populate('item', 'itemId name').sort({ createdAt: -1 });

  if (pdf) {
    return sendReportPdf(req, res, ['status'], {
      title: 'Refurbishment Report',
      filenameBase: 'refurbishment-report',
      columns: [
        { key: 'item', label: 'Item', minWidth: 60 },
        { key: 'work', label: 'Work', weight: 3, minWidth: 120 },
        { key: 'assignedTo', label: 'Assigned To', weight: 1.5, minWidth: 80 },
        { key: 'cost', label: 'Cost', weight: 1.2, minWidth: 75, align: 'right' },
        { key: 'status', label: 'Status', minWidth: 65 },
      ],
      rows: jobs.map((j) => ({
        item: j.item?.itemId || '-',
        work: j.workDescription,
        assignedTo: j.assignedTo,
        cost: formatINR(j.repairCost),
        status: j.status,
      })),
      totalsRow: { item: 'Total', cost: formatINR(sum(jobs, (j) => j.repairCost)) },
      summary: [{ label: 'Jobs', value: String(jobs.length) }],
    });
  }
  res.json({ success: true, data: jobs });
});

const salesReport = asyncHandler(async (req, res) => {
  const pdf = wantsPdf(req);
  const filter = { ...dateRangeFilter('createdAt', req) };
  if (req.query.status) filter.status = req.query.status;
  if (pdf) await assertPdfRowLimit(SaleProposal, filter);
  const proposals = await SaleProposal.find(filter).populate('item', 'itemId name').populate('buyer', 'buyerId name businessName').sort({ createdAt: -1 });
  const totalSalesValue = proposals.filter((p) => p.status === 'Converted').reduce((s, p) => s + (p.proposedPrice - p.discountAmount), 0);

  if (pdf) {
    return sendReportPdf(req, res, ['from', 'to', 'status'], {
      title: 'Sales Report',
      filenameBase: 'sales-report',
      columns: [
        { key: 'proposalNumber', label: 'Proposal #', minWidth: 75 },
        { key: 'item', label: 'Item', minWidth: 60 },
        { key: 'buyer', label: 'Buyer', weight: 2, minWidth: 90 },
        { key: 'price', label: 'Price', weight: 1.2, minWidth: 75, align: 'right' },
        { key: 'margin', label: 'Margin', weight: 1.2, minWidth: 75, align: 'right' },
        { key: 'status', label: 'Status', minWidth: 70 },
      ],
      rows: proposals.map((p) => ({
        proposalNumber: p.proposalNumber,
        item: p.item?.itemId || '-',
        buyer: partyName(p.buyer),
        price: formatINR(p.proposedPrice),
        margin: formatINR(p.marginAmount),
        status: p.status,
      })),
      summary: [
        { label: 'Proposals', value: String(proposals.length) },
        { label: 'Total Sales Value (converted)', value: formatINR(totalSalesValue) },
      ],
    });
  }
  res.json({ success: true, data: { proposals, totalSalesValue } });
});

const pendingApprovalsReport = asyncHandler(async (req, res) => {
  const pdf = wantsPdf(req);
  if (pdf) await assertPdfRowLimit(Approval, { decision: 'Pending' });
  const approvals = await Approval.find({ decision: 'Pending' }).populate('saleProposal').sort({ createdAt: -1 });

  if (pdf) {
    return sendReportPdf(req, res, [], {
      title: 'Pending Approvals',
      filenameBase: 'pending-approvals',
      columns: [
        { key: 'proposalNumber', label: 'Proposal #', minWidth: 90 },
        { key: 'requested', label: 'Requested', minWidth: 80 },
        { key: 'decision', label: 'Decision', minWidth: 70 },
      ],
      rows: approvals.map((a) => ({
        proposalNumber: a.saleProposal?.proposalNumber || '-',
        requested: formatDateIST(a.requestedAt),
        decision: a.decision,
      })),
      summary: [{ label: 'Pending approvals', value: String(approvals.length) }],
    });
  }
  res.json({ success: true, data: approvals });
});

const paymentOutstandingReport = asyncHandler(async (req, res) => {
  const pdf = wantsPdf(req);
  const filter = { paymentStatus: { $in: ['Unpaid', 'Partially Paid'] } };
  if (pdf) await assertPdfRowLimit(Invoice, filter);
  const invoices = await Invoice.find(filter).populate('buyer', 'buyerId name businessName').populate('item', 'itemId name');
  const totalOutstanding = invoices.reduce((s, i) => s + (i.grandTotal - i.amountPaid), 0);

  if (pdf) {
    return sendReportPdf(req, res, [], {
      title: 'Outstanding Payments',
      filenameBase: 'outstanding-payments',
      columns: [
        { key: 'invoiceNumber', label: 'Invoice #', minWidth: 85 },
        { key: 'buyer', label: 'Buyer', weight: 2, minWidth: 90 },
        { key: 'grandTotal', label: 'Grand Total', weight: 1.2, minWidth: 75, align: 'right' },
        { key: 'paid', label: 'Paid', weight: 1.2, minWidth: 75, align: 'right' },
        { key: 'balance', label: 'Balance', weight: 1.2, minWidth: 75, align: 'right' },
        { key: 'status', label: 'Status', minWidth: 75 },
      ],
      rows: invoices.map((i) => ({
        invoiceNumber: i.invoiceNumber,
        buyer: partyName(i.buyer),
        grandTotal: formatINR(i.grandTotal),
        paid: formatINR(i.amountPaid),
        balance: formatINR(i.grandTotal - i.amountPaid),
        status: i.paymentStatus,
      })),
      totalsRow: {
        invoiceNumber: 'Total',
        grandTotal: formatINR(sum(invoices, (i) => i.grandTotal)),
        paid: formatINR(sum(invoices, (i) => i.amountPaid)),
        balance: formatINR(totalOutstanding),
      },
      summary: [{ label: 'Total Outstanding', value: formatINR(totalOutstanding) }],
    });
  }
  res.json({ success: true, data: { invoices, totalOutstanding } });
});

const settlementReport = asyncHandler(async (req, res) => {
  const pdf = wantsPdf(req);
  const filter = {};
  if (req.query.owner) filter.owner = req.query.owner;
  if (req.query.status) filter.status = req.query.status;
  if (pdf) await assertPdfRowLimit(Settlement, filter);
  const settlements = await Settlement.find(filter).populate('item', 'itemId name').populate('owner', 'customerId name businessName').sort({ createdAt: -1 });
  const totals = {
    totalCommission: settlements.reduce((s, x) => s + x.commissionAmount, 0),
    totalOwnerPayable: settlements.reduce((s, x) => s + x.ownerPayable, 0),
    totalPending: settlements.filter((x) => x.status === 'Pending').reduce((s, x) => s + x.ownerPayable, 0),
  };

  if (pdf) {
    return sendReportPdf(req, res, ['owner', 'status'], {
      title: 'Commission & Settlement Report',
      filenameBase: 'commission-settlement-report',
      columns: [
        { key: 'item', label: 'Item', minWidth: 60 },
        { key: 'owner', label: 'Owner', weight: 2, minWidth: 90 },
        { key: 'commission', label: 'Commission', weight: 1.2, minWidth: 75, align: 'right' },
        { key: 'ownerPayable', label: 'Owner Payable', weight: 1.2, minWidth: 75, align: 'right' },
        { key: 'status', label: 'Status', minWidth: 65 },
      ],
      rows: settlements.map((s) => ({
        item: s.item?.itemId || '-',
        owner: partyName(s.owner),
        commission: formatINR(s.commissionAmount),
        ownerPayable: formatINR(s.ownerPayable),
        status: s.status,
      })),
      totalsRow: { item: 'Total', commission: formatINR(totals.totalCommission), ownerPayable: formatINR(totals.totalOwnerPayable) },
      summary: [
        { label: 'Total Commission', value: formatINR(totals.totalCommission) },
        { label: 'Total Owner Payable', value: formatINR(totals.totalOwnerPayable) },
        { label: 'Pending Owner Payable', value: formatINR(totals.totalPending) },
      ],
    });
  }
  res.json({ success: true, data: { settlements, totals } });
});

const dispatchReport = asyncHandler(async (req, res) => {
  const pdf = wantsPdf(req);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (pdf) await assertPdfRowLimit(Dispatch, filter);
  const dispatches = await Dispatch.find(filter).populate('item', 'itemId name').populate('buyer', 'buyerId name businessName').sort({ createdAt: -1 });

  if (pdf) {
    return sendReportPdf(req, res, ['status'], {
      title: 'Dispatch Report',
      filenameBase: 'dispatch-report',
      columns: [
        { key: 'dispatchNumber', label: 'Dispatch #', minWidth: 85 },
        { key: 'item', label: 'Item', minWidth: 60 },
        { key: 'buyer', label: 'Buyer', weight: 2, minWidth: 90 },
        { key: 'status', label: 'Status', minWidth: 70 },
      ],
      rows: dispatches.map((d) => ({
        dispatchNumber: d.dispatchNumber,
        item: d.item?.itemId || '-',
        buyer: partyName(d.buyer),
        status: d.status,
      })),
      summary: [{ label: 'Dispatches', value: String(dispatches.length) }],
    });
  }
  res.json({ success: true, data: dispatches });
});

const auditReport = asyncHandler(async (req, res) => {
  const pdf = wantsPdf(req);
  const filter = { ...dateRangeFilter('createdAt', req) };
  if (req.query.entityType) filter.entityType = req.query.entityType;
  if (req.query.user) filter.performedBy = req.query.user;
  const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(AUDIT_LIMIT);

  if (pdf) {
    const summary = [{ label: 'Entries', value: String(logs.length) }];
    if (logs.length === AUDIT_LIMIT) summary.push({ label: 'Note', value: `Most recent ${AUDIT_LIMIT} entries (same limit as the on-screen log)` });
    return sendReportPdf(req, res, ['from', 'to', 'entityType', 'user'], {
      title: 'Audit / Activity Log',
      filenameBase: 'audit-activity-log',
      columns: [
        { key: 'when', label: 'When', weight: 1.5, minWidth: 100 },
        { key: 'entity', label: 'Entity', minWidth: 70 },
        { key: 'action', label: 'Action', weight: 1.5, minWidth: 90 },
        { key: 'by', label: 'By', weight: 1.5, minWidth: 80 },
      ],
      rows: logs.map((l) => ({
        when: formatDateTimeIST(l.createdAt),
        entity: l.entityType,
        action: l.action,
        by: l.performedByName || 'System',
      })),
      summary,
    });
  }
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
