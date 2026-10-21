import { formatCurrency } from '../../utils/format';

// Pure presentational sticker, sized exactly 80mm x 40mm by Sticker.css.
// `row` fields are mapped 1:1 and only from their own named field -
// productName, productId, mrp and hrMartPrice are never cross-wired.
// Used by PrintStickerModal.jsx (inline sticker printing from the
// Inventory module - there is no separate Sticker Generator page).
//
// mrp/hrMartPrice may legitimately be null here (the on-screen preview is
// shown even before an item has pricing, so the user can see what is
// missing). A missing price is always shown as "Not set", never a dash,
// never ₹0 - PrintStickerModal independently blocks printing until both
// are real numbers, so an actual print never carries an invented price.
function priceOrNotSet(value) {
  return value == null ? 'Not set' : formatCurrency(value);
}

export default function Sticker({ row }) {
  return (
    <div className="sticker">
      <div className="sticker-top">
        <div className="sticker-name">{row.productName}</div>
        {row.qrDataUrl && (
          <div className="sticker-qr">
            <img src={row.qrDataUrl} alt={`QR code for ${row.productId}`} />
          </div>
        )}
      </div>
      <div className="sticker-product-id">ID: {row.productId}</div>
      <div className="sticker-prices">
        <div className="sticker-mrp">
          MRP: <span className="value">{priceOrNotSet(row.mrp)}</span>
        </div>
        <div className="sticker-hr-price">
          <div className="sticker-hr-label">HR Mart Price</div>
          <div className="sticker-hr-value">{priceOrNotSet(row.hrMartPrice)}</div>
        </div>
      </div>
    </div>
  );
}
