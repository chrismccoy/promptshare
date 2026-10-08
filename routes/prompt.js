/**
 * Public prompt routes.
 */

const express = require("express");
const promptService = require("../services/prompt");
const { createRateLimiter } = require("../middleware/rateLimit");
const { wantsJson, absoluteUrl } = require("../lib/http");
const {
  MAX_CONTENT_BYTES,
  MAX_UPLOAD_MB,
  EXPIRY_OPTIONS,
  DEFAULT_EXPIRY,
  DEFAULT_TAB,
} = require("../config");

const createPromptRouter = () => {
  const router = express.Router();
  const createLimiter = createRateLimiter();

  router.use("/p", (_req, res, next) => {
    res.set("X-Robots-Tag", "noindex");
    next();
  });

  router.param("key", (req, _res, next, key) => {
    promptService.findByKey(key, { deleteExpired: !req.session?.isAdmin }).then((prompt) => {
      req.prompt = prompt;
      next();
    }, next);
  });

  router.get("/", (_req, res) => {
    res.render("new", {
      maxBytes: MAX_CONTENT_BYTES,
      maxMb: MAX_UPLOAD_MB,
      defaultTab: DEFAULT_TAB,
      expiryChoices: Object.keys(EXPIRY_OPTIONS),
      defaultExpiry: DEFAULT_EXPIRY,
    });
  });

  router.post("/p/create", createLimiter, async (req, res) => {
    const prompt = await promptService.create(req.body?.content, req.body?.expiry, {
      source: "public",
      allowNever: false,
    });
    const sharePath = `/p/${prompt.key}`;

    if (wantsJson(req)) {
      return res.status(201).json({
        success: true,
        key: prompt.key,
        url: absoluteUrl(req, sharePath),
        expiresAt: prompt.neverExpires ? null : new Date(prompt.expires_at).toISOString(),
      });
    }
    res.redirect(303, sharePath);
  });

  router.get("/p/:key.md", (req, res) => {
    res.type("text/plain; charset=utf-8").send(req.prompt.content);
  });

  router.get("/p/:key", (req, res) => {
    res.render("show", { prompt: req.prompt });
  });

  return router;
};

module.exports = createPromptRouter;
