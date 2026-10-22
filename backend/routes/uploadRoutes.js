const express = require('express');
const ctrl = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');
const { upload, requireCloudinary, canUploadTo, canDeleteFile } = require('../middleware/upload');

const router = express.Router();

router.use(protect);

// POST /api/uploads/:folder  (multipart field name: "files", up to 10)
// Folder and role are checked before multer reads any file.
router.post('/:folder', canUploadTo, requireCloudinary, upload.array('files', 10), ctrl.uploadFiles);

router.delete('/:publicId', canDeleteFile, requireCloudinary, ctrl.deleteFile);

module.exports = router;
