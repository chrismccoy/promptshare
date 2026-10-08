/**
 * Inserts prompt rows directly, bypassing validation, for test setup.
 */

const { generateKey } = require("../../lib/keygen");

const DAY = 86_400_000;

const insertPrompt = async (db, overrides = {}) => {
  const now = Date.now();
  const row = {
    key: generateKey(),
    content: "Seed prompt content",
    expires_at: now + 7 * DAY,
    edited_at: null,
    source: "public",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
  const [id] = await db("prompts").insert(row);
  return { id, ...row };
};

module.exports = { insertPrompt, DAY };
