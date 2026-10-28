// Error messages for failed authenticated file downloads (PDFs). Downloads
// are requested with responseType 'blob', so an error body from the server
// (JSON such as { message }) arrives as a Blob that apiErrorMessage cannot
// read. This reads it back, keeping only a plain message string.

const MAX_MESSAGE_LENGTH = 300;

// Used when the server sent no readable message.
const FALLBACK_MESSAGES = {
  413: 'This export is too large. Narrow the filters and try again.',
  429: 'Too many PDF exports. Please wait a minute and try again.',
  503: 'The server is busy. Please try again in a few seconds.',
};

// Unexpected server errors never show the server's own text.
const SERVER_ERROR_MESSAGE = 'The PDF could not be created. Please try again later.';

async function messageFromBody(data) {
  if (typeof Blob === 'undefined' || !(data instanceof Blob) || !/json/i.test(data.type)) return null;
  try {
    const body = JSON.parse(await data.text());
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    return message ? message.slice(0, MAX_MESSAGE_LENGTH) : null;
  } catch {
    return null;
  }
}

// Replaces a Blob error body with { success: false, message } so callers can
// keep using apiErrorMessage(err). Errors without a response are unchanged.
export async function withReadableDownloadError(err) {
  const response = err?.response;
  if (!response) return err;
  const { status } = response;
  let message;
  if (status >= 500 && status !== 503) message = SERVER_ERROR_MESSAGE;
  else message = (await messageFromBody(response.data)) || FALLBACK_MESSAGES[status] || null;
  if (message) response.data = { success: false, message };
  return err;
}
