import { formatCurrency } from '../../utils/format';

// Pure presentational sticker, sized exactly 80mm x 40mm by Sticker.css.
// `row` fields are mapped 1:1 and only from their own named field -
// productName, productId, mrp and hrMartPrice are never cross-wired.
// Rows only ever reach this component after passing validation in
// StickerGenerator, so mrp/hrMartPrice are always real numbers here - never
// a dash, undefined, NaN or an invented zero.
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
          MRP: <span className="value">{formatCurrency(row.mrp)}</span>
        </div>
        <div className="sticker-hr-price">
          <div className="sticker-hr-label">HR Mart Price</div>
          <div className="sticker-hr-value">{formatCurrency(row.hrMartPrice)}</div>
        </div>
      </div>
    </div>
  );
}
