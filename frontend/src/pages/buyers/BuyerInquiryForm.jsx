import { useState } from 'react';
import { buyerApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';
import { SALES_INQUIRY_SOURCE, BUYER_ENQUIRY_STATUS, INQUIRY_PRIORITY } from '../../utils/constants';

// Every field here is entered manually. A user does NOT need to select an
// existing Buyer or Inventory record - buyerName/productName are free text,
// and expectedPrice/mrp/hrMartPrice are independent, directly-editable
// fields that are never auto-replaced by inventory data. Linking to a real
// Buyer only happens through the explicit "Convert to Buyer" action.
const emptyForm = {
  buyerName: '',
  companyName: '',
  phone: '',
  email: '',
  address: '',
  productName: '',
  productId: '',
  quantity: 1,
  expectedPrice: '',
  mrp: '',
  hrMartPrice: '',
  priority: 'Medium',
  status: 'Open',
  source: 'Other',
  followUpDate: '',
  notes: '',
};

function toFormState(enquiry) {
  return {
    buyerName: enquiry.buyerName || '',
    companyName: enquiry.companyName || '',
    phone: enquiry.phone || '',
    email: enquiry.email || '',
    address: enquiry.address || '',
    productName: enquiry.productName || '',
    productId: enquiry.productId || '',
    quantity: enquiry.quantity ?? 1,
    expectedPrice: enquiry.expectedPrice ?? '',
    mrp: enquiry.mrp ?? '',
    hrMartPrice: enquiry.hrMartPrice ?? '',
    priority: enquiry.priority || 'Medium',
    status: enquiry.status || 'Open',
    source: enquiry.source || 'Other',
    followUpDate: enquiry.followUpDate ? enquiry.followUpDate.slice(0, 10) : '',
    notes: enquiry.notes || '',
  };
}

export default function BuyerInquiryForm({ enquiry, onClose, onSaved }) {
  const [form, setForm] = useState(enquiry ? toFormState(enquiry) : emptyForm);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((fe) => ({ ...fe, [field]: undefined }));
  }

  function validate() {
    const errs = {};
    if (!form.buyerName.trim()) errs.buyerName = 'Buyer name is required';
    if (!form.phone.trim()) errs.phone = 'Phone is required';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Invalid email';
    if (!form.productName.trim()) errs.productName = 'Product name / description is required';
    for (const [field, label] of [['quantity', 'Quantity'], ['expectedPrice', 'Expected buying price'], ['mrp', 'MRP'], ['hrMartPrice', 'HR Mart Price']]) {
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
        buyerName: form.buyerName,
        companyName: form.companyName,
        phone: form.phone,
        email: form.email,
        address: form.address,
        productName: form.productName,
        productId: form.productId,
        quantity: form.quantity === '' ? 1 : Number(form.quantity),
        priority: form.priority,
        status: form.status,
        source: form.source,
        notes: form.notes,
      };
      // Each price is mapped from its own form field only - changing one
      // never touches another.
      payload.expectedPrice = form.expectedPrice === '' ? undefined : Number(form.expectedPrice);
      payload.mrp = form.mrp === '' ? undefined : Number(form.mrp);
      payload.hrMartPrice = form.hrMartPrice === '' ? undefined : Number(form.hrMartPrice);
      payload.followUpDate = form.followUpDate || undefined;

      if (enquiry) await buyerApi.updateEnquiry(enquiry._id, payload);
      else await buyerApi.createEnquiry(payload);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={enquiry ? 'Edit Buyer Inquiry' : 'New Buyer Inquiry'} onClose={onClose}>
      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <h4 style={{ marginTop: 0 }}>Buyer Information</h4>
        <div className="form-grid">
          <div className="form-field">
            <label>Buyer Name <span className="required">*</span></label>
            <input required value={form.buyerName} onChange={(e) => set('buyerName', e.target.value)} />
            {fieldErrors.buyerName && <span className="form-error">{fieldErrors.buyerName}</span>}
          </div>
          <div className="form-field">
            <label>Company / Business Name</label>
            <input value={form.companyName} onChange={(e) => set('companyName', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Phone <span className="required">*</span></label>
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
            <input required value={form.productName} onChange={(e) => set('productName', e.target.value)} />
            {fieldErrors.productName && <span className="form-error">{fieldErrors.productName}</span>}
          </div>
          <div className="form-field">
            <label>Product ID (if applicable)</label>
            <input value={form.productId} onChange={(e) => set('productId', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Quantity Required</label>
            <input type="number" min="0.01" step="any" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
            {fieldErrors.quantity && <span className="form-error">{fieldErrors.quantity}</span>}
          </div>
          <div className="form-field">
            <label>Expected Buying Price</label>
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
              {BUYER_ENQUIRY_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Follow-up Date</label>
            <input type="date" value={form.followUpDate} onChange={(e) => set('followUpDate', e.target.value)} />
          </div>
        </div>

        <div className="form-field">
          <label>Notes</label>
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
