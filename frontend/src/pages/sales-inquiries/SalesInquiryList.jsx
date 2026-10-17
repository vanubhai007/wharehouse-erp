import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { salesInquiryApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/States';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { formatCurrency, formatDate } from '../../utils/format';
import { SALES_INQUIRY_STATUS } from '../../utils/constants';
import SalesInquiryForm from './SalesInquiryForm';

export default function SalesInquiryList() {
  const [data, setData] = useState({ data: [], pagination: { page: 1, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [convertTarget, setConvertTarget] = useState(null);
  const [actionError, setActionError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    salesInquiryApi
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

  async function handleStatusChange(inquiry, newStatus) {
    try {
      await salesInquiryApi.updateStatus(inquiry._id, { status: newStatus });
      load();
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  }

  async function handleConvert() {
    setActionError('');
    try {
      await salesInquiryApi.convertToBuyer(convertTarget._id);
      setConvertTarget(null);
      load();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Sales Inquiries</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Sales Inquiry</button>
      </div>

      <div className="toolbar">
        <input placeholder="Search by name, phone, email, company, product..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 300 }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {SALES_INQUIRY_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : data.data.length === 0 ? (
        <EmptyState message="No sales inquiries found." />
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr><th>Inquiry #</th><th>Contact</th><th>Phone</th><th>Product</th><th>Expected Price</th><th>MRP</th><th>HR Mart Price</th><th>Priority</th><th>Status</th><th>Follow-up</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {data.data.map((inq) => (
                <tr key={inq._id}>
                  <td><Link to={`/sales-inquiries/${inq._id}`}>{inq.inquiryNumber}</Link></td>
                  <td>{inq.contactName}{inq.company ? ` (${inq.company})` : ''}</td>
                  <td>{inq.phone}</td>
                  <td>{inq.productName}{inq.productId ? ` [${inq.productId}]` : ''}</td>
                  <td>{inq.expectedPrice != null ? formatCurrency(inq.expectedPrice) : '-'}</td>
                  <td>{inq.mrp != null ? formatCurrency(inq.mrp) : '-'}</td>
                  <td>{inq.hrMartPrice != null ? formatCurrency(inq.hrMartPrice) : '-'}</td>
                  <td>{inq.priority}</td>
                  <td>
                    {inq.status === 'Converted' ? (
                      <StatusBadge status={inq.status} />
                    ) : (
                      <select value={inq.status} onChange={(e) => handleStatusChange(inq, e.target.value)}>
                        {SALES_INQUIRY_STATUS.filter((s) => s !== 'Converted').map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </td>
                  <td>{formatDate(inq.followUpDate)}</td>
                  <td>
                    <Link className="btn btn-sm btn-secondary" to={`/sales-inquiries/${inq._id}`}>View</Link>{' '}
                    {inq.status !== 'Converted' ? (
                      <>
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditing(inq)}>Edit</button>{' '}
                        <button className="btn btn-sm btn-primary" onClick={() => setConvertTarget(inq)}>Convert to Buyer</button>
                      </>
                    ) : (
                      inq.convertedToBuyer && <Link className="btn btn-sm btn-secondary" to={`/buyers/${inq.convertedToBuyer._id}`}>View Buyer</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
        </>
      )}

      {showForm && <SalesInquiryForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {editing && <SalesInquiryForm inquiry={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {convertTarget && (
        <ConfirmDialog
          title="Convert to Buyer?"
          message={actionError || `Create a new Buyer record for ${convertTarget.contactName} and mark this inquiry as Converted?`}
          confirmLabel="Convert"
          onConfirm={handleConvert}
          onCancel={() => { setConvertTarget(null); setActionError(''); }}
        />
      )}
    </div>
  );
}
