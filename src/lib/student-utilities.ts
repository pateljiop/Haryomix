export interface AttendanceSummary {
  currentPercent: number;
  classesNeededToReachTarget: number | null;
  classesCanSkip: number;
}

function finiteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(label + " must be a finite number.");
  return value;
}

export function calculatePercentage(obtained: number, total: number): number {
  finiteNumber(obtained, "Obtained marks");
  finiteNumber(total, "Total marks");
  if (total <= 0) throw new Error("Total marks must be greater than zero.");
  if (obtained < 0 || obtained > total) throw new Error("Obtained marks must be between zero and total marks.");
  return Number(((obtained / total) * 100).toFixed(2));
}

export function calculateAttendance(present: number, held: number, targetPercent: number): AttendanceSummary {
  finiteNumber(present, "Classes attended");
  finiteNumber(held, "Classes held");
  finiteNumber(targetPercent, "Target attendance");
  if (!Number.isInteger(present) || !Number.isInteger(held) || present < 0 || held < 1 || present > held) {
    throw new Error("Use whole class counts with 0 ≤ attended ≤ held and held ≥ 1.");
  }
  if (targetPercent <= 0 || targetPercent > 100) throw new Error("Target attendance must be greater than 0 and at most 100.");
  const currentPercent = Number(((present / held) * 100).toFixed(2));
  const classesNeededToReachTarget = currentPercent >= targetPercent
    ? 0
    : targetPercent === 100
      ? null
      : Math.ceil(Math.max(0, (targetPercent * held - 100 * present) / (100 - targetPercent)));
  const classesCanSkip = Math.max(0, Math.floor((present * 100 / targetPercent) - held + 1e-9));
  return { currentPercent, classesNeededToReachTarget, classesCanSkip };
}

export function calculateCgpa(
  subjects: readonly { credits: number; gradePoint: number }[],
): number {
  if (!subjects.length) throw new Error("Add at least one subject.");
  let totalCredits = 0;
  let weightedPoints = 0;
  for (const subject of subjects) {
    finiteNumber(subject.credits, "Credits");
    finiteNumber(subject.gradePoint, "Grade point");
    if (subject.credits <= 0 || subject.credits > 100) throw new Error("Each subject needs credits between 0 and 100.");
    if (subject.gradePoint < 0 || subject.gradePoint > 10) throw new Error("Grade points must be between 0 and 10.");
    totalCredits += subject.credits;
    weightedPoints += subject.credits * subject.gradePoint;
  }
  if (totalCredits <= 0) throw new Error("Total credits must be greater than zero.");
  return Number((weightedPoints / totalCredits).toFixed(2));
}

export interface TextStats {
  words: number;
  characters: number;
  charactersWithoutSpaces: number;
  lines: number;
  readingMinutes: number;
}

export function countText(value: string): TextStats {
  const words = value.trim() ? value.trim().split(/\s+/u).length : 0;
  return {
    words,
    characters: value.length,
    charactersWithoutSpaces: value.replace(/\s/gu, "").length,
    lines: value.length ? value.split(/\r\n|\r|\n/u).length : 0,
    readingMinutes: words ? Math.max(1, Math.ceil(words / 200)) : 0,
  };
}

export function formatJson(value: string, compact = false): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Invalid JSON. Check commas, quotes, brackets and trailing commas.");
  }
  return JSON.stringify(parsed, null, compact ? 0 : 2);
}

export function encodeUrlComponent(value: string): string {
  return encodeURIComponent(value);
}

export function decodeUrlComponent(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/gu, "%20"));
  } catch {
    throw new Error("Invalid URL encoding. Check percent-encoded characters.");
  }
}
