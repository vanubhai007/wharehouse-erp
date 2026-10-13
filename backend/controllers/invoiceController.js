const Invoice = require('../models/Invoice');
const SaleProposal = require('../models/SaleProposal');
const Item = require('../models/Item');
const Buyer = require('../models/Buyer');
const Settings = require('../models/Settings');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recordAudit } = require('../utils/audit');
const { generateYearlyId } = require('../utils/idGenerator');
const { generateInvoicePdf } = require('../services/pdfService');
const { events } = require('../services/notificationService');

function buildLineItem({ description, sku, quantity = 1, unitPrice, discount = 0, gstPercent = 0 }) {
  const taxableAmount = Math.max(unitPrice * quantity - discount, 0);
  const gstAmount = Math.round(((taxableAmount * gstPercent) / 100) * 100) / 100;
  const lineTotal = Math.round((taxableAmount + gstAmount) * 100) / 100;
  return { description, sku, quantity, unitPrice, discount, gstPercent, taxableAmount, gstAmount, lineTotal };
}

async function buildSellerSnapshot() {
  const settings = await Settings.getSettings();
  return {
    name: settings.companyName,
    address: settings.companyAddress,
    gstin: settings.companyGstin,
    phone: settings.companyPhone,
    email: settings.companyEmail,
  };
}

const listInvoices = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  if (req.query.buyer) filter.buyer = req.query.buyer;
  if (req.query.item) filter.item = req.query.item;
  const invoices = await Invoice.find(filter)
    .populate('item', 'itemId name')
    .populate('buyer', 'buyerId name businessName')
    .sort({ invoiceDate: -1 });
  res.json({ success: true, data: invoices });
});

const getInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id).populate('item').populate('buyer');
  if (!invoice) throw ApiError.notFound('Invoice not found');
  res.json({ success: true, data: invoice });
});

// Creates the tax invoice from an APPROVED sale proposal. This is the only
// path that converts a proposal into a binding sale - blocked entirely
// until owner approval is on record, and idempotent: reopening/re-requesting
// for the same proposal returns the existing invoice instead of duplicating it.
const createInvoiceFromProposal = asyncHandler(async (req, res) => {
  const proposal = await SaleProposal.findById(req.body.saleProposal).populate('item').populate('buyer');
  if (!proposal) throw ApiError.badRequest('Invalid sale proposal');

  const existing = await Invoice.findOne({ saleProposal: proposal._id, type: 'Invoice' });
  if (existing) {
    return res.status(200).json({ success: true, data: existing, message: 'Invoice already exists for this proposal' });
  }

  if (proposal.status !== 'Approved') {
    throw ApiError.forbidden(
      `This sale proposal has not been approved by the owner (current status: '${proposal.status}'). An invoice cannot be generated until it is approved.`
    );
  }

  const item = proposal.item;
  const buyer = proposal.buyer;

  const lineItem = buildLineItem({
    description: `${item.name} (${item.category})`,
    sku: item.sku,
    quantity: 1,
    unitPrice: proposal.proposedPrice,
    discount: proposal.discountAmount,
    gstPercent: proposal.gstPercent,
  });

  const settings = await Settings.getSettings();
  const invoiceNumber = await generateYearlyId(settings.invoicePrefix, 'invoice');

  const invoice = await Invoice.create({
    invoiceNumber,
    type: 'Invoice',
    saleProposal: proposal._id,
    item: item._id,
    buyer: buyer._id,
    seller: await buildSellerSnapshot(),
    buyerSnapshot: { name: buyer.businessName || buyer.name, address: buyer.address, gstin: buyer.gstin, phone: buyer.phone, email: buyer.email },
    invoiceDate: new Date(),
    dueDate: req.body.dueDate,
    lineItems: [lineItem],
    subtotal: lineItem.unitPrice * lineItem.quantity,
    discountTotal: lineItem.discount,
    taxableAmount: lineItem.taxableAmount,
    gstAmount: lineItem.gstAmount,
    grandTotal: lineItem.lineTotal,
    termsAndConditions: req.body.termsAndConditions,
    createdBy: req.user._id,
  });

  proposal.status = 'Converted';
  await proposal.save();

  const itemDoc = await Item.findById(item._id);
  if (itemDoc.status === 'Approved') {
    const from = itemDoc.status;
    itemDoc.status = 'Sold';
    itemDoc.statusHistory.push({ from, to: 'Sold', changedBy: req.user._id, changedByName: req.user.name, remarks: `Invoice ${invoiceNumber} generated` });
    await itemDoc.save();
  }

  await recordAudit({ entityType: 'Invoice', entityId: invoice._id, action: 'CREATE', user: req.user, toValue: { invoiceNumber, grandTotal: invoice.grandTotal } });
  events.invoiceGenerated(invoice, buyer).catch(() => {});

  res.status(201).json({ success: true, data: invoice });
});

// A quotation is non-binding and does not require approval or change item status.
const createQuotation = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.body.item);
  if (!item) throw ApiError.badRequest('Invalid item');
  const buyer = await Buyer.findById(req.body.buyer);
  if (!buyer) throw ApiError.badRequest('Invalid buyer');

  const lineItem = buildLineItem({
    description: `${item.name} (${item.category})`,
    sku: item.sku,
    quantity: req.body.quantity || 1,
    unitPrice: req.body.unitPrice,
    discount: req.body.discount || 0,
    gstPercent: req.body.gstPercent || 0,
  });

  const settings = await Settings.getSettings();
  const invoiceNumber = await generateYearlyId(settings.quotationPrefix, 'quotation');

  const quotation = await Invoice.create({
    invoiceNumber,
    type: 'Quotation',
    item: item._id,
    buyer: buyer._id,
    seller: await buildSellerSnapshot(),
    buyerSnapshot: { name: buyer.businessName || buyer.name, address: buyer.address, gstin: buyer.gstin, phone: buyer.phone, email: buyer.email },
    invoiceDate: new Date(),
    validUntil: req.body.validUntil,
    lineItems: [lineItem],
    subtotal: lineItem.unitPrice * lineItem.quantity,
    discountTotal: lineItem.discount,
    taxableAmount: lineItem.taxableAmount,
    gstAmount: lineItem.gstAmount,
    grandTotal: lineItem.lineTotal,
    termsAndConditions: req.body.termsAndConditions,
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, data: quotation });
});

const downloadPdf = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id).populate('item').populate('buyer');
  if (!invoice) throw ApiError.notFound('Invoice not found');
  const settings = await Settings.getSettings();
  generateInvoicePdf(res, invoice, settings);
});

module.exports = { listInvoices, getInvoice, createInvoiceFromProposal, createQuotation, downloadPdf };
