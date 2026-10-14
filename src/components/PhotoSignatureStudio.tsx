import { useEffect, useRef, useState } from "react";

type Format = "image/jpeg" | "image/png" | "image/webp";
const presets = [
  { name: "Custom dimensions", width: 200, height: 230, maxKB: 50 },
  { name: "Small ID photo", width: 200, height: 230, maxKB: 50 },
  { name: "Passport-style portrait", width: 413, height: 531, maxKB: 100 },
  { name: "Square profile photo", width: 300, height: 300, maxKB: 100 },
  { name: "Signature", width: 300, height: 100, maxKB: 30 },
];

function slug(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 48) || "photo";
}
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This image could not be opened. Try a JPG or PNG file.")); };
    image.src = url;
  });
}
function canvasBlob(canvas: HTMLCanvasElement, format: Format, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Image export failed. Try another format.")), format, quality));
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function PhotoSignatureStudio() {
  const [file, setFile] = useState<File | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [name, setName] = useState("photo");
  const [presetName, setPresetName] = useState(presets[0].name);
  const [width, setWidth] = useState(200);
  const [height, setHeight] = useState(230);
  const [maxKB, setMaxKB] = useState(50);
  const [format, setFormat] = useState<Format>("image/jpeg");
  const [quality, setQuality] = useState(0.88);
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [background, setBackground] = useState("#ffffff");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [exported, setExported] = useState<{ blob: Blob; width: number; height: number; name: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!file) { setImage(null); setExported(null); return; }
    let active = true;
    void loadImage(file).then(value => {
      if (!active) return;
      setImage(value); setName(file.name.replace(/\.[^.]+$/, "")); setExported(null); setError(""); setNotice("Image loaded locally. It has not been uploaded.");
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Could not load image."); });
    return () => { active = false; };
  }, [file]);

  function applyPreset(value: string) {
    setPresetName(value);
    const preset = presets.find(item => item.name === value);
    if (preset) { setWidth(preset.width); setHeight(preset.height); setMaxKB(preset.maxKB); }
  }

  async function renderImage() {
    if (!image) { setError("Choose a photo or signature image first."); return; }
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 4000 || height > 4000) {
      setError("Width and height must each be between 1 and 4000 pixels."); return;
    }
    if (!Number.isFinite(maxKB) || maxKB < 5 || maxKB > 5000) { setError("Target file size must be between 5 KB and 5000 KB."); return; }
    setBusy(true); setError(""); setNotice(""); setExported(null);
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Preview canvas is not available.");
      canvas.width = Math.round(width); canvas.height = Math.round(height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not supported by this browser.");
      context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height);
      const sourceRatio = image.naturalWidth / image.naturalHeight;
      const targetRatio = canvas.width / canvas.height;
      let sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight;
      if (fit === "cover") {
        if (sourceRatio > targetRatio) { sw = image.naturalHeight * targetRatio; sx = (image.naturalWidth - sw) / 2; }
        else { sh = image.naturalWidth / targetRatio; sy = (image.naturalHeight - sh) / 2; }
      } else {
        const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
        sw = image.naturalWidth; sh = image.naturalHeight;
        const dw = Math.round(sw * scale), dh = Math.round(sh * scale);
        context.drawImage(image, Math.round((canvas.width - dw) / 2), Math.round((canvas.height - dh) / 2), dw, dh);
      }
      if (fit === "cover") context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      let blob = await canvasBlob(canvas, format, quality);
      let currentQuality = quality;
      let attempts = 0;
      while (blob.size > maxKB * 1024 && format !== "image/png" && currentQuality > 0.25 && attempts < 8) {
        currentQuality = Math.max(0.25, currentQuality - 0.1);
        blob = await canvasBlob(canvas, format, currentQuality); attempts++;
      }
      if (blob.size > maxKB * 1024 && format !== "image/png") {
        let w = canvas.width, h = canvas.height;
        while (blob.size > maxKB * 1024 && Math.min(w, h) > 80 && attempts < 18) {
          w = Math.max(80, Math.round(w * 0.9)); h = Math.max(80, Math.round(h * 0.9));
          const scaled = document.createElement("canvas"); scaled.width = w; scaled.height = h;
          const ctx = scaled.getContext("2d"); if (!ctx) break;
          ctx.drawImage(canvas, 0, 0, w, h);
          blob = await canvasBlob(scaled, format, currentQuality); attempts++;
        }
        if (blob.size <= maxKB * 1024) { canvas.width = w; canvas.height = h; const ctx = canvas.getContext("2d"); ctx?.drawImage(await loadImage(new File([blob], "compressed-image", { type: format })), 0, 0, w, h); }
      }
      const extension = format === "image/jpeg" ? "jpg" : format === "image/png" ? "png" : "webp";
      const outputName = slug(name) + "-resized." + extension;
      setExported({ blob, width: canvas.width, height: canvas.height, name: outputName });
      setNotice(blob.size > maxKB * 1024 ? `Export ready at ${Math.round(blob.size / 1024)} KB. Target ${maxKB} KB could not be guaranteed; PNG is not lossy-compressed here.` : `Export ready: ${Math.round(blob.size / 1024)} KB at ${canvas.width} × ${canvas.height} px.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Image processing failed."); }
    finally { setBusy(false); }
  }

  async function makePrintSheet() {
    if (!image) { setError("Choose a photo before creating a print sheet."); return; }
    setBusy(true); setError("");
    try {
      const photoCanvas = canvasRef.current;
      if (!photoCanvas || !photoCanvas.width || !photoCanvas.height) {
        await renderImage();
        throw new Error("First click “Prepare image” to create a preview, then make the print sheet.");
      }
      const sheet = document.createElement("canvas");
      sheet.width = 2480; sheet.height = 3508;
      const ctx = sheet.getContext("2d");
      if (!ctx) throw new Error("Canvas is not supported by this browser.");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, sheet.width, sheet.height);
      const margin = 100, gap = 36, photoW = photoCanvas.width, photoH = photoCanvas.height;
      const cols = Math.max(1, Math.floor((sheet.width - margin * 2 + gap) / (photoW + gap)));
      const rows = Math.max(1, Math.floor((sheet.height - margin * 2 + gap) / (photoH + gap)));
      const count = Math.min(cols * rows, 100);
      for (let i = 0; i < count; i++) {
        const x = margin + (i % cols) * (photoW + gap);
        const y = margin + Math.floor(i / cols) * (photoH + gap);
        ctx.drawImage(photoCanvas, x, y);
        ctx.strokeStyle = "#d5dbe5"; ctx.lineWidth = 2; ctx.strokeRect(x, y, photoW, photoH);
      }
      const blob = await canvasBlob(sheet, "image/jpeg", 0.92);
      downloadBlob(blob, slug(name) + "-A4-photo-sheet.jpg");
      setNotice(`A4 print sheet exported with ${count} copies. Print at 100% scale and verify the dimensions with a test print.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create print sheet."); }
    finally { setBusy(false); }
  }

  return <div className="hmx-panel hmx-studio-shell hmx-photo-signature">
    <div className="hmx-studio-toolbar"><div className="hmx-studio-brand"><span className="hmx-studio-logo" aria-hidden="true">▣</span><div><strong>Photo & Signature Studio <em>NEW</em></strong><small>Resize · Compress · Print sheet</small></div></div><span className="hmx-studio-local">● Local processing</span></div>
    <div className="hmx-studio-subbar"><span>INPUT → RESIZE → EXPORT</span><span>Files stay in this browser</span></div>
    <div className="hmx-panel-body" style={{padding:16}}>
      <div className="hmx-note">Choose a generic starting preset, then follow the exact pixel and KB requirements shown by the exam or application form. Presets are examples, not official requirements.</div>
      <div className="hmx-field"><label htmlFor="photo-file">Photo or signature image</label><input id="photo-file" className="hmx-input" type="file" accept="image/jpeg,image/png,image/webp,image/bmp" onChange={event=>setFile(event.target.files?.[0] ?? null)}/></div>
      {image && <div className="hmx-note" role="status">Source: {image.naturalWidth} × {image.naturalHeight} px · {file ? Math.max(1, Math.round(file.size / 1024)) : 0} KB · processed locally</div>}
      <div className="hmx-photo-grid">
        <div className="hmx-field"><label htmlFor="photo-preset">Starting preset</label><select id="photo-preset" className="hmx-select" value={presetName} onChange={event=>applyPreset(event.target.value)}>{presets.map(item=><option key={item.name}>{item.name}</option>)}</select></div>
        <div className="hmx-field"><label htmlFor="photo-width">Width (px)</label><input id="photo-width" className="hmx-input" type="number" min="1" max="4000" value={width} onChange={event=>{setWidth(Number(event.target.value));setPresetName("Custom dimensions");}}/></div>
        <div className="hmx-field"><label htmlFor="photo-height">Height (px)</label><input id="photo-height" className="hmx-input" type="number" min="1" max="4000" value={height} onChange={event=>{setHeight(Number(event.target.value));setPresetName("Custom dimensions");}}/></div>
        <div className="hmx-field"><label htmlFor="photo-max-kb">Maximum target size (KB)</label><input id="photo-max-kb" className="hmx-input" type="number" min="5" max="5000" value={maxKB} onChange={event=>setMaxKB(Number(event.target.value))}/></div>
        <div className="hmx-field"><label htmlFor="photo-format">Export format</label><select id="photo-format" className="hmx-select" value={format} onChange={event=>setFormat(event.target.value as Format)}><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></div>
        <div className="hmx-field"><label htmlFor="photo-fit">Fit / crop</label><select id="photo-fit" className="hmx-select" value={fit} onChange={event=>setFit(event.target.value as "cover"|"contain")}><option value="cover">Fill frame (centre crop)</option><option value="contain">Fit whole image</option></select></div>
      </div>
      <div className="hmx-field"><label htmlFor="photo-background">Background for empty space</label><input id="photo-background" className="hmx-input" type="color" value={background} onChange={event=>setBackground(event.target.value)}/></div>
      <div className="hmx-field"><label htmlFor="photo-quality">JPEG/WebP quality · {Math.round(quality*100)}%</label><input id="photo-quality" type="range" min="25" max="100" value={Math.round(quality*100)} onChange={event=>setQuality(Number(event.target.value)/100)}/><p>For JPEG/WebP, the tool tries lower quality and smaller dimensions to approach the target. Exact KB limits cannot be guaranteed for every image. PNG is exported losslessly and may exceed the target.</p></div>
      <div className="hmx-btn-row"><button className="hmx-btn primary" onClick={()=>void renderImage()} disabled={!image||busy}>{busy?"Preparing…":"Prepare image ↗"}</button><button className="hmx-btn" onClick={()=>{if(exported)downloadBlob(exported.blob,exported.name);else setError("Prepare the image before downloading.");}} disabled={!exported||busy}>Download image</button><button className="hmx-btn" onClick={()=>void makePrintSheet()} disabled={!image||busy}>Create A4 photo sheet</button><button className="hmx-btn" onClick={()=>{setFile(null);setImage(null);setExported(null);setNotice("Current session cleared.");setError("");}}>Clear session</button></div>
      <canvas ref={canvasRef} className="hmx-photo-preview" aria-label="Prepared image preview"/>
      {exported&&<div className="hmx-result" role="status"><strong>{exported.name}</strong><p>{exported.width} × {exported.height} px · {Math.round(exported.blob.size/1024)} KB · {format.replace("image/","").toUpperCase()}</p></div>}
      {notice&&<div className="hmx-note" role="status">{notice}</div>}
      {error&&<div className="hmx-note" role="alert">{error}</div>}
    </div>
  </div>;
}
