const net = require('net');
const ApiError = require('../utils/ApiError');

// In-memory, fixed-window rate limiting for the unauthenticated auth
// endpoints (login, forgot-password, first-admin setup), plus per-user limits
// and a concurrency limit for PDF report exports. Counters live in
// this process only: they reset when the server restarts and are not shared
// between instances - running more than one instance needs a shared store.

const MINUTE = 60 * 1000;
const DEFAULT_MAX_KEYS = 10000;

let now = () => Date.now();
const counters = [];

class FixedWindowCounter {
  constructor({ windowMs, max, maxKeys = DEFAULT_MAX_KEYS }) {
    this.windowMs = windowMs;
    this.max = max;
    this.maxKeys = maxKeys;
    this.entries = new Map();
    counters.push(this);
  }

  // Current entry for `key`, dropping it once its window has ended.
  peek(key) {
    const entry = this.entries.get(key);
    if (entry && entry.resetAt <= now()) {
      this.entries.delete(key);
      return null;
    }
    return entry || null;
  }

  isLimited(key) {
    const entry = this.peek(key);
    return Boolean(entry && entry.count >= this.max);
  }

  retryAfterSeconds(key) {
    const entry = this.peek(key);
    return entry ? Math.max(1, Math.ceil((entry.resetAt - now()) / 1000)) : 0;
  }

  // Counts one request; returns true while the count is within the limit.
  hit(key) {
    let entry = this.peek(key);
    if (!entry) {
      this.makeRoom();
      entry = { count: 0, resetAt: now() + this.windowMs };
      this.entries.set(key, entry);
    }
    entry.count += 1;
    return entry.count <= this.max;
  }

  // Takes back one counted request (e.g. a login that did not fail).
  undo(key) {
    const entry = this.peek(key);
    if (entry && entry.count > 0) entry.count -= 1;
  }

  reset(key) {
    this.entries.delete(key);
  }

  // Keeps memory bounded: drop expired entries, then the oldest if still full.
  makeRoom() {
    if (this.entries.size < this.maxKeys) return;
    const t = now();
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= t) this.entries.delete(key);
    }
    while (this.entries.size >= this.maxKeys) {
      this.entries.delete(this.entries.keys().next().value);
    }
  }
}

// Number of trusted reverse-proxy hops for Express's `trust proxy`. Only a
// whole number 0-5 is accepted; anything else means "trust no forwarded
// headers". Never `true`, which would trust client-supplied X-Forwarded-For.
function parseTrustProxy(value) {
  return typeof value === 'string' && /^[0-5]$/.test(value) ? Number(value) : 0;
}

// First four groups (/64) of an IPv6 address, so one client cannot rotate
// through the addresses of its own network to escape a limit.
function ipv6Prefix64(ip) {
  const [head, tail] = ip.split('%')[0].toLowerCase().split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail === undefined ? [] : tail ? tail.split(':') : [];
  const missing = tail === undefined ? 0 : 8 - headGroups.length - tailGroups.length;
  const groups = [...headGroups, ...Array(missing).fill('0'), ...tailGroups];
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

// Client identity for rate limiting. req.ip honours `trust proxy` (see app.js).
function clientKey(req) {
  let ip = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
  if (ip.startsWith('::ffff:') && net.isIPv4(ip.slice(7))) ip = ip.slice(7);
  return net.isIPv6(ip) ? ipv6Prefix64(ip) : ip;
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function tooManyRequests(res, seconds, message) {
  res.set('Retry-After', String(seconds));
  const wait = seconds <= 60 ? 'a minute' : `${Math.ceil(seconds / 60)} minutes`;
  return new ApiError(429, `${message} Please try again in ${wait}.`);
}

const loginPerAccount = new FixedWindowCounter({ windowMs: 15 * MINUTE, max: 5 });
const loginPerIp = new FixedWindowCounter({ windowMs: 15 * MINUTE, max: 50 });
const forgotPasswordPerIp = new FixedWindowCounter({ windowMs: 15 * MINUTE, max: 5 });
const forgotPasswordPerEmail = new FixedWindowCounter({ windowMs: 60 * MINUTE, max: 3 });
const setupPerIp = new FixedWindowCounter({ windowMs: 15 * MINUTE, max: 10 });

// Login: limits failed attempts per IP+email (5) and per IP (50). Each
// attempt is counted when it starts, so concurrent guesses cannot slip past
// the limit; the count is taken back unless the login fails with 401, and a
// successful login clears the IP+email counter.
function loginLimiter(req, res, next) {
  const ip = clientKey(req);
  const accountKey = `${ip}|${normalizeEmail(req.body && req.body.email)}`;
  for (const [counter, key] of [[loginPerAccount, accountKey], [loginPerIp, ip]]) {
    if (counter.isLimited(key)) {
      return next(tooManyRequests(res, counter.retryAfterSeconds(key), 'Too many failed sign-in attempts.'));
    }
  }
  loginPerAccount.hit(accountKey);
  loginPerIp.hit(ip);
  res.on('finish', () => {
    if (res.statusCode === 401) return;
    loginPerIp.undo(ip);
    if (res.statusCode === 200) loginPerAccount.reset(accountKey);
    else loginPerAccount.undo(accountKey);
  });
  next();
}

function perIpLimiter(counter, message) {
  return (req, res, next) => {
    const ip = clientKey(req);
    if (counter.isLimited(ip)) return next(tooManyRequests(res, counter.retryAfterSeconds(ip), message));
    counter.hit(ip);
    next();
  };
}

const forgotPasswordIpLimiter = perIpLimiter(forgotPasswordPerIp, 'Too many password reset requests.');
const setupLimiter = perIpLimiter(setupPerIp, 'Too many setup attempts.');

// Per-email forgot-password limit (3 per hour). Counted for every address,
// registered or not, so the caller can return the same generic response
// either way. Returns true while a reset email may be sent.
function allowResetEmail(email) {
  return forgotPasswordPerEmail.hit(normalizeEmail(email));
}

// PDF exports: at most 10 per signed-in user per minute, and at most 2 being
// built at once across the server. A slot is held for the whole export (row
// count, data fetch, render, send) and freed only when the handler has
// finished - successfully or not. A dropped connection does not free it while
// the render is still running. Requests refused because the server is busy
// do not count towards the user's limit.
const MAX_CONCURRENT_PDF_EXPORTS = 2;
const PDF_BUSY_RETRY_SECONDS = 5;
const pdfExportsPerUser = new FixedWindowCounter({ windowMs: MINUTE, max: 10 });
let pdfExportsInProgress = 0;

// Wraps a PDF export handler (one that returns a promise settling when it has
// finished, as asyncHandler does). `when` limits the checks to PDF requests
// on routes that also serve JSON.
function limitPdfExport(handler, { when = () => true } = {}) {
  return (req, res, next) => {
    if (!when(req)) return handler(req, res, next);
    const key = String(req.user._id);
    if (pdfExportsPerUser.isLimited(key)) {
      return next(tooManyRequests(res, pdfExportsPerUser.retryAfterSeconds(key), 'Too many PDF exports.'));
    }
    if (pdfExportsInProgress >= MAX_CONCURRENT_PDF_EXPORTS) {
      res.set('Retry-After', String(PDF_BUSY_RETRY_SECONDS));
      return next(new ApiError(503, 'The server is busy creating other PDF reports. Please try again in a few seconds.'));
    }
    pdfExportsPerUser.hit(key);
    pdfExportsInProgress += 1;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        pdfExportsInProgress -= 1;
      }
    };
    try {
      return Promise.resolve(handler(req, res, next)).then(release, (err) => {
        release();
        next(err);
      });
    } catch (err) {
      release();
      return next(err);
    }
  };
}

// Report routes serve JSON by default and a PDF with ?format=pdf; only the
// PDF requests are limited.
const limitReportPdfExport = (handler) => limitPdfExport(handler, { when: (req) => req.query.format === 'pdf' });

const pdfExportsInProgressCount = () => pdfExportsInProgress;

// Test helpers: clear every counter, and replace the clock (null restores it).
function resetRateLimits() {
  for (const counter of counters) counter.entries.clear();
}

function setRateLimitClock(clock) {
  now = clock || (() => Date.now());
}

module.exports = {
  loginLimiter,
  forgotPasswordIpLimiter,
  setupLimiter,
  allowResetEmail,
  limitPdfExport,
  limitReportPdfExport,
  pdfExportsInProgressCount,
  parseTrustProxy,
  clientKey,
  FixedWindowCounter,
  resetRateLimits,
  setRateLimitClock,
};
