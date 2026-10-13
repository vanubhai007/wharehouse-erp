import { useState } from 'react';
import { refurbishmentApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';
import FileUpload from '../../components/common/FileUpload';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';

const CONDITIONS = ['New', 'Good', 'Fair', 'Needs Repair', 'Damaged'];

export default function RefurbishmentDetailModal({ job, onClose, onChanged }) {
  const { user } = useAuth();
  const [beforePhotos, setBeforePhotos] = useState(job.beforePhotos || []);
  const [afterPhotos, setAfterPhotos] = useState(job.afterPhotos || []);
  const [repairCost, setRepairCost] = useState(job.repairCost || 0);
  const [conditionAfter, setConditionAfter] = useState(job.conditionAfter || 'Good');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function savePhotos(target, files) {
    if (target === 'before') setBeforePhotos(files);
    else setAfterPhotos(files);
    try {
      await refurbishmentApi.update(job._id, target === 'before' ? { beforePhotos: files } : { afterPhotos: files });
    } catch (err) {
      // Non-fatal to the modal session view; backend media routes also exist as a fallback.
      setError(apiErrorMessage(err));
    }
  }

  async function handleComplete() {
    setSaving(true);
    setError('');
    try {
      await refurbishmentApi.update(job._id, { repairCost: Number(repairCost) });
      await refurbishmentApi.complete(job._id, { conditionAfter });
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setSaving(true);
    try {
      await refurbishmentApi.approve(job._id);
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const canApprove = ['Admin', 'Warehouse Manager'].includes(user?.role);

  return (
    <Modal title={`Refurbishment: ${job.item?.itemId || ''}`} onClose={onClose}>
      {error && <p className="form-error">{error}</p>}
      <p><strong>Status:</strong> <StatusBadge status={job.status} /></p>
      <p><strong>Work:</strong> {job.workDescription}</p>
      <p><strong>Assigned To:</strong> {job.assignedTo}</p>

      <FileUpload folder="refurbishment" label="Before Photos" files={beforePhotos} onChange={(f) => savePhotos('before', f)} />
      <FileUpload folder="refurbishment" label="After Photos" files={afterPhotos} onChange={(f) => savePhotos('after', f)} />

      {job.status !== 'Completed' && job.status !== 'Approved' && (
        <>
          <div className="form-grid" style={{ marginTop: 10 }}>
            <div className="form-field">
              <label>Repair Cost</label>
              <input type="number" min="0" value={repairCost} onChange={(e) => setRepairCost(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Condition After Repair</label>
              <select value={conditionAfter} onChange={(e) => setConditionAfter(e.target.value)}>
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleComplete} disabled={saving}>
            {saving ? 'Saving...' : 'Mark Completed'}
          </button>
        </>
      )}

      {job.status === 'Completed' && canApprove && (
        <button className="btn btn-primary" onClick={handleApprove} disabled={saving} style={{ marginTop: 10 }}>
          Approve Job
        </button>
      )}

      {job.repairCost > 0 && <p style={{ marginTop: 10, color: 'var(--color-text-muted)' }}>Repair cost logged: {formatCurrency(job.repairCost)}</p>}
    </Modal>
  );
}
