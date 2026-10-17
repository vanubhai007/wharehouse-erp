import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { buyerApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/States';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { BUYER_ENQUIRY_STATUS } from '../../utils/constants';
import BuyerInquiryForm from './BuyerInquiryForm';

export default function BuyerInquiryList() {
  const [data, setData] = useState({ data: [], pagination: { page: 1, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [negotiateTarget, setNegotiateTarget] = useState(null);
  const [negotiatePrice, setNegotiatePrice] = useState('');
  const [negotiateNote, setNegotiateNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    setError('');
    buyerApi
      .listEnquiries(status ? { status, page, limit: 15 } : { page, limit: 15 })
      .then((res) => setData(res.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [page, status]);

  async function handleStatusChange(enquiry, newStatus) {
    try {
      await buyerApi.updateEnquiryStatus(enquiry._id, newStatus);
      load();
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  }

  async function handleNegotiate() {
    if (!negotiatePrice) {
      setActionError('Proposed price is required');
      return;
    }
    setSaving(true);
    setActionError('');
    try {
      await buyerApi.negotiate(negotiateTarget._id, { proposedPrice: Number(negotiatePrice), note: negotiateNote });
      setNegotiateTarget(null);
      setNegotiatePrice('');
      setNegotiateNote('');
      load();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Buyer Inquiries</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Buyer Inquiry</button>
      </div>

      <div className="toolbar">
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
              <tr><th>Buyer</th><th>Item</th><th>Latest Offer</th><th>Status</th><th>Updated</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {data.data.map((enq) => {
                const last = enq.negotiationHistory?.[enq.negotiationHistory.length - 1];
                return (
                  <tr key={enq._id}>
                    <td><Link to={`/buyers/${enq.buyer?._id}`}>{enq.buyer?.businessName || enq.buyer?.name}</Link></td>
                    <td><Link to={`/inventory/${enq.item?._id}`}>{enq.item?.itemId} - {enq.item?.name}</Link></td>
                    <td>{last ? formatCurrency(last.proposedPrice) : '-'}</td>
                    <td>
                      <select value={enq.status} onChange={(e) => handleStatusChange(enq, e.target.value)}>
                        {BUYER_ENQUIRY_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>{formatDateTime(enq.updatedAt)}</td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => setNegotiateTarget(enq)}>Add Offer</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
        </>
      )}

      {showForm && <BuyerInquiryForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}

      {negotiateTarget && (
        <Modal title={`Add Offer: ${negotiateTarget.item?.itemId}`} onClose={() => setNegotiateTarget(null)}>
          {actionError && <p className="form-error">{actionError}</p>}
          <div className="form-field">
            <label>Proposed Price <span className="required">*</span></label>
            <input type="number" min="0" value={negotiatePrice} onChange={(e) => setNegotiatePrice(e.target.value)} />
          </div>
          <div className="form-field">
            <label>Note</label>
            <textarea rows={2} value={negotiateNote} onChange={(e) => setNegotiateNote(e.target.value)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setNegotiateTarget(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleNegotiate} disabled={saving}>{saving ? 'Saving...' : 'Add Offer'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
