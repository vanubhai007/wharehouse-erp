import { useState } from 'react';
import { buyerApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';

export default function BuyerForm({ buyer, onClose, onSaved }) {
  const [form, setForm] = useState(buyer || { name: '', businessName: '', phone: '', email: '', address: '', gstin: '', notes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (buyer) await buyerApi.update(buyer._id, form);
      else await buyerApi.create(form);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={buyer ? 'Edit Buyer' : 'New Buyer'} onClose={onClose}>
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-field">
            <label>Name <span className="required">*</span></label>
            <input required value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Business Name</label>
            <input value={form.businessName} onChange={(e) => set('businessName', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Phone <span className="required">*</span></label>
            <input required value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div className="form-field">
            <label>GSTIN</label>
            <input value={form.gstin} onChange={(e) => set('gstin', e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label>Address</label>
          <textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
