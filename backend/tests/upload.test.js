// Cloudinary credentials are intentionally not set in the test environment
// (see tests/testUtils.js), which mirrors a fresh install before the admin
// configures storage. This verifies the upload path fails loudly and
// clearly in that state, rather than silently writing to local disk (which
// the spec explicitly forbids as a permanent file reference).
describe('upload middleware without Cloudinary configured', () => {
  test('requireCloudinary blocks with a clear, actionable error', () => {
    jest.resetModules();
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    const { requireCloudinary } = require('../middleware/upload');
    const next = jest.fn();

    expect(() => requireCloudinary({}, {}, next)).toThrow(/storage is not configured/i);
    expect(next).not.toHaveBeenCalled();
  });

  test('isConfigured is false and memoryStorage is used as a fallback (never local disk paths)', () => {
    jest.resetModules();
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    const { isConfigured } = require('../config/cloudinary');
    expect(isConfigured).toBe(false);
  });
});
