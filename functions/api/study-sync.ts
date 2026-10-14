interface Env {
  DB?: { prepare(sql: string): { bind(...values: unknown[]): { all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>; run(): Promise<unknown> } } };
  GOOGLE_DRIVE_FOLDER_ID?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  HARYOMIX_STUDY_SYNC_TOKEN?: string;
}
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const encoder = new TextEncoder();
function b64url(bytes: Uint8Array): string { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
function json64(value: unknown) { return b64url(encoder.encode(JSON.stringify(value))); }
async function getDriveToken(env: Env): Promise<string> {
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const pem = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !pem) throw new Error("credentials");
  const der = Uint8Array.from(atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "")), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = json64({ alg: "RS256", typ: "JWT" }) + "." + json64({ iss: email, scope: "https://www.googleapis.com/auth/drive.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const assertion = unsigned + "." + b64url(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned))));
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error("auth");
  const data = await res.json() as { access_token?: string };
  if (!data.access_token) throw new Error("auth");
  return data.access_token;
}
export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!env.DB || !env.HARYOMIX_STUDY_SYNC_TOKEN) return json({ error: "Study library sync is not configured." }, 503);
  if (request.headers.get("Authorization") !== "Bearer " + env.HARYOMIX_STUDY_SYNC_TOKEN) return json({ error: "Not authorized." }, 401);
  if (!env.GOOGLE_DRIVE_FOLDER_ID) return json({ error: "Study library source is not configured." }, 503);
  try {
    const token = await getDriveToken(env);
    const q = encodeURIComponent("'" + env.GOOGLE_DRIVE_FOLDER_ID.replace(/'/g, "\\'") + "' in parents and trashed = false and mimeType = 'application/pdf'");
    const res = await fetch("https://www.googleapis.com/drive/v3/files?q=" + q + "&pageSize=1000&orderBy=name&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime,md5Checksum)", { headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return json({ error: "Could not read the study library source." }, 502);
    const data = await res.json() as { files?: { id: string; name: string; mimeType: string; size?: string; modifiedTime?: string; md5Checksum?: string }[]; nextPageToken?: string };
    if (data.nextPageToken) return json({ error: "The folder has more than 1,000 PDFs. Split the library into subfolders before syncing." }, 413);
    const files = (data.files ?? []).filter(f => f.id && f.name && f.mimeType === "application/pdf");
    const now = new Date().toISOString();
    await env.DB.prepare("UPDATE study_documents SET status='unavailable',synced_at=?").bind(now).run();
    for (const f of files) await env.DB.prepare(`INSERT INTO study_documents (drive_file_id,title,mime_type,file_size,source_modified_at,content_hash,status,synced_at,created_at)
      VALUES (?,?,?,?,?,?, 'ready',?,?) ON CONFLICT(drive_file_id) DO UPDATE SET title=excluded.title,mime_type=excluded.mime_type,file_size=excluded.file_size,source_modified_at=excluded.source_modified_at,content_hash=excluded.content_hash,status='ready',synced_at=excluded.synced_at`)
      .bind(f.id, f.name.slice(0, 240), f.mimeType, Math.max(0, Number(f.size ?? 0)), f.modifiedTime ?? now, f.md5Checksum ?? null, now, now).run();
    return json({ ok: true, synced: files.length, message: "Study library sync completed." });
  } catch {
    return json({ error: "Study library sync failed. Check the private server configuration and retry." }, 503);
  }
}
