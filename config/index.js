/**
 * Application configuration.
 */

require("dotenv").config();

const {
  requirePositiveInt,
  requireString,
  requireEnvString,
  requireChoice,
} = require("./env");

const DAY_MS = 86_400_000;

const MAX_UPLOAD_MB = requirePositiveInt("MAX_UPLOAD_MB", 1);
const MAX_CONTENT_BYTES = MAX_UPLOAD_MB * 1_048_576;

const SECRET_HINT =
  `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`;

module.exports = Object.freeze({
  PORT: requirePositiveInt("PORT", 3000),
  BIND_IP: requireString("IP_ADDRESS", "127.0.0.1"),
  TIME_ZONE: requireString("TIME_ZONE", "America/Toronto"),

  IS_PRODUCTION: process.env.NODE_ENV === "production",
  IS_TEST: process.env.NODE_ENV === "test",

  DAY_MS,

  MAX_UPLOAD_MB,
  MAX_CONTENT_BYTES,

  DEFAULT_TAB: requireChoice("DEFAULT_TAB", ["paste", "upload"], "paste"),
  BODY_LIMIT: 3 * MAX_CONTENT_BYTES + 200 * 1024,

  EXPIRY_OPTIONS: Object.freeze({
    "1d": DAY_MS,
    "7d": 7 * DAY_MS,
    "30d": 30 * DAY_MS,
    "1y": 365 * DAY_MS,
  }),
  DEFAULT_EXPIRY: "7d",

  KEY_LENGTH: 8,
  KEY_ALPHABET:
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",

  PROMPTS_PER_PAGE: 20,
  BULK_DELETE_MAX: 100,

  CLEANUP_INTERVAL_MS: 60 * 60 * 1000,
  GRACEFUL_SHUTDOWN_MS: 5_000,

  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
  RATE_LIMIT_MAX: 20,
  LOGIN_RATE_LIMIT_MAX: 10,

  SESSION_MAX_AGE_MS: 7 * DAY_MS,
  SESSION_SECRET: requireEnvString("SESSION_SECRET", SECRET_HINT),

  CSRF_SECRET: requireEnvString("CSRF_SECRET", SECRET_HINT),
  CSRF_COOKIE_NAME: "__csrf",

  ADMIN_USERNAME: requireEnvString("ADMIN_USERNAME"),
  ADMIN_PASSWORD: requireEnvString("ADMIN_PASSWORD"),
});
