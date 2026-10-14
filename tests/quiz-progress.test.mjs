import test from "node:test";
import assert from "node:assert/strict";
import { getQuizProgress, isQuizAttempt, parseQuizAttempts } from "../src/lib/quiz-progress.ts";

function attempt(id, track, score, total = 5, completedAt = 1_800_000_000_000) {
  return { id, track, score, total, answered: total, percentage: Math.round(score / total * 100), completedAt, remainingSeconds: 300 };
}

test("quiz attempt validator checks track, score bounds, percentage and timestamps", () => {
  assert.equal(isQuizAttempt(attempt("a1", "school", 4)), true);
  assert.equal(isQuizAttempt({ ...attempt("a2", "school", 6), total: 5 }), false);
  assert.equal(isQuizAttempt({ ...attempt("a3", "school", 4), percentage: 20 }), false);
  assert.equal(isQuizAttempt({ ...attempt("a4", "unknown", 4) }), false);
});

test("quiz history parser validates JSON, list shape, size and unique IDs", () => {
  assert.deepEqual(parseQuizAttempts(JSON.stringify([attempt("a1", "school", 4)])), [attempt("a1", "school", 4)]);
  assert.throws(() => parseQuizAttempts("{"), /not valid JSON/);
  assert.throws(() => parseQuizAttempts(JSON.stringify({ attempts: [] })), /must be a list/);
  assert.throws(() => parseQuizAttempts(JSON.stringify([attempt("same", "school", 4), attempt("same", "graduation", 3)])), /duplicate attempt IDs/);
  assert.throws(() => parseQuizAttempts(JSON.stringify(Array.from({ length: 1001 }, (_, i) => attempt("a" + i, "school", 3)))), /at most 1,000/);
});

test("progress statistics calculate average, best, correct answers and per-track totals", () => {
  const result = getQuizProgress([
    attempt("s1", "school", 4),
    attempt("s2", "school", 2),
    attempt("g1", "graduation", 5),
  ]);
  assert.equal(result.totalTests, 3);
  assert.equal(result.totalCorrect, 11);
  assert.equal(result.totalQuestions, 15);
  assert.equal(result.averagePercentage, 73);
  assert.equal(result.bestPercentage, 100);
  assert.deepEqual(result.byTrack.find(item => item.track === "school"), {
    track: "school", tests: 2, averagePercentage: 60, bestPercentage: 80,
  });
  assert.equal(result.byTrack.find(item => item.track === "competitive")?.tests, 0);
});
