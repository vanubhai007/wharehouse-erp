import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { saleProposalApi, invoiceApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState } from '../../components/common/States';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency, formatDateTime } from '../../utils/format';

export default function SaleProposalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  function load() {
    setLoading(true);
    saleProposalApi
      .get(id)
      .then((res) => {
        setProposal(res.data.data.proposal);
        setApprovals(res.data.data.approvals);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [id]);

  async function handleGenerateInvoice() {
    setGenerating(true);
    try {
      const res = await invoiceApi.createFromProposal({ saleProposal: id });
      navigate(`/invoices/${res.data.data._id}`);
    } catch (err) {
      alert(apiErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!proposal) return null;
  const c = proposal.costSnapshot;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{proposal.proposalNumber}</h1>
          <StatusBadge status={proposal.status} />
        </div>
        {proposal.status === 'Approved' && (
          <button className="btn btn-primary" onClick={handleGenerateInvoice} disabled={generating}>
            {generating ? 'Generating...' : 'Generate Invoice'}
          </button>
        )}
        {proposal.status === 'Converted' && (
          <button className="btn btn-secondary" onClick={() => navigate(`/dispatch?proposal=${id}`)}>Create Dispatch</button>
        )}
      </div>

      <div className="form-grid">
        <div className="card">
          <h4>Item & Buyer</h4>
          <p><strong>Item:</strong> {proposal.item?.itemId} - {proposal.item?.name}</p>
          <p><strong>Buyer:</strong> {proposal.buyer?.businessName || proposal.buyer?.name}</p>
          <p><strong>Proposed Price:</strong> {formatCurrency(proposal.proposedPrice)}</p>
          <p><strong>Discount:</strong> {formatCurrency(proposal.discountAmount)}</p>
          <p><strong>GST %:</strong> {proposal.gstPercent}%</p>
        </div>
        <div className="card">
          <h4>Cost Snapshot & Margin (at proposal time)</h4>
          <table className="data-table">
            <tbody>
              <tr><td>Base Cost</td><td>{formatCurrency(c.baseCost)}</td></tr>
              <tr><td>Rental</td><td>{formatCurrency(c.rental)}</td></tr>
              <tr><td>Refurbishment</td><td>{formatCurrency(c.refurbishment)}</td></tr>
              <tr><td>Marketing</td><td>{formatCurrency(c.marketing)}</td></tr>
              <tr><td>Logistics</td><td>{formatCurrency(c.logistics)}</td></tr>
              <tr><td>Other</td><td>{formatCurrency(c.other)}</td></tr>
              <tr style={{ fontWeight: 700 }}><td>Total Cost</td><td>{formatCurrency(c.totalCost)}</td></tr>
              <tr style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                <td>Margin</td><td>{formatCurrency(proposal.marginAmount)} ({proposal.marginPercent}%)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h4>Approval History</h4>
        {approvals.length === 0 ? <p>Not yet submitted for approval.</p> : (
          <table className="data-table">
            <thead><tr><th>Requested</th><th>Decision</th><th>Decided By</th><th>Remarks</th></tr></thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a._id}>
                  <td>{formatDateTime(a.requestedAt)}</td>
                  <td><StatusBadge status={a.decision} /></td>
                  <td>{a.decidedByName || '-'}</td>
                  <td>{a.remarks || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
