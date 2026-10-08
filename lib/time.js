/**
 * Time zone helpers
 */

const partsIn = (ms, timeZone, options) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, ...options })
      .formatToParts(ms)
      .map((p) => [p.type, p.value])
  );

const offsetMs = (ms, timeZone) => {
  const name = partsIn(ms, timeZone, { timeZoneName: "longOffset" }).timeZoneName;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 3_600_000 + Number(match[3]) * 60_000);
};

const startOfDayMs = (now, timeZone) => {
  const { year, month, day } = partsIn(now, timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const wallMidnight = Date.UTC(Number(year), Number(month) - 1, Number(day));
  let result = wallMidnight - offsetMs(wallMidnight, timeZone);
  result = wallMidnight - offsetMs(result, timeZone);
  return result;
};

module.exports = { startOfDayMs };
