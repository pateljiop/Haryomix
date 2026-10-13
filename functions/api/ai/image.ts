interface Env {
  FELO_API_KEY?: string;
  POLLINATIONS_API_KEY?: string;
  DB?: { prepare(sql: string): { bind(...values: unknown[]): { first<T = { count: number }>(): Promise<T | null>; run(): Promise<unknown> } } };
}
const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function reply(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers }); }
async function withinLimit(request: Request, env: Env): Promise<boolean> {
  if (!env.DB) return false;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const bucket = new Date().toISOString().slice(0, 13);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("haryomix-ai-image:" + ip));
  const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  const row = await env.DB.prepare("INSERT INTO community_rate_limits (rate_key, request_count, bucket) VALUES (?, 1, ?) ON CONFLICT(rate_key) DO UPDATE SET request_count = CASE WHEN community_rate_limits.bucket = excluded.bucket THEN community_rate_limits.request_count + 1 ELSE 1 END, bucket = excluded.bucket RETURNING request_count AS count").bind(key, bucket).first<{ count: number }>();
  if (!row) throw new Error("Rate-limit counter did not return a row.");
  if (row.count === 1) {
    const expiredBefore = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().slice(0, 13);
    try { await env.DB.prepare("DELETE FROM community_rate_limits WHERE bucket < ?").bind(expiredBefore).run(); } catch { /* Best-effort cleanup; the rate limit itself is already recorded. */ }
  }
  return row.count <= 5;
}
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}
function imageDataUrl(bytes: Uint8Array, contentType: string): string | null {
  if (bytes.byteLength === 0 || bytes.byteLength > 12_000_000) return null;
  const mime = /^image\/(png|jpeg|webp|avif)$/i.test(contentType) ? contentType.split(";")[0] : "image/jpeg";
  return `data:${mime};base64,${toBase64(bytes)}`;
}
async function fromPollinations(prompt: string, size: string, key: string): Promise<Response> {
  const [width, height] = size.split("x").map(Number);
  const url = new URL(`https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}`);
  url.searchParams.set("model", "flux");
  url.searchParams.set("width", String(width));
  url.searchParams.set("height", String(height));
  url.searchParams.set("private", "true");
  url.searchParams.set("safe", "true");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(55_000) });
  if (!response.ok) throw new Error(response.status === 429 ? "rate_limit" : response.status === 402 ? "credits_required" : "pollinations_error");
  const type = response.headers.get("content-type") || "";
  if (!type.toLowerCase().startsWith("image/")) throw new Error("invalid_provider_response");
  const dataUrl = imageDataUrl(new Uint8Array(await response.arrayBuffer()), type);
  if (!dataUrl) throw new Error("image_too_large");
  return reply({ image: { dataUrl }, provider: "pollinations", model: "flux" });
}
async function fromFelo(prompt: string, size: string, key: string): Promise<Response> {
  const modelsResponse = await fetch("https://openapi.felo.ai/api/v1/models", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
  if (!modelsResponse.ok) throw new Error(modelsResponse.status === 429 ? "rate_limit" : "felo_error");
  const catalog = await modelsResponse.json() as { data?: { id?: string; model_kind?: string; type?: string }[] };
  const model = catalog.data?.find(item => item.model_kind === "image_generation" || item.type === "image_generation")?.id;
  if (!model) throw new Error("felo_image_model_unavailable");
  const response = await fetch("https://openapi.felo.ai/api/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, size, n: 1 }),
    signal: AbortSignal.timeout(55_000),
  });
  const data = await response.json().catch(() => null) as any;
  if (!response.ok) throw new Error(response.status === 429 ? "rate_limit" : response.status === 402 ? "credits_required" : "felo_error");
  const image = data?.data?.[0];
  const url = typeof image?.url === "string" && /^https:\/\//i.test(image.url) ? image.url : null;
  const b64 = typeof image?.b64_json === "string" && image.b64_json.length < 15_000_000 ? image.b64_json : null;
  if (!url && !b64) throw new Error("invalid_provider_response");
  return reply({ image: url ? { url } : { dataUrl: `data:image/png;base64,${b64}` }, provider: "felo", model });
}
export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return reply({ error: "Send a JSON request." }, 415);
  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (declaredLength > 8_192) return reply({ error: "Request body is too large." }, 413);
  let rawBody: string;
  try { rawBody = await request.text(); } catch { return reply({ error: "Could not read request body." }, 400); }
  if (new TextEncoder().encode(rawBody).byteLength > 8_192) return reply({ error: "Request body is too large." }, 413);
  let body: any;
  try { body = JSON.parse(rawBody); } catch { return reply({ error: "Invalid JSON." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ error: "Expected a JSON object." }, 400);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 3000) : "";
  if (prompt.length < 5) return reply({ error: "Describe the image you want to create." }, 400);
  const size = ["1024x1024", "1536x1024", "1024x1536"].includes(body?.size) ? body.size : "1024x1024";
  const preferred = body?.provider === "pollinations" ? "pollinations" : body?.provider === "felo" ? "felo" : "auto";
  const providers = preferred === "pollinations" ? ["pollinations"] : preferred === "felo" ? ["felo"] : ["felo", "pollinations"];
  if (!providers.some(p => p === "felo" ? Boolean(env.FELO_API_KEY) : Boolean(env.POLLINATIONS_API_KEY))) {
    return reply({ error: "Configure FELO_API_KEY or POLLINATIONS_API_KEY as a Cloudflare Pages secret.", code: "provider_not_configured" }, 503);
  }
  if (!env.DB) return reply({ error: "AI request protection is not configured. Database binding is required.", code: "rate_limit_unavailable" }, 503);
  try {
    if (!await withinLimit(request, env)) return reply({ error: "AI image limit reached for this hour. Please retry later.", code: "rate_limited" }, 429);
  } catch {
    return reply({ error: "AI request protection is temporarily unavailable.", code: "rate_limit_unavailable" }, 503);
  }
  const errors: string[] = [];
  for (const provider of providers) {
    try {
      if (provider === "felo" && env.FELO_API_KEY) return await fromFelo(prompt, size, env.FELO_API_KEY);
      if (provider === "pollinations" && env.POLLINATIONS_API_KEY) return await fromPollinations(prompt, size, env.POLLINATIONS_API_KEY);
      errors.push(provider + "_not_configured");
    } catch (error) {
      const code = error instanceof Error ? error.message : "provider_error";
      errors.push(code);
      if (code === "rate_limit") continue;
    }
  }
  const status = errors.includes("rate_limit") ? 429 : errors.includes("credits_required") ? 402 : 502;
  const error = errors.includes("credits_required")
    ? "The selected image provider needs credits."
    : errors.includes("felo_image_model_unavailable")
      ? "Felo has no image-generation model enabled for this key. Add POLLINATIONS_API_KEY to enable the fallback."
      : errors.includes("rate_limit")
        ? "Image providers are rate-limiting requests. Retry shortly."
        : errors.includes("image_too_large")
          ? "Generated image exceeded the safe response-size limit. Try a smaller size."
          : "Image generation failed. Check provider keys, model access, and credits.";
  return reply({ error, code: errors[0] || "provider_error" }, status);
}
