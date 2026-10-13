import { useState } from 'react';
import { customerApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';
import FileUpload from '../../components/common/FileUpload';

const CUSTOMER_TYPES = ['Individual Owner', 'Business Owner', 'Buyer', 'Vendor'];

export default function CustomerForm({ customer, onClose, onSaved }) {
  const [form, setForm] = useState(
    customer || {
      name: '',
      businessName: '',
      customerType: 'Individual Owner',
      phone: '',
      email: '',
      address: '',
      contactPerson: '',
      gstin: '',
      billingDetails: '',
      agreement: { number: '', startDate: '', endDate: '', ratePerSqFtPerMonth: '' },
      notes: '',
      documents: [],
      photos: [],
    }
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function setAgreement(field, value) {
    setForm((f) => ({ ...f, agreement: { ...f.agreement, [field]: value } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (customer) {
        await customerApi.update(customer._id, form);
      } else {
        await customerApi.create(form);
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={customer ? 'Edit Customer / Owner' : 'New Customer / Owner'} onClose={onClose}>
      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-field">
            <label>
              Name <span className="required">*</span>
            </label>
            <input required value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Business Name</label>
            <input value={form.businessName} onChange={(e) => set('businessName', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Customer Type</label>
            <select value={form.customerType} onChange={(e) => set('customerType', e.target.value)}>
              {CUSTOMER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>
              Phone <span className="required">*</span>
            </label>
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
          <div className="form-field">
            <label>Contact Person</label>
            <input value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label>Address</label>
          <textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Billing Details</label>
          <textarea rows={2} value={form.billingDetails} onChange={(e) => set('billingDetails', e.target.value)} />
        </div>

        <h4 style={{ marginTop: 16 }}>Agreement</h4>
        <div className="form-grid">
          <div className="form-field">
            <label>Agreement Number</label>
            <input value={form.agreement?.number || ''} onChange={(e) => setAgreement('number', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Rate / sq.ft / month (override)</label>
            <input
              type="number"
              min="0"
              value={form.agreement?.ratePerSqFtPerMonth || ''}
              onChange={(e) => setAgreement('ratePerSqFtPerMonth', e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Start Date</label>
            <input
              type="date"
              value={form.agreement?.startDate ? form.agreement.startDate.slice(0, 10) : ''}
              onChange={(e) => setAgreement('startDate', e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>End Date</label>
            <input
              type="date"
              value={form.agreement?.endDate ? form.agreement.endDate.slice(0, 10) : ''}
              onChange={(e) => setAgreement('endDate', e.target.value)}
            />
          </div>
        </div>

        <FileUpload folder="customers" label="Documents (agreement, ID proof, etc.)" files={form.documents} onChange={(f) => set('documents', f)} />
        <FileUpload folder="customers" label="Photos" files={form.photos} onChange={(f) => set('photos', f)} />

        <div className="form-field">
          <label>Notes</label>
          <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
