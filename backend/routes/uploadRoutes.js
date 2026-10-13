const express = require('express');
const ctrl = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');
const { upload, folder, requireCloudinary } = require('../middleware/upload');

const router = express.Router();

router.use(protect);

// POST /api/uploads/:folder  (multipart field name: "files", up to 10)
router.post('/:folder', requireCloudinary, (req, res, next) => {
  folder(req.params.folder)(req, res, next);
}, upload.array('files', 10), ctrl.uploadFiles);

router.delete('/:publicId', requireCloudinary, ctrl.deleteFile);

module.exports = router;
