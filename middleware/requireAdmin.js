/**
 * Middleware that requires an active admin session.
 */

const { wantsJson } = require("../lib/http");

const requireAdmin = (req, res, next) => {
  if (req.session?.isAdmin) return next();
  if (wantsJson(req)) {
    return res
      .status(401)
      .json({ success: false, error: "Your session has expired. Log in again." });
  }
  res.redirect("/admin/login");
};

module.exports = requireAdmin;
