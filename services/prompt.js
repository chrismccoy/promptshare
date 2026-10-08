/**
 * Prompt service: validation, expiry rules and key generation.
 */

const Prompt = require("../models/prompt");
const repo = require("../repositories/prompt");
const { generateKey } = require("../lib/keygen");
const { startOfDayMs } = require("../lib/time");
const { NotFoundError, ValidationError } = require("../lib/errors");
const {
  MAX_CONTENT_BYTES,
  MAX_UPLOAD_MB,
  EXPIRY_OPTIONS,
  DEFAULT_EXPIRY,
  PROMPTS_PER_PAGE,
  TIME_ZONE,
} = require("../config");

const MAX_KEY_ATTEMPTS = 5;

const validateContent = (raw) => {
  const content = typeof raw === "string" ? raw.replace(/\r\n?/g, "\n").trim() : "";

  if (!content) {
    throw new ValidationError("Prompt must not be empty");
  }
  if (content.includes("\u0000")) {
    throw new ValidationError("Only text files are supported");
  }
  if (Buffer.byteLength(content, "utf8") > MAX_CONTENT_BYTES) {
    throw new ValidationError(`Prompt is larger than ${MAX_UPLOAD_MB} MB`);
  }
  return content;
};

const resolveExpiry = (
  choice,
  { allowNever = false, allowKeep = false, allowNow = false, current = null, now = Date.now() } = {}
) => {
  if (typeof choice === "string" && Object.hasOwn(EXPIRY_OPTIONS, choice)) {
    return now + EXPIRY_OPTIONS[choice];
  }
  if (choice === "never" && allowNever) return null;
  if (choice === "keep" && allowKeep) return current;
  if (choice === "now" && allowNow) return now;
  throw new ValidationError("Invalid expiry option");
};

const create = async (content, expiry, { source = "public", allowNever = false } = {}) => {
  const text = validateContent(content);
  const now = Date.now();
  const expires_at = resolveExpiry(expiry || DEFAULT_EXPIRY, { allowNever, now });

  let lastError;
  for (let i = 0; i < MAX_KEY_ATTEMPTS; i++) {
    const row = {
      key: generateKey(),
      content: text,
      expires_at,
      edited_at: null,
      source,
      created_at: now,
      updated_at: now,
    };
    try {
      const id = await repo.insert(row);
      return new Prompt({ id, ...row });
    } catch (err) {
      if (err.isDuplicateKey) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw new Error(
    `Failed to generate unique key after ${MAX_KEY_ATTEMPTS} attempts: ${lastError?.message}`
  );
};

const findByKey = async (key, { deleteExpired = true } = {}) => {
  const row = typeof key === "string" ? await repo.findByKey(key) : null;
  if (!row) throw new NotFoundError();

  const prompt = new Prompt(row);
  if (prompt.isExpired) {
    if (deleteExpired) await repo.deleteById(prompt.id);
    throw new NotFoundError();
  }
  return prompt;
};

const findById = async (id) => {
  const row = await repo.findById(id);
  if (!row) throw new NotFoundError("Prompt not found");
  return new Prompt(row);
};

const update = async (id, { content, expiry }) => {
  const current = await findById(id);
  const text = validateContent(content);
  const now = Date.now();
  const expires_at = resolveExpiry(expiry || "keep", {
    allowNever: true,
    allowKeep: true,
    allowNow: true,
    current: current.expires_at,
    now,
  });

  await repo.update(id, { content: text, expires_at, edited_at: now, updated_at: now });
  return new Prompt({ ...current, content: text, expires_at, edited_at: now });
};

const list = async ({ q = "", status = "all", source = "all", page = 1, perPage = PROMPTS_PER_PAGE } = {}) => {
  const filters = { q, status, source };
  const total = await repo.count(filters);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), totalPages);
  const rows = await repo.list({ ...filters, limit: perPage, offset: (current - 1) * perPage });
  return {
    prompts: rows.map((row) => new Prompt(row)),
    total,
    page: current,
    perPage,
    totalPages,
  };
};

const startOfToday = (now = Date.now()) => startOfDayMs(now, TIME_ZONE);

const stats = ({ now = Date.now(), since = startOfToday(now) } = {}) =>
  repo.stats({ now, startOfToday: since });

const remove = (id) => repo.deleteById(id);

const removeMany = (ids) => repo.deleteByIds(ids);

const deleteExpired = () => repo.deleteExpired();

module.exports = {
  validateContent,
  resolveExpiry,
  create,
  findByKey,
  findById,
  update,
  list,
  stats,
  startOfToday,
  remove,
  removeMany,
  deleteExpired,
};
