/**
 * Rate limiting middleware.
 */

const { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } = require("../config");
const { RateLimitError } = require("../lib/errors");

const createRateLimiter = (opts = {}) => {
  const windowMs = opts.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const max = opts.max ?? RATE_LIMIT_MAX;

  const hits = new Map();

  const pruneInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of hits) {
      const filtered = timestamps.filter((t) => now - t < windowMs);
      if (filtered.length === 0) {
        hits.delete(ip);
      } else {
        hits.set(ip, filtered);
      }
    }
  }, windowMs);
  pruneInterval.unref();

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const timestamps = (hits.get(ip) ?? []).filter(
      (t) => now - t < windowMs
    );

    if (timestamps.length >= max) {
      res.set("Retry-After", String(Math.ceil(windowMs / 1000)));
      return next(new RateLimitError(windowMs));
    }

    timestamps.push(now);
    hits.set(ip, timestamps);
    next();
  };
};

module.exports = { createRateLimiter };
