import { useState } from "react";
import pptxgen from "pptxgenjs";
import JSZip from "jszip";

type SlideContent={title:string;bullets:string[];notes?:string;subtitle?:string;takeaway?:string;section?:string;layout?:string};
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
 const [previewIndex,setPreviewIndex]=useState(0);
 const [image,setImage]=useState("");
 const [downloadUrl,setDownloadUrl]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 async function createPpt(){
  if(topic.trim().length<10){setMessage("Topic ko thoda detail me likho (minimum 10 characters).");return;}
  setBusy(true);setMessage("Presentation task start ho raha hai…");setJob(null);
  try{
   const responseData=await api("/api/ai/ppt",{action:"create",query:topic,slides:Number(slides),style});
   // Accept slide payloads even if an edge/cache layer strips the optional mode field.
   const data=(responseData?.data&&typeof responseData.data==="object")
    ? {...responseData.data,...responseData}
    : responseData;
   if(Array.isArray(data.slides)&&data.slides.length){
    const fallbackSlides=data.slides.filter((slide:unknown):slide is SlideContent=>Boolean(slide&&typeof slide==="object"&&typeof (slide as SlideContent).title==="string"&&Array.isArray((slide as SlideContent).bullets)));
    if(!fallbackSlides.length)throw new Error("AI provider ne valid slide content nahi diya. Dobara try karo.");
    setJob({taskId:`local-${Date.now()}`,businessId:"local-pptx",status:"COMPLETED",fallbackSlides,provider:typeof data.provider==="string"?data.provider:"AI",title:typeof data.title==="string"?data.title:topic});setPreviewIndex(0);
    setDownloadUrl("");setMessage(`Slides ${typeof data.provider==="string"?data.provider:"AI"} se ready hain. “Export editable PPTX” dabao.`);return;
   }
   const taskId=typeof data.taskId==="string"?data.taskId:typeof data.task_id==="string"?data.task_id:"";
   const businessId=typeof data.businessId==="string"?data.businessId:typeof data.ppt_business_id==="string"?data.ppt_business_id:typeof data.ppt_biz_id==="string"?data.ppt_biz_id:"";
   if(!taskId||!businessId)throw new Error(typeof data.error==="string"&&data.error?data.error:"Presentation service response incomplete (missing task ID or presentation ID). Check the deployment and retry.");
   let currentJob:PptJob={taskId,businessId,status:typeof data.status==="string"?data.status:"RUNNING",liveDocId:data.liveDocId,provider:typeof data.provider==="string"?data.provider:"felo"};
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
   const fallbackSlides: SlideContent[] | undefined = job.fallbackSlides;
   if(fallbackSlides && fallbackSlides.length > 0){
    const deck=new pptxgen();
    deck.layout="LAYOUT_WIDE";
    deck.author="Haryomix AI Create Studio";deck.subject=topic;deck.title=job.title||topic;deck.company="Haryomix";
    deck.theme={headFontFace:"Aptos Display",bodyFontFace:"Aptos"};
    const C={navy:"0A1020",navy2:"121D36",ink:"17233B",muted:"66738A",blue:"4169E1",cyan:"55D6D0",pale:"F3F6FC",white:"FFFFFF",line:"DDE5F1",softBlue:"EAF0FF",softCyan:"E7F8F6",softGold:"FFF5DF",gold:"D59A26"};
    const H=7.5;
    const addText=(slide:any,text:string,opts:any)=>slide.addText(text,{fontFace:"Aptos",margin:0,breakLine:false,fit:"shrink",...opts});
    const addFooter=(slide:any,n:number,total:number,dark=false)=>{
      slide.addShape(deck.ShapeType.line,{x:0.62,y:7.05,w:12.08,h:0,line:{color:dark?"2B3853":C.line,width:0.7}});
      addText(slide,"HARYOMIX  /  AI CREATE STUDIO",{x:0.66,y:7.12,w:4.6,h:0.16,fontSize:7.5,bold:true,charSpacing:1.2,color:dark?"9AABC9":C.muted});
      addText(slide,String(n).padStart(2,"0")+"  /  "+String(total).padStart(2,"0"),{x:11.35,y:7.1,w:1.25,h:0.2,fontSize:8,color:dark?"9AABC9":C.muted,align:"right"});
    };
    const cover=deck.addSlide();cover.background={color:C.navy};
    cover.addShape(deck.ShapeType.rect,{x:0,y:0,w:0.18,h:H,line:{color:C.blue,transparency:100},fill:{color:C.blue}});
    cover.addShape(deck.ShapeType.ellipse,{x:8.9,y:-1.5,w:5.6,h:5.6,line:{color:"24385F",width:1.4,transparency:10},fill:{color:C.navy,transparency:100}});
    cover.addShape(deck.ShapeType.ellipse,{x:9.55,y:-0.85,w:4.3,h:4.3,line:{color:"2B4D8A",width:1.2,transparency:15},fill:{color:C.navy,transparency:100}});
    cover.addShape(deck.ShapeType.ellipse,{x:10.15,y:-0.25,w:3.1,h:3.1,line:{color:C.cyan,width:1.1,transparency:28},fill:{color:C.navy,transparency:100}});
    cover.addShape(deck.ShapeType.roundRect,{x:0.86,y:0.72,w:2.55,h:0.38,line:{color:"33466A",width:0.8},fill:{color:C.navy2}});
    addText(cover,"EXPERT PRESENTATION",{x:1.02,y:0.83,w:2.25,h:0.13,fontSize:8,bold:true,charSpacing:1.3,color:C.cyan});
    addText(cover,job.title||topic,{x:0.86,y:1.7,w:9.8,h:2.2,fontFace:"Aptos Display",fontSize:32,bold:true,color:C.white,breakLine:false,fit:"shrink",valign:"middle",lineSpacingMultiple:1.0});
    cover.addShape(deck.ShapeType.line,{x:0.9,y:4.15,w:1.35,h:0,line:{color:C.cyan,width:3}});
    addText(cover,"A structured, editable deck designed for clarity, depth and practical use.",{x:0.9,y:4.45,w:8.5,h:0.65,fontSize:16,color:"C7D3E9",breakLine:false,fit:"shrink"});
    addText(cover,"PREPARED WITH",{x:0.9,y:5.75,w:1.55,h:0.18,fontSize:7.5,bold:true,charSpacing:1,color:"8192B1"});
    addText(cover,job.provider||"AI-assisted research and synthesis",{x:0.9,y:6.05,w:7.5,h:0.28,fontSize:10,color:"DCE5F7"});
    addText(cover,"HARYOMIX",{x:10.5,y:6.15,w:1.95,h:0.28,fontSize:12,bold:true,charSpacing:2,color:C.white,align:"right"});
    addFooter(cover,1,fallbackSlides.length+1,true);
    fallbackSlides.forEach((item,index)=>{
      const slide=deck.addSlide();const dark=index%5===4;
      slide.background={color:dark?C.navy:(index%2===0?C.white:C.pale)};
      // Quiet editorial background: fine guide lines and soft orbital accents, kept behind content.
      const bgLine=dark?"22314D":"E7ECF5";
      for(let gridX=1.1;gridX<12.7;gridX+=1.15){slide.addShape(deck.ShapeType.line,{x:gridX,y:0.05,w:0,h:6.85,line:{color:bgLine,width:0.35,transparency:dark?55:45}});}
      for(let gridY=0.75;gridY<6.9;gridY+=0.82){slide.addShape(deck.ShapeType.line,{x:0.18,y:gridY,w:12.95,h:0,line:{color:bgLine,width:0.35,transparency:dark?55:45}});}
      slide.addShape(deck.ShapeType.ellipse,{x:10.45,y:-0.78,w:3.3,h:3.3,line:{color:dark?"35517C":"C9D8F8",width:1,transparency:25},fill:{color:dark?C.navy:C.white,transparency:100}});
      slide.addShape(deck.ShapeType.ellipse,{x:11.0,y:-0.23,w:2.2,h:2.2,line:{color:dark?C.cyan:C.blue,width:0.8,transparency:62},fill:{color:dark?C.navy:C.white,transparency:100}});
      const ink=dark?C.white:C.ink,muted=dark?"B4C1D9":C.muted;
      const section=(item.section||(["FOUNDATIONS","KEY IDEAS","PRACTICAL APPLICATION","ANALYSIS","TAKEAWAYS"][index%5])).toUpperCase().slice(0,36);
      slide.addShape(deck.ShapeType.rect,{x:0,y:0,w:0.16,h:H,line:{color:C.blue,transparency:100},fill:{color:C.blue}});
      addText(slide,section,{x:0.72,y:0.48,w:8.6,h:0.18,fontSize:8,bold:true,charSpacing:1.8,color:dark?C.cyan:C.blue});
      addText(slide,item.title||("Key idea "+(index+1)),{x:0.7,y:0.83,w:11.95,h:0.78,fontFace:"Aptos Display",fontSize:25,bold:true,color:ink,fit:"shrink",valign:"middle"});
      slide.addShape(deck.ShapeType.line,{x:0.72,y:1.72,w:1.12,h:0,line:{color:C.cyan,width:2.7}});
      if(item.subtitle){
        addText(slide,item.subtitle,{x:0.72,y:1.88,w:11.8,h:0.42,fontSize:11,color:muted,fit:"shrink"});
      }
      const bullets=item.bullets.slice(0,5);
      const top=item.subtitle?2.48:2.12;
      const available=(item.takeaway?3.55:4.15);
      const gap=Math.min(1.08,available/Math.max(bullets.length,1));
      const layout=(item.layout||(["cards","process","spotlight"][index%3])).toLowerCase();
      if(layout==="process"&&bullets.length>=3){
        const stepW=11.8/Math.min(bullets.length,4);
        bullets.slice(0,4).forEach((bullet,i)=>{
          const x=0.72+i*stepW;
          slide.addShape(deck.ShapeType.roundRect,{x,y:top+0.12,w:stepW-0.18,h:2.8,line:{color:dark?"304264":C.line,width:0.8},fill:{color:dark?C.navy2:C.white}});
          slide.addShape(deck.ShapeType.ellipse,{x:x+0.18,y:top+0.32,w:0.48,h:0.48,line:{color:C.blue,transparency:100},fill:{color:C.blue}});
          addText(slide,String(i+1).padStart(2,"0"),{x:x+0.18,y:top+0.47,w:0.48,h:0.12,fontSize:9,bold:true,color:C.white,align:"center"});
          addText(slide,bullet,{x:x+0.18,y:top+1.02,w:stepW-0.55,h:1.55,fontSize:13,bold:true,color:ink,fit:"shrink",valign:"top",breakLine:false});
        });
      }else if(layout==="spotlight"){
        const first=bullets[0]||"";
        slide.addShape(deck.ShapeType.roundRect,{x:0.72,y:top+0.05,w:4.15,h:2.85,line:{color:dark?"304264":"D8E3FF",width:0.8},fill:{color:dark?C.navy2:C.softBlue}});
        addText(slide,"CORE INSIGHT",{x:1.02,y:top+0.35,w:3.3,h:0.18,fontSize:8,bold:true,charSpacing:1.3,color:C.blue});
        addText(slide,first,{x:1.02,y:top+0.76,w:3.45,h:1.7,fontFace:"Aptos Display",fontSize:19,bold:true,color:ink,fit:"shrink",valign:"mid"});
        bullets.slice(1,5).forEach((bullet,i)=>{
          const y=top+0.1+i*0.73;
          slide.addShape(deck.ShapeType.ellipse,{x:5.25,y:y+0.1,w:0.18,h:0.18,line:{color:C.cyan,transparency:100},fill:{color:C.cyan}});
          addText(slide,bullet,{x:5.62,y,w:6.65,h:0.55,fontSize:13,color:ink,fit:"shrink",valign:"mid"});
        });
      }else{
        bullets.forEach((bullet,i)=>{
          const col=i%2,row=Math.floor(i/2);
          const x=0.72+col*6.0,y=top+row*gap;
          slide.addShape(deck.ShapeType.roundRect,{x,y,w:5.72,h:Math.max(0.72,gap-0.12),line:{color:dark?"304264":C.line,width:0.7},fill:{color:dark?C.navy2:C.white}});
          slide.addShape(deck.ShapeType.rect,{x:x+0.02,y:y+0.12,w:0.045,h:Math.max(0.42,gap-0.36),line:{color:C.blue,transparency:100},fill:{color:i%2===0?C.blue:C.cyan}});
          addText(slide,String(i+1).padStart(2,"0"),{x:x+0.22,y:y+0.14,w:0.4,h:0.16,fontSize:8,bold:true,color:C.blue});
          addText(slide,bullet,{x:x+0.72,y:y+0.13,w:4.72,h:Math.max(0.42,gap-0.28),fontSize:12.5,color:ink,fit:"shrink",valign:"mid"});
        });
      }
      if(item.takeaway){
        slide.addShape(deck.ShapeType.roundRect,{x:0.72,y:6.18,w:11.8,h:0.58,line:{color:dark?"304264":"C8EDE8",width:0.7},fill:{color:dark?C.navy2:C.softCyan}});
        addText(slide,"KEY TAKEAWAY",{x:0.94,y:6.36,w:1.38,h:0.14,fontSize:7.5,bold:true,charSpacing:0.8,color:dark?C.cyan:"157C78"});
        addText(slide,item.takeaway,{x:2.42,y:6.29,w:9.78,h:0.28,fontSize:10.5,bold:true,color:ink,fit:"shrink",valign:"mid"});
      }
      addFooter(slide,index+2,fallbackSlides.length+1,dark);
      if(item.notes&&typeof slide.addNotes==="function")slide.addNotes(item.notes);
    });
    // Add native PowerPoint slide transitions to the exported Open XML package.
    const pptxBuffer=await deck.write({outputType:"arraybuffer"});
    const zip=await JSZip.loadAsync(pptxBuffer as ArrayBuffer);
    const slideFiles=Object.keys(zip.files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name));
    for(const fileName of slideFiles){
      const xmlFile=zip.file(fileName);
      if(!xmlFile)continue;
      let xml=await xmlFile.async("string");
      if(!xml.includes("<p:transition")){
        const transition=fileName.endsWith("slide1.xml")
          ? '<p:transition spd="med"><p:fade/></p:transition>'
          : '<p:transition spd="med"><p:wipe dir="l"/></p:transition>';
        if(xml.includes("<p:timing"))xml=xml.replace("<p:timing",transition+"<p:timing");
        else if(xml.includes("</p:clrMapOvr>"))xml=xml.replace("</p:clrMapOvr>","</p:clrMapOvr>"+transition);
        else xml=xml.replace("</p:sld>",transition+"</p:sld>");
        zip.file(fileName,xml);
      }
    }
    const animatedPptx=await zip.generateAsync({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.presentationml.presentation"});
    const downloadAnchor=document.createElement("a");
    const fileUrl=URL.createObjectURL(animatedPptx);
    downloadAnchor.href=fileUrl;
    downloadAnchor.download=`${(job.title||topic).replace(/[^a-z0-9-_ ]/gi,"").trim().replace(/\\s+/g,"-").slice(0,60)||"haryomix-presentation"}.pptx`;
    document.body.appendChild(downloadAnchor);downloadAnchor.click();downloadAnchor.remove();
    window.setTimeout(()=>URL.revokeObjectURL(fileUrl),1000);
    setMessage("Editable PPTX download ho gaya. Fade/wipe slide transitions added hain. PowerPoint slideshow mein transitions dikhenge.");
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
   <div className="hmx-btn-row"><button className="hmx-btn primary" disabled={busy} onClick={createPpt}>{busy?"Working…":"Generate AI presentation"}</button>{job&&!job.fallbackSlides&&<button className="hmx-btn" disabled={busy} onClick={checkStatus}>Check generation</button>}{job?.status==="COMPLETED"&&!job.fallbackSlides&&<button className="hmx-btn" disabled={busy} onClick={exportPpt}>Export editable PPTX</button>}{job&&!job.fallbackSlides&&<button className="hmx-btn" disabled={busy} onClick={checkExport}>Check PPTX export</button>}</div>
   <style>{`
    @keyframes hmxSlideEnter{from{opacity:0;transform:translateY(14px) scale(.985);filter:blur(3px)}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}
    @keyframes hmxOrbDrift{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(-12px,9px,0) scale(1.04)}}
    @keyframes hmxAccentSweep{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes hmxBulletEnter{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes hmxGridGlow{0%,100%{opacity:.24}50%{opacity:.48}}
    .hmx-slide-motion{animation:hmxSlideEnter .52s cubic-bezier(.2,.75,.25,1) both}
    .hmx-preview-orb{animation:hmxOrbDrift 9s ease-in-out infinite}
    .hmx-preview-grid{animation:hmxGridGlow 7s ease-in-out infinite}
    .hmx-preview-bullet{animation:hmxBulletEnter .42s cubic-bezier(.2,.75,.25,1) both}
    @media(prefers-reduced-motion:reduce){.hmx-slide-motion,.hmx-preview-orb,.hmx-preview-grid,.hmx-preview-bullet{animation:none!important}}
   `}</style>
   {job?.fallbackSlides&&job.fallbackSlides.length>0&&<section aria-label="Presentation preview" style={{marginTop:22,border:"1px solid #dce4f0",borderRadius:18,overflow:"hidden",background:"#0b1220",color:"#f5f7ff",boxShadow:"0 14px 40px rgba(13,25,48,.12)"}}>
    <div style={{padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,borderBottom:"1px solid #253149",flexWrap:"wrap"}}>
     <div><div style={{fontSize:10,fontWeight:800,letterSpacing:1.8,color:"#64d9d0"}}>LIVE SLIDE PREVIEW</div><div style={{fontSize:13,color:"#aab8d0",marginTop:4}}>Review your slides before exporting</div></div>
     <div style={{fontSize:12,color:"#c6d2e8",fontVariantNumeric:"tabular-nums"}}>{previewIndex+2} / {(job.fallbackSlides?.length||0)+1}</div>
    </div>
    <div key={previewIndex} className="hmx-slide-motion" style={{minHeight:330,padding:"clamp(20px,5vw,42px)",background:previewIndex%5===4?"linear-gradient(135deg,#101b33,#17294a)":"linear-gradient(135deg,#ffffff,#f2f6fc)",color:"#17233b",position:"relative",isolation:"isolate",overflow:"hidden"}}>
     <div aria-hidden="true" className="hmx-preview-grid" style={{position:"absolute",inset:0,zIndex:-1,pointerEvents:"none",backgroundImage:"linear-gradient(rgba(65,105,225,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(65,105,225,.055) 1px,transparent 1px)",backgroundSize:"32px 32px"}}/>
     <div aria-hidden="true" className="hmx-preview-orb" style={{position:"absolute",zIndex:-1,pointerEvents:"none",width:220,height:220,borderRadius:"50%",right:-55,top:-100,border:"1px solid "+(previewIndex%5===4?"rgba(85,214,208,.45)":"rgba(65,105,225,.22)"),boxShadow:"0 0 0 26px "+(previewIndex%5===4?"rgba(85,214,208,.035)":"rgba(65,105,225,.025)")}}/>
     <div style={{fontSize:10,fontWeight:800,letterSpacing:2,color:"#4169e1",textTransform:"uppercase"}}>{job.fallbackSlides[previewIndex]?.section||(["FOUNDATIONS","KEY IDEAS","PRACTICAL APPLICATION","ANALYSIS","TAKEAWAYS"][previewIndex%5])}</div>
     <h3 style={{fontSize:"clamp(23px,4vw,36px)",lineHeight:1.12,letterSpacing:"-0.035em",margin:"14px 0 12px",color:previewIndex%5===4?"#fff":"#17233b"}}>{job.fallbackSlides[previewIndex]?.title||"Slide preview"}</h3>
     {job.fallbackSlides[previewIndex]?.subtitle&&<p style={{fontSize:14,lineHeight:1.6,color:previewIndex%5===4?"#c3d0e7":"#66738a",margin:"0 0 20px"}}>{job.fallbackSlides[previewIndex]?.subtitle}</p>}
     <div style={{height:3,width:54,borderRadius:8,background:"#55d6d0",margin:"14px 0 22px"}}/>
     <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,220px),1fr))",gap:12}}>
      {job.fallbackSlides[previewIndex]?.bullets.slice(0,5).map((bullet,i)=><div key={i} className="hmx-preview-bullet" style={{animationDelay:`${Math.min(i,4)*85}ms`,display:"flex",gap:11,alignItems:"flex-start",padding:14,borderRadius:12,border:"1px solid "+(previewIndex%5===4?"#304264":"#dce5f1"),background:previewIndex%5===4?"rgba(21,34,59,.86)":"rgba(255,255,255,.9)"}}>
       <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",flex:"0 0 25px",height:25,borderRadius:8,background:i%2===0?"#4169e1":"#55bfb8",color:"#fff",fontSize:10,fontWeight:800}}>{String(i+1).padStart(2,"0")}</span>
       <span style={{fontSize:13,lineHeight:1.55,color:previewIndex%5===4?"#e1e9f7":"#263650"}}>{bullet}</span>
      </div>)}
     </div>
     {job.fallbackSlides[previewIndex]?.takeaway&&<div style={{marginTop:20,padding:"13px 15px",borderRadius:11,background:previewIndex%5===4?"#172b46":"#e7f8f6",border:"1px solid "+(previewIndex%5===4?"#2d536d":"#c8ede8")}}><div style={{fontSize:9,fontWeight:800,letterSpacing:1.2,color:"#238b84",marginBottom:5}}>KEY TAKEAWAY</div><div style={{fontSize:12,fontWeight:700,lineHeight:1.5,color:previewIndex%5===4?"#f1f7ff":"#263650"}}>{job.fallbackSlides[previewIndex]?.takeaway}</div></div>}
     <div style={{display:"flex",justifyContent:"space-between",gap:12,marginTop:28,paddingTop:12,borderTop:"1px solid "+(previewIndex%5===4?"#304264":"#dce5f1"),fontSize:9,fontWeight:800,letterSpacing:1.1,color:previewIndex%5===4?"#9aabc9":"#7b879a"}}><span>HARYOMIX · AI CREATE STUDIO</span><span>{String(previewIndex+2).padStart(2,"0")} / {String((job.fallbackSlides?.length||0)+1).padStart(2,"0")}</span></div>
    </div>
    {job.fallbackSlides[previewIndex]?.notes&&<details style={{padding:"12px 18px",borderTop:"1px solid #253149",color:"#d6e0f1"}}><summary style={{cursor:"pointer",fontSize:12,fontWeight:700}}>Presenter notes</summary><p style={{fontSize:12,lineHeight:1.7,color:"#b8c6dc",whiteSpace:"pre-wrap"}}>{job.fallbackSlides[previewIndex]?.notes}</p></details>}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:14,borderTop:"1px solid #253149",flexWrap:"wrap"}}>
     <button type="button" className="hmx-btn" disabled={previewIndex===0} onClick={()=>setPreviewIndex(i=>Math.max(0,i-1))}>← Previous slide</button>
     <div style={{display:"flex",gap:5,flexWrap:"wrap",justifyContent:"center"}}>{job.fallbackSlides.map((_,i)=><button type="button" key={i} aria-label={"Go to slide "+(i+2)} title={"Slide "+(i+2)} onClick={()=>setPreviewIndex(i)} style={{width:8,height:8,padding:0,border:0,borderRadius:8,cursor:"pointer",background:i===previewIndex?"#55d6d0":"#42516b"}}/>)}</div>
     <button type="button" className="hmx-btn" disabled={previewIndex===job.fallbackSlides.length-1} onClick={()=>setPreviewIndex(i=>Math.min((job.fallbackSlides?.length||1)-1,i+1))}>Next slide →</button>
    </div>
   </section>}
   {job?.fallbackSlides&&<div className="hmx-btn-row" style={{marginTop:14}}><button className="hmx-btn primary" disabled={busy} onClick={exportPpt}>Download editable PPTX</button></div>}
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
