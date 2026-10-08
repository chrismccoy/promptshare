/**
 * SQL helpers.
 */

const escapeLike = (s) => String(s).replace(/[\\%_]/g, (c) => `\\${c}`);

module.exports = { escapeLike };
