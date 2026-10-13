import { useEffect, useState } from 'react';
import { settingsApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState } from '../../components/common/States';

export default function SettingsPage() {
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function load() {
    setLoading(true);
    settingsApi
      .get()
      .then((res) => setForm(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await settingsApi.update(form);
      setSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error && !form) return <ErrorState message={error} onRetry={load} />;
  if (!form) return null;

  return (
    <div className="page">
      <div className="page-header"><h1>Settings</h1></div>
      <p style={{ color: 'var(--color-text-muted)', maxWidth: 700 }}>
        These configurable business rules drive rental, GST and commission calculations across the system. Confirm the
        correct values with your business before going live - the defaults here are safe placeholders, not confirmed rules.
      </p>

      {error && <p className="form-error">{error}</p>}
      {saved && <p style={{ color: 'var(--color-success)' }}>Settings saved.</p>}

      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 800 }}>
        <h4>Company Details (used on invoices/PDFs)</h4>
        <div className="form-grid">
          <div className="form-field"><label>Company Name</label><input value={form.companyName} onChange={(e) => set('companyName', e.target.value)} /></div>
          <div className="form-field"><label>GSTIN</label><input value={form.companyGstin} onChange={(e) => set('companyGstin', e.target.value)} /></div>
          <div className="form-field"><label>Phone</label><input value={form.companyPhone} onChange={(e) => set('companyPhone', e.target.value)} /></div>
          <div className="form-field"><label>Email</label><input value={form.companyEmail} onChange={(e) => set('companyEmail', e.target.value)} /></div>
        </div>
        <div className="form-field"><label>Address</label><textarea rows={2} value={form.companyAddress} onChange={(e) => set('companyAddress', e.target.value)} /></div>

        <h4 style={{ marginTop: 20 }}>Rental Rules</h4>
        <div className="form-grid">
          <div className="form-field"><label>Default Rate / sq.ft / month</label><input type="number" min="0" value={form.defaultRatePerSqFtPerMonth} onChange={(e) => set('defaultRatePerSqFtPerMonth', Number(e.target.value))} /></div>
          <div className="form-field">
            <label>Days-per-month divisor (0 = use actual calendar days)</label>
            <input type="number" min="0" value={form.rentalDaysPerMonth} onChange={(e) => set('rentalDaysPerMonth', Number(e.target.value))} />
          </div>
        </div>

        <h4 style={{ marginTop: 20 }}>Tax & Commission</h4>
        <div className="form-grid">
          <div className="form-field"><label>Default GST %</label><input type="number" min="0" value={form.defaultGstPercent} onChange={(e) => set('defaultGstPercent', Number(e.target.value))} /></div>
          <div className="form-field"><label>Default Commission %</label><input type="number" min="0" value={form.defaultCommissionPercent} onChange={(e) => set('defaultCommissionPercent', Number(e.target.value))} /></div>
          <div className="form-field">
            <label>Default Commission Type</label>
            <select value={form.defaultCommissionType} onChange={(e) => set('defaultCommissionType', e.target.value)}>
              <option value="percent">Percent</option>
              <option value="fixed">Fixed</option>
            </select>
          </div>
        </div>

        <h4 style={{ marginTop: 20 }}>Numbering Prefixes</h4>
        <div className="form-grid">
          <div className="form-field"><label>Invoice Prefix</label><input value={form.invoicePrefix} onChange={(e) => set('invoicePrefix', e.target.value)} /></div>
          <div className="form-field"><label>Quotation Prefix</label><input value={form.quotationPrefix} onChange={(e) => set('quotationPrefix', e.target.value)} /></div>
          <div className="form-field"><label>Dispatch Note Prefix</label><input value={form.dispatchNotePrefix} onChange={(e) => set('dispatchNotePrefix', e.target.value)} /></div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
