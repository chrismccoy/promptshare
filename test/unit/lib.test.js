require("../helpers/env");

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKey } = require("../../lib/keygen");
const { escapeLike } = require("../../lib/sql");
const { createCleanupJob } = require("../../lib/cleanup");

test("generateKey returns 8 base62 characters", () => {
  for (let i = 0; i < 100; i++) {
    assert.match(generateKey(), /^[0-9A-Za-z]{8}$/);
  }
});

test("escapeLike escapes %, _ and backslash", () => {
  assert.equal(escapeLike("50%_off\\"), "50\\%\\_off\\\\");
  assert.equal(escapeLike("plain"), "plain");
});

test("cleanup job calls run on its interval until stopped", async () => {
  let calls = 0;
  const job = createCleanupJob({ run: async () => { calls++; return 0; }, intervalMs: 5 });
  job.start();
  await new Promise((r) => setTimeout(r, 40));
  job.stop();
  const seen = calls;
  assert.ok(seen >= 1, `expected at least one run, got ${seen}`);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(calls, seen);
});
