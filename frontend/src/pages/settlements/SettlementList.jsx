import { useEffect, useState } from 'react';
import { settlementApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/States';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { formatCurrency } from '../../utils/format';
import SettlementForm from './SettlementForm';

export default function SettlementList() {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [settleTarget, setSettleTarget] = useState(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    settlementApi
      .list()
      .then((res) => setSettlements(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleSettle() {
    setSaving(true);
    try {
      await settlementApi.settle(settleTarget._id, { paymentReference });
      setSettleTarget(null);
      setPaymentReference('');
      load();
    } catch (err) {
      alert(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Owner Settlements</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Settlement</button>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : settlements.length === 0 ? (
        <EmptyState message="No settlements yet." />
      ) : (
        <table className="data-table">
          <thead><tr><th>Item</th><th>Owner</th><th>Sale Price</th><th>Commission</th><th>Owner Payable</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {settlements.map((s) => (
              <tr key={s._id}>
                <td>{s.item?.itemId}</td>
                <td>{s.owner?.businessName || s.owner?.name}</td>
                <td>{formatCurrency(s.salePrice)}</td>
                <td>{formatCurrency(s.commissionAmount)}</td>
                <td>{formatCurrency(s.ownerPayable)}</td>
                <td><StatusBadge status={s.status} /></td>
                <td>
                  {s.status === 'Pending' && (
                    <button className="btn btn-sm btn-primary" onClick={() => setSettleTarget(s)}>Mark Settled</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && <SettlementForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}

      {settleTarget && (
        <Modal title="Mark Settlement as Paid" onClose={() => setSettleTarget(null)}>
          <p>Owner payable: {formatCurrency(settleTarget.ownerPayable)}</p>
          <div className="form-field">
            <label>Payment Reference</label>
            <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setSettleTarget(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSettle} disabled={saving}>{saving ? 'Saving...' : 'Confirm Settled'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
