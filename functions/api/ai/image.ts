interface Env { FELO_API_KEY?: string }
const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function reply(body: unknown,status=200){return new Response(JSON.stringify(body),{status,headers});}
export async function onRequestPost({request,env}:{request:Request;env:Env}):Promise<Response>{
  if(!env.FELO_API_KEY)return reply({error:"Felo is not configured on the server.",code:"provider_not_configured"},503);
  if(!request.headers.get("content-type")?.includes("application/json"))return reply({error:"Send a JSON request."},415);
  let body:any;try{body=await request.json();}catch{return reply({error:"Invalid JSON."},400);}
  const prompt=typeof body?.prompt==="string"?body.prompt.trim().slice(0,3000):"";
  if(prompt.length<5)return reply({error:"Describe the image you want to create."},400);
  const size=["1024x1024","1536x1024","1024x1536"].includes(body?.size)?body.size:"1024x1024";
  try{
    const modelsResponse=await fetch("https://openapi.felo.ai/api/v1/models",{headers:{Authorization:`Bearer ${env.FELO_API_KEY}`},signal:AbortSignal.timeout(15000)});
    if(!modelsResponse.ok)throw new Error(modelsResponse.status===429?"rate_limit":"provider_error");
    const catalog=await modelsResponse.json() as {data?:{id?:string;model_kind?:string}[]};
    const model=catalog.data?.find(item=>item.model_kind==="image_generation")?.id;
    if(!model)return reply({error:"No image-generation model is currently enabled for this Felo key.",code:"image_model_unavailable"},503);
    const response=await fetch("https://openapi.felo.ai/api/v1/images/generations",{method:"POST",headers:{Authorization:`Bearer ${env.FELO_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model,prompt,size,n:1}),signal:AbortSignal.timeout(55000)});
    const data=await response.json().catch(()=>null) as any;
    if(!response.ok)return reply({error:response.status===402?"Felo account needs credits for image generation.":response.status===429?"Felo is rate-limiting image requests. Retry shortly.":"Felo image generation failed.",code:response.status===402?"credits_required":response.status===429?"rate_limited":"provider_error"},response.status===429?429:502);
    const image=data?.data?.[0];
    const url=typeof image?.url==="string"&&/^https:\/\//i.test(image.url)?image.url:null;
    const b64=typeof image?.b64_json==="string"&&image.b64_json.length<15_000_000?image.b64_json:null;
    if(!url&&!b64)return reply({error:"Felo returned no usable image result.",code:"invalid_provider_response"},502);
    return reply({image:url?{url}: {dataUrl:`data:image/png;base64,${b64}`},model});
  }catch(error){
    const code=error instanceof Error?error.message:"provider_error";
    return reply({error:code==="rate_limit"?"Felo is rate-limiting requests. Retry shortly.":"Felo image generation is temporarily unavailable. Check your API key, model access, and credits.",code},code==="rate_limit"?429:502);
  }
}
