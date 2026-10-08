require("../helpers/env");

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { startOfDayMs } = require("../../lib/time");

test("startOfDayMs in UTC is UTC midnight", () => {
  assert.equal(startOfDayMs(Date.UTC(2026, 9, 7, 15, 30), "UTC"), Date.UTC(2026, 9, 7));
  assert.equal(startOfDayMs(Date.UTC(2026, 9, 7), "UTC"), Date.UTC(2026, 9, 7));
});

test("startOfDayMs in America/Toronto uses local midnight (EDT and EST)", () => {
  assert.equal(startOfDayMs(Date.UTC(2026, 9, 7, 15, 30), "America/Toronto"), Date.UTC(2026, 9, 7, 4));
  assert.equal(startOfDayMs(Date.UTC(2026, 0, 15, 12), "America/Toronto"), Date.UTC(2026, 0, 15, 5));
});

test("just after UTC midnight is still yesterday in Toronto", () => {
  assert.equal(startOfDayMs(Date.UTC(2026, 9, 7, 0, 30), "America/Toronto"), Date.UTC(2026, 9, 6, 4));
});

test("startOfDayMs handles DST change days in Toronto", () => {
  assert.equal(startOfDayMs(Date.UTC(2026, 2, 8, 18), "America/Toronto"), Date.UTC(2026, 2, 8, 5));
  assert.equal(startOfDayMs(Date.UTC(2026, 10, 1, 18), "America/Toronto"), Date.UTC(2026, 10, 1, 4));
});
