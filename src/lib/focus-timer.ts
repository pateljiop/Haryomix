export interface FocusSession {
  id: string;
  completedAt: number;
  durationMinutes: number;
}

function dateKeyFromTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return String(date.getFullYear()) + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function shiftDateKey(value: string, days: number): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error("A valid calendar date is required.");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
}

export function isFocusSession(value: unknown): value is FocusSession {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const session = value as Record<string, unknown>;
  return typeof session.id === "string" && session.id.length > 0 && session.id.length <= 100
    && typeof session.completedAt === "number" && Number.isFinite(session.completedAt) && session.completedAt > 0
    && Number.isInteger(session.durationMinutes) && Number(session.durationMinutes) >= 1 && Number(session.durationMinutes) <= 120;
}

export function parseFocusSessions(raw: string): FocusSession[] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Focus backup is not valid JSON."); }
  if (!Array.isArray(parsed)) throw new Error("Focus backup must contain a session list.");
  if (parsed.length > 1000) throw new Error("A focus history can contain at most 1,000 sessions.");
  if (!parsed.every(isFocusSession)) throw new Error("Focus backup contains an invalid session.");
  const ids = new Set<string>();
  for (const session of parsed) {
    if (ids.has(session.id)) throw new Error("Focus backup contains duplicate session IDs.");
    ids.add(session.id);
  }
  return parsed;
}

export function getFocusStats(sessions: readonly FocusSession[], today: string): {
  sessionsToday: number;
  focusMinutesToday: number;
  totalFocusMinutes: number;
  streakDays: number;
} {
  const dayKeys = new Set(sessions.map(session => dateKeyFromTimestamp(session.completedAt)));
  const todaySessions = sessions.filter(session => dateKeyFromTimestamp(session.completedAt) === today);
  let cursor = dayKeys.has(today) ? today : shiftDateKey(today, -1);
  let streakDays = 0;
  while (dayKeys.has(cursor) && streakDays < 3650) {
    streakDays += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return {
    sessionsToday: todaySessions.length,
    focusMinutesToday: todaySessions.reduce((sum, session) => sum + session.durationMinutes, 0),
    totalFocusMinutes: sessions.reduce((sum, session) => sum + session.durationMinutes, 0),
    streakDays,
  };
}
