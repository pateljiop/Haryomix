interface Env {
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  DB?: { prepare(sql: string): { bind(...values: unknown[]): { first<T = { count: number }>(): Promise<T | null>; run(): Promise<unknown> } } };
}
const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function reply(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers }); }
type Source = { title: string; url: string; extract: string };
type QuizItem = { question: string; options: string[]; answer: number; explanation: string; sourceTitle: string };
function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

async function searchTopic(topic: string): Promise<Source[]> {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({ action: "query", generator: "search", gsrsearch: topic, gsrnamespace: "0", gsrlimit: "5", prop: "extracts", exintro: "1", explaintext: "1", exsentences: "8", exchars: "2600", format: "json", origin: "*" }).toString();
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "HaryomixStudentWorkspace/1.0 (topic research quiz)" }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error("search_unavailable");
  const data = await response.json() as { query?: { pages?: Record<string, { title?: string; extract?: string }> } };
  return Object.values(data.query?.pages ?? {}).map(page => ({ title: page.title ?? "", url: "https://en.wikipedia.org/wiki/" + encodeURIComponent((page.title ?? "").replace(/ /g, "_")), extract: (page.extract ?? "").slice(0, 2600) })).filter(page => page.title && page.extract.length > 80).slice(0, 5);
}
async function ask(provider: "groq" | "gemini", key: string, topic: string, language: string, difficulty: string, sources: Source[]): Promise<string> {
  const system = `You are a careful academic quiz writer. Use ONLY the supplied source extracts; do not add remembered facts. Return valid JSON only, no Markdown. Create exactly 10 multiple-choice questions in the requested language. Questions must be distinct, specific, factually supported by the source extracts, and appropriate to the requested difficulty. Each question must have four plausible distinct options, exactly one correct option indexed 0-3, and a short explanation that is supported by the sources. Include sourceTitle matching one supplied title. If the sources do not support a claim, do not ask it. Schema: {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"...","sourceTitle":"..."}]}`;
  const prompt = JSON.stringify({ topic, language, difficulty, sources: sources.map(s => ({ title: s.title, url: s.url, extract: s.extract })) });
  const response = provider === "groq"
    ? await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify({ model: "openai/gpt-oss-120b", temperature: 0.1, max_tokens: 5000, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }), signal: AbortSignal.timeout(30_000) })
    : await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 5000, responseMimeType: "application/json" } }), signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "credentials_rejected" : response.status === 429 ? "rate_limited" : response.status === 400 || response.status === 404 ? "model_unavailable" : "provider_error");
  const data = await response.json() as any;
  const text = provider === "groq" ? data?.choices?.[0]?.message?.content : data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("");
  if (typeof text !== "string" || !text.trim()) throw new Error("empty_response");
  return text.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
}
export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return reply({ error: "Send a JSON request." }, 415);
  let body: any;
  try { const raw = await request.text(); if (new TextEncoder().encode(raw).byteLength > 5000) return reply({ error: "Request too large." }, 413); body = JSON.parse(raw); } catch { return reply({ error: "Invalid JSON request." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ error: "Expected a quiz request." }, 400);
  const topic = clean(body.topic, 180), language = clean(body.language, 30) || "English", difficulty = ["easy", "medium", "hard"].includes(body.difficulty) ? body.difficulty : "medium";
  if (topic.length < 3) return reply({ error: "Enter a topic with at least 3 characters." }, 400);
  if (!env.DB) return reply({ error: "AI request protection is not configured: Cloudflare D1 binding DB is required.", code: "rate_limit_unavailable" }, 503);
  try {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("haryomix-topic-quiz:" + ip));
    const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    const bucket = new Date().toISOString().slice(0, 13);
    const row = await env.DB.prepare("INSERT INTO community_rate_limits (rate_key, request_count, bucket) VALUES (?, 1, ?) ON CONFLICT(rate_key) DO UPDATE SET request_count = CASE WHEN community_rate_limits.bucket = excluded.bucket THEN community_rate_limits.request_count + 1 ELSE 1 END, bucket = excluded.bucket RETURNING request_count AS count").bind(key, bucket).first<{ count: number }>();
    if (!row) return reply({ error: "Request protection is temporarily unavailable." }, 503);
    if (row.count > 8) return reply({ error: "Quiz generation limit reached for this hour. Try again later.", code: "rate_limited" }, 429);
  } catch { return reply({ error: "Request protection is temporarily unavailable." }, 503); }
  const available: Array<{ provider: "groq" | "gemini"; key: string }> = [];
  if (env.GROQ_API_KEY) available.push({ provider: "groq", key: env.GROQ_API_KEY });
  if (env.GEMINI_API_KEY) available.push({ provider: "gemini", key: env.GEMINI_API_KEY });
  if (!available.length) return reply({ error: "No quiz AI provider configured. Add GROQ_API_KEY or GEMINI_API_KEY as a Cloudflare Pages secret.", code: "ai_not_configured" }, 503);
  let sources: Source[];
  try { sources = await searchTopic(topic); } catch { return reply({ error: "Could not search reference content right now. Please retry.", code: "search_unavailable" }, 502); }
  if (!sources.length) return reply({ error: "No reliable reference content found for this topic. Try a more specific topic.", code: "no_sources" }, 404);
  const issues: string[] = [];
  for (const provider of available) {
    try {
      const raw = await ask(provider.provider, provider.key, topic, language, difficulty, sources);
      const parsed = JSON.parse(raw) as { questions?: QuizItem[] };
      const questions = parsed.questions;
      if (!Array.isArray(questions) || questions.length !== 10) throw new Error("invalid_quiz_shape");
      const safe = questions.map((q, i) => {
        if (!q || typeof q.question !== "string" || q.question.length < 12 || !Array.isArray(q.options) || q.options.length !== 4 || q.options.some(o => typeof o !== "string" || !o.trim()) || new Set(q.options.map(o => o.trim().toLowerCase())).size !== 4 || !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3 || typeof q.explanation !== "string" || !q.explanation.trim()) throw new Error("invalid_quiz_item_" + (i + 1));
        const source = sources.find(s => s.title === q.sourceTitle) ?? sources[0];
        return { id: "q" + (i + 1), question: q.question.trim(), options: q.options.map(o => o.trim()), answer: q.answer, explanation: q.explanation.trim(), sourceTitle: source.title, sourceUrl: source.url };
      });
      return reply({ topic, language, difficulty, questions: safe, sources: sources.map(({ title, url, extract }) => ({ title, url, extract })), provider: provider.provider, searched: true });
    } catch (error) {
      issues.push(error instanceof Error ? error.message : "provider_error");
    }
  }
  return reply({ error: "Reference content was found, but the AI provider could not produce a valid quiz. Check API key, model access and provider limits, then retry.", code: "quiz_generation_failed", issues }, 502);
}
