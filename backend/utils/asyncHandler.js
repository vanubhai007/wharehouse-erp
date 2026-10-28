// Wraps an async route handler so rejected promises reach the central error handler.
// The returned promise settles once the handler has finished (Express ignores
// it; the PDF export limits use it to hold a render slot until then).
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
