import { useEffect, useState } from 'react';
import { itemApi, buyerApi, invoiceApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';

export default function QuotationForm({ onClose, onSaved }) {
  const [items, setItems] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [form, setForm] = useState({ item: '', buyer: '', quantity: 1, unitPrice: '', discount: 0, gstPercent: 18, validUntil: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    itemApi.list({ limit: 200 }).then((res) => setItems(res.data.data));
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
      await invoiceApi.createQuotation({
        ...form,
        quantity: Number(form.quantity),
        unitPrice: Number(form.unitPrice),
        discount: Number(form.discount) || 0,
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
    <Modal title="New Quotation" onClose={onClose}>
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>Item <span className="required">*</span></label>
          <select required value={form.item} onChange={(e) => set('item', e.target.value)}>
            <option value="">Select item...</option>
            {items.map((i) => <option key={i._id} value={i._id}>{i.itemId} - {i.name}</option>)}
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
          <div className="form-field"><label>Quantity</label><input type="number" min="1" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} /></div>
          <div className="form-field"><label>Unit Price <span className="required">*</span></label><input required type="number" min="0.01" value={form.unitPrice} onChange={(e) => set('unitPrice', e.target.value)} /></div>
          <div className="form-field"><label>Discount</label><input type="number" min="0" value={form.discount} onChange={(e) => set('discount', e.target.value)} /></div>
          <div className="form-field"><label>GST %</label><input type="number" min="0" value={form.gstPercent} onChange={(e) => set('gstPercent', e.target.value)} /></div>
          <div className="form-field"><label>Valid Until</label><input type="date" value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Quotation'}</button>
        </div>
      </form>
    </Modal>
  );
}
