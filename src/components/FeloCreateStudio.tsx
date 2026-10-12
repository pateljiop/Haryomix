import { useState } from "react";

type PptJob={taskId:string;businessId:string;status:string;liveDocId?:string|null};
async function api(path:string,body:unknown){
 const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||"Request failed.");
 return data;
}
export function FeloCreateStudio(){
 const [mode,setMode]=useState<"ppt"|"image">("ppt");
 const [topic,setTopic]=useState("");
 const [slides,setSlides]=useState("10");
 const [style,setStyle]=useState("Modern, premium, editorial, clean layouts");
 const [prompt,setPrompt]=useState("");
 const [size,setSize]=useState("1024x1024");
 const [job,setJob]=useState<PptJob|null>(null);
 const [image,setImage]=useState("");
 const [downloadUrl,setDownloadUrl]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 async function createPpt(){
  if(topic.trim().length<10){setMessage("Topic ko thoda detail me likho (minimum 10 characters).");return;}
  setBusy(true);setMessage("Felo presentation task start ho raha hai…");setJob(null);
  try{const data=await api("/api/ai/ppt",{action:"create",query:topic,slides:Number(slides),style});setJob({taskId:data.taskId,businessId:data.businessId,status:data.status,liveDocId:data.liveDocId});setMessage("Task create ho gaya. Status check karo; ready hone par PPTX export hoga.");}
  catch(e){setMessage(e instanceof Error?e.message:"PPT generation failed.");}finally{setBusy(false);}
 }
 async function checkStatus(){
  if(!job)return;setBusy(true);
  try{const data=await api("/api/ai/ppt",{action:"status",taskId:job.taskId,businessId:job.businessId});setJob({...job,status:data.status,businessId:data.businessId||job.businessId});setMessage(data.status==="COMPLETED"?"Presentation ready. Export PPTX dabao.":data.status==="FAILED"||data.status==="ERROR"?(data.error||"Felo presentation task failed."):`Generation status: ${data.status}`);}
  catch(e){setMessage(e instanceof Error?e.message:"Could not check status.");}finally{setBusy(false);}
 }
 async function exportPpt(){
  if(!job)return;setBusy(true);
  try{const data=await api("/api/ai/ppt",{action:"export",businessId:job.businessId});setMessage(data.status==="PROCESSING"?"PPTX export started. Ab export status check karo.":"Export request accepted.");}
  catch(e){setMessage(e instanceof Error?e.message:"PPTX export failed.");}finally{setBusy(false);}
 }
 async function checkExport(){
  if(!job)return;setBusy(true);
  try{const data=await api("/api/ai/ppt",{action:"export-status",businessId:job.businessId});if(data.downloadUrl&&/^https:\/\//i.test(data.downloadUrl)){setDownloadUrl(data.downloadUrl);setMessage("PPTX ready. Download link lagbhag 30 minutes tak valid rahega.");}else setMessage(`Export status: ${data.status}`);}
  catch(e){setMessage(e instanceof Error?e.message:"Could not check export.");}finally{setBusy(false);}
 }
 async function generateImage(){
  if(prompt.trim().length<5){setMessage("Image ka prompt thoda detail me likho.");return;}
  setBusy(true);setMessage("Felo image generate kar raha hai…");setImage("");
  try{const data=await api("/api/ai/image",{prompt,size});setImage(data.image?.url||data.image?.dataUrl||"");setMessage("Image generate ho gayi. Preview se save kar sakte ho.");}
  catch(e){setMessage(e instanceof Error?e.message:"Image generation failed.");}finally{setBusy(false);}
 }
 function downloadImage(){if(!image)return;const a=document.createElement("a");a.href=image;a.download="haryomix-ai-image.png";document.body.appendChild(a);a.click();a.remove();}
 return <div className="hmx-panel"><div className="hmx-panel-head"><h2>AI Create Studio</h2><span style={{fontSize:11,color:"#68758a"}}>Powered by Felo API</span></div><div className="hmx-panel-body">
  <div className="hmx-btn-row" style={{marginBottom:20}}><button className={`hmx-btn ${mode==="ppt"?"primary":""}`} onClick={()=>{setMode("ppt");setMessage("");}}>AI PowerPoint</button><button className={`hmx-btn ${mode==="image"?"primary":""}`} onClick={()=>{setMode("image");setMessage("");}}>AI Image</button></div>
  {mode==="ppt"?<>
   <div className="hmx-field"><label htmlFor="felo-ppt-topic">Presentation topic and requirements</label><textarea id="felo-ppt-topic" className="hmx-textarea" style={{minHeight:140,fontFamily:"inherit"}} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Topic, audience, language, key points, examples, level of detail, and desired conclusion…"/></div>
   <div className="hmx-field"><label htmlFor="felo-ppt-slides">Target slide count</label><select id="felo-ppt-slides" className="hmx-select" value={slides} onChange={e=>setSlides(e.target.value)}>{["5","8","10","12","15","20","25","30"].map(n=><option key={n} value={n}>{n} slides</option>)}</select></div>
   <div className="hmx-field"><label htmlFor="felo-ppt-style">Visual style</label><input id="felo-ppt-style" className="hmx-input" value={style} onChange={e=>setStyle(e.target.value)}/></div>
   <div className="hmx-btn-row"><button className="hmx-btn primary" disabled={busy} onClick={createPpt}>{busy?"Working…":"Generate AI presentation"}</button>{job&&<button className="hmx-btn" disabled={busy} onClick={checkStatus}>Check generation</button>}{job?.status==="COMPLETED"&&<button className="hmx-btn" disabled={busy} onClick={exportPpt}>Export editable PPTX</button>}{job&&<button className="hmx-btn" disabled={busy} onClick={checkExport}>Check PPTX export</button>}</div>
   {job&&<p style={{fontSize:12,color:"#6d7587",overflowWrap:"anywhere"}}>Task: {job.taskId}<br/>Status: {job.status}</p>}{downloadUrl&&<p><a href={downloadUrl} target="_blank" rel="noreferrer" className="hmx-btn primary" style={{display:"inline-block",textDecoration:"none"}}>Download editable PPTX</a></p>}
  </>:<>
   <div className="hmx-field"><label htmlFor="felo-image-prompt">Describe the image</label><textarea id="felo-image-prompt" className="hmx-textarea" style={{minHeight:130,fontFamily:"inherit"}} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Subject, composition, mood, lighting, art direction, background, aspect ratio, intended use…"/></div>
   <div className="hmx-field"><label htmlFor="felo-image-size">Image size</label><select id="felo-image-size" className="hmx-select" value={size} onChange={e=>setSize(e.target.value)}><option value="1024x1024">Square · 1024 × 1024</option><option value="1536x1024">Landscape · 1536 × 1024</option><option value="1024x1536">Portrait · 1024 × 1536</option></select></div>
   <div className="hmx-btn-row"><button className="hmx-btn primary" disabled={busy} onClick={generateImage}>{busy?"Generating…":"Generate AI image"}</button>{image&&<button className="hmx-btn" onClick={downloadImage}>Download image</button>}</div>
   {image&&<img src={image} alt="AI-generated result" style={{display:"block",width:"100%",maxWidth:760,maxHeight:650,objectFit:"contain",marginTop:20,borderRadius:14,border:"1px solid #dce3ec",background:"#f5f7fb"}}/>}
  </>}
  {message&&<div className="hmx-note" role="status" style={{marginTop:18,overflowWrap:"anywhere"}}>{message}</div>}
  <p style={{fontSize:11,color:"#7a8292",lineHeight:1.6,marginTop:18}}>AI generation may use Felo credits. Generated results depend on the models and features enabled for your account. PPT generation and PPTX export are separate tasks.</p>
 </div></div>
}
