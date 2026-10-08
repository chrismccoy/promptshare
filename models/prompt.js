/**
 * Prompt model
 */

const { DAY_MS, TIME_ZONE } = require("../config");

const plural = (n, unit) => `${n} ${unit}${n === 1 ? "" : "s"}`;

const formatDate = (ms, options) =>
  new Date(ms).toLocaleDateString("en-US", { timeZone: TIME_ZONE, ...options });

const PREVIEW_LENGTH = 80;

class Prompt {
  constructor({ id, key, content, expires_at = null, edited_at = null, source = "public", created_at = null, byte_size = null }) {
    this.id = id;
    this.key = key;
    this.content = content;
    this.expires_at = expires_at ?? null;
    this.edited_at = edited_at ?? null;
    this.source = source;
    this.created_at = created_at ?? null;
    this.byte_size = byte_size ?? null;
  }

  get neverExpires() {
    return this.expires_at === null;
  }

  get msLeft() {
    return this.neverExpires ? Infinity : this.expires_at - Date.now();
  }

  get isExpired() {
    return !this.neverExpires && this.msLeft <= 0;
  }

  get status() {
    if (this.neverExpires) return "never";
    const ms = this.msLeft;
    if (ms <= 0) return "expired";
    if (ms < DAY_MS) return "soon";
    return "active";
  }

  get ttlText() {
    if (this.neverExpires) return "never";
    const s = this.msLeft / 1000;
    if (s <= 0) return "expired";
    const seconds = Math.round(s);
    if (seconds < 60) return plural(seconds, "second");
    const minutes = Math.round(s / 60);
    if (minutes < 60) return plural(minutes, "minute");
    const hours = Math.round(s / 3600);
    if (hours < 24) return plural(hours, "hour");
    const days = Math.round(s / 86_400);
    if (days < 365) return plural(days, "day");
    return plural(Math.round(days / 365), "year");
  }

  get expiresText() {
    if (this.neverExpires) return "Never expires";
    if (this.isExpired) return "Expired";
    const date = formatDate(this.expires_at, { month: "short", day: "numeric" });
    return `Expires ${date} · ${Math.ceil(this.msLeft / DAY_MS)}d left`;
  }

  get byteSize() {
    return this.byte_size ?? Buffer.byteLength(this.content, "utf8");
  }

  get sizeText() {
    return `${(this.byteSize / 1024).toFixed(1)} KB`;
  }

  get charCount() {
    return this.content.length;
  }

  get sizeSummary() {
    return `${this.sizeText} · ${this.charCount.toLocaleString("en-US")} chars`;
  }

  get lineCount() {
    return this.content.replace(/\n+$/, "").split("\n").length;
  }

  get preview() {
    const flat = this.content.replace(/\s+/g, " ").trim();
    return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH)}…` : flat;
  }

  get createdAtText() {
    if (this.created_at === null) return "—";
    return formatDate(this.created_at, { month: "short", day: "numeric", year: "numeric" });
  }

  get editedAtText() {
    if (this.edited_at === null) return "—";
    return formatDate(this.edited_at, { month: "short", day: "numeric", year: "numeric" });
  }

  get editedText() {
    if (this.edited_at === null) return null;
    return `Edited ${formatDate(this.edited_at, { month: "short", day: "numeric" })}`;
  }

  get promptLabel() {
    return `PROMPT / ${this.key.toUpperCase()}`;
  }
}

module.exports = Prompt;
