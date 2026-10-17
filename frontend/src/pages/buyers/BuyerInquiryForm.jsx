import { useEffect, useState } from 'react';
import { buyerApi, itemApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';

export default function BuyerInquiryForm({ onClose, onSaved }) {
  const [buyers, setBuyers] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ buyer: '', item: '', proposedPrice: '', note: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    buyerApi.list({ limit: 200 }).then((res) => setBuyers(res.data.data));
    // Live inventory data, same source as the rest of the app - prices are
    // never entered manually here, only read for reference.
    itemApi.list({ status: 'Available for Sale', limit: 200 }).then((res) => setItems(res.data.data));
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { buyer: form.buyer, item: form.item, note: form.note };
      if (form.proposedPrice) payload.proposedPrice = Number(form.proposedPrice);
      await buyerApi.createEnquiry(payload);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const selectedItem = items.find((i) => i._id === form.item);

  return (
    <Modal title="New Buyer Inquiry" onClose={onClose}>
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>Buyer <span className="required">*</span></label>
          <select required value={form.buyer} onChange={(e) => set('buyer', e.target.value)}>
            <option value="">Select buyer...</option>
            {buyers.map((b) => <option key={b._id} value={b._id}>{b.businessName || b.name} ({b.buyerId})</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Item (Available for Sale) <span className="required">*</span></label>
          <select required value={form.item} onChange={(e) => set('item', e.target.value)}>
            <option value="">Select item...</option>
            {items.map((i) => <option key={i._id} value={i._id}>{i.itemId} - {i.name}</option>)}
          </select>
          {selectedItem?.estimatedResaleValue !== undefined && selectedItem?.estimatedResaleValue !== null && (
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Estimated resale value: ₹{selectedItem.estimatedResaleValue}
            </span>
          )}
        </div>
        <div className="form-grid">
          <div className="form-field">
            <label>Initial Proposed Price (optional)</label>
            <input type="number" min="0" value={form.proposedPrice} onChange={(e) => set('proposedPrice', e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label>Note</label>
          <textarea rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create Inquiry'}</button>
        </div>
      </form>
    </Modal>
  );
}
