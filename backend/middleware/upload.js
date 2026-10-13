const multer = require('multer');
const CloudinaryStorage = require('./cloudinaryStorage');
const { isConfigured } = require('../config/cloudinary');
const ApiError = require('../utils/ApiError');

const MAX_FILE_SIZE_MB = 10;
const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    return cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}. Allowed: images and PDF.`));
  }
  cb(null, true);
}

// Cloudinary storage used when credentials are configured. When they are
// not, memoryStorage is used instead and the upload route itself returns a
// clear "storage not configured" error rather than silently writing to
// local disk (local paths are never a permanent file reference per spec).
const storage = isConfigured ? new CloudinaryStorage() : multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter,
});

// Sets the Cloudinary subfolder for the upcoming upload, e.g. upload/items.
const folder = (name) => (req, res, next) => {
  req.uploadFolder = name;
  next();
};

// Guards upload routes when Cloudinary is not configured, with a clear message.
const requireCloudinary = (req, res, next) => {
  if (!isConfigured) {
    throw ApiError.badRequest(
      'File storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in backend/.env.'
    );
  }
  next();
};

module.exports = { upload, folder, requireCloudinary };
