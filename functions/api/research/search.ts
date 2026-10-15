interface ResearchItem {
  title: string;
  source: "OpenAlex" | "Crossref" | "arXiv" | "Internet Archive" | "Web search (Gemini)";
  url: string;
  date?: string;
  description?: string;
}
interface Env { OPENALEX_API_KEY?: string; GEMINI_API_KEY?: string }
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=300, s-maxage=900",
  "X-Content-Type-Options": "nosniff",
};
function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers });
}
function clean(value: unknown, max = 300): string {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}
function xmlText(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
}
async function safeJson(url: string): Promise<any | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "HaryomixStudyCopilot/1.0 (educational search)" },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}
async function safeText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/atom+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch { return null; }
}
export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return reply({ error: "Send a JSON request." }, 415);
  }
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply({ error: "Expected a search request." }, 400);
    body = parsed as Record<string, unknown>;
  } catch { return reply({ error: "Invalid JSON body." }, 400); }
  const query = clean(body.query, 180);
  if (query.length < 3) return reply({ error: "Enter at least 3 characters to search." }, 400);
  const q = encodeURIComponent(query);
  const openAlexParams = new URLSearchParams({ search: query, per_page: "5", select: "id,doi,title,publication_year,publication_date,authorships,biblio,primary_location" });
  if (env.OPENALEX_API_KEY) openAlexParams.set("api_key", env.OPENALEX_API_KEY);
  const openAlexUrl = `https://api.openalex.org/works?${openAlexParams.toString()}`;
  const crossrefUrl = `https://api.crossref.org/works?query.bibliographic=${q}&rows=5&select=title,author,published,publisher,DOI,type`;
  const arxivUrl = `https://export.arxiv.org/api/query?search_query=all:${q}&start=0&max_results=5&sortBy=relevance&sortOrder=descending`;
  const archiveUrl = `https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=date&fl[]=description&mediatype[]=texts&rows=5&page=1&output=json`;
  const [openAlex, crossref, arxivXml, archive] = await Promise.all([
    safeJson(openAlexUrl), safeJson(crossrefUrl), safeText(arxivUrl), safeJson(archiveUrl),
  ]);
  const webItems: ResearchItem[] = [];
  if (env.GEMINI_API_KEY) {
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `Search the web for this study/exam query: "${query}". Prefer official Indian exam authorities, government sources, and current pages. Keep factual claims grounded and never invent URLs or publication dates.` }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1800 },
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (response.ok) {
        const data: any = await response.json();
        const candidate = data.candidates?.[0];
        const grounding = candidate?.groundingMetadata;
        const summary = (candidate?.content?.parts ?? []).map((part: any) => clean(part.text, 1800)).filter(Boolean).join("\n");
        for (const chunk of grounding?.groundingChunks ?? []) {
          const page = chunk.web;
          const url = clean(page?.uri, 500);
          const title = clean(page?.title, 240) || url;
          if (title && /^https?:\/\//i.test(url)) {
            webItems.push({ title, source: "Web search (Gemini)", url, description: summary.slice(0, 300) });
          }
        }
      }
    } catch { /* continue with scholarly sources if Gemini search is unavailable */ }
  }
  const items: ResearchItem[] = [...webItems];
  for (const work of openAlex?.results ?? []) {
    const title = clean(work.title, 240);
    const id = clean(work.id, 300);
    const doi = clean(work.doi, 300);
    const url = /^https:\/\/doi\.org\//i.test(doi) ? doi : id;
    if (!title || !/^https:\/\/openalex\.org\/W[0-9A-Z]+$/i.test(id) || !/^https:\/\/(?:doi\.org\/|openalex\.org\/)/i.test(url)) continue;
    const authors = Array.isArray(work.authorships) ? work.authorships.slice(0, 3).map((a: any) => clean(a.author?.display_name, 70)).filter(Boolean).join(", ") : "";
    const date = clean(work.publication_date, 40) || (work.publication_year ? String(work.publication_year) : "");
    items.push({ title, source: "OpenAlex", url, date, description: authors ? `Authors: ${authors}` : "Scholarly work metadata from OpenAlex" });
  }
  for (const work of crossref?.message?.items ?? []) {
    const title = clean(Array.isArray(work.title) ? work.title[0] : work.title, 240);
    const doi = clean(work.DOI, 180);
    if (!title || !doi) continue;
    const parts = work.published?.["date-parts"]?.[0] ?? [];
    const date = parts.length ? parts.map((n: number) => String(n).padStart(2, "0")).join("-") : "";
    items.push({ title, source: "Crossref", url: `https://doi.org/${encodeURIComponent(doi).replace(/%2F/gi, "/")}`, date, description: clean(work.publisher, 160) });
  }
  if (arxivXml) {
    const entries = arxivXml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
    for (const entry of entries) {
      const title = clean(xmlText(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""), 240);
      const url = clean(entry.match(/<id>([\s\S]*?)<\/id>/)?.[1] ?? "", 300);
      const date = clean(entry.match(/<published>([\s\S]*?)<\/published>/)?.[1] ?? "", 40).slice(0, 10);
      const summary = clean(xmlText(entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? ""), 260);
      if (title && /^https:\/\/arxiv\.org\/abs\//.test(url)) items.push({ title, source: "arXiv", url, date, description: summary });
    }
  }
  for (const doc of archive?.response?.docs ?? []) {
    const title = clean(doc.title, 240);
    const id = clean(doc.identifier, 180);
    if (!title || !/^[a-zA-Z0-9._-]+$/.test(id)) continue;
    const creator = clean(doc.creator, 120);
    const date = clean(doc.date, 40);
    const description = clean(Array.isArray(doc.description) ? doc.description[0] : doc.description, 260);
    items.push({ title, source: "Internet Archive", url: `https://archive.org/details/${encodeURIComponent(id)}`, date, description: [creator, description].filter(Boolean).join(" — ").slice(0, 300) });
  }
  const deduped = items.filter((item, index, all) => all.findIndex(other => other.url === item.url) === index).slice(0, 15);
  return reply({
    query,
    sources: deduped,
    searched: { geminiWebSearch: webItems.length > 0, geminiKeyConfigured: Boolean(env.GEMINI_API_KEY), openAlex: Boolean(openAlex), openAlexKeyConfigured: Boolean(env.OPENALEX_API_KEY), crossref: Boolean(crossref), arxiv: Boolean(arxivXml), internetArchive: Boolean(archive) },
    message: deduped.length
      ? "Results are metadata and discovery links. Availability, peer review, full-text access and syllabus relevance must be checked at the original source."
      : "The research providers did not return results right now. Try a shorter or more specific query.",
  });
}
