import { useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { createWorker } from "tesseract.js";

type Props = { onUseExtractedText?: (text: string) => void };
type Analysis = { text: string; accent: string; layout: "single" | "two-column"; sections: { title: string; body: string }[] };

const headings = ["profile", "summary", "objective", "education", "experience", "work experience", "projects", "skills", "technical skills", "certifications", "achievements", "languages", "interests", "internships", "publications", "awards", "contact"];
const titleCase = (value: string) => value.replace(/\b\w/g, c => c.toUpperCase());
function parseSections(text: string) {
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const result: { title: string; body: string }[] = [];
  let title = "Profile";
  let body: string[] = [];
  for (const line of lines) {
    const normalized = line.toLowerCase().replace(/[:：]$/, "").trim();
    const isHeading = headings.includes(normalized) || headings.some(h => normalized === h + "s");
    if (isHeading && body.length) { result.push({ title, body: body.join("\n") }); body = []; title = titleCase(normalized); }
    else if (isHeading && !body.length) title = titleCase(normalized);
    else body.push(line);
  }
  if (body.length) result.push({ title, body: body.join("\n") });
  return result.length ? result : [{ title: "Extracted content", body: text }];
}
function sampleAccent(dataUrl: string): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas"); canvas.width = 40; canvas.height = 40;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve("#2563eb");
        ctx.drawImage(img, 0, 0, 40, 40);
        const pixels = ctx.getImageData(0, 0, 40, 40).data;
        let best = { score: 0, color: "#2563eb" };
        for (let i = 0; i < pixels.length; i += 16) {
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const saturation = max ? (max - min) / max : 0;
          if (max > 65 && max < 235 && saturation > 0.38) {
            const score = saturation * (1 - Math.abs(150 - max) / 255);
            if (score > best.score) best = { score, color: "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("") };
          }
        }
        resolve(best.color);
      } catch { resolve("#2563eb"); }
    };
    img.onerror = () => resolve("#2563eb"); img.src = dataUrl;
  });
}
async function fileToImage(file: File): Promise<string> {
  if (file.type.startsWith("image/")) return await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Could not read this image.")); reader.readAsDataURL(file);
  });
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error("Please upload a PNG, JPG, WEBP or PDF file.");
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.8 });
  const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not prepare the PDF preview.");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/png");
}

export function ResumeReferenceBuilder({ onUseExtractedText }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [accent, setAccent] = useState("#2563eb");
  const [layout, setLayout] = useState<"single" | "two-column">("single");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(true);

  async function processFile(file?: File) {
    if (!file) return;
    setError(""); setStatus(""); setAnalysis(null);
    if (file.size > 12 * 1024 * 1024) { setError("File size limit is 12 MB. Please choose a smaller reference."); return; }
    if (!(file.type.startsWith("image/") || file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) { setError("Supported formats: PNG, JPG, WEBP and PDF."); return; }
    setBusy(true); setFileName(file.name);
    try {
      const preview = await fileToImage(file);
      setImageUrl(preview);
      const detectedAccent = await sampleAccent(preview); setAccent(detectedAccent);
      setStatus("Reading the reference locally in your browser…");
      const worker = await createWorker("eng");
      try {
        const result = await worker.recognize(preview);
        const text = result.data.text.trim();
        if (!text) throw new Error("No readable text was detected. Try a sharper image or a text-based PDF.");
        const sections = parseSections(text);
        const nextLayout = /sidebar|two.column|contact.*skills/s.test(text.toLowerCase()) ? "two-column" : "single";
        setLayout(nextLayout); setAnalysis({ text, accent: detectedAccent, layout: nextLayout, sections });
        setStatus("Reference analysed. Check the extracted text and edit any OCR mistakes below.");
      } finally { await worker.terminate(); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyse this file. Please try another image or PDF.");
      setStatus("");
    } finally { setBusy(false); }
  }

  function updateText(value: string) {
    setAnalysis(old => old ? { ...old, text: value, sections: parseSections(value) } : old);
  }
  function downloadText() {
    if (!analysis) return;
    const blob = new Blob([analysis.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "resume-reference-extracted.txt"; a.click(); URL.revokeObjectURL(url);
  }

  return <section className="rrb-wrap" aria-labelledby="rrb-title">
    <style>{`
      .rrb-wrap{margin:18px 0 24px;border:1px solid #29415e;border-radius:18px;overflow:hidden;background:linear-gradient(135deg,#101b2d,#0c1422);color:#eaf2ff;box-shadow:0 14px 38px #02061724}
      .rrb-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 22px;background:linear-gradient(100deg,#10294a,#142039)}
      .rrb-kicker{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:#7dd3fc;font-weight:800}.rrb-head h3{font-size:20px;margin:5px 0}.rrb-head p{margin:0;color:#b6c6dc;font-size:13px;line-height:1.6;max-width:700px}
      .rrb-body{padding:20px;display:grid;gap:18px}.rrb-drop{border:1px dashed #52708f;border-radius:14px;padding:22px;text-align:center;background:#0b1728}.rrb-drop p{color:#b6c6dc;font-size:13px;line-height:1.6;margin:8px 0 14px}
      .rrb-btn{border:1px solid #48627e;background:#162a42;color:#eaf2ff;border-radius:9px;padding:10px 13px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.rrb-btn.primary{background:#2563eb;border-color:#3b82f6}.rrb-btn:disabled{opacity:.55;cursor:wait}
      .rrb-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}.rrb-panel{border:1px solid #263b55;border-radius:13px;padding:14px;min-width:0}.rrb-panel h4{margin:0 0 12px;font-size:14px}.rrb-muted{font-size:12px;color:#a8bbd3;line-height:1.6}.rrb-preview{background:#fff;color:#1e293b;border-radius:8px;padding:20px;min-height:260px;box-shadow:0 5px 18px #0002}.rrb-preview h2{font-size:19px;color:var(--rrb-accent);margin:0 0 14px;border-bottom:2px solid var(--rrb-accent);padding-bottom:8px}.rrb-preview h5{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--rrb-accent);margin:14px 0 5px}.rrb-preview p{font-size:11px;line-height:1.65;white-space:pre-wrap;margin:0}.rrb-preview.two{display:grid;grid-template-columns:34% 1fr;gap:14px}.rrb-preview.two .rrb-sidebar{background:#f0f5fb;padding:12px;margin:-20px 0 -20px -20px;border-radius:8px 0 0 8px}.rrb-textarea{width:100%;min-height:230px;resize:vertical;box-sizing:border-box;background:#091321;border:1px solid #354d69;border-radius:10px;color:#eaf2ff;padding:12px;font:12px/1.6 ui-monospace,monospace}.rrb-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.rrb-error{color:#fecaca;background:#451a1a;border:1px solid #7f1d1d;padding:10px;border-radius:9px;font-size:13px}.rrb-status{color:#a7f3d0;font-size:12px;line-height:1.6}.rrb-color{width:36px;height:32px;border:0;background:transparent;padding:0}.rrb-thumb{width:100%;max-height:260px;object-fit:contain;background:#0a1320;border-radius:8px}.rrb-section{margin:0 0 12px}.rrb-section h5{margin-top:12px}.rrb-section p{white-space:pre-wrap;overflow-wrap:anywhere}
      @media(max-width:720px){.rrb-grid{grid-template-columns:1fr}.rrb-head{align-items:flex-start;padding:16px}.rrb-body{padding:14px}.rrb-preview.two{grid-template-columns:1fr}.rrb-preview.two .rrb-sidebar{margin:0;padding:10px;border-radius:6px}}
    `}</style>
    <div className="rrb-head"><div><div className="rrb-kicker">Reference-powered resume design</div><h3 id="rrb-title">Create from your own template</h3><p>Upload a resume screenshot, image or PDF. Haryomix extracts text in your browser, samples an accent color, and builds an editable starting point—no account or AI API key required.</p></div><button className="rrb-btn" type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}>{open ? "Collapse" : "Open builder"}</button></div>
    {open && <div className="rrb-body">
      <div className="rrb-drop"><div style={{fontSize:28}}>▧</div><strong>Drop in a reference or choose a file</strong><p>PNG, JPG, WEBP or PDF · up to 12 MB · first page of a PDF is used for visual matching.</p><button type="button" className="rrb-btn primary" onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? "Analysing reference…" : "Upload reference"}</button><input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf,.pdf" hidden onChange={e => { void processFile(e.target.files?.[0]); e.currentTarget.value = ""; }}/>{fileName && <div className="rrb-muted" style={{marginTop:10}}>Selected: {fileName}</div>}</div>
      {error && <div className="rrb-error" role="alert">{error}</div>}{status && <div className="rrb-status" role="status" aria-live="polite">{status}</div>}
      {analysis && <><div className="rrb-toolbar"><label className="rrb-muted">Accent color <input aria-label="Reference accent color" className="rrb-color" type="color" value={accent} onChange={e => {setAccent(e.target.value);setAnalysis(a => a ? {...a,accent:e.target.value}:a)}}/></label><label className="rrb-muted">Layout <select aria-label="Reference layout" className="rrb-btn" value={layout} onChange={e => {const v=e.target.value as "single"|"two-column";setLayout(v);setAnalysis(a=>a?{...a,layout:v}:a)}}><option value="single">Single column</option><option value="two-column">Two column</option></select></label><button className="rrb-btn" type="button" onClick={downloadText}>Download extracted text</button><button className="rrb-btn primary" type="button" onClick={() => onUseExtractedText?.(analysis.text)}>Use text in resume editor</button></div>
      <div className="rrb-grid"><div className="rrb-panel"><h4>Reference image</h4><img className="rrb-thumb" src={imageUrl} alt="Uploaded resume reference"/><p className="rrb-muted">Visual match is a starting point; exact fonts and spacing may need manual tuning.</p><h4 style={{marginTop:16}}>Edit extracted text</h4><textarea className="rrb-textarea" aria-label="Edit extracted resume text" value={analysis.text} onChange={e=>updateText(e.target.value)}/></div>
      <div className="rrb-panel"><h4>Editable recreation preview</h4><div className={"rrb-preview "+(layout==="two-column"?"two":"")} style={{"--rrb-accent":accent} as React.CSSProperties}>{layout==="two-column" && <div className="rrb-sidebar"><h5>Contact / Skills</h5><p>{analysis.sections.filter(s=>/contact|skill|language/i.test(s.title)).map(s=>s.body).join("\n\n") || "Add contact details and skills in the text editor."}</p></div>}<div><h2>Resume</h2>{analysis.sections.filter(s=>layout!=="two-column" || !/contact|skill|language/i.test(s.title)).map((section,i)=><div className="rrb-section" key={section.title+"-"+i}><h5>{section.title}</h5><p>{section.body}</p></div>)}</div></div><p className="rrb-muted" style={{marginTop:10}}>This is a live, editable-text layout preview, not a flattened image. Review OCR carefully before using it for applications.</p></div></div></>}
    </div>}
  </section>;
}
