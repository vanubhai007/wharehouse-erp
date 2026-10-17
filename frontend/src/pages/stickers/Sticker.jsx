import { formatCurrency } from '../../utils/format';

// Pure presentational sticker, sized exactly 80mm x 40mm by Sticker.css.
// Every value shown comes from the live item record passed in - nothing
// here is hardcoded.
export default function Sticker({ item }) {
  return (
    <div className="sticker">
      <div className="sticker-top">
        <div className="sticker-name">{item.name}</div>
        {item.qrCodeUrl && (
          <div className="sticker-qr">
            <img src={item.qrCodeUrl} alt="QR" />
          </div>
        )}
      </div>
      <div className="sticker-product-id">Product ID: {item.itemId}</div>
      <div className="sticker-prices">
        <div className="sticker-mrp">
          MRP: <span className="value">{item.mrp != null ? formatCurrency(item.mrp) : '—'}</span>
        </div>
        <div className="sticker-hr-price">
          <div className="sticker-hr-label">HR Mart Price</div>
          <div className="sticker-hr-value">{item.hrMartPrice != null ? formatCurrency(item.hrMartPrice) : '—'}</div>
        </div>
      </div>
    </div>
  );
}
