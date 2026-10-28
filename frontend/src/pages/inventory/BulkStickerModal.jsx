import { useEffect, useState } from 'react';
import { itemApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/common/Modal';
import { formatCurrency } from '../../utils/format';
import PricingFormModal from './PricingFormModal';
import useOwners, { ownerName } from './useOwners';
import Sticker from '../stickers/Sticker';
import '../stickers/Sticker.css';

// Prints stickers for all of one owner's inventory items at once, using the
// same Sticker component and print isolation as the single-item
// PrintStickerModal. Items are loaded with the inventory list's own owner
// filter (every page), every item starts selected, and each has its own copy
// count. Printing is blocked while a selected item has no MRP/HR Mart Price,
// or when the total number of stickers is over MAX_STICKERS.
const PAGE_SIZE = 100;
const MAX_COPIES_PER_ITEM = 50;
const MAX_STICKERS = 1000;

const needsPricing = (item) => item.mrp == null || item.hrMartPrice == null;

async function fetchOwnerItems(ownerId) {
  const items = [];
  let page = 1;
  let totalPages = 1;
  do {
    const res = await itemApi.list({ owner: ownerId, page, limit: PAGE_SIZE });
    items.push(...res.data.data);
    totalPages = res.data.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);
  // Only this owner's items, each once, even if the data changed between pages.
  const seen = new Set();
  return items.filter((i) => {
    if (String(i.owner?._id ?? i.owner) !== String(ownerId) || seen.has(i._id)) return false;
    seen.add(i._id);
    return true;
  });
}

export default function BulkStickerModal({ initialOwner = '', onClose, onItemUpdated }) {
  const { owners, loading: ownersLoading, error: ownersError } = useOwners();
  const [ownerId, setOwnerId] = useState(initialOwner);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [copies, setCopies] = useState({});
  const [pricingItem, setPricingItem] = useState(null);

  useEffect(() => {
    setItems([]);
    setSelected(new Set());
    setCopies({});
    setError('');
    if (!ownerId) return undefined;
    let active = true;
    setLoading(true);
    fetchOwnerItems(ownerId)
      .then((list) => {
        if (!active) return;
        setItems(list);
        setSelected(new Set(list.map((i) => i._id)));
        setCopies(Object.fromEntries(list.map((i) => [i._id, 1])));
      })
      .catch((err) => active && setError(apiErrorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [ownerId]);

  const chosen = items.filter((i) => selected.has(i._id));
  const missing = chosen.filter(needsPricing);
  const totalStickers = chosen.reduce((sum, i) => sum + (copies[i._id] || 1), 0);
  const overCap = totalStickers > MAX_STICKERS;
  const canPrint = chosen.length > 0 && missing.length === 0 && !overCap;

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function setItemCopies(id, value) {
    const n = Math.min(MAX_COPIES_PER_ITEM, Math.max(1, Math.floor(Number(value)) || 1));
    setCopies((prev) => ({ ...prev, [id]: n }));
  }

  function handlePrint() {
    if (!canPrint) return;
    window.print();
  }

  return (
    <>
      <Modal title="Print Owner Stickers" onClose={onClose}>
        <div className="form-field" style={{ maxWidth: 420 }}>
          <label>Owner</label>
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} disabled={ownersLoading}>
            <option value="">{ownersLoading ? 'Loading owners...' : 'Select owner...'}</option>
            {owners.map((o) => (
              <option key={o._id} value={o._id}>{ownerName(o)} ({o.customerId})</option>
            ))}
          </select>
        </div>
        {ownersError && <div className="form-error">{ownersError}</div>}
        {error && <div className="form-error">{error}</div>}
        {loading && <p>Loading items...</p>}

        {ownerId && !loading && !error && items.length === 0 && <p>This owner has no inventory items.</p>}

        {items.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0 8px', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelected(new Set(items.map((i) => i._id)))}>Select all</button>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelected(new Set())}>Select none</button>
              <span data-testid="bulk-summary" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {chosen.length} of {items.length} items selected · {totalStickers} sticker{totalStickers === 1 ? '' : 's'}
              </span>
            </div>

            <div style={{ maxHeight: '45vh', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr><th /><th>Item ID</th><th>Name</th><th>MRP</th><th>HR Mart Price</th><th>Copies</th></tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i._id} data-item-id={i.itemId}>
                      <td><input type="checkbox" aria-label={`Select ${i.itemId}`} checked={selected.has(i._id)} onChange={() => toggle(i._id)} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{i.itemId}</td>
                      <td>{i.name}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{i.mrp == null ? <span style={{ color: 'var(--color-danger)' }}>Not set</span> : formatCurrency(i.mrp)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{i.hrMartPrice == null ? <span style={{ color: 'var(--color-danger)' }}>Not set</span> : formatCurrency(i.hrMartPrice)}</td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          max={MAX_COPIES_PER_ITEM}
                          aria-label={`Copies of ${i.itemId}`}
                          value={copies[i._id] || 1}
                          onChange={(e) => setItemCopies(i._id, e.target.value)}
                          style={{ width: 64 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {missing.length > 0 && (
              <div className="form-error" data-testid="bulk-missing" style={{ marginTop: 12 }}>
                {missing.length} selected item{missing.length === 1 ? ' needs' : 's need'} pricing before printing. Set
                both MRP and HR Mart Price, or deselect {missing.length === 1 ? 'it' : 'them'}:
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {missing.map((i) => (
                    <li key={i._id}>
                      {i.itemId} - {i.name}{' '}
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => setPricingItem(i)}>Edit Pricing</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {overCap && (
              <div className="form-error" data-testid="bulk-overcap" style={{ marginTop: 12 }}>
                {totalStickers} stickers selected - at most {MAX_STICKERS} can be printed at once. Reduce the copies or
                deselect some items.
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" onClick={handlePrint} disabled={!canPrint}>
            Print {totalStickers} Sticker{totalStickers === 1 ? '' : 's'}
          </button>
        </div>
      </Modal>

      {pricingItem && (
        <PricingFormModal
          item={pricingItem}
          onClose={() => setPricingItem(null)}
          onSaved={(updated) => {
            setPricingItem(null);
            setItems((list) => list.map((row) => (row._id === updated._id ? { ...row, ...updated, owner: row.owner, currentLocation: row.currentLocation } : row)));
            if (onItemUpdated) onItemUpdated(updated);
          }}
        />
      )}

      {/* Print source, as in PrintStickerModal: off-screen until @media print
          (Sticker.css). Only rendered when printing is allowed, so a sticker
          without a real price or over the limit can never be printed. */}
      {canPrint && (
        <div className="sticker-print-root">
          {chosen.flatMap((i) => Array.from({ length: copies[i._id] || 1 }, (_, n) => (
            <Sticker key={`${i._id}-${n}`} row={{ productId: i.itemId, mrp: i.mrp, hrMartPrice: i.hrMartPrice }} />
          )))}
        </div>
      )}
    </>
  );
}
