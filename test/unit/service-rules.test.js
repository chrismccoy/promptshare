require("../helpers/env");

const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { validateContent, resolveExpiry } = require("../../services/prompt");

after(() => require("../../lib/db").destroy());

const DAY = 86_400_000;

test("validateContent trims and returns text", () => {
  assert.equal(validateContent("  hi \n"), "hi");
});

test("validateContent rejects empty, whitespace and non-strings", () => {
  for (const raw of ["", "   \n\t", undefined, null, ["a"]]) {
    assert.throws(() => validateContent(raw), { statusCode: 422, message: "Prompt must not be empty" });
  }
});

test("validateContent rejects NUL bytes", () => {
  assert.throws(() => validateContent("abc\u0000def"), { message: "Only text files are supported" });
});

test("validateContent accepts exactly 1 MiB and rejects one byte more", () => {
  assert.equal(validateContent("a".repeat(1_048_576)).length, 1_048_576);
  assert.throws(() => validateContent("a".repeat(1_048_577)), { message: "Prompt is larger than 1 MB" });
});

test("validateContent counts bytes, not characters, for multibyte text", () => {
  assert.ok(validateContent("😀".repeat(262_144)));
  assert.throws(() => validateContent("😀".repeat(262_145)), { message: "Prompt is larger than 1 MB" });
});

test("resolveExpiry maps whitelist choices from now", () => {
  const now = 1_000_000;
  assert.equal(resolveExpiry("1d", { now }), now + DAY);
  assert.equal(resolveExpiry("7d", { now }), now + 7 * DAY);
  assert.equal(resolveExpiry("30d", { now }), now + 30 * DAY);
  assert.equal(resolveExpiry("1y", { now }), now + 365 * DAY);
});

test("resolveExpiry rejects unknown and prototype keys", () => {
  for (const choice of ["2d", "", "toString", "__proto__", undefined, ["7d", "1d"]]) {
    assert.throws(() => resolveExpiry(choice), { message: "Invalid expiry option" });
  }
});

test("never, keep and now need their flags", () => {
  assert.throws(() => resolveExpiry("never"), { message: "Invalid expiry option" });
  assert.equal(resolveExpiry("never", { allowNever: true }), null);
  assert.throws(() => resolveExpiry("keep", { current: 5 }), { message: "Invalid expiry option" });
  assert.equal(resolveExpiry("keep", { allowKeep: true, current: 5 }), 5);
  assert.equal(resolveExpiry("keep", { allowKeep: true, current: null }), null);
  assert.throws(() => resolveExpiry("now", { now: 9 }), { message: "Invalid expiry option" });
  assert.equal(resolveExpiry("now", { allowNow: true, now: 9 }), 9);
});

test("validateContent normalises CRLF and CR to LF", () => {
  assert.equal(validateContent("a\r\nb\rc"), "a\nb\nc");
});

test("validateContent checks size after CRLF normalisation", () => {
  const crlf = "x\r\n".repeat(500_000) + "x";
  assert.ok(Buffer.byteLength(crlf) > 1_048_576);
  assert.equal(Buffer.byteLength(validateContent(crlf)), 1_000_001);
});
