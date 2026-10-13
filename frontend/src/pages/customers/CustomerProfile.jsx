import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { customerApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState } from '../../components/common/States';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';

const TABS = ['Overview', 'Inventory', 'Expenses', 'Invoices', 'Settlements', 'Documents'];

export default function CustomerProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Overview');

  function load() {
    setLoading(true);
    customerApi
      .profile(id)
      .then((res) => setData(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const { customer, items, expenses, invoices, settlements, summary } = data;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{customer.businessName || customer.name}</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>
            {customer.customerId} · {customer.customerType} · <StatusBadge status={customer.isActive ? 'Active' : 'Inactive'} />
          </p>
        </div>
      </div>

      <div className="stat-cards" style={{ marginBottom: 16 }}>
        <div className="stat-card"><div className="label">Total Items</div><div className="value">{summary.totalItems}</div></div>
        <div className="stat-card"><div className="label">Total Expenses</div><div className="value">{formatCurrency(summary.totalExpenses)}</div></div>
        <div className="stat-card"><div className="label">Total Invoiced</div><div className="value">{formatCurrency(summary.totalInvoiced)}</div></div>
        <div className="stat-card"><div className="label">Settled Payout</div><div className="value">{formatCurrency(summary.totalSettled)}</div></div>
        <div className="stat-card"><div className="label">Pending Payout</div><div className="value">{formatCurrency(summary.totalPendingSettlement)}</div></div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="card form-grid">
          <div><strong>Phone:</strong> {customer.phone}</div>
          <div><strong>Email:</strong> {customer.email || '-'}</div>
          <div><strong>GSTIN:</strong> {customer.gstin || '-'}</div>
          <div><strong>Contact Person:</strong> {customer.contactPerson || '-'}</div>
          <div style={{ gridColumn: '1 / -1' }}><strong>Address:</strong> {customer.address || '-'}</div>
          <div><strong>Agreement No:</strong> {customer.agreement?.number || '-'}</div>
          <div><strong>Agreement Period:</strong> {formatDate(customer.agreement?.startDate)} - {formatDate(customer.agreement?.endDate)}</div>
          <div style={{ gridColumn: '1 / -1' }}><strong>Notes:</strong> {customer.notes || '-'}</div>
        </div>
      )}

      {tab === 'Inventory' && (
        <table className="data-table">
          <thead><tr><th>Item ID</th><th>Name</th><th>Status</th><th>Purchase Cost</th><th>Est. Resale</th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i._id}>
                <td><Link to={`/inventory/${i._id}`}>{i.itemId}</Link></td>
                <td>{i.name}</td>
                <td><StatusBadge status={i.status} /></td>
                <td>{formatCurrency(i.purchaseCost)}</td>
                <td>{formatCurrency(i.estimatedResaleValue)}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5}>No inventory linked to this customer yet.</td></tr>}
          </tbody>
        </table>
      )}

      {tab === 'Expenses' && (
        <table className="data-table">
          <thead><tr><th>Date</th><th>Item</th><th>Category</th><th>Amount</th><th>Payment Status</th></tr></thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e._id}>
                <td>{formatDate(e.date)}</td>
                <td>{e.item?.itemId || '-'}</td>
                <td>{e.category}</td>
                <td>{formatCurrency(e.amount)}</td>
                <td><StatusBadge status={e.paymentStatus} /></td>
              </tr>
            ))}
            {expenses.length === 0 && <tr><td colSpan={5}>No expenses recorded.</td></tr>}
          </tbody>
        </table>
      )}

      {tab === 'Invoices' && (
        <table className="data-table">
          <thead><tr><th>Invoice #</th><th>Date</th><th>Grand Total</th><th>Status</th></tr></thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv._id}>
                <td><Link to={`/invoices/${inv._id}`}>{inv.invoiceNumber}</Link></td>
                <td>{formatDate(inv.invoiceDate)}</td>
                <td>{formatCurrency(inv.grandTotal)}</td>
                <td><StatusBadge status={inv.paymentStatus} /></td>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={4}>No invoices yet.</td></tr>}
          </tbody>
        </table>
      )}

      {tab === 'Settlements' && (
        <table className="data-table">
          <thead><tr><th>Item</th><th>Sale Price</th><th>Commission</th><th>Owner Payable</th><th>Status</th></tr></thead>
          <tbody>
            {settlements.map((s) => (
              <tr key={s._id}>
                <td>{s.item?.itemId}</td>
                <td>{formatCurrency(s.salePrice)}</td>
                <td>{formatCurrency(s.commissionAmount)}</td>
                <td>{formatCurrency(s.ownerPayable)}</td>
                <td><StatusBadge status={s.status} /></td>
              </tr>
            ))}
            {settlements.length === 0 && <tr><td colSpan={5}>No settlements yet.</td></tr>}
          </tbody>
        </table>
      )}

      {tab === 'Documents' && (
        <div className="thumb-gallery">
          {[...customer.documents, ...customer.photos].map((f) => (
            <a key={f._id} href={f.url} target="_blank" rel="noreferrer" className="thumb">
              <img src={f.url} alt={f.originalName} onError={(e) => (e.target.style.display = 'none')} />
            </a>
          ))}
          {customer.documents.length + customer.photos.length === 0 && <p>No documents uploaded.</p>}
        </div>
      )}
    </div>
  );
}
