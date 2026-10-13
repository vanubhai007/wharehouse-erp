import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { itemApi } from '../../api/endpoints';
import { apiErrorMessage, downloadAuthenticated } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/States';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency } from '../../utils/format';
import { ITEM_STATUS } from '../../utils/constants';
import ItemForm from './ItemForm';

export default function ItemList() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ data: [], pagination: { page: 1, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(params.get('search') || '');
  const [status, setStatus] = useState(params.get('status') || '');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [exporting, setExporting] = useState(false);

  function load() {
    setLoading(true);
    setError('');
    itemApi
      .list({ search, status, page, limit: 15 })
      .then((res) => setData(res.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page, status]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const next = {};
    if (search) next.search = search;
    if (status) next.status = status;
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadAuthenticated(itemApi.exportCsvPath(), 'inventory-export.csv');
    } catch (err) {
      alert(apiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Inventory</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Item</button>
        </div>
      </div>

      <div className="toolbar">
        <input placeholder="Search by name, SKU, item ID, serial..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 280 }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {ITEM_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : data.data.length === 0 ? (
        <EmptyState message="No inventory items found." />
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr><th>Item ID</th><th>Name</th><th>Category</th><th>Owner</th><th>Status</th><th>Location</th><th>Purchase Cost</th></tr>
            </thead>
            <tbody>
              {data.data.map((i) => (
                <tr key={i._id}>
                  <td><Link to={`/inventory/${i._id}`}>{i.itemId}</Link></td>
                  <td>{i.name}</td>
                  <td>{i.category}</td>
                  <td>{i.owner?.businessName || i.owner?.name || '-'}</td>
                  <td><StatusBadge status={i.status} /></td>
                  <td>{i.currentLocation?.code || '-'}</td>
                  <td>{formatCurrency(i.purchaseCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
        </>
      )}

      {showForm && <ItemForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}
