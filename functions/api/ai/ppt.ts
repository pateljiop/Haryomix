interface Env { FELO_API_KEY?: string; DB?: { prepare(sql: string): { bind(...values: unknown[]): { first<T = { count: number }>() : Promise<T | null>; run(): Promise<unknown> } } } }
const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function reply(body: unknown, status=200) { return new Response(JSON.stringify(body), {status, headers}); }
function clean(value: unknown, max=300): string { return typeof value === "string" ? value.trim().slice(0,max) : ""; }
async function withinLimit(request: Request, env: Env): Promise<boolean> {
 if(!env.DB) return false;
 const ip=request.headers.get("CF-Connecting-IP")||"unknown";
 const bucket=new Date().toISOString().slice(0,13);
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("haryomix-felo-ppt:"+ip));
 const key=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
 const row=await env.DB.prepare("INSERT INTO community_rate_limits (rate_key, request_count, bucket) VALUES (?, 1, ?) ON CONFLICT(rate_key) DO UPDATE SET request_count = CASE WHEN community_rate_limits.bucket = excluded.bucket THEN community_rate_limits.request_count + 1 ELSE 1 END, bucket = excluded.bucket RETURNING request_count AS count").bind(key,bucket).first<{count:number}>();
 if(!row) throw new Error("Rate-limit counter did not return a row.");
 if(row.count===1){
  const expiredBefore=new Date(Date.now()-48*60*60*1000).toISOString().slice(0,13);
  try{await env.DB.prepare("DELETE FROM community_rate_limits WHERE bucket < ?").bind(expiredBefore).run()}catch{/* Best-effort cleanup; the rate limit itself is already recorded. */}
 }
 return row.count<=8;
}
async function felo(path: string, key: string, init: RequestInit = {}) {
  const response = await fetch(`https://openapi.felo.ai${path}`, { ...init, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(25_000) });
  const data = await response.json().catch(() => null) as any;
  if (!response.ok || data?.status === "error") throw new Error(response.status === 429 ? "rate_limit" : response.status === 402 ? "credits_required" : "provider_error");
  return data;
}
export async function onRequestPost({request,env}:{request:Request;env:Env}):Promise<Response>{
  if(!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return reply({error:"Send a JSON request."},415);
  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (declaredLength > 16_000) return reply({error:"Request body is too large."},413);
  let rawBody: string;
  try { rawBody = await request.text(); } catch { return reply({error:"Could not read request body."},400); }
  if (new TextEncoder().encode(rawBody).byteLength > 16_000) return reply({error:"Request body is too large."},413);
  let body:any; try { body=JSON.parse(rawBody); } catch { return reply({error:"Invalid JSON."},400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply({error:"Expected a JSON object."},400);
  const action=clean(body?.action,30);
  if(action==="create" && clean(body.query,5000).length<10) return reply({error:"Add a presentation topic and useful detail."},400);
  if((action==="export" || action==="export-status") && !clean(body.businessId,100)) return reply({error:"Presentation ID is required."},400);
  if(action==="status" && !clean(body.taskId,100)) return reply({error:"Task ID is required."},400);
  if(!["create","status","export","export-status"].includes(action)) return reply({error:"Unsupported action."},400);
  if(!env.FELO_API_KEY) return reply({error:"Felo is not configured on the server.",code:"provider_not_configured"},503);
  if(action==="create"||action==="export"){
    if(!env.DB) return reply({error:"AI request protection is not configured. Database binding is required.",code:"rate_limit_unavailable"},503);
    try { if(!await withinLimit(request,env)) return reply({error:"AI creation/export limit reached for this hour. Please retry later.",code:"rate_limited"},429); }
    catch { return reply({error:"AI request protection is temporarily unavailable.",code:"rate_limit_unavailable"},503); }
  }
  try {
    if(action==="create"){
      const query=clean(body.query,5000);
      if(query.length<10) return reply({error:"Add a presentation topic and useful detail."},400);
      const count=Math.min(30,Math.max(3,Number(body.slides)||10));
      const style=clean(body.style,100)||"clean professional";
      const prompt=`Create a polished, accurate, editable PowerPoint presentation. Target ${count} slides. Topic and requirements: ${query}. Visual direction: ${style}. Use a strong narrative, meaningful slide titles, concise readable text, examples/data only when supportable, a clear conclusion, and no fabricated citations or statistics. Language should follow the user's prompt.`;
      const result=await felo("/v2/ppts",env.FELO_API_KEY,{method:"POST",body:JSON.stringify({query:prompt})});
      const data=result?.data||{};
      if(!data.task_id||!data.ppt_business_id) return reply({error:"Felo did not return a usable presentation task.",code:"invalid_provider_response"},502);
      return reply({taskId:data.task_id,businessId:data.ppt_business_id,liveDocId:data.livedoc_short_id||null,status:"RUNNING"});
    }
    const taskId=clean(body.taskId,100), businessId=clean(body.businessId,100);
    if(action==="status"){
      if(!taskId) return reply({error:"Task ID is required."},400);
      const result=await felo(`/v2/tasks/${encodeURIComponent(taskId)}/status`,env.FELO_API_KEY);
      const status=clean(result?.data?.status,40).toUpperCase();
      const historical=status==="COMPLETED"||status==="FAILED"||status==="ERROR" ? await felo(`/v2/tasks/${encodeURIComponent(taskId)}/historical`,env.FELO_API_KEY) : null;
      return reply({status:status||"RUNNING",liveUrl:historical?.data?.ppt_url||null,error:historical?.data?.error_message||null,businessId:historical?.data?.ppt_biz_id||businessId||null});
    }
    if(action==="export"){
      if(!businessId) return reply({error:"Presentation ID is required."},400);
      await felo(`/v2/ppts/${encodeURIComponent(businessId)}/export`,env.FELO_API_KEY,{method:"POST",body:"{}"});
      return reply({status:"PROCESSING"});
    }
    if(action==="export-status"){
      if(!businessId) return reply({error:"Presentation ID is required."},400);
      const result=await felo(`/v2/ppts/${encodeURIComponent(businessId)}/export`,env.FELO_API_KEY);
      return reply({status:clean(result?.data?.status,40).toUpperCase()||"PROCESSING",downloadUrl:result?.data?.download_url||null,expiresAt:result?.data?.expires_at||null});
    }
    return reply({error:"Unsupported action."},400);
  } catch(error) {
    const code=error instanceof Error?error.message:"provider_error";
    return reply({error:code==="credits_required"?"Felo account needs credits for this generation.":code==="rate_limit"?"Felo is rate-limiting requests. Retry shortly.":"Felo could not complete the presentation request. Check the key, credits, and provider status.",code},code==="rate_limit"?429:502);
  }
}
