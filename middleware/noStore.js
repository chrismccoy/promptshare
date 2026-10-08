/**
 * Keeps admin pages out of caches and search engines.
 */

const noStore = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex");
  next();
};

module.exports = noStore;
