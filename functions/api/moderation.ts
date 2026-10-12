import { authorized, json, type ModeratorEnv } from "../_lib/moderator";

export async function onRequestGet({ request, env }: { request: Request; env: ModeratorEnv }): Promise<Response> {
  if (!env.HARYOMIX_MODERATOR_TOKEN) return json({ error: "Moderator access is not configured. Set the HARYOMIX_MODERATOR_TOKEN secret in Cloudflare Pages." }, 503);
  if (!await authorized(request, env)) return json({ error: "Moderator authentication required." }, 401);
  if (!env.DB) return json({ error: "Database is unavailable." }, 503);
  try {
    const result = await env.DB.prepare(
      "SELECT r.id AS reportId, r.post_id AS postId, r.reason, r.details, r.created_at AS reportedAt, r.status AS reportStatus, p.display_name AS displayName, p.message, p.created_at AS postCreatedAt, p.status AS postStatus FROM community_reports r JOIN community_posts p ON p.id = r.post_id ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 100"
    ).bind().all();
    return json({ reports: result.results ?? [] });
  } catch {
    return json({ error: "Could not load reports. Ensure the community report migration has been applied." }, 503);
  }
}

export async function onRequestPost({ request, env }: { request: Request; env: ModeratorEnv }): Promise<Response> {
  if (!env.HARYOMIX_MODERATOR_TOKEN) return json({ error: "Moderator access is not configured. Set the HARYOMIX_MODERATOR_TOKEN secret in Cloudflare Pages." }, 503);
  if (!await authorized(request, env)) return json({ error: "Moderator authentication required." }, 401);
  if (!env.DB) return json({ error: "Database is unavailable." }, 503);
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return json({ error: "Send a JSON request." }, 415);
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 2048) return json({ error: "Request body is too large." }, 413);
  let raw: string;
  try { raw = await request.text(); } catch { return json({ error: "Could not read request body." }, 400); }
  if (new TextEncoder().encode(raw).byteLength > 2048) return json({ error: "Request body is too large." }, 413);
  let input: unknown;
  try { input = JSON.parse(raw); } catch { return json({ error: "Invalid JSON body." }, 400); }
  if (!input || typeof input !== "object") return json({ error: "Expected a moderation action." }, 400);
  const body = input as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  const reportId = Number(body.reportId);
  const postId = Number(body.postId);

  try {
    if (action === "hide_post" || action === "restore_post") {
      if (!Number.isSafeInteger(postId) || postId < 1) return json({ error: "Choose a valid post." }, 400);
      const status = action === "hide_post" ? "hidden" : "published";
      const result = await env.DB.prepare("UPDATE community_posts SET status = ? WHERE id = ?").bind(status, postId).run() as { meta?: { changes?: number } };
      if (!result.meta?.changes) return json({ error: "Post not found." }, 404);
      return json({ ok: true, message: status === "hidden" ? "Post hidden from the public feed." : "Post restored to the public feed." });
    }
    if (action === "dismiss_report" || action === "mark_reviewed") {
      if (!Number.isSafeInteger(reportId) || reportId < 1) return json({ error: "Choose a valid report." }, 400);
      const status = action === "dismiss_report" ? "dismissed" : "reviewed";
      const result = await env.DB.prepare("UPDATE community_reports SET status = ? WHERE id = ?").bind(status, reportId).run() as { meta?: { changes?: number } };
      if (!result.meta?.changes) return json({ error: "Report not found." }, 404);
      return json({ ok: true, message: status === "dismissed" ? "Report dismissed." : "Report marked as reviewed." });
    }
    return json({ error: "Unsupported moderation action." }, 400);
  } catch {
    return json({ error: "Could not apply moderation action." }, 503);
  }
}
