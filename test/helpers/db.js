/**
 * In memory database for tests.
 */

require("./env");
const db = require("../../lib/db");

const setupDb = async () => {
  await db.migrate.latest();
  return {
    db,
    reset: () => db("prompts").del(),
  };
};

module.exports = { setupDb };
