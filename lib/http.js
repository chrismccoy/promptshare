/**
 * Request helpers shared by routes and middleware.
 */

const wantsJson = (req) =>
  req.accepts(["html", "json"]) === "json" ||
  req.method === "DELETE" ||
  req.path === "/admin/prompts/bulk-delete";

const absoluteUrl = (req, pathname) =>
  `${req.protocol}://${req.get("host")}${pathname}`;

module.exports = { wantsJson, absoluteUrl };
