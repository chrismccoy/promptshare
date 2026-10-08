const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { setupDb } = require("../helpers/db");

let db;

after(() => db?.destroy());

test("migrations create prompts and sessions tables", async () => {
  ({ db } = await setupDb());
  assert.ok(await db.schema.hasTable("prompts"));
  assert.ok(await db.schema.hasTable("sessions"));

  const cols = await db("prompts").columnInfo();
  for (const name of ["id", "key", "content", "expires_at", "edited_at", "source", "created_at", "updated_at"]) {
    assert.ok(cols[name], `missing column ${name}`);
  }
  assert.equal(cols.expires_at.nullable, true);
});
