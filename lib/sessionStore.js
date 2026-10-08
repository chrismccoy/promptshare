/**
 * store backed by the knex "sessions" table.
 */

const session = require("express-session");

const expiryOf = (sess, ttlMs) =>
  sess?.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + ttlMs;

class KnexSessionStore extends session.Store {
  constructor({ db, table = "sessions", ttlMs }) {
    super();
    this.db = db;
    this.table = table;
    this.ttlMs = ttlMs;
  }

  get(sid, cb) {
    this.db(this.table)
      .where("sid", sid)
      .andWhere("expires_at", ">", Date.now())
      .first()
      .then((row) => (row ? JSON.parse(row.sess) : null))
      .then((sess) => cb(null, sess), cb);
  }

  set(sid, sess, cb = () => {}) {
    this.db(this.table)
      .insert({ sid, sess: JSON.stringify(sess), expires_at: expiryOf(sess, this.ttlMs) })
      .onConflict("sid")
      .merge()
      .then(() => cb(null), cb);
  }

  touch(sid, sess, cb = () => {}) {
    this.db(this.table)
      .where("sid", sid)
      .update({ expires_at: expiryOf(sess, this.ttlMs) })
      .then(() => cb(null), cb);
  }

  destroy(sid, cb = () => {}) {
    this.db(this.table)
      .where("sid", sid)
      .del()
      .then(() => cb(null), cb);
  }

  clearExpired() {
    return this.db(this.table).where("expires_at", "<=", Date.now()).del();
  }
}

module.exports = { KnexSessionStore };
