import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { warehouseApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState } from '../../components/common/States';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import LocationForm from './LocationForm';

function occupancyColor(pct) {
  if (pct >= 90) return 'var(--color-danger)';
  if (pct >= 60) return 'var(--color-warning)';
  return 'var(--color-success)';
}

export default function WarehouseMap() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  function load() {
    setLoading(true);
    warehouseApi
      .occupancyMap()
      .then((res) => setData(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleDelete() {
    setDeleteError('');
    try {
      await warehouseApi.deleteLocation(deleteTarget._id);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setDeleteError(apiErrorMessage(err));
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const byZone = {};
  for (const loc of data.locations) {
    if (!byZone[loc.zone]) byZone[loc.zone] = [];
    byZone[loc.zone].push(loc);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Warehouse Map</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn btn-secondary" to="/warehouse/rental-report">Rental Report</Link>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Location</button>
        </div>
      </div>

      <div className="stat-cards">
        <div className="stat-card"><div className="label">Total Area</div><div className="value">{data.totals.totalAreaSqFt} sq ft</div></div>
        <div className="stat-card"><div className="label">Occupied</div><div className="value">{data.totals.occupiedAreaSqFt} sq ft</div></div>
        <div className="stat-card"><div className="label">Available</div><div className="value">{data.totals.availableAreaSqFt} sq ft</div></div>
        <div className="stat-card"><div className="label">Occupancy</div><div className="value">{data.totals.occupancyPercent}%</div></div>
      </div>

      {Object.entries(byZone).map(([zone, locs]) => (
        <div className="card" key={zone} style={{ marginBottom: 16 }}>
          <h3>Zone {zone}</h3>
          <div className="form-grid">
            {locs.map((loc) => (
              <div key={loc._id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                  <span>{loc.code}</span>
                  <span>{loc.occupancyPercent}%</span>
                </div>
                <div style={{ background: '#eef0f4', borderRadius: 6, height: 8, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${loc.occupancyPercent}%`, height: '100%', background: occupancyColor(loc.occupancyPercent) }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
                  {loc.occupiedAreaSqFt} / {loc.areaSqFt} sq ft occupied · {loc.itemCount} item(s)
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => setEditing(loc)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(loc)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {data.locations.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No warehouse locations configured yet.</p>}

      {showForm && <LocationForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {editing && <LocationForm location={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete location?"
          message={deleteError || `Delete location ${deleteTarget.code}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        />
      )}
    </div>
  );
}
