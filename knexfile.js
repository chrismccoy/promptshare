/**
 * Knex configuration. DB_PATH overrides the default SQLite file
 */

const path = require("path");
require("dotenv").config();

module.exports = {
  client: "sqlite3",
  connection: {
    filename: process.env.DB_PATH || path.join(__dirname, "data", "db.sqlite"),
  },
  useNullAsDefault: true,
  pool: { min: 1, max: 1 },
  migrations: { directory: path.join(__dirname, "db") },
};
