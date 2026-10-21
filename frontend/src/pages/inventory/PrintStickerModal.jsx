import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import Modal from '../../components/common/Modal';
import PricingFormModal from './PricingFormModal';
import Sticker from '../stickers/Sticker';
import '../stickers/Sticker.css';

// Prints a sticker for an EXISTING inventory item only - there is no
// separate Sticker Generator page. Every field (product name, Product ID,
// MRP, HR Mart Price) is read live from the item record, never typed or
// invented here, and the QR always encodes this item's own stable, already
// generated lookup URL (the same one stored in item.qrCodeUrl at item
// creation by backend/services/qrService.js) - never random/session data.
export default function PrintStickerModal({ item, onClose, onItemUpdated }) {
  const [localItem, setLocalItem] = useState(item);
  const [copies, setCopies] = useState(1);
  const [pricingModal, setPricingModal] = useState(false);
  const [fallbackQr, setFallbackQr] = useState(null);

  const missingMrp = localItem.mrp == null;
  const missingHrPrice = localItem.hrMartPrice == null;
  const missingPrice = missingMrp || missingHrPrice;
  const qrSrc = localItem.qrCodeUrl || fallbackQr;

  useEffect(() => {
    if (!localItem.qrCodeUrl && !fallbackQr) {
      // Legacy item saved before QR generation existed on create: build one
      // locally using the SAME established item-lookup URL pattern the
      // backend uses, not a random or temporary value.
      const target = `${window.location.origin}/inventory/${localItem._id}`;
      QRCode.toDataURL(target, { width: 400, margin: 1 })
        .then(setFallbackQr)
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localItem._id, localItem.qrCodeUrl]);

  const row = {
    productName: localItem.name,
    productId: localItem.itemId,
    mrp: localItem.mrp,
    hrMartPrice: localItem.hrMartPrice,
    qrDataUrl: qrSrc,
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
