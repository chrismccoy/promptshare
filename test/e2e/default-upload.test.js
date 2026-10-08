// Runs the app with DEFAULT_TAB=upload; each test file is its own process.
process.env.DEFAULT_TAB = "upload";

const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { startE2E, withPage } = require("../helpers/browser");

let env;

before(async () => { env = await startE2E(); });
beforeEach(() => env.reset());
after(() => env.close());

test("upload tab is first and active when DEFAULT_TAB=upload", async (t) => {
  await withPage(env, t, async (page) => {
    await page.goto("/");
    const order = await page.$$eval("#tab-pill ~ button", (els) => els.map((el) => el.id));
    assert.deepEqual(order, ["tab-upload", "tab-paste"]);
    assert.equal(await page.locator("#pane-upload").isVisible(), true);
    assert.equal(await page.locator("#pane-paste").isHidden(), true);

    await page.setInputFiles("#file", { name: "p.md", mimeType: "text/markdown", buffer: Buffer.from("from file") });
    await page.locator("#preview").waitFor({ state: "visible" });

    await page.click("#tab-paste");
    assert.equal(await page.locator("#pane-paste").isVisible(), true);
    await page.waitForFunction(() => {
      const pill = document.getElementById("tab-pill").getBoundingClientRect();
      const paste = document.getElementById("tab-paste").getBoundingClientRect();
      return Math.abs(pill.left - paste.left) < 2;
    });
  });
});

test("without JavaScript the paste box is shown so the form still submits", async (t) => {
  await withPage(env, t, async (page) => {
    await page.goto("/");
    assert.equal(await page.locator("#input").isVisible(), true);
    await page.fill("#input", "No JS with upload default");
    await Promise.all([page.waitForURL(/\/p\/[0-9A-Za-z]{8}$/), page.click("#share-btn")]);
    assert.equal(await page.locator("#prompt").textContent(), "No JS with upload default");
  }, { javaScriptEnabled: false });
});
