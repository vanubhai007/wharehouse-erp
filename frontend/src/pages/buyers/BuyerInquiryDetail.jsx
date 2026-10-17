import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { buyerApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState } from '../../components/common/States';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import BuyerInquiryForm from './BuyerInquiryForm';

export default function BuyerInquiryDetail() {
  const { id } = useParams();
  const [enquiry, setEnquiry] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [convertConfirm, setConvertConfirm] = useState(false);
  const [negotiateModal, setNegotiateModal] = useState(false);
  const [negotiatePrice, setNegotiatePrice] = useState('');
  const [negotiateNote, setNegotiateNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    buyerApi
      .getEnquiry(id)
      .then((res) => setEnquiry(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [id]);

  async function handleConvert() {
    setActionError('');
    try {
      await buyerApi.convertEnquiryToBuyer(id);
      setConvertConfirm(false);
      load();
    } catch (err) {
      setActionError(apiErrorMessage(err));
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
      await buyerApi.negotiate(id, { proposedPrice: Number(negotiatePrice), note: negotiateNote });
      setNegotiateModal(false);
      setNegotiatePrice('');
      setNegotiateNote('');
      load();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!enquiry) return null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{enquiry.buyerName}</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>
            <StatusBadge status={enquiry.status} /> · Priority: {enquiry.priority} · Source: {enquiry.source}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn btn-secondary" to="/buyer-inquiries">Back to List</Link>
          {enquiry.status !== 'Converted' && (
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>
              <button className="btn btn-secondary" onClick={() => setNegotiateModal(true)}>Add Offer</button>
              <button className="btn btn-primary" onClick={() => setConvertConfirm(true)}>Convert to Buyer</button>
            </>
          )}
          {enquiry.convertedToBuyer && (
            <Link className="btn btn-secondary" to={`/buyers/${enquiry.convertedToBuyer._id}`}>View Buyer</Link>
          )}
        </div>
      </div>

      <div className="form-grid">
        <div className="card">
          <h4>Buyer Information</h4>
          <p><strong>Buyer Name:</strong> {enquiry.buyerName}</p>
          <p><strong>Company:</strong> {enquiry.companyName || '-'}</p>
          <p><strong>Phone:</strong> {enquiry.phone}</p>
          <p><strong>Email:</strong> {enquiry.email || '-'}</p>
          <p><strong>Address:</strong> {enquiry.address || '-'}</p>
          {enquiry.buyer && <p><strong>Linked Buyer Record:</strong> <Link to={`/buyers/${enquiry.buyer._id}`}>{enquiry.buyer.buyerId}</Link></p>}
        </div>

        <div className="card">
          <h4>Product Information (manually entered)</h4>
          <p><strong>Product Name / Description:</strong> {enquiry.productName}</p>
          <p><strong>Product ID:</strong> {enquiry.productId || '-'}</p>
          <p><strong>Quantity Required:</strong> {enquiry.quantity}</p>
          <p><strong>Expected Buying Price:</strong> {enquiry.expectedPrice != null ? formatCurrency(enquiry.expectedPrice) : '-'}</p>
          <p><strong>MRP:</strong> {enquiry.mrp != null ? formatCurrency(enquiry.mrp) : '-'}</p>
          <p><strong>HR Mart Price:</strong> {enquiry.hrMartPrice != null ? formatCurrency(enquiry.hrMartPrice) : '-'}</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h4>Tracking</h4>
        <div className="form-grid">
          <p><strong>Follow-up Date:</strong> {formatDate(enquiry.followUpDate)}</p>
          <p><strong>Created:</strong> {formatDateTime(enquiry.createdAt)}</p>
          <p><strong>Last Updated:</strong> {formatDateTime(enquiry.updatedAt)}</p>
        </div>
        <p><strong>Notes:</strong></p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{enquiry.notes || '-'}</p>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h4>Negotiation History</h4>
        {(!enquiry.negotiationHistory || enquiry.negotiationHistory.length === 0) ? (
          <p>No offers recorded yet.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>Date</th><th>Proposed Price</th><th>Note</th><th>By</th></tr></thead>
            <tbody>
              {enquiry.negotiationHistory.map((h, idx) => (
                <tr key={idx}>
                  <td>{formatDateTime(h.at)}</td>
                  <td>{formatCurrency(h.proposedPrice)}</td>
                  <td>{h.note || '-'}</td>
                  <td>{h.by?.name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <BuyerInquiryForm
          enquiry={enquiry}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
        />
      )}

      {negotiateModal && (
        <Modal title="Add Offer" onClose={() => setNegotiateModal(false)}>
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
            <button className="btn btn-secondary" onClick={() => setNegotiateModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleNegotiate} disabled={saving}>{saving ? 'Saving...' : 'Add Offer'}</button>
          </div>
        </Modal>
      )}

      {convertConfirm && (
        <ConfirmDialog
          title="Convert to Buyer?"
          message={actionError || `Create a new Buyer record for ${enquiry.buyerName} and mark this inquiry as Converted?`}
          confirmLabel="Convert"
          onConfirm={handleConvert}
          onCancel={() => { setConvertConfirm(false); setActionError(''); }}
        />
      )}
    </div>
  );
}
