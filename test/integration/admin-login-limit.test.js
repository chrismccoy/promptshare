const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setupApp } = require("../helpers/app");
const { createAgent } = require("../helpers/agent");

let app, db;

before(async () => { ({ app, db } = await setupApp()); });
after(() => db.destroy());

test("11th login attempt is rate limited on the login page", async () => {
  const client = await createAgent(app);
  for (let i = 0; i < 10; i++) {
    assert.equal((await client.login("admin", "nope")).status, 401);
  }
  const res = await client.login();
  assert.equal(res.status, 429);
  assert.match(res.text, /Sign in/);
  assert.match(res.text, /rate limit/);
});
