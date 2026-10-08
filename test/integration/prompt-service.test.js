const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { setupDb } = require("../helpers/db");
const { insertPrompt, DAY } = require("../helpers/seed");
const service = require("../../services/prompt");
const repo = require("../../repositories/prompt");

let db, reset;
before(async () => { ({ db, reset } = await setupDb()); });
beforeEach(() => reset());
after(() => db.destroy());

test("create stores trimmed content, key, source and expiry", async () => {
  const before = Date.now();
  const p = await service.create("  Hello  ", "30d", { source: "public" });
  assert.match(p.key, /^[0-9A-Za-z]{8}$/);
  assert.equal(p.content, "Hello");
  assert.ok(p.expires_at >= before + 30 * DAY);
  const row = await db("prompts").where({ id: p.id }).first();
  assert.equal(row.source, "public");
  assert.equal(row.content, "Hello");
});

test("create uses 7d when expiry is missing and rejects never for public", async () => {
  const p = await service.create("x", undefined);
  assert.ok(Math.abs(p.expires_at - (Date.now() + 7 * DAY)) < 5000);
  await assert.rejects(service.create("x", "never"), { message: "Invalid expiry option" });
});

test("create with allowNever stores NULL expiry", async () => {
  const p = await service.create("x", "never", { source: "admin", allowNever: true });
  const row = await db("prompts").where({ id: p.id }).first();
  assert.equal(row.expires_at, null);
  assert.equal(row.source, "admin");
});

test("repo.insert flags duplicate keys", async () => {
  const seed = await insertPrompt(db);
  const now = Date.now();
  await assert.rejects(
    repo.insert({ key: seed.key, content: "y", expires_at: null, source: "public", created_at: now, updated_at: now }),
    (err) => err.isDuplicateKey === true
  );
});

test("findByKey returns active and never-expiring prompts", async () => {
  const a = await insertPrompt(db);
  const n = await insertPrompt(db, { expires_at: null });
  assert.equal((await service.findByKey(a.key)).id, a.id);
  assert.equal((await service.findByKey(n.key)).id, n.id);
});

test("findByKey deletes expired prompt and throws 404", async () => {
  const e = await insertPrompt(db, { expires_at: Date.now() - 1000 });
  await assert.rejects(service.findByKey(e.key), { statusCode: 404 });
  assert.equal(await db("prompts").where({ id: e.id }).first(), undefined);
});

test("findById returns expired prompt without deleting it", async () => {
  const e = await insertPrompt(db, { expires_at: Date.now() - 1000 });
  const p = await service.findById(e.id);
  assert.equal(p.status, "expired");
  assert.ok(await db("prompts").where({ id: e.id }).first());
  await assert.rejects(service.findById(999_999), { statusCode: 404 });
});

test("update changes content and expiry and sets edited_at", async () => {
  const s = await insertPrompt(db);
  const p = await service.update(s.id, { content: " New body ", expiry: "never" });
  assert.equal(p.content, "New body");
  const row = await db("prompts").where({ id: s.id }).first();
  assert.equal(row.content, "New body");
  assert.equal(row.expires_at, null);
  assert.ok(row.edited_at >= s.created_at);
});

test("update with keep leaves expiry; now expires immediately", async () => {
  const s = await insertPrompt(db);
  await service.update(s.id, { content: "a", expiry: "keep" });
  assert.equal((await db("prompts").where({ id: s.id }).first()).expires_at, s.expires_at);
  await service.update(s.id, { content: "a", expiry: "now" });
  await assert.rejects(service.findByKey(s.key), { statusCode: 404 });
});

test("list searches key and content, LIKE wildcards match literally", async () => {
  const k = await insertPrompt(db, { content: "alpha" });
  await insertPrompt(db, { content: "100% literal" });
  await insertPrompt(db, { content: "1000 other" });
  assert.equal((await service.list({ q: k.key })).total, 1);
  assert.equal((await service.list({ q: "alp" })).total, 1);
  assert.equal((await service.list({ q: "0%" })).total, 1);
  assert.equal((await service.list({ q: "_" })).total, 0);
});

test("list filters status and source", async () => {
  await insertPrompt(db);
  await insertPrompt(db, { expires_at: null, source: "admin" });
  await insertPrompt(db, { expires_at: Date.now() - 1000 });
  assert.equal((await service.list({ status: "active" })).total, 2);
  assert.equal((await service.list({ status: "expired" })).total, 1);
  assert.equal((await service.list({ source: "admin" })).total, 1);
  assert.equal((await service.list({ source: "public", status: "active" })).total, 1);
});

test("list paginates newest first and clamps page past the end", async () => {
  for (let i = 0; i < 25; i++) await insertPrompt(db, { created_at: Date.now() + i, content: `n${i}` });
  const p1 = await service.list({ page: 1 });
  assert.equal(p1.prompts.length, 20);
  assert.equal(p1.totalPages, 2);
  assert.equal(p1.prompts[0].content, "n24");
  const p2 = await service.list({ page: 2 });
  assert.equal(p2.prompts.length, 5);
  const far = await service.list({ page: 999 });
  assert.equal(far.page, 2);
  assert.equal(far.prompts.length, 5);
});

test("list rows carry byte size without loading full content", async () => {
  await insertPrompt(db, { content: "é".repeat(1000) }); // 2000 bytes
  const { prompts } = await service.list({});
  assert.equal(prompts[0].sizeText, "2.0 KB");
  assert.ok(prompts[0].content.length <= 200);
});

test("stats counts total, today, expiring soon and expired", async () => {
  await insertPrompt(db);
  await insertPrompt(db, { created_at: Date.now() - 3 * DAY });
  await insertPrompt(db, { expires_at: Date.now() + 3_600_000 });
  await insertPrompt(db, { expires_at: Date.now() - 1000 });
  await insertPrompt(db, { expires_at: null });
  assert.deepEqual(await service.stats(), { total: 5, today: 4, expiringSoon: 1, expired: 1 });
});

test("remove, removeMany and deleteExpired", async () => {
  const a = await insertPrompt(db);
  const b = await insertPrompt(db);
  const c = await insertPrompt(db);
  await insertPrompt(db, { expires_at: Date.now() - 1000 });
  const keep = await insertPrompt(db, { expires_at: null });
  assert.equal(await service.remove(a.id), 1);
  assert.equal(await service.removeMany([b.id, c.id]), 2);
  assert.equal(await service.deleteExpired(), 1);
  const left = await db("prompts").select("id");
  assert.deepEqual(left.map((r) => r.id), [keep.id]);
});
