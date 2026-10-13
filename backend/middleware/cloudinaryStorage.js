const { cloudinary } = require('../config/cloudinary');

// A minimal multer storage engine for Cloudinary v2 (the official
// multer-storage-cloudinary package only supports the Cloudinary v1 SDK as
// a peer dependency, which conflicts with cloudinary@^2). Streams each
// incoming file straight to Cloudinary's upload_stream API - nothing ever
// touches local disk.
class CloudinaryStorage {
  constructor({ folder } = {}) {
    this.folder = folder;
  }

  _handleFile(req, file, cb) {
    const folder = `hrwarehouse/${req.uploadFolder || this.folder || 'misc'}`;
    const resourceType = file.mimetype === 'application/pdf' ? 'raw' : 'image';

    const uploadStream = cloudinary.uploader.upload_stream({ folder, resource_type: resourceType }, (error, result) => {
      if (error) return cb(error);
      cb(null, {
        path: result.secure_url,
        filename: result.public_id,
        size: result.bytes,
        mimetype: file.mimetype,
        originalname: file.originalname,
      });
    });
    file.stream.pipe(uploadStream);
  }

  _removeFile(req, file, cb) {
    cloudinary.uploader.destroy(file.filename, (err) => cb(err));
  }
}

module.exports = CloudinaryStorage;
