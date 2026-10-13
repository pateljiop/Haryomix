import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
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
], { stdio: "ignore" });

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

async function run() {
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
  await send("Runtime.enable", {}, sessionId);

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

  console.log("Browser interaction smoke tests passed.");
}

try {
  await run();
} finally {
  if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  chrome.kill("SIGTERM");
  rmSync(profile, { recursive: true, force: true });
}
