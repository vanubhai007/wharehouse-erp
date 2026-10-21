import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { customerApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/States';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import CustomerForm from './CustomerForm';
import { formatDate } from '../../utils/format';

export default function CustomerList() {
  const [data, setData] = useState({ data: [], pagination: { page: 1, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);

  function load() {
    setLoading(true);
    setError('');
    customerApi
      .list({ search, page, limit: 15 })
      .then((res) => setData(res.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page]);
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  async function confirmToggle() {
    await customerApi.setActive(toggleTarget._id, !toggleTarget.isActive);
    setToggleTarget(null);
    load();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Customers / Owners</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + New Customer
        </button>
      </div>

      <div className="toolbar">
        <input placeholder="Search by name, phone, email, ID..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 280 }} />
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : data.data.length === 0 ? (
        <EmptyState message="No customers found." />
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Created</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((c) => (
                <tr key={c._id}>
                  <td>{c.customerId}</td>
                  <td>
                    <Link to={`/customers/${c._id}`}>{c.businessName || c.name}</Link>
                  </td>
                  <td>{c.customerType}</td>
                  <td>{c.phone}</td>
                  <td>{c.email || '-'}</td>
                  <td>{formatDate(c.createdAt)}</td>
                  <td>
                    <StatusBadge status={c.isActive ? 'Active' : 'Inactive'} />
                  </td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => setEditing(c)}>
                      Edit
                    </button>{' '}
                    <button className="btn btn-sm btn-secondary" onClick={() => setToggleTarget(c)}>
                      {c.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
        </>
      )}

      {showForm && (
        <CustomerForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
      {editing && (
        <CustomerForm
          customer={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {toggleTarget && (
        <ConfirmDialog
          title={toggleTarget.isActive ? 'Deactivate customer?' : 'Activate customer?'}
          message={`Are you sure you want to ${toggleTarget.isActive ? 'deactivate' : 'activate'} ${toggleTarget.name}?`}
          confirmLabel={toggleTarget.isActive ? 'Deactivate' : 'Activate'}
          danger={toggleTarget.isActive}
          onConfirm={confirmToggle}
          onCancel={() => setToggleTarget(null)}
        />
      )}
    </div>
  );
}
