import assert from "node:assert/strict";

const baseUrl = (process.env.DEPLOYMENT_URL || "https://haryomix.pages.dev").replace(/\/$/, "");
const timeout = 65_000;
const failures = [];

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

async function check(name, fn) {
  try {
    const detail = await fn();
    console.log("PASS: " + name + (detail ? " — " + detail : ""));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    failures.push({ name, reason });
    console.error("FAIL: " + name + " — " + reason);
  }
}

async function run() {
  console.log("Live AI smoke target:", baseUrl);

  await check("Exam Copilot study/notes generation", async () => {
    const data = await postJson("/api/ai/chat", {
      task: "study", provider: "auto",
      prompt: "In simple English, explain photosynthesis in two short sentences and give one accurate example. Do not include a study plan.",
    });
    assert.ok(typeof data.answer === "string" && data.answer.trim().length >= 30, "study AI returned no useful explanation");
    return data.provider || "provider selected";
  });

  await check("Code Doctor generation", async () => {
    const data = await postJson("/api/ai/chat", {
      task: "code", provider: "auto",
      prompt: "Write a short JavaScript function that reverses a string, with one example call and expected output.",
    });
    assert.ok(typeof data.answer === "string" && data.answer.trim().length >= 30, "Code Doctor returned no useful answer");
    return data.provider || "provider selected";
  });

  for (const provider of ["agentrouter", "whatstoken"]) {
    await check("AI provider route: " + provider, async () => {
      const data = await postJson("/api/ai/chat", {
        task: "study", provider,
        prompt: "Reply in one sentence: what is photosynthesis?",
      });
      assert.ok(typeof data.answer === "string" && data.answer.trim().length >= 20, "route returned no useful answer");
      return "answered via " + (data.provider || "provider selected") + (data.fallbackUsed ? " (fallback used)" : "");
    });
  }

  await check("PPT generation and task status", async () => {
    const ppt = await postJson("/api/ai/ppt", {
      action: "create",
      query: "Create a short educational presentation about photosynthesis for first-year college learners. Use simple English, accurate concepts and a clear conclusion.",
      slides: 3, style: "clean professional",
    });
    if (ppt.mode === "ai-generated-pptx") {
      assert.ok(Array.isArray(ppt.slides) && ppt.slides.length >= 3, "fallback must return at least three slides");
      for (const [index, slide] of ppt.slides.entries()) {
        assert.ok(slide.title?.trim(), "slide " + (index + 1) + " needs a title");
        assert.ok(Array.isArray(slide.bullets) && slide.bullets.length >= 2, "slide " + (index + 1) + " needs useful bullets");
      }
      return "structured fallback returned " + ppt.slides.length + " slides";
    }
    assert.equal(ppt.status, "RUNNING", "PPT should return a running task or structured fallback slides");
    assert.ok(ppt.taskId && ppt.businessId, "PPT task must return task and business IDs");
    const status = await postJson("/api/ai/ppt", { action: "status", taskId: ppt.taskId, businessId: ppt.businessId });
    assert.ok(typeof status.status === "string" && status.status.length > 0, "PPT task status must be readable");
    return "task accepted; current status " + status.status;
  });

  await check("Exam syllabus search and source links", async () => {
    const data = await postJson("/api/exam/syllabus", { exam: "SSC CGL", context: "India" });
    assert.equal(data.searchedLiveWeb, true, "endpoint did not report live web search");
    assert.ok(Array.isArray(data.results) && data.results.length > 0, "search returned no source links");
    assert.ok(["high", "medium", "low"].includes(data.confidence), "missing confidence label");
    assert.equal(typeof data.summary, "string", "missing summary");
    assert.equal(typeof data.limitations, "string", "missing limitations");
    return data.results.length + " sources; confidence " + data.confidence;
  });

  await check("Quiz generation and source validation", async () => {
    const data = await postJson("/api/quiz", {
      topic: "Photosynthesis and chlorophyll", language: "English", difficulty: "easy",
    });
    assert.equal(data.searched, true, "quiz did not search reference content");
    assert.equal(data.questions?.length, 10, "quiz must return exactly 10 questions");
    assert.ok(data.sources?.length > 0, "quiz returned no sources");
    for (const [index, question] of data.questions.entries()) {
      assert.ok(question.question?.trim(), "question " + (index + 1) + " needs text");
      assert.equal(question.options?.length, 4, "question " + (index + 1) + " needs four options");
      assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4, "question " + (index + 1) + " needs a valid answer index");
      assert.ok(question.explanation?.trim(), "question " + (index + 1) + " needs an explanation");
      assert.ok(/^https?:\/\//i.test(question.sourceUrl || ""), "question " + (index + 1) + " needs a source URL");
    }
    return "10 MCQs validated; " + data.sources.length + " sources";
  });

  if (failures.length) {
    console.error("\nLive AI smoke summary: " + (6 - failures.length) + "/6 checks passed; " + failures.length + " failed.");
    for (const failure of failures) console.error("- " + failure.name + ": " + failure.reason);
    process.exitCode = 1;
    return;
  }
  console.log("\nAll 6 live AI smoke checks passed.");
}

run().catch(error => {
  console.error("Live AI smoke runner crashed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
