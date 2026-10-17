import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { buyerApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/States';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { formatCurrency } from '../../utils/format';
import { BUYER_ENQUIRY_STATUS } from '../../utils/constants';
import BuyerInquiryForm from './BuyerInquiryForm';

export default function BuyerInquiryList() {
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
    buyerApi
      .listEnquiries({ search, status, page, limit: 15 })
      .then((res) => setData(res.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [page, status]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  async function handleStatusChange(enquiry, newStatus) {
    try {
      await buyerApi.updateEnquiryStatus(enquiry._id, newStatus);
      load();
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  }

  async function handleConvert() {
    setActionError('');
    try {
      await buyerApi.convertEnquiryToBuyer(convertTarget._id);
      setConvertTarget(null);
      load();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Buyer Inquiries</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Buyer Inquiry</button>
      </div>

      <div className="toolbar">
        <input placeholder="Search by buyer, phone, email, product..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 300 }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {BUYER_ENQUIRY_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : data.data.length === 0 ? (
        <EmptyState message="No buyer inquiries found." />
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr><th>Buyer</th><th>Phone</th><th>Product</th><th>Expected Price</th><th>MRP</th><th>HR Mart Price</th><th>Priority</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {data.data.map((enq) => (
                <tr key={enq._id}>
                  <td><Link to={`/buyer-inquiries/${enq._id}`}>{enq.buyerName}{enq.companyName ? ` (${enq.companyName})` : ''}</Link></td>
                  <td>{enq.phone}</td>
                  <td>{enq.productName}{enq.productId ? ` [${enq.productId}]` : ''}</td>
                  <td>{enq.expectedPrice != null ? formatCurrency(enq.expectedPrice) : '-'}</td>
                  <td>{enq.mrp != null ? formatCurrency(enq.mrp) : '-'}</td>
                  <td>{enq.hrMartPrice != null ? formatCurrency(enq.hrMartPrice) : '-'}</td>
                  <td>{enq.priority}</td>
                  <td>
                    {enq.status === 'Converted' ? (
                      <StatusBadge status={enq.status} />
                    ) : (
                      <select value={enq.status} onChange={(e) => handleStatusChange(enq, e.target.value)}>
                        {BUYER_ENQUIRY_STATUS.filter((s) => s !== 'Converted').map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </td>
                  <td>
                    <Link className="btn btn-sm btn-secondary" to={`/buyer-inquiries/${enq._id}`}>View</Link>{' '}
                    {enq.status !== 'Converted' ? (
                      <>
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditing(enq)}>Edit</button>{' '}
                        <button className="btn btn-sm btn-primary" onClick={() => setConvertTarget(enq)}>Convert to Buyer</button>
                      </>
                    ) : (
                      enq.convertedToBuyer && <Link className="btn btn-sm btn-secondary" to={`/buyers/${enq.convertedToBuyer._id}`}>View Buyer</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
        </>
      )}

      {showForm && <BuyerInquiryForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {editing && <BuyerInquiryForm enquiry={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {convertTarget && (
        <ConfirmDialog
          title="Convert to Buyer?"
          message={actionError || `Create a new Buyer record for ${convertTarget.buyerName} and mark this inquiry as Converted?`}
          confirmLabel="Convert"
          onConfirm={handleConvert}
          onCancel={() => { setConvertTarget(null); setActionError(''); }}
        />
      )}
    </div>
  );
}
