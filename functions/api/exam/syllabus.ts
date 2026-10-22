interface Env {
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  FELO_API_KEY?: string;
  FELO_MODEL?: string;
  GOOGLE_CSE_API_KEY?: string;
  GOOGLE_CSE_CX?: string;
  DB?: { prepare(sql: string): { bind(...values: unknown[]): { first<T = { count: number }>(): Promise<T | null>; run(): Promise<unknown> } } };
}
type Result = { title: string; url: string; snippet: string; official: boolean };
const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function reply(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers }); }
function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function decodeHtml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}
function stripHtml(value: string) { return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()); }
function isOfficial(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host.endsWith(".gov.in") || host.endsWith(".nic.in") || host.endsWith(".ac.in") ||
      /^(nta\.ac\.in|upsc\.gov\.in|ssc\.gov\.in|rrbcdg\.gov\.in|ibps\.in|sbi\.co\.in|ctet\.nic\.in|cbse\.gov\.in|jeemain\.nta\.ac\.in|neet\.nta\.nic\.in)$/.test(host);
  } catch { return false; }
}
async function searchGoogle(query: string, env: Env): Promise<Result[]> {
  if (env.GOOGLE_CSE_API_KEY && env.GOOGLE_CSE_CX) {
    const api = new URL("https://www.googleapis.com/customsearch/v1");
    api.searchParams.set("key", env.GOOGLE_CSE_API_KEY);
    api.searchParams.set("cx", env.GOOGLE_CSE_CX);
    api.searchParams.set("q", query);
    api.searchParams.set("num", "8");
    const response = await fetch(api, { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error("google_search_unavailable");
    const data = await response.json() as { items?: Array<{ title?: string; link?: string; snippet?: string }> };
    return (data.items ?? []).flatMap(item => {
      if (!item.title || !item.link) return [];
      try {
        const target = new URL(item.link);
        if (!["http:", "https:"].includes(target.protocol)) return [];
        return [{ title: stripHtml(item.title), url: target.href, snippet: stripHtml(item.snippet || ""), official: isOfficial(target.href) }];
      } catch { return []; }
    }).sort((a, b) => Number(b.official) - Number(a.official)).slice(0, 8);
  }
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("num", "10");
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36", Accept: "text/html" }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error("google_search_unavailable");
  const html = await response.text();
  const results: Result[] = [];
  const anchors = html.match(/<a\s[^>]*href="[^"]+"[^>]*>[\s\S]*?<h3[^>]*>[\s\S]*?<\/h3>[\s\S]*?<\/a>/gi) ?? [];
  for (const anchor of anchors) {
    const hrefMatch = anchor.match(/href="([^"]+)"/i);
    const titleMatch = anchor.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (!hrefMatch || !titleMatch) continue;
    try {
      let href = decodeHtml(hrefMatch[1]);
      if (href.startsWith("/url?")) {
        const wrapped = new URL(href, "https://www.google.com");
        href = wrapped.searchParams.get("q") || wrapped.searchParams.get("url") || "";
      }
      const target = new URL(href);
      if (!["http:", "https:"].includes(target.protocol) || /(^|\.)google\.com$/.test(target.hostname)) continue;
      const title = stripHtml(titleMatch[1]);
      if (!title || results.some(item => item.url === target.href)) continue;
      results.push({ title, url: target.href, snippet: "", official: isOfficial(target.href) });
    } catch { /* Ignore malformed or non-result links. */ }
    if (results.length >= 8) break;
  }
  return results.sort((a, b) => Number(b.official) - Number(a.official)).slice(0, 8);
}
async function searchDuckDuckGo(query: string): Promise<Result[]> {
  const url = new URL("https://html.duckduckgo.com/html/");
  url.searchParams.set("q", query);
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; HaryomixStudyAssistant/1.0)", Accept: "text/html" }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error("secondary_search_unavailable");
  const html = await response.text();
  const results: Result[] = [];
  const anchors = html.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="[^"]+"[^>]*>[\s\S]*?<\/a>/gi) ?? [];
  for (const anchorHtml of anchors) {
    const anchor = anchorHtml.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!anchor) continue;
    let href = decodeHtml(anchor[1]);
    try {
      const parsed = new URL(href, "https://duckduckgo.com");
      if (parsed.searchParams.has("uddg")) href = decodeURIComponent(parsed.searchParams.get("uddg")!);
      const target = new URL(href);
      if (!["http:", "https:"].includes(target.protocol) || /duckduckgo\.com$/.test(target.hostname)) continue;
      const position = html.indexOf(anchorHtml);
      const nearby = html.slice(position, position + 1800);
      const snippetMatch = nearby.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i);
      const title = stripHtml(anchor[2]);
      const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : "";
      if (title && !results.some(item => item.url === target.href)) results.push({ title, url: target.href, snippet, official: isOfficial(target.href) });
    } catch { /* Ignore malformed search-result links. */ }
    if (results.length >= 8) break;
  }
  return results.sort((a, b) => Number(b.official) - Number(a.official)).slice(0, 8);
}
async function searchSyllabusSources(exam: string, env: Env): Promise<Result[]> {
  const normalized = exam.replace(/"/g, " ").trim();
  const queries = [
    '"' + normalized + '" official syllabus site:gov.in OR site:nic.in',
    '"' + normalized + '" syllabus official exam notification',
    '"' + normalized + '" syllabus official conducting body',
  ];
  let errors = 0;
  const found: Result[] = [];
  // Google's official JSON API is optional and quota-limited; without configured credentials,
  // use DuckDuckGo's free HTML endpoint rather than brittle Google-result-page scraping.
  const search = env.GOOGLE_CSE_API_KEY && env.GOOGLE_CSE_CX
    ? (query: string) => searchGoogle(query, env)
    : (query: string) => searchDuckDuckGo(query);
  for (const query of queries) {
    try {
      const results = await search(query);
      found.push(...results);
      const official = results.filter(result => result.official);
      if (official.length) return found.filter((r, i, all) => all.findIndex(x => x.url === r.url) === i).sort((a, b) => Number(b.official) - Number(a.official)).slice(0, 8);
    } catch { errors++; }
  }
  // Broaden discovery only after official-domain queries; never use Wikipedia as a source.
  for (const query of [
    '"' + normalized + '" syllabus official',
    '"' + normalized + '" exam pattern',
  ]) {
    try {
      const results = await search(query);
      found.push(...results);
      const official = results.filter(result => result.official);
      if (official.length) return found.filter((r, i, all) => all.findIndex(x => x.url === r.url) === i).sort((a, b) => Number(b.official) - Number(a.official)).slice(0, 8);
    } catch { errors++; }
  }
  if (errors === queries.length + 2) throw new Error("search_unavailable");
  return found.filter((r, i, all) => all.findIndex(x => x.url === r.url) === i).slice(0, 8);
}
async function askAI(env: Env, exam: string, countryContext: string, results: Result[]) {
  const system = "You are an Indian examination syllabus research assistant. Use only the supplied web search result titles/snippets; never invent a syllabus, exam pattern, eligibility rule, dates, or marks. Prioritize official government, exam-board, recruitment-board, university, and conducting-body sources. Return JSON only: {\"summary\":string,\"syllabus\":[{\"section\":string,\"topics\":[string[]]}],\"examPattern\":string,\"confidence\":\"high\"|\"medium\"|\"low\",\"limitations\":string}. If the results do not establish the actual syllabus, say it could not be verified and leave syllabus empty. Cite source names in prose using the exact result titles, and do not imply a third-party page is official.";
  const prompt = JSON.stringify({ exam, countryContext, instruction: "Identify the latest available official syllabus for this exact exam in India. Distinguish exam name variants and recruitment cycles. Return section-wise syllabus topics only when the supplied evidence supports them.", searchResults: results.map(r => ({ title: r.title, url: r.url, snippet: r.snippet, official: r.official })) });
  const available: Array<{ name: "groq" | "gemini" | "felo"; key: string }> = [];
  if (env.GROQ_API_KEY) available.push({ name: "groq", key: env.GROQ_API_KEY });
  if (env.GEMINI_API_KEY) available.push({ name: "gemini", key: env.GEMINI_API_KEY });
  if (env.FELO_API_KEY) available.push({ name: "felo", key: env.FELO_API_KEY });
  if (!available.length) throw new Error("ai_not_configured");
  const failures: string[] = [];
  for (const provider of available) {
    try {
      const response = provider.name === "gemini"
        ? await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": provider.key }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 4000, responseMimeType: "application/json" } }), signal: AbortSignal.timeout(25_000) })
        : await fetch(provider.name === "felo" ? "https://openapi.felo.ai/api/v1/chat/completions" : "https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + provider.key, "Content-Type": "application/json" }, body: JSON.stringify({ model: provider.name === "felo" ? env.FELO_MODEL || "claude-sonnet-4-6" : "openai/gpt-oss-120b", temperature: 0.1, max_tokens: 4000, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }), signal: AbortSignal.timeout(25_000) });
      if (!response.ok) { failures.push(provider.name + ":" + response.status); continue; }
      const data = await response.json() as any;
      const raw = provider.name === "gemini" ? data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") : data?.choices?.[0]?.message?.content;
      if (typeof raw === "string" && raw.trim()) {
        const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
        if (!parsed || typeof parsed.summary !== "string" || !Array.isArray(parsed.syllabus) || !["high", "medium", "low"].includes(parsed.confidence)) throw new Error("invalid_research_response");
        return { ...parsed, provider: provider.name };
      }
      failures.push(provider.name + ":empty_response");
    } catch (error) { failures.push(provider.name + ":" + (error instanceof Error ? error.message : "failed")); }
  }
  throw new Error("providers_failed:" + failures.join(","));
}
export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return reply({ error: "Send a JSON request." }, 415);
  let body: any;
  try { const raw = await request.text(); if (new TextEncoder().encode(raw).byteLength > 4000) return reply({ error: "Request too large." }, 413); body = JSON.parse(raw); } catch { return reply({ error: "Invalid JSON request." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ error: "Expected an exam research request." }, 400);
  const exam = clean(body.exam, 180);
  const countryContext = clean(body.context, 180) || "India";
  if (exam.length < 3) return reply({ error: "Enter the full exam name, such as SSC CGL, RRB ALP, NEET UG, CUET UG, UPSC CSE, or a university entrance exam." }, 400);
  if (!env.DB) return reply({ error: "AI research protection is not configured: Cloudflare D1 binding DB is required.", code: "rate_limit_unavailable" }, 503);
  try {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("haryomix-exam-research:" + ip));
    const rateKey = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    const bucket = new Date().toISOString().slice(0, 13);
    const row = await env.DB.prepare("INSERT INTO community_rate_limits (rate_key, request_count, bucket) VALUES (?, 1, ?) ON CONFLICT(rate_key) DO UPDATE SET request_count = CASE WHEN community_rate_limits.bucket = excluded.bucket THEN community_rate_limits.request_count + 1 ELSE 1 END, bucket = excluded.bucket RETURNING request_count AS count").bind(rateKey, bucket).first<{ count: number }>();
    if (!row) return reply({ error: "Request protection is temporarily unavailable." }, 503);
    if (row.count > 8) return reply({ error: "Exam syllabus research limit reached for this hour. Please retry later.", code: "rate_limited" }, 429);
  } catch { return reply({ error: "Request protection is temporarily unavailable." }, 503); }
  let results: Result[];
  try { results = await searchSyllabusSources(exam, env); }
  catch { return reply({ error: "Google and backup search providers are unavailable right now. Please retry; no syllabus has been invented.", code: "search_unavailable" }, 502); }
  if (!results.length) return reply({ error: "No searchable pages were found for this exam name. Check the spelling or include the conducting body and exam year.", code: "no_results" }, 404);
  try {
    const research = await askAI(env, exam, countryContext, results);
    return reply({ exam, researchedAt: new Date().toISOString(), results, ...research, officialSourceCount: results.filter(r => r.official).length, searchedLiveWeb: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "ai_not_configured") return reply({ error: "No AI provider configured. Add GROQ_API_KEY, GEMINI_API_KEY, or FELO_API_KEY in Cloudflare Pages encrypted secrets.", code: "ai_not_configured", results }, 503);
    return reply({ error: "Search results were found, but syllabus analysis failed. Retry after checking the AI provider secret/model access.", code: "analysis_failed", results }, 502);
  }
}
