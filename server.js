/**
 * Prompt Share Application
 */

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const db = require("./lib/db");
const { KnexSessionStore } = require("./lib/sessionStore");
const { createCleanupJob } = require("./lib/cleanup");
const promptService = require("./services/prompt");
const { csrfMiddleware } = require("./middleware/csrf");
const flash = require("./middleware/flash");
const { errorHandler, notFoundHandler } = require("./middleware/errors");
const createPromptRouter = require("./routes/prompt");
const createAdminRouter = require("./routes/admin");

const {
  PORT,
  BIND_IP,
  BODY_LIMIT,
  GRACEFUL_SHUTDOWN_MS,
  IS_PRODUCTION,
  IS_TEST,
  SESSION_SECRET,
  SESSION_MAX_AGE_MS,
} = require("./config");

const createApp = () => {
  const app = express();
  const sessionStore = new KnexSessionStore({ db, ttlMs: SESSION_MAX_AGE_MS });

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.set("trust proxy", 1);
  app.set("sessionStore", sessionStore);

  if (!IS_TEST) app.use(morgan(IS_PRODUCTION ? "combined" : "dev"));

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          fontSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: IS_PRODUCTION ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(express.static(path.join(__dirname, "public")));
  app.use(express.urlencoded({ extended: false, limit: BODY_LIMIT }));
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(cookieParser());

  app.use(
    session({
      name: "ps.sid",
      store: sessionStore,
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: "strict",
        secure: IS_PRODUCTION,
        maxAge: SESSION_MAX_AGE_MS,
      },
    })
  );

  app.use(flash);
  app.use(csrfMiddleware);

  app.use(createPromptRouter());
  app.use(createAdminRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

const start = () => {
  const app = createApp();
  const sessionStore = app.get("sessionStore");

  const cleanup = createCleanupJob({
    run: async () =>
      (await promptService.deleteExpired()) + (await sessionStore.clearExpired()),
  });

  let isShuttingDown = false;

  const server = app.listen(PORT, BIND_IP, () => {
    console.log(`App running at http://${BIND_IP}:${PORT}`);
    cleanup.start();
  });

  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n${signal} received — shutting down`);
    cleanup.stop();

    const forceExit = setTimeout(() => process.exit(1), GRACEFUL_SHUTDOWN_MS);
    forceExit.unref();

    try {
      await new Promise((resolve) => server.close(resolve));
      console.log("HTTP server closed");
      await db.destroy();
      console.log("Database connections closed");
      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err.message);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return server;
};

module.exports = { createApp, start };

if (require.main === module) start();
