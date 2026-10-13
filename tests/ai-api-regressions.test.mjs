import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as chatPost } from "../functions/api/ai/chat.ts";
import { onRequestPost as imagePost } from "../functions/api/ai/image.ts";
import { onRequestPost as pptPost } from "../functions/api/ai/ppt.ts";
import { onRequestPost as workersAiPost } from "../functions/api/ai.ts";

function mockDb(count = 1) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          calls.push({ sql, values });
          return this;
        },
        async first() {
          return { count };
        },
        async run() {
          return { success: true };
        },
      };
    },
  };
}

function jsonRequest(url, body, headers = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function withMockFetch(mock, run) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("chat API rejects unsupported tasks before requiring database or providers", async () => {
  const response = await chatPost({
    request: jsonRequest("https://example.test/api/ai/chat", { task: "shell", prompt: "hello" }),
    env: {},
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /supported task/i);
});

test("chat API reports missing rate-limit database as configuration failure", async () => {
  const response = await chatPost({
    request: jsonRequest("https://example.test/api/ai/chat", { task: "general", prompt: "Help me study" }),
    env: {},
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /database binding/i);
});

test("chat API uses a stable hourly rate-limit key and prunes old rows", async () => {
  const db = mockDb();
  const response = await chatPost({
    request: jsonRequest("https://example.test/api/ai/chat", { task: "general", prompt: "Help me study" }),
    env: { DB: db },
  });
  assert.equal(response.status, 503);
  const upsert = db.calls.find(call => call.sql.startsWith("INSERT INTO community_rate_limits"));
  assert.ok(upsert);
  assert.match(upsert.sql, /CASE WHEN community_rate_limits\.bucket = excluded\.bucket THEN community_rate_limits\.request_count \+ 1 ELSE 1 END/);
  assert.equal(upsert.values[0].length, 64);
  assert.match(upsert.values[1], /^\d{4}-\d{2}-\d{2}T\d{2}$/);
  assert.ok(db.calls.some(call => call.sql === "DELETE FROM community_rate_limits WHERE bucket < ?"));
});

test("chat API reports missing providers without exposing secrets", async () => {
  const response = await chatPost({
    request: jsonRequest("https://example.test/api/ai/chat", { task: "general", prompt: "Help me study" }),
    env: { DB: mockDb() },
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, "ai_not_configured");
  assert.equal(JSON.stringify(body).includes("test-secret"), false);
});

test("chat API falls back from a rate-limited Groq response to Gemini", async () => {
  await withMockFetch(async input => {
    const url = String(input);
    if (url.includes("api.groq.com")) return new Response("{}", { status: 429 });
    if (url.includes("generativelanguage.googleapis.com")) {
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Fallback answer" }] } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error("Unexpected provider URL");
  }, async () => {
    const response = await chatPost({
      request: jsonRequest("https://example.test/api/ai/chat", { task: "general", prompt: "Explain recursion", provider: "groq" }),
      env: { DB: mockDb(), GROQ_API_KEY: "test-groq-key", GEMINI_API_KEY: "test-gemini-key" },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.answer, "Fallback answer");
    assert.equal(body.provider, "gemini");
    assert.equal(body.fallbackUsed, true);
  });
});

test("image API distinguishes missing rate-limit database from a real rate limit", async () => {
  const response = await imagePost({
    request: jsonRequest("https://example.test/api/ai/image", { prompt: "A study desk at sunrise", provider: "felo" }),
    env: { FELO_API_KEY: "test-felo-key" },
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "rate_limit_unavailable");
});

test("image API blocks a real rate limit before calling providers", async () => {
  let providerCalled = false;
  await withMockFetch(async () => {
    providerCalled = true;
    throw new Error("Provider must not be called after rate limit");
  }, async () => {
    const response = await imagePost({
      request: jsonRequest("https://example.test/api/ai/image", { prompt: "A study desk at sunrise", provider: "felo" }),
      env: { DB: mockDb(6), FELO_API_KEY: "test-felo-key" },
    });
    assert.equal(response.status, 429);
    assert.equal((await response.json()).code, "rate_limited");
  });
  assert.equal(providerCalled, false);
});

test("image API can parse a mocked Felo image-generation response", async () => {
  await withMockFetch(async input => {
    const url = String(input);
    if (url.endsWith("/api/v1/models")) {
      return new Response(JSON.stringify({ data: [{ id: "test-image-model", model_kind: "image_generation" }] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (url.endsWith("/api/v1/images/generations")) {
      return new Response(JSON.stringify({ data: [{ url: "https://images.example.test/generated.png" }] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error("Unexpected provider URL");
  }, async () => {
    const response = await imagePost({
      request: jsonRequest("https://example.test/api/ai/image", { prompt: "A study desk at sunrise", provider: "felo", size: "1024x1024" }),
      env: { DB: mockDb(), FELO_API_KEY: "test-felo-key" },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.provider, "felo");
    assert.equal(body.model, "test-image-model");
    assert.equal(body.image.url, "https://images.example.test/generated.png");
  });
});

test("PPT API validates topic before rate limiting and provider calls", async () => {
  const response = await pptPost({
    request: jsonRequest("https://example.test/api/ai/ppt", { action: "create", query: "short" }),
    env: {},
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /presentation topic/i);
});


test("PPT API rejects unsupported actions before checking provider configuration", async () => {
  const response = await pptPost({
    request: jsonRequest("https://example.test/api/ai/ppt", { action: "unknown" }),
    env: {},
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /unsupported action/i);
});

test("PPT API reports missing database as setup failure, not rate limiting", async () => {
  const response = await pptPost({
    request: jsonRequest("https://example.test/api/ai/ppt", { action: "create", query: "A detailed presentation topic for testing" }),
    env: { FELO_API_KEY: "test-felo-key" },
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "rate_limit_unavailable");
});

test("PPT API blocks a real creation rate limit before calling Felo", async () => {
  let providerCalled = false;
  await withMockFetch(async () => {
    providerCalled = true;
    throw new Error("Provider must not be called after rate limit");
  }, async () => {
    const response = await pptPost({
      request: jsonRequest("https://example.test/api/ai/ppt", { action: "create", query: "A detailed presentation topic for testing" }),
      env: { DB: mockDb(9), FELO_API_KEY: "test-felo-key" },
    });
    assert.equal(response.status, 429);
    assert.equal((await response.json()).code, "rate_limited");
  });
  assert.equal(providerCalled, false);
});

test("PPT API can parse a mocked Felo presentation task response", async () => {
  await withMockFetch(async input => {
    assert.equal(String(input), "https://openapi.felo.ai/v2/ppts");
    return new Response(JSON.stringify({ data: { task_id: "task-123", ppt_business_id: "business-456", livedoc_short_id: "live-789" } }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }, async () => {
    const response = await pptPost({
      request: jsonRequest("https://example.test/api/ai/ppt", { action: "create", query: "A detailed presentation topic for testing", slides: 12 }),
      env: { DB: mockDb(), FELO_API_KEY: "test-felo-key" },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.taskId, "task-123");
    assert.equal(body.businessId, "business-456");
    assert.equal(body.liveDocId, "live-789");
  });
});

test("legacy Workers AI endpoint returns a safe setup error without a binding", async () => {
  const response = await workersAiPost({
    request: jsonRequest("https://example.test/api/ai", { task: "ask", content: "Explain a loop" }),
    env: {},
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not configured/i);
});
