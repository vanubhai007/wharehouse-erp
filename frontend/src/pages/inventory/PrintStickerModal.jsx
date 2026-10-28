import { useState } from 'react';
import Modal from '../../components/common/Modal';
import PricingFormModal from './PricingFormModal';
import Sticker from '../stickers/Sticker';
import '../stickers/Sticker.css';

// Prints a sticker for an EXISTING inventory item only - there is no
// separate Sticker Generator page. Every printed field (Product ID, MRP,
// HR Mart Price) is read live from the item record, never typed or
// invented here. The sticker carries no QR code; the item's own QR
// (item.qrCodeUrl) stays available on the item detail page.
export default function PrintStickerModal({ item, onClose, onItemUpdated }) {
  const [localItem, setLocalItem] = useState(item);
  const [copies, setCopies] = useState(1);
  const [pricingModal, setPricingModal] = useState(false);

  const missingMrp = localItem.mrp == null;
  const missingHrPrice = localItem.hrMartPrice == null;
  const missingPrice = missingMrp || missingHrPrice;

  const row = {
    productId: localItem.itemId,
    mrp: localItem.mrp,
    hrMartPrice: localItem.hrMartPrice,
  };

  function handlePrint() {
    if (missingPrice) return;
    window.print();
  }

  return (
    <>
      <Modal title={`Print Sticker — ${localItem.itemId}`} onClose={onClose}>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 0, fontSize: 13 }}>
          Uses this item's saved Product ID, MRP and HR Mart Price. To change these values, edit the item - not
          the sticker.
        </p>

        {missingPrice && (
          <div className="form-error" style={{ marginBottom: 14 }}>
            {missingMrp && missingHrPrice
              ? 'This item has no MRP or HR Mart Price saved yet.'
              : missingMrp
              ? 'This item has no MRP saved yet.'
              : 'This item has no HR Mart Price saved yet.'}{' '}
            Printing is blocked until both prices are set.{' '}
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setPricingModal(true)}>
              Edit Pricing
            </button>
          </div>
        )}

        <div className="form-field" style={{ maxWidth: 180 }}>
          <label>Number of Copies</label>
          <input
            type="number"
            min="1"
            value={copies}
            onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>

        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>
          Preview (true 80mm × 40mm physical size):
        </p>
        <div className="sticker-modal-preview">
          <Sticker row={row} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-primary" onClick={handlePrint} disabled={missingPrice}>
            Print {copies} Sticker{copies > 1 ? 's' : ''}
          </button>
        </div>
      </Modal>

      {pricingModal && (
        <PricingFormModal
          item={localItem}
          onClose={() => setPricingModal(false)}
          onSaved={(updated) => {
            setPricingModal(false);
            setLocalItem(updated);
            if (onItemUpdated) onItemUpdated(updated);
          }}
        />
      )}

      {/* Real print source, kept off-screen until @media print repositions
          it (see Sticker.css) - intentionally not nested inside the modal
          above, so print isolation never depends on the modal's layout. */}
      <div className="sticker-print-root">
        {Array.from({ length: copies }, (_, i) => (
          <Sticker key={i} row={row} />
        ))}
      </div>
    </>
  );
}
