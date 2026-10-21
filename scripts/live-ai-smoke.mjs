import assert from "node:assert/strict";

const baseUrl = (process.env.DEPLOYMENT_URL || "https://haryomix.pages.dev").replace(/\/$/, "");
const timeout = 65_000;

async function postJson(path, payload) {
  const response = await fetch(baseUrl + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeout),
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error(path + " returned non-JSON output (HTTP " + response.status + ")."); }
  if (!response.ok) {
    const reason = typeof data.error === "string" ? data.error : "HTTP " + response.status;
    throw new Error(path + " failed: " + reason);
  }
  return data;
}

async function run() {
  console.log("Live AI smoke target:", baseUrl);

  const syllabus = await postJson("/api/exam/syllabus", {
    exam: "SSC CGL",
    context: "India",
  });
  assert.equal(syllabus.searchedLiveWeb, true, "syllabus endpoint must perform live web search");
  assert.ok(Array.isArray(syllabus.results) && syllabus.results.length > 0, "syllabus search must return source links");
  assert.ok(["high", "medium", "low"].includes(syllabus.confidence), "syllabus result needs a confidence label");
  assert.equal(typeof syllabus.summary, "string", "syllabus response needs a summary");
  assert.equal(typeof syllabus.limitations, "string", "syllabus response needs limitations");
  console.log("PASS: live exam syllabus search + source links + confidence/limitations");

  const notes = await postJson("/api/ai/chat", {
    task: "study",
    provider: "auto",
    prompt: "In simple English, explain photosynthesis in two short sentences and give one accurate example. Do not include a study plan.",
  });
  assert.ok(typeof notes.answer === "string" && notes.answer.trim().length >= 30, "live study AI must return a non-empty explanation");
  console.log("PASS: live Exam Copilot study generation (" + (notes.provider || "provider selected") + ")");

  const ppt = await postJson("/api/ai/ppt", {
    action: "create",
    query: "Create a short educational presentation about photosynthesis for first-year college learners. Use simple English, accurate concepts and a clear conclusion.",
    slides: 3,
    style: "clean professional",
  });
  if (ppt.mode === "ai-generated-pptx") {
    assert.ok(Array.isArray(ppt.slides) && ppt.slides.length >= 3, "AI PPT fallback must return at least three slides");
    for (const [index, slide] of ppt.slides.entries()) {
      assert.ok(slide.title?.trim(), "slide " + (index + 1) + " needs a title");
      assert.ok(Array.isArray(slide.bullets) && slide.bullets.length >= 2, "slide " + (index + 1) + " needs useful bullets");
    }
    console.log("PASS: live AI PPT fallback returned " + ppt.slides.length + " structured slides");
  } else {
    assert.equal(ppt.status, "RUNNING", "Felo PPT should return a running task or structured fallback slides");
    assert.ok(ppt.taskId && ppt.businessId, "Felo PPT task must return task and business IDs");
    const status = await postJson("/api/ai/ppt", { action: "status", taskId: ppt.taskId, businessId: ppt.businessId });
    assert.ok(typeof status.status === "string" && status.status.length > 0, "Felo PPT task status must be readable");
    console.log("PASS: live Felo PPT task accepted and status endpoint responded (" + status.status + ")");
  }
  const quiz = await postJson("/api/quiz", {
    topic: "Photosynthesis and chlorophyll",
    language: "English",
    difficulty: "easy",
  });
  assert.equal(quiz.searched, true, "topic quiz must search reference content");
  assert.equal(quiz.questions?.length, 10, "topic quiz must return exactly 10 questions");
  assert.ok(quiz.sources?.length > 0, "topic quiz must return sources");
  for (const [index, question] of quiz.questions.entries()) {
    assert.ok(question.question?.trim(), "question " + (index + 1) + " needs text");
    assert.equal(question.options?.length, 4, "question " + (index + 1) + " needs four options");
    assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4, "question " + (index + 1) + " needs a valid answer index");
    assert.ok(question.explanation?.trim(), "question " + (index + 1) + " needs an explanation");
    assert.ok(/^https?:\/\//i.test(question.sourceUrl || ""), "question " + (index + 1) + " needs a source URL");
  }
  console.log("PASS: live topic research + 10 source-linked MCQs + answer schema");

  console.log("All live AI smoke checks passed.");
}

run().catch(error => {
  console.error("Live AI smoke failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
