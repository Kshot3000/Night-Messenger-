/**
 * Shared timestamp formatting for the messenger UI.
 *
 * Every relative/list timestamp in the web app goes through here so the
 * labels can never diverge (the conversation list previously kept its own
 * copy, which called a 47-hour-old message "Yesterday", while an unused
 * earlier version of this module printed "0m" for 45–59 seconds and the
 * literal string "Invalid Date" for unparseable input).
 *
 * All functions return "" for unparseable input so callers can fall back
 * instead of rendering "Invalid Date" to the user.
 */

const DAY_MS = 86_400_000;

function parseMs(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** Whole calendar days between the local dates of `then` and `now`. */
function calendarDaysBetween(thenMs: number, nowMs: number): number {
  const startOfDay = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  return Math.round((startOfDay(nowMs) - startOfDay(thenMs)) / DAY_MS);
}

/**
 * Compact relative label for a past timestamp: "Just now", "5m", "3h",
 * "2d", then a short date. Future timestamps (clock skew, imported data)
 * clamp to "Just now" rather than producing negative durations.
 */
export function formatRelativeTime(iso: string, now = Date.now()): string {
  const then = parseMs(iso);
  if (then === null) return "";
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 60) return "Just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d`;
  return new Date(then).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Timestamp for a conversation-list row: a clock time for today, the
 * literal "Yesterday" only for the previous calendar day, and a short
 * date for anything older. (Elapsed-24h arithmetic gets both of the
 * first two wrong around midnight.)
 */
export function formatListTimestamp(iso: string, now = Date.now()): string {
  const then = parseMs(iso);
  if (then === null) return "";
  const days = calendarDaysBetween(then, now);
  if (days <= 0)
    return new Date(then).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  if (days === 1) return "Yesterday";
  return new Date(then).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Clock time for a message bubble; "" for unparseable input. */
export function formatMessageTime(iso: string): string {
  const then = parseMs(iso);
  if (then === null) return "";
  return new Date(then).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
