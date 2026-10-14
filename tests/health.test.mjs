import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/health.ts";

function mockDb({ tableReady = true } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      calls.push(sql);
      return {
        async first() {
          if (sql.includes("community_rate_limits") && !tableReady) {
            throw new Error("no such table");
          }
          return { ok: 1 };
        },
      };
    },
  };
}

test("health reports ready chat and PPT only when required bindings and providers exist", async () => {
  const response = await onRequestGet({
    env: {
      DB: mockDb(),
      GROQ_API_KEY: "test-groq-secret",
      FELO_API_KEY: "test-felo-secret",
    },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.checks.chatReady, true);
  assert.equal(body.checks.pptReady, true);
  assert.equal(body.aiProviders.groq, true);
  assert.equal(body.aiProviders.gemini, false);
  assert.equal(JSON.stringify(body).includes("test-groq-secret"), false);
  assert.equal(JSON.stringify(body).includes("test-felo-secret"), false);
});

test("health identifies missing provider and database configuration without exposing secrets", async () => {
  const response = await onRequestGet({ env: { DB: mockDb() } });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.status, "needs-setup");
  assert.equal(body.checks.chatReady, false);
  assert.equal(body.checks.pptReady, false);
});

test("health reports a missing rate-limit table", async () => {
  const response = await onRequestGet({
    env: { DB: mockDb({ tableReady: false }), GROQ_API_KEY: "test-secret", FELO_API_KEY: "test-secret-2" },
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.databaseChecks.reachable, true);
  assert.equal(body.databaseChecks.rateLimitTableReady, false);
  assert.equal(body.checks.chatReady, false);
  assert.equal(body.checks.pptReady, false);
});
