import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { buyerApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState } from '../../components/common/States';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';

export default function BuyerProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    buyerApi
      .get(id)
      .then((res) => setData(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [id]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;
  const { buyer, enquiries } = data;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{buyer.businessName || buyer.name}</h1>
      </div>
      <div className="card form-grid" style={{ marginBottom: 20 }}>
        <div><strong>Buyer ID:</strong> {buyer.buyerId}</div>
        <div><strong>Phone:</strong> {buyer.phone}</div>
        <div><strong>Email:</strong> {buyer.email || '-'}</div>
        <div><strong>GSTIN:</strong> {buyer.gstin || '-'}</div>
        <div style={{ gridColumn: '1 / -1' }}><strong>Address:</strong> {buyer.address || '-'}</div>
      </div>

      <h3>Enquiries & Negotiation History</h3>
      {enquiries.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No enquiries recorded for this buyer yet.</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Item</th><th>Status</th><th>Latest Offer</th><th>History</th></tr></thead>
          <tbody>
            {enquiries.map((e) => {
              const last = e.negotiationHistory[e.negotiationHistory.length - 1];
              return (
                <tr key={e._id}>
                  <td><Link to={`/inventory/${e.item?._id}`}>{e.item?.itemId} - {e.item?.name}</Link></td>
                  <td><StatusBadge status={e.status} /></td>
                  <td>{last ? formatCurrency(last.proposedPrice) : '-'}</td>
                  <td>
                    {e.negotiationHistory.map((h, idx) => (
                      <div key={idx} style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {formatCurrency(h.proposedPrice)} - {formatDate(h.at)} {h.note ? `(${h.note})` : ''}
                      </div>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
