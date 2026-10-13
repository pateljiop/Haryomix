import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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

async function createFixtures() {
  const first = await PDFDocument.create();
  first.addPage([100, 200]);
  first.addPage([300, 400]);
  writeFileSync(join(profile, "smoke-a.pdf"), await first.save());
  const second = await PDFDocument.create();
  second.addPage([500, 600]);
  writeFileSync(join(profile, "smoke-b.pdf"), await second.save());
  writeFileSync(join(profile, "smoke-pixel.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jg2kAAAAASUVORK5CYII=", "base64"));
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

  await navigate("/workspace/image-studio", "!!document.querySelector('input.hmx-file-input')", "Image Studio upload");
  await setFiles("input.hmx-file-input", [join(profile, "smoke-pixel.png")]);
  await waitFor("!!document.querySelector('#image-width') && document.querySelector('.hmx-image-preview')?.width===1", "image fixture decoded");
  await fill("#image-width", "64", "image output width");
  await fill("#image-height", "32", "image output height");
  await waitFor("document.querySelector('.hmx-image-preview')?.width===64 && document.querySelector('.hmx-image-preview')?.height===32", "image canvas resizes");
  await clickText("button.hmx-btn.primary", "Export image", "export edited image");
  const imagePath = await waitForDownload("smoke-pixel-edited.png");
  const imageBytes = readFileSync(imagePath);
  const pngWidth = imageBytes.readUInt32BE(16);
  const pngHeight = imageBytes.readUInt32BE(20);
  if (imageBytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || pngWidth !== 64 || pngHeight !== 32) {
    throw new Error("Exported image artifact failed PNG signature/dimensions check: " + pngWidth + "x" + pngHeight);
  }
  console.log("Image export artifact verified: valid PNG with 64x32 output dimensions.");

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
  await fill("textarea.hmx-utility-textarea", "one two\\nthree", "word counter text");
  await waitFor("document.querySelector('.hmx-utility-stat-grid strong')?.textContent==='3'", "word counter updates");
  await clickText("button[role=tab]", "JSON tool", "JSON formatter");
  await clickText("button", "Validate & format", "format JSON");
  await waitFor("document.querySelector('textarea[readonly].hmx-utility-textarea')?.value.includes('student')", "formatted JSON result");
  await clickText("button[role=tab]", "URL encoder", "URL encoder");
  await fill("#utility-url-input", "A & B", "URL input");
  await clickText("button", "Process text", "encode URL component");
  await waitFor("document.querySelector('textarea[readonly].hmx-utility-textarea')?.value==='A%20%26%20B'", "URL component encoding");
  console.log("Student Utility Hub marks, attendance, text, JSON and URL flows passed.");

  console.log("Browser interaction and PDF/Image artifact smoke tests passed.");
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
