const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Settings = require('../models/Settings');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { recordAudit } = require('../utils/audit');
const { mapUploadedFiles } = require('../utils/fileMapper');
const { generateReceiptPdf } = require('../services/pdfService');

const listPayments = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.invoice) filter.invoice = req.query.invoice;
  if (req.query.item) filter.item = req.query.item;
  if (req.query.direction) filter.direction = req.query.direction;
  const payments = await Payment.find(filter).populate('invoice', 'invoiceNumber grandTotal').sort({ date: -1 });
  res.json({ success: true, data: payments });
});

// Records a payment and, if linked to an invoice, updates its running
// amountPaid/paymentStatus. An invoice is never marked Paid just because it
// was generated - only an actual recorded payment moves that status.
const createPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.create({ ...req.body, recordedBy: req.user._id });

  if (payment.invoice) {
    const invoice = await Invoice.findById(payment.invoice);
    if (!invoice) throw ApiError.badRequest('Invalid invoice reference');
    invoice.amountPaid = Math.round((invoice.amountPaid + payment.amount) * 100) / 100;
    invoice.paymentStatus = invoice.amountPaid >= invoice.grandTotal ? 'Paid' : invoice.amountPaid > 0 ? 'Partially Paid' : 'Unpaid';
    await invoice.save();
  }

  await recordAudit({ entityType: 'Payment', entityId: payment._id, action: 'CREATE', user: req.user, toValue: { amount: payment.amount, direction: payment.direction } });
  res.status(201).json({ success: true, data: payment });
});

const addProof = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound('Payment not found');
  if (!req.files || req.files.length === 0) throw ApiError.badRequest('No files uploaded');
  payment.proof.push(...mapUploadedFiles(req.files, req.user._id, 'Payment proof'));
  await payment.save();
  res.status(201).json({ success: true, data: payment });
});

const downloadReceipt = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound('Payment not found');
  const invoice = payment.invoice ? await Invoice.findById(payment.invoice) : null;
  const settings = await Settings.getSettings();
  generateReceiptPdf(res, payment, invoice, settings);
});

module.exports = { listPayments, createPayment, addProof, downloadReceipt };
