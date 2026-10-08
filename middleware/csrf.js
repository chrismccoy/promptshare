/**
 * CSRF protection middleware
 */

const { doubleCsrf } = require("csrf-csrf");
const { CSRF_SECRET, CSRF_COOKIE_NAME, IS_PRODUCTION } = require("../config");

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => CSRF_SECRET,
  getSessionIdentifier: () => "",
  cookieName: CSRF_COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    sameSite: "strict",
    secure: IS_PRODUCTION,
    path: "/",
  },
  getCsrfTokenFromRequest: (req) =>
    req.body?._csrf ?? req.headers["x-csrf-token"],
});

const csrfMiddleware = (req, res, next) => {
  doubleCsrfProtection(req, res, (err) => {
    if (err) return next(err);
    res.locals.csrfToken = generateCsrfToken(req, res);
    next();
  });
};

module.exports = { csrfMiddleware };
