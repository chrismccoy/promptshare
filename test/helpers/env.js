/**
 * Test environment.
 */

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "correct horse battery staple";

process.env.NODE_ENV = "test";
process.env.DB_PATH = ":memory:";
process.env.TIME_ZONE = "UTC";
process.env.CSRF_SECRET = "test-csrf-secret-0123456789abcdef0123456789";
process.env.SESSION_SECRET = "test-session-secret-0123456789abcdef012345";
process.env.ADMIN_USERNAME = ADMIN_USERNAME;
process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;

module.exports = { ADMIN_USERNAME, ADMIN_PASSWORD };
