/**
 * Scheduled cleanup of expired rows
 */

const { CLEANUP_INTERVAL_MS } = require("../config");

const MAX_CONSECUTIVE_FAILURES = 5;

const MAX_BACKOFF_MS = 30 * 60 * 1000;

const createCleanupJob = ({ run, intervalMs = CLEANUP_INTERVAL_MS }) => {
  let timer = null;
  let consecutiveFailures = 0;

  const scheduleNext = () => {
    const delay =
      consecutiveFailures === 0
        ? intervalMs
        : Math.min(intervalMs * Math.pow(2, consecutiveFailures), MAX_BACKOFF_MS);

    timer = setTimeout(async () => {
      try {
        const count = await run();
        if (count > 0) {
          console.log(`Cleanup: removed ${count} expired rows`);
        }
        consecutiveFailures = 0;
      } catch (err) {
        consecutiveFailures++;
        console.error(
          `Cleanup failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`,
          err.message
        );

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.error(
            "CRITICAL: Cleanup job stopped after " +
              `${MAX_CONSECUTIVE_FAILURES} consecutive failures. ` +
              "Manual intervention required."
          );
          timer = null;
          return;
        }
      }

      if (timer !== null) {
        scheduleNext();
      }
    }, delay);

    timer.unref();
  };

  const start = () => {
    if (timer) return;
    consecutiveFailures = 0;
    scheduleNext();
  };

  const stop = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    consecutiveFailures = 0;
  };

  return { start, stop };
};

module.exports = { createCleanupJob };
