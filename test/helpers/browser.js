/**
 * Playwright harness for node:test
 */

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { setupApp } = require("./app");
const { ADMIN_USERNAME, ADMIN_PASSWORD } = require("./env");

const ARTIFACTS = path.join(__dirname, "..", "e2e", "artifacts");

const startE2E = async () => {
  const { app, db, reset } = await setupApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const baseURL = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  const close = async () => {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await db.destroy();
  };

  return { baseURL, browser, db, reset, close };
};

const withPage = async (env, t, fn, contextOptions = {}) => {
  const context = await env.browser.newContext({ baseURL: env.baseURL, ...contextOptions });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  try {
    await fn(page, { context, consoleErrors });
    const csp = consoleErrors.filter((m) => /Content Security Policy/i.test(m));
    if (csp.length) throw new Error(`CSP violations:\n${csp.join("\n")}`);
  } catch (err) {
    fs.mkdirSync(ARTIFACTS, { recursive: true });
    const name = t.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    await page.screenshot({ path: path.join(ARTIFACTS, `${name}.png`), fullPage: true }).catch(() => {});
    throw err;
  } finally {
    await context.close();
  }
};

const loginAs = async (page) => {
  await page.goto("/admin/login");
  await page.fill("#username", ADMIN_USERNAME);
  await page.fill("#password", ADMIN_PASSWORD);
  await Promise.all([page.waitForURL(/\/admin$/), page.click('button[type="submit"]')]);
};

module.exports = { startE2E, withPage, loginAs };
