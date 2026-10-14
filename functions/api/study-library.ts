interface Env {
  DB?: { prepare(sql: string): { bind(...values: unknown[]): { all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>; first<T = Record<string, unknown>>(): Promise<T | null> } } };
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  GEMINI_API_KEY?: string;
}
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const clean = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";
function b64url(bytes: Uint8Array): string { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
async function driveToken(env: Env): Promise<string> {
  const pem = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !pem) throw new Error("drive");
  const der = Uint8Array.from(atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "")), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const enc = new TextEncoder(); const json64 = (v: unknown) => b64url(enc.encode(JSON.stringify(v))); const now = Math.floor(Date.now() / 1000);
  const unsigned = json64({ alg: "RS256", typ: "JWT" }) + "." + json64({ iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, scope: "https://www.googleapis.com/auth/drive.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const assertion = unsigned + "." + b64url(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(unsigned))));
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error("auth");
  const data = await res.json() as { access_token?: string }; if (!data.access_token) throw new Error("auth"); return data.access_token;
}
export async function onRequestGet({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!env.DB) return json({ error: "Study library is temporarily unavailable." }, 503);
  const q = clean(new URL(request.url).searchParams.get("q"), 100);
  try {
    const result = q
      ? await env.DB.prepare("SELECT id, title, file_size AS fileSize, source_modified_at AS updatedAt FROM study_documents WHERE status='ready' AND title LIKE ? ORDER BY title COLLATE NOCASE LIMIT 100").bind("%" + q.replace(/[\\%_]/g, "\\$&") + "%").all()
      : await env.DB.prepare("SELECT id, title, file_size AS fileSize, source_modified_at AS updatedAt FROM study_documents WHERE status='ready' ORDER BY title COLLATE NOCASE LIMIT 100").bind().all();
    return json({ documents: result.results ?? [] });
  } catch { return json({ error: "Study library is temporarily unavailable." }, 503); }
}
export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!env.DB || !env.GEMINI_API_KEY) return json({ error: "Study generation is not configured yet." }, 503);
  let body: Record<string, unknown>; try { body = await request.json() as Record<string, unknown>; } catch { return json({ error: "Invalid request." }, 400); }
  const id = Number(body.documentId); const mode = body.mode === "quiz" ? "quiz" : "notes"; const topic = clean(body.topic, 180);
  if (!Number.isSafeInteger(id) || id < 1 || topic.length < 2) return json({ error: "Choose a document and enter a chapter or topic." }, 400);
  try {
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("haryomix-study:" + ip));
    const rateKey = "study:" + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    const bucket = new Date().toISOString().slice(0, 13);
    const rate = await env.DB.prepare("INSERT INTO community_rate_limits (rate_key,request_count,bucket) VALUES (?,1,?) ON CONFLICT(rate_key) DO UPDATE SET request_count=CASE WHEN community_rate_limits.bucket=excluded.bucket THEN community_rate_limits.request_count+1 ELSE 1 END,bucket=excluded.bucket RETURNING request_count AS count").bind(rateKey,bucket).first<{count:number}>();
    if (!rate) return json({ error: "Study generation is temporarily unavailable." }, 503);
    if (rate.count > 5) return json({ error: "You have reached the study generation limit. Please try again later." }, 429);
    const doc = await env.DB.prepare("SELECT drive_file_id AS driveId, title FROM study_documents WHERE id=? AND status='ready'").bind(id).first<{ driveId: string; title: string }>();
    if (!doc) return json({ error: "This study material is not available." }, 404);
    const token = await driveToken(env);
    const pdfRes = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(doc.driveId) + "?alt=media", { headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(20000) });
    if (!pdfRes.ok) return json({ error: "This study material could not be opened right now." }, 502);
    const bytes = new Uint8Array(await pdfRes.arrayBuffer());
    if (bytes.byteLength < 8 || bytes.byteLength > 15 * 1024 * 1024) return json({ error: "This PDF is empty or larger than the 15 MB processing limit." }, 413);
    let binary = ""; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const prompt = mode === "quiz"
      ? "Use only the supplied study document. Create exactly 25 MCQs for topic: " + topic + ". Each question must have options A-D, one correct answer, and a short explanation. Do not invent facts unsupported by the source. If source coverage is insufficient, say so. Output Markdown with separate Answer Key and Explanations."
      : "Use only the supplied study document to create substantial Haryomix study notes for topic: " + topic + ". Include Revision Notes and Detailed Notes, definitions, examples, code snippets if relevant, common mistakes, and an exam-focused summary. Do not invent facts; state when the source does not cover a requested detail.";
    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "application/pdf", data: btoa(binary) } }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 7000 } }), signal: AbortSignal.timeout(55000) });
    if (!aiRes.ok) return json({ error: aiRes.status === 429 ? "Study generation is busy. Please retry shortly." : "Could not generate study content right now." }, aiRes.status === 429 ? 429 : 502);
    const data = await aiRes.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const content = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("").trim();
    if (!content) return json({ error: "No study content was generated. Try a more specific topic." }, 502);
    return json({ title: doc.title, topic, mode, content });
  } catch { return json({ error: "Could not process this study material right now." }, 503); }
}
