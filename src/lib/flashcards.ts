export type FlashcardRating = "again" | "hard" | "good" | "easy";

export interface Flashcard {
  id: string;
  deck: string;
  question: string;
  answer: string;
  createdAt: number;
  dueDate: string;
  intervalDays: number;
  repetitions: number;
  easeFactor: number;
  reviews: number;
  lastReviewedAt: string;
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  if (!isDateKey(dateKey)) throw new Error("A valid review date is required.");
  if (!Number.isInteger(days) || days < 0 || days > 36500) throw new Error("Review interval is outside the supported range.");
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function isFlashcard(value: unknown): value is Flashcard {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const card = value as Record<string, unknown>;
  return typeof card.id === "string" && card.id.length > 0 && card.id.length <= 100
    && typeof card.deck === "string" && card.deck.trim().length > 0 && card.deck.length <= 60
    && typeof card.question === "string" && card.question.trim().length >= 3 && card.question.length <= 2000
    && typeof card.answer === "string" && card.answer.trim().length > 0 && card.answer.length <= 5000
    && typeof card.createdAt === "number" && Number.isFinite(card.createdAt)
    && typeof card.dueDate === "string" && isDateKey(card.dueDate)
    && Number.isInteger(card.intervalDays) && Number(card.intervalDays) >= 0 && Number(card.intervalDays) <= 36500
    && Number.isInteger(card.repetitions) && Number(card.repetitions) >= 0 && Number(card.repetitions) <= 100000
    && typeof card.easeFactor === "number" && Number.isFinite(card.easeFactor) && card.easeFactor >= 1.3 && card.easeFactor <= 5
    && Number.isInteger(card.reviews) && Number(card.reviews) >= 0 && Number(card.reviews) <= 100000
    && typeof card.lastReviewedAt === "string" && (card.lastReviewedAt === "" || isDateKey(card.lastReviewedAt));
}

export function parseFlashcards(raw: string): Flashcard[] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Flashcard backup is not valid JSON."); }
  if (!Array.isArray(parsed)) throw new Error("Flashcard backup must contain a card list.");
  if (parsed.length > 1000) throw new Error("A flashcard library can contain at most 1,000 cards.");
  if (!parsed.every(isFlashcard)) throw new Error("Flashcard backup contains an invalid card.");
  const ids = new Set<string>();
  for (const card of parsed) {
    if (ids.has(card.id)) throw new Error("Flashcard backup contains duplicate card IDs.");
    ids.add(card.id);
  }
  return parsed;
}

export function reviewFlashcard(card: Flashcard, rating: FlashcardRating, today: string): Flashcard {
  if (!isFlashcard(card)) throw new Error("Invalid flashcard.");
  if (!isDateKey(today)) throw new Error("A valid review date is required.");
  const quality: Record<FlashcardRating, number> = { again: 1, hard: 3, good: 4, easy: 5 };
  const score = quality[rating];
  let repetitions = card.repetitions;
  let intervalDays: number;
  if (score < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.max(1, Math.round(card.intervalDays * card.easeFactor));
    repetitions += 1;
  }
  const delta = 0.1 - (5 - score) * (0.08 + (5 - score) * 0.02);
  const easeFactor = Math.max(1.3, Math.min(5, card.easeFactor + delta));
  return {
    ...card,
    repetitions,
    intervalDays,
    easeFactor: Math.round(easeFactor * 100) / 100,
    reviews: card.reviews + 1,
    lastReviewedAt: today,
    dueDate: addDaysToDateKey(today, intervalDays),
  };
}

export function getFlashcardStats(cards: readonly Flashcard[], today: string): {
  total: number;
  due: number;
  decks: number;
  mastered: number;
  reviewed: number;
} {
  return {
    total: cards.length,
    due: cards.filter(card => card.dueDate <= today).length,
    decks: new Set(cards.map(card => card.deck)).size,
    mastered: cards.filter(card => card.repetitions >= 3).length,
    reviewed: cards.reduce((sum, card) => sum + card.reviews, 0),
  };
}

export function getDueFlashcards(cards: readonly Flashcard[], today: string, deck = "all"): Flashcard[] {
  return cards
    .filter(card => card.dueDate <= today && (deck === "all" || card.deck === deck))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt - b.createdAt);
}
