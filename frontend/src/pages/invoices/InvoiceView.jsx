import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { invoiceApi, paymentApi } from '../../api/endpoints';
import { apiErrorMessage, downloadAuthenticated } from '../../api/client';
import { LoadingState, ErrorState } from '../../components/common/States';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';
import PaymentFormModal from './PaymentFormModal';

export default function InvoiceView() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([invoiceApi.get(id), paymentApi.list({ invoice: id })])
      .then(([invRes, payRes]) => {
        setInvoice(invRes.data.data);
        setPayments(payRes.data.data);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [id]);

  async function handleDownload(mode) {
    try {
      await downloadAuthenticated(invoiceApi.pdfPath(id), `${invoice.invoiceNumber}.pdf`, mode);
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  }

  async function handleDownloadReceipt(paymentId, label) {
    try {
      await downloadAuthenticated(paymentApi.receiptPath(paymentId), `${label}.pdf`, 'view');
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!invoice) return null;
  const balance = invoice.grandTotal - invoice.amountPaid;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{invoice.invoiceNumber}</h1>
          <p>{invoice.type} · {formatDate(invoice.invoiceDate)} {invoice.type === 'Invoice' && <StatusBadge status={invoice.paymentStatus} />}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => handleDownload('view')}>View / Print PDF</button>
          <button className="btn btn-secondary" onClick={() => handleDownload('download')}>Download PDF</button>
          {invoice.type === 'Invoice' && balance > 0 && (
            <button className="btn btn-primary" onClick={() => setShowPaymentForm(true)}>Record Payment</button>
          )}
        </div>
      </div>

      <div className="form-grid">
        <div className="card">
          <h4>Bill To</h4>
          <p>{invoice.buyerSnapshot?.name}</p>
          <p>{invoice.buyerSnapshot?.address}</p>
          <p>{invoice.buyerSnapshot?.phone}</p>
          <p>GSTIN: {invoice.buyerSnapshot?.gstin || '-'}</p>
        </div>
        <div className="card">
          <h4>Totals</h4>
          <p>Subtotal: {formatCurrency(invoice.subtotal)}</p>
          <p>Discount: {formatCurrency(invoice.discountTotal)}</p>
          <p>Taxable Amount: {formatCurrency(invoice.taxableAmount)}</p>
          <p>GST: {formatCurrency(invoice.gstAmount)}</p>
          <p style={{ fontWeight: 700 }}>Grand Total: {formatCurrency(invoice.grandTotal)}</p>
          {invoice.type === 'Invoice' && (
            <>
              <p>Amount Paid: {formatCurrency(invoice.amountPaid)}</p>
              <p style={{ fontWeight: 700 }}>Balance Due: {formatCurrency(balance)}</p>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h4>Line Items</h4>
        <table className="data-table">
          <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Discount</th><th>GST %</th><th>Total</th></tr></thead>
          <tbody>
            {invoice.lineItems.map((li, idx) => (
              <tr key={idx}>
                <td>{li.description}</td><td>{li.quantity}</td><td>{formatCurrency(li.unitPrice)}</td>
                <td>{formatCurrency(li.discount)}</td><td>{li.gstPercent}%</td><td>{formatCurrency(li.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invoice.type === 'Invoice' && (
        <div className="card" style={{ marginTop: 16 }}>
          <h4>Payment History</h4>
          {payments.length === 0 ? <p>No payments recorded yet.</p> : (
            <table className="data-table">
              <thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Reference</th><th>Receipt</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id}>
                    <td>{formatDate(p.date)}</td><td>{formatCurrency(p.amount)}</td><td>{p.mode}</td><td>{p.referenceNumber || '-'}</td>
                    <td><button className="btn btn-sm btn-secondary" onClick={() => handleDownloadReceipt(p._id, `receipt-${p._id}`)}>Download</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showPaymentForm && (
        <PaymentFormModal
          invoiceId={id}
          maxAmount={balance}
          onClose={() => setShowPaymentForm(false)}
          onSaved={() => { setShowPaymentForm(false); load(); }}
        />
      )}
    </div>
  );
}
