/**
 * Knex database connection
 */

const knex = require("knex");
const knexConfig = require("../knexfile");

const instance = knex(knexConfig);

module.exports = instance;
