import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  formatListTimestamp,
  formatMessageTime,
  formatRelativeTime,
} from "../src/lib/format.ts";

const iso = (ms) => new Date(ms).toISOString();
// Fixed local "now": Saturday Oct 3, 2026, 00:30 — just after midnight,
// where elapsed-hours and calendar-day answers disagree the most.
const NOW = new Date(2026, 9, 3, 0, 30, 0).getTime();
const local = (dayOffset, h, mi = 0) => {
  const d = new Date(2026, 9, 3 + dayOffset, h, mi, 0);
  return d.getTime();
};

test("relative labels never print 0m and clamp clock skew", () => {
  // Regression: the previous implementation returned "0m" for 45–59s.
  for (const s of [0, 10, 44, 45, 50, 59])
    assert.equal(formatRelativeTime(iso(NOW - s * 1000), NOW), "Just now");
  assert.equal(formatRelativeTime(iso(NOW - 60_000), NOW), "1m");
  assert.equal(formatRelativeTime(iso(NOW - 119_000), NOW), "1m");
  assert.equal(formatRelativeTime(iso(NOW - 120_000), NOW), "2m");
  assert.equal(formatRelativeTime(iso(NOW - 3_599_000), NOW), "59m");
  assert.equal(formatRelativeTime(iso(NOW - 3_600_000), NOW), "1h");
  assert.equal(formatRelativeTime(iso(NOW - 86_399_000), NOW), "23h");
  assert.equal(formatRelativeTime(iso(NOW - 86_400_000), NOW), "1d");
  assert.equal(formatRelativeTime(iso(NOW - 6 * 86_400_000), NOW), "6d");
  // Future timestamps (clock skew / imported data) clamp, never negative.
  assert.equal(formatRelativeTime(iso(NOW + 3_600_000), NOW), "Just now");
});

test("unparseable timestamps render as empty, never 'Invalid Date'", () => {
  assert.equal(formatRelativeTime("not-a-date", NOW), "");
  assert.equal(formatListTimestamp("not-a-date", NOW), "");
  assert.equal(formatMessageTime("not-a-date"), "");
  assert.ok(formatMessageTime(iso(NOW)).length > 0);
});

test("list timestamp uses calendar days, not elapsed 24h blocks", () => {
  // 35 minutes ago but on the previous calendar day → "Yesterday".
  // Regression: elapsed-hours math showed a bare clock time here.
  assert.equal(formatListTimestamp(iso(local(-1, 23, 55)), NOW), "Yesterday");
  // 25 hours ago, still the previous calendar day → "Yesterday".
  const noon = new Date(2026, 9, 3, 12, 0, 0).getTime();
  assert.equal(formatListTimestamp(iso(local(-1, 11)), noon), "Yesterday");
  // 47 hours ago is two calendar days back → a date, NOT "Yesterday".
  // Regression: elapsed-hours math labelled this "Yesterday".
  const twoDaysAgo = formatListTimestamp(iso(local(-2, 13)), noon);
  assert.notEqual(twoDaysAgo, "Yesterday");
  assert.equal(
    twoDaysAgo,
    new Date(local(-2, 13)).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  );
  // Earlier today → a clock time.
  const today = formatListTimestamp(iso(local(0, 0, 5)), NOW);
  assert.notEqual(today, "Yesterday");
  assert.ok(today.length > 0 && !/^[A-Z][a-z]{2} \d+$/.test(today));
});

test("components use the shared formatter instead of private copies", () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
  const list = read("../src/components/ConversationList.tsx");
  assert.ok(list.includes('from "@/lib/format"'));
  assert.ok(
    !list.includes("86400000"),
    "ConversationList must not re-implement day math",
  );
  const thread = read("../src/components/ChatThread.tsx");
  assert.ok(thread.includes("formatMessageTime"));
});
