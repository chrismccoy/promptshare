require("../helpers/env");

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");

const loadConfig = (env) =>
  JSON.parse(
    execFileSync(
      process.execPath,
      ["-e", "const c = require('./config'); console.log(JSON.stringify({ mb: c.MAX_UPLOAD_MB, bytes: c.MAX_CONTENT_BYTES, body: c.BODY_LIMIT, tab: c.DEFAULT_TAB }))"],
      { cwd: ROOT, env: { ...process.env, ...env }, encoding: "utf8" }
    )
  );

test("MAX_UPLOAD_MB defaults to 1 MB", () => {
  const env = { ...process.env };
  delete env.MAX_UPLOAD_MB;
  const c = JSON.parse(
    execFileSync(
      process.execPath,
      ["-e", "const c = require('./config'); console.log(JSON.stringify({ mb: c.MAX_UPLOAD_MB, bytes: c.MAX_CONTENT_BYTES }))"],
      { cwd: ROOT, env, encoding: "utf8" }
    )
  );
  assert.deepEqual(c, { mb: 1, bytes: 1_048_576 });
});

test("MAX_UPLOAD_MB from env sets the content and body limits", () => {
  const c = loadConfig({ MAX_UPLOAD_MB: "5" });
  assert.equal(c.mb, 5);
  assert.equal(c.bytes, 5 * 1_048_576);
  assert.equal(c.body, 3 * 5 * 1_048_576 + 200 * 1024);
});

test("invalid MAX_UPLOAD_MB fails at startup", () => {
  assert.throws(
    () => loadConfig({ MAX_UPLOAD_MB: "abc" }),
    (err) => /MAX_UPLOAD_MB="abc" must be a positive integer/.test(err.stderr)
  );
});

test("DEFAULT_TAB defaults to paste and accepts upload", () => {
  assert.equal(loadConfig({ DEFAULT_TAB: "" }).tab, "paste");
  assert.equal(loadConfig({ DEFAULT_TAB: "upload" }).tab, "upload");
  assert.equal(loadConfig({ DEFAULT_TAB: "Upload" }).tab, "upload");
});

test("invalid DEFAULT_TAB fails at startup", () => {
  assert.throws(
    () => loadConfig({ DEFAULT_TAB: "files" }),
    (err) => /DEFAULT_TAB="files" must be one of: paste, upload/.test(err.stderr)
  );
});
