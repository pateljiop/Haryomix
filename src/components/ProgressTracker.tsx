import { useEffect, useMemo, useState } from "react";
import { getQuizProgress, parseQuizAttempts, type QuizAttempt, type QuizTrack } from "../lib/quiz-progress";

const STORAGE_KEY = "haryomix.practice-quiz.history.v1";
const labels: Record<QuizTrack, string> = {
  school: "School · Class 6–12",
  graduation: "Graduation · University",
  competitive: "One-Day Competitive Exams",
};

function readAttempts(): QuizAttempt[] {
  try { return parseQuizAttempts(window.localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}

export function ProgressTracker({ onNavigate }: { onNavigate: () => void }) {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [notice, setNotice] = useState("");
  const stats = useMemo(() => getQuizProgress(attempts), [attempts]);

  useEffect(() => {
    setAttempts(readAttempts());
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setAttempts(readAttempts());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function clearHistory() {
    if (!attempts.length) { setNotice("There is no quiz history to clear."); return; }
    if (!window.confirm("Clear all saved quiz attempts from this browser? This cannot be undone.")) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      setAttempts([]);
      setNotice("Quiz history cleared from this browser.");
    } catch {
      setNotice("Browser storage is unavailable. Quiz history could not be cleared.");
    }
  }

  function exportHistory() {
    const blob = new Blob([JSON.stringify(attempts, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "haryomix-quiz-progress.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Quiz progress backup exported.");
  }

  const recent = [...attempts].sort((a, b) => b.completedAt - a.completedAt).slice(0, 20);

  return <div className="hmx-panel">
    <div className="hmx-panel-head">
      <div><p className="hmx-page-eyebrow">MEASURE · REFLECT · IMPROVE</p><h2>Progress Tracker</h2><p className="hmx-planner-subtitle">Review your practice-test scores and spot which learning track needs attention.</p></div>
      <span className="hmx-planner-local">ON THIS DEVICE</span>
    </div>
    <div className="hmx-panel-body">
      <div className="hmx-note">Only completed Practice Quiz attempts are included. History is saved in this browser; it is not synced across devices. Export a backup before clearing site data.</div>
      {notice && <div className="hmx-note" role="status" aria-live="polite">{notice}</div>}
      <div className="hmx-planner-stats" aria-label="Quiz progress summary">
        <div className="hmx-planner-stat"><span>Tests completed</span><strong>{stats.totalTests}</strong></div>
        <div className="hmx-planner-stat"><span>Average score</span><strong>{stats.averagePercentage}%</strong></div>
        <div className="hmx-planner-stat"><span>Best score</span><strong>{stats.bestPercentage}%</strong></div>
        <div className="hmx-planner-stat"><span>Correct answers</span><strong>{stats.totalCorrect} / {stats.totalQuestions}</strong></div>
      </div>
      <div className="hmx-planner-list-head"><div><h3>Progress by track</h3><p>Scores are calculated from your saved attempts.</p></div></div>
      <div className="hmx-tool-directory" aria-label="Progress by learning track">
        {stats.byTrack.map(item => <article className="hmx-directory-card" key={item.track}>
          <span className="hmx-directory-card-top"><span className="hmx-directory-icon">{item.track === "school" ? "▤" : item.track === "graduation" ? "⌂" : "◎"}</span><span className="hmx-directory-number">{item.tests} TEST{item.tests === 1 ? "" : "S"}</span></span>
          <strong>{labels[item.track]}</strong>
          <span className="hmx-directory-description">{item.tests ? "Average " + item.averagePercentage + "% · Best " + item.bestPercentage + "%" : "No attempts recorded yet."}</span>
          <div style={{ height: 6, background: "var(--hm-line, #dfe4f2)", borderRadius: 99, overflow: "hidden", marginTop: 10 }}><div style={{ height: "100%", width: item.bestPercentage + "%", background: "var(--hm-blue, #4f46e5)" }} /></div>
        </article>)}
      </div>
      <div className="hmx-planner-list-head"><div><h3>Recent attempts</h3><p>Showing up to 20 latest completed tests.</p></div><div className="hmx-btn-row"><button type="button" className="hmx-btn" onClick={exportHistory} disabled={!attempts.length}>Export backup ↓</button><button type="button" className="hmx-btn" onClick={clearHistory} disabled={!attempts.length}>Clear history</button></div></div>
      {!recent.length
        ? <div className="hmx-planner-empty"><span>✓</span><strong>No practice results yet.</strong><p>Complete a Practice Quiz to see your score, average and best result here.</p><button type="button" className="hmx-btn primary" onClick={onNavigate}>Start a practice quiz ↗</button></div>
        : <ul className="hmx-planner-task-list">{recent.map(item => <li className="hmx-planner-task" key={item.id}>
          <div className="hmx-planner-task-main"><strong>{labels[item.track]}</strong><div className="hmx-planner-task-meta"><span>{item.score} / {item.total} correct</span><span>{item.answered} answered</span><span>{Math.max(0, Math.floor(item.remainingSeconds / 60))}m left</span></div><span className="hmx-planner-due">{new Date(item.completedAt).toLocaleString()}</span></div>
          <strong>{item.percentage}%</strong>
        </li>)}</ul>}
    </div>
  </div>;
}
