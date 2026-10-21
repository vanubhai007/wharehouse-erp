import { useState } from 'react';
import { itemApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';

// Scoped pricing-only edit, since MRP/HR Mart Price (used on printed
// stickers) are usually set some time after the item is first received,
// not necessarily at creation. Shared by ItemDetail and the inline
// Print Sticker flow (ItemList/PrintStickerModal) so there is a single
// authorized place to set these prices.
export default function PricingFormModal({ item, onClose, onSaved }) {
  const [estimatedResaleValue, setEstimatedResaleValue] = useState(item.estimatedResaleValue ?? '');
  const [mrp, setMrp] = useState(item.mrp ?? '');
  const [hrMartPrice, setHrMartPrice] = useState(item.hrMartPrice ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await itemApi.update(item._id, {
        estimatedResaleValue: estimatedResaleValue === '' ? undefined : Number(estimatedResaleValue),
        mrp: mrp === '' ? undefined : Number(mrp),
        hrMartPrice: hrMartPrice === '' ? undefined : Number(hrMartPrice),
      });
      onSaved(updated.data.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit Pricing" onClose={onClose}>
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>Estimated Resale Value</label>
          <input type="number" min="0" value={estimatedResaleValue} onChange={(e) => setEstimatedResaleValue(e.target.value)} />
        </div>
        <div className="form-field">
          <label>MRP</label>
          <input type="number" min="0" value={mrp} onChange={(e) => setMrp(e.target.value)} />
        </div>
        <div className="form-field">
          <label>HR Mart Price</label>
          <input type="number" min="0" value={hrMartPrice} onChange={(e) => setHrMartPrice(e.target.value)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
