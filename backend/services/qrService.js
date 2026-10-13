const QRCode = require('qrcode');
const { cloudinary, isConfigured } = require('../config/cloudinary');

// Generates a QR code that encodes a URL to the item's protected profile
// page in the frontend, uploads the PNG to Cloudinary, and returns the
// hosted URL + publicId to store on the Item document.
async function generateItemQr(itemId, itemMongoId) {
  const target = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/inventory/${itemMongoId}`;
  const dataUrl = await QRCode.toDataURL(target, { width: 400, margin: 1 });

  if (!isConfigured) {
    // Without Cloudinary there's nowhere persistent to store the image;
    // return the data URL so the frontend can still display/download it,
    // but it will not survive a server restart as a stored reference.
    return { url: dataUrl, publicId: null, persisted: false, target };
  }

  const uploadResult = await cloudinary.uploader.upload(dataUrl, {
    folder: 'hrwarehouse/qrcodes',
    public_id: itemId,
    overwrite: true,
  });
  return { url: uploadResult.secure_url, publicId: uploadResult.public_id, persisted: true, target };
}

module.exports = { generateItemQr };
