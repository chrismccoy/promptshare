const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
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

const rows = (html) => (html.match(/data-row-id="/g) || []).length;
const get = (url) => client.agent.get(url);

test("stat cards show counts", async () => {
  await insertPrompt(db);
  await insertPrompt(db, { expires_at: Date.now() + 3_600_000 });
  await insertPrompt(db, { expires_at: Date.now() - 1000 });
  const html = (await get("/admin")).text;
  assert.match(html, /id="stat-total">3</);
  assert.match(html, /id="stat-today">3</);
  assert.match(html, /id="stat-soon">1</);
  assert.match(html, /id="stat-expired">1</);
});

test("table shows key link, escaped preview, badges and actions", async () => {
  const p = await insertPrompt(db, { content: "<b>bold</b> prompt", source: "admin", expires_at: null });
  const html = (await get("/admin")).text;
  assert.equal(rows(html), 1);
  assert.match(html, new RegExp(`href="/p/${p.key}"`));
  assert.match(html, /&lt;b&gt;bold&lt;\/b&gt; prompt/);
  assert.match(html, /data-status="never"/);
  assert.match(html, /dash-badge-admin/);
  assert.match(html, new RegExp(`href="/admin/prompts/${p.id}/edit"`));
  assert.match(html, new RegExp(`class="[^"]*delete-btn[^"]*"[^>]*data-id="${p.id}"`));
});

test("search, status and source filters narrow rows", async () => {
  const a = await insertPrompt(db, { content: "alpha" });
  await insertPrompt(db, { content: "beta", source: "admin" });
  await insertPrompt(db, { content: "gamma", expires_at: Date.now() - 1000 });
  assert.equal(rows((await get(`/admin?q=${a.key}`)).text), 1);
  assert.equal(rows((await get("/admin?q=bet")).text), 1);
  assert.equal(rows((await get("/admin?status=expired")).text), 1);
  assert.equal(rows((await get("/admin?status=active")).text), 2);
  assert.equal(rows((await get("/admin?source=admin")).text), 1);
  assert.equal(rows((await get("/admin?status=bogus&source=bogus")).text), 3);
});

test("empty states differ for no data and no results", async () => {
  assert.match((await get("/admin")).text, /No prompts yet/);
  await insertPrompt(db);
  const html = (await get("/admin?q=zzz")).text;
  assert.match(html, /No results for “zzz”/);
  assert.match(html, /Clear filters/);
});

test("pagination keeps filters and clamps out-of-range pages", async () => {
  for (let i = 0; i < 25; i++) await insertPrompt(db, { content: `match ${i}`, created_at: Date.now() + i });
  const p1 = (await get("/admin?q=match")).text;
  assert.equal(rows(p1), 20);
  assert.match(p1, /href="\/admin\?q=match&amp;page=2"/);
  assert.match(p1, /Page 1 of 2/);

  const far = await get("/admin?q=match&page=999");
  assert.equal(far.status, 200);
  assert.equal(rows(far.text), 5);
  assert.match(far.text, /Page 2 of 2/);
});

test("admin viewing an expired share link gets 404 and the row survives", async () => {
  const p = await insertPrompt(db, { expires_at: Date.now() - 1000 });
  assert.equal((await get(`/p/${p.key}`)).status, 404);
  assert.equal((await get(`/p/${p.key}.md`)).status, 404);
  assert.ok(await db("prompts").where({ id: p.id }).first());
});

test("expired rows have no share, Open or Raw links; active rows keep them", async () => {
  const dead = await insertPrompt(db, { expires_at: Date.now() - 1000 });
  const live = await insertPrompt(db);
  const html = (await get("/admin")).text;
  assert.doesNotMatch(html, new RegExp(`href="/p/${dead.key}`));
  assert.match(html, new RegExp(`<span class="font-mono">${dead.key}</span>`));
  assert.match(html, new RegExp(`href="/p/${live.key}"`));
  assert.match(html, new RegExp(`href="/p/${live.key}\\.md"`));
});

test("edit page hides View share page for expired prompts", async () => {
  const dead = await insertPrompt(db, { expires_at: Date.now() - 1000 });
  const live = await insertPrompt(db);
  assert.doesNotMatch((await get(`/admin/prompts/${dead.id}/edit`)).text, /View share page/);
  assert.match((await get(`/admin/prompts/${live.id}/edit`)).text, /View share page/);
});

test("rows created today carry data-today for the client-side stat", async () => {
  const fresh = await insertPrompt(db);
  const old = await insertPrompt(db, { created_at: Date.now() - 2 * DAY });
  const html = (await get("/admin")).text;
  assert.match(html, new RegExp(`data-row-id="${fresh.id}" data-today="1"`));
  assert.doesNotMatch(html, new RegExp(`data-row-id="${old.id}" data-today`));
  assert.match(html, /id="stat-today">1</);
});
