const { cloudinary } = require('../config/cloudinary');
const ApiError = require('../utils/ApiError');
const { SIGNATURE_BYTES, detectFileType } = require('../utils/fileSignature');

const resourceTypeFor = (mimetype) => (mimetype === 'application/pdf' ? 'raw' : 'image');

// A minimal multer storage engine for Cloudinary v2 (the official
// multer-storage-cloudinary package only supports the Cloudinary v1 SDK as
// a peer dependency, which conflicts with cloudinary@^2). Streams each
// incoming file straight to Cloudinary's upload_stream API - nothing ever
// touches local disk.
//
// The first bytes of each file are buffered and checked against the declared
// MIME type before the Cloudinary upload is opened, so a file whose content
// does not match is rejected without any of it being sent to Cloudinary.
class CloudinaryStorage {
  constructor({ folder } = {}) {
    this.folder = folder;
  }

  _handleFile(req, file, cb) {
    const folder = `hrwarehouse/${req.uploadFolder || this.folder || 'misc'}`;
    const resourceType = resourceTypeFor(file.mimetype);
    const stream = file.stream;
    const chunks = [];
    let buffered = 0;
    let ended = false;
    let started = false;

    function start() {
      if (started) return;
      started = true;
      stream.removeListener('data', onData);
      stream.removeListener('end', onEnd);
      stream.pause();

      const head = Buffer.concat(chunks);
      if (detectFileType(head) !== file.mimetype) {
        stream.resume(); // drain the rest of this file so the request can finish
        return cb(ApiError.badRequest(`File content does not match its declared type (${file.mimetype}): ${file.originalname}`));
      }

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
      if (ended) {
        uploadStream.end(head);
      } else {
        uploadStream.write(head);
        stream.pipe(uploadStream);
      }
    }

    function onData(chunk) {
      chunks.push(chunk);
      buffered += chunk.length;
      if (buffered >= SIGNATURE_BYTES) start();
    }

    // Files smaller than the signature window are checked once fully read.
    function onEnd() {
      ended = true;
      start();
    }

    stream.on('data', onData);
    stream.on('end', onEnd);
  }

  // Called by multer to clean up files already stored for a request that is
  // then aborted (e.g. a file over the size limit, which multer truncates -
  // the partial upload is removed here). PDFs are stored as "raw" resources,
  // so the matching resource type must be passed or the delete is a no-op.
  _removeFile(req, file, cb) {
    if (!file.filename) return cb(null);
    cloudinary.uploader.destroy(file.filename, { resource_type: resourceTypeFor(file.mimetype) }, (err) => cb(err));
  }
}

module.exports = CloudinaryStorage;
