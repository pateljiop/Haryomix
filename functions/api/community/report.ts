interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
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

const allowedReasons = new Set(["spam", "harassment", "personal_info", "other"]);

export async function onRequestPost({ env, request }: { env: Env; request: Request }): Promise<Response> {
  if (!env.DB) return response({ error: "Community reporting is not configured." }, 503);
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return response({ error: "Send a JSON request." }, 415);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 4096) return response({ error: "Request body is too large." }, 413);

  let raw: string;
  try { raw = await request.text(); } catch { return response({ error: "Could not read request body." }, 400); }
  if (new TextEncoder().encode(raw).byteLength > 4096) return response({ error: "Request body is too large." }, 413);

  let input: unknown;
  try { input = JSON.parse(raw); } catch { return response({ error: "Invalid JSON body." }, 400); }
  if (!input || typeof input !== "object") return response({ error: "Expected a report object." }, 400);
  const body = input as Record<string, unknown>;
  const postId = Number(body.postId);
  const reason = typeof body.reason === "string" ? body.reason : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";
  if (!Number.isSafeInteger(postId) || postId < 1) return response({ error: "Choose a valid post." }, 400);
  if (!allowedReasons.has(reason)) return response({ error: "Choose a valid report reason." }, 400);
  if (details.length > 300) return response({ error: "Details must be 300 characters or fewer." }, 400);

  try {
    const post = await env.DB.prepare(
      "SELECT id FROM community_posts WHERE id = ? AND status = 'published'"
    ).bind(postId).first<{ id: number }>();
    if (!post) return response({ error: "That post is no longer available." }, 404);

    const forwarded = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const bucket = new Date().toISOString().slice(0, 13);
    const rateKey = "report:" + await digest(forwarded + ":" + bucket);
    const expiredBefore = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().slice(0, 13);
    await env.DB.prepare("DELETE FROM community_rate_limits WHERE bucket < ?").bind(expiredBefore).run();
    const current = await env.DB.prepare(
      "INSERT INTO community_rate_limits (rate_key, request_count, bucket) VALUES (?, 1, ?) ON CONFLICT(rate_key) DO UPDATE SET request_count = request_count + 1 RETURNING request_count AS count"
    ).bind(rateKey, bucket).first<{ count: number }>();
    if (!current || current.count > 10) return response({ error: "Report limit reached. Try again later." }, 429);

    await env.DB.prepare(
      "INSERT INTO community_reports (post_id, reason, details, created_at) VALUES (?, ?, ?, ?)"
    ).bind(postId, reason, details, new Date().toISOString()).run();
    return response({ ok: true, message: "Report received for review." }, 201);
  } catch {
    return response({ error: "Could not save the report. Please try again later." }, 503);
  }
}
