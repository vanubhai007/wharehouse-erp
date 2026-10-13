import { useEffect, useState } from 'react';
import { itemApi, buyerApi, saleProposalApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';

export default function SaleProposalForm({ preselectedItem, onClose, onSaved }) {
  const [items, setItems] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [form, setForm] = useState({ item: preselectedItem || '', buyer: '', proposedPrice: '', discountAmount: 0, gstPercent: 18 });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    itemApi.list({ status: 'Available for Sale', limit: 200 }).then((res) => setItems(res.data.data));
    buyerApi.list({ limit: 200 }).then((res) => setBuyers(res.data.data));
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await saleProposalApi.create({
        ...form,
        proposedPrice: Number(form.proposedPrice),
        discountAmount: Number(form.discountAmount) || 0,
        gstPercent: Number(form.gstPercent) || 0,
      });
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Sale Proposal" onClose={onClose}>
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>Item (must be "Available for Sale") <span className="required">*</span></label>
          <select required value={form.item} onChange={(e) => set('item', e.target.value)}>
            <option value="">Select item...</option>
            {items.map((i) => <option key={i._id} value={i._id}>{i.itemId} - {i.name} (Est. {i.estimatedResaleValue || 'N/A'})</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Buyer <span className="required">*</span></label>
          <select required value={form.buyer} onChange={(e) => set('buyer', e.target.value)}>
            <option value="">Select buyer...</option>
            {buyers.map((b) => <option key={b._id} value={b._id}>{b.businessName || b.name}</option>)}
          </select>
        </div>
        <div className="form-grid">
          <div className="form-field">
            <label>Proposed Price <span className="required">*</span></label>
            <input required type="number" min="0.01" value={form.proposedPrice} onChange={(e) => set('proposedPrice', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Discount Amount</label>
            <input type="number" min="0" value={form.discountAmount} onChange={(e) => set('discountAmount', e.target.value)} />
          </div>
          <div className="form-field">
            <label>GST %</label>
            <input type="number" min="0" value={form.gstPercent} onChange={(e) => set('gstPercent', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Proposal'}</button>
        </div>
      </form>
    </Modal>
  );
}
