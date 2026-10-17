import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { itemApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState } from '../../components/common/States';
import Sticker from './Sticker';
import './Sticker.css';

// Prints self-adhesive stickers at an exact 80mm x 40mm physical size
// (enforced by the @page rule in Sticker.css). All product data - name,
// Product ID, MRP and HR Mart Price - is read live from the existing
// inventory API; nothing is hardcoded here.
export default function StickerGenerator() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [batch, setBatch] = useState([]); // [{ item, copies }]

  useEffect(() => {
    const t = setTimeout(() => {
      if (!search.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      itemApi
        .list({ search: search.trim(), limit: 20 })
        .then((res) => setResults(res.data.data))
        .catch((err) => setError(apiErrorMessage(err)))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Deep-link support: /stickers?item=<id> from the item detail page.
  useEffect(() => {
    const preselectId = params.get('item');
    if (!preselectId) return;
    itemApi
      .get(preselectId)
      .then((res) => addToBatch(res.data.data))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addToBatch(item) {
    setBatch((b) => {
      if (b.some((row) => row.item._id === item._id)) return b;
      return [...b, { item, copies: 1 }];
    });
  }

  function setCopies(itemId, copies) {
    setBatch((b) => b.map((row) => (row.item._id === itemId ? { ...row, copies: Math.max(1, Number(copies) || 1) } : row)));
  }

  function removeFromBatch(itemId) {
    setBatch((b) => b.filter((row) => row.item._id !== itemId));
  }

  const missingPrices = batch.filter((row) => row.item.mrp == null || row.item.hrMartPrice == null);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Sticker Generator</h1>
        <button className="btn btn-primary" onClick={() => window.print()} disabled={batch.length === 0}>
          Print {batch.reduce((s, r) => s + r.copies, 0)} Sticker(s)
        </button>
      </div>
      <p style={{ color: 'var(--color-text-muted)' }}>
        Stickers print at an exact <strong>80mm × 40mm</strong> physical size. Set your printer's paper
        size to 80mm × 40mm (or select the matching label stock) before printing.
      </p>

      <div className="toolbar">
        <input
          placeholder="Search inventory by name, SKU or Product ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 320 }}
        />
      </div>

      {loading && <LoadingState label="Searching..." />}
      {error && <ErrorState message={error} onRetry={() => setSearch((s) => s)} />}

      {results.length > 0 && (
        <table className="data-table" style={{ marginBottom: 20 }}>
          <thead><tr><th>Product ID</th><th>Name</th><th>MRP</th><th>HR Mart Price</th><th></th></tr></thead>
          <tbody>
            {results.map((i) => (
              <tr key={i._id}>
                <td>{i.itemId}</td>
                <td>{i.name}</td>
                <td>{i.mrp != null ? `₹${i.mrp}` : '—'}</td>
                <td>{i.hrMartPrice != null ? `₹${i.hrMartPrice}` : '—'}</td>
                <td><button className="btn btn-sm btn-secondary" onClick={() => addToBatch(i)}>+ Add to Batch</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Sticker Batch</h3>
      {batch.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Search for and add items above to build a batch of stickers to print.</p>
      ) : (
        <div className="sticker-batch-list">
          {batch.map((row) => (
            <div className="sticker-batch-row" key={row.item._id}>
              <strong style={{ minWidth: 110 }}>{row.item.itemId}</strong>
              <span style={{ flex: 1 }}>{row.item.name}</span>
              <label style={{ fontSize: 12 }}>
                Copies:{' '}
                <input
                  className="copies-input"
                  type="number"
                  min="1"
                  value={row.copies}
                  onChange={(e) => setCopies(row.item._id, e.target.value)}
                />
              </label>
              <button className="btn btn-sm btn-danger" onClick={() => removeFromBatch(row.item._id)}>Remove</button>
            </div>
          ))}
        </div>
      )}

      {missingPrices.length > 0 && (
        <div className="card" style={{ background: 'var(--color-warning-bg)', marginBottom: 16 }}>
          {missingPrices.length} item(s) in this batch are missing MRP and/or HR Mart Price. Edit the item in{' '}
          <strong>Inventory</strong> to set these before printing - the sticker will show "—" instead of a price
          rather than printing an incorrect one.
        </div>
      )}

      {batch.length > 0 && (
        <>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Preview (shown enlarged on screen; prints at true 80mm × 40mm size):</p>
          <div className="sticker-preview-area">
            <div className="sticker-preview-zoom">
              <div className="sticker-print-root">
                {batch.flatMap((row) =>
                  Array.from({ length: row.copies }, (_, i) => <Sticker key={`${row.item._id}-${i}`} item={row.item} />)
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
