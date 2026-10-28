import { useLayoutEffect, useRef } from 'react';
import { formatCurrency } from '../../utils/format';

// Pure presentational sticker, sized exactly 80mm x 40mm by Sticker.css.
// Three lines - Product ID, MRP, HR Mart Price - each a label and a value.
// `row` fields are mapped 1:1 and only from their own named field -
// productId, mrp and hrMartPrice are never cross-wired. No QR code or other
// scannable element is printed. Used by PrintStickerModal.jsx (inline sticker
// printing from the Inventory module - there is no separate Sticker
// Generator page).
//
// mrp/hrMartPrice may legitimately be null here (the on-screen preview is
// shown even before an item has pricing, so the user can see what is
// missing). A missing price is always shown as "Not set", never a dash,
// never ₹0 - PrintStickerModal independently blocks printing until both
// are real numbers, so an actual print never carries an invented price.
function priceOrNotSet(value) {
  return value == null ? 'Not set' : formatCurrency(value);
}

// A value wider than its space is shrunk in 0.2mm steps down to 2.8mm (the
// label size); if it still does not fit it wraps instead of being clipped.
const MM = 96 / 25.4; // CSS px per mm
const MIN_VALUE_PX = 2.8 * MM;
const STEP_PX = 0.2 * MM;

function fitValues(sticker) {
  sticker.querySelectorAll('.sticker-value').forEach((el) => {
    el.style.fontSize = '';
    el.classList.remove('sticker-value-wrap');
    let size = parseFloat(window.getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth && size > MIN_VALUE_PX) {
      size = Math.max(MIN_VALUE_PX, size - STEP_PX);
      el.style.fontSize = `${size}px`;
    }
    if (el.scrollWidth > el.clientWidth) el.classList.add('sticker-value-wrap');
  });
}

export default function Sticker({ row }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (ref.current) fitValues(ref.current);
  }, [row.productId, row.mrp, row.hrMartPrice]);

  return (
    <div className="sticker" ref={ref}>
      <div className="sticker-label">Product ID</div>
      <div className="sticker-value sticker-value-id">{row.productId}</div>
      <div className="sticker-label">MRP</div>
      <div className="sticker-value sticker-value-mrp">{priceOrNotSet(row.mrp)}</div>
      <div className="sticker-rule" aria-hidden="true" />
      <div className="sticker-label">HR Mart Price</div>
      <div className="sticker-value sticker-value-hr">{priceOrNotSet(row.hrMartPrice)}</div>
    </div>
  );
}
