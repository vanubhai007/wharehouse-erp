import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { dispatchApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/States';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/format';
import DispatchForm from './DispatchForm';

export default function DispatchList() {
  const [params] = useSearchParams();
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(!!params.get('proposal'));

  function load() {
    setLoading(true);
    dispatchApi
      .list(status ? { status } : {})
      .then((res) => setDispatches(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [status]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dispatch & Logistics</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Dispatch</button>
      </div>
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option>Pending</option><option>Scheduled</option><option>Dispatched</option><option>Delivered</option><option>Closed</option>
        </select>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : dispatches.length === 0 ? (
        <EmptyState message="No dispatches yet." />
      ) : (
        <table className="data-table">
          <thead><tr><th>Dispatch #</th><th>Item</th><th>Buyer</th><th>Transporter</th><th>Scheduled</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {dispatches.map((d) => (
              <tr key={d._id}>
                <td><Link to={`/dispatch/${d._id}`}>{d.dispatchNumber}</Link></td>
                <td>{d.item?.itemId} - {d.item?.name}</td>
                <td>{d.buyer?.businessName || d.buyer?.name}</td>
                <td>{d.transporterName || '-'}</td>
                <td>{formatDate(d.scheduledDate)}</td>
                <td><StatusBadge status={d.status} /></td>
                <td><Link to={`/dispatch/${d._id}`} className="btn btn-sm btn-secondary">Manage</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <DispatchForm preselectedProposal={params.get('proposal')} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
}
