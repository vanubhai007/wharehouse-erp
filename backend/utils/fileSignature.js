// Detects a file's real type from its leading "magic" bytes, so uploads are
// checked against their actual content rather than the client-declared MIME
// type (which the browser - or an attacker - can set to anything).

// Number of leading bytes inspected. PDF readers accept the "%PDF-" header
// anywhere in the first 1024 bytes, so that is the window used for PDFs;
// every other supported type must match at offset 0.
const SIGNATURE_BYTES = 1024;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function detectFileType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';

  const head = buffer.toString('latin1', 0, Math.min(buffer.length, SIGNATURE_BYTES));
  if (head.startsWith('GIF87a') || head.startsWith('GIF89a')) return 'image/gif';
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return 'image/webp';
  if (head.includes('%PDF-')) return 'application/pdf';
  return null;
}

module.exports = { SIGNATURE_BYTES, detectFileType };
