import { useEffect, useState } from 'react';
import { saleProposalApi, settlementApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';

export default function SettlementForm({ onClose, onSaved }) {
  const [proposals, setProposals] = useState([]);
  const [saleProposal, setSaleProposal] = useState('');
  const [commissionType, setCommissionType] = useState('percent');
  const [commissionRate, setCommissionRate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    saleProposalApi.list({ status: 'Converted' }).then((res) => setProposals(res.data.data));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { saleProposal };
      if (commissionRate) {
        payload.commissionType = commissionType;
        payload.commissionRate = Number(commissionRate);
      }
      await settlementApi.create(payload);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Create Settlement" onClose={onClose}>
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>Sale Proposal (converted sales only) <span className="required">*</span></label>
          <select required value={saleProposal} onChange={(e) => setSaleProposal(e.target.value)}>
            <option value="">Select...</option>
            {proposals.map((p) => <option key={p._id} value={p._id}>{p.proposalNumber} - {p.item?.itemId}</option>)}
          </select>
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Leave commission blank to use the system default (configured in Settings).
        </p>
        <div className="form-grid">
          <div className="form-field">
            <label>Commission Type</label>
            <select value={commissionType} onChange={(e) => setCommissionType(e.target.value)}>
              <option value="percent">Percent of sale price</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </div>
          <div className="form-field">
            <label>Commission Rate (override)</label>
            <input type="number" min="0" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Settlement'}</button>
        </div>
      </form>
    </Modal>
  );
}
