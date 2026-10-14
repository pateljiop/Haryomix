import { useState } from "react";
import pptxgen from "pptxgenjs";

type SlideContent={title:string;bullets:string[];notes?:string};
type PptJob={taskId:string;businessId:string;status:string;liveDocId?:string|null;liveUrl?:string|null;fallbackSlides?:SlideContent[];provider?:string;title?:string};
async function api(path:string,body:unknown){
 const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof data.error==="string"&&data.error.trim()?data.error:(response.status>=500?"The service is temporarily unavailable. Please retry shortly.":"The request could not be completed. Please review your input and retry."));
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
  setBusy(true);setMessage("Presentation task start ho raha hai…");setJob(null);
  try{
   const data=await api("/api/ai/ppt",{action:"create",query:topic,slides:Number(slides),style});
   if(data.mode==="ai-generated-pptx"&&Array.isArray(data.slides)&&data.slides.length){
    const fallbackSlides=data.slides.filter((slide:unknown):slide is SlideContent=>Boolean(slide&&typeof slide==="object"&&typeof (slide as SlideContent).title==="string"&&Array.isArray((slide as SlideContent).bullets)));
    if(!fallbackSlides.length)throw new Error("AI provider ne valid slide content nahi diya. Dobara try karo.");
    setJob({taskId:`local-${Date.now()}`,businessId:"local-pptx",status:"COMPLETED",fallbackSlides,provider:typeof data.provider==="string"?data.provider:"AI",title:typeof data.title==="string"?data.title:topic});
    setDownloadUrl("");setMessage(`Slides ${typeof data.provider==="string"?data.provider:"AI"} se ready hain. “Export editable PPTX” dabao.`);return;
   }
   if(typeof data.taskId!=="string"||!data.taskId||typeof data.businessId!=="string"||!data.businessId)throw new Error("Presentation service ne valid task details nahi diye. Dobara try karo.");
   let currentJob:PptJob={taskId:data.taskId,businessId:data.businessId,status:typeof data.status==="string"?data.status:"RUNNING",liveDocId:data.liveDocId,provider:typeof data.provider==="string"?data.provider:"felo"};
   setJob(currentJob);setDownloadUrl("");setMessage("PPT task start ho gaya hai. Main automatically status check kar raha hoon…");
   const terminal=["COMPLETED","FAILED","ERROR","PENDING","EXPIRED","CANCELED"];
   let finished=false;
   for(let attempt=0;attempt<45;attempt++){
    await new Promise(resolve=>setTimeout(resolve,4000));
    const statusData=await api("/api/ai/ppt",{action:"status",taskId:currentJob.taskId,businessId:currentJob.businessId});
    const status=String(statusData.status||"RUNNING").toUpperCase();
    currentJob={...currentJob,status,businessId:statusData.businessId||currentJob.businessId,liveUrl:statusData.liveUrl||currentJob.liveUrl};
    setJob(currentJob);
    if(status==="COMPLETED"){setMessage("Presentation ready. Ab “Export editable PPTX” dabao.");finished=true;break;}
    if(terminal.includes(status)){setMessage(typeof statusData.error==="string"&&statusData.error?statusData.error:`Presentation ${status.toLowerCase()} ho gayi. Topic/credits check karke retry karo.`);finished=true;break;}
    setMessage(`Presentation generate ho rahi hai… status check ${attempt+1}/45`);
   }
   if(!finished)setMessage("PPT task abhi bhi processing mein hai. Task save hai—“Check generation” se dobara status check kar sakte ho.");
  }
  catch(e){setMessage(e instanceof Error?e.message:"PPT generation failed.");}finally{setBusy(false);}
 }
 async function checkStatus(){
  if(!job)return;setBusy(true);
  try{const data=await api("/api/ai/ppt",{action:"status",taskId:job.taskId,businessId:job.businessId});const status=String(data.status||"RUNNING").toUpperCase();setJob({...job,status,businessId:data.businessId||job.businessId,liveUrl:data.liveUrl||job.liveUrl});setMessage(status==="COMPLETED"?"Presentation ready. Export PPTX dabao.":["FAILED","ERROR","PENDING","EXPIRED","CANCELED"].includes(status)?(data.error||`Presentation ${status.toLowerCase()} ho gayi. Topic/credits check karke retry karo.`):`Generation status: ${status}`);}
  catch(e){setMessage(e instanceof Error?e.message:"Could not check presentation status. Please retry.");}finally{setBusy(false);}
 }
 async function exportPpt(){
  if(!job)return;setBusy(true);
  try{
   if(job.fallbackSlides?.length){
    const deck=new pptxgen();
    deck.layout="LAYOUT_WIDE";deck.author="Haryomix AI Create Studio";deck.subject=topic;deck.title=job.title||topic;deck.company="Haryomix";
    deck.theme={headFontFace:"Aptos Display",bodyFontFace:"Aptos"};
    const cover=deck.addSlide();cover.background={color:"0B1020"};
    cover.addText(job.title||topic,{x:0.8,y:1.25,w:11.7,h:2.2,fontFace:"Aptos Display",fontSize:30,bold:true,color:"FFFFFF",breakLine:false,fit:"shrink"});
    cover.addText("Generated with Haryomix AI Create Studio",{x:0.85,y:4.05,w:10.5,h:0.5,fontFace:"Aptos",fontSize:14,color:"8BA4D9"});
    cover.addText(`${job.fallbackSlides.length} slides • Provider: ${job.provider||"AI"}`,{x:0.85,y:5.25,w:10.5,h:0.35,fontFace:"Aptos",fontSize:11,color:"AAB6CE"});
    job.fallbackSlides.forEach((item,index)=>{
     const slide=deck.addSlide();slide.background={color:index%2===0?"FFFFFF":"F5F7FB"};
     slide.addText(item.title||`Slide ${index+1}`,{x:0.65,y:0.45,w:12.0,h:0.75,fontFace:"Aptos Display",fontSize:25,bold:true,color:"14213D",fit:"shrink"});
     slide.addShape(deck.ShapeType.line,{x:0.68,y:1.35,w:1.25,h:0,line:{color:"356AE6",width:3}});
     const bullets=item.bullets.slice(0,5);const gap=Math.min(0.92,3.8/Math.max(bullets.length,1));
     bullets.forEach((bullet,i)=>slide.addText(bullet,{x:0.95,y:1.75+i*gap,w:11.2,h:Math.max(0.48,gap-0.08),fontFace:"Aptos",fontSize:Math.min(20,Math.max(15,22-bullets.length)),color:"273449",bullet:{indent:16},paraSpaceAfterPt:8,breakLine:false,fit:"shrink",valign:"middle"}));
     slide.addText(`${index+1} / ${job.fallbackSlides!.length}`,{x:11.3,y:7.05,w:1.2,h:0.2,fontFace:"Aptos",fontSize:9,color:"68758A",align:"right"});
     if(item.notes&&"addNotes" in slide&&typeof slide.addNotes==="function")slide.addNotes(item.notes);
    });
    await deck.writeFile({fileName:`${(job.title||topic).replace(/[^a-z0-9-_ ]/gi,"").trim().replace(/\s+/g,"-").slice(0,60)||"haryomix-presentation"}.pptx`});
    setMessage("Editable PPTX download ho gaya. Agar file nahi dikhe to browser downloads check karo.");
   }else{
    const data=await api("/api/ai/ppt",{action:"export",businessId:job.businessId});setMessage(data.status==="PROCESSING"?"PPTX export started. Ab export status check karo.":"Export request accepted.");
   }
  }catch(e){setMessage(e instanceof Error?e.message:"PPTX export failed.");}finally{setBusy(false);}
 }
 async function checkExport(){
  if(!job)return;setBusy(true);
  try{const data=await api("/api/ai/ppt",{action:"export-status",businessId:job.businessId});if(data.downloadUrl&&/^https:\/\//i.test(data.downloadUrl)){setDownloadUrl(data.downloadUrl);setMessage("PPTX ready. Download link lagbhag 30 minutes tak valid rahega.");}else if(String(data.status||"").toUpperCase()==="FAILED"){setMessage("PPTX export fail ho gaya. Export dobara start karke retry karo.");}else setMessage(`Export status: ${data.status}`);}
  catch(e){setMessage(e instanceof Error?e.message:"Could not check export.");}finally{setBusy(false);}
 }
 async function generateImage(){
  if(prompt.trim().length<5){setMessage("Image ka prompt thoda detail me likho.");return;}
  setBusy(true);setMessage("Image generate ho rahi hai…");setImage("");
  try{const data=await api("/api/ai/image",{prompt,size,provider:"auto"});const result=data.image?.url||data.image?.dataUrl||"";if(typeof result!=="string"||!(/^(https:\/\/|data:image\/(png|jpeg|webp|avif);base64,)/i.test(result)))throw new Error("Image service ne valid result nahi diya. Dobara try karo.");setImage(result);setMessage("Image generate ho gayi. Preview se save kar sakte ho.");}
  catch{setMessage("Image generation failed. Please check your prompt and retry.");}finally{setBusy(false);}
 }
 function downloadImage(){if(!image)return;const a=document.createElement("a");a.href=image;a.download="haryomix-ai-image.png";document.body.appendChild(a);a.click();a.remove();}
 return <div className="hmx-panel"><div className="hmx-panel-head"><h2>AI Create Studio</h2><span style={{fontSize:11,color:"#68758a"}}>Presentation & image tools</span></div><div className="hmx-panel-body">
  <div className="hmx-btn-row" style={{marginBottom:20}}><button className={`hmx-btn ${mode==="ppt"?"primary":""}`} onClick={()=>{setMode("ppt");setMessage("");}}>AI PowerPoint</button><button className={`hmx-btn ${mode==="image"?"primary":""}`} onClick={()=>{setMode("image");setMessage("");}}>AI Image</button></div>
  {mode==="ppt"?<>
   <div className="hmx-field"><label htmlFor="felo-ppt-topic">Presentation topic and requirements</label><textarea id="felo-ppt-topic" className="hmx-textarea" style={{minHeight:140,fontFamily:"inherit"}} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Topic, audience, language, key points, examples, level of detail, and desired conclusion…"/></div>
   <div className="hmx-field"><label htmlFor="felo-ppt-slides">Target slide count</label><select id="felo-ppt-slides" className="hmx-select" value={slides} onChange={e=>setSlides(e.target.value)}>{["5","8","10","12","15","20","25","30"].map(n=><option key={n} value={n}>{n} slides</option>)}</select></div>
   <div className="hmx-field"><label htmlFor="felo-ppt-style">Visual style</label><input id="felo-ppt-style" className="hmx-input" value={style} onChange={e=>setStyle(e.target.value)}/></div>
   <div className="hmx-btn-row"><button className="hmx-btn primary" disabled={busy} onClick={createPpt}>{busy?"Working…":"Generate AI presentation"}</button>{job&&!job.fallbackSlides&&<button className="hmx-btn" disabled={busy} onClick={checkStatus}>Check generation</button>}{job?.status==="COMPLETED"&&<button className="hmx-btn" disabled={busy} onClick={exportPpt}>Export editable PPTX</button>}{job&&!job.fallbackSlides&&<button className="hmx-btn" disabled={busy} onClick={checkExport}>Check PPTX export</button>}</div>
   {job&&<p style={{fontSize:12,color:"#6d7587",overflowWrap:"anywhere"}}>Task: {job.taskId}<br/>Status: {job.status}{job.provider?` • Provider: ${job.provider}`:""}</p>}{job?.liveUrl&&/^https:\/\//i.test(job.liveUrl)&&<p><a href={job.liveUrl} target="_blank" rel="noreferrer" className="hmx-btn" style={{display:"inline-block",textDecoration:"none"}}>Preview presentation</a></p>}{downloadUrl&&<p><a href={downloadUrl} target="_blank" rel="noreferrer" className="hmx-btn primary" style={{display:"inline-block",textDecoration:"none"}}>Download editable PPTX</a></p>}
  </>:<>
   <div className="hmx-field"><label htmlFor="felo-image-prompt">Describe the image</label><textarea id="felo-image-prompt" className="hmx-textarea" style={{minHeight:130,fontFamily:"inherit"}} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Subject, composition, mood, lighting, art direction, background, aspect ratio, intended use…"/></div>
      <div className="hmx-field"><label htmlFor="felo-image-size">Image size</label><select id="felo-image-size" className="hmx-select" value={size} onChange={e=>setSize(e.target.value)}><option value="1024x1024">Square · 1024 × 1024</option><option value="1536x1024">Landscape · 1536 × 1024</option><option value="1024x1536">Portrait · 1024 × 1536</option></select></div>
   <div className="hmx-btn-row"><button className="hmx-btn primary" disabled={busy} onClick={generateImage}>{busy?"Generating…":"Generate AI image"}</button>{image&&<button className="hmx-btn" onClick={downloadImage}>Download image</button>}</div>
   {image&&<img src={image} alt="AI-generated result" style={{display:"block",width:"100%",maxWidth:760,maxHeight:650,objectFit:"contain",marginTop:20,borderRadius:14,border:"1px solid #dce3ec",background:"#f5f7fb"}}/>}
  </>}
  {message&&<div className="hmx-note" role="status" style={{marginTop:18,overflowWrap:"anywhere"}}>{message}</div>}
  <p style={{fontSize:11,color:"#7a8292",lineHeight:1.6,marginTop:18}}>AI generation may use service credits. Results depend on the capabilities enabled for your account. PPT generation and PPTX export are separate tasks.</p>
 </div></div>
}
