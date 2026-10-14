import { useEffect, useMemo, useRef, useState } from "react";
import { parseQuizAttempts } from "../lib/quiz-progress";

const PROGRESS_STORAGE_KEY = "haryomix.practice-quiz.history.v1";

type Track = "school" | "graduation" | "competitive";
type Question = { prompt: string; options: string[]; answer: number; explanation: string };
const questionSets: Record<Track, Question[]> = {
  school: [
    { prompt: "What is 25% of 200?", options: ["25", "40", "50", "75"], answer: 2, explanation: "25% = 1/4, and 200 ÷ 4 = 50." },
    { prompt: "What is the SI unit of force?", options: ["Joule", "Newton", "Watt", "Pascal"], answer: 1, explanation: "Force is measured in newtons (N)." },
    { prompt: "Which process do green plants use to make food?", options: ["Respiration", "Photosynthesis", "Evaporation", "Fermentation"], answer: 1, explanation: "Photosynthesis uses light energy to make glucose from carbon dioxide and water." },
    { prompt: "Solve: 3x + 5 = 20.", options: ["3", "5", "7", "15"], answer: 1, explanation: "Subtract 5 to get 3x = 15, then divide by 3: x = 5." },
    { prompt: "Which is the largest planet in our Solar System?", options: ["Earth", "Saturn", "Jupiter", "Neptune"], answer: 2, explanation: "Jupiter is the largest planet in the Solar System." },
  ],
  graduation: [
    { prompt: "Which data structure follows FIFO order?", options: ["Stack", "Queue", "Tree", "Graph"], answer: 1, explanation: "A queue removes items in first-in, first-out order." },
    { prompt: "Which SQL command retrieves data from a table?", options: ["SELECT", "UPDATE", "INSERT", "DROP"], answer: 0, explanation: "SELECT reads rows and columns from one or more tables." },
    { prompt: "How many bits are in one byte?", options: ["4", "8", "16", "32"], answer: 1, explanation: "One byte contains eight bits." },
    { prompt: "Which OS component schedules processes for CPU time?", options: ["Compiler", "Scheduler", "Linker", "Loader only"], answer: 1, explanation: "The CPU scheduler chooses which ready process or thread runs next." },
    { prompt: "What is the time complexity of binary search on a sorted array?", options: ["O(1)", "O(log n)", "O(n)", "O(n²)"], answer: 1, explanation: "Binary search halves the remaining search interval at each step." },
  ],
  competitive: [
    { prompt: "Find the next number: 2, 4, 8, 16, __.", options: ["18", "24", "30", "32"], answer: 3, explanation: "Each term is multiplied by 2, so 16 × 2 = 32." },
    { prompt: "The average of 10, 20 and 30 is:", options: ["15", "20", "25", "30"], answer: 1, explanation: "(10 + 20 + 30) ÷ 3 = 20." },
    { prompt: "India celebrates Republic Day on:", options: ["15 August", "2 October", "26 January", "14 November"], answer: 2, explanation: "The Constitution of India came into effect on 26 January 1950." },
    { prompt: "A train covers 120 km in 2 hours. Its average speed is:", options: ["40 km/h", "50 km/h", "60 km/h", "80 km/h"], answer: 2, explanation: "Speed = distance ÷ time = 120 ÷ 2 = 60 km/h." },
    { prompt: "Choose the word closest in meaning to “brief”.", options: ["Concise", "Distant", "Heavy", "Unclear"], answer: 0, explanation: "Brief means short in duration or concise in wording." },
  ],
};

const trackLabels: Record<Track, string> = {
  school: "School · Class 6–12",
  graduation: "Graduation · University",
  competitive: "One-Day Competitive Exams",
};

function formatTime(seconds: number) {
  return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
}

export function PracticeQuiz() {
  const [track, setTrack] = useState<Track>("school");
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [remaining, setRemaining] = useState(600);
  const [saveNotice, setSaveNotice] = useState("");
  const savedSubmission = useRef(false);
  const questions = questionSets[track];
  const score = useMemo(() => questions.reduce((sum, question, index) => sum + (answers[index] === question.answer ? 1 : 0), 0), [questions, answers]);
  const answered = Object.keys(answers).length;
  const question = questions[current];

  useEffect(() => {
    if (!started || submitted) return;
    const timer = window.setInterval(() => setRemaining(seconds => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [started, submitted]);

  useEffect(() => {
    if (started && remaining === 0 && !submitted) {
      setStarted(false);
      setSubmitted(true);
    }
  }, [remaining, started, submitted]);

  useEffect(() => {
    if (!submitted || savedSubmission.current) return;
    savedSubmission.current = true;
    const attempt = {
      id: typeof window.crypto?.randomUUID === "function" ? window.crypto.randomUUID() : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10),
      track,
      score,
      total: questions.length,
      answered,
      percentage: Math.round(score / questions.length * 100),
      completedAt: Date.now(),
      remainingSeconds: remaining,
    };
    try {
      const history = parseQuizAttempts(window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? "[]");
      window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify([...history, attempt].slice(-1000)));
      setSaveNotice("Result saved to your local Progress Tracker.");
    } catch {
      setSaveNotice("Your result is shown, but browser storage could not save this attempt.");
    }
  }, [submitted, track, score, questions.length, answered, remaining]);

  function startTest() {
    savedSubmission.current = false;
    setSaveNotice("");
    setAnswers({});
    setCurrent(0);
    setRemaining(600);
    setSubmitted(false);
    setStarted(true);
  }

  function submitTest() {
    setStarted(false);
    setSubmitted(true);
  }

  function changeTrack(value: Track) {
    savedSubmission.current = false;
    setSaveNotice("");
    setTrack(value);
    setAnswers({});
    setCurrent(0);
    setRemaining(600);
    setStarted(false);
    setSubmitted(false);
  }

  return <div className="hmx-panel">
    <div className="hmx-panel-head">
      <div><p className="hmx-page-eyebrow">PRACTICE · CHECK · IMPROVE</p><h2>Practice Quiz</h2><p className="hmx-planner-subtitle">A focused, timed MCQ session with scoring and answer explanations.</p></div>
      <span className="hmx-planner-local">WORKS LOCALLY</span>
    </div>
    <div className="hmx-panel-body">
      <div className="hmx-note">This starter question set is for practice, not an official past paper. Check official syllabus and exam notifications for exam-specific coverage.</div>
      {saveNotice && <div className="hmx-note" role="status" aria-live="polite">{saveNotice}</div>}
      <div className="hmx-field" style={{ maxWidth: 520 }}>
        <label htmlFor="hmx-quiz-track">Preparation track</label>
        <select id="hmx-quiz-track" className="hmx-select" value={track} disabled={started} onChange={event => changeTrack(event.target.value as Track)}>
          <option value="school">School · Class 6–12</option>
          <option value="graduation">Graduation · University</option>
          <option value="competitive">One-Day Competitive Exams</option>
        </select>
      </div>
      {!started && !submitted && <div className="hmx-result" style={{ marginTop: 18 }}>
        <h3>{trackLabels[track]} practice</h3>
        <p>{questions.length} multiple-choice questions · 10 minutes · instant explanations after submission.</p>
        <button type="button" className="hmx-btn primary" onClick={startTest}>Start practice test ↗</button>
      </div>}
      {started && question && <div className="hmx-result" style={{ marginTop: 18 }}>
        <div className="hmx-planner-list-head">
          <div><span className="hmx-planner-local">QUESTION {current + 1} OF {questions.length}</span><h3>{trackLabels[track]}</h3></div>
          <strong aria-label="Time remaining">{formatTime(remaining)}</strong>
        </div>
        <div style={{ height: 6, background: "var(--hm-line, #dfe4f2)", borderRadius: 99, overflow: "hidden", margin: "12px 0 20px" }}><div style={{ height: "100%", width: ((current + 1) / questions.length * 100) + "%", background: "var(--hm-blue, #4f46e5)" }} /></div>
        <h3>{question.prompt}</h3>
        <div className="hmx-tool-directory" role="group" aria-label="Answer options">
          {question.options.map((option, index) => <button key={option} type="button" className="hmx-directory-card" aria-pressed={answers[current] === index} onClick={() => setAnswers(previous => ({ ...previous, [current]: index }))} style={{ borderColor: answers[current] === index ? "var(--hm-blue, #4f46e5)" : undefined, boxShadow: answers[current] === index ? "0 0 0 1px var(--hm-blue, #4f46e5)" : undefined }}>
            <span className="hmx-directory-card-top"><span className="hmx-directory-icon">{String.fromCharCode(65 + index)}</span></span><strong>{option}</strong>
          </button>)}
        </div>
        <div className="hmx-planner-list-head" style={{ marginTop: 20 }}>
          <span>{answered} of {questions.length} answered</span>
          <div className="hmx-btn-row">
            <button type="button" className="hmx-btn" onClick={() => setCurrent(index => Math.max(0, index - 1))} disabled={current === 0}>← Previous</button>
            {current < questions.length - 1
              ? <button type="button" className="hmx-btn primary" onClick={() => setCurrent(index => Math.min(questions.length - 1, index + 1))}>Next question →</button>
              : <button type="button" className="hmx-btn primary" onClick={submitTest}>Submit test ✓</button>}
          </div>
        </div>
      </div>}
      {submitted && <div className="hmx-result" style={{ marginTop: 18 }}>
        <span className="hmx-planner-local">TEST COMPLETE</span>
        <h3>{score} / {questions.length} correct</h3>
        <p>{Math.round(score / questions.length * 100)}% score · {answered} of {questions.length} answered · {remaining === 0 ? "Time expired." : "Review the explanations and try again."}</p>
        <div className="hmx-planner-stats">
          <div className="hmx-planner-stat"><span>Correct</span><strong>{score}</strong></div>
          <div className="hmx-planner-stat"><span>Incorrect / skipped</span><strong>{questions.length - score}</strong></div>
          <div className="hmx-planner-stat"><span>Accuracy</span><strong>{Math.round(score / questions.length * 100)}%</strong></div>
        </div>
        <h3 style={{ marginTop: 22 }}>Answer review</h3>
        <div className="hmx-library-list">
          {questions.map((item, index) => <article className="hmx-result" key={item.prompt} style={{ marginTop: 12, borderColor: answers[index] === item.answer ? "var(--hm-blue, #4f46e5)" : undefined }}>
            <strong>{index + 1}. {item.prompt}</strong>
            <p>Your answer: {answers[index] === undefined ? "Not answered" : item.options[answers[index]]}</p>
            <p>Correct answer: <strong>{item.options[item.answer]}</strong></p>
            <p>{item.explanation}</p>
          </article>)}
        </div>
        <button type="button" className="hmx-btn primary" style={{ marginTop: 18 }} onClick={startTest}>Try another test ↻</button>
      </div>}
    </div>
  </div>;
}
