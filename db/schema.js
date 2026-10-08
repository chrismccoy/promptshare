/**
 * Creates the prompts and sessions tables.
 */

exports.up = async (knex) => {
  await knex.schema.createTable("prompts", (t) => {
    t.increments("id").primary();
    t.string("key", 16).notNullable().unique();
    t.text("content").notNullable();
    t.bigInteger("expires_at").nullable();
    t.bigInteger("edited_at").nullable();
    t.string("source", 8).notNullable().defaultTo("public");
    t.bigInteger("created_at").notNullable();
    t.bigInteger("updated_at").notNullable();

    t.index("expires_at");
    t.index("created_at");
  });
  await knex.schema.createTable("sessions", (t) => {
    t.string("sid", 255).primary();
    t.text("sess").notNullable();
    t.bigInteger("expires_at").notNullable();

    t.index("expires_at");
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("prompts");
  await knex.schema.dropTableIfExists("sessions");
};
