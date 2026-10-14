import { useMemo, useState } from "react";
import { questionSets, trackLabels, type Track, type Question } from "../lib/practice-questions";

type BankTrack = Track | "all";
type BankItem = { id: string; track: Track; question: Question };

export function QuestionBank() {
  const [track, setTrack] = useState<BankTrack>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const items = useMemo<BankItem[]>(() => (Object.keys(questionSets) as Track[]).flatMap(key =>
    questionSets[key].map((question, index) => ({ id: key + "-" + index, track: key, question }))
  ), []);
  const filtered = useMemo(() => items.filter(item => {
    const matchesTrack = track === "all" || item.track === track;
    const searchable = [item.question.prompt, ...item.question.options, item.question.explanation, trackLabels[item.track]].join(" ").toLowerCase();
    return matchesTrack && searchable.includes(query.trim().toLowerCase());
  }), [items, track, query]);

  function toggle(id: string) {
    setExpanded(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]);
  }

  function exportBank() {
    const data = filtered.map(item => ({
      track: trackLabels[item.track],
      question: item.question.prompt,
      options: item.question.options,
      correctAnswer: item.question.options[item.question.answer],
      explanation: item.question.explanation,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "haryomix-question-bank.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="hmx-panel">
    <div className="hmx-panel-head">
      <div><p className="hmx-page-eyebrow">SEARCH · REVIEW · PRACTICE</p><h2>Question Bank</h2><p className="hmx-planner-subtitle">Find starter questions by learning track, inspect answers and export the filtered set.</p></div>
      <span className="hmx-planner-local">15 STARTER QUESTIONS</span>
    </div>
    <div className="hmx-panel-body">
      <div className="hmx-note">This is a starter question bank built from general practice questions. It is not an official past-paper archive. Course-specific and exam-specific question sets will need verified syllabus and source coverage.</div>
      <div className="hmx-planner-filters">
        <div className="hmx-field"><label htmlFor="hmx-question-bank-track">Learning track</label><select id="hmx-question-bank-track" className="hmx-select" value={track} onChange={event => setTrack(event.target.value as BankTrack)}><option value="all">All tracks</option><option value="school">School · Class 6–12</option><option value="graduation">Graduation · University</option><option value="competitive">One-Day Competitive Exams</option></select></div>
        <div className="hmx-field"><label htmlFor="hmx-question-bank-search">Search questions</label><input id="hmx-question-bank-search" className="hmx-input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search a question, option or concept…"/></div>
      </div>
      <div className="hmx-planner-list-head"><div><h3>Questions</h3><p>{filtered.length} of {items.length} questions</p></div><button type="button" className="hmx-btn" onClick={exportBank} disabled={!filtered.length}>Export filtered set ↓</button></div>
      {!filtered.length
        ? <div className="hmx-planner-empty"><strong>No matching questions.</strong><p>Try another search term or switch the learning track.</p></div>
        : <div className="hmx-library-list">{filtered.map((item, index) => <article className="hmx-result" key={item.id} style={{ marginTop: 12 }}>
          <div className="hmx-planner-list-head"><span className="hmx-planner-local">{trackLabels[item.track]}</span><span>Q{index + 1}</span></div>
          <h3>{item.question.prompt}</h3>
          <ol>{item.question.options.map((option, optionIndex) => <li key={option} style={{ fontWeight: optionIndex === item.question.answer ? 700 : 400 }}>{String.fromCharCode(65 + optionIndex)}. {option}{optionIndex === item.question.answer ? " ✓" : ""}</li>)}</ol>
          {expanded.includes(item.id) && <div className="hmx-note"><strong>Explanation:</strong> {item.question.explanation}</div>}
          <button type="button" className="hmx-btn" aria-expanded={expanded.includes(item.id)} onClick={() => toggle(item.id)}>{expanded.includes(item.id) ? "Hide explanation" : "Show explanation"}</button>
        </article>)}</div>}
    </div>
  </div>;
}
