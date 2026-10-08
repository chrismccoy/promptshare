const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { startE2E, withPage } = require("../helpers/browser");

let env;

before(async () => { env = await startE2E(); });
beforeEach(() => env.reset());
after(() => env.close());

const buildLink = async (page) => {
  await page.click("#share-btn");
  await page.locator("#link").waitFor({ state: "visible" });
  return page.locator("#link").inputValue();
};

test("paste, choose 30d, share prompt, copy, open share page, copy, .md", async (t) => {
  await withPage(env, t, async (page, { context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: env.baseURL });
    const text = "You are a helpful assistant.\nBe brief.";

    await page.goto("/");
    assert.equal(await page.locator("#share-btn").isDisabled(), true);
    await page.fill("#input", text);
    assert.match(await page.locator("#size").textContent(), new RegExp(`· ${text.length} chars`));
    await page.click('label:has(input[value="30d"])');

    const url = await buildLink(page);
    assert.match(url, /\/p\/[0-9A-Za-z]{8}$/);
    assert.equal(await page.locator("#share-btn").isDisabled(), true, "no double submit");
    assert.equal(await page.locator("#builder").isHidden(), true, "editor block hidden after build");
    assert.equal(await page.locator("#link").getAttribute("readonly"), "");

    await page.click("#copy-link");
    await page.waitForFunction(() => document.getElementById("toast").textContent === "Copied ✓");
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), url);

    await page.goto(url);
    assert.equal(await page.locator("#prompt").textContent(), text);
    assert.match(await page.locator("#expiry").textContent(), /30d left/);
    assert.match(await page.locator("#size").textContent(), new RegExp(`KB · ${text.length} chars`));

    await page.click("#copy-btn");
    await page.waitForFunction(() => document.getElementById("copy-label").textContent === "Copied!");
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), text);

    const [raw] = await Promise.all([context.waitForEvent("page"), page.click("#raw-btn")]);
    await raw.waitForLoadState();
    assert.ok(raw.url().endsWith(".md"));
    const res = await page.request.get(raw.url());
    assert.equal(await res.text(), text);
  });
});

test("upload a .md file and share it", async (t) => {
  await withPage(env, t, async (page) => {
    const body = "# Title\n\nUploaded prompt body";
    await page.goto("/");
    await page.click("#tab-upload");
    await page.setInputFiles("#file", { name: "prompt.md", mimeType: "text/markdown", buffer: Buffer.from(body) });
    await page.locator("#preview").waitFor({ state: "visible" });
    assert.equal(await page.locator("#preview").textContent(), body);
    assert.match(await page.locator("#filename").textContent(), /prompt\.md/);

    const url = await buildLink(page);
    await page.goto(url);
    assert.equal(await page.locator("#prompt").textContent(), body);
  });
});

test("file over 1 MiB shows toast and keeps button disabled", async (t) => {
  await withPage(env, t, async (page) => {
    await page.goto("/");
    await page.click("#tab-upload");
    await page.setInputFiles("#file", { name: "big.txt", mimeType: "text/plain", buffer: Buffer.alloc(1_048_577, "a") });
    await page.waitForFunction(() => document.getElementById("toast").textContent.includes("Too large"));
    assert.equal(await page.locator("#share-btn").isDisabled(), true);
  });
});

test("form works with JavaScript disabled", async (t) => {
  await withPage(env, t, async (page) => {
    await page.goto("/");
    await page.fill("#input", "No JS prompt");
    await Promise.all([page.waitForURL(/\/p\/[0-9A-Za-z]{8}$/), page.click("#share-btn")]);
    assert.equal(await page.locator("#prompt").textContent(), "No JS prompt");
    assert.match(await page.locator("#expiry").textContent(), /7d left/);
  }, { javaScriptEnabled: false });
});

test("HTML in a prompt is shown as text and never runs", async (t) => {
  await withPage(env, t, async (page) => {
    const payload = '<img src=x onerror="window.__x=1"><script>window.__x=2</script>';
    await page.goto("/");
    await page.fill("#input", payload);
    const url = await buildLink(page);
    await page.goto(url);
    assert.equal(await page.locator("#prompt").textContent(), payload);
    assert.equal(await page.evaluate(() => window.__x), undefined);
    assert.equal(await page.locator("#prompt img").count(), 0);
  });
});

test("upload and share pages fit a 375px phone without horizontal scroll", async (t) => {
  await withPage(env, t, async (page) => {
    await page.goto("/");
    const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert.equal(await fits(), true, "upload page overflows");
    await page.fill("#input", "x".repeat(500));
    const url = await buildLink(page);
    await page.goto(url);
    assert.equal(await fits(), true, "share page overflows");
  }, { viewport: { width: 375, height: 800 } });
});
