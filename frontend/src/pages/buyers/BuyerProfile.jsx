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
          <thead><tr><th>Product</th><th>Expected Price</th><th>Status</th><th>Latest Offer</th><th></th></tr></thead>
          <tbody>
            {enquiries.map((e) => {
              const last = e.negotiationHistory[e.negotiationHistory.length - 1];
              return (
                <tr key={e._id}>
                  <td>
                    {e.item ? (
                      <Link to={`/inventory/${e.item._id}`}>{e.item.itemId} - {e.item.name}</Link>
                    ) : (
                      <>{e.productName}{e.productId ? ` [${e.productId}]` : ''}</>
                    )}
                  </td>
                  <td>{e.expectedPrice != null ? formatCurrency(e.expectedPrice) : '-'}</td>
                  <td><StatusBadge status={e.status} /></td>
                  <td>{last ? `${formatCurrency(last.proposedPrice)} (${formatDate(last.at)})` : '-'}</td>
                  <td><Link className="btn btn-sm btn-secondary" to={`/buyer-inquiries/${e._id}`}>View</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
