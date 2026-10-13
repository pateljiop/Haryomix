import test from "node:test";
import assert from "node:assert/strict";
import {
  getFocusStats,
  isFocusSession,
  parseFocusSessions,
} from "../src/lib/focus-timer.ts";

function session(id, date, durationMinutes = 25) {
  return { id, completedAt: new Date(date + "T12:00:00Z").getTime(), durationMinutes };
}

test("focus session validator accepts valid history and rejects invalid durations", () => {
  assert.equal(isFocusSession(session("s1", "2026-10-14")), true);
  assert.equal(isFocusSession(session("s2", "2026-10-14", 0)), false);
  assert.equal(isFocusSession({ id: "s3", completedAt: Number.NaN, durationMinutes: 25 }), false);
});

test("focus backup parser validates JSON, list shape, limits and duplicate IDs", () => {
  assert.deepEqual(parseFocusSessions(JSON.stringify([session("s1", "2026-10-14")])), [session("s1", "2026-10-14")]);
  assert.throws(() => parseFocusSessions("{"), /not valid JSON/);
  assert.throws(() => parseFocusSessions(JSON.stringify({ sessions: [] })), /session list/);
  assert.throws(() => parseFocusSessions(JSON.stringify([session("same", "2026-10-14"), session("same", "2026-10-13")])), /duplicate session IDs/);
  assert.throws(() => parseFocusSessions(JSON.stringify(Array.from({ length: 1001 }, (_, i) => session("s" + i, "2026-10-14")))), /at most 1,000/);
});

test("focus statistics calculate daily sessions, minutes, totals and consecutive-day streak", () => {
  const sessions = [
    session("today-1", "2026-10-14", 25),
    session("today-2", "2026-10-14", 25),
    session("yesterday", "2026-10-13", 25),
    session("two-days", "2026-10-12", 25),
    session("old", "2026-10-09", 25),
  ];
  assert.deepEqual(getFocusStats(sessions, "2026-10-14"), {
    sessionsToday: 2,
    focusMinutesToday: 50,
    totalFocusMinutes: 125,
    streakDays: 3,
  });
});

test("focus streak can continue from yesterday when no session is logged today", () => {
  const sessions = [session("yesterday", "2026-10-13"), session("two-days", "2026-10-12")];
  assert.equal(getFocusStats(sessions, "2026-10-14").streakDays, 2);
  assert.equal(getFocusStats([], "2026-10-14").streakDays, 0);
});
