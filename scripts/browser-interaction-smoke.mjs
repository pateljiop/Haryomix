import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseUrl = (process.argv[2] || "https://haryomix.pages.dev").replace(/\/$/, "");
const profile = mkdtempSync(join(tmpdir(), "haryomix-browser-e2e-"));
const chrome = spawn("google-chrome", [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--remote-debugging-port=9222",
  "--remote-allow-origins=*",
  "--user-data-dir=" + profile,
  "about:blank",
], { stdio: "ignore", detached: true });

let chromeError = null;
chrome.on("error", error => { chromeError = error; });
let socket = null;

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getDebuggerVersion() {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    if (chromeError) throw chromeError;
    try {
      const response = await fetch("http://127.0.0.1:9222/json/version");
      if (response.ok) return await response.json();
    } catch {}
    await wait(200);
  }
  throw new Error("Headless Chrome DevTools endpoint did not become ready.");
}

const pending = new Map();
let nextId = 0;
let sessionId = "";

function send(method, params = {}, session = "") {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error("CDP command timed out: " + method));
    }, 15000);
    pending.set(id, {
      resolve: value => { clearTimeout(timeout); resolve(value); },
      reject: error => { clearTimeout(timeout); reject(error); },
    });
    const message = { id, method, params };
    if (session) message.sessionId = session;
    socket.send(JSON.stringify(message));
  });
}

async function evaluate(expression) {
  const response = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  }, sessionId);
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text || "Browser evaluation failed.");
  }
  return response.result ? response.result.value : undefined;
}

async function waitFor(expression, label, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const result = await evaluate(expression);
      if (result) return result;
    } catch {}
    await wait(200);
  }
  throw new Error("Browser check timed out: " + label);
}

async function navigateHistory(direction, expression, label) {
  const history = await send("Page.getNavigationHistory", {}, sessionId);
  const nextIndex = history.currentIndex + (direction === "back" ? -1 : 1);
  const entry = history.entries[nextIndex];
  if (!entry) throw new Error("No browser history entry available for " + direction);
  await send("Page.navigateToHistoryEntry", { entryId: entry.id }, sessionId);
  await waitFor(expression, label);
  console.log("Browser history " + direction + " passed: " + label);
}

async function navigate(path, expression, label) {
  await send("Page.navigate", { url: baseUrl + path }, sessionId);
  await waitFor(expression, label);
  console.log("Rendered route: " + path);
}

async function click(selector, label) {
  const ok = await evaluate("(()=>{const el=document.querySelector(" + JSON.stringify(selector) + ");if(!el)return false;el.click();return true})()");
  if (!ok) throw new Error("Could not click " + label + " (" + selector + ")");
}

async function fill(selector, value, label) {
  const expression = "(()=>{const el=document.querySelector(" + JSON.stringify(selector) + ");if(!el)return false;const descriptor=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');if(!descriptor||!descriptor.set)return false;descriptor.set.call(el," + JSON.stringify(value) + ");el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true})()";
  const ok = await evaluate(expression);
  if (!ok) throw new Error("Could not fill " + label + " (" + selector + ")");
}

async function setFiles(selector, paths) {
  const document = await send("DOM.getDocument", {}, sessionId);
  const node = await send("DOM.querySelector", { nodeId: document.root.nodeId, selector }, sessionId);
  if (!node.nodeId) throw new Error("Could not find file input: " + selector);
  await send("DOM.setFileInputFiles", { nodeId: node.nodeId, files: paths }, sessionId);
}

async function chooseValue(selector, value, label) {
  const expression = "(()=>{const el=document.querySelector(" + JSON.stringify(selector) + ");if(!el)return false;const descriptor=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');if(!descriptor||!descriptor.set)return false;descriptor.set.call(el," + JSON.stringify(value) + ");el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true})()";
  const ok = await evaluate(expression);
  if (!ok) throw new Error("Could not select " + label + " (" + selector + ")");
}

async function clickText(selector, text, label) {
  const ok = await evaluate("(()=>{const el=Array.from(document.querySelectorAll(" + JSON.stringify(selector) + ")).find(node=>(node.textContent||'').includes(" + JSON.stringify(text) + "));if(!el)return false;el.click();return true})()");
  if (!ok) throw new Error("Could not click " + label + " (text: " + text + ")");
}

async function waitForDownload(filename, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const path = join(profile, filename);
    try {
      if (statSync(path).isFile() && !readdirSync(profile).some(name => name.endsWith(".crdownload"))) return path;
    } catch {}
    await wait(200);
  }
  throw new Error("Download did not complete: " + filename);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function createValidPngFixture() {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  const pixels = deflateSync(Buffer.from([0, 255, 255, 255, 255]));
  return Buffer.concat([signature, pngChunk("IHDR", header), pngChunk("IDAT", pixels), pngChunk("IEND", Buffer.alloc(0))]);
}

async function createFixtures() {
  const first = await PDFDocument.create();
  first.addPage([100, 200]);
  first.addPage([300, 400]);
  writeFileSync(join(profile, "smoke-a.pdf"), await first.save());
  const second = await PDFDocument.create();
  second.addPage([500, 600]);
  writeFileSync(join(profile, "smoke-b.pdf"), await second.save());
  writeFileSync(join(profile, "smoke-pixel.png"), createValidPngFixture());
}

async function run() {
  await createFixtures();
  const version = await getDebuggerVersion();
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", event => {
    let message;
    try { message = JSON.parse(String(event.data)); } catch { return; }
    if (!message.id) return;
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message || "CDP command failed"));
    else handler.resolve(message.result || {});
  });

  const target = await send("Target.createTarget", { url: "about:blank" });
  const attached = await send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
  sessionId = attached.sessionId;
  await send("Page.enable", {}, sessionId);
  await send("DOM.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: profile }, sessionId);

  await navigate("/", "!!document.querySelector('.hmx-webgl-field')", "landing page WebGL canvas");
  const dedicatedRoutes = [
    ["/workspace", "Your workspace"],
    ["/workspace/code-doctor", "Code Doctor"],
    ["/workspace/ppt-studio", "PPT Studio"],
    ["/workspace/pdf-studio", "PDF Studio"],
    ["/workspace/image-studio", "Image Studio"],
    ["/workspace/exam-copilot", "Exam Copilot"],
    ["/workspace/haryomix-ai", "Haryomix AI"],
    ["/workspace/ai-create-studio", "AI Create Studio"],
    ["/workspace/study-planner", "Study Planner"],
    ["/workspace/flashcards", "Flashcards"],
    ["/workspace/focus-timer", "Focus Timer"],
    ["/workspace/student-utilities", "Student Utilities"],
    ["/workspace/study-library", "Study Library"],
  ];
  for (const [route, title] of dedicatedRoutes) {
    await navigate(route, "document.querySelector('.hmx-workspace-head h1')?.textContent === " + JSON.stringify(title) + " && !document.querySelector('.hmx-sidebar')", title + " dedicated page");
  }
  console.log("All 12 tool pages plus the workspace directory render independently without the old sidebar.");

  await navigate("/workspace/code-doctor", "!!document.querySelector('#hmx-code') && !!Array.from(document.querySelectorAll('button')).find(button=>(button.textContent||'').includes('Ask AI to explain'))", "Code Doctor review controls");
  await clickText("button", "Inspect locally", "run local Code Doctor checks");
  await waitFor("document.querySelector('.hmx-result h3')?.textContent.includes('Local review findings')", "local Code Doctor findings");
  await waitFor("Array.from(document.querySelectorAll('.hmx-result li')).some(el=>el.textContent.includes('colon')) && Array.from(document.querySelectorAll('.hmx-result li')).some(el=>el.textContent.includes('Unclosed bracket'))", "Code Doctor catches default syntax errors");
  await fill("#hmx-code", "def add(a, b):\\n    return a + b\\n\\nprint(add(2, 3))", "valid Python sample");
  await clickText("button", "Inspect locally", "inspect valid Python");
  await waitFor("document.querySelector('.hmx-result li')?.textContent.includes('No obvious pattern-based issue')", "Code Doctor clean-code message");
  console.log("Code Doctor local review catches syntax patterns and handles valid code.");

  await navigate("/workspace/ppt-studio", "!!document.querySelector('#ppt-title') && !!document.querySelector('#ppt-tone')", "PPT Studio editor");
  await chooseValue("#ppt-tone", "Academic / research", "academic presentation style");
  await fill("#ppt-title", "Haryomix Browser Smoke Deck", "PPT title");
  await clickText("button", "Build professional .pptx", "export PowerPoint deck");
  const pptPath = await waitForDownload("Haryomix-Browser-Smoke-Deck.pptx", 30000);
  const pptBytes = readFileSync(pptPath);
  if (pptBytes.length < 5000 || pptBytes.subarray(0, 2).toString() !== "PK") {
    throw new Error("PPT Studio export is not a valid-looking PowerPoint ZIP artifact.");
  }
  await waitFor("document.querySelector('.hmx-workspace-main > .hmx-note[role=status]')?.textContent.includes('PowerPoint exported')", "PPT export success status");
  console.log("PPT Studio produced a downloadable .pptx artifact using the selected style.");

  await navigate("/workspace/study-library", "!!document.querySelector('#hmx-library-title') && !!document.querySelector('#hmx-library-search')", "Study Library editor and search");
  await fill("#hmx-library-title", "Browser smoke note", "Study Library title");
  await fill("#hmx-library-content", "A process is a program in execution.", "Study Library note content");
  await fill("#hmx-library-tags", "BCA, Operating Systems", "Study Library tags");
  await clickText("button", "Save to library +", "save Study Library note");
  await waitFor("document.querySelector('.hmx-note[role=status]')?.textContent.includes('Study item saved')", "Study Library note save status");
  await waitFor("Array.from(document.querySelectorAll('.hmx-library-item-open strong')).some(item=>item.textContent==='Browser smoke note')", "Study Library saved note appears");
  await fill("#hmx-library-search", "Browser smoke note", "search Study Library");
  await waitFor("document.querySelectorAll('.hmx-library-list li').length===1", "Study Library search filters results");
  await navigate("/workspace/focus-timer", "!!document.querySelector('.hmx-focus-modes')", "leave Study Library after saving");
  await navigate("/workspace/study-library", "!!document.querySelector('#hmx-library-search')", "return to Study Library");
  await waitFor("Array.from(document.querySelectorAll('.hmx-library-item-open strong')).some(item=>item.textContent==='Browser smoke note')", "Study Library item persists after navigation");
  console.log("Study Library save, search and IndexedDB persistence flows passed.");

  await navigate("/workspace/study-planner", "!!document.querySelector('#hmx-plan-title')", "Study Planner form");
  await fill("#hmx-plan-title", "Browser smoke study task", "planner title");
  await fill("#hmx-plan-subject", "E2E Subject", "planner subject");
  await fill("#hmx-plan-minutes", "25", "planner estimated minutes");
  await click("form.hmx-planner-form button[type='submit']", "add study task");
  await waitFor("Array.from(document.querySelectorAll('.hmx-planner-task-main > strong')).some(el=>el.textContent.includes('Browser smoke study task'))", "Study Planner task appears");
  await waitFor("JSON.parse(localStorage.getItem('haryomix.study-planner.v1')||'[]').some(task=>task.title==='Browser smoke study task'&&task.subject==='E2E Subject')", "Study Planner task persists");
  await click(".hmx-planner-check", "complete study task");
  await waitFor("JSON.parse(localStorage.getItem('haryomix.study-planner.v1')||'[]').some(task=>task.title==='Browser smoke study task'&&task.completed)", "Study Planner completion persists");
  console.log("Study Planner create/complete/localStorage flow passed.");

  await navigate("/workspace/flashcards", "!!document.querySelector('.hmx-flash-tabs button')", "Flashcards tabs");
  await click(".hmx-flash-tabs button:nth-child(2)", "open flashcard form");
  await fill("#hmx-flash-deck", "E2E Deck", "flashcard deck");
  await fill("#hmx-flash-question", "What is a process in an OS?", "flashcard question");
  await fill("#hmx-flash-answer", "A program in execution.", "flashcard answer");
  await click("form.hmx-flash-form button[type='submit']", "save flashcard");
  await waitFor("document.querySelector('.hmx-flash-question p')?.textContent.includes('What is a process in an OS?')", "new flashcard appears in study view");
  await click(".hmx-flash-reveal", "reveal flashcard answer");
  await waitFor("document.querySelector('.hmx-flash-answer p')?.textContent.includes('A program in execution.')", "flashcard answer revealed");
  await click(".hmx-flash-ratings .rating-good", "rate flashcard");
  await waitFor("JSON.parse(localStorage.getItem('haryomix.flashcards.v1')||'[]').some(card=>card.question==='What is a process in an OS?'&&card.reviews===1&&card.repetitions===1)", "flashcard review schedule persists");
  console.log("Flashcards create/reveal/review/localStorage flow passed.");

  await navigate("/workspace/focus-timer", "!!document.querySelector('.hmx-focus-modes')", "Focus Timer controls");
  await click(".hmx-focus-modes button:nth-child(2)", "select short break");
  await waitFor("document.querySelector('.hmx-focus-time strong')?.textContent==='05:00'", "short break resets to five minutes");
  await click(".hmx-focus-controls button:first-child", "start break timer");
  await waitFor("document.querySelector('.hmx-focus-time strong')?.textContent!=='05:00'", "timer begins counting down", 5000);
  await click(".hmx-focus-controls button:first-child", "pause break timer");
  await waitFor("document.querySelector('.hmx-note[role=status]')?.textContent.includes('Timer paused.')", "pause status is announced");
  await waitFor("document.querySelector('.hmx-focus-controls button:first-child')?.textContent.includes('Start break')", "break button label is correct");
  await click(".hmx-focus-controls button:nth-child(2)", "reset break timer");
  await waitFor("document.querySelector('.hmx-focus-time strong')?.textContent==='05:00'", "timer resets to five minutes");
  console.log("Focus Timer mode/start/pause/reset flow passed.");

  await navigate("/workspace/pdf-studio", "!!document.querySelector('input.hmx-file-input')", "PDF Studio upload control");
  await setFiles("input.hmx-file-input", [join(profile, "smoke-a.pdf"), join(profile, "smoke-b.pdf")]);
  await waitFor("document.querySelector('.hmx-workspace-main > .hmx-note[role=status]')?.textContent.includes('2 supported file(s) selected')", "PDF fixtures loaded");
  await clickText("button.hmx-tool-card", "Merge PDFs", "merge PDF files");
  await waitFor("document.querySelector('.hmx-workspace-main > .hmx-note[role=status]')?.textContent.includes('Merged 2 PDF files')", "PDF merge completes");
  const mergedPath = await waitForDownload("haryomix-merged.pdf");
  const merged = await PDFDocument.load(readFileSync(mergedPath));
  const mergedSizes = merged.getPages().map(page => [page.getWidth(), page.getHeight()]);
  if (merged.getPageCount() !== 3 || JSON.stringify(mergedSizes) !== JSON.stringify([[100, 200], [300, 400], [500, 600]])) {
    throw new Error("Merged PDF artifact has unexpected page count/order: " + JSON.stringify(mergedSizes));
  }
  console.log("PDF merge artifact verified: 3 pages with expected dimensions.");

  await setFiles("input.hmx-file-input", [join(profile, "smoke-a.pdf")]);
  await waitFor("document.querySelector('.hmx-workspace-main > .hmx-note[role=status]')?.textContent.includes('1 supported file(s) selected')", "single PDF fixture loaded");
  await fill("#pdf-order", "2,1", "custom PDF page order");
  await clickText("button.hmx-tool-card", "Custom page order", "custom PDF reorder");
  await waitFor("document.querySelector('.hmx-workspace-main > .hmx-note[role=status]')?.textContent.includes('Saved pages in your custom order')", "custom PDF reorder completes");
  const reorderedPath = await waitForDownload("haryomix-reordered.pdf");
  const reordered = await PDFDocument.load(readFileSync(reorderedPath));
  const reorderedSizes = reordered.getPages().map(page => [page.getWidth(), page.getHeight()]);
  if (reordered.getPageCount() !== 2 || JSON.stringify(reorderedSizes) !== JSON.stringify([[300, 400], [100, 200]])) {
    throw new Error("Reordered PDF artifact has unexpected pages: " + JSON.stringify(reorderedSizes));
  }
  console.log("Custom PDF reorder artifact verified: page dimensions follow requested order.");

  await setFiles("input.hmx-file-input", [join(profile, "smoke-a.pdf")]);
  await waitFor("document.querySelector('.hmx-workspace-main > .hmx-note[role=status]')?.textContent.includes('1 supported file(s) selected')", "PDF extraction fixture loaded");
  await fill("#pdf-range", "2", "page range for extraction");
  await clickText("button.hmx-tool-card", "Extract pages", "extract selected PDF page");
  await waitFor("document.querySelector('.hmx-workspace-main > .hmx-note[role=status]')?.textContent.includes('Extracted 1 page(s).')", "PDF extraction completes");
  const extractedPath = await waitForDownload("haryomix-extracted-pages.pdf");
  const extracted = await PDFDocument.load(readFileSync(extractedPath));
  if (extracted.getPageCount() !== 1 || extracted.getPage(0).getWidth() !== 300 || extracted.getPage(0).getHeight() !== 400) {
    throw new Error("Extracted PDF artifact did not preserve the selected page.");
  }
  console.log("PDF extraction artifact verified: only requested page 2 remains.");

  await setFiles("input.hmx-file-input", [join(profile, "smoke-a.pdf")]);
  await waitFor("document.querySelector('.hmx-workspace-main > .hmx-note[role=status]')?.textContent.includes('1 supported file(s) selected')", "PDF rotation fixture loaded");
  await fill("#pdf-range", "2", "page range for rotation");
  await clickText("button.hmx-tool-card", "Rotate selected pages", "rotate selected PDF page");
  await waitFor("document.querySelector('.hmx-workspace-main > .hmx-note[role=status]')?.textContent.includes('Rotated 1 selected page(s) 90 degrees.')", "selected PDF rotation completes");
  const rotatedPath = await waitForDownload("smoke-a-selected-rotated.pdf");
  const rotated = await PDFDocument.load(readFileSync(rotatedPath));
  if (rotated.getPageCount() !== 2 || rotated.getPage(0).getRotation().angle !== 0 || rotated.getPage(1).getRotation().angle !== 90) {
    throw new Error("Selected-page rotation artifact has unexpected page rotation.");
  }
  console.log("PDF selected-page rotation artifact verified: only page 2 rotates.");

  await setFiles("input.hmx-file-input", [join(profile, "smoke-pixel.png")]);
  await waitFor("document.querySelector('.hmx-workspace-main > .hmx-note[role=status]')?.textContent.includes('1 supported file(s) selected')", "image-to-PDF fixture loaded");
  await clickText("button.hmx-btn", "Images to PDF", "convert image to PDF");
  await waitFor("document.querySelector('.hmx-workspace-main > .hmx-note[role=status]')?.textContent.includes('Images converted to a PDF')", "image-to-PDF conversion completes");
  const imagePdfPath = await waitForDownload("haryomix-images.pdf");
  const imagePdf = await PDFDocument.load(readFileSync(imagePdfPath));
  if (imagePdf.getPageCount() !== 1 || imagePdf.getPage(0).getWidth() !== 1 || imagePdf.getPage(0).getHeight() !== 1) {
    throw new Error("Image-to-PDF artifact has unexpected page count or dimensions.");
  }
  console.log("Image-to-PDF artifact verified: one page with the source image dimensions.");

  await navigate("/workspace/image-studio", "!!document.querySelector('input.hmx-file-input')", "Image Studio upload");
  await setFiles("input.hmx-file-input", [join(profile, "smoke-pixel.png")]);
  await waitFor("!!document.querySelector('#image-width') && document.querySelector('.hmx-image-preview')?.width===1", "image fixture decoded");
  await fill("#image-width", "64", "image output width");
  await fill("#image-height", "32", "image output height");
  await waitFor("document.querySelector('.hmx-image-preview')?.width===64 && document.querySelector('.hmx-image-preview')?.height===32", "image canvas resizes");
  await chooseValue("#image-format", "image/png", "PNG export format");
  await clickText("button.hmx-btn.primary", "Export image", "export edited image");
  const imagePath = await waitForDownload("smoke-pixel-edited.png");
  const imageBytes = readFileSync(imagePath);
  const pngWidth = imageBytes.readUInt32BE(16);
  const pngHeight = imageBytes.readUInt32BE(20);
  if (imageBytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || pngWidth !== 64 || pngHeight !== 32) {
    throw new Error("Exported image artifact failed PNG signature/dimensions check: " + pngWidth + "x" + pngHeight);
  }
  console.log("Image export artifact verified: valid PNG with 64x32 output dimensions.");

  await navigateHistory("back", "location.pathname === '/workspace/pdf-studio' && !!document.querySelector('input.hmx-file-input')", "back returns to PDF Studio");
  await navigateHistory("forward", "location.pathname === '/workspace/image-studio' && !!document.querySelector('input.hmx-file-input')", "forward returns to Image Studio");
  await clickText(".hmx-workspace-nav-actions button", "All tools", "return to tool directory");
  await waitFor("location.pathname === '/workspace' && !!document.querySelector('.hmx-tool-directory')", "All tools opens the workspace directory");
  if (await evaluate("!!document.querySelector('.hmx-sidebar')")) throw new Error("Workspace directory should not show the old crowded sidebar.");
  await clickText(".hmx-directory-card", "PDF Studio", "open PDF Studio from directory");
  await waitFor("location.pathname === '/workspace/pdf-studio' && document.querySelector('.hmx-workspace-head h1')?.textContent === 'PDF Studio' && !document.querySelector('.hmx-sidebar')", "PDF Studio has its own focused page");
  await clickText(".hmx-workspace-nav-actions button", "All tools", "return from dedicated PDF page");
  await waitFor("location.pathname === '/workspace' && !!document.querySelector('.hmx-tool-directory')", "return to workspace directory");
  await fill(".hmx-directory-search input", "Image Studio", "tool directory search");
  await waitFor("document.querySelectorAll('.hmx-directory-card').length===1 && document.querySelector('.hmx-directory-card strong')?.textContent==='Image Studio'", "tool directory search filters tools");
  await clickText(".hmx-directory-card", "Image Studio", "open Image Studio from filtered directory");
  await waitFor("location.pathname === '/workspace/image-studio' && document.querySelector('.hmx-workspace-head h1')?.textContent === 'Image Studio' && !document.querySelector('.hmx-sidebar')", "Image Studio has its own focused page");
  console.log("Dedicated tool pages, workspace directory, back navigation and tool search passed.");

  await navigate("/workspace/student-utilities", "!!document.querySelector('.hmx-utility-tabs')", "Student Utility Hub");
  if (await evaluate("document.querySelector('.hmx-utility-result strong')?.textContent") !== "84%") throw new Error("Default marks percentage is incorrect.");
  await fill("#utility-marks-obtained", "45", "marks obtained");
  await fill("#utility-marks-total", "50", "total marks");
  await waitFor("document.querySelector('.hmx-utility-result strong')?.textContent==='90%'", "marks percentage recalculates");
  await clickText("button[role=tab]", "Attendance", "attendance calculator");
  await fill("#utility-attended", "20", "classes attended");
  await fill("#utility-held", "40", "classes held");
  await fill("#utility-target", "75", "attendance target");
  await waitFor("document.querySelector('.hmx-utility-result strong')?.textContent==='50%' && document.querySelector('.hmx-utility-answer-grid strong')?.textContent==='40'", "attendance target calculation");
  await clickText("button[role=tab]", "Text counter", "text counter");
  await fill("textarea.hmx-utility-textarea", "one two\nthree", "word counter text");
  await waitFor("document.querySelector('.hmx-utility-stat-grid strong')?.textContent==='3'", "word counter updates");
  await clickText("button[role=tab]", "JSON tool", "JSON formatter");
  await clickText("button", "Validate & format", "format JSON");
  await waitFor("document.querySelector('textarea[readonly].hmx-utility-textarea')?.value.includes('student')", "formatted JSON result");
  await clickText("button[role=tab]", "URL encoder", "URL encoder");
  await fill("#utility-url-input", "A & B", "URL input");
  await clickText("button", "Process text", "encode URL component");
  await waitFor("document.querySelector('textarea[readonly].hmx-utility-textarea')?.value==='A%20%26%20B'", "URL component encoding");
  console.log("Student Utility Hub marks, attendance, text, JSON and URL flows passed.");

  await navigate("/", "!!document.querySelector('.hmx-webgl-field')", "landing page for mobile viewport");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await waitFor("matchMedia('(prefers-reduced-motion: reduce)').matches", "reduced-motion preference is active");
  const mobileLayout = await evaluate("({width:window.innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth})");
  if (mobileLayout.documentWidth > mobileLayout.width + 1 || mobileLayout.bodyWidth > mobileLayout.width + 1) {
    throw new Error("Landing page overflows 390px mobile viewport: " + JSON.stringify(mobileLayout));
  }
  console.log("Mobile landing layout and reduced-motion preference verified: " + JSON.stringify(mobileLayout));
  await send("Emulation.clearDeviceMetricsOverride", {}, sessionId);
  await send("Emulation.setEmulatedMedia", { features: [] }, sessionId);

  console.log("Browser interaction, dedicated tool pages, history, mobile, PDF/Image artifacts, and Student Utility Hub smoke tests passed.");
}

try {
  await run();
} finally {
  if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  if (chrome.pid && chrome.exitCode === null && chrome.signalCode === null) {
    await new Promise(resolve => {
      const timeout = setTimeout(() => { try { process.kill(-chrome.pid, "SIGKILL"); } catch {} resolve(); }, 5000);
      chrome.once("exit", () => { clearTimeout(timeout); resolve(); });
      try { process.kill(-chrome.pid, "SIGTERM"); } catch { chrome.kill("SIGTERM"); }
    });
  }
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  } catch (error) {
    if (!error || !["ENOTEMPTY", "EBUSY", "EPERM"].includes(error.code)) throw error;
    console.warn("Chrome profile cleanup deferred to the ephemeral GitHub runner cleanup.");
  }
}
