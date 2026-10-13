import { useState } from 'react';
import { warehouseApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';

export default function LocationForm({ location, onClose, onSaved }) {
  const [form, setForm] = useState(
    location || { code: '', warehouseName: 'Main Warehouse', zone: '', aisle: '', rack: '', bin: '', areaSqFt: '', ratePerSqFtPerMonth: '', notes: '' }
  );
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
      const payload = { ...form, areaSqFt: Number(form.areaSqFt) };
      if (form.ratePerSqFtPerMonth) payload.ratePerSqFtPerMonth = Number(form.ratePerSqFtPerMonth);
      if (location) await warehouseApi.updateLocation(location._id, payload);
      else await warehouseApi.createLocation(payload);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={location ? 'Edit Location' : 'New Warehouse Location'} onClose={onClose}>
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-field"><label>Location Code <span className="required">*</span></label><input required value={form.code} onChange={(e) => set('code', e.target.value)} /></div>
          <div className="form-field"><label>Warehouse Name</label><input value={form.warehouseName} onChange={(e) => set('warehouseName', e.target.value)} /></div>
          <div className="form-field"><label>Zone <span className="required">*</span></label><input required value={form.zone} onChange={(e) => set('zone', e.target.value)} /></div>
          <div className="form-field"><label>Aisle</label><input value={form.aisle} onChange={(e) => set('aisle', e.target.value)} /></div>
          <div className="form-field"><label>Rack</label><input value={form.rack} onChange={(e) => set('rack', e.target.value)} /></div>
          <div className="form-field"><label>Bin</label><input value={form.bin} onChange={(e) => set('bin', e.target.value)} /></div>
          <div className="form-field"><label>Area (sq ft) <span className="required">*</span></label><input required type="number" min="0" value={form.areaSqFt} onChange={(e) => set('areaSqFt', e.target.value)} /></div>
          <div className="form-field"><label>Rate / sq.ft / month (override)</label><input type="number" min="0" value={form.ratePerSqFtPerMonth} onChange={(e) => set('ratePerSqFtPerMonth', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
