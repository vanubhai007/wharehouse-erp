import { useEffect, useState } from 'react';
import { refurbishmentApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/States';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';
import RefurbishmentForm from './RefurbishmentForm';
import RefurbishmentDetailModal from './RefurbishmentDetailModal';

export default function RefurbishmentList() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);

  function load() {
    setLoading(true);
    refurbishmentApi
      .list(status ? { status } : {})
      .then((res) => setJobs(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [status]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Refurbishment Jobs</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Job</button>
      </div>

      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option>Assigned</option><option>In Progress</option><option>Completed</option><option>Approved</option>
        </select>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : jobs.length === 0 ? (
        <EmptyState message="No refurbishment jobs found." />
      ) : (
        <table className="data-table">
          <thead><tr><th>Item</th><th>Work</th><th>Assigned To</th><th>Start Date</th><th>Repair Cost</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j._id}>
                <td>{j.item?.itemId} - {j.item?.name}</td>
                <td>{j.workDescription}</td>
                <td>{j.assignedTo}</td>
                <td>{formatDate(j.startDate)}</td>
                <td>{formatCurrency(j.repairCost)}</td>
                <td><StatusBadge status={j.status} /></td>
                <td><button className="btn btn-sm btn-secondary" onClick={() => setSelected(j)}>Manage</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && <RefurbishmentForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {selected && (
        <RefurbishmentDetailModal job={selected} onClose={() => { setSelected(null); load(); }} onChanged={() => { setSelected(null); load(); }} />
      )}
    </div>
  );
}
