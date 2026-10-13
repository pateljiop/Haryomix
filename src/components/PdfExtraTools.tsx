import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";


type Props = { setNotice: (message: string) => void };
type TextPage = { page: number; text: string };

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function safeName(name: string) {
  return name.replace(/\.pdf$/i, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 50) || "document";
}

function parsePages(value: string, count: number): number[] {
  const pages = new Set<number>();
  for (const part of value.split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("Page range format: 1-3,5,8-10");
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > count) throw new Error(`Page numbers must be between 1 and ${count}.`);
    for (let page = start; page <= end; page++) pages.add(page);
  }
  if (!pages.size) throw new Error("Enter at least one page.");
  return [...pages].sort((a, b) => a - b);
}

async function openPdf(file: File): Promise<PDFDocumentProxy> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

async function extractText(file: File, range: string): Promise<TextPage[]> {
  const pdf = await openPdf(file);
  const pageNumbers = parsePages(range, pdf.numPages);
  const output: TextPage[] = [];
  for (const pageNo of pageNumbers) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const text = content.items.map(item => "str" in item ? item.str : "").join(" ").replace(/[ \t]+/g, " ").trim();
    output.push({ page: pageNo, text });
  }
  return output;
}

function rtfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/{/g, "\\{").replace(/}/g, "\\}").replace(/[^\x00-\x7F]/g, char => `\\u${char.charCodeAt(0)}?`).replace(/\r?\n/g, "\\par\n");
}

export function PdfExtraTools({ setNotice }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [active, setActive] = useState(0);
  const [compareFile, setCompareFile] = useState<File | null>(null);
  const [range, setRange] = useState("1-3");
  const [previewPage, setPreviewPage] = useState(1);
  const [scale, setScale] = useState(1.25);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [previewReady, setPreviewReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const file = files[active];

  useEffect(() => {
    let cancelled = false;
    setPreviewReady(false);
    setPageCount(0);
    if (!file) return;
    void (async () => {
      try {
        const pdf = await openPdf(file);
        if (cancelled) return;
        setPageCount(pdf.numPages);
        setPreviewPage(p => Math.max(1, Math.min(pdf.numPages, p)));
        setRange(p => p === "1-3" && pdf.numPages < 3 ? `1-${pdf.numPages}` : p);
        const page = await pdf.getPage(Math.max(1, Math.min(pdf.numPages, previewPage)));
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context || cancelled) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: context, viewport }).promise;
        if (!cancelled) setPreviewReady(true);
      } catch (error) {
        if (!cancelled) setNotice(`PDF preview failed: ${error instanceof Error ? error.message : "Could not render this PDF."}`);
      }
    })();
    return () => { cancelled = true; };
  }, [file, previewPage, scale, setNotice]);

  async function run(action: "text" | "word" | "images" | "ocr" | "compare" | "repair") {
    if (!file || busy) return;
    setBusy(true);
    setProgress("Preparing PDF…");
    try {
      if (action === "text" || action === "word") {
        const pages = await extractText(file, range);
        const output = pages.map(p => `--- Page ${p.page} ---\n${p.text || "[No selectable text on this page. It may be a scanned image; try OCR.]"}`).join("\n\n");
        if (action === "text") {
          downloadBlob(new Blob([output], { type: "text/plain;charset=utf-8" }), `${safeName(file.name)}-text.txt`);
          setNotice(`Extracted text from ${pages.length} page(s). Scanned pages may need OCR.`);
        } else {
          const body = pages.map(p => `\\b Page ${p.page} \\b0\\par\n${rtfEscape(p.text || "[No selectable text; run OCR for scanned pages.]")}`).join("\\par\n");
          const rtf = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\f0\\fs22 ${body}}`;
          downloadBlob(new Blob([rtf], { type: "application/rtf;charset=utf-8" }), `${safeName(file.name)}-text.rtf`);
          setNotice(`Exported editable text to an RTF file for Word (${pages.length} page(s)). Original PDF layout/images are not preserved.`);
        }
      } else if (action === "images") {
        const pdf = await openPdf(file);
        const selected = parsePages(range, pdf.numPages);
        if (selected.length > 10) throw new Error("For browser safety, export at most 10 pages per batch.");
        for (let i = 0; i < selected.length; i++) {
          setProgress(`Rendering page ${i + 1} of ${selected.length}…`);
          const page = await pdf.getPage(selected[i]);
          const viewport = page.getViewport({ scale: Math.min(2, Math.max(0.5, scale)) });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas is not available in this browser.");
          await page.render({ canvasContext: context, viewport }).promise;
          const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Could not export rendered page.")), "image/jpeg", 0.92));
          downloadBlob(blob, `${safeName(file.name)}-page-${selected[i]}.jpg`);
          await new Promise(resolve => window.setTimeout(resolve, 200));
        }
        setNotice(`Exported ${selected.length} page image(s) as JPEG. Allow multiple downloads if your browser asks.`);
      } else if (action === "ocr") {
        const pdf = await openPdf(file);
        const selected = parsePages(range, pdf.numPages);
        if (selected.length > 10) throw new Error("OCR is limited to 10 pages per batch to keep browser memory under control.");
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng", 1, { logger: event => setProgress(event.status ? `OCR: ${event.status}${event.progress ? ` ${Math.round(event.progress * 100)}%` : ""}` : "Running OCR…") });
        try {
          const result: string[] = [];
          for (let i = 0; i < selected.length; i++) {
            setProgress(`Rendering page ${selected[i]} for OCR (${i + 1}/${selected.length})…`);
            const page = await pdf.getPage(selected[i]);
            const viewport = page.getViewport({ scale: 1.6 });
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Canvas is not available in this browser.");
            await page.render({ canvasContext: context, viewport }).promise;
            const recognized = await worker.recognize(canvas);
            result.push(`--- Page ${selected[i]} ---\n${recognized.data.text.trim()}`);
            canvas.width = 0; canvas.height = 0;
          }
          downloadBlob(new Blob([result.join("\n\n")], { type: "text/plain;charset=utf-8" }), `${safeName(file.name)}-ocr.txt`);
          setNotice(`OCR completed for ${selected.length} page(s). Review recognized text for errors before relying on it.`);
        } finally { await worker.terminate(); }
      } else if (action === "compare") {
        if (!compareFile) throw new Error("Select a second PDF to compare.");
        const [left, right] = await Promise.all([extractText(file, `1-${(await openPdf(file)).numPages}`), extractText(compareFile, `1-${(await openPdf(compareFile)).numPages}`)]);
        const max = Math.max(left.length, right.length);
        const lines: string[] = [`PDF comparison report`, `A: ${file.name}`, `B: ${compareFile.name}`, "Text comparison only; page layout, images and formatting are not compared.", ""];
        let differences = 0;
        for (let i = 0; i < max; i++) {
          const a = left[i]?.text ?? "[page missing]";
          const b = right[i]?.text ?? "[page missing]";
          if (a !== b) { differences++; lines.push(`PAGE ${i + 1} DIFFERS`, `A: ${a || "[no selectable text]"}`, `B: ${b || "[no selectable text]"}`, ""); }
        }
        lines.unshift(`${differences} page(s) differ out of ${max} compared page positions.`);
        downloadBlob(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }), `${safeName(file.name)}-comparison.txt`);
        setNotice(`Comparison report exported. ${differences} page position(s) differ by extracted text.`);
      } else if (action === "repair") {
        const input = await file.arrayBuffer();
        const { PDFDocument } = await import("pdf-lib");
        const doc = await PDFDocument.load(input, { ignoreEncryption: false, throwOnInvalidObject: false, updateMetadata: false });
        const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });
        downloadBlob(new Blob([Uint8Array.from(bytes).buffer as ArrayBuffer], { type: "application/pdf" }), `${safeName(file.name)}-repaired.pdf`);
        setNotice("PDF successfully opened and re-saved. This can rewrite valid PDFs, but cannot recover every corrupted or encrypted file.");
      }
    } catch (error) {
      setNotice(`PDF tool failed: ${error instanceof Error ? error.message : "Unsupported, encrypted or damaged PDF."}`);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return <div className="hmx-panel" style={{ marginTop: 18 }}>
    <div className="hmx-panel-head"><h2>PDF Pro tools</h2><span style={{ fontSize: 11, color: "#7a8292" }}>Browser-side processing</span></div>
    <div className="hmx-panel-body">
      <div className="hmx-note" style={{ marginBottom: 16 }}>New tools: live page preview, text extraction, Word-compatible RTF export, PDF-to-JPEG, OCR, text comparison, and re-save/repair for PDFs the parser can open. Files stay in your browser; OCR downloads English language data on first use.</div>
      <div className="hmx-field"><label htmlFor="pdf-pro-files">PDF file(s)</label><input id="pdf-pro-files" className="hmx-input" type="file" accept="application/pdf,.pdf" multiple onChange={e => { const next = Array.from(e.target.files || []); setFiles(next); setActive(0); setCompareFile(next[1] || null); setPreviewPage(1); setRange("1-3"); }} /></div>
      {files.length > 0 && <>
        <div className="hmx-field"><label htmlFor="pdf-pro-active">Active PDF</label><select id="pdf-pro-active" className="hmx-select" value={active} onChange={e => setActive(Number(e.target.value))}>{files.map((f, i) => <option value={i} key={`${f.name}-${i}`}>{f.name} · {(f.size / 1048576).toFixed(2)} MB</option>)}</select></div>
        <div className="hmx-field"><label htmlFor="pdf-pro-range">Pages to process (1-based)</label><input id="pdf-pro-range" className="hmx-input" value={range} onChange={e => setRange(e.target.value)} placeholder="1-3,5"/><p style={{ fontSize: 11, color: "#778092" }}>Current PDF: {pageCount || "…"} pages. Range examples: 1-3,5,8-10.</p></div>
        <div className="hmx-field"><label htmlFor="pdf-pro-preview-page">Preview page</label><input id="pdf-pro-preview-page" className="hmx-input" type="number" min={1} max={Math.max(1, pageCount)} value={previewPage} onChange={e => setPreviewPage(Math.max(1, Math.min(pageCount || 1, Number(e.target.value) || 1)))}/></div>
        <div className="hmx-field"><label htmlFor="pdf-pro-scale">Preview / export resolution · {scale.toFixed(2)}×</label><input id="pdf-pro-scale" className="hmx-input" type="range" min={0.75} max={2} step={0.25} value={scale} onChange={e => setScale(Number(e.target.value))}/></div>
        <div className="hmx-result"><h3>Page preview {previewReady ? "· ready" : "· rendering"}</h3><canvas ref={canvasRef} aria-label={`PDF page ${previewPage} preview`} style={{ display: "block", maxWidth: "100%", height: "auto", borderRadius: 8, background: "#fff", border: "1px solid #dce3ec" }}/></div>
        <div className="hmx-tool-grid">
          <button className="hmx-tool-card" disabled={busy} onClick={() => void run("text")}><strong>Extract PDF text</strong><span>Export selectable text to TXT.</span></button>
          <button className="hmx-tool-card" disabled={busy} onClick={() => void run("word")}><strong>PDF to Word-compatible RTF</strong><span>Editable text for Word; complex layout may change.</span></button>
          <button className="hmx-tool-card" disabled={busy} onClick={() => void run("images")}><strong>PDF to JPG</strong><span>Render selected pages to JPEG images.</span></button>
          <button className="hmx-tool-card" disabled={busy} onClick={() => void run("ocr")}><strong>OCR scanned pages</strong><span>Recognize English text from page images (up to 10 pages).</span></button>
          <button className="hmx-tool-card" disabled={busy} onClick={() => void run("compare")}><strong>Compare two PDFs</strong><span>Report page-by-page extracted-text differences.</span></button>
          <button className="hmx-tool-card" disabled={busy} onClick={() => void run("repair")}><strong>Re-save / repair PDF</strong><span>Rewrite PDFs that the parser can successfully open.</span></button>
        </div>
        {files.length > 1 && <div className="hmx-field" style={{ marginTop: 18 }}><label htmlFor="pdf-pro-compare">Second PDF for comparison</label><select id="pdf-pro-compare" className="hmx-select" value={compareFile ? String(files.indexOf(compareFile)) : ""} onChange={e => setCompareFile(files[Number(e.target.value)] || null)}><option value="">Choose a PDF</option>{files.map((f, i) => i !== active && <option key={`${f.name}-compare-${i}`} value={i}>{f.name}</option>)}</select></div>}
      </>}
      {busy && <div className="hmx-note" role="status" style={{ marginTop: 14 }}>{progress || "Working…"}</div>}
      <p style={{ fontSize: 11, color: "#778092", marginTop: 14, lineHeight: 1.6 }}>Limits: OCR is English-only in this version; text extraction and comparison cannot read scanned pages without OCR. RTF export preserves text, not the original PDF layout. PDF password removal/protection, secure redaction, and image recompression are not claimed by these tools.</p>
    </div>
  </div>;
}
