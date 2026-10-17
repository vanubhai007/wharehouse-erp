import { useEffect, useState } from 'react';
import { itemApi, salesInquiryApi, userApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';
import { SALES_INQUIRY_SOURCE, INQUIRY_PRIORITY } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';

export default function SalesInquiryForm({ inquiry, onClose, onSaved }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(
    inquiry
      ? {
          contactName: inquiry.contactName,
          phone: inquiry.phone,
          email: inquiry.email || '',
          company: inquiry.company || '',
          source: inquiry.source,
          priority: inquiry.priority,
          assignedTo: inquiry.assignedTo?._id || '',
          followUpDate: inquiry.followUpDate ? inquiry.followUpDate.slice(0, 10) : '',
          notes: inquiry.notes || '',
          items: (inquiry.items || []).map((i) => ({ item: i.item?._id || i.item, quantity: i.quantity, notes: i.notes || '' })),
        }
      : { contactName: '', phone: '', email: '', company: '', source: 'Other', priority: 'Medium', assignedTo: '', followUpDate: '', notes: '', items: [] }
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Live item list is always fetched from the existing inventory API - no
    // product or price data is ever hardcoded here.
    itemApi.list({ limit: 200 }).then((res) => setItems(res.data.data));
    if (user?.role === 'Admin') userApi.list({ limit: 100 }).then((res) => setStaff(res.data.data));
  }, [user]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function addItemRow() {
    setForm((f) => ({ ...f, items: [...f.items, { item: '', quantity: 1, notes: '' }] }));
  }
  function updateItemRow(idx, field, value) {
    setForm((f) => ({ ...f, items: f.items.map((row, i) => (i === idx ? { ...row, [field]: value } : row)) }));
  }
  function removeItemRow(idx) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        items: form.items.filter((row) => row.item).map((row) => ({ ...row, quantity: Number(row.quantity) || 1 })),
      };
      if (!payload.assignedTo) delete payload.assignedTo;
      if (!payload.followUpDate) delete payload.followUpDate;
      if (inquiry) await salesInquiryApi.update(inquiry._id, payload);
      else await salesInquiryApi.create(payload);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={inquiry ? 'Edit Sales Inquiry' : 'New Sales Inquiry'} onClose={onClose}>
      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-field">
            <label>Contact Name <span className="required">*</span></label>
            <input required value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
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
            <label>Company</label>
            <input value={form.company} onChange={(e) => set('company', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Source</label>
            <select value={form.source} onChange={(e) => set('source', e.target.value)}>
              {SALES_INQUIRY_SOURCE.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Priority</label>
            <select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              {INQUIRY_PRIORITY.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {staff.length > 0 && (
            <div className="form-field">
              <label>Assigned To</label>
              <select value={form.assignedTo} onChange={(e) => set('assignedTo', e.target.value)}>
                <option value="">Unassigned</option>
                {staff.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.role})</option>)}
              </select>
            </div>
          )}
          <div className="form-field">
            <label>Follow-up Date</label>
            <input type="date" value={form.followUpDate} onChange={(e) => set('followUpDate', e.target.value)} />
          </div>
        </div>

        <div className="form-field">
          <label>Products of Interest</label>
          {form.items.map((row, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
              <select style={{ flex: 2 }} value={row.item} onChange={(e) => updateItemRow(idx, 'item', e.target.value)}>
                <option value="">Select item...</option>
                {items.map((i) => <option key={i._id} value={i._id}>{i.itemId} - {i.name}</option>)}
              </select>
              <input
                style={{ width: 70 }}
                type="number"
                min="1"
                value={row.quantity}
                onChange={(e) => updateItemRow(idx, 'quantity', e.target.value)}
              />
              <input
                style={{ flex: 2 }}
                placeholder="Notes"
                value={row.notes}
                onChange={(e) => updateItemRow(idx, 'notes', e.target.value)}
              />
              <button type="button" className="btn btn-sm btn-danger" onClick={() => removeItemRow(idx)}>×</button>
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-secondary" onClick={addItemRow}>+ Add Product</button>
        </div>

        <div className="form-field">
          <label>Notes</label>
          <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
