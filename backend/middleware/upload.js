const multer = require('multer');
const CloudinaryStorage = require('./cloudinaryStorage');
const { isConfigured } = require('../config/cloudinary');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../config/constants');

const MAX_FILE_SIZE_MB = 10;

// Folders the generic /api/uploads endpoints may write to and delete from,
// with the roles allowed for each. These match each module's own canManage
// roles, so only users who can save the owning record can manage its files.
const UPLOAD_FOLDERS = {
  customers: [ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.ACCOUNTS],
  items: [ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.WAREHOUSE_STAFF],
  expenses: [ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.ACCOUNTS],
  payments: [ROLES.ADMIN, ROLES.ACCOUNTS],
  refurbishment: [ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.WAREHOUSE_STAFF],
};

// Cloudinary public IDs created by this app: hrwarehouse/<folder>/<random id>.
const PUBLIC_ID_PATTERN = /^hrwarehouse\/([a-z]+)\/[A-Za-z0-9_-]+$/;
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

function assertFolderAccess(folderName, user) {
  if (!Object.prototype.hasOwnProperty.call(UPLOAD_FOLDERS, folderName)) {
    throw ApiError.badRequest('Unknown upload folder');
  }
  if (!UPLOAD_FOLDERS[folderName].includes(user.role)) {
    throw ApiError.forbidden(`Role '${user.role}' is not permitted to manage files in '${folderName}'`);
  }
}

// Generic upload route: validates the :folder param and the user's role
// before multer reads any file, then sets the Cloudinary subfolder.
const canUploadTo = (req, res, next) => {
  assertFolderAccess(req.params.folder, req.user);
  req.uploadFolder = req.params.folder;
  next();
};

// Generic delete route: only files this app created in an approved folder,
// and only by a role allowed to manage that folder.
const canDeleteFile = (req, res, next) => {
  const match = PUBLIC_ID_PATTERN.exec(req.params.publicId);
  if (!match) throw ApiError.badRequest('Invalid file reference');
  assertFolderAccess(match[1], req.user);
  next();
};

module.exports = { upload, folder, requireCloudinary, canUploadTo, canDeleteFile, UPLOAD_FOLDERS, MAX_FILE_SIZE_MB };
