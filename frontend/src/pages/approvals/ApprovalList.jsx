import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { approvalApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/States';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';

export default function ApprovalList() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [decisionTarget, setDecisionTarget] = useState(null);
  const [decision, setDecision] = useState('Approved');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [decisionError, setDecisionError] = useState('');

  const canDecide = ['Owner/Approver', 'Admin'].includes(user?.role);

  function load() {
    setLoading(true);
    const call = showAll ? approvalApi.list() : approvalApi.pending();
    call
      .then((res) => setApprovals(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [showAll]);

  async function handleDecide() {
    setSaving(true);
    setDecisionError('');
    try {
      await approvalApi.decide(decisionTarget._id, { decision, remarks });
      setDecisionTarget(null);
      setRemarks('');
      load();
    } catch (err) {
      setDecisionError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Owner Approvals</h1>
      </div>
      <div className="toolbar">
        <label>
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show decided approvals too
        </label>
      </div>

      {!canDecide && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--color-warning-bg)' }}>
          Your role ({user?.role}) can view approvals but only an Owner/Approver or Admin can record a decision.
        </div>
      )}

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : approvals.length === 0 ? (
        <EmptyState message="No approvals to show." />
      ) : (
        <table className="data-table">
          <thead><tr><th>Proposal #</th><th>Item</th><th>Buyer</th><th>Price</th><th>Requested</th><th>Decision</th><th>Actions</th></tr></thead>
          <tbody>
            {approvals.map((a) => (
              <tr key={a._id}>
                <td><Link to={`/sales/${a.saleProposal?._id}`}>{a.saleProposal?.proposalNumber}</Link></td>
                <td>{a.saleProposal?.item?.itemId} - {a.saleProposal?.item?.name}</td>
                <td>{a.saleProposal?.buyer?.businessName || a.saleProposal?.buyer?.name}</td>
                <td>{formatCurrency(a.saleProposal?.proposedPrice)}</td>
                <td>{formatDateTime(a.requestedAt)}</td>
                <td><StatusBadge status={a.decision} /></td>
                <td>
                  {a.decision === 'Pending' && canDecide && (
                    <button className="btn btn-sm btn-primary" onClick={() => { setDecisionTarget(a); setDecision('Approved'); }}>
                      Decide
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {decisionTarget && (
        <Modal title={`Decide: ${decisionTarget.saleProposal?.proposalNumber}`} onClose={() => setDecisionTarget(null)}>
          {decisionError && <p className="form-error">{decisionError}</p>}
          <div className="form-field">
            <label>Decision</label>
            <select value={decision} onChange={(e) => setDecision(e.target.value)}>
              <option value="Approved">Approve</option>
              <option value="Rejected">Reject</option>
            </select>
          </div>
          <div className="form-field">
            <label>Remarks</label>
            <textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setDecisionTarget(null)}>Cancel</button>
            <button className={decision === 'Approved' ? 'btn btn-primary' : 'btn btn-danger'} onClick={handleDecide} disabled={saving}>
              {saving ? 'Saving...' : `Confirm ${decision}`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
