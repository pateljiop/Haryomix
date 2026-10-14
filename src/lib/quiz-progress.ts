export type QuizTrack = "school" | "graduation" | "competitive";

export type QuizAttempt = {
  id: string;
  track: QuizTrack;
  score: number;
  total: number;
  answered: number;
  percentage: number;
  completedAt: number;
  remainingSeconds: number;
};

export function isQuizAttempt(value: unknown): value is QuizAttempt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<QuizAttempt>;
  return typeof item.id === "string" && item.id.trim().length > 0
    && (item.track === "school" || item.track === "graduation" || item.track === "competitive")
    && Number.isInteger(item.score) && Number(item.score) >= 0
    && Number.isInteger(item.total) && Number(item.total) > 0 && Number(item.total) <= 100
    && Number(item.score) <= Number(item.total)
    && Number.isInteger(item.answered) && Number(item.answered) >= 0 && Number(item.answered) <= Number(item.total)
    && Number.isInteger(item.percentage) && Number(item.percentage) >= 0 && Number(item.percentage) <= 100
    && item.percentage === Math.round(Number(item.score) / Number(item.total) * 100)
    && Number.isFinite(item.completedAt) && Number(item.completedAt) > 0
    && Number.isInteger(item.remainingSeconds) && Number(item.remainingSeconds) >= 0 && Number(item.remainingSeconds) <= 3600;
}

export function parseQuizAttempts(raw: string): QuizAttempt[] {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("Quiz progress is not valid JSON."); }
  if (!Array.isArray(value)) throw new Error("Quiz progress must be a list of attempts.");
  if (value.length > 1000) throw new Error("Quiz progress can contain at most 1,000 attempts.");
  const ids = new Set<string>();
  for (const item of value) {
    if (!isQuizAttempt(item)) throw new Error("Quiz progress contains an invalid attempt.");
    if (ids.has(item.id)) throw new Error("Quiz progress contains duplicate attempt IDs.");
    ids.add(item.id);
  }
  return value;
}

export function getQuizProgress(attempts: QuizAttempt[]) {
  const totalTests = attempts.length;
  const totalCorrect = attempts.reduce((sum, item) => sum + item.score, 0);
  const totalQuestions = attempts.reduce((sum, item) => sum + item.total, 0);
  const averagePercentage = totalTests
    ? Math.round(attempts.reduce((sum, item) => sum + item.percentage, 0) / totalTests)
    : 0;
  const bestPercentage = totalTests ? Math.max(...attempts.map(item => item.percentage)) : 0;
  const byTrack = (["school", "graduation", "competitive"] as const).map(track => {
    const items = attempts.filter(item => item.track === track);
    return {
      track,
      tests: items.length,
      averagePercentage: items.length ? Math.round(items.reduce((sum, item) => sum + item.percentage, 0) / items.length) : 0,
      bestPercentage: items.length ? Math.max(...items.map(item => item.percentage)) : 0,
    };
  });
  return { totalTests, totalCorrect, totalQuestions, averagePercentage, bestPercentage, byTrack };
}
