import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/quiz.ts";

function mockDb(count = 1) {
  return { prepare() { return { bind() { return this; }, async first() { return { count }; }, async run() { return { success: true }; } }; } };
}
function request(body) {
  return new Request("https://example.test/api/quiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
async function withFetch(mock, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { return await fn(); } finally { globalThis.fetch = original; }
}

test("topic quiz validates topic and reports missing database instead of silently failing", async () => {
  const invalid = await onRequestPost({ request: request({ topic: "a" }), env: {} });
  assert.equal(invalid.status, 400);
  const missingDb = await onRequestPost({ request: request({ topic: "photosynthesis" }), env: { GROQ_API_KEY: "test-key" } });
  assert.equal(missingDb.status, 503);
  assert.match((await missingDb.json()).error, /D1 binding DB/i);
});

test("topic quiz searches reference content before generating and returns source-linked questions", async () => {
  const response = await withFetch(async (url, init = {}) => {
    const target = String(url);
    if (target.includes("wikipedia.org/w/api.php")) { const parsed = new URL(target); if (parsed.searchParams.get("list") === "search") return new Response(JSON.stringify({ query: { search: [{ title: "Photosynthesis" }] } }), { status: 200 }); return new Response(JSON.stringify({ query: { pages: { "1": { title: "Photosynthesis", extract: "Photosynthesis is the process by which plants use sunlight to synthesize foods from carbon dioxide and water. It generally involves chlorophyll and releases oxygen." } } } }), { status: 200 }); }
    if (target.includes("api.groq.com")) {
      const body = JSON.parse(init.body);
      assert.match(body.messages[1].content, /Photosynthesis/);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ questions: Array.from({ length: 10 }, (_, i) => ({ question: `Question about photosynthesis number ${i + 1}?`, options: ["A plant process", "A rock process", "A metal process", "A planetary process"], answer: 0, explanation: "The source describes photosynthesis as a plant process.", sourceTitle: "Photosynthesis" })) }) } }] }), { status: 200 });
    }
    throw new Error("Unexpected URL " + target);
  }, () => onRequestPost({ request: request({ topic: "photosynthesis", language: "English", difficulty: "medium" }), env: { DB: mockDb(), GROQ_API_KEY: "test-key" } }));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.searched, true);
  assert.equal(data.questions.length, 10);
  assert.equal(data.sources[0].title, "Photosynthesis");
  assert.match(data.questions[0].sourceUrl, /wikipedia.org/);
});

test("topic quiz falls back to web snippets when Wikipedia has no usable extracts", async () => {
  const searchHtml = '<div class="result results_links results_links_deep web-result"><div class="links_main links_deep result__body"><h2 class="result__title"><a rel="nofollow" class="result__a" href="https://example.org/plant-biology">Plant Biology Guide</a></h2><a class="result__snippet">Photosynthesis converts light energy into chemical energy in plants and algae, using carbon dioxide and water to produce sugars and release oxygen.</a></div></div>';
  const response = await withFetch(async (url, init = {}) => {
    const target = String(url);
    if (target.includes("wikipedia.org/w/api.php")) return new Response(JSON.stringify({ query: {} }), { status: 200 });
    if (target.includes("html.duckduckgo.com/html/")) return new Response(searchHtml, { status: 200 });
    if (target.includes("api.groq.com")) {
      const body = JSON.parse(init.body);
      assert.match(body.messages[1].content, /Plant Biology Guide/);
      assert.match(body.messages[1].content, /chemical energy/);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ questions: Array.from({ length: 10 }, (_, i) => ({ question: "Question about plant biology number " + (i + 1) + "?", options: ["Photosynthesis", "Rock formation", "Metal corrosion", "Planetary motion"], answer: 0, explanation: "The supplied source describes photosynthesis in plants.", sourceTitle: "Plant Biology Guide" })) }) } }] }), { status: 200 });
    }
    throw new Error("Unexpected URL " + target);
  }, () => onRequestPost({ request: request({ topic: "photosynthesis", language: "English", difficulty: "easy" }), env: { DB: mockDb(), GROQ_API_KEY: "test-key" } }));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.questions.length, 10);
  assert.equal(data.sources[0].title, "Plant Biology Guide");
  assert.equal(data.questions[0].sourceUrl, "https://example.org/plant-biology");
});

test("topic quiz rejects malformed model output rather than presenting broken questions", async () => {
  const response = await withFetch(async url => {
    if (String(url).includes("wikipedia.org")) { const parsed = new URL(String(url)); if (parsed.searchParams.get("list") === "search") return new Response(JSON.stringify({ query: { search: [{ title: "Photosynthesis" }] } }), { status: 200 }); return new Response(JSON.stringify({ query: { pages: { "1": { title: "Photosynthesis", extract: "Photosynthesis is the process by which plants use sunlight to synthesize foods from carbon dioxide and water. It generally involves chlorophyll and releases oxygen." } } } }), { status: 200 }); }
    return new Response(JSON.stringify({ choices: [{ message: { content: "{bad json" } }] }), { status: 200 });
  }, () => onRequestPost({ request: request({ topic: "photosynthesis" }), env: { DB: mockDb(), GROQ_API_KEY: "test-key" } }));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, "quiz_generation_failed");
});
