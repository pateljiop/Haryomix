import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/exam/syllabus.ts";

function mockDb(count = 1) {
  return { prepare() { return { bind() { return this; }, async first() { return { count }; }, async run() { return { success: true }; } }; } };
}
function request(body) {
  return new Request("https://example.test/api/exam/syllabus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
async function withFetch(mock, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { return await fn(); } finally { globalThis.fetch = original; }
}
const searchHtml = `<div class="result results_links results_links_deep web-result"><div class="links_main links_deep result__body"><h2 class="result__title"><a rel="nofollow" class="result__a" href="https://ssc.gov.in/api/attachment/uploads/masterData/Syllabus/CGL_Syllabus.pdf">SSC CGL official syllabus</a></h2><a class="result__snippet">Official Combined Graduate Level examination syllabus and exam pattern.</a></div></div><div class="result results_links results_links_deep web-result"><div class="links_main links_deep result__body"><h2 class="result__title"><a rel="nofollow" class="result__a" href="https://example.org/ssc-cgl-syllabus">SSC CGL syllabus overview</a></h2><a class="result__snippet">General Intelligence, General Awareness, Quantitative Aptitude, English.</a></div></div>`;

test("exam syllabus search validates the exam name and requires DB protection", async () => {
  const invalid = await onRequestPost({ request: request({ exam: "x" }), env: {} });
  assert.equal(invalid.status, 400);
  const missingDb = await onRequestPost({ request: request({ exam: "SSC CGL" }), env: { GROQ_API_KEY: "test-key" } });
  assert.equal(missingDb.status, 503);
});

test("exam syllabus flow searches live web before AI analysis and marks official domains", async () => {
  const response = await withFetch(async (url, init = {}) => {
    if (String(url).includes("duckduckgo.com/html/")) {
      assert.match(decodeURIComponent(String(url).replace(/\+/g, "%20")), /SSC CGL/);
      return new Response(searchHtml, { status: 200 });
    }
    if (String(url).includes("api.groq.com")) {
      const body = JSON.parse(init.body);
      assert.match(body.messages[1].content, /SSC CGL official syllabus/);
      assert.match(body.messages[1].content, /General Intelligence/);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ summary: "Official syllabus source found for SSC CGL.", syllabus: [{ section: "Tier I", topics: ["General Intelligence", "General Awareness"] }], examPattern: "See the linked official notification for the applicable cycle.", confidence: "medium", limitations: "Confirm the applicable recruitment year in the official notice." }) } }] }), { status: 200 });
    }
    throw new Error("Unexpected URL " + String(url));
  }, () => onRequestPost({ request: request({ exam: "SSC CGL", context: "India" }), env: { DB: mockDb(), GROQ_API_KEY: "test-key" } }));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.searchedLiveWeb, true);
  assert.equal(data.officialSourceCount, 1);
  assert.equal(data.results.length, 2);
  assert.equal(data.results[0].official, true);
  assert.equal(data.syllabus[0].section, "Tier I");
});

test("exam syllabus flow reports search outage instead of fabricating syllabus", async () => {
  const response = await withFetch(async () => new Response("blocked", { status: 503 }), () =>
    onRequestPost({ request: request({ exam: "Unknown India exam" }), env: { DB: mockDb(), GROQ_API_KEY: "test-key" } }));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, "search_unavailable");
});
