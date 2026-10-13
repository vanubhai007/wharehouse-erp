import { useEffect, useState } from 'react';
import { saleProposalApi, dispatchApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';

export default function DispatchForm({ preselectedProposal, onClose, onSaved }) {
  const [proposals, setProposals] = useState([]);
  const [form, setForm] = useState({
    saleProposal: preselectedProposal || '', deliveryAddress: '', deliveryContactName: '', deliveryContactPhone: '',
    transporterName: '', trackingReference: '', scheduledDate: '', outboundLogisticsCost: 0,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    saleProposalApi.list({ status: 'Converted' }).then((res) => setProposals(res.data.data));
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await dispatchApi.create({ ...form, outboundLogisticsCost: Number(form.outboundLogisticsCost) || 0 });
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Dispatch" onClose={onClose}>
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>Sale Proposal (invoiced sales only) <span className="required">*</span></label>
          <select required value={form.saleProposal} onChange={(e) => set('saleProposal', e.target.value)}>
            <option value="">Select...</option>
            {proposals.map((p) => <option key={p._id} value={p._id}>{p.proposalNumber} - {p.item?.itemId}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Delivery Address <span className="required">*</span></label>
          <textarea required rows={2} value={form.deliveryAddress} onChange={(e) => set('deliveryAddress', e.target.value)} />
        </div>
        <div className="form-grid">
          <div className="form-field"><label>Contact Name</label><input value={form.deliveryContactName} onChange={(e) => set('deliveryContactName', e.target.value)} /></div>
          <div className="form-field"><label>Contact Phone</label><input value={form.deliveryContactPhone} onChange={(e) => set('deliveryContactPhone', e.target.value)} /></div>
          <div className="form-field"><label>Transporter</label><input value={form.transporterName} onChange={(e) => set('transporterName', e.target.value)} /></div>
          <div className="form-field"><label>Tracking Reference</label><input value={form.trackingReference} onChange={(e) => set('trackingReference', e.target.value)} /></div>
          <div className="form-field"><label>Scheduled Date</label><input type="date" value={form.scheduledDate} onChange={(e) => set('scheduledDate', e.target.value)} /></div>
          <div className="form-field"><label>Outbound Logistics Cost</label><input type="number" min="0" value={form.outboundLogisticsCost} onChange={(e) => set('outboundLogisticsCost', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Dispatch'}</button>
        </div>
      </form>
    </Modal>
  );
}
