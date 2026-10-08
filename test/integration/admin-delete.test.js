const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { setupApp } = require("../helpers/app");
const { createAgent } = require("../helpers/agent");
const { insertPrompt } = require("../helpers/seed");

let app, db, reset, client;

before(async () => {
  ({ app, db, reset } = await setupApp());
  client = await createAgent(app);
  await client.login();
});

beforeEach(() => reset());
after(() => db.destroy());

test("DELETE removes one prompt", async () => {
  const p = await insertPrompt(db);
  const res = await client.del(`/admin/prompts/${p.id}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { success: true });
  assert.equal(await db("prompts").where({ id: p.id }).first(), undefined);
});

test("DELETE with bad id is 400 JSON", async () => {
  for (const id of ["abc", "0", "-1", "1.5"]) {
    const res = await client.del(`/admin/prompts/${id}`);
    assert.equal(res.status, 400, id);
    assert.deepEqual(res.body, { success: false, error: "Invalid ID" });
  }
});

test("DELETE without CSRF header is 403 JSON", async () => {
  const p = await insertPrompt(db);
  const res = await client.agent.delete(`/admin/prompts/${p.id}`).set("Accept", "application/json");
  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
});

test("DELETE after session ends is 401 JSON, not a redirect", async () => {
  const p = await insertPrompt(db);
  await db("sessions").del();
  const res = await client.del(`/admin/prompts/${p.id}`);
  assert.equal(res.status, 401);
  assert.match(res.headers["content-type"], /application\/json/);
  assert.equal(res.body.error, "Your session has expired. Log in again.");
  assert.ok(await db("prompts").where({ id: p.id }).first());
  await client.login();
});

test("bulk delete removes selected prompts", async () => {
  const a = await insertPrompt(db);
  const b = await insertPrompt(db);
  const c = await insertPrompt(db);
  const res = await client.postJson("/admin/prompts/bulk-delete", { ids: [a.id, b.id, b.id] });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { success: true, deleted: 2 });
  const left = await db("prompts").select("id");
  assert.deepEqual(left.map((r) => r.id), [c.id]);
});

test("bulk delete rejects empty, over 100 and bad ids", async () => {
  const many = Array.from({ length: 101 }, (_, i) => i + 1);
  for (const ids of [[], many, ["x"], undefined]) {
    const res = await client.postJson("/admin/prompts/bulk-delete", { ids });
    assert.equal(res.status, 400, JSON.stringify(ids)?.slice(0, 20));
    assert.equal(res.body.success, false);
  }
});
