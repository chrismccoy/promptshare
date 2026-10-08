/**
 * Builds the app against an in memory database.
 */

const { setupDb } = require("./db");

const setupApp = async () => {
  const { db, reset } = await setupDb();
  const { createApp } = require("../../server");
  return { app: createApp(), db, reset };
};

module.exports = { setupApp };
