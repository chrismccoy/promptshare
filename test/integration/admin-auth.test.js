const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { setupApp } = require("../helpers/app");
const { createAgent } = require("../helpers/agent");

let app, db, reset;

before(async () => { ({ app, db, reset } = await setupApp()); });
beforeEach(() => reset());

after(() => db.destroy());

test("dashboard redirects to login when logged out", async () => {
  const res = await request(app).get("/admin");
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, "/admin/login");
});

test("login page renders with no-store headers", async () => {
  const res = await request(app).get("/admin/login");
  assert.equal(res.status, 200);
  assert.match(res.text, /Sign in/);
  assert.equal(res.headers["cache-control"], "no-store");
  assert.equal(res.headers["x-robots-tag"], "noindex");
});

test("wrong credentials give 401 with message", async () => {
  const client = await createAgent(app);
  const res = await client.login("admin", "wrong");
  assert.equal(res.status, 401);
  assert.match(res.text, /Invalid username or password\./);
});

test("correct login reaches dashboard; logout ends session", async () => {
  const client = await createAgent(app);
  const res = await client.login();
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, "/admin");

  const dash = await client.agent.get("/admin");
  assert.equal(dash.status, 200);
  assert.match(dash.text, /<h1[^>]*>Prompts<\/h1>/);
  assert.match(dash.text, /<a href="\/" target="_blank" rel="noopener" id="public-site-link"/);
  const link = dash.text.indexOf('id="public-site-link"');
  assert.ok(link > dash.text.indexOf("▣ Prompts") && link < dash.text.indexOf('action="/admin/logout"'), "Public site link sits just above Log out");
  assert.equal(dash.headers["cache-control"], "no-store");

  const out = await client.post("/admin/logout");
  assert.equal(out.status, 302);
  assert.equal((await client.agent.get("/admin")).status, 302);
});

test("logged-in user visiting login is sent to dashboard", async () => {
  const client = await createAgent(app);
  await client.login();
  const res = await client.agent.get("/admin/login");
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, "/admin");
});

const sidOf = (res) => {
  const cookie = [].concat(res.headers["set-cookie"] || []).find((c) => c.startsWith("ps.sid="));
  return cookie && cookie.split(";")[0].slice("ps.sid=".length);
};

test("each login issues a new session id; logout clears the cookie and the row", async () => {
  const client = await createAgent(app);
  const first = sidOf(await client.login());
  assert.ok(first);

  const out = await client.post("/admin/logout");
  assert.equal(out.headers.location, "/admin/login");
  assert.match([].concat(out.headers["set-cookie"] || []).join(), /ps\.sid=;/);
  const firstSid = decodeURIComponent(first).slice(2).split(".")[0];
  assert.equal(await db("sessions").where({ sid: firstSid }).first(), undefined);

  const second = sidOf(await client.login());
  assert.ok(second);
  assert.notEqual(first, second);
});
