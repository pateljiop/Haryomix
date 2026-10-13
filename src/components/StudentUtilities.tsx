import { useMemo, useState } from "react";
import {
  calculateAttendance,
  calculateCgpa,
  calculatePercentage,
  countText,
  decodeUrlComponent,
  encodeUrlComponent,
  formatJson,
} from "../lib/student-utilities";

type UtilityTab = "marks" | "attendance" | "text" | "json" | "url";
const tabs: { id: UtilityTab; label: string }[] = [
  { id: "marks", label: "Marks & CGPA" },
  { id: "attendance", label: "Attendance" },
  { id: "text", label: "Text counter" },
  { id: "json", label: "JSON tool" },
  { id: "url", label: "URL encoder" },
];

export function StudentUtilities() {
  const [tab, setTab] = useState<UtilityTab>("marks");
  const [obtained, setObtained] = useState("420");
  const [total, setTotal] = useState("500");
  const [subjects, setSubjects] = useState([
    { name: "Subject 1", credits: "4", gradePoint: "9" },
    { name: "Subject 2", credits: "3", gradePoint: "8" },
    { name: "Subject 3", credits: "4", gradePoint: "8.5" },
  ]);
  const [present, setPresent] = useState("36");
  const [held, setHeld] = useState("42");
  const [target, setTarget] = useState("75");
  const [text, setText] = useState("");
  const [jsonInput, setJsonInput] = useState('{\n  "student": "Hariom",\n  "subjects": ["Programming", "Database"],\n  "active": true\n}');
  const [jsonOutput, setJsonOutput] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [compact, setCompact] = useState(false);
  const [urlInput, setUrlInput] = useState("Haryomix student workspace & tools");
  const [urlOutput, setUrlOutput] = useState("");
  const [urlMode, setUrlMode] = useState<"encode" | "decode">("encode");
  const [marksError, setMarksError] = useState("");
  const [cgpaError, setCgpaError] = useState("");
  const [attendanceError, setAttendanceError] = useState("");
  const textStats = useMemo(() => countText(text), [text]);
  let percentage: number | null = null;
  let cgpa: number | null = null;
  let attendance: ReturnType<typeof calculateAttendance> | null = null;
  try { percentage = calculatePercentage(Number(obtained), Number(total)); } catch {}
  try { cgpa = calculateCgpa(subjects.map(subject => ({ credits: Number(subject.credits), gradePoint: Number(subject.gradePoint) }))); } catch {}
  try { attendance = calculateAttendance(Number(present), Number(held), Number(target)); } catch {}

  function updateSubject(index: number, key: "name" | "credits" | "gradePoint", value: string) {
    setSubjects(current => current.map((subject, i) => i === index ? { ...subject, [key]: value } : subject));
  }

  return <div className="hmx-student-utilities">
    <div className="hmx-panel">
      <div className="hmx-panel-head">
        <div><h2>Student Utility Hub</h2><p className="hmx-utility-subtitle">Quick calculations and text tools. Everything here runs locally in your browser.</p></div>
        <span className="hmx-planner-local">LOCAL TOOLS</span>
      </div>
      <div className="hmx-panel-body">
        <div className="hmx-utility-tabs" role="tablist" aria-label="Student utilities">
          {tabs.map(item => <button type="button" role="tab" aria-selected={tab === item.id} key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}
        </div>

        {tab === "marks" && <div className="hmx-utility-section">
          <div className="hmx-utility-section-head"><div><h3>Marks percentage</h3><p>Enter marks obtained and total possible marks.</p></div><div className="hmx-utility-result"><strong>{percentage === null ? "—" : percentage + "%"}</strong><span>Percentage</span></div></div>
          <div className="hmx-utility-fields"><label>Marks obtained<input className="hmx-input" type="number" min="0" value={obtained} onChange={e => setObtained(e.target.value)}/></label><label>Total marks<input className="hmx-input" type="number" min="1" value={total} onChange={e => setTotal(e.target.value)}/></label></div>
          {percentage === null && <p className="hmx-utility-error" role="alert">Enter valid marks; obtained marks cannot exceed total marks.</p>}
          <div className="hmx-divider"/>
          <div className="hmx-utility-section-head"><div><h3>Credit-weighted CGPA</h3><p>Use the grade-point scale and credit values defined by your institution.</p></div><div className="hmx-utility-result"><strong>{cgpa === null ? "—" : cgpa.toFixed(2)}</strong><span>Estimated CGPA</span></div></div>
          <div className="hmx-utility-subjects">{subjects.map((subject, index) => <div className="hmx-utility-subject" key={index}><label>Subject<input className="hmx-input" value={subject.name} maxLength={60} onChange={e => updateSubject(index, "name", e.target.value)}/></label><label>Credits<input className="hmx-input" type="number" min="0.1" max="100" step="0.5" value={subject.credits} onChange={e => updateSubject(index, "credits", e.target.value)}/></label><label>Grade point<input className="hmx-input" type="number" min="0" max="10" step="0.1" value={subject.gradePoint} onChange={e => updateSubject(index, "gradePoint", e.target.value)}/></label><button type="button" className="hmx-btn" aria-label={"Remove " + subject.name} disabled={subjects.length <= 1} onClick={() => setSubjects(current => current.filter((_, i) => i !== index))}>Remove</button></div>)}</div>
          <div className="hmx-btn-row"><button type="button" className="hmx-btn" onClick={() => setSubjects(current => current.length >= 12 ? current : [...current, { name: "Subject " + (current.length + 1), credits: "3", gradePoint: "8" }])} disabled={subjects.length >= 12}>+ Add subject</button><span className="hmx-utility-footnote">Maximum 12 subjects · CGPA is an estimate, not an official university result.</span></div>
          {cgpa === null && <p className="hmx-utility-error" role="alert">Use positive credits and grade points from 0 to 10.</p>}
        </div>}

        {tab === "attendance" && <div className="hmx-utility-section">
          <div className="hmx-utility-section-head"><div><h3>Attendance planner</h3><p>Calculate your current attendance, classes needed to reach a target and safe skips.</p></div><div className="hmx-utility-result"><strong>{attendance ? attendance.currentPercent + "%" : "—"}</strong><span>Current attendance</span></div></div>
          <div className="hmx-utility-fields hmx-utility-fields-three"><label>Classes attended<input className="hmx-input" type="number" min="0" step="1" value={present} onChange={e => setPresent(e.target.value)}/></label><label>Classes held<input className="hmx-input" type="number" min="1" step="1" value={held} onChange={e => setHeld(e.target.value)}/></label><label>Target %<input className="hmx-input" type="number" min="1" max="100" step="1" value={target} onChange={e => setTarget(e.target.value)}/></label></div>
          {attendance ? <div className="hmx-utility-answer-grid"><div><span>Classes to attend in a row</span><strong>{attendance.classesNeededToReachTarget === null ? "Not possible" : attendance.classesNeededToReachTarget}</strong><small>{attendance.classesNeededToReachTarget === null ? "If you have already missed a class, future attendance alone cannot restore 100%." : "Assuming every upcoming class is attended."}</small></div><div><span>Classes you can still skip</span><strong>{attendance.classesCanSkip}</strong><small>Approximate skips before falling below your target.</small></div></div> : <p className="hmx-utility-error" role="alert">Enter whole class counts with attended no greater than held, and a target between 1% and 100%.</p>}
        </div>}

        {tab === "text" && <div className="hmx-utility-section">
          <div className="hmx-utility-section-head"><div><h3>Text & word counter</h3><p>Count words, characters, lines and approximate reading time.</p></div><button className="hmx-btn" type="button" onClick={() => setText("")}>Clear text</button></div>
          <textarea className="hmx-textarea hmx-utility-textarea" value={text} onChange={e => setText(e.target.value)} maxLength={200000} placeholder="Paste assignment text, notes or an essay here…"/>
          <div className="hmx-utility-stat-grid"><div><strong>{textStats.words.toLocaleString()}</strong><span>Words</span></div><div><strong>{textStats.characters.toLocaleString()}</strong><span>Characters</span></div><div><strong>{textStats.charactersWithoutSpaces.toLocaleString()}</strong><span>No whitespace</span></div><div><strong>{textStats.lines.toLocaleString()}</strong><span>Lines</span></div><div><strong>{textStats.readingMinutes} min</strong><span>Reading time</span></div></div>
          <p className="hmx-utility-footnote">Reading time assumes about 200 words per minute. Actual speed varies by reader and content.</p>
        </div>}

        {tab === "json" && <div className="hmx-utility-section">
          <div className="hmx-utility-section-head"><div><h3>JSON formatter & validator</h3><p>Validate JSON and format it for assignments, APIs or debugging.</p></div><div className="hmx-btn-row"><button type="button" className={"hmx-btn " + (!compact ? "primary" : "")} onClick={() => setCompact(false)}>Pretty</button><button type="button" className={"hmx-btn " + (compact ? "primary" : "")} onClick={() => setCompact(true)}>Compact</button></div></div>
          <label className="hmx-utility-block-label">Input JSON<textarea className="hmx-textarea hmx-utility-textarea" spellCheck={false} value={jsonInput} onChange={e => { setJsonInput(e.target.value); setJsonError(""); setJsonOutput(""); }}/></label>
          <div className="hmx-btn-row"><button type="button" className="hmx-btn primary" onClick={() => { try { setJsonOutput(formatJson(jsonInput, compact)); setJsonError(""); } catch (error) { setJsonOutput(""); setJsonError(error instanceof Error ? error.message : "Could not format JSON."); } }}>Validate & format</button><button type="button" className="hmx-btn" onClick={() => { setJsonInput(""); setJsonOutput(""); setJsonError(""); }}>Clear</button><button type="button" className="hmx-btn" disabled={!jsonOutput} onClick={() => void navigator.clipboard?.writeText(jsonOutput).catch(() => setJsonError("Clipboard access was blocked by the browser."))}>Copy result</button></div>
          {jsonError && <p className="hmx-utility-error" role="alert">{jsonError}</p>}
          {jsonOutput && <label className="hmx-utility-block-label">Formatted result<textarea className="hmx-textarea hmx-utility-textarea" readOnly value={jsonOutput}/></label>}
        </div>}

        {tab === "url" && <div className="hmx-utility-section">
          <div className="hmx-utility-section-head"><div><h3>URL component encoder</h3><p>Encode or decode text for query parameters and URLs.</p></div><div className="hmx-btn-row"><button type="button" className={"hmx-btn " + (urlMode === "encode" ? "primary" : "")} onClick={() => { setUrlMode("encode"); setUrlOutput(""); }}>Encode</button><button type="button" className={"hmx-btn " + (urlMode === "decode" ? "primary" : "")} onClick={() => { setUrlMode("decode"); setUrlOutput(""); }}>Decode</button></div></div>
          <label className="hmx-utility-block-label">Input<textarea className="hmx-textarea hmx-utility-textarea" value={urlInput} onChange={e => { setUrlInput(e.target.value); setUrlOutput(""); }}/></label>
          <div className="hmx-btn-row"><button type="button" className="hmx-btn primary" onClick={() => { try { setUrlOutput(urlMode === "encode" ? encodeUrlComponent(urlInput) : decodeUrlComponent(urlInput)); setJsonError(""); } catch (error) { setUrlOutput(error instanceof Error ? error.message : "Could not process URL text."); } }}>Process text</button><button type="button" className="hmx-btn" onClick={() => setUrlInput("")}>Clear</button></div>
          {urlOutput && <label className="hmx-utility-block-label">Result<textarea className="hmx-textarea hmx-utility-textarea" readOnly value={urlOutput}/></label>}
        </div>}
      </div>
    </div>
  </div>;
}
