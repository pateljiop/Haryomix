import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet as healthGet } from "../functions/api/health.ts";
import { onRequestGet as communityGet, onRequestPost as communityPost } from "../functions/api/community.ts";
import { authorized } from "../functions/_lib/moderator.ts";

function mockDb({ first, all, run } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const statement = {
        sql,
        values: [],
        bind(...values) {
          this.values = values;
          calls.push({ sql, values });
          return this;
        },
        async first() {
          if (first) return first(this.sql, this.values);
          if (this.sql.includes("SELECT 1 AS ok")) return { ok: 1 };
          if (this.sql.includes("RETURNING request_count AS count")) return { count: 1 };
          return null;
        },
        async all() {
          if (all) return all(this.sql, this.values);
          return { results: [] };
        },
        async run() {
          if (run) return run(this.sql, this.values);
          if (this.sql.includes("INSERT INTO community_posts")) return { meta: { last_row_id: 7 } };
          return { success: true };
        },
      };
      return statement;
    },
  };
}

test("health reports setup needed when D1 is missing", async () => {
  const response = await healthGet({ env: {} });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).database, "not-configured");
});

test("health confirms a reachable D1 binding", async () => {
  const response = await healthGet({ env: { DB: mockDb() } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ok");
});

test("community GET returns 503 when D1 is not configured", async () => {
  const response = await communityGet({ env: {}, request: new Request("https://example.test/api/community") });
  assert.equal(response.status, 503);
});

test("community GET clamps oversized limits to 50", async () => {
  const db = mockDb({ all: async () => ({ results: [] }) });
  const response = await communityGet({
    env: { DB: db },
    request: new Request("https://example.test/api/community?limit=500"),
  });
  assert.equal(response.status, 200);
  assert.equal(db.calls.at(-1).values[0], 50);
});

test("community POST rejects non-JSON requests", async () => {
  const response = await communityPost({
    env: { DB: mockDb() },
    request: new Request("https://example.test/api/community", { method: "POST", body: "hello", headers: { "Content-Type": "text/plain" } }),
  });
  assert.equal(response.status, 415);
});

test("community POST rejects malformed JSON", async () => {
  const response = await communityPost({
    env: { DB: mockDb() },
    request: new Request("https://example.test/api/community", { method: "POST", body: "{", headers: { "Content-Type": "application/json" } }),
  });
  assert.equal(response.status, 400);
});

test("community POST validates display name and message before database writes", async () => {
  const db = mockDb();
  const response = await communityPost({
    env: { DB: db },
    request: new Request("https://example.test/api/community", {
      method: "POST",
      body: JSON.stringify({ displayName: "A", message: "hi" }),
      headers: { "Content-Type": "application/json" },
    }),
  });
  assert.equal(response.status, 400);
  assert.equal(db.calls.length, 0);
});

test("community POST normalizes name whitespace and returns created post", async () => {
  const db = mockDb();
  const response = await communityPost({
    env: { DB: db },
    request: new Request("https://example.test/api/community", {
      method: "POST",
      body: JSON.stringify({ displayName: "  Haryomix   Student ", message: "Useful workspace!" }),
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1" },
    }),
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.post.displayName, "Haryomix Student");
  assert.equal(body.post.message, "Useful workspace!");
  assert.equal(body.post.id, 7);
});

test("moderator authorization rejects missing or weak tokens", async () => {
  assert.equal(await authorized(new Request("https://example.test"), { HARYOMIX_MODERATOR_TOKEN: "short" }), false);
  assert.equal(await authorized(new Request("https://example.test", { headers: { Authorization: "Bearer " + "x".repeat(40) } }), { HARYOMIX_MODERATOR_TOKEN: "y".repeat(40) }), false);
});

test("moderator authorization accepts an exact configured bearer token", async () => {
  const token = "test-token-that-is-longer-than-thirty-two-characters";
  const request = new Request("https://example.test", { headers: { Authorization: "Bearer " + token } });
  assert.equal(await authorized(request, { HARYOMIX_MODERATOR_TOKEN: token }), true);
});
