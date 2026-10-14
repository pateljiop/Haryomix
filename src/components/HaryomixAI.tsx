import { useState } from "react";

type Task = "code" | "study" | "ppt" | "general";

export function HaryomixAI() {
  const [task, setTask] = useState<Task>("code");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy || prompt.trim().length < 3) return;
    setBusy(true);
    setError("");
    setAnswer("");
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, prompt: prompt.trim(), provider: "auto" }),
      });
      const data = await response.json() as {
        answer?: string;
        error?: string;
        code?: string;
        providerIssues?: Array<{ provider?: string; reason?: string }>;
      };
      if (!response.ok) {
        const issues = Array.isArray(data.providerIssues)
          ? data.providerIssues
              .filter(issue => typeof issue.provider === "string" && typeof issue.reason === "string")
              .map(issue => `${issue.provider}: ${issue.reason?.replaceAll("_", " ")}`)
          : [];
        const details = issues.length ? ` Details: ${issues.join("; ")}.` : "";
        throw new Error(`${data.error || "AI request failed."}${details}`);
      }
      setAnswer(data.answer || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI request failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="hmx-panel" aria-label="Haryomix AI assistant">
    <div className="hmx-panel-head"><h2>Haryomix AI</h2><span style={{fontSize:11,color:"#7a8292"}}>Study · Code · Writing</span></div>
    <div className="hmx-panel-body">
      <div className="hmx-note" style={{marginBottom:16}}>Your request is handled by Haryomix. Do not paste passwords, API keys, or private personal data.</div>
      <div className="hmx-field">
        <label htmlFor="hmx-ai-task">What do you need help with?</label>
        <select id="hmx-ai-task" className="hmx-select" value={task} onChange={e=>setTask(e.target.value as Task)}>
          <option value="code">Code Doctor — debug and explain code</option>
          <option value="study">Exam Copilot — study and revision</option>
          <option value="ppt">PPT Studio — presentation outline</option>
          <option value="general">General assistant</option>
        </select>
      </div>
      <div className="hmx-field">
        <label htmlFor="hmx-ai-prompt">{task === "code" ? "Paste code or describe the bug" : task === "study" ? "Enter subject, topic, or question" : task === "ppt" ? "Describe your presentation topic" : "What would you like help with?"}</label>
        <textarea id="hmx-ai-prompt" className="hmx-textarea" value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={12000} placeholder={task === "code" ? "Paste code, exact error message, and what you expected…" : task === "study" ? "Example: Explain DBMS normalization with examples and quiz me…" : task === "ppt" ? "Example: Make an 8-slide outline on computer networks for BCA…" : "Ask a question or describe your task…"} />
        <p style={{fontSize:11,color:"#7a8292",marginTop:6}}>{prompt.length}/12000 characters</p>
      </div>
      <div className="hmx-btn-row"><button className="hmx-btn primary" disabled={busy || prompt.trim().length < 3} onClick={submit}>{busy ? "Thinking…" : "Ask Haryomix AI ↗"}</button><button className="hmx-btn" disabled={busy} onClick={()=>{setPrompt("");setAnswer("");setError("")}}>Clear</button></div>
      {error && <div className="hmx-note" role="alert" style={{marginTop:16}}>{error}</div>}
      {answer && <div className="hmx-result" style={{marginTop:18}}><h3>Response</h3><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontFamily:"inherit",fontSize:14,lineHeight:1.7}}>{answer}</pre><button className="hmx-btn" onClick={()=>navigator.clipboard.writeText(answer).catch(()=>setError("Clipboard access was blocked by your browser."))}>Copy response</button></div>}
    </div>
  </section>;
}
