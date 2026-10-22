const ApiError = require('./ApiError');

// Validates file references ({ url, publicId, ... }) that clients send back
// in create/update requests, so only files this app uploaded to the
// configured Cloudinary account can be stored - never javascript:/data:
// links, other hosts, other Cloudinary accounts or mismatched references.

// Public IDs created by this app: hrwarehouse/<folder>/<random id>. Raw
// (PDF) public IDs may carry a file extension.
const PUBLIC_ID_PATTERN = /^hrwarehouse\/([a-z]+)\/[A-Za-z0-9_-]+(\.[a-z0-9]{1,5})?$/;

// Extensions Cloudinary may append to the public ID in a delivery URL.
const DELIVERY_EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  raw: ['pdf'],
};

const LOGO_PATH_PATTERN = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*(\.[a-z0-9]{1,5})?$/;

// Parses https://res.cloudinary.com/<cloud>/<image|raw>/upload/[v<n>/]<rest>
// for the configured cloud. Returns { resourceType, rest } or null.
function parseCloudinaryUrl(url) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName || typeof url !== 'string') return null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    return null;
  }
  // Must already be in canonical form, so nothing (e.g. "..") is normalised away.
  if (parsed.href !== url) return null;
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') return null;
  if (parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) return null;
  if (parsed.pathname.includes('%')) return null;

  const match = /^\/([^/]+)\/(image|raw)\/upload\/(?:v\d+\/)?(.+)$/.exec(parsed.pathname);
  if (!match || match[1] !== cloudName) return null;
  return { resourceType: match[2], rest: match[3] };
}

// True when the reference is an upload from this app in the given folder and
// its URL points at exactly that public ID.
function isApprovedFileRef(ref, folder) {
  if (!ref || typeof ref.publicId !== 'string') return false;
  const idMatch = PUBLIC_ID_PATTERN.exec(ref.publicId);
  if (!idMatch || idMatch[1] !== folder) return false;

  const parsed = parseCloudinaryUrl(ref.url);
  if (!parsed) return false;
  if (parsed.rest === ref.publicId) return true;
  if (!parsed.rest.startsWith(`${ref.publicId}.`)) return false;
  return DELIVERY_EXTENSIONS[parsed.resourceType].includes(parsed.rest.slice(ref.publicId.length + 1));
}

function isApprovedLogoUrl(url) {
  const parsed = parseCloudinaryUrl(url);
  return Boolean(parsed && parsed.resourceType === 'image' && LOGO_PATH_PATTERN.test(parsed.rest));
}

function optionalString(value) {
  return typeof value === 'string' ? value.slice(0, 255) : undefined;
}

function invalidRef(field, detail) {
  return ApiError.badRequest(`Invalid file reference in '${field}'`, [detail]);
}

// Replaces each listed file array in the request body with a clean copy.
// `fields` maps body field -> required upload folder, e.g. { photos: 'items' }.
// An entry that already exists on `existingDoc` (same _id, url and publicId)
// is kept exactly as stored, so legacy references keep working; any new or
// changed entry must be an approved reference and gets uploadedBy = `user`.
function sanitizeFileRefs(body, fields, existingDoc, user) {
  for (const [field, folder] of Object.entries(fields)) {
    if (body[field] === undefined) continue;
    if (!Array.isArray(body[field])) throw invalidRef(field, 'Expected a list of files');
    const stored = (existingDoc && existingDoc[field]) || [];

    body[field] = body[field].map((entry, index) => {
      if (!entry || typeof entry !== 'object') throw invalidRef(field, `Entry ${index + 1} is not a file reference`);
      const existing = entry._id && stored.find((s) => String(s._id) === String(entry._id));
      if (existing && existing.url === entry.url && existing.publicId === entry.publicId) {
        return typeof existing.toObject === 'function' ? existing.toObject() : existing;
      }
      if (!isApprovedFileRef(entry, folder)) {
        throw invalidRef(field, `Entry ${index + 1} is not an approved file link`);
      }
      return {
        url: entry.url,
        publicId: entry.publicId,
        originalName: optionalString(entry.originalName),
        label: optionalString(entry.label),
        uploadedBy: user._id,
      };
    });
  }
}

// companyLogoUrl: empty, unchanged, or an image from the configured account.
function sanitizeLogoUrl(value, current) {
  if (value === '' || value === null || value === current) return value;
  if (!isApprovedLogoUrl(value)) {
    throw invalidRef('companyLogoUrl', 'Must be an image URL from the configured Cloudinary account, or empty');
  }
  return value;
}

module.exports = { PUBLIC_ID_PATTERN, isApprovedFileRef, isApprovedLogoUrl, sanitizeFileRefs, sanitizeLogoUrl };
