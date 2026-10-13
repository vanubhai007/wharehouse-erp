import { useEffect, useState } from 'react';
import { itemApi, refurbishmentApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';

export default function RefurbishmentForm({ onClose, onSaved }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ item: '', workDescription: '', assignedTo: '', startDate: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    itemApi.list({ limit: 200 }).then((res) => setItems(res.data.data));
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await refurbishmentApi.create(form);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Refurbishment Job" onClose={onClose}>
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>Item <span className="required">*</span></label>
          <select required value={form.item} onChange={(e) => set('item', e.target.value)}>
            <option value="">Select item...</option>
            {items.map((i) => <option key={i._id} value={i._id}>{i.itemId} - {i.name} ({i.status})</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Work Description <span className="required">*</span></label>
          <textarea required rows={2} value={form.workDescription} onChange={(e) => set('workDescription', e.target.value)} />
        </div>
        <div className="form-grid">
          <div className="form-field">
            <label>Assigned To (staff/vendor) <span className="required">*</span></label>
            <input required value={form.assignedTo} onChange={(e) => set('assignedTo', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Start Date</label>
            <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Job'}</button>
        </div>
      </form>
    </Modal>
  );
}
