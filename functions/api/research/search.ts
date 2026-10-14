interface ResearchItem {
  title: string;
  source: "Crossref" | "arXiv" | "Internet Archive";
  url: string;
  date?: string;
  description?: string;
}
interface Env {}
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
export async function onRequestPost({ request }: { request: Request; env: Env }): Promise<Response> {
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
  const crossrefUrl = `https://api.crossref.org/works?query.bibliographic=${q}&rows=5&select=title,author,published,publisher,DOI,type`;
  const arxivUrl = `https://export.arxiv.org/api/query?search_query=all:${q}&start=0&max_results=5&sortBy=relevance&sortOrder=descending`;
  const archiveUrl = `https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=date&fl[]=description&mediatype[]=texts&rows=5&page=1&output=json`;
  const [crossref, arxivXml, archive] = await Promise.all([
    safeJson(crossrefUrl), safeText(arxivUrl), safeJson(archiveUrl),
  ]);
  const items: ResearchItem[] = [];
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
    searched: { crossref: Boolean(crossref), arxiv: Boolean(arxivXml), internetArchive: Boolean(archive) },
    message: deduped.length
      ? "Results are metadata and discovery links. Availability, peer review, full-text access and syllabus relevance must be checked at the original source."
      : "The research providers did not return results right now. Try a shorter or more specific query.",
  });
}
