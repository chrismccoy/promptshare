/**
 * Database access layer for prompts.
 */

const db = require("../lib/db");
const { escapeLike } = require("../lib/sql");
const { DAY_MS } = require("../config");

const TABLE = "prompts";

const LIST_COLUMNS = [
  "id",
  "key",
  "expires_at",
  "edited_at",
  "source",
  "created_at",
  db.raw("substr(content, 1, 200) AS content"),
  db.raw("length(CAST(content AS BLOB)) AS byte_size"),
];

const isDuplicateKeyError = (err) =>
  typeof err.code === "string" &&
  err.code.startsWith("SQLITE_CONSTRAINT") &&
  /UNIQUE/i.test(err.message);

const applyFilters = (query, { q = "", status = "all", source = "all" } = {}) => {
  const now = Date.now();

  if (q) {
    query.where((b) =>
      b.where("key", q).orWhereRaw("content LIKE ? ESCAPE '\\'", [`%${escapeLike(q)}%`])
    );
  }

  if (status === "active") {
    query.where((b) => b.whereNull("expires_at").orWhere("expires_at", ">", now));
  } else if (status === "expired") {
    query.whereNotNull("expires_at").andWhere("expires_at", "<=", now);
  }

  if (source === "public" || source === "admin") {
    query.where("source", source);
  }

  return query;
};

const findByKey = (key) => db(TABLE).where("key", key).first();

const findById = (id) => db(TABLE).where("id", id).first();

const insert = async (data) => {
  try {
    const [id] = await db(TABLE).insert(data);
    return id;
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const dupErr = new Error("Duplicate key");
      dupErr.isDuplicateKey = true;
      throw dupErr;
    }
    throw err;
  }
};

const update = (id, fields) => db(TABLE).where("id", id).update(fields);

const deleteById = (id) => db(TABLE).where("id", id).del();

const deleteByIds = (ids) => db(TABLE).whereIn("id", ids).del();

const deleteExpired = (now = Date.now()) =>
  db(TABLE).whereNotNull("expires_at").andWhere("expires_at", "<=", now).del();

const list = ({ limit, offset, ...filters }) =>
  applyFilters(db(TABLE).select(LIST_COLUMNS), filters)
    .orderBy([
      { column: "created_at", order: "desc" },
      { column: "id", order: "desc" },
    ])
    .limit(limit)
    .offset(offset);

const count = async (filters) => {
  const [{ count }] = await applyFilters(db(TABLE), filters).count({ count: "id" });
  return Number(count);
};

const stats = async ({ now, startOfToday }) => {
  const row = await db(TABLE).first(
    db.raw("COUNT(*) AS total"),
    db.raw("COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS today", [startOfToday]),
    db.raw(
      "COALESCE(SUM(CASE WHEN expires_at IS NOT NULL AND expires_at > ? AND expires_at < ? THEN 1 ELSE 0 END), 0) AS expiringSoon",
      [now, now + DAY_MS]
    ),
    db.raw("COALESCE(SUM(CASE WHEN expires_at IS NOT NULL AND expires_at <= ? THEN 1 ELSE 0 END), 0) AS expired", [now])
  );
  return {
    total: Number(row.total),
    today: Number(row.today),
    expiringSoon: Number(row.expiringSoon),
    expired: Number(row.expired),
  };
};

module.exports = {
  findByKey,
  findById,
  insert,
  update,
  deleteById,
  deleteByIds,
  deleteExpired,
  list,
  count,
  stats,
};
