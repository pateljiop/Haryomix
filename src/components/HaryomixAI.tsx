import { useState } from "react";

type Task = "code" | "study" | "ppt" | "general";
type Provider = "auto" | "groq" | "gemini";

export function HaryomixAI() {
  const [task, setTask] = useState<Task>("code");
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<Provider>("auto");
  const [answer, setAnswer] = useState("");
  const [usedProvider, setUsedProvider] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy || prompt.trim().length < 3) return;
    setBusy(true);
    setError("");
    setAnswer("");
    setUsedProvider("");
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, prompt: prompt.trim(), provider }),
      });
      const data = await response.json() as { answer?: string; provider?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "AI request failed.");
      setAnswer(data.answer || "");
      setUsedProvider(data.provider || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI request failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="hmx-panel" aria-label="Haryomix AI assistant">
    <div className="hmx-panel-head"><h2>Haryomix AI</h2><span style={{fontSize:11,color:"#7a8292"}}>Groq + Gemini</span></div>
    <div className="hmx-panel-body">
      <div className="hmx-note" style={{marginBottom:16}}>AI responses come from a server-side provider. Do not paste passwords, API keys, or private personal data.</div>
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
        <label htmlFor="hmx-ai-provider">AI provider</label>
        <select id="hmx-ai-provider" className="hmx-select" value={provider} onChange={e=>setProvider(e.target.value as Provider)}>
          <option value="auto">Automatic (Groq, then Gemini)</option>
          <option value="groq">Prefer Groq</option>
          <option value="gemini">Prefer Gemini</option>
        </select>
      </div>
      <div className="hmx-field">
        <label htmlFor="hmx-ai-prompt">{task === "code" ? "Paste code or describe the bug" : task === "study" ? "Enter subject, topic, or question" : task === "ppt" ? "Describe your presentation topic" : "What would you like help with?"}</label>
        <textarea id="hmx-ai-prompt" className="hmx-textarea" value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={12000} placeholder={task === "code" ? "Paste code, exact error message, and what you expected…" : task === "study" ? "Example: Explain DBMS normalization with examples and quiz me…" : task === "ppt" ? "Example: Make an 8-slide outline on computer networks for BCA…" : "Ask a question or describe your task…"} />
        <p style={{fontSize:11,color:"#7a8292",marginTop:6}}>{prompt.length}/12000 characters</p>
      </div>
      <div className="hmx-btn-row"><button className="hmx-btn primary" disabled={busy || prompt.trim().length < 3} onClick={submit}>{busy ? "Thinking…" : "Ask Haryomix AI ↗"}</button><button className="hmx-btn" disabled={busy} onClick={()=>{setPrompt("");setAnswer("");setError("");setUsedProvider("")}}>Clear</button></div>
      {error && <div className="hmx-note" role="alert" style={{marginTop:16}}>{error}</div>}
      {answer && <div className="hmx-result" style={{marginTop:18}}><h3>AI response <span style={{fontSize:11,fontWeight:500,color:"#7a8292"}}>· {usedProvider}</span></h3><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontFamily:"inherit",fontSize:14,lineHeight:1.7}}>{answer}</pre><button className="hmx-btn" onClick={()=>navigator.clipboard.writeText(answer).catch(()=>setError("Clipboard access was blocked by your browser."))}>Copy response</button></div>}
    </div>
  </section>;
}
