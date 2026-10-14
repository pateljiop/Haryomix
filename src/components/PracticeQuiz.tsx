import { useEffect, useMemo, useRef, useState } from "react";
import { parseQuizAttempts } from "../lib/quiz-progress";

const PROGRESS_STORAGE_KEY = "haryomix.practice-quiz.history.v1";

import { questionSets, trackLabels, type Track } from "../lib/practice-questions";

function formatTime(seconds: number) {
  return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
}

export function PracticeQuiz() {
  const [track, setTrack] = useState<Track>("school");
  const [mode, setMode] = useState<"topic" | "practice">("topic");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("English");
  const [difficulty, setDifficulty] = useState("medium");
  const [researchBusy, setResearchBusy] = useState(false);
  const [researchError, setResearchError] = useState("");
  const [researchQuiz, setResearchQuiz] = useState<{ question: string; options: string[]; answer: number; explanation: string; sourceTitle: string; sourceUrl: string }[]>([]);
  const [researchSources, setResearchSources] = useState<{ title: string; url: string; extract: string }[]>([]);
  const [researchAnswers, setResearchAnswers] = useState<Record<number, number>>({});
  const [researchSubmitted, setResearchSubmitted] = useState(false);
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

  async function generateTopicQuiz(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (topic.trim().length < 3 || researchBusy) return;
    setResearchBusy(true); setResearchError(""); setResearchQuiz([]); setResearchSources([]); setResearchAnswers({}); setResearchSubmitted(false);
    try {
      const response = await fetch("/api/quiz", { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify({ topic: topic.trim(), language, difficulty }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : `Quiz generation failed (HTTP ${response.status}).`);
      if (!Array.isArray(data?.questions) || data.questions.length !== 10 || !Array.isArray(data?.sources)) throw new Error("The quiz service returned an incomplete result. Please retry.");
      setResearchQuiz(data.questions); setResearchSources(data.sources);
    } catch (error) { setResearchError(error instanceof Error ? error.message : "Could not generate a quiz. Please retry."); }
    finally { setResearchBusy(false); }
  }
  const researchScore = researchQuiz.reduce((sum, q, index) => sum + (researchAnswers[index] === q.answer ? 1 : 0), 0);

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

  if (mode === "topic") return <div className="hmx-panel">
    <div className="hmx-panel-head"><div><p className="hmx-page-eyebrow">SEARCH · VERIFY · PRACTISE</p><h2>Topic Research Quiz</h2><p className="hmx-planner-subtitle">Enter a topic. Haryomix searches reference content first, then creates a source-linked quiz from the material it found.</p></div><span className="hmx-planner-local">WEB-RESEARCHED</span></div>
    <div className="hmx-panel-body">
      <div className="hmx-btn-row" style={{marginBottom:18}}><button type="button" className="hmx-btn primary" onClick={() => setMode("topic")}>Research a topic</button><button type="button" className="hmx-btn" onClick={() => setMode("practice")}>Local practice sets</button></div>
      <form onSubmit={generateTopicQuiz} className="hmx-result" style={{marginTop:0}}>
        <div className="hmx-field"><label htmlFor="hmx-quiz-topic">Topic or chapter</label><input id="hmx-quiz-topic" className="hmx-input" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Indian Constitution: Fundamental Rights" minLength={3} maxLength={180} required disabled={researchBusy}/></div>
        <div className="hmx-field"><label htmlFor="hmx-quiz-language">Quiz language</label><select id="hmx-quiz-language" className="hmx-select" value={language} onChange={e => setLanguage(e.target.value)} disabled={researchBusy}><option>English</option><option>Hindi</option><option>Hinglish</option></select></div>
        <div className="hmx-field"><label htmlFor="hmx-quiz-difficulty">Difficulty</label><select id="hmx-quiz-difficulty" className="hmx-select" value={difficulty} onChange={e => setDifficulty(e.target.value)} disabled={researchBusy}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
        <button type="submit" className="hmx-btn primary" disabled={researchBusy || topic.trim().length < 3}>{researchBusy ? "Searching content and writing quiz…" : "Search content & generate quiz ↗"}</button>
        {researchBusy && <p role="status" aria-live="polite">Step 1/2: searching reference sources. Step 2/2: building 10 MCQs from the found material.</p>}
      </form>
      {researchError && <div className="hmx-note" role="alert" style={{marginTop:16}}>{researchError}</div>}
      {researchQuiz.length > 0 && <section className="hmx-result" style={{marginTop:18}}>
        <div className="hmx-planner-list-head"><div><span className="hmx-planner-local">SOURCE-GROUNDED QUIZ</span><h3>{topic}</h3><p>10 MCQs · {language} · {difficulty} difficulty</p></div><strong>{researchSubmitted ? `${researchScore}/${researchQuiz.length}` : `${Object.keys(researchAnswers).length}/${researchQuiz.length} answered`}</strong></div>
        {!researchSubmitted && <p>Choose one answer for every question, then submit to unlock explanations.</p>}
        {researchQuiz.map((q,index)=><article key={q.question + index} className="hmx-result" style={{marginTop:14}}>
          <strong>{index+1}. {q.question}</strong>
          <div className="hmx-tool-directory" role="group" aria-label={`Question ${index+1} options`} style={{marginTop:10}}>
            {q.options.map((option,optionIndex)=><button key={optionIndex} type="button" className="hmx-directory-card" disabled={researchSubmitted} aria-pressed={researchAnswers[index]===optionIndex} onClick={()=>setResearchAnswers(prev=>({...prev,[index]:optionIndex}))} style={{borderColor:researchAnswers[index]===optionIndex?"var(--hm-blue, #4f46e5)":undefined,boxShadow:researchAnswers[index]===optionIndex?"0 0 0 1px var(--hm-blue, #4f46e5)":undefined}}><span className="hmx-directory-card-top"><span className="hmx-directory-icon">{String.fromCharCode(65+optionIndex)}</span></span><strong>{option}</strong></button>)}
          </div>
          {researchSubmitted && <div className="hmx-note" style={{marginTop:10}}><p><strong>Correct answer:</strong> {q.options[q.answer]}</p><p>{q.explanation}</p><p>Reference: <a href={q.sourceUrl} target="_blank" rel="noreferrer">{q.sourceTitle}</a></p></div>}
        </article>)}
        {!researchSubmitted ? <button type="button" className="hmx-btn primary" style={{marginTop:18}} disabled={Object.keys(researchAnswers).length!==researchQuiz.length} onClick={()=>setResearchSubmitted(true)}>Submit answers & review ↗</button> : <><p style={{marginTop:16}}><strong>Score: {researchScore}/{researchQuiz.length} ({Math.round(researchScore/researchQuiz.length*100)}%)</strong></p><button type="button" className="hmx-btn primary" onClick={()=>void generateTopicQuiz()}>Generate another quiz ↻</button></>}
        <h3 style={{marginTop:24}}>Sources searched</h3><ul>{researchSources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><p>{source.extract.slice(0,260)}{source.extract.length>260?"…":""}</p></li>)}</ul>
      </section>}
    </div>
  </div>;

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
