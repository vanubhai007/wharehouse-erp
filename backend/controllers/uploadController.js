const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { mapUploadedFiles } = require('../utils/fileMapper');
const { cloudinary } = require('../config/cloudinary');

// Generic upload endpoint used by every module's file picker / drag-and-drop
// control. Files are pushed straight to Cloudinary; the response contains
// only the URL + metadata that the frontend then attaches to the record
// being created/edited (e.g. item.photos.push(result)).
const uploadFiles = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest('No files were uploaded');
  }
  const label = req.body.label;
  const files = mapUploadedFiles(req.files, req.user._id, label);
  res.status(201).json({ success: true, data: files });
});

// Removes a previously uploaded file from Cloudinary (used by "remove" on an
// upload control). The caller is responsible for also pulling the file
// reference out of the owning record's array via its own update endpoint.
const deleteFile = asyncHandler(async (req, res) => {
  const { publicId } = req.params;
  await cloudinary.uploader.destroy(decodeURIComponent(publicId), { resource_type: 'image' }).catch(() => {});
  await cloudinary.uploader.destroy(decodeURIComponent(publicId), { resource_type: 'raw' }).catch(() => {});
  res.json({ success: true, message: 'File removed' });
});

module.exports = { uploadFiles, deleteFile };
