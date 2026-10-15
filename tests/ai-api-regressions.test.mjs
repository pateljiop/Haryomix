import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as chatPost } from "../functions/api/ai/chat.ts";
import { onRequestPost as imagePost } from "../functions/api/ai/image.ts";
import { onRequestPost as pptPost } from "../functions/api/ai/ppt.ts";
import { onRequestPost as workersAiPost } from "../functions/api/ai.ts";
import { onRequestPost as researchSearchPost } from "../functions/api/research/search.ts";

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


test("chat API rejects non-JSON, malformed JSON, and oversized request bodies", async () => {
  const nonJson = await chatPost({
    request: new Request("https://example.test/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hello",
    }),
    env: {},
  });
  assert.equal(nonJson.status, 415);

  const malformed = await chatPost({
    request: new Request("https://example.test/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }),
    env: {},
  });
  assert.equal(malformed.status, 400);

  const oversized = await chatPost({
    request: new Request("https://example.test/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "general", prompt: "x".repeat(20_100) }),
    }),
    env: {},
  });
  assert.equal(oversized.status, 413);
});

test("image API rejects non-JSON, malformed JSON, and oversized request bodies", async () => {
  const nonJson = await imagePost({
    request: new Request("https://example.test/api/ai/image", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hello",
    }),
    env: {},
  });
  assert.equal(nonJson.status, 415);

  const malformed = await imagePost({
    request: new Request("https://example.test/api/ai/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }),
    env: {},
  });
  assert.equal(malformed.status, 400);

  const oversized = await imagePost({
    request: new Request("https://example.test/api/ai/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "x".repeat(9_000) }),
    }),
    env: {},
  });
  assert.equal(oversized.status, 413);
});

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

test("PPT API uses Pollinations as the free-configured fallback when Felo is unavailable", async () => {
  await withMockFetch(async (input, init) => {
    assert.equal(String(input), "https://gen.pollinations.ai/v1/chat/completions");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-pollinations-key");
    const requestBody = JSON.parse(String(init?.body || "{}"));
    assert.equal(requestBody.model, "openai");
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      title: "Solar Energy",
      slides: [
        { title: "Introduction", bullets: ["Solar panels convert sunlight into electricity", "Photovoltaic cells generate direct current"] },
        { title: "Benefits", bullets: ["Low operational emissions", "Can reduce grid electricity use"] },
        { title: "Conclusion", bullets: ["Output depends on sunlight and system design", "Storage can support use after sunset"] }
      ]
    }) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }, async () => {
    const response = await pptPost({
      request: jsonRequest("https://example.test/api/ai/ppt", { action: "create", query: "Create a presentation about solar energy for students", slides: 3 }),
      env: { DB: mockDb(), POLLINATIONS_API_KEY: "test-pollinations-key" },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.mode, "ai-generated-pptx");
    assert.equal(body.provider, "pollinations");
    assert.equal(body.slides.length, 3);
  });
});

test("PPT API falls back to Groq slide content when Felo is not configured", async () => {
  await withMockFetch(async input => {
    assert.equal(String(input), "https://api.groq.com/openai/v1/chat/completions");
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      title: "Photosynthesis",
      slides: [
        { title: "Overview", bullets: ["Plants capture light energy", "Chlorophyll absorbs light"], notes: "Introduce the topic." },
        { title: "Process", bullets: ["Light reactions", "Calvin cycle"], notes: "Explain both stages." },
        { title: "Summary", bullets: ["Energy conversion supports life", "Plants store chemical energy"] }
      ]
    }) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }, async () => {
    const response = await pptPost({
      request: jsonRequest("https://example.test/api/ai/ppt", { action: "create", query: "Create a presentation explaining photosynthesis for students", slides: 3 }),
      env: { DB: mockDb(), GROQ_API_KEY: "test-groq-key" },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.mode, "ai-generated-pptx");
    assert.equal(body.provider, "groq");
    assert.equal(body.status, "COMPLETED");
    assert.equal(body.slides.length, 3);
    assert.equal(body.slides[0].title, "Overview");
  });
});

test("PPT API falls back to Gemini slide content when Felo generation fails", async () => {
  await withMockFetch(async input => {
    const url = String(input);
    if (url === "https://openapi.felo.ai/v2/ppts") return new Response(JSON.stringify({ error: "credits exhausted" }), { status: 402 });
    if (url.startsWith("https://generativelanguage.googleapis.com/")) {
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        title: "Water Cycle",
        slides: [
          { title: "Evaporation", subtitle: "Solar energy moves water into the atmosphere.", section: "WATER MOVEMENT", layout: "spotlight", takeaway: "Energy from the Sun drives the cycle.", bullets: ["Heat changes liquid water into vapor", "Water vapor rises into the atmosphere"], notes: "Explain the energy input and transition to condensation." },
          { title: "Condensation", bullets: ["Vapor cools and forms droplets", "Clouds are made of tiny droplets or ice crystals"] },
          { title: "Collection", bullets: ["Water returns through precipitation", "Runoff and groundwater collect in rivers and oceans"] }
        ]
      }) }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error("Unexpected provider URL: " + url);
  }, async () => {
    const response = await pptPost({
      request: jsonRequest("https://example.test/api/ai/ppt", { action: "create", query: "Explain the water cycle to middle-school students", slides: 3 }),
      env: { DB: mockDb(), FELO_API_KEY: "test-felo-key", GEMINI_API_KEY: "test-gemini-key" },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.mode, "ai-generated-pptx");
    assert.equal(body.provider, "gemini");
    assert.equal(body.slides.length, 3);
    assert.equal(body.slides[0].subtitle, "Solar energy moves water into the atmosphere.");
    assert.equal(body.slides[0].section, "WATER MOVEMENT");
    assert.equal(body.slides[0].layout, "spotlight");
    assert.equal(body.slides[0].takeaway, "Energy from the Sun drives the cycle.");
    assert.match(body.slides[0].notes, /energy input/i);
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


test("research search combines Crossref, arXiv, and Internet Archive results", async () => {
  await withMockFetch(async input => {
    const url = String(input);
    if (url.includes("api.openalex.org/works")) {
      return new Response(JSON.stringify({ results: [{
        id: "https://openalex.org/W1234567890",
        doi: "https://doi.org/10.5555/openalex-test",
        title: "OpenAlex Educational Research",
        publication_year: 2026,
        publication_date: "2026-03-04",
        authorships: [{ author: { display_name: "Test Author" } }]
      }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("api.crossref.org/works")) {
      return new Response(JSON.stringify({ message: { items: [{
        title: ["Open Educational Resources in Higher Education"],
        DOI: "10.1234/example",
        publisher: "Example Publisher",
        published: { "date-parts": [[2026, 2, 3]] }
      }] } }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("export.arxiv.org/api/query")) {
      return new Response(`<?xml version="1.0"?><feed><entry><id>https://arxiv.org/abs/2601.12345</id><title>Open Learning Research</title><published>2026-01-20T00:00:00Z</published><summary>Research on open learning.</summary></entry></feed>`, { status: 200 });
    }
    if (url.includes("archive.org/advancedsearch.php")) {
      return new Response(JSON.stringify({ response: { docs: [{ identifier: "open-study-book", title: "Free Study Book", creator: "Example Author", date: "2025" }] } }), { status: 200 });
    }
    throw new Error("Unexpected research URL: " + url);
  }, async () => {
    const response = await researchSearchPost({
      request: jsonRequest("https://example.test/api/research/search", { query: "open educational resources" }),
      env: {},
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.sources.length, 4);
    assert.deepEqual(body.sources.map(item => item.source), ["OpenAlex", "Crossref", "arXiv", "Internet Archive"]);
    assert.equal(body.sources[0].url, "https://doi.org/10.5555/openalex-test");
    assert.match(body.sources[0].url, /^https:\/\/doi\.org\//);
    assert.match(body.sources[1].url, /^https:\/\/arxiv\.org\/abs\//);
    assert.match(body.sources[2].url, /^https:\/\/archive\.org\/details\//);
  });
});

test("research search validates query and never requires an API key", async () => {
  const invalid = await researchSearchPost({
    request: jsonRequest("https://example.test/api/research/search", { query: "  " }),
    env: {},
  });
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /at least 3 characters/i);
});


test("research search keeps OpenAlex API key server-side and supports keyed requests", async () => {
  let requestedUrl = "";
  await withMockFetch(async input => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }, async () => {
    const response = await researchSearchPost({
      request: jsonRequest("https://example.test/api/research/search", { query: "open learning" }),
      env: { OPENALEX_API_KEY: "test-openalex-secret" },
    });
    assert.equal(response.status, 200);
    assert.ok(requestedUrls.some(url => url.includes("api.openalex.org/works") && url.includes("api_key=test-openalex-secret")));
    const body = await response.json();
    assert.equal(body.searched.openAlexKeyConfigured, true);
    assert.equal(JSON.stringify(body).includes("test-openalex-secret"), false);
  });
});
