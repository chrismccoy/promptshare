const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setupDb } = require("../helpers/db");
const { KnexSessionStore } = require("../../lib/sessionStore");

let db, store;

before(async () => {
  ({ db } = await setupDb());
  store = new KnexSessionStore({ db, ttlMs: 60_000 });
});

after(() => db.destroy());

const call = (fn, ...args) => new Promise((resolve, reject) => fn.call(store, ...args, (err, val) => (err ? reject(err) : resolve(val))));

test("set then get returns the session; destroy removes it", async () => {
  const sess = { cookie: { expires: new Date(Date.now() + 60_000).toISOString() }, isAdmin: true };
  await call(store.set, "sid-1", sess);
  assert.deepEqual(await call(store.get, "sid-1"), sess);
  await call(store.destroy, "sid-1");
  assert.equal(await call(store.get, "sid-1"), null);
});

test("expired sessions are not returned and clearExpired removes them", async () => {
  await call(store.set, "old", { cookie: { expires: new Date(Date.now() - 1000).toISOString() } });
  assert.equal(await call(store.get, "old"), null);
  assert.equal(await store.clearExpired(), 1);
});

test("touch extends expiry", async () => {
  const soon = { cookie: { expires: new Date(Date.now() + 1000).toISOString() } };
  await call(store.set, "t", soon);
  const later = { cookie: { expires: new Date(Date.now() + 120_000).toISOString() } };
  await call(store.touch, "t", later);
  const row = await db("sessions").where({ sid: "t" }).first();
  assert.ok(row.expires_at > Date.now() + 60_000);
});

test("get passes a corrupt session row to the callback as an error", async () => {
  await db("sessions").insert({ sid: "bad", sess: "{not json", expires_at: Date.now() + 60_000 });
  let calls = 0;
  const err = await new Promise((resolve) => {
    store.get("bad", (e) => {
      calls++;
      resolve(e);
    });
  });
  assert.ok(err instanceof SyntaxError);
  await new Promise((r) => setImmediate(r));
  assert.equal(calls, 1);
});
