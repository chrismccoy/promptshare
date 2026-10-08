const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setupApp } = require("../helpers/app");
const { createAgent } = require("../helpers/agent");

let app, db;

before(async () => { ({ app, db } = await setupApp()); });
after(() => db.destroy());

test("21st create in the window is rate limited", async () => {
  const client = await createAgent(app);
  for (let i = 0; i < 20; i++) {
    const res = await client.post("/p/create", { content: `p${i}` }, { json: true });
    assert.equal(res.status, 201, `request ${i + 1}`);
  }
  const res = await client.post("/p/create", { content: "one more" }, { json: true });
  assert.equal(res.status, 429);
  assert.match(res.body.error, /rate limit/);
});
