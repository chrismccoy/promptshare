/**
 * Environment variable parsing and validation.
 */

const requirePositiveInt = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid configuration: ${name}="${raw}" must be a positive integer`
    );
  }
  return parsed;
};

const requireString = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;

  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(
      `Invalid configuration: ${name} must be a non-empty string`
    );
  }
  return trimmed;
};

const requireEnvString = (name, hint = "") => {
  const s = process.env[name]?.trim();
  if (!s) {
    const extra = hint ? ` ${hint}` : "";
    throw new Error(
      `${name} must be set in your environment (e.g. in .env).${extra}`
    );
  }
  return s;
};

const requireChoice = (name, choices, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;

  const value = raw.trim().toLowerCase();
  if (!choices.includes(value)) {
    throw new Error(
      `Invalid configuration: ${name}="${raw}" must be one of: ${choices.join(", ")}`
    );
  }
  return value;
};

module.exports = { requirePositiveInt, requireString, requireEnvString, requireChoice };
