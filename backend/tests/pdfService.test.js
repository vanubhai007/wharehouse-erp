const { PassThrough } = require('stream');
const { generateInvoicePdf, generateReceiptPdf, generateDispatchNotePdf, generateInventoryReportPdf } = require('../services/pdfService');

// Minimal fake Express response: a writable stream with the headers API
// pdfService expects (setHeader/header/attachment), so we can exercise the
// real PDF generation code without an HTTP server or a database.
function fakeResponse() {
  const stream = new PassThrough();
  const chunks = [];
  stream.on('data', (c) => chunks.push(c));
  stream.setHeader = () => {};
  stream.header = () => {};
  stream.attachment = () => {};
  stream.getBuffer = () =>
    new Promise((resolve) => {
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  return stream;
}

const settings = {
  companyName: 'HR Warehouse',
  companyAddress: '123 Industrial Area',
  companyGstin: '27ABCDE1234F1Z5',
  companyPhone: '9999999999',
  companyEmail: 'billing@hrwarehouse.com',
};

describe('pdfService', () => {
  test('generateInvoicePdf produces a valid, non-empty PDF buffer', async () => {
    const res = fakeResponse();
    const invoice = {
      invoiceNumber: 'HRW-INV-2026-00001',
      type: 'Invoice',
      invoiceDate: new Date('2026-05-01'),
      dueDate: new Date('2026-05-15'),
      buyerSnapshot: { name: 'Test Buyer', address: '456 Market Rd', gstin: '29XXXXX1111X1Z1', phone: '8888888888' },
      lineItems: [
        { description: 'Industrial Air Compressor (Machinery)', sku: 'AF-200', quantity: 1, unitPrice: 58000, discount: 1000, gstPercent: 18, lineTotal: 67260, taxableAmount: 57000, gstAmount: 10260 },
      ],
      subtotal: 58000,
      discountTotal: 1000,
      taxableAmount: 57000,
      gstAmount: 10260,
      grandTotal: 67260,
      amountPaid: 20000,
      paymentStatus: 'Partially Paid',
      termsAndConditions: 'Goods once sold are not returnable.',
    };

    generateInvoicePdf(res, invoice, settings);
    const buffer = await res.getBuffer();

    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(buffer.subarray(-7).toString('ascii').trim().endsWith('%%EOF')).toBe(true);
  });

  test('generateReceiptPdf produces a valid PDF', async () => {
    const res = fakeResponse();
    const payment = { _id: 'pay123', date: new Date(), direction: 'Receivable', amount: 20000, mode: 'UPI', referenceNumber: 'UPI-REF-1' };
    generateReceiptPdf(res, payment, { invoiceNumber: 'HRW-INV-2026-00001' }, settings);
    const buffer = await res.getBuffer();
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  test('generateDispatchNotePdf produces a valid PDF', async () => {
    const res = fakeResponse();
    const dispatch = {
      dispatchNumber: 'HRW-DSP-2026-00001', status: 'Pending', deliveryAddress: '456 Market Rd',
      deliveryContactName: 'Test Buyer', deliveryContactPhone: '8888888888', transporterName: 'ABC Logistics', trackingReference: 'TRK123',
    };
    const item = { itemId: 'ITM-00001', name: 'Industrial Air Compressor' };
    generateDispatchNotePdf(res, dispatch, item, settings);
    const buffer = await res.getBuffer();
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  test('generateInventoryReportPdf handles an empty item list without crashing', async () => {
    const res = fakeResponse();
    generateInventoryReportPdf(res, [], settings);
    const buffer = await res.getBuffer();
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });
});
