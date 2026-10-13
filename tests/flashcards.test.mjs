import test from "node:test";
import assert from "node:assert/strict";
import {
  addDaysToDateKey,
  getDueFlashcards,
  getFlashcardStats,
  isFlashcard,
  parseFlashcards,
  reviewFlashcard,
} from "../src/lib/flashcards.ts";

function card(overrides = {}) {
  return {
    id: "card-1",
    deck: "Operating Systems",
    question: "What is a process?",
    answer: "A program in execution with its own process state.",
    createdAt: 100,
    dueDate: "2026-10-14",
    intervalDays: 0,
    repetitions: 0,
    easeFactor: 2.5,
    reviews: 0,
    lastReviewedAt: "",
    ...overrides,
  };
}

test("flashcard validator accepts a valid card and rejects incomplete data", () => {
  assert.equal(isFlashcard(card()), true);
  assert.equal(isFlashcard({ ...card(), answer: " " }), false);
  assert.equal(isFlashcard({ ...card(), dueDate: "2026-02-30" }), false);
});

test("flashcard backup parser rejects malformed, invalid, duplicate and oversized backups", () => {
  assert.deepEqual(parseFlashcards(JSON.stringify([card()])), [card()]);
  assert.throws(() => parseFlashcards("{"), /not valid JSON/);
  assert.throws(() => parseFlashcards(JSON.stringify({ cards: [card()] })), /card list/);
  assert.throws(() => parseFlashcards(JSON.stringify([card(), card()])), /duplicate card IDs/);
  assert.throws(() => parseFlashcards(JSON.stringify(Array.from({ length: 1001 }, (_, i) => card({ id: "c-" + i })))), /at most 1,000/);
});

test("date arithmetic crosses month and year boundaries in UTC-safe date keys", () => {
  assert.equal(addDaysToDateKey("2026-10-31", 1), "2026-11-01");
  assert.equal(addDaysToDateKey("2026-12-31", 1), "2027-01-01");
  assert.throws(() => addDaysToDateKey("2026-02-30", 1), /valid review date/);
});

test("good reviews increase repetitions and schedule the next interval", () => {
  const first = reviewFlashcard(card(), "good", "2026-10-14");
  assert.equal(first.repetitions, 1);
  assert.equal(first.intervalDays, 1);
  assert.equal(first.dueDate, "2026-10-15");
  assert.equal(first.reviews, 1);

  const second = reviewFlashcard(first, "good", "2026-10-15");
  assert.equal(second.repetitions, 2);
  assert.equal(second.intervalDays, 6);
  assert.equal(second.dueDate, "2026-10-21");

  const third = reviewFlashcard(second, "easy", "2026-10-21");
  assert.equal(third.repetitions, 3);
  assert.equal(third.intervalDays, 15);
  assert.equal(third.easeFactor, 2.6);
});

test("again resets the repetition streak and lowers ease without going below the floor", () => {
  const reviewed = reviewFlashcard(card({ repetitions: 5, intervalDays: 40, easeFactor: 1.3 }), "again", "2026-10-14");
  assert.equal(reviewed.repetitions, 0);
  assert.equal(reviewed.intervalDays, 1);
  assert.equal(reviewed.dueDate, "2026-10-15");
  assert.equal(reviewed.easeFactor, 1.3);
});

test("due queue filters by date and deck and statistics summarize the library", () => {
  const cards = [
    card({ id: "due", dueDate: "2026-10-13", reviews: 2, repetitions: 2 }),
    card({ id: "today", deck: "Biology", dueDate: "2026-10-14", reviews: 1 }),
    card({ id: "future", dueDate: "2026-10-20", repetitions: 3 }),
  ];
  assert.deepEqual(getDueFlashcards(cards, "2026-10-14").map(item => item.id), ["due", "today"]);
  assert.deepEqual(getDueFlashcards(cards, "2026-10-14", "Biology").map(item => item.id), ["today"]);
  assert.deepEqual(getFlashcardStats(cards, "2026-10-14"), { total: 3, due: 2, decks: 2, mastered: 1, reviewed: 3 });
});
