import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { itemApi } from '../../api/endpoints';
import { apiErrorMessage, downloadAuthenticated } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/States';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency } from '../../utils/format';
import { ITEM_STATUS } from '../../utils/constants';
import ItemForm from './ItemForm';
import PrintStickerModal from './PrintStickerModal';
import BulkStickerModal from './BulkStickerModal';
import useOwners, { ownerName } from './useOwners';

// Matches the server's limit on items per "Download Selected" PDF.
const MAX_SELECTED_FOR_PDF = 200;

const istDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export default function ItemList() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ data: [], pagination: { page: 1, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(params.get('search') || '');
  const [status, setStatus] = useState(params.get('status') || '');
  const [owner, setOwner] = useState(params.get('owner') || '');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [stickerItem, setStickerItem] = useState(null);
  const [bulkStickers, setBulkStickers] = useState(false);
  // Selected rows for "Download Selected", kept across pages: _id -> itemId.
  const [selected, setSelected] = useState(() => new Map());
  const { owners } = useOwners();

  function load() {
    setLoading(true);
    setError('');
    itemApi
      .list({ search, status, owner, page, limit: 15 })
      .then((res) => setData(res.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page, status, owner]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const next = {};
    if (search) next.search = search;
    if (status) next.status = status;
    if (owner) next.owner = owner;
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, owner]);

  // Downloads the currently filtered list (search + status + owner) as a PDF:
  // every matching item, not just this page (within the PDF's row limit).
  async function handleDownloadPdf() {
    setExporting(true);
    try {
      // Dated in IST, matching the date printed inside the PDF.
      await downloadAuthenticated(itemApi.exportPdfPath({ search, status, owner }), `inventory-${istDay()}.pdf`);
    } catch (err) {
      alert(apiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  // Downloads exactly the ticked items (whatever the current filters).
  async function handleDownloadSelected() {
    if (selected.size === 0 || selected.size > MAX_SELECTED_FOR_PDF) return;
    setExporting(true);
    try {
      await downloadAuthenticated(itemApi.exportPdfPath({ ids: [...selected.keys()].join(',') }), `inventory-selected-${istDay()}.pdf`);
    } catch (err) {
      alert(apiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  function toggleSelected(item) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item._id)) next.delete(item._id); else next.set(item._id, item.itemId);
      return next;
    });
  }

  const pageAllSelected = data.data.length > 0 && data.data.every((i) => selected.has(i._id));
  function togglePage() {
    setSelected((prev) => {
      const next = new Map(prev);
      data.data.forEach((i) => (pageAllSelected ? next.delete(i._id) : next.set(i._id, i.itemId)));
      return next;
    });
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Inventory</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleDownloadPdf} disabled={exporting}>
            {exporting ? 'Preparing PDF...' : 'Download PDF'}
          </button>
          <button className="btn btn-secondary" onClick={() => setBulkStickers(true)}>Print Owner Stickers</button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Item</button>
        </div>
      </div>

      <div className="toolbar">
        <input placeholder="Search by name, SKU, item ID, serial, owner..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 280 }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {ITEM_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={owner} onChange={(e) => { setOwner(e.target.value); setPage(1); }} aria-label="Owner">
          <option value="">All owners</option>
          {owners.map((o) => <option key={o._id} value={o._id}>{ownerName(o)} ({o.customerId})</option>)}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="toolbar" style={{ alignItems: 'center' }}>
          <span>{selected.size} item{selected.size === 1 ? '' : 's'} selected</span>
          <button className="btn btn-sm btn-secondary" onClick={handleDownloadSelected} disabled={exporting || selected.size > MAX_SELECTED_FOR_PDF}>
            Download Selected ({selected.size})
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => setSelected(new Map())}>Clear</button>
          {selected.size > MAX_SELECTED_FOR_PDF && (
            <span style={{ color: 'var(--color-danger)' }}>Select at most {MAX_SELECTED_FOR_PDF} items for one PDF.</span>
          )}
        </div>
      )}

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : data.data.length === 0 ? (
        <EmptyState message="No inventory items found." />
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr><th><input type="checkbox" aria-label="Select all on this page" checked={pageAllSelected} onChange={togglePage} /></th><th>Item ID</th><th>Name</th><th>Category</th><th>Owner</th><th>Status</th><th>Location</th><th>Purchase Cost</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {data.data.map((i) => (
                <tr key={i._id}>
                  <td><input type="checkbox" aria-label={`Select ${i.itemId}`} checked={selected.has(i._id)} onChange={() => toggleSelected(i)} /></td>
                  <td><Link to={`/inventory/${i._id}`}>{i.itemId}</Link></td>
                  <td>{i.name}</td>
                  <td>{i.category}</td>
                  <td>{i.owner?.businessName || i.owner?.name || '-'}</td>
                  <td><StatusBadge status={i.status} /></td>
                  <td>{i.currentLocation?.code || '-'}</td>
                  <td>{formatCurrency(i.purchaseCost)}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => setStickerItem(i)}>
                      Print Sticker
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
        </>
      )}

      {showForm && <ItemForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}

      {stickerItem && (
        <PrintStickerModal
          item={stickerItem}
          onClose={() => setStickerItem(null)}
          onItemUpdated={(updated) => {
            setStickerItem(updated);
            setData((d) => ({ ...d, data: d.data.map((row) => (row._id === updated._id ? { ...row, ...updated, owner: row.owner, currentLocation: row.currentLocation } : row)) }));
          }}
        />
      )}

      {bulkStickers && (
        <BulkStickerModal
          initialOwner={owner}
          onClose={() => setBulkStickers(false)}
          onItemUpdated={(updated) => {
            setData((d) => ({ ...d, data: d.data.map((row) => (row._id === updated._id ? { ...row, ...updated, owner: row.owner, currentLocation: row.currentLocation } : row)) }));
          }}
        />
      )}
    </div>
  );
}
