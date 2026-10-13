import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { warehouseApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/States';
import { formatCurrency, formatDate } from '../../utils/format';

export default function RentalReport() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));

  function load() {
    setLoading(true);
    warehouseApi
      .rentalReport({ asOf })
      .then((res) => setData(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [asOf]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Warehouse Rental Report</h1>
        <Link className="btn btn-secondary" to="/warehouse">Back to Map</Link>
      </div>
      <div className="toolbar">
        <label style={{ fontSize: 13, fontWeight: 600 }}>As of:</label>
        <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : !data || data.rows.length === 0 ? (
        <EmptyState message="No items with storage history found." />
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <strong>Total Accumulated Rental (all items): {formatCurrency(data.totalRental)}</strong>
          </div>
          <table className="data-table">
            <thead><tr><th>Item ID</th><th>Item Name</th><th>Owner</th><th>Accumulated Rental</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.itemId}>
                  <td>{r.itemId}</td>
                  <td>{r.itemName}</td>
                  <td>{r.owner} ({r.ownerId})</td>
                  <td>{formatCurrency(r.accumulatedRental)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 12 }}>
        Rent is pro-rated by day: a full calendar month of occupancy is charged at the location's monthly rate; a
        partial month is charged proportionally to the number of days occupied in that calendar month. Dates shown are
        inclusive of the start date and exclusive of the end date (or "{formatDate(asOf)}" for still-occupied items).
      </p>
    </div>
  );
}
