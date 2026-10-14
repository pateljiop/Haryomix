import { useState } from "react";

type LearningTool = "exam" | "quiz" | "progress" | "notes" | "flashcards" | "focus" | "utilities";
type TrackId = "school" | "graduation" | "competitive";

const tracks: { id: TrackId; title: string; eyebrow: string; description: string; options: string[] }[] = [
  { id: "school", title: "School learning · Class 6–12", eyebrow: "SCHOOL", description: "Chapter revision, concept explanations and board-exam practice for middle and senior school.", options: ["Class 6–8", "Class 9–10", "Class 11–12"] },
  { id: "graduation", title: "Graduation & university", eyebrow: "COLLEGE", description: "Prepare by course, semester, subject and unit for university exams.", options: ["BCA / Computer Applications", "BSc / Science", "BA / BCom", "BTech / Diploma"] },
  { id: "competitive", title: "One-Day Competitive Exams", eyebrow: "COMPETITIVE", description: "Build a practice routine for objective exams with timed revision and focused topic work.", options: ["Railway / RRB", "SSC", "Banking", "State-level exams"] },
];

const tools: { id: LearningTool; title: string; description: string; icon: string; label: string }[] = [
  { id: "exam", title: "Exam Copilot", description: "Turn a topic into revision notes and explanations.", icon: "✳", label: "Create study material" },
  { id: "quiz", title: "Practice Quiz", description: "Take a timed MCQ test, see your score and review every answer.", icon: "✓", label: "Start a practice test" },
  { id: "progress", title: "Progress Tracker", description: "Track saved quiz attempts, average score and results by learning track.", icon: "↗", label: "Review progress" },
  { id: "notes", title: "Smart Notes", description: "Write and organize notes, then search or export them from this browser.", icon: "▤", label: "Open notes" },
  { id: "flashcards", title: "Flashcards", description: "Practice definitions, formulas and facts using active recall.", icon: "▧", label: "Practice recall" },
  { id: "focus", title: "Focus Timer", description: "Run focused study sessions with short breaks between them.", icon: "◷", label: "Start focus" },
  { id: "utilities", title: "Student Utilities", description: "Calculate marks, attendance and CGPA, and use practical study utilities.", icon: "⌘", label: "Open utilities" },
];

export function ExamCenter({ onNavigate }: { onNavigate: (tool: LearningTool) => void }) {
  const [track, setTrack] = useState<TrackId>("school");
  const [level, setLevel] = useState("Class 9–10");
  const selected = tracks.find(item => item.id === track) ?? tracks[0];

  function chooseTrack(id: TrackId) {
    setTrack(id);
    const next = tracks.find(item => item.id === id);
    if (next) setLevel(next.options[0]);
  }

  return <div className="hmx-panel">
    <div className="hmx-panel-head">
      <div><p className="hmx-page-eyebrow">LEARN · PRACTICE · REVISE</p><h2>Exam Center</h2><p className="hmx-planner-subtitle">One starting point for school, graduation and competitive-exam preparation.</p></div>
      <span className="hmx-planner-local">STUDENT HUB</span>
    </div>
    <div className="hmx-panel-body">
      <div className="hmx-note">Choose your learning track first. Then open the specific tool you need. Basic notes and utility tools work locally; AI-assisted content is only used when you choose a tool that needs it.</div>
      <div className="hmx-tool-directory" aria-label="Choose a learning track">
        {tracks.map(item => <button key={item.id} type="button" className="hmx-directory-card" aria-pressed={track === item.id} onClick={() => chooseTrack(item.id)} style={{ borderColor: track === item.id ? "var(--hm-blue, #4f46e5)" : undefined, boxShadow: track === item.id ? "0 0 0 1px var(--hm-blue, #4f46e5)" : undefined }}>
          <span className="hmx-directory-card-top"><span className="hmx-directory-icon">{item.id === "school" ? "▤" : item.id === "graduation" ? "⌂" : "◎"}</span><span className="hmx-directory-number">{item.eyebrow}</span></span>
          <strong>{item.title}</strong>
          <span className="hmx-directory-description">{item.description}</span>
          <span className="hmx-directory-open">{track === item.id ? "Selected" : "Choose track"} <span aria-hidden="true">↗</span></span>
        </button>)}
      </div>
      <div className="hmx-result" style={{ marginTop: 18 }}>
        <h3>{selected.title}</h3>
        <p>{selected.description}</p>
        <div className="hmx-btn-row" role="group" aria-label="Choose class, course or exam">
          {selected.options.map(option => <button key={option} type="button" className={level === option ? "hmx-btn primary" : "hmx-btn"} aria-pressed={level === option} onClick={() => setLevel(option)}>{option}</button>)}
        </div>
        <p className="hmx-planner-subtitle" style={{ marginTop: 12 }}>Selected: <strong>{level}</strong>. Use this selection to guide your next study session; detailed official syllabus mapping will be added per course and exam.</p>
      </div>
      <div className="hmx-planner-list-head"><div><h3>Study tools</h3><p>Each tool opens in its own focused workspace.</p></div></div>
      <div className="hmx-tool-directory" aria-label="Study tools">
        {tools.map(tool => <button key={tool.id} type="button" className="hmx-directory-card" onClick={() => onNavigate(tool.id)}>
          <span className="hmx-directory-card-top"><span className="hmx-directory-icon">{tool.icon}</span><span className="hmx-directory-number">TOOL</span></span>
          <strong>{tool.title}</strong>
          <span className="hmx-directory-description">{tool.description}</span>
          <span className="hmx-directory-open">{tool.label} <span aria-hidden="true">↗</span></span>
        </button>)}
      </div>
      <p className="hmx-planner-subtitle" style={{ marginTop: 18 }}>Tip: verify syllabus, exam pattern and current-affairs facts against official sources before relying on them.</p>
    </div>
  </div>;
}
