const mongoose = require('mongoose');

// Reusable sub-schema for any Cloudinary-hosted file reference.
// Only the URL + metadata are stored in MongoDB - never a local file path.
const fileSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    originalName: { type: String },
    label: { type: String }, // e.g. "Purchase bill", "Agreement", "Before photo"
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

module.exports = fileSchema;
