/**
 * Random key generator.
 */

const { randomBytes } = require("crypto");
const { KEY_LENGTH, KEY_ALPHABET } = require("../config");

const ALPHABET_LEN = KEY_ALPHABET.length;

const MAX_VALID = Math.floor(256 / ALPHABET_LEN) * ALPHABET_LEN;

const generateKey = (length = KEY_LENGTH) => {
  let key = "";
  while (key.length < length) {
    const bytes = randomBytes(length - key.length + 16);
    for (let i = 0; i < bytes.length && key.length < length; i++) {
      if (bytes[i] < MAX_VALID) {
        key += KEY_ALPHABET[bytes[i] % ALPHABET_LEN];
      }
    }
  }
  return key;
};

module.exports = { generateKey };
