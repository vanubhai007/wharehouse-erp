import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { itemApi, warehouseApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState } from '../../components/common/States';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import FileUpload from '../../components/common/FileUpload';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import { ITEM_STATUS, ITEM_STATUS_TRANSITIONS } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import ExpenseFormModal from '../costing/ExpenseFormModal';
import PricingFormModal from './PricingFormModal';
import PrintStickerModal from './PrintStickerModal';

const TABS = ['Overview', 'Photos & Documents', 'Cost Sheet', 'History', 'QR Code'];

export default function ItemDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [costSheet, setCostSheet] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Overview');
  const [statusModal, setStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [moveModal, setMoveModal] = useState(false);
  const [locations, setLocations] = useState([]);
  const [expenseModal, setExpenseModal] = useState(false);
  const [pricingModal, setPricingModal] = useState(false);
  const [stickerModal, setStickerModal] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([itemApi.get(id), itemApi.costSheet(id), itemApi.history(id)])
      .then(([itemRes, costRes, histRes]) => {
        setItem(itemRes.data.data);
        setCostSheet(costRes.data.data);
        setHistory(histRes.data.data);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  const isCorrectionRole = ['Admin', 'Warehouse Manager'].includes(user?.role);
  const forwardOptions = item ? ITEM_STATUS_TRANSITIONS[item.status] || [] : [];
  const prevStatus = item ? ITEM_STATUS[ITEM_STATUS.indexOf(item.status) - 1] : null;
  const correctionOption = isCorrectionRole && prevStatus && !forwardOptions.includes(prevStatus) ? prevStatus : null;
  const allowedNext = correctionOption ? [...forwardOptions, correctionOption] : forwardOptions;

  async function handleStatusChange() {
    setSavingStatus(true);
    try {
      await itemApi.changeStatus(id, { status: targetStatus, remarks });
      setStatusModal(false);
      setRemarks('');
      load();
    } catch (err) {
      alert(apiErrorMessage(err));
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleArchive() {
    await itemApi.archive(id);
    setArchiveConfirm(false);
    navigate('/inventory');
  }

  function openMoveModal() {
    warehouseApi.listLocations({ isActive: true }).then((res) => setLocations(res.data.data));
    setMoveModal(true);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!item) return null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{item.name}</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>
            {item.itemId} · {item.category} · <StatusBadge status={item.status} />
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {allowedNext.length > 0 && (
            <button className="btn btn-primary" onClick={() => { setTargetStatus(allowedNext[0]); setStatusModal(true); }}>
              Change Status
            </button>
          )}
          <button className="btn btn-secondary" onClick={openMoveModal}>Move Location</button>
          <button className="btn btn-secondary" onClick={() => setStickerModal(true)}>Print Sticker</button>
          {item.status === 'Available for Sale' && (
            <button className="btn btn-secondary" onClick={() => navigate(`/sales?item=${item._id}`)}>Propose Sale</button>
          )}
          <button className="btn btn-danger" onClick={() => setArchiveConfirm(true)}>Archive</button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Overview' && (
        <>
          <div className="card form-grid">
            <div><strong>Owner:</strong> {item.owner?.businessName || item.owner?.name}</div>
            <div><strong>SKU:</strong> {item.sku || '-'}</div>
            <div><strong>Brand / Model:</strong> {item.brand || '-'} / {item.model || '-'}</div>
            <div><strong>Serial Number:</strong> {item.serialNumber || '-'}</div>
            <div><strong>Condition:</strong> {item.condition}</div>
            <div><strong>Tracking:</strong> {item.trackingType} {item.trackingType === 'Batch' ? `(Qty: ${item.quantity} ${item.unit})` : ''}</div>
            <div><strong>Purchase Cost:</strong> {formatCurrency(item.purchaseCost)}</div>
            <div><strong>Current Location:</strong> {item.currentLocation?.code || 'Not assigned'}</div>
            <div><strong>Storage Area:</strong> {item.storageAreaSqFt || 0} sq ft</div>
            <div><strong>Received Date:</strong> {formatDate(item.receivedDate)}</div>
            <div><strong>Expected Dispatch:</strong> {formatDate(item.expectedDispatchDate)}</div>
            <div style={{ gridColumn: '1 / -1' }}><strong>Description:</strong> {item.description || '-'}</div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4>Pricing</h4>
              <button className="btn btn-sm btn-secondary" onClick={() => setPricingModal(true)}>Edit Pricing</button>
            </div>
            <div className="form-grid">
              <div><strong>Estimated Resale Value:</strong> {formatCurrency(item.estimatedResaleValue)}</div>
              <div><strong>MRP:</strong> {item.mrp != null ? formatCurrency(item.mrp) : 'Not set'}</div>
              <div><strong>HR Mart Price:</strong> {item.hrMartPrice != null ? formatCurrency(item.hrMartPrice) : 'Not set'}</div>
            </div>
          </div>
        </>
      )}

      {tab === 'Photos & Documents' && (
        <div className="card">
          <h4>Photos</h4>
          <FileUpload
            folder="items"
            files={item.photos}
            onChange={async (files) => {
              await itemApi.update(id, { photos: files });
              load();
            }}
          />
          <h4 style={{ marginTop: 20 }}>Documents (bills, receipts, etc.)</h4>
          <FileUpload
            folder="items"
            files={item.documents}
            onChange={async (files) => {
              await itemApi.update(id, { documents: files });
              load();
            }}
          />
        </div>
      )}

      {tab === 'Cost Sheet' && costSheet && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4>Item-wise Cost Breakdown</h4>
            <button className="btn btn-sm btn-secondary" onClick={() => setExpenseModal(true)}>+ Add Expense</button>
          </div>
          <table className="data-table">
            <tbody>
              <tr><td>Base / Purchase Cost</td><td>{formatCurrency(costSheet.baseCost)}</td></tr>
              <tr><td>Accumulated Warehouse Rental</td><td>{formatCurrency(costSheet.rental)}</td></tr>
              <tr><td>Refurbishment</td><td>{formatCurrency(costSheet.refurbishment)}</td></tr>
              <tr><td>Marketing</td><td>{formatCurrency(costSheet.marketing)}</td></tr>
              <tr><td>Logistics (Inbound + Outbound)</td><td>{formatCurrency(costSheet.logistics)}</td></tr>
              <tr><td>Commission</td><td>{formatCurrency(costSheet.commission)}</td></tr>
              <tr><td>Other</td><td>{formatCurrency(costSheet.other)}</td></tr>
              <tr style={{ fontWeight: 700 }}><td>Total Item Cost</td><td>{formatCurrency(costSheet.totalCost)}</td></tr>
            </tbody>
          </table>

          <h4 style={{ marginTop: 20 }}>Expense Entries</h4>
          {costSheet.expenses.length === 0 ? <p>No manual expense entries for this item.</p> : (
            <table className="data-table">
              <thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Vendor</th><th>Status</th></tr></thead>
              <tbody>
                {costSheet.expenses.map((e) => (
                  <tr key={e._id}>
                    <td>{formatDate(e.date)}</td><td>{e.category}</td><td>{formatCurrency(e.amount)}</td>
                    <td>{e.vendor || '-'}</td><td><StatusBadge status={e.paymentStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'History' && history && (
        <div className="card">
          <h4>Status History</h4>
          <ul style={{ paddingLeft: 18 }}>
            {history.statusHistory.map((h, idx) => (
              <li key={idx} style={{ marginBottom: 8 }}>
                {h.from ? `${h.from} → ` : ''}<strong>{h.to}</strong> by {h.changedBy?.name || h.changedByName || 'System'} on {formatDateTime(h.at)}
                {h.remarks && <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{h.remarks}</div>}
              </li>
            ))}
          </ul>
          <h4 style={{ marginTop: 20 }}>Location History</h4>
          <ul style={{ paddingLeft: 18 }}>
            {history.locationHistory.map((l, idx) => (
              <li key={idx}>
                {l.location?.code} - {l.areaSqFt} sq ft, {formatDate(l.startDate)} to {l.endDate ? formatDate(l.endDate) : 'present'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'QR Code' && (
        <div className="card" style={{ textAlign: 'center' }}>
          {item.qrCodeUrl ? (
            <>
              <img src={item.qrCodeUrl} alt="QR Code" style={{ width: 220, height: 220 }} />
              <div style={{ marginTop: 12 }}>
                <a className="btn btn-secondary btn-sm" href={item.qrCodeUrl} download={`${item.itemId}-qr.png`}>Download QR</a>{' '}
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>Print</button>
              </div>
            </>
          ) : (
            <p>QR code not available.</p>
          )}
        </div>
      )}

      {statusModal && (
        <Modal title="Change Item Status" onClose={() => setStatusModal(false)}>
          <div className="form-field">
            <label>New Status</label>
            <select value={targetStatus} onChange={(e) => setTargetStatus(e.target.value)}>
              {allowedNext.map((s) => (
                <option key={s} value={s}>
                  {s}
                  {s === correctionOption ? ' (correction)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Remarks</label>
            <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setStatusModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleStatusChange} disabled={savingStatus}>
              {savingStatus ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </Modal>
      )}

      {moveModal && (
        <Modal title="Move Warehouse Location" onClose={() => setMoveModal(false)}>
          <MoveLocationForm
            itemId={id}
            locations={locations}
            onSaved={() => { setMoveModal(false); load(); }}
            onCancel={() => setMoveModal(false)}
          />
        </Modal>
      )}

      {expenseModal && (
        <ExpenseFormModal
          itemId={id}
          onClose={() => setExpenseModal(false)}
          onSaved={() => { setExpenseModal(false); load(); }}
        />
      )}

      {pricingModal && (
        <PricingFormModal
          item={item}
          onClose={() => setPricingModal(false)}
          onSaved={() => { setPricingModal(false); load(); }}
        />
      )}

      {stickerModal && (
        <PrintStickerModal
          item={item}
          onClose={() => setStickerModal(false)}
          onItemUpdated={load}
        />
      )}

      {archiveConfirm && (
        <ConfirmDialog
          title="Archive this item?"
          message="Archiving hides this item from active inventory views. This does not delete its history."
          confirmLabel="Archive"
          danger
          onConfirm={handleArchive}
          onCancel={() => setArchiveConfirm(false)}
        />
      )}
    </div>
  );
}

function MoveLocationForm({ itemId, locations, onSaved, onCancel }) {
  const [locationId, setLocationId] = useState('');
  const [areaSqFt, setAreaSqFt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await itemApi.moveLocation(itemId, { locationId, areaSqFt: areaSqFt ? Number(areaSqFt) : undefined });
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
      <div className="form-field">
        <label>New Location</label>
        <select required value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">Select location...</option>
          {locations.map((l) => <option key={l._id} value={l._id}>{l.code}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Area occupied (sq ft) - leave blank to use full location area</label>
        <input type="number" min="0" value={areaSqFt} onChange={(e) => setAreaSqFt(e.target.value)} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Moving...' : 'Move'}</button>
      </div>
    </form>
  );
}
