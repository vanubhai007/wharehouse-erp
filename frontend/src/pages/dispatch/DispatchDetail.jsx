import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { dispatchApi } from '../../api/endpoints';
import { apiErrorMessage, downloadAuthenticated } from '../../api/client';
import { LoadingState, ErrorState } from '../../components/common/States';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import FileUpload from '../../components/common/FileUpload';
import { formatCurrency, formatDate } from '../../utils/format';
import { safeUrl } from '../../utils/safeUrl';

export default function DispatchDetail() {
  const { id } = useParams();
  const [dispatch, setDispatch] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dispatchModal, setDispatchModal] = useState(false);
  const [deliverConfirm, setDeliverConfirm] = useState(false);
  const [transporterName, setTransporterName] = useState('');
  const [trackingReference, setTrackingReference] = useState('');
  const [outboundLogisticsCost, setOutboundLogisticsCost] = useState(0);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    dispatchApi
      .get(id)
      .then((res) => {
        setDispatch(res.data.data);
        setTransporterName(res.data.data.transporterName || '');
        setTrackingReference(res.data.data.trackingReference || '');
        setOutboundLogisticsCost(res.data.data.outboundLogisticsCost || 0);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [id]);

  async function handleMarkDispatched() {
    setSaving(true);
    try {
      await dispatchApi.markDispatched(id, { transporterName, trackingReference, outboundLogisticsCost: Number(outboundLogisticsCost) });
      setDispatchModal(false);
      load();
    } catch (err) {
      alert(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelivery() {
    try {
      await dispatchApi.confirmDelivery(id);
      setDeliverConfirm(false);
      load();
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  }

  async function handleDownload() {
    try {
      await downloadAuthenticated(dispatchApi.pdfPath(id), `${dispatch.dispatchNumber}.pdf`, 'view');
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!dispatch) return null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{dispatch.dispatchNumber}</h1>
          <StatusBadge status={dispatch.status} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleDownload}>Download Dispatch Note</button>
          {(dispatch.status === 'Pending' || dispatch.status === 'Scheduled') && (
            <button className="btn btn-primary" onClick={() => setDispatchModal(true)}>Mark Dispatched</button>
          )}
          {dispatch.status === 'Dispatched' && (
            <button className="btn btn-primary" onClick={() => setDeliverConfirm(true)}>Confirm Delivery</button>
          )}
        </div>
      </div>

      <div className="form-grid">
        <div className="card">
          <h4>Item & Buyer</h4>
          <p><strong>Item:</strong> {dispatch.item?.itemId} - {dispatch.item?.name}</p>
          <p><strong>Buyer:</strong> {dispatch.buyer?.businessName || dispatch.buyer?.name}</p>
          <p><strong>Delivery Address:</strong> {dispatch.deliveryAddress}</p>
          <p><strong>Contact:</strong> {dispatch.deliveryContactName} {dispatch.deliveryContactPhone}</p>
        </div>
        <div className="card">
          <h4>Logistics</h4>
          <p><strong>Transporter:</strong> {dispatch.transporterName || '-'}</p>
          <p><strong>Tracking Ref:</strong> {dispatch.trackingReference || '-'}</p>
          <p><strong>Scheduled:</strong> {formatDate(dispatch.scheduledDate)}</p>
          <p><strong>Dispatched:</strong> {formatDate(dispatch.dispatchedDate)}</p>
          <p><strong>Delivered:</strong> {formatDate(dispatch.deliveredDate)}</p>
          <p><strong>Outbound Cost:</strong> {formatCurrency(dispatch.outboundLogisticsCost)}</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h4>Delivery Proof</h4>
        <ProofUploader dispatchId={id} initialFiles={dispatch.deliveryProof} onDone={load} />
      </div>

      {dispatchModal && (
        <Modal title="Mark as Dispatched" onClose={() => setDispatchModal(false)}>
          <div className="form-grid">
            <div className="form-field"><label>Transporter</label><input value={transporterName} onChange={(e) => setTransporterName(e.target.value)} /></div>
            <div className="form-field"><label>Tracking Reference</label><input value={trackingReference} onChange={(e) => setTrackingReference(e.target.value)} /></div>
            <div className="form-field"><label>Outbound Logistics Cost</label><input type="number" min="0" value={outboundLogisticsCost} onChange={(e) => setOutboundLogisticsCost(e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            <button className="btn btn-secondary" onClick={() => setDispatchModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleMarkDispatched} disabled={saving}>{saving ? 'Saving...' : 'Confirm Dispatched'}</button>
          </div>
        </Modal>
      )}

      {deliverConfirm && (
        <ConfirmDialog
          title="Confirm delivery?"
          message="This closes the item lifecycle for this sale. Make sure delivery proof has been uploaded."
          confirmLabel="Confirm Delivery"
          onConfirm={handleConfirmDelivery}
          onCancel={() => setDeliverConfirm(false)}
        />
      )}
    </div>
  );
}

// Delivery proof uses the dispatch-specific multipart endpoint (rather than
// the generic uploader) since it must append directly to the dispatch
// document's deliveryProof array server-side.
function ProofUploader({ dispatchId, initialFiles, onDone }) {
  const [files, setFiles] = useState(initialFiles || []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      Array.from(fileList).forEach((f) => formData.append('files', f));
      const res = await dispatchApi.addProof(dispatchId, formData);
      setFiles(res.data.data.deliveryProof);
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="form-field">
      <div className="upload-zone" onClick={() => document.getElementById(`proof-input-${dispatchId}`).click()}>
        {uploading ? 'Uploading...' : 'Click to upload delivery proof photos'}
      </div>
      <input id={`proof-input-${dispatchId}`} type="file" multiple accept="image/*,.pdf" style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
      {error && <span className="form-error">{error}</span>}
      <div className="thumb-gallery">
        {files.map((f) => {
          const href = safeUrl(f.url);
          return href ? (
            <a key={f._id} href={href} target="_blank" rel="noreferrer" className="thumb">
              <img src={href} alt="proof" />
            </a>
          ) : (
            <div key={f._id} className="thumb">Unavailable file</div>
          );
        })}
      </div>
    </div>
  );
}
