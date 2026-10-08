/**
 * Error handling middleware.
 */

const { AppError } = require("../lib/errors");
const { wantsJson } = require("../lib/http");
const { MAX_UPLOAD_MB } = require("../config");

const HEADINGS = {
  400: "Bad Request",
  403: "Forbidden",
  404: "Not Found",
  413: "Too Large",
  422: "Invalid Input",
  429: "Too Many Requests",
  500: "Something Went Wrong",
};

const MESSAGES = {
  400: "The request could not be understood.",
  403: "Your form token is missing or out of date. Go back, refresh the page and try again.",
  404: "This prompt doesn't exist or has expired.",
  413: `Prompt is larger than ${MAX_UPLOAD_MB} MB`,
  500: "Something unexpected went wrong. Please try again.",
};

const classify = (err) => {
  if (err instanceof AppError) return [err.statusCode, err.message];
  if (err.code === "EBADCSRFTOKEN" || err.status === 403) return [403, MESSAGES[403]];
  if (err.type === "entity.too.large") return [413, MESSAGES[413]];
  if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    return [400, MESSAGES[400]];
  }
  return [500, MESSAGES[500]];
};

const send = (req, res, status, message) => {
  if (wantsJson(req)) {
    return res.status(status).json({ success: false, error: message });
  }
  const view =
    req.path.startsWith("/admin") && req.session?.isAdmin ? "admin/error" : "error";
  res.status(status).render(view, {
    title: HEADINGS[status] ?? HEADINGS[500],
    code: status,
    heading: HEADINGS[status] ?? HEADINGS[500],
    message,
  });
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const [status, message] = classify(err);
  if (status === 500) console.error(err.stack);
  send(req, res, status, message);
};

const notFoundHandler = (req, res) => send(req, res, 404, MESSAGES[404]);

module.exports = { errorHandler, notFoundHandler };
