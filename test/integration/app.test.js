const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { setupApp } = require("../helpers/app");

let app, db;

before(async () => { ({ app, db } = await setupApp()); });
after(() => db.destroy());

test("requiring server.js does not start listening", () => {
  assert.equal(typeof require("../../server").start, "function");
  assert.equal(typeof require("../../server").createApp, "function");
});

test("unknown path renders HTML 404", async () => {
  const res = await request(app).get("/nope");
  assert.equal(res.status, 404);
  assert.match(res.headers["content-type"], /text\/html/);
  assert.match(res.text, /This prompt doesn&#39;t exist or has expired\./);
});

test("unknown path returns JSON 404 when asked", async () => {
  const res = await request(app).get("/nope").set("Accept", "application/json");
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { success: false, error: "This prompt doesn't exist or has expired." });
});

test("CSP forbids inline code and framing", async () => {
  const csp = (await request(app).get("/nope")).headers["content-security-policy"];
  assert.ok(csp, "CSP header missing");
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /style-src 'self'/);
});
