import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { invoiceApi } from '../../api/endpoints';
import { apiErrorMessage, downloadAuthenticated } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/States';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';
import QuotationForm from './QuotationForm';

export default function InvoiceList() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [type, setType] = useState('');
  const [showQuotationForm, setShowQuotationForm] = useState(false);

  function load() {
    setLoading(true);
    invoiceApi
      .list(type ? { type } : {})
      .then((res) => setInvoices(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [type]);

  async function handleDownload(inv) {
    try {
      await downloadAuthenticated(invoiceApi.pdfPath(inv._id), `${inv.invoiceNumber}.pdf`, 'view');
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Invoices & Quotations</h1>
        <button className="btn btn-primary" onClick={() => setShowQuotationForm(true)}>+ New Quotation</button>
      </div>

      <div className="toolbar">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="Invoice">Invoices</option>
          <option value="Quotation">Quotations</option>
        </select>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : invoices.length === 0 ? (
        <EmptyState message="No invoices or quotations yet." />
      ) : (
        <table className="data-table">
          <thead><tr><th>Number</th><th>Type</th><th>Buyer</th><th>Date</th><th>Grand Total</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv._id}>
                <td><Link to={`/invoices/${inv._id}`}>{inv.invoiceNumber}</Link></td>
                <td>{inv.type}</td>
                <td>{inv.buyer?.businessName || inv.buyer?.name}</td>
                <td>{formatDate(inv.invoiceDate)}</td>
                <td>{formatCurrency(inv.grandTotal)}</td>
                <td>{inv.type === 'Invoice' ? <StatusBadge status={inv.paymentStatus} /> : '-'}</td>
                <td><button className="btn btn-sm btn-secondary" onClick={() => handleDownload(inv)}>View/Print PDF</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showQuotationForm && <QuotationForm onClose={() => setShowQuotationForm(false)} onSaved={() => { setShowQuotationForm(false); load(); }} />}
    </div>
  );
}
