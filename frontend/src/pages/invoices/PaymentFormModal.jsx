import { useState } from 'react';
import { paymentApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';
import FileUpload from '../../components/common/FileUpload';

export default function PaymentFormModal({ invoiceId, maxAmount, onClose, onSaved }) {
  const [form, setForm] = useState({ amount: '', mode: 'Bank Transfer', referenceNumber: '', notes: '', proof: [] });
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
      await paymentApi.create({ ...form, invoice: invoiceId, direction: 'Receivable', amount: Number(form.amount) });
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Record Payment" onClose={onClose}>
      {error && <p className="form-error">{error}</p>}
      {maxAmount !== undefined && <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Outstanding balance: ₹{maxAmount}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-field"><label>Amount <span className="required">*</span></label><input required type="number" min="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} /></div>
          <div className="form-field">
            <label>Mode</label>
            <select value={form.mode} onChange={(e) => set('mode', e.target.value)}>
              <option>Cash</option><option>Bank Transfer</option><option>UPI</option><option>Cheque</option><option>Card</option><option>Other</option>
            </select>
          </div>
          <div className="form-field"><label>Reference Number</label><input value={form.referenceNumber} onChange={(e) => set('referenceNumber', e.target.value)} /></div>
        </div>
        <div className="form-field"><label>Notes</label><textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
        <FileUpload folder="payments" label="Payment Proof" files={form.proof} onChange={(f) => set('proof', f)} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Record Payment'}</button>
        </div>
      </form>
    </Modal>
  );
}
