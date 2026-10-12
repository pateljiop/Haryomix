interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
}
interface Database { prepare(sql: string): Statement }
interface Env { DB?: Database }

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestGet({ env, request }: { env: Env; request: Request }): Promise<Response> {
  if (!env.DB) return response({ error: "Community API is not configured yet. Attach the HARYOMIX_DB D1 binding." }, 503);
  try {
    const url = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
    const result = await env.DB.prepare(
      "SELECT id, display_name AS displayName, message, created_at AS createdAt FROM community_posts WHERE status = 'published' ORDER BY id DESC LIMIT ?"
    ).bind(limit).all();
    return response({ posts: result.results ?? [] });
  } catch {
    return response({ error: "Community storage is not ready. Apply the database migration and retry." }, 503);
  }
}

export async function onRequestPost({ env, request }: { env: Env; request: Request }): Promise<Response> {
  if (!env.DB) return response({ error: "Community API is not configured yet. Attach the HARYOMIX_DB D1 binding." }, 503);
  if (request.headers.get("content-type")?.toLowerCase().includes("application/json") !== true) {
    return response({ error: "Send a JSON request." }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 8192) return response({ error: "Request body is too large." }, 413);

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return response({ error: "Could not read request body." }, 400);
  }
  if (new TextEncoder().encode(rawBody).byteLength > 8192) {
    return response({ error: "Request body is too large." }, 413);
  }

  let input: unknown;
  try { input = JSON.parse(rawBody); } catch { return response({ error: "Invalid JSON body." }, 400); }
  if (!input || typeof input !== "object") return response({ error: "Expected a post object." }, 400);

  const body = input as Record<string, unknown>;
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().replace(/\s+/g, " ") : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (displayName.length < 2 || displayName.length > 40) {
    return response({ error: "Name must be between 2 and 40 characters." }, 400);
  }
  if (message.length < 3 || message.length > 500) {
    return response({ error: "Post must be between 3 and 500 characters." }, 400);
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(message)) {
    return response({ error: "Post contains unsupported control characters." }, 400);
  }

  try {
    // Keep only a one-way digest for abuse throttling; never store raw IP addresses.
    const forwarded = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const bucket = new Date().toISOString().slice(0, 13);
    const rateKey = await digest(forwarded + ":" + bucket);
    // Keep the throttle table bounded by removing expired hourly buckets.
    const expiredBefore = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().slice(0, 13);
    await env.DB.prepare("DELETE FROM community_rate_limits WHERE bucket < ?").bind(expiredBefore).run();
    await env.DB.prepare(
      "INSERT INTO community_rate_limits (rate_key, request_count, bucket) VALUES (?, 1, ?) ON CONFLICT(rate_key) DO UPDATE SET request_count = request_count + 1"
    ).bind(rateKey, bucket).run();
    const current = await env.DB.prepare(
      "SELECT request_count AS count FROM community_rate_limits WHERE rate_key = ?"
    ).bind(rateKey).first<{ count: number }>();
    if (!current || current.count > 5) return response({ error: "Posting limit reached. Try again later." }, 429);

    const createdAt = new Date().toISOString();
    const insert = await env.DB.prepare(
      "INSERT INTO community_posts (display_name, message, status, created_at) VALUES (?, ?, 'published', ?)"
    ).bind(displayName, message, createdAt).run();
    const id = Number((insert as { meta?: { last_row_id?: number } }).meta?.last_row_id ?? 0);
    return response({ post: { id, displayName, message, createdAt } }, 201);
  } catch {
    return response({ error: "Community storage is not ready. Apply the database migration and retry." }, 503);
  }
}
