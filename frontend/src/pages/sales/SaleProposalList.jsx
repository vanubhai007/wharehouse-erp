import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { saleProposalApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/States';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency } from '../../utils/format';
import SaleProposalForm from './SaleProposalForm';

export default function SaleProposalList() {
  const [params] = useSearchParams();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(!!params.get('item'));

  function load() {
    setLoading(true);
    saleProposalApi
      .list(status ? { status } : {})
      .then((res) => setProposals(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [status]);

  async function handleSubmitForApproval(id) {
    try {
      await saleProposalApi.submitForApproval(id);
      load();
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  }

  async function handleCancel(id) {
    if (!window.confirm('Cancel this sale proposal and return the item to Available for Sale?')) return;
    try {
      await saleProposalApi.cancel(id);
      load();
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Sale Proposals</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Proposal</button>
      </div>

      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option>Draft</option><option>Submitted</option><option>Approval Pending</option>
          <option>Approved</option><option>Rejected</option><option>Converted</option><option>Cancelled</option>
        </select>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : proposals.length === 0 ? (
        <EmptyState message="No sale proposals yet." />
      ) : (
        <table className="data-table">
          <thead><tr><th>Proposal #</th><th>Item</th><th>Buyer</th><th>Price</th><th>Margin</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {proposals.map((p) => (
              <tr key={p._id}>
                <td><Link to={`/sales/${p._id}`}>{p.proposalNumber}</Link></td>
                <td>{p.item?.itemId} - {p.item?.name}</td>
                <td>{p.buyer?.businessName || p.buyer?.name}</td>
                <td>{formatCurrency(p.proposedPrice)}</td>
                <td>{formatCurrency(p.marginAmount)} ({p.marginPercent}%)</td>
                <td><StatusBadge status={p.status} /></td>
                <td>
                  {p.status === 'Submitted' && (
                    <button className="btn btn-sm btn-primary" onClick={() => handleSubmitForApproval(p._id)}>Submit for Approval</button>
                  )}{' '}
                  {!['Converted', 'Cancelled', 'Rejected'].includes(p.status) && (
                    <button className="btn btn-sm btn-danger" onClick={() => handleCancel(p._id)}>Cancel</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <SaleProposalForm
          preselectedItem={params.get('item')}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}
