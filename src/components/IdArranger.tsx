import { useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";

type Side = "front" | "back";
type CardImage = { file: File; url: string; name: string };
const presets = {
  "ID card · 85.6 × 54 mm": { w: 85.6, h: 54 },
  "Aadhaar-size reference · 86 × 54 mm": { w: 86, h: 54 },
  "Small card · 90 × 55 mm": { w: 90, h: 55 },
  "Custom · 100 × 65 mm": { w: 100, h: 65 },
};
type Preset = keyof typeof presets;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("This image could not be opened. Try a JPG or PNG file."));
    image.src = src;
  });
}
function canvasBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not export this layout.")), type));
}
function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export function IdArranger() {
  const [front, setFront] = useState<CardImage | null>(null);
  const [back, setBack] = useState<CardImage | null>(null);
  const [preset, setPreset] = useState<Preset>("ID card · 85.6 × 54 mm");
  const [copies, setCopies] = useState(2);
  const [side, setSide] = useState<"front" | "back" | "both">("both");
  const [paper, setPaper] = useState<"A4" | "A5" | "Letter">("A4");
  const [gap, setGap] = useState(4);
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const card = presets[preset];
  const paperSize = paper === "A4" ? { w: 210, h: 297 } : paper === "A5" ? { w: 148, h: 210 } : { w: 215.9, h: 279.4 };
  const selectedSides = useMemo(() => (side === "both" ? [front, back] : [side === "front" ? front : back]).filter((item): item is CardImage => Boolean(item)), [side, front, back]);

  useEffect(() => {
    let cancelled = false;
    async function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpi = 4;
      const width = Math.round(paperSize.w * dpi * 3.7795276);
      const height = Math.round(paperSize.h * dpi * 3.7795276);
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height);
      const margin = 8 * dpi * 3.7795276;
      const cardW = card.w * dpi * 3.7795276;
      const cardH = card.h * dpi * 3.7795276;
      const gapPx = gap * dpi * 3.7795276;
      const cols = Math.max(1, Math.floor((width - margin * 2 + gapPx) / (cardW + gapPx)));
      const rows = Math.max(1, Math.floor((height - margin * 2 + gapPx) / (cardH + gapPx)));
      const slots = Math.min(copies * Math.max(1, selectedSides.length), cols * rows);
      const images: HTMLImageElement[] = [];
      try {
        for (const item of selectedSides) images.push(await loadImage(item.url));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load image.");
        return;
      }
      if (cancelled) return;
      ctx.strokeStyle = "#d4d8df"; ctx.lineWidth = Math.max(1, dpi / 2);
      for (let i = 0; i < slots; i++) {
        const col = i % cols, row = Math.floor(i / cols);
        const x = margin + col * (cardW + gapPx), y = margin + row * (cardH + gapPx);
        const img = images[i % images.length];
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y, cardW, cardH); ctx.clip();
        const scale = Math.max(cardW / img.width, cardH / img.height);
        const sw = img.width * scale, sh = img.height * scale;
        ctx.drawImage(img, x + (cardW - sw) / 2, y + (cardH - sh) / 2, sw, sh);
        ctx.restore(); ctx.strokeRect(x, y, cardW, cardH);
      }
      if (slots < copies * Math.max(1, selectedSides.length)) {
        ctx.fillStyle = "#6b7280"; ctx.font = `${Math.round(2.7 * dpi * 3.7795276)}px sans-serif`;
        ctx.fillText(`Fits ${slots} cards on this sheet. Reduce copies or choose smaller cards for more.`, margin, height - margin / 2);
      }
    }
    void draw();
    return () => { cancelled = true; };
  }, [front, back, preset, copies, side, paper, gap, paperSize.w, paperSize.h, card.w, card.h, selectedSides]);

  useEffect(() => () => { if (front) URL.revokeObjectURL(front.url); }, [front]);
  useEffect(() => () => { if (back) URL.revokeObjectURL(back.url); }, [back]);

  function chooseFile(which: Side, file?: File) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) { setError("Choose an image file such as JPG, PNG or WebP."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("Keep each image under 20 MB."); return; }
    const value = { file, url: URL.createObjectURL(file), name: file.name };
    if (which === "front") setFront(old => { if (old) URL.revokeObjectURL(old.url); return value; });
    else setBack(old => { if (old) URL.revokeObjectURL(old.url); return value; });
  }
  async function exportPng() {
    if (!canvasRef.current || !selectedSides.length) { setError("Upload at least one side of the card first."); return; }
    setBusy(true); setError("");
    try { downloadBlob(await canvasBlob(canvasRef.current), "haryomix-id-arranger.png"); }
    catch (e) { setError(e instanceof Error ? e.message : "Export failed."); }
    finally { setBusy(false); }
  }
  async function exportPdf() {
    if (!canvasRef.current || !selectedSides.length) { setError("Upload at least one side of the card first."); return; }
    setBusy(true); setError("");
    try {
      const pdf = await PDFDocument.create();
      const page = pdf.addPage([paperSize.w * 72 / 25.4, paperSize.h * 72 / 25.4]);
      const png = await canvasBlob(canvasRef.current);
      const embedded = await pdf.embedPng(await png.arrayBuffer());
      page.drawImage(embedded, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
      const pdfBytes = await pdf.save();
      const pdfBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
      downloadBlob(new Blob([pdfBuffer], { type: "application/pdf" }), "haryomix-id-arranger.pdf");
    } catch (e) { setError(e instanceof Error ? e.message : "PDF export failed."); }
    finally { setBusy(false); }
  }
  function printSheet() {
    if (!canvasRef.current || !selectedSides.length) { setError("Upload at least one side of the card first."); return; }
    const data = canvasRef.current.toDataURL("image/png");
    const win = window.open("", "_blank");
    if (!win) { setError("Your browser blocked the print window. Allow pop-ups for this site and try again."); return; }
    win.document.write(`<!doctype html><html><head><title>Print ID sheet</title><style>@page{size:${paper};margin:0}html,body{margin:0;padding:0}img{width:100%;height:100%;object-fit:fill;display:block}</style></head><body><img src="${data}" alt="ID card print sheet"><script>window.onload=()=>{window.print()}</script></body></html>`);
    win.document.close();
  }

  return <div className={"hmx-panel id-arranger id-arranger-pro " + (darkMode ? "id-arranger-dark" : "id-arranger-light")}>
    <div className="id-pro-toolbar"><div className="id-pro-brand"><span className="id-pro-logo">▣</span><div><strong>ID & Aadhaar Arranger <em>PRO</em></strong><small>Precision 1:1 Scale Print & PDF Merger</small></div></div><div className="id-pro-toolbar-actions"><button type="button" className="id-pro-quiet" onClick={() => setError("Upload front/back images below, then export at 100% / Actual Size.")}>Try Sample</button><button type="button" className="id-pro-icon" title="Upload images, choose layout and export at actual size." onClick={() => setError("Upload front/back images below. Choose a layout and export PDF at Actual Size (100%).")}>ⓘ</button><button type="button" className="id-pro-icon" aria-label="Toggle theme" onClick={() => setDarkMode(v => !v)}>{darkMode ? "☼" : "☾"}</button></div></div>
    <div className="id-pro-subbar"><span>◉ {paper} · {paperSize.w} × {paperSize.h} mm</span><span className="id-pro-hint">Precision print canvas</span><div className="id-pro-zoom"><button type="button" onClick={() => setZoom(v => Math.max(50,v-10))}>−</button><span>{zoom}%</span><button type="button" onClick={() => setZoom(v => Math.min(150,v+10))}>+</button><button type="button" onClick={() => setZoom(100)}>Fit</button></div></div>
    <div className="hmx-panel-head"><h2>ID Arranger <span className="id-arranger-pill">LOCAL PROCESSING</span></h2><span className="id-arranger-step">PRINT PREP · 01</span></div>
    <div className="hmx-panel-body">
      <div className="hmx-note id-arranger-privacy"><strong>Your files stay in this browser.</strong> Images are not uploaded to Haryomix. Use this tool to arrange genuine card images for printing; it does not create or alter official identity details.</div>
      <div className="id-pro-section-title">▧ 1. UPLOAD & CROP IMAGES <span>{Number(Boolean(front)) + Number(Boolean(back))} / 2 Loaded</span></div><div className="id-arranger-upload-grid">
        {(["front", "back"] as Side[]).map(which => {
          const value = which === "front" ? front : back;
          return <label className="id-arranger-upload" key={which}>
            <span className="id-arranger-upload-icon">{which === "front" ? "▣" : "▤"}</span>
            <strong>{which === "front" ? "Front side" : "Back side"} <span>{which === "front" ? "Recommended" : "Optional"}</span></strong>
            <span className="id-arranger-upload-hint">{value ? value.name : "Choose JPG, PNG or WebP · max 20 MB"}</span>
            <input type="file" accept="image/*" onChange={e => chooseFile(which, e.currentTarget.files?.[0])}/>
            {value && <img className="id-arranger-thumb" src={value.url} alt={which + " side preview"}/>}
          </label>;
        })}
      </div>
      <div className="id-pro-section-title">▦ 2. SHEET LAYOUT & ORIENTATION</div><div className="id-arranger-controls">
        <label className="hmx-field"><span>Card size</span><select className="hmx-select" value={preset} onChange={e => setPreset(e.target.value as Preset)}>{Object.keys(presets).map(p => <option key={p}>{p}</option>)}</select></label>
        <label className="hmx-field"><span>Paper</span><select className="hmx-select" value={paper} onChange={e => setPaper(e.target.value as typeof paper)}><option>A4</option><option>A5</option><option>Letter</option></select></label>
        <label className="hmx-field"><span>Copies per side</span><select className="hmx-select" value={copies} onChange={e => setCopies(Number(e.target.value))}>{[1,2,3,4,5,6,8,10,12].map(n => <option key={n} value={n}>{n} copies</option>)}</select></label>
        <label className="hmx-field"><span>Arrange</span><select className="hmx-select" value={side} onChange={e => setSide(e.target.value as typeof side)}><option value="both">Front + back alternating</option><option value="front">Front only</option><option value="back">Back only</option></select></label>
        <label className="hmx-field"><span>Gap between cards: {gap} mm</span><input type="range" min="0" max="10" value={gap} onChange={e => setGap(Number(e.target.value))}/></label>
      </div>
      <div className="id-pro-canvas-stage"><div className="id-pro-paper" style={{width: "min(" + zoom + "%, 560px)"}}><canvas ref={canvasRef} className="id-arranger-sheet" aria-label="Print sheet preview"/></div>{!selectedSides.length && <div className="id-pro-empty"><strong>Upload Front & Back ID Images to Begin</strong><span>Use the upload panels below to start</span></div>}<div className="id-pro-tip">💡 Preview your print sheet below · Export at Actual Size (100%)</div></div>
      {error && <div className="hmx-note" role="alert" style={{marginTop:16}}>{error}</div>}
      <div className="hmx-btn-row id-arranger-actions"><button className="hmx-btn primary" onClick={() => void exportPdf()} disabled={busy || !selectedSides.length}>{busy ? "Preparing…" : "Download print-ready PDF ↗"}</button><button className="hmx-btn" onClick={() => void exportPng()} disabled={busy || !selectedSides.length}>Export PNG</button><button className="hmx-btn" onClick={printSheet} disabled={!selectedSides.length}>Print sheet</button><button className="hmx-btn" onClick={() => { setFront(old => { if (old) URL.revokeObjectURL(old.url); return null; }); setBack(old => { if (old) URL.revokeObjectURL(old.url); return null; }); setError(""); }}>Clear images</button></div>
      <p className="id-arranger-footnote">Print at 100% / Actual Size. Disable “Fit to page” if your printer dialog offers it. The preview fills the selected paper size; check physical dimensions with a ruler before printing a final batch.</p>
    </div>
  </div>;
}
