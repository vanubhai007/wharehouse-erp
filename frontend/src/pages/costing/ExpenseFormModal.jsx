import { useState } from 'react';
import { expenseApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';
import FileUpload from '../../components/common/FileUpload';
import { EXPENSE_CATEGORIES } from '../../utils/constants';

export default function ExpenseFormModal({ itemId, onClose, onSaved }) {
  const [form, setForm] = useState({
    category: 'Refurbishment', amount: '', date: new Date().toISOString().slice(0, 10), vendor: '', paymentStatus: 'Unpaid', notes: '', receipts: [],
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [forceDuplicate, setForceDuplicate] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await expenseApi.create({ ...form, item: itemId, amount: Number(form.amount), force: forceDuplicate });
      onSaved();
    } catch (err) {
      if (err.response?.status === 409) {
        setError(`${apiErrorMessage(err)} Click "Save Anyway" to add it regardless.`);
        setForceDuplicate(true);
      } else {
        setError(apiErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add Expense" onClose={onClose}>
      {error && <p className="form-error" style={{ marginBottom: 10 }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-field">
            <label>Category</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Amount <span className="required">*</span></label>
            <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Date</label>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Vendor</label>
            <input value={form.vendor} onChange={(e) => set('vendor', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Payment Status</label>
            <select value={form.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)}>
              <option>Unpaid</option><option>Partially Paid</option><option>Paid</option>
            </select>
          </div>
        </div>
        <div className="form-field">
          <label>Notes</label>
          <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
        <FileUpload folder="expenses" label="Receipts" files={form.receipts} onChange={(f) => set('receipts', f)} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : forceDuplicate ? 'Save Anyway' : 'Save Expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
