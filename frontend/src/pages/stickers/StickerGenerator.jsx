import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import Sticker from './Sticker';
import './Sticker.css';

const emptyForm = { productName: '', productId: '', mrp: '', hrMartPrice: '', qrContent: '', copies: 1 };

// Fully manual sticker builder - does NOT depend on Inventory data or any
// API response. Product Name, Product ID, MRP and HR Mart Price are typed
// directly by the user; a real, locally-generated, scannable QR code is
// produced with the `qrcode` library (no decorative placeholder). Prints
// at an exact 80mm x 40mm physical size (see Sticker.css @page rule).
export default function StickerGenerator() {
  const [params] = useSearchParams();
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [editingIndex, setEditingIndex] = useState(null);
  const [batch, setBatch] = useState([]); // [{ id, productName, productId, mrp, hrMartPrice, qrContent, copies, qrDataUrl }]
  const [generating, setGenerating] = useState(false);
  const [formError, setFormError] = useState('');
  const nextId = useRef(1);

  // Deep-link prefill (e.g. from the Inventory item page's "Generate
  // Sticker" button): values are read directly from the URL query string,
  // which the caller already populated from data it had loaded itself.
  // This page never calls the inventory API to resolve them.
  useEffect(() => {
    const productName = params.get('productName');
    const productId = params.get('productId');
    const mrp = params.get('mrp');
    const hrMartPrice = params.get('hrMartPrice');
    if (productName || productId) {
      setForm((f) => ({
        ...f,
        productName: productName || '',
        productId: productId || '',
        mrp: mrp || '',
        hrMartPrice: hrMartPrice || '',
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((fe) => ({ ...fe, [field]: undefined }));
  }

  // Required-field validation - MRP and HR Mart Price are independent
  // fields, each checked and reported on its own.
  function validate() {
    const errs = {};
    if (!form.productName.trim()) errs.productName = 'Product Name is required';
    if (!form.productId.trim()) errs.productId = 'Product ID is required';
    if (form.mrp === '' || form.mrp === null || isNaN(Number(form.mrp)) || Number(form.mrp) < 0) {
      errs.mrp = 'MRP is required and must be a valid non-negative number';
    }
    if (form.hrMartPrice === '' || form.hrMartPrice === null || isNaN(Number(form.hrMartPrice)) || Number(form.hrMartPrice) < 0) {
      errs.hrMartPrice = 'HR Mart Price is required and must be a valid non-negative number';
    }
    if (form.copies === '' || isNaN(Number(form.copies)) || Number(form.copies) < 1) {
      errs.copies = 'Copies must be at least 1';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function autoFillQrContent() {
    set('qrContent', [form.productId, form.productName].filter(Boolean).join(' | '));
  }

  async function handleAddOrUpdate(e) {
    e.preventDefault();
    setFormError('');
    if (!validate()) {
      setFormError('Please fix the highlighted fields before adding this sticker. Printing is blocked until every required field is filled.');
      return;
    }
    setGenerating(true);
    try {
      // Manual QR content if provided, otherwise auto-generate from the
      // entered Product ID + Name.
      const qrText = form.qrContent.trim() || [form.productId, form.productName].filter(Boolean).join(' | ');
      const qrDataUrl = await QRCode.toDataURL(qrText, { width: 300, margin: 1 });
      const row = {
        id: editingIndex !== null ? batch[editingIndex].id : nextId.current++,
        productName: form.productName.trim(),
        productId: form.productId.trim(),
        mrp: Number(form.mrp),
        hrMartPrice: Number(form.hrMartPrice),
        qrContent: qrText,
        copies: Math.max(1, Number(form.copies) || 1),
        qrDataUrl,
      };
      setBatch((b) => {
        if (editingIndex !== null) {
          const copy = [...b];
          copy[editingIndex] = row;
          return copy;
        }
        return [...b, row];
      });
      setForm(emptyForm);
      setEditingIndex(null);
    } catch (err) {
      setFormError('Failed to generate the QR code: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  function editRow(idx) {
    const row = batch[idx];
    setForm({
      productName: row.productName,
      productId: row.productId,
      mrp: String(row.mrp),
      hrMartPrice: String(row.hrMartPrice),
      qrContent: row.qrContent,
      copies: row.copies,
    });
    setEditingIndex(idx);
    setFieldErrors({});
    setFormError('');
  }

  function cancelEdit() {
    setForm(emptyForm);
    setEditingIndex(null);
    setFieldErrors({});
    setFormError('');
  }

  function removeRow(idx) {
    setBatch((b) => b.filter((_, i) => i !== idx));
    if (editingIndex === idx) cancelEdit();
  }

  function setCopies(idx, copies) {
    setBatch((b) => b.map((row, i) => (i === idx ? { ...row, copies: Math.max(1, Number(copies) || 1) } : row)));
  }

  const totalCopies = batch.reduce((s, r) => s + r.copies, 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Sticker Generator</h1>
        <button className="btn btn-primary" onClick={() => window.print()} disabled={batch.length === 0}>
          Print {totalCopies} Sticker(s)
        </button>
      </div>
      <p style={{ color: 'var(--color-text-muted)' }}>
        Stickers print at an exact <strong>80mm × 40mm</strong> physical size. Every field below is entered
        manually - this page does not read or depend on Inventory data.
      </p>

      <div className="card" style={{ maxWidth: 700, marginBottom: 20 }}>
        <h4 style={{ marginTop: 0 }}>{editingIndex !== null ? 'Edit Sticker' : 'Add Sticker'}</h4>
        {formError && <p className="form-error">{formError}</p>}
        <form onSubmit={handleAddOrUpdate}>
          <div className="form-grid">
            <div className="form-field">
              <label>Product Name <span className="required">*</span></label>
              <input value={form.productName} onChange={(e) => set('productName', e.target.value)} placeholder="e.g. Fridge" />
              {fieldErrors.productName && <span className="form-error">{fieldErrors.productName}</span>}
            </div>
            <div className="form-field">
              <label>Product ID <span className="required">*</span></label>
              <input value={form.productId} onChange={(e) => set('productId', e.target.value)} placeholder="e.g. ITM-00001" />
              {fieldErrors.productId && <span className="form-error">{fieldErrors.productId}</span>}
            </div>
            <div className="form-field">
              <label>MRP (₹) <span className="required">*</span></label>
              <input type="number" min="0" step="any" value={form.mrp} onChange={(e) => set('mrp', e.target.value)} placeholder="e.g. 25000" />
              {fieldErrors.mrp && <span className="form-error">{fieldErrors.mrp}</span>}
            </div>
            <div className="form-field">
              <label>HR Mart Price (₹) <span className="required">*</span></label>
              <input type="number" min="0" step="any" value={form.hrMartPrice} onChange={(e) => set('hrMartPrice', e.target.value)} placeholder="e.g. 22500" />
              {fieldErrors.hrMartPrice && <span className="form-error">{fieldErrors.hrMartPrice}</span>}
            </div>
            <div className="form-field">
              <label>Number of Sticker Copies</label>
              <input type="number" min="1" value={form.copies} onChange={(e) => set('copies', e.target.value)} />
              {fieldErrors.copies && <span className="form-error">{fieldErrors.copies}</span>}
            </div>
          </div>
          <div className="form-field">
            <label>QR Code Content (optional)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ flex: 1 }}
                value={form.qrContent}
                onChange={(e) => set('qrContent', e.target.value)}
                placeholder="Leave blank to auto-generate from Product ID + Name"
              />
              <button type="button" className="btn btn-sm btn-secondary" onClick={autoFillQrContent}>
                Generate from Product Details
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            {editingIndex !== null && (
              <button type="button" className="btn btn-secondary" onClick={cancelEdit}>Cancel Edit</button>
            )}
            <button type="submit" className="btn btn-primary" disabled={generating}>
              {generating ? 'Generating QR...' : editingIndex !== null ? 'Update Sticker' : '+ Add to Batch'}
            </button>
          </div>
        </form>
      </div>

      <h3>Sticker Batch</h3>
      {batch.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No stickers added yet. Fill in the form above and click "Add to Batch".</p>
      ) : (
        <div className="sticker-batch-list">
          {batch.map((row, idx) => (
            <div className="sticker-batch-row" key={row.id}>
              <strong style={{ minWidth: 110 }}>{row.productId}</strong>
              <span style={{ flex: 1 }}>{row.productName}</span>
              <span style={{ fontSize: 12 }}>MRP: ₹{row.mrp}</span>
              <span style={{ fontSize: 12 }}>HR Mart: ₹{row.hrMartPrice}</span>
              <label style={{ fontSize: 12 }}>
                Copies:{' '}
                <input
                  className="copies-input"
                  type="number"
                  min="1"
                  value={row.copies}
                  onChange={(e) => setCopies(idx, e.target.value)}
                />
              </label>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => editRow(idx)}>Edit</button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => removeRow(idx)}>Remove</button>
            </div>
          ))}
        </div>
      )}

      {batch.length > 0 && (
        <>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 16 }}>
            Preview (shown enlarged on screen; prints at true 80mm × 40mm size):
          </p>
          <div className="sticker-preview-area">
            <div className="sticker-preview-zoom">
              <div className="sticker-print-root">
                {batch.flatMap((row) =>
                  Array.from({ length: row.copies }, (_, i) => <Sticker key={`${row.id}-${i}`} row={row} />)
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="card" style={{ marginTop: 20, background: 'var(--color-info-bg)' }}>
        <h4 style={{ marginTop: 0 }}>Printer Setup Instructions</h4>
        <ul style={{ marginBottom: 0, paddingLeft: 18 }}>
          <li>In the print dialog, set <strong>Paper size</strong> to a custom 80mm × 40mm label (or your label roll's preset).</li>
          <li>Turn off <strong>"Fit to page" / "Scale to fit"</strong> - set scale to 100% so each label prints at its true size.</li>
          <li>Set margins to <strong>None</strong>.</li>
          <li>Each sticker already prints on its own label - set the number of copies in the batch above, not in the print dialog.</li>
        </ul>
      </div>
    </div>
  );
}
