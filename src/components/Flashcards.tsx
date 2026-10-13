import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  getDueFlashcards,
  getFlashcardStats,
  parseFlashcards,
  reviewFlashcard,
  type Flashcard,
  type FlashcardRating,
} from "../lib/flashcards";

const STORAGE_KEY = "haryomix.flashcards.v1";

function localDateKey(date: Date): string {
  return String(date.getFullYear()) + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function readStoredCards(): Flashcard[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseFlashcards(raw) : [];
  } catch {
    return [];
  }
}

function newId(): string {
  return typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

export function Flashcards() {
  const [cards, setCards] = useState<Flashcard[]>(readStoredCards);
  const [deck, setDeck] = useState("General");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [tab, setTab] = useState<"study" | "create" | "library">("study");
  const [deckFilter, setDeckFilter] = useState("all");
  const [showAnswer, setShowAnswer] = useState(false);
  const [notice, setNotice] = useState("");
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const today = localDateKey(new Date());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
      setStorageUnavailable(false);
    } catch {
      setStorageUnavailable(true);
    }
  }, [cards]);

  const decks = useMemo(() => [...new Set(cards.map(card => card.deck))].sort((a, b) => a.localeCompare(b)), [cards]);
  const stats = useMemo(() => getFlashcardStats(cards, today), [cards, today]);
  const dueCards = useMemo(() => getDueFlashcards(cards, today, deckFilter), [cards, today, deckFilter]);
  const currentCard = dueCards[0] ?? null;
  const libraryCards = useMemo(() => cards
    .filter(card => deckFilter === "all" || card.deck === deckFilter)
    .sort((a, b) => a.deck.localeCompare(b.deck) || a.question.localeCompare(b.question)), [cards, deckFilter]);

  function addCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanDeck = deck.trim();
    const cleanQuestion = question.trim();
    const cleanAnswer = answer.trim();
    if (cleanDeck.length < 1 || cleanDeck.length > 60) {
      setNotice("Deck name must be between 1 and 60 characters.");
      return;
    }
    if (cleanQuestion.length < 3 || cleanQuestion.length > 2000) {
      setNotice("Question must be between 3 and 2,000 characters.");
      return;
    }
    if (!cleanAnswer || cleanAnswer.length > 5000) {
      setNotice("Answer must be between 1 and 5,000 characters.");
      return;
    }
    if (cards.length >= 1000) {
      setNotice("This library supports up to 1,000 cards. Export a backup or remove old cards first.");
      return;
    }
    const card: Flashcard = {
      id: newId(),
      deck: cleanDeck,
      question: cleanQuestion,
      answer: cleanAnswer,
      createdAt: Date.now(),
      dueDate: today,
      intervalDays: 0,
      repetitions: 0,
      easeFactor: 2.5,
      reviews: 0,
      lastReviewedAt: "",
    };
    setCards(current => [card, ...current]);
    setQuestion("");
    setAnswer("");
    setDeck(cleanDeck);
    setNotice("Flashcard added to " + cleanDeck + ".");
    setTab("study");
    setDeckFilter(cleanDeck);
    setShowAnswer(false);
  }

  function rateCurrentCard(rating: FlashcardRating) {
    if (!currentCard) return;
    const updated = reviewFlashcard(currentCard, rating, today);
    setCards(current => current.map(card => card.id === updated.id ? updated : card));
    setShowAnswer(false);
    setNotice("Reviewed. Next review: " + updated.dueDate + " (" + updated.intervalDays + " day" + (updated.intervalDays === 1 ? "" : "s") + ").");
  }

  function deleteCard(id: string) {
    setCards(current => current.filter(card => card.id !== id));
    setNotice("Flashcard deleted.");
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(cards, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "haryomix-flashcards.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Flashcard backup exported.");
  }

  function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > 2_000_000) {
      setNotice("Backup is too large. Choose a file under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseFlashcards(String(reader.result ?? ""));
        setCards(imported);
        setDeckFilter("all");
        setTab("library");
        setNotice("Imported " + imported.length + " cards. Your previous library was replaced.");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not import this backup.");
      }
    };
    reader.onerror = () => setNotice("Could not read that backup file.");
    reader.readAsText(file);
  }

  return <div className="hmx-flashcards">
    <div className="hmx-panel">
      <div className="hmx-panel-head">
        <div><h2>Flashcards & Active Recall</h2><p className="hmx-flashcards-subtitle">Remember more by retrieving the answer, not just rereading it.</p></div>
        <span className="hmx-planner-local">LOCAL-FIRST</span>
      </div>
      <div className="hmx-panel-body">
        <div className="hmx-note">Cards are saved in this browser. Review scheduling uses a lightweight SM-2-style interval and needs no AI provider. Export a backup before clearing browser data or switching devices.</div>
        {storageUnavailable && <div className="hmx-note" role="alert">Browser storage is unavailable. Your current cards may not persist after you leave this page.</div>}
        {notice && <div className="hmx-note" role="status" aria-live="polite">{notice}</div>}
        <div className="hmx-flash-stats">
          <div><span>Cards</span><strong>{stats.total}</strong></div>
          <div><span>Due now</span><strong>{stats.due}</strong></div>
          <div><span>Decks</span><strong>{stats.decks}</strong></div>
          <div><span>Mastered</span><strong>{stats.mastered}</strong></div>
        </div>
        <div className="hmx-flash-tabs" role="tablist" aria-label="Flashcard views">
          <button type="button" role="tab" aria-selected={tab === "study"} className={tab === "study" ? "active" : ""} onClick={() => { setTab("study"); setShowAnswer(false); }}>Study due cards</button>
          <button type="button" role="tab" aria-selected={tab === "create"} className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}>Create cards</button>
          <button type="button" role="tab" aria-selected={tab === "library"} className={tab === "library" ? "active" : ""} onClick={() => setTab("library")}>Library</button>
        </div>
        <div className="hmx-flash-toolbar">
          <div className="hmx-field"><label htmlFor="hmx-flash-deck-filter">Deck filter</label><select id="hmx-flash-deck-filter" className="hmx-select" value={deckFilter} onChange={event => { setDeckFilter(event.target.value); setShowAnswer(false); }}><option value="all">All decks</option>{decks.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
          <div className="hmx-btn-row"><button type="button" className="hmx-btn" onClick={exportBackup}>Export backup ↓</button><label className="hmx-btn hmx-flash-import">Import backup (replace) ↥<input type="file" accept="application/json,.json" onChange={importBackup} aria-label="Import flashcard backup; replaces current library"/></label></div>
        </div>
        {tab === "create" && <form className="hmx-flash-form" onSubmit={addCard}>
          <h3>Create a flashcard</h3>
          <div className="hmx-field"><label htmlFor="hmx-flash-deck">Deck / subject</label><input id="hmx-flash-deck" className="hmx-input" value={deck} onChange={event => setDeck(event.target.value)} maxLength={60} required placeholder="e.g. Operating Systems"/></div>
          <div className="hmx-field"><label htmlFor="hmx-flash-question">Question / prompt</label><textarea id="hmx-flash-question" className="hmx-textarea" value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} required minLength={3} placeholder="Ask one clear question. Example: What is a process in an operating system?"/></div>
          <div className="hmx-field"><label htmlFor="hmx-flash-answer">Answer / explanation</label><textarea id="hmx-flash-answer" className="hmx-textarea" value={answer} onChange={event => setAnswer(event.target.value)} maxLength={5000} required placeholder="Write a concise answer and a useful explanation."/></div>
          <div className="hmx-btn-row"><button className="hmx-btn primary" type="submit">Save flashcard +</button><button className="hmx-btn" type="button" onClick={() => { setQuestion(""); setAnswer(""); setNotice(""); }}>Clear fields</button></div>
        </form>}
        {tab === "study" && <div className="hmx-flash-study">
          {!currentCard
            ? <div className="hmx-planner-empty"><span>✳</span><strong>{cards.length ? "You're caught up for now." : "Build your first deck."}</strong><p>{cards.length ? "No cards are due today in this deck. Add more cards or return when your next review is due." : "Create cards from class notes, definitions, formulas or mistakes. They'll appear here for active recall."}</p><button type="button" className="hmx-btn primary" onClick={() => setTab("create")}>Create flashcards</button></div>
            : <div className="hmx-flash-card">
              <div className="hmx-flash-card-top"><span>{currentCard.deck}</span><span>Due {currentCard.dueDate}</span></div>
              <div className="hmx-flash-card-progress">{dueCards.length} due in this view</div>
              <div className="hmx-flash-question"><span>QUESTION</span><p>{currentCard.question}</p></div>
              {showAnswer
                ? <div className="hmx-flash-answer"><span>ANSWER</span><p>{currentCard.answer}</p></div>
                : <button type="button" className="hmx-btn primary hmx-flash-reveal" onClick={() => setShowAnswer(true)}>Reveal answer ↓</button>}
              {showAnswer && <div className="hmx-flash-ratings" aria-label="Rate how well you remembered">
                <button type="button" className="rating-again" onClick={() => rateCurrentCard("again")}><strong>Again</strong><span>1 day</span></button>
                <button type="button" className="rating-hard" onClick={() => rateCurrentCard("hard")}><strong>Hard</strong><span>Short interval</span></button>
                <button type="button" className="rating-good" onClick={() => rateCurrentCard("good")}><strong>Good</strong><span>Normal interval</span></button>
                <button type="button" className="rating-easy" onClick={() => rateCurrentCard("easy")}><strong>Easy</strong><span>Higher ease</span></button>
              </div>}
            </div>}
        </div>}
        {tab === "library" && <div className="hmx-flash-library">
          {libraryCards.length === 0
            ? <div className="hmx-planner-empty"><span>▤</span><strong>No cards in this view.</strong><p>Create a card or choose another deck filter.</p></div>
            : <ul className="hmx-flash-list">{libraryCards.map(card => <li key={card.id} className="hmx-flash-library-item"><div><span className="hmx-flash-deck-label">{card.deck}</span><strong>{card.question}</strong><p>{card.answer}</p><small>Next review: {card.dueDate} · {card.reviews} review{card.reviews === 1 ? "" : "s"}</small></div><button type="button" className="hmx-planner-delete" onClick={() => { deleteCard(card.id); }} aria-label={"Delete flashcard: " + card.question}>×</button></li>)}</ul>}
        </div>}
      </div>
    </div>
  </div>;
}
