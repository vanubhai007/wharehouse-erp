// Maps multer-storage-cloudinary's req.files into our fileSchema shape.
// Cloudinary storage sets file.path to the secure URL and file.filename to the public_id.
function mapUploadedFiles(files = [], uploadedBy, label) {
  return files.map((f) => ({
    url: f.path,
    publicId: f.filename,
    originalName: f.originalname,
    label,
    uploadedBy,
  }));
}

module.exports = { mapUploadedFiles };
