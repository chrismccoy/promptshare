const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { setupApp } = require("../helpers/app");
const { createAgent } = require("../helpers/agent");
const { insertPrompt, DAY } = require("../helpers/seed");

let app, db, reset, client;

before(async () => {
  ({ app, db, reset } = await setupApp());
  client = await createAgent(app);
  await client.login();
});

beforeEach(() => reset());
after(() => db.destroy());

test("new form offers public choices plus Never, defaults to 7d", async () => {
  const html = (await client.agent.get("/admin/prompts/new")).text;
  for (const c of ["1d", "7d", "30d", "1y", "never"]) assert.match(html, new RegExp(`value="${c}"`));
  assert.match(html, /value="7d"[^>]*checked/);
  assert.doesNotMatch(html, /value="keep"|value="now"/);
});

test("create with Never stores admin prompt and flashes its link once", async () => {
  const res = await client.post("/admin/prompts", { content: "Curated prompt", expiry: "never" });
  assert.equal(res.status, 303);
  assert.equal(res.headers.location, "/admin");

  const row = await db("prompts").first();
  assert.equal(row.source, "admin");
  assert.equal(row.expires_at, null);

  const dash = (await client.agent.get("/admin")).text;
  assert.match(dash, /Prompt created/);
  assert.match(dash, new RegExp(`data-copy="http://127\\.0\\.0\\.1:\\d+/p/${row.key}"`));
  assert.doesNotMatch((await client.agent.get("/admin")).text, /Prompt created/);
});

test("create stores CRLF form newlines as LF", async () => {
  const res = await client.post("/admin/prompts", { content: "line1\r\nline2", expiry: "1d" });
  assert.equal(res.status, 303);
  assert.equal((await db("prompts").first()).content, "line1\nline2");
});

test("create with empty content re-renders 422 with entered values", async () => {
  const res = await client.post("/admin/prompts", { content: "   ", expiry: "30d" });
  assert.equal(res.status, 422);
  assert.match(res.text, /id="form-error"[^>]*>Prompt must not be empty/);
  assert.match(res.text, /value="30d"[^>]*checked/);
  assert.equal(await db("prompts").count({ n: "id" }).first().then((r) => r.n), 0);
});

test("edit form shows details, keep is default, expired prompt is not deleted", async () => {
  const p = await insertPrompt(db, { content: "Old <i>body</i>", expires_at: Date.now() - 1000 });
  const res = await client.agent.get(`/admin/prompts/${p.id}/edit`);
  assert.equal(res.status, 200);
  assert.match(res.text, /Old &lt;i&gt;body&lt;\/i&gt;<\/textarea>/);
  assert.match(res.text, /value="keep"[^>]*checked/);
  assert.match(res.text, /value="now"/);
  assert.match(res.text, /value="never"/);
  assert.ok(await db("prompts").where({ id: p.id }).first(), "expired prompt must survive admin view");
});

test("update content sets edited_at and share page shows Edited", async () => {
  const p = await insertPrompt(db);
  const res = await client.post(`/admin/prompts/${p.id}`, { content: "New body", expiry: "keep" });
  assert.equal(res.status, 303);
  const row = await db("prompts").where({ id: p.id }).first();
  assert.equal(row.content, "New body");
  assert.equal(row.expires_at, p.expires_at);
  assert.ok(row.edited_at);
  const share = await request(app).get(`/p/${p.key}`);
  assert.match(share.text, /id="edited"/);
  assert.match((await client.agent.get("/admin")).text, /Prompt updated/);
});

test("update can revive an expired prompt and expire one now", async () => {
  const dead = await insertPrompt(db, { expires_at: Date.now() - 1000 });
  await client.post(`/admin/prompts/${dead.id}`, { content: "revived", expiry: "30d" });
  assert.equal((await request(app).get(`/p/${dead.key}`)).status, 200);

  const live = await insertPrompt(db);
  await client.post(`/admin/prompts/${live.id}`, { content: "bye", expiry: "now" });
  assert.equal((await request(app).get(`/p/${live.key}`)).status, 404);
});

test("update with empty content re-renders 422 and keeps entered text", async () => {
  const p = await insertPrompt(db, { expires_at: Date.now() + 3 * DAY });
  const res = await client.post(`/admin/prompts/${p.id}`, { content: "", expiry: "never" });
  assert.equal(res.status, 422);
  assert.match(res.text, /Prompt must not be empty/);
  assert.match(res.text, /value="never"[^>]*checked/);
  assert.equal((await db("prompts").where({ id: p.id }).first()).content, p.content);
});

test("edit of unknown id is 404 and bad id is 400, inside admin layout", async () => {
  const missing = await client.agent.get("/admin/prompts/999999/edit");
  assert.equal(missing.status, 404);
  assert.match(missing.text, /Back to prompts/);
  assert.equal((await client.agent.get("/admin/prompts/abc/edit")).status, 400);
});

test("create and edit need a session", async () => {
  const anon = await createAgent(app);
  const res = await anon.post("/admin/prompts", { content: "x", expiry: "1d" });
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, "/admin/login");
});
