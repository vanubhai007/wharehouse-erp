import { useState } from 'react';
import { userApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';
import { ALL_ROLES } from '../../utils/constants';

export default function UserForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: ALL_ROLES[0], phone: '' });
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
      await userApi.create(form);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New User" onClose={onClose}>
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-field"><label>Name <span className="required">*</span></label><input required value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div className="form-field"><label>Email <span className="required">*</span></label><input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
          <div className="form-field"><label>Password <span className="required">*</span></label><input required type="password" minLength={8} value={form.password} onChange={(e) => set('password', e.target.value)} /></div>
          <div className="form-field">
            <label>Role <span className="required">*</span></label>
            <select value={form.role} onChange={(e) => set('role', e.target.value)}>
              {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-field"><label>Phone</label><input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create User'}</button>
        </div>
      </form>
    </Modal>
  );
}
