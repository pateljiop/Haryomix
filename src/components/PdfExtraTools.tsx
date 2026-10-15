import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { csvCell, escapeRtfText, parsePdfPageRange, reorderPdfDocument, safePdfName } from "../lib/pdf-utils";


type Props = { setNotice: (message: string) => void };
type TextPage = { page: number; text: string };
type PageThumbnail = { page: number; dataUrl: string };

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function openPdf(file: File): Promise<PDFDocumentProxy> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), standardFontDataUrl: `${import.meta.env.BASE_URL}standard_fonts/` }).promise;
}

async function extractText(file: File, range: string): Promise<TextPage[]> {
  const pdf = await openPdf(file);
  const pageNumbers = parsePdfPageRange(range, pdf.numPages);
  const output: TextPage[] = [];
  for (const pageNo of pageNumbers) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const text = content.items.map(item => "str" in item ? item.str : "").join(" ").replace(/[ \t]+/g, " ").trim();
    output.push({ page: pageNo, text });
  }
  return output;
}

export function PdfExtraTools({ setNotice }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [active, setActive] = useState(0);
  const [compareFile, setCompareFile] = useState<File | null>(null);
  const [range, setRange] = useState("1-3");
  const [previewPage, setPreviewPage] = useState(1);
  const [scale, setScale] = useState(1.25);
  const [ocrLanguage, setOcrLanguage] = useState("eng");
  const [compression, setCompression] = useState("balanced");
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [dragPage, setDragPage] = useState<number | null>(null);
  const [thumbBusy, setThumbBusy] = useState(false);
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

  async function loadThumbnails() {
    if (!file || thumbBusy) return;
    setThumbBusy(true);
    setThumbnails([]);
    try {
      const pdf = await openPdf(file);
      if (pdf.numPages > 40) throw new Error("Thumbnail organizer is limited to 40 pages per file to keep memory use predictable.");
      const result: PageThumbnail[] = [];
      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        setProgress(`Building page thumbnails ${pageNo}/${pdf.numPages}…`);
        const page = await pdf.getPage(pageNo);
        const viewport = page.getViewport({ scale: Math.min(0.32, 110 / Math.max(page.view[2] - page.view[0], page.view[3] - page.view[1])) });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is not available in this browser.");
        await page.render({ canvasContext: context, viewport }).promise;
        result.push({ page: pageNo, dataUrl: canvas.toDataURL("image/jpeg", 0.72) });
        canvas.width = 0; canvas.height = 0;
      }
      setThumbnails(result);
      setNotice(`Loaded ${result.length} page thumbnails. Drag pages to reorder them, then export the new PDF.`);
    } catch (error) {
      setNotice(`Could not load thumbnails: ${error instanceof Error ? error.message : "Unknown error."}`);
    } finally { setThumbBusy(false); setProgress(""); }
  }

  function moveThumbnail(fromPage: number, toPage: number) {
    if (fromPage === toPage) return;
    setThumbnails(current => {
      const next = [...current];
      const from = next.findIndex(item => item.page === fromPage);
      const to = next.findIndex(item => item.page === toPage);
      if (from < 0 || to < 0) return current;
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  async function exportThumbnailOrder() {
    if (!file || !thumbnails.length || busy) return;
    setBusy(true);
    try {
      const bytes = await reorderPdfDocument(await file.arrayBuffer(), thumbnails.map(item => item.page));
      downloadBlob(new Blob([Uint8Array.from(bytes).buffer as ArrayBuffer], { type: "application/pdf" }), `${safePdfName(file.name)}-organized.pdf`);
      setNotice(`Exported ${thumbnails.length} pages in the thumbnail order shown. Original page content remains intact.`);
    } catch (error) {
      setNotice(`Could not export page order: ${error instanceof Error ? error.message : "Unsupported or encrypted PDF."}`);
    } finally { setBusy(false); }
  }

  async function run(action: "text" | "word" | "images" | "ocr" | "compare" | "repair" | "csv" | "pptx" | "compress") {
    if (busy) return;
    if (!file) {
      setNotice("Choose a PDF file in PDF Pro before running this tool.");
      return;
    }
    setBusy(true);
    setProgress("Preparing PDF…");
    try {
      if (action === "text" || action === "word") {
        const pages = await extractText(file, range);
        const output = pages.map(p => `--- Page ${p.page} ---\n${p.text || "[No selectable text on this page. It may be a scanned image; try OCR.]"}`).join("\n\n");
        if (action === "text") {
          downloadBlob(new Blob([output], { type: "text/plain;charset=utf-8" }), `${safePdfName(file.name)}-text.txt`);
          setNotice(`Extracted text from ${pages.length} page(s). Scanned pages may need OCR.`);
        } else {
          const body = pages.map(p => `\\b Page ${p.page} \\b0\\par\n${escapeRtfText(p.text || "[No selectable text; run OCR for scanned pages.]")}`).join("\\par\n");
          const rtf = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\f0\\fs22 ${body}}`;
          downloadBlob(new Blob([rtf], { type: "application/rtf;charset=utf-8" }), `${safePdfName(file.name)}-text.rtf`);
          setNotice(`Exported editable text to an RTF file for Word (${pages.length} page(s)). Original PDF layout/images are not preserved.`);
        }
      } else if (action === "images") {
        const pdf = await openPdf(file);
        const selected = parsePdfPageRange(range, pdf.numPages);
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
          downloadBlob(blob, `${safePdfName(file.name)}-page-${selected[i]}.jpg`);
          await new Promise(resolve => window.setTimeout(resolve, 200));
        }
        setNotice(`Exported ${selected.length} page image(s) as JPEG. Allow multiple downloads if your browser asks.`);
      } else if (action === "ocr") {
        const pdf = await openPdf(file);
        const selected = parsePdfPageRange(range, pdf.numPages);
        if (selected.length > 10) throw new Error("OCR is limited to 10 pages per batch to keep browser memory under control.");
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker(ocrLanguage, 1, { logger: event => setProgress(event.status ? `OCR: ${event.status}${event.progress ? ` ${Math.round(event.progress * 100)}%` : ""}` : "Running OCR…") });
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
          downloadBlob(new Blob([result.join("\n\n")], { type: "text/plain;charset=utf-8" }), `${safePdfName(file.name)}-ocr.txt`);
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
        downloadBlob(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }), `${safePdfName(file.name)}-comparison.txt`);
        setNotice(`Comparison report exported. ${differences} page position(s) differ by extracted text.`);
      } else if (action === "csv") {
        const pdf = await openPdf(file);
        const selected = parsePdfPageRange(range, pdf.numPages);
        const csvRows = [["page", "x", "y", "text"]];
        for (const pageNo of selected) {
          setProgress(`Extracting text positions from page ${pageNo}…`);
          const page = await pdf.getPage(pageNo);
          const content = await page.getTextContent();
          for (const item of content.items) {
            if (!("str" in item) || !item.str.trim()) continue;
            const transform = item.transform;
            const cells = [String(pageNo), String(Math.round(transform[4] * 100) / 100), String(Math.round(transform[5] * 100) / 100), item.str];
            csvRows.push(cells);
          }
        }
        downloadBlob(new Blob([csvRows.map(row => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }), `${safePdfName(file.name)}-text-positions.csv`);
        setNotice("Exported selectable text and approximate PDF coordinates to CSV. This is not automatic table recognition; review columns in Excel.");
      } else if (action === "pptx") {
        const pdf = await openPdf(file);
        const selected = parsePdfPageRange(range, pdf.numPages);
        if (selected.length > 20) throw new Error("PDF-to-PowerPoint is limited to 20 pages per export.");
        const pptxModule = await import("pptxgenjs");
        const pptx = new pptxModule.default();
        pptx.layout = "LAYOUT_WIDE";
        pptx.author = "Haryomix PDF Studio";
        pptx.subject = "Image-based PowerPoint conversion from PDF pages";
        pptx.title = file.name.replace(/\.pdf$/i, "");
        for (let i = 0; i < selected.length; i++) {
          setProgress(`Building PowerPoint slide ${i + 1} of ${selected.length}…`);
          const page = await pdf.getPage(selected[i]);
          const viewport = page.getViewport({ scale: Math.min(2, Math.max(0.75, scale)) });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas is not available in this browser.");
          await page.render({ canvasContext: context, viewport }).promise;
          const data = canvas.toDataURL("image/png");
          const slide = pptx.addSlide();
          slide.background = { color: "FFFFFF" };
          const sw = 13.333, sh = 7.5, aspect = canvas.width / canvas.height;
          let w = sw, h = w / aspect;
          if (h > sh) { h = sh; w = h * aspect; }
          slide.addImage({ data, x: (sw - w) / 2, y: (sh - h) / 2, w, h });
          canvas.width = 0; canvas.height = 0;
        }
        const blob = await pptx.write({ outputType: "blob" }) as Blob;
        downloadBlob(blob, `${safePdfName(file.name)}-converted.pptx`);
        setNotice(`Created ${selected.length} PowerPoint slide(s) from PDF page images. Visuals are preserved, but text and objects on each slide are not individually editable.`);
      } else if (action === "compress") {
        const pdf = await openPdf(file);
        if (pdf.numPages > 25) throw new Error("Raster compression is limited to 25 pages per file in this browser version.");
        const profiles: Record<string, { scale: number; quality: number; label: string }> = {
          small: { scale: 0.95, quality: 0.42, label: "Small file" },
          balanced: { scale: 1.25, quality: 0.62, label: "Balanced" },
          quality: { scale: 1.7, quality: 0.82, label: "Higher quality" },
        };
        const profile = profiles[compression] || profiles.balanced;
        const { PDFDocument } = await import("pdf-lib");
        const output = await PDFDocument.create();
        for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
          setProgress(`Compressing page ${pageNo} of ${pdf.numPages} (${profile.label})…`);
          const page = await pdf.getPage(pageNo);
          const originalViewport = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: profile.scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas is not available in this browser.");
          await page.render({ canvasContext: context, viewport }).promise;
          const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Could not encode compressed page.")), "image/jpeg", profile.quality));
          const image = await output.embedJpg(await blob.arrayBuffer());
          const outPage = output.addPage([originalViewport.width, originalViewport.height]);
          outPage.drawImage(image, { x: 0, y: 0, width: originalViewport.width, height: originalViewport.height });
          canvas.width = 0; canvas.height = 0;
        }
        const bytes = await output.save({ useObjectStreams: true });
        const result = new Blob([Uint8Array.from(bytes).buffer as ArrayBuffer], { type: "application/pdf" });
        downloadBlob(result, `${safePdfName(file.name)}-compressed-raster.pdf`);
        const ratio = file.size ? Math.round((1 - result.size / file.size) * 100) : 0;
        setNotice(`Raster-compressed PDF exported: ${(file.size / 1024).toFixed(0)} KB → ${(result.size / 1024).toFixed(0)} KB (${ratio >= 0 ? `${ratio}% smaller` : `${Math.abs(ratio)}% larger`}). Text, links, vector graphics, forms and accessibility structure are converted to page images; verify the result before using it.`);
      } else if (action === "repair") {
        const input = await file.arrayBuffer();
        const { PDFDocument } = await import("pdf-lib");
        const doc = await PDFDocument.load(input, { ignoreEncryption: false, throwOnInvalidObject: false, updateMetadata: false });
        const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });
        downloadBlob(new Blob([Uint8Array.from(bytes).buffer as ArrayBuffer], { type: "application/pdf" }), `${safePdfName(file.name)}-repaired.pdf`);
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
      <div className="hmx-note" style={{ marginBottom: 16 }}>New tools: live page preview, drag-and-drop thumbnail organizer, text extraction, Word-compatible RTF export, PDF-to-JPEG, multilingual OCR, text comparison, and re-save/repair for PDFs the parser can open. Files stay in your browser; OCR downloads language data on first use.</div>
      <div className="hmx-field"><label htmlFor="pdf-pro-files">PDF file(s)</label><input id="pdf-pro-files" className="hmx-input" type="file" accept="application/pdf,.pdf" multiple onChange={e => { const next = Array.from(e.target.files || []); setFiles(next); setActive(0); setCompareFile(next[1] || null); setPreviewPage(1); setRange("1-3"); setThumbnails([]); }} /></div>
      {files.length > 0 && <>
        <div className="hmx-field"><label htmlFor="pdf-pro-active">Active PDF</label><select id="pdf-pro-active" className="hmx-select" value={active} onChange={e => setActive(Number(e.target.value))}>{files.map((f, i) => <option value={i} key={`${f.name}-${i}`}>{f.name} · {(f.size / 1048576).toFixed(2)} MB</option>)}</select></div>
        <div className="hmx-field"><label htmlFor="pdf-pro-range">Pages to process (1-based)</label><input id="pdf-pro-range" className="hmx-input" value={range} onChange={e => setRange(e.target.value)} placeholder="1-3,5"/><p style={{ fontSize: 11, color: "#778092" }}>Current PDF: {pageCount || "…"} pages. Range examples: 1-3,5,8-10.</p></div>
        <div className="hmx-field"><label htmlFor="pdf-pro-preview-page">Preview page</label><input id="pdf-pro-preview-page" className="hmx-input" type="number" min={1} max={Math.max(1, pageCount)} value={previewPage} onChange={e => setPreviewPage(Math.max(1, Math.min(pageCount || 1, Number(e.target.value) || 1)))}/></div>
        <div className="hmx-field"><label htmlFor="pdf-pro-scale">Preview / export resolution · {scale.toFixed(2)}×</label><input id="pdf-pro-scale" className="hmx-input" type="range" min={0.75} max={2} step={0.25} value={scale} onChange={e => setScale(Number(e.target.value))}/></div>
        <div className="hmx-field"><label htmlFor="pdf-pro-ocr-language">OCR language</label><select id="pdf-pro-ocr-language" className="hmx-select" value={ocrLanguage} onChange={e => setOcrLanguage(e.target.value)}><option value="eng">English</option><option value="hin">Hindi</option><option value="eng+hin">English + Hindi</option></select><p style={{ fontSize: 11, color: "#778092" }}>Language data downloads from the OCR provider on first use and may take time.</p></div>
        <div className="hmx-field"><label htmlFor="pdf-pro-compression">Raster compression preset</label><select id="pdf-pro-compression" className="hmx-select" value={compression} onChange={e => setCompression(e.target.value)}><option value="small">Small file · lower resolution</option><option value="balanced">Balanced</option><option value="quality">Higher quality · larger file</option></select><p style={{ fontSize: 11, color: "#b45309" }}>Warning: this converts each page into an image. Searchable text, links, forms and vector quality are lost.</p></div>
        <div className="hmx-result"><h3>Page preview {previewReady ? "· ready" : "· rendering"}</h3><canvas ref={canvasRef} aria-label={`PDF page ${previewPage} preview`} style={{ display: "block", maxWidth: "100%", height: "auto", borderRadius: 8, background: "#fff", border: "1px solid #dce3ec" }}/></div>
        <div className="hmx-result" style={{ marginTop: 16 }}><h3>Visual page organizer</h3><p style={{ fontSize: 12, color: "#778092", lineHeight: 1.6 }}>Load thumbnails, then drag a page onto another page to move it. Use the arrow buttons for precise ordering on touch screens. Original page numbers are shown; exporting applies the displayed order.</p><div className="hmx-btn-row" style={{ marginBottom: 12 }}><button className="hmx-btn" disabled={thumbBusy || busy} onClick={() => void loadThumbnails()}>{thumbBusy ? "Loading thumbnails…" : thumbnails.length ? "Reload thumbnails" : "Load page thumbnails"}</button><button className="hmx-btn hmx-btn-primary" disabled={busy || !thumbnails.length || thumbnails.length < 1} onClick={() => void exportThumbnailOrder()}>Export reordered PDF</button></div>{thumbnails.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(112px,1fr))", gap: 10 }}>{thumbnails.map((item, index) => <div key={item.page} draggable onDragStart={() => setDragPage(item.page)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (dragPage !== null) moveThumbnail(dragPage, item.page); setDragPage(null); }} onDragEnd={() => setDragPage(null)} style={{ border: dragPage === item.page ? "2px dashed #5578e8" : "1px solid #34415a", borderRadius: 9, padding: 7, background: "#101725", minWidth: 0, cursor: "grab" }}><img src={item.dataUrl} alt={`Original PDF page ${item.page}`} style={{ display: "block", width: "100%", height: 120, objectFit: "contain", background: "#fff", borderRadius: 5 }}/><div style={{ fontSize: 11, textAlign: "center", marginTop: 6, color: "#c4d0e6" }}>Page {item.page} · #{index + 1}</div><div className="hmx-btn-row" style={{ justifyContent: "center", gap: 4, marginTop: 6 }}><button className="hmx-btn" aria-label={`Move page ${item.page} earlier`} disabled={index === 0 || busy} onClick={() => setThumbnails(current => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>←</button><button className="hmx-btn" aria-label={`Move page ${item.page} later`} disabled={index === thumbnails.length - 1 || busy} onClick={() => setThumbnails(current => { const next = [...current]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next; })}>→</button></div></div>)}</div>}</div>
        <div className="hmx-tool-grid">
          <button className="hmx-tool-card" disabled={busy} onClick={() => void run("text")}><strong>Extract PDF text</strong><span>Export selectable text to TXT.</span></button>
          <button className="hmx-tool-card" disabled={busy} onClick={() => void run("word")}><strong>PDF to Word-compatible RTF</strong><span>Editable text for Word; complex layout may change.</span></button>
          <button className="hmx-tool-card" disabled={busy} onClick={() => void run("images")}><strong>PDF to JPG</strong><span>Render selected pages to JPEG images.</span></button>
          <button className="hmx-tool-card" disabled={busy} onClick={() => void run("pptx")}><strong>PDF to PowerPoint</strong><span>Convert selected pages to image-based slides (up to 20 pages).</span></button>
          <button className="hmx-tool-card" disabled={busy} onClick={() => void run("csv")}><strong>PDF text to CSV / Excel</strong><span>Export selectable text and page coordinates as CSV.</span></button>
          <button className="hmx-tool-card" disabled={busy} onClick={() => void run("ocr")}><strong>OCR scanned pages</strong><span>Recognize English or Hindi text from page images (up to 10 pages).</span></button>
          <button className="hmx-tool-card" disabled={busy} onClick={() => void run("compare")}><strong>Compare two PDFs</strong><span>Report page-by-page extracted-text differences.</span></button>
          <button className="hmx-tool-card" disabled={busy} onClick={() => void run("compress")}><strong>Compress scanned / image PDF</strong><span>Reduce image quality and resolution; output is no longer searchable text.</span></button>
          <button className="hmx-tool-card" disabled={busy} onClick={() => void run("repair")}><strong>Re-save / repair PDF</strong><span>Rewrite PDFs that the parser can successfully open.</span></button>
        </div>
        {files.length > 1 && <div className="hmx-field" style={{ marginTop: 18 }}><label htmlFor="pdf-pro-compare">Second PDF for comparison</label><select id="pdf-pro-compare" className="hmx-select" value={compareFile ? String(files.indexOf(compareFile)) : ""} onChange={e => setCompareFile(files[Number(e.target.value)] || null)}><option value="">Choose a PDF</option>{files.map((f, i) => i !== active && <option key={`${f.name}-compare-${i}`} value={i}>{f.name}</option>)}</select></div>}
      </>}
      {busy && <div className="hmx-note" role="status" style={{ marginTop: 14 }}>{progress || "Working…"}</div>}
      <p style={{ fontSize: 11, color: "#778092", marginTop: 14, lineHeight: 1.6 }}>Limits: OCR supports English and Hindi; text extraction and comparison cannot read scanned pages without OCR. RTF export preserves text, not the original PDF layout. PDF password removal/protection and secure redaction are not included. Raster compression intentionally sacrifices selectable text and vector quality.</p>
    </div>
  </div>;
}
