import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { salesInquiryApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState } from '../../components/common/States';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import SalesInquiryForm from './SalesInquiryForm';

export default function SalesInquiryDetail() {
  const { id } = useParams();
  const [inquiry, setInquiry] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [convertConfirm, setConvertConfirm] = useState(false);
  const [actionError, setActionError] = useState('');

  function load() {
    setLoading(true);
    salesInquiryApi
      .get(id)
      .then((res) => setInquiry(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [id]);

  async function handleConvert() {
    setActionError('');
    try {
      await salesInquiryApi.convertToBuyer(id);
      setConvertConfirm(false);
      load();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!inquiry) return null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{inquiry.inquiryNumber}</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>
            <StatusBadge status={inquiry.status} /> · Priority: {inquiry.priority} · Source: {inquiry.source}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn btn-secondary" to="/sales-inquiries">Back to List</Link>
          {inquiry.status !== 'Converted' && (
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>
              <button className="btn btn-primary" onClick={() => setConvertConfirm(true)}>Convert to Buyer</button>
            </>
          )}
          {inquiry.convertedToBuyer && (
            <Link className="btn btn-secondary" to={`/buyers/${inquiry.convertedToBuyer._id}`}>View Buyer</Link>
          )}
        </div>
      </div>

      <div className="form-grid">
        <div className="card">
          <h4>Contact / Business Information</h4>
          <p><strong>Contact Person:</strong> {inquiry.contactName}</p>
          <p><strong>Company:</strong> {inquiry.company || '-'}</p>
          <p><strong>Phone:</strong> {inquiry.phone}</p>
          <p><strong>Email:</strong> {inquiry.email || '-'}</p>
          <p><strong>Address:</strong> {inquiry.address || '-'}</p>
          <p><strong>Source:</strong> {inquiry.source}</p>
          {inquiry.assignedTo && <p><strong>Assigned To:</strong> {inquiry.assignedTo.name} ({inquiry.assignedTo.role})</p>}
        </div>

        <div className="card">
          <h4>Product Information (manually entered)</h4>
          <p><strong>Product Name / Description:</strong> {inquiry.productName}</p>
          <p><strong>Product ID:</strong> {inquiry.productId || '-'}</p>
          <p><strong>Quantity:</strong> {inquiry.quantity}</p>
          <p><strong>Expected Price / Budget:</strong> {inquiry.expectedPrice != null ? formatCurrency(inquiry.expectedPrice) : '-'}</p>
          <p><strong>MRP:</strong> {inquiry.mrp != null ? formatCurrency(inquiry.mrp) : '-'}</p>
          <p><strong>HR Mart Price:</strong> {inquiry.hrMartPrice != null ? formatCurrency(inquiry.hrMartPrice) : '-'}</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h4>Tracking</h4>
        <div className="form-grid">
          <p><strong>Follow-up Date:</strong> {formatDate(inquiry.followUpDate)}</p>
          <p><strong>Created:</strong> {formatDateTime(inquiry.createdAt)}</p>
          <p><strong>Last Updated:</strong> {formatDateTime(inquiry.updatedAt)}</p>
        </div>
        <p><strong>Notes and Requirements:</strong></p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{inquiry.notes || '-'}</p>
      </div>

      {editing && (
        <SalesInquiryForm
          inquiry={inquiry}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
        />
      )}

      {convertConfirm && (
        <ConfirmDialog
          title="Convert to Buyer?"
          message={actionError || `Create a new Buyer record for ${inquiry.contactName} and mark this inquiry as Converted?`}
          confirmLabel="Convert"
          onConfirm={handleConvert}
          onCancel={() => { setConvertConfirm(false); setActionError(''); }}
        />
      )}
    </div>
  );
}
