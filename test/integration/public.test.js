const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { setupApp } = require("../helpers/app");
const { createAgent } = require("../helpers/agent");
const { insertPrompt, DAY } = require("../helpers/seed");

let app, db, reset, client;
before(async () => { ({ app, db, reset } = await setupApp()); });
beforeEach(async () => { await reset(); client = await createAgent(app); });
after(() => db.destroy());

test("upload page renders form, CSRF token, expiry choices", async () => {
  const res = await request(app).get("/");
  assert.equal(res.status, 200);
  assert.match(res.text, /<form id="form" method="post" action="\/p\/create"/);
  assert.match(res.text, /name="_csrf" value="[^"]+"/);
  for (const c of ["1d", "7d", "30d", "1y"]) assert.match(res.text, new RegExp(`value="${c}"`));
  assert.match(res.text, /value="7d"[^>]*checked/);
  assert.doesNotMatch(res.text, /value="never"/);
});

test("Share prompt button is not disabled in HTML (no-JS users can submit)", async () => {
  const res = await request(app).get("/");
  const button = res.text.match(/<button[^>]*id="share-btn"[^>]*>/)[0];
  assert.doesNotMatch(button, /\sdisabled(\s|>|=)/);
});

test("button labels have no symbols and result has no extra New prompt button", async () => {
  const seed = await insertPrompt(db);
  const upload = (await request(app).get("/")).text;
  assert.match(upload, /<button[^>]*id="share-btn"[^>]*>Share prompt<\/button>/);
  assert.doesNotMatch(upload, /id="new-prompt"/);
  assert.match(upload, /placeholder="Drop your Prompt\.\.\."/);
  assert.match(upload, />Drop your prompt file</);
  assert.match(upload, /data-max-mb="1"/);
  assert.ok(upload.indexOf('id="tab-paste"') < upload.indexOf('id="tab-upload"'), "Paste tab first by default");
  assert.match(upload, /<div id="pane-paste">/);
  assert.match(upload, /<div id="pane-upload" class="hidden">/);
  assert.match(upload, /\.txt \.md — max 1MB/);
  const share = (await request(app).get(`/p/${seed.key}`)).text;
  assert.match(share, /<span id="copy-label">Copy prompt<\/span>/);
  assert.ok(share.indexOf('id="copy-btn"') < share.indexOf('id="raw-btn"'), "Raw sits to the right of Copy");
});

test("views contain no inline scripts or style attributes", async () => {
  const seed = await insertPrompt(db);
  for (const url of ["/", `/p/${seed.key}`, "/nope"]) {
    const html = (await request(app).get(url)).text;
    assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/, `inline script on ${url}`);
    assert.doesNotMatch(html, /\sstyle="/, `style attribute on ${url}`);
    assert.doesNotMatch(html, /<style/, `style tag on ${url}`);
  }
});

test("HTML create redirects 303 to share page", async () => {
  const res = await client.post("/p/create", { content: "Hello prompt", expiry: "1d" });
  assert.equal(res.status, 303);
  assert.match(res.headers.location, /^\/p\/[0-9A-Za-z]{8}$/);
});

test("JSON create returns 201 with url and expiresAt", async () => {
  const res = await client.post("/p/create", { content: "Hello", expiry: "30d" }, { json: true });
  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.match(res.body.url, new RegExp(`/p/${res.body.key}$`));
  const ms = Date.parse(res.body.expiresAt) - Date.now();
  assert.ok(ms > 29 * DAY && ms <= 30 * DAY);
});

test("create rejects empty, NUL, bad expiry and never with 422 JSON", async () => {
  const cases = [
    [{ content: "  " }, "Prompt must not be empty"],
    [{ content: "a\u0000b" }, "Only text files are supported"],
    [{ content: "a", expiry: "2d" }, "Invalid expiry option"],
    [{ content: "a", expiry: "never" }, "Invalid expiry option"],
  ];
  for (const [fields, error] of cases) {
    const res = await client.post("/p/create", fields, { json: true });
    assert.equal(res.status, 422);
    assert.deepEqual(res.body, { success: false, error });
  }
});

test("create rejects content over 1 MiB with 422, huge body with 413", async () => {
  const over = await client.post("/p/create", { content: "a".repeat(1_048_577) }, { json: true });
  assert.equal(over.status, 422);
  assert.equal(over.body.error, "Prompt is larger than 1 MB");

  const huge = await client.post("/p/create", { content: "a".repeat(3_400_000) }, { json: true });
  assert.equal(huge.status, 413);
  assert.equal(huge.body.error, "Prompt is larger than 1 MB");
});

test("prompts under 1 MiB pass even when URL-encoding inflates them", async () => {
  const newlines = await client.post("/p/create", { content: "ab\n".repeat(300_000) }, { json: true });
  assert.equal(newlines.status, 201);
  const exact = await client.post("/p/create", { content: "é".repeat(524_288) }, { json: true });
  assert.equal(exact.status, 201);
});

test("create without CSRF token is 403", async () => {
  const res = await request(app).post("/p/create").type("form").send({ content: "x" });
  assert.equal(res.status, 403);
});

test("share page escapes content and shows chips", async () => {
  const seed = await insertPrompt(db, { content: "<script>alert(1)</script>\nline 2", expires_at: Date.now() + 30 * DAY });
  const res = await request(app).get(`/p/${seed.key}`);
  assert.equal(res.status, 200);
  assert.match(res.text, /<pre id="prompt"[^>]*>&lt;script&gt;alert\(1\)&lt;\/script&gt;\nline 2<\/pre>/);
  assert.match(res.text, /30d left/);
  assert.match(res.text, new RegExp(`PROMPT / ${seed.key.toUpperCase()}`));
  assert.match(res.text, /<meta name="robots" content="noindex"/);
  assert.match(res.text, new RegExp(`href="/p/${seed.key}\\.md"`));
  assert.doesNotMatch(res.text, /id="edited"/);
});

test("share page shows Edited chip and Never expires", async () => {
  const seed = await insertPrompt(db, { expires_at: null, edited_at: Date.UTC(2026, 9, 9, 12) });
  const res = await request(app).get(`/p/${seed.key}`);
  assert.match(res.text, /Never expires/);
  assert.match(res.text, /id="edited"[^>]*>Edited Oct 9</);
});

test(".md returns exact text as text/plain utf-8", async () => {
  const seed = await insertPrompt(db, { content: "<b>raw</b> é" });
  const res = await request(app).get(`/p/${seed.key}.md`);
  assert.equal(res.status, 200);
  assert.match(res.headers["content-type"], /^text\/plain; charset=utf-8/);
  assert.equal(res.headers["x-content-type-options"], "nosniff");
  assert.equal(res.text, "<b>raw</b> é");
  assert.equal((await request(app).get(`/p/${seed.key}/raw`)).status, 404, "old /raw path is gone");
});

test("expired prompt is 404 and deleted; unknown key is 404", async () => {
  const seed = await insertPrompt(db, { expires_at: Date.now() - 1000 });
  assert.equal((await request(app).get(`/p/${seed.key}`)).status, 404);
  assert.equal(await db("prompts").where({ id: seed.id }).first(), undefined);
  assert.equal((await request(app).get("/p/doesnotexist")).status, 404);
  assert.equal((await request(app).get("/p/doesnotexist.md")).status, 404);
});

test("share page, .md and /p/ 404s send X-Robots-Tag: noindex", async () => {
  const seed = await insertPrompt(db);
  const expired = await insertPrompt(db, { expires_at: Date.now() - 1000 });
  const urls = [`/p/${seed.key}`, `/p/${seed.key}.md`, "/p/doesnotexist", "/p/doesnotexist.md", `/p/${expired.key}`];
  for (const url of urls) {
    const res = await request(app).get(url);
    assert.equal(res.headers["x-robots-tag"], "noindex", url);
  }
});

test("JSON create accepts bodies over 100 KB", async () => {
  const res = await client.postJson("/p/create", { content: "a".repeat(500_000), expiry: "1d" });
  assert.equal(res.status, 201);
});
