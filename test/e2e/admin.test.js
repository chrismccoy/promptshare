const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { startE2E, withPage, loginAs } = require("../helpers/browser");
const { insertPrompt } = require("../helpers/seed");

let env;

before(async () => { env = await startE2E(); });
beforeEach(() => env.reset());
after(() => env.close());

const rowCount = (page) => page.locator("#prompt-rows tr").count();

test("admin: stats, search, create Never, edit, delete, bulk delete, logout", async (t) => {
  const first = await insertPrompt(env.db, { content: "first seeded prompt" });
  await insertPrompt(env.db, { content: "second seeded prompt" });

  await withPage(env, t, async (page, { context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: env.baseURL });
    await loginAs(page);
    assert.equal(await page.locator("#stat-total").textContent(), "2");

    await page.fill('input[name="q"]', first.key);
    await Promise.all([page.waitForURL(/q=/), page.press('input[name="q"]', "Enter")]);
    assert.equal(await rowCount(page), 1);
    await page.goto("/admin");

    await page.click("text=+ New prompt");
    await page.waitForURL(/\/admin\/prompts\/new$/);
    await page.fill("#content", "Curated admin prompt");
    await page.check('input[name="expiry"][value="never"]');
    await Promise.all([page.waitForURL(/\/admin$/), page.click('button:has-text("Create prompt")')]);
    assert.match(await page.locator("#flash").textContent(), /Prompt created/);
    const shareUrl = await page.locator("#flash-url").textContent();
    await page.click("#flash [data-copy]");
    await page.waitForFunction(() => document.querySelector("#flash [data-copy]").textContent === "Copied");
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), shareUrl);
    assert.equal(await page.locator("#stat-total").textContent(), "3");

    const admin = await env.db("prompts").where({ source: "admin" }).first();
    await page.goto(`/admin/prompts/${admin.id}/edit`);
    await page.fill("#content", "Edited admin prompt");
    await Promise.all([page.waitForURL(/\/admin$/), page.click('button:has-text("Save changes")')]);
    assert.match(await page.locator("#flash").textContent(), /Prompt updated/);
    await page.goto(shareUrl);
    assert.equal(await page.locator("#prompt").textContent(), "Edited admin prompt");
    assert.match(await page.locator("#edited").textContent(), /^Edited /);
    assert.equal(await page.locator("#expiry").textContent(), "Never expires");

    await page.goto("/admin");
    const row = page.locator(`tr[data-row-id="${first.id}"]`);
    const del = row.locator(".delete-btn");
    await del.click();
    assert.equal(await del.getAttribute("data-state"), "confirm");
    await row.locator(".cancel-btn").click();
    assert.equal(await del.getAttribute("data-state"), "idle");
    await del.click();
    await del.click();
    await row.waitFor({ state: "detached" });
    assert.equal(await page.locator("#stat-total").textContent(), "2");
    assert.equal(await page.locator("#stat-today").textContent(), "2");

    await page.check("#select-all");
    assert.equal(await page.locator("#bulk-count").textContent(), "2");
    await page.click("#bulk-delete");
    await page.click("#bulk-delete");
    await page.locator("#table-wrap >> text=No prompts yet").waitFor();
    assert.equal(await page.locator('#table-wrap a[href="/admin/prompts/new"]').count(), 1);
    assert.equal(await page.locator("#stat-total").textContent(), "0");
    assert.equal(await page.locator("#stat-today").textContent(), "0");
    assert.equal(await env.db("prompts").count({ n: "id" }).first().then((r) => r.n), 0);

    await Promise.all([page.waitForURL(/\/admin\/login$/), page.click('button:has-text("Log out")')]);
  });
});

test("expired session during delete sends admin to login", async (t) => {
  const p = await insertPrompt(env.db);
  await withPage(env, t, async (page) => {
    await loginAs(page);
    await env.db("sessions").del();
    const del = page.locator(`tr[data-row-id="${p.id}"] .delete-btn`);
    await del.click();
    await Promise.all([page.waitForURL(/\/admin\/login$/), del.click()]);
    assert.ok(await env.db("prompts").where({ id: p.id }).first());
  });
});

test("failed delete shows Cancel and retries on the next click", async (t) => {
  const p = await insertPrompt(env.db);
  const old = await insertPrompt(env.db, { created_at: Date.now() - 2 * 86_400_000 });
  await withPage(env, t, async (page) => {
    await loginAs(page);
    assert.equal(await page.locator("#stat-today").textContent(), "1");
    let failNext = true;
    await page.route(`**/admin/prompts/${p.id}`, (route) => {
      if (!failNext) return route.continue();
      failNext = false;
      return route.fulfill({ status: 500, contentType: "application/json", body: '{"success":false}' });
    });
    const row = page.locator(`tr[data-row-id="${p.id}"]`);
    const del = row.locator(".delete-btn");
    await del.click();
    await del.click();
    await page.waitForFunction((id) => document.querySelector(`tr[data-row-id="${id}"] .delete-btn`).dataset.state === "error", p.id);
    assert.equal(await row.locator(".cancel-btn").isVisible(), true);
    await del.click();
    await row.waitFor({ state: "detached" });
    assert.equal(await page.locator("#stat-today").textContent(), "0");
    assert.equal(await page.locator("#stat-total").textContent(), "1");
    assert.ok(await env.db("prompts").where({ id: old.id }).first());
  });
});

test("emptying a page while other pages have prompts loads the remaining prompts", async (t) => {
  for (let i = 0; i < 21; i++) await insertPrompt(env.db, { content: `p${i}`, created_at: Date.now() + i });
  await withPage(env, t, async (page) => {
    await loginAs(page);
    assert.equal(await rowCount(page), 20);
    await page.check("#select-all");
    await page.click("#bulk-delete");
    await Promise.all([page.waitForURL(/\/admin/), page.waitForEvent("load"), page.click("#bulk-delete")]);
    await page.locator("#prompt-rows tr").first().waitFor();
    assert.equal(await rowCount(page), 1);
    assert.equal(await page.locator("#stat-total").textContent(), "1");
    assert.equal(await page.locator("text=No prompts yet").count(), 0);
  });
});

test("dashboard fits a 375px phone", async (t) => {
  await insertPrompt(env.db);
  await withPage(env, t, async (page) => {
    await loginAs(page);
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert.equal(fits, true);
  }, { viewport: { width: 375, height: 800 } });
});
