// Guards for rendering stored file links. A stored URL is only used as a
// link or image source when it is a real https:// URL (plus inline
// data:image QR codes for images); anything else - javascript:, data: links,
// malformed values - is rendered as plain text instead.

const DATA_IMAGE = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;

export function safeUrl(url) {
  if (typeof url !== 'string') return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function safeImageSrc(url) {
  if (typeof url === 'string' && DATA_IMAGE.test(url)) return url;
  return safeUrl(url);
}
