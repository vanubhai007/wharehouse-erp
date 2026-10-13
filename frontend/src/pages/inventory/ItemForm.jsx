import { useEffect, useState } from 'react';
import { itemApi, customerApi, warehouseApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';
import FileUpload from '../../components/common/FileUpload';

const CONDITIONS = ['New', 'Good', 'Fair', 'Needs Repair', 'Damaged'];

export default function ItemForm({ onClose, onSaved }) {
  const [customers, setCustomers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({
    name: '', sku: '', category: '', description: '', brand: '', model: '', serialNumber: '',
    owner: '', trackingType: 'Serialized', quantity: 1, unit: 'pcs',
    purchaseSource: '', purchaseDate: '', purchaseCost: '', estimatedResaleValue: '',
    condition: 'Good', currentLocation: '', storageAreaSqFt: '', receivedDate: '',
    expectedDispatchDate: '', photos: [], documents: [],
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    customerApi.list({ limit: 200 }).then((res) => setCustomers(res.data.data));
    warehouseApi.listLocations({ isActive: true }).then((res) => setLocations(res.data.data));
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { ...form, purchaseCost: Number(form.purchaseCost), quantity: Number(form.quantity) };
      if (form.estimatedResaleValue) payload.estimatedResaleValue = Number(form.estimatedResaleValue);
      if (form.storageAreaSqFt) payload.storageAreaSqFt = Number(form.storageAreaSqFt);
      if (!payload.currentLocation) delete payload.currentLocation;
      await itemApi.create(payload);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Inventory Item" onClose={onClose}>
      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-field">
            <label>Item Name <span className="required">*</span></label>
            <input required value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Category <span className="required">*</span></label>
            <input required value={form.category} onChange={(e) => set('category', e.target.value)} />
          </div>
          <div className="form-field">
            <label>SKU</label>
            <input value={form.sku} onChange={(e) => set('sku', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Brand</label>
            <input value={form.brand} onChange={(e) => set('brand', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Model</label>
            <input value={form.model} onChange={(e) => set('model', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Serial Number</label>
            <input value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Owner / Customer <span className="required">*</span></label>
            <select required value={form.owner} onChange={(e) => set('owner', e.target.value)}>
              <option value="">Select owner...</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>{c.businessName || c.name} ({c.customerId})</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Tracking Type</label>
            <select value={form.trackingType} onChange={(e) => set('trackingType', e.target.value)}>
              <option value="Serialized">Serialized (individual asset)</option>
              <option value="Batch">Batch (quantity-based)</option>
            </select>
          </div>
          {form.trackingType === 'Batch' && (
            <div className="form-field">
              <label>Quantity</label>
              <input type="number" min="0" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
            </div>
          )}
          <div className="form-field">
            <label>Condition</label>
            <select value={form.condition} onChange={(e) => set('condition', e.target.value)}>
              {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Purchase Source</label>
            <input value={form.purchaseSource} onChange={(e) => set('purchaseSource', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Purchase Date</label>
            <input type="date" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Purchase Cost <span className="required">*</span></label>
            <input required type="number" min="0" value={form.purchaseCost} onChange={(e) => set('purchaseCost', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Estimated Resale Value</label>
            <input type="number" min="0" value={form.estimatedResaleValue} onChange={(e) => set('estimatedResaleValue', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Warehouse Location</label>
            <select value={form.currentLocation} onChange={(e) => set('currentLocation', e.target.value)}>
              <option value="">Not yet assigned</option>
              {locations.map((l) => (
                <option key={l._id} value={l._id}>{l.code} (Zone {l.zone}, {l.areaSqFt} sqft total)</option>
              ))}
            </select>
          </div>
          {form.currentLocation && (
            <div className="form-field">
              <label>Storage Area (sq ft)</label>
              <input type="number" min="0" value={form.storageAreaSqFt} onChange={(e) => set('storageAreaSqFt', e.target.value)} />
            </div>
          )}
          <div className="form-field">
            <label>Received Date</label>
            <input type="date" value={form.receivedDate} onChange={(e) => set('receivedDate', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Expected Dispatch Date</label>
            <input type="date" value={form.expectedDispatchDate} onChange={(e) => set('expectedDispatchDate', e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label>Description</label>
          <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>

        <FileUpload folder="items" label="Item Photos" files={form.photos} onChange={(f) => set('photos', f)} />
        <FileUpload folder="items" label="Bills / Receipts / Documents" files={form.documents} onChange={(f) => set('documents', f)} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create Item'}</button>
        </div>
      </form>
    </Modal>
  );
}
