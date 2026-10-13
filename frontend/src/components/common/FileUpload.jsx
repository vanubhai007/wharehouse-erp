import { useRef, useState } from 'react';
import { uploadApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;

// Drag-and-drop + file-picker upload control with thumbnail previews,
// multi-file support and remove. Uploads go straight to Cloudinary via the
// generic /api/uploads/:folder endpoint; only the returned {url, publicId,
// originalName} metadata is kept in form state until the parent record is saved.
export default function FileUpload({ folder, label = 'Files', files = [], onChange, multiple = true, accept = 'image/*,.pdf' }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(fileList).forEach((f) => formData.append('files', f));
      const res = await uploadApi.upload(folder, formData);
      onChange([...files, ...res.data.data]);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  function removeFile(idx) {
    const target = files[idx];
    const next = files.filter((_, i) => i !== idx);
    onChange(next);
    if (target?.publicId) {
      uploadApi.remove(target.publicId).catch(() => {});
    }
  }

  return (
    <div className="form-field">
      <label>{label}</label>
      <div
        className={`upload-zone ${dragOver ? 'dragover' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        {uploading ? 'Uploading...' : 'Drag & drop files here, or click to browse (images or PDF, max 10MB each)'}
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {error && <span className="form-error">{error}</span>}
      {files.length > 0 && (
        <div className="thumb-gallery">
          {files.map((f, idx) => (
            <div className="thumb" key={f.publicId || f._id || idx}>
              {IMAGE_EXT.test(f.url || '') ? (
                <img src={f.url} alt={f.originalName || 'file'} />
              ) : (
                <a href={f.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 11, textAlign: 'center', padding: 4 }}>
                  {f.originalName || 'Document'}
                </a>
              )}
              <button type="button" className="remove-btn" onClick={() => removeFile(idx)} title="Remove">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
