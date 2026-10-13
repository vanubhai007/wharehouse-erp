import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { buyerApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/States';
import Pagination from '../../components/common/Pagination';
import BuyerForm from './BuyerForm';

export default function BuyerList() {
  const [data, setData] = useState({ data: [], pagination: { page: 1, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  function load() {
    setLoading(true);
    buyerApi
      .list({ search, page, limit: 15 })
      .then((res) => setData(res.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Buyers</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Buyer</button>
      </div>
      <div className="toolbar">
        <input placeholder="Search by name, phone..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 280 }} />
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : data.data.length === 0 ? (
        <EmptyState message="No buyers found." />
      ) : (
        <>
          <table className="data-table">
            <thead><tr><th>Buyer ID</th><th>Name</th><th>Phone</th><th>Email</th><th>Actions</th></tr></thead>
            <tbody>
              {data.data.map((b) => (
                <tr key={b._id}>
                  <td>{b.buyerId}</td>
                  <td><Link to={`/buyers/${b._id}`}>{b.businessName || b.name}</Link></td>
                  <td>{b.phone}</td>
                  <td>{b.email || '-'}</td>
                  <td><button className="btn btn-sm btn-secondary" onClick={() => setEditing(b)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
        </>
      )}

      {showForm && <BuyerForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {editing && <BuyerForm buyer={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}
