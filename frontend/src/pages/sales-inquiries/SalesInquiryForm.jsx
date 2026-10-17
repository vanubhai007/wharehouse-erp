import { useEffect, useState } from 'react';
import { salesInquiryApi, userApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';
import { SALES_INQUIRY_SOURCE, SALES_INQUIRY_STATUS, INQUIRY_PRIORITY } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';

// Every field here is entered manually by the user. A product does NOT
// need to exist in Inventory - productName/productId are free text, and
// expectedPrice/mrp/hrMartPrice are independent, directly-editable fields
// that are never auto-replaced by inventory data.
const emptyForm = {
  contactName: '',
  company: '',
  phone: '',
  email: '',
  address: '',
  source: 'Other',
  productName: '',
  productId: '',
  quantity: 1,
  expectedPrice: '',
  mrp: '',
  hrMartPrice: '',
  priority: 'Medium',
  status: 'New',
  assignedTo: '',
  followUpDate: '',
  notes: '',
};

function toFormState(inquiry) {
  return {
    contactName: inquiry.contactName || '',
    company: inquiry.company || '',
    phone: inquiry.phone || '',
    email: inquiry.email || '',
    address: inquiry.address || '',
    source: inquiry.source || 'Other',
    productName: inquiry.productName || '',
    productId: inquiry.productId || '',
    quantity: inquiry.quantity ?? 1,
    expectedPrice: inquiry.expectedPrice ?? '',
    mrp: inquiry.mrp ?? '',
    hrMartPrice: inquiry.hrMartPrice ?? '',
    priority: inquiry.priority || 'Medium',
    status: inquiry.status || 'New',
    assignedTo: inquiry.assignedTo?._id || inquiry.assignedTo || '',
    followUpDate: inquiry.followUpDate ? inquiry.followUpDate.slice(0, 10) : '',
    notes: inquiry.notes || '',
  };
}

export default function SalesInquiryForm({ inquiry, onClose, onSaved }) {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(inquiry ? toFormState(inquiry) : emptyForm);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.role === 'Admin') userApi.list({ limit: 100 }).then((res) => setStaff(res.data.data)).catch(() => {});
  }, [user]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((fe) => ({ ...fe, [field]: undefined }));
  }

  function validate() {
    const errs = {};
    if (!form.contactName.trim()) errs.contactName = 'Contact name is required';
    if (!form.phone.trim()) errs.phone = 'Phone is required';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Invalid email';
    if (!form.productName.trim()) errs.productName = 'Product name / description is required';
    for (const [field, label] of [['quantity', 'Quantity'], ['expectedPrice', 'Expected price'], ['mrp', 'MRP'], ['hrMartPrice', 'HR Mart Price']]) {
      const v = form[field];
      if (v !== '' && v !== null && v !== undefined && (isNaN(Number(v)) || Number(v) < 0)) {
        errs[field] = `${label} must be a valid non-negative number`;
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!validate()) {
      setError('Please fix the highlighted fields before saving.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        contactName: form.contactName,
        company: form.company,
        phone: form.phone,
        email: form.email,
        address: form.address,
        source: form.source,
        productName: form.productName,
        productId: form.productId,
        quantity: form.quantity === '' ? 1 : Number(form.quantity),
        priority: form.priority,
        status: form.status,
        notes: form.notes,
      };
      // Each price is mapped from its own form field only - changing one
      // never touches another.
      payload.expectedPrice = form.expectedPrice === '' ? undefined : Number(form.expectedPrice);
      payload.mrp = form.mrp === '' ? undefined : Number(form.mrp);
      payload.hrMartPrice = form.hrMartPrice === '' ? undefined : Number(form.hrMartPrice);
      payload.assignedTo = form.assignedTo || undefined;
      payload.followUpDate = form.followUpDate || undefined;

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
        <h4 style={{ marginTop: 0 }}>Contact / Business Information</h4>
        <div className="form-grid">
          <div className="form-field">
            <label>Contact Person Name <span className="required">*</span></label>
            <input required value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
            {fieldErrors.contactName && <span className="form-error">{fieldErrors.contactName}</span>}
          </div>
          <div className="form-field">
            <label>Company Name</label>
            <input value={form.company} onChange={(e) => set('company', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Phone Number <span className="required">*</span></label>
            <input required value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            {fieldErrors.phone && <span className="form-error">{fieldErrors.phone}</span>}
          </div>
          <div className="form-field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            {fieldErrors.email && <span className="form-error">{fieldErrors.email}</span>}
          </div>
          <div className="form-field">
            <label>Inquiry Source</label>
            <select value={form.source} onChange={(e) => set('source', e.target.value)}>
              {SALES_INQUIRY_SOURCE.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="form-field">
          <label>Address</label>
          <textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
        </div>

        <h4>Product Information (entered manually - does not need to exist in Inventory)</h4>
        <div className="form-grid">
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label>Product Name / Description <span className="required">*</span></label>
            <input required value={form.productName} onChange={(e) => set('productName', e.target.value)} placeholder="e.g. Double-door Fridge, 300L" />
            {fieldErrors.productName && <span className="form-error">{fieldErrors.productName}</span>}
          </div>
          <div className="form-field">
            <label>Product ID (if applicable)</label>
            <input value={form.productId} onChange={(e) => set('productId', e.target.value)} placeholder="e.g. ITM-00001 or leave blank" />
          </div>
          <div className="form-field">
            <label>Quantity</label>
            <input type="number" min="0.01" step="any" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
            {fieldErrors.quantity && <span className="form-error">{fieldErrors.quantity}</span>}
          </div>
          <div className="form-field">
            <label>Expected Price / Budget</label>
            <input type="number" min="0" step="any" value={form.expectedPrice} onChange={(e) => set('expectedPrice', e.target.value)} />
            {fieldErrors.expectedPrice && <span className="form-error">{fieldErrors.expectedPrice}</span>}
          </div>
          <div className="form-field">
            <label>MRP (if applicable)</label>
            <input type="number" min="0" step="any" value={form.mrp} onChange={(e) => set('mrp', e.target.value)} />
            {fieldErrors.mrp && <span className="form-error">{fieldErrors.mrp}</span>}
          </div>
          <div className="form-field">
            <label>HR Mart Price (if applicable)</label>
            <input type="number" min="0" step="any" value={form.hrMartPrice} onChange={(e) => set('hrMartPrice', e.target.value)} />
            {fieldErrors.hrMartPrice && <span className="form-error">{fieldErrors.hrMartPrice}</span>}
          </div>
        </div>

        <h4>Tracking</h4>
        <div className="form-grid">
          <div className="form-field">
            <label>Priority</label>
            <select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              {INQUIRY_PRIORITY.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Inquiry Status</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              {SALES_INQUIRY_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Follow-up Date</label>
            <input type="date" value={form.followUpDate} onChange={(e) => set('followUpDate', e.target.value)} />
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
        </div>

        <div className="form-field">
          <label>Notes and Requirements</label>
          <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
