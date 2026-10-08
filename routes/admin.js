/**
 * Admin dashboard routes.
 */

const express = require("express");
const promptService = require("../services/prompt");
const { timingSafeStringEqual } = require("../lib/crypto");
const { BadRequestError, ValidationError } = require("../lib/errors");
const { absoluteUrl } = require("../lib/http");
const requireAdmin = require("../middleware/requireAdmin");
const noStore = require("../middleware/noStore");
const { createRateLimiter } = require("../middleware/rateLimit");
const {
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  LOGIN_RATE_LIMIT_MAX,
  BULK_DELETE_MAX,
  EXPIRY_OPTIONS,
  DEFAULT_EXPIRY,
  MAX_CONTENT_BYTES,
  MAX_UPLOAD_MB,
} = require("../config");

const STATUSES = ["all", "active", "expired"];
const SOURCES = ["all", "public", "admin"];

const parseFilters = (query) => ({
  q: typeof query.q === "string" ? query.q.trim().slice(0, 200) : "",
  status: STATUSES.includes(query.status) ? query.status : "all",
  source: SOURCES.includes(query.source) ? query.source : "all",
  page: Math.max(1, parseInt(query.page, 10) || 1),
});

const dashboardUrl = (filters, page) => {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.source !== "all") params.set("source", filters.source);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin?${qs}` : "/admin";
};

const parseId = (raw) => {
  const id = /^\d+$/.test(String(raw)) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestError("Invalid ID");
  return id;
};

const parseIds = (raw) => {
  const list = [].concat(raw ?? []);
  if (list.length === 0 || list.length > BULK_DELETE_MAX) {
    throw new BadRequestError(`Select between 1 and ${BULK_DELETE_MAX} prompts`);
  }
  return [...new Set(list.map(parseId))];
};

const PUBLIC_CHOICES = Object.keys(EXPIRY_OPTIONS);
const CREATE_CHOICES = [...PUBLIC_CHOICES, "never"];
const EDIT_CHOICES = ["keep", ...PUBLIC_CHOICES, "never", "now"];

const formValues = (body, fallbackExpiry) => ({
  content: typeof body?.content === "string" ? body.content : "",
  expiry: typeof body?.expiry === "string" ? body.expiry : fallbackExpiry,
});

const renderNew = (res, { status = 200, values, error = null }) =>
  res.status(status).render("admin/new", {
    values,
    error,
    choices: CREATE_CHOICES,
    maxBytes: MAX_CONTENT_BYTES,
    maxMb: MAX_UPLOAD_MB,
  });

const renderEdit = (res, { status = 200, prompt, values, error = null }) =>
  res.status(status).render("admin/edit", {
    prompt,
    values,
    error,
    choices: EDIT_CHOICES,
    maxBytes: MAX_CONTENT_BYTES,
    maxMb: MAX_UPLOAD_MB,
  });

const createAdminRouter = () => {
  const router = express.Router();
  const loginLimiter = createRateLimiter({ max: LOGIN_RATE_LIMIT_MAX });

  router.use("/admin", noStore);

  router.get("/admin/login", (req, res) => {
    if (req.session?.isAdmin) return res.redirect("/admin");
    res.render("admin/login", { error: null });
  });

  const limitLogin = (req, res, next) =>
    loginLimiter(req, res, (err) =>
      err ? res.status(err.statusCode || 429).render("admin/login", { error: err.message }) : next()
    );

  router.post("/admin/login", limitLogin, (req, res, next) => {
    const { username = "", password = "" } = req.body ?? {};

    const userMatch = timingSafeStringEqual(username, ADMIN_USERNAME);
    const passMatch = timingSafeStringEqual(password, ADMIN_PASSWORD);

    if (!userMatch || !passMatch) {
      return res.status(401).render("admin/login", {
        error: "Invalid username or password.",
      });
    }

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.isAdmin = true;
      res.redirect("/admin");
    });
  });

  router.post("/admin/logout", requireAdmin, (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie("ps.sid");
      res.redirect("/admin/login");
    });
  });

  router.get("/admin", requireAdmin, async (req, res) => {
    const filters = parseFilters(req.query);
    const now = Date.now();
    const startOfToday = promptService.startOfToday(now);
    const [result, stats] = await Promise.all([
      promptService.list(filters),
      promptService.stats({ now, since: startOfToday }),
    ]);
    res.render("admin/dashboard", {
      ...result,
      stats,
      startOfToday,
      filters,
      pageUrl: (n) => dashboardUrl(filters, n),
      shareBase: absoluteUrl(req, "/p/"),
    });
  });

  router.delete("/admin/prompts/:id", requireAdmin, async (req, res) => {
    await promptService.remove(parseId(req.params.id));
    res.json({ success: true });
  });

  router.post("/admin/prompts/bulk-delete", requireAdmin, async (req, res) => {
    const ids = parseIds(req.body?.ids ?? req.body?.["ids[]"]);
    const deleted = await promptService.removeMany(ids);
    res.json({ success: true, deleted });
  });

  router.get("/admin/prompts/new", requireAdmin, (_req, res) => {
    renderNew(res, { values: { content: "", expiry: DEFAULT_EXPIRY } });
  });

  router.post("/admin/prompts", requireAdmin, async (req, res) => {
    const values = formValues(req.body, DEFAULT_EXPIRY);
    try {
      const prompt = await promptService.create(values.content, values.expiry, {
        source: "admin",
        allowNever: true,
      });
      req.session.flash = {
        message: "Prompt created",
        url: absoluteUrl(req, `/p/${prompt.key}`),
      };
      res.redirect(303, "/admin");
    } catch (err) {
      if (err instanceof ValidationError) {
        return renderNew(res, { status: 422, values, error: err.message });
      }
      throw err;
    }
  });

  router.get("/admin/prompts/:id/edit", requireAdmin, async (req, res) => {
    const prompt = await promptService.findById(parseId(req.params.id));
    renderEdit(res, { prompt, values: { content: prompt.content, expiry: "keep" } });
  });

  router.post("/admin/prompts/:id", requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    const values = formValues(req.body, "keep");
    try {
      await promptService.update(id, values);
      req.session.flash = { message: "Prompt updated" };
      res.redirect(303, "/admin");
    } catch (err) {
      if (err instanceof ValidationError) {
        const prompt = await promptService.findById(id);
        return renderEdit(res, { status: 422, prompt, values, error: err.message });
      }
      throw err;
    }
  });

  return router;
};

module.exports = createAdminRouter;
module.exports.parseId = parseId;
module.exports.parseIds = parseIds;
