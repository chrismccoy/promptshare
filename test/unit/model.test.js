require("../helpers/env");

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Prompt = require("../../models/prompt");

const DAY = 86_400_000;
const make = (overrides = {}) =>
  new Prompt({ id: 1, key: "a3f9K2xQ", content: "Hello", expires_at: Date.now() + 7 * DAY, source: "public", created_at: Date.now(), ...overrides });

test("active prompt: status, ttlText, expiresText", () => {
  const p = make();
  assert.equal(p.status, "active");
  assert.equal(p.isExpired, false);
  assert.equal(p.ttlText, "7 days");
  assert.match(p.expiresText, /^Expires [A-Z][a-z]{2} \d{1,2} · 7d left$/);
});

test("prompt under 24h is soon", () => {
  const p = make({ expires_at: Date.now() + 3_600_000 });
  assert.equal(p.status, "soon");
  assert.equal(p.ttlText, "1 hour");
});

test("past prompt is expired", () => {
  const p = make({ expires_at: Date.now() - 1000 });
  assert.equal(p.status, "expired");
  assert.equal(p.isExpired, true);
  assert.equal(p.ttlText, "expired");
  assert.equal(p.expiresText, "Expired");
});

test("null expiry never expires", () => {
  const p = make({ expires_at: null });
  assert.equal(p.neverExpires, true);
  assert.equal(p.isExpired, false);
  assert.equal(p.status, "never");
  assert.equal(p.ttlText, "never");
  assert.equal(p.expiresText, "Never expires");
});

test("one year reads as 1 year, 30 days as 30 days", () => {
  assert.equal(make({ expires_at: Date.now() + 365 * DAY }).ttlText, "1 year");
  assert.equal(make({ expires_at: Date.now() + 30 * DAY }).ttlText, "30 days");
});

test("sizes use bytes / 1024 and count multibyte characters as bytes", () => {
  const p = make({ content: "é".repeat(600) }); // 1200 bytes
  assert.equal(p.byteSize, 1200);
  assert.equal(p.sizeText, "1.2 KB");
  assert.equal(p.charCount, 600);
  assert.equal(p.sizeSummary, "1.2 KB · 600 chars");
});

test("byte_size from list queries wins over content length", () => {
  const p = make({ content: "short preview", byte_size: 5000 });
  assert.equal(p.sizeText, "4.9 KB");
});

test("preview collapses whitespace and truncates to 80 chars", () => {
  const p = make({ content: "line one\n\nline two " + "x".repeat(100) });
  assert.equal(p.preview.length, 81);
  assert.ok(p.preview.startsWith("line one line two "));
  assert.ok(p.preview.endsWith("…"));
  assert.equal(make({ content: "short" }).preview, "short");
});

test("dates format in TIME_ZONE", () => {
  const p = make({ created_at: Date.UTC(2026, 9, 7, 12), edited_at: Date.UTC(2026, 9, 9, 12) });
  assert.equal(p.createdAtText, "Oct 7, 2026");
  assert.equal(p.editedAtText, "Oct 9, 2026");
  assert.equal(p.editedText, "Edited Oct 9");
  assert.equal(make().editedText, null);
  assert.equal(make().editedAtText, "—");
});

test("lineCount and promptLabel", () => {
  const p = make({ content: "a\nb\nc" });
  assert.equal(p.lineCount, 3);
  assert.equal(p.promptLabel, "PROMPT / A3F9K2XQ");
});
