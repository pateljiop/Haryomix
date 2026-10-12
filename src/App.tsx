import { useState } from "react";
import { HaryomixWorkspace } from "./components/HaryomixWorkspace";
import { CommunityFeed } from "./components/CommunityFeed";
import { ModerationDashboard } from "./components/ModerationDashboard";
import { HeroWorkspace } from "./components/HeroWorkspace";

type ToolId = "code" | "ppt" | "pdf" | "image" | "exam";
const tools: { id: ToolId; n: string; title: string; desc: string }[] = [
  { id: "code", n: "01", title: "Code Doctor", desc: "Trace common errors and get a focused debugging checklist." },
  { id: "ppt", n: "02", title: "PPT Studio", desc: "Turn a topic into structured, editable PowerPoint slides." },
  { id: "pdf", n: "03", title: "PDF Studio", desc: "Merge, split, rotate and reorder without rebuilding text." },
  { id: "image", n: "04", title: "Image Studio", desc: "Crop, resize, rotate, adjust and export in your browser." },
  { id: "exam", n: "05", title: "Exam Copilot", desc: "Create revision notes and test yourself with active recall." },
];

export default function App() {
  const [workspace, setWorkspace] = useState(false);
  const [initialTool, setInitialTool] = useState<ToolId>("code");
  const openWorkspace = (tool: ToolId = "code") => { setInitialTool(tool); setWorkspace(true); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const goHome = () => { setWorkspace(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  if (window.location.pathname === "/moderation") return <ModerationDashboard onHome={() => { window.location.href = "/"; }} />;
  if (workspace) return <HaryomixWorkspace key={initialTool} initialTool={initialTool} onHome={goHome} />;
  return <main className="hmx-app">
    <nav className="hmx-nav" aria-label="Main navigation">
      <a className="hmx-brand" href="#top"><img src="/assets/brand/02_Compact_Logo.png" alt="" /> Hariom Builds <span className="hmx-byline">HARYOMIX WORKSPACE</span></a>
      <div className="hmx-navlinks"><a href="#tools">Workspace</a><a href="#study">Study tools</a><a href="/pdf-tools/">PDF tools</a><a href="/image-resizer/">Image resizer</a><a href="/syllabus-notes/">Syllabus notes</a><a href="#student-tools">All tools</a></div>
      <button className="hmx-nav-cta" onClick={() => openWorkspace()}>Open workspace ↗</button>
    </nav>
    <section id="top" className="hmx-hero">
      <div className="hmx-hero-copy"><p className="hmx-overline">Your student workspace</p><h1 className="hmx-heading">Make student work move.</h1><p className="hmx-copy">One calm workspace for code, documents, visuals and exam prep. Spend less time switching tools and more time understanding what you are building.</p><div className="hmx-hero-actions"><button className="hmx-tool-launch" onClick={() => openWorkspace()}>Explore workspace ↗</button><a className="hmx-study-launch" href="#tools">See what you can do ↓</a></div><div className="hmx-hero-tags"><span>Code</span><span>Create</span><span>Revise</span></div></div>
      <HeroWorkspace />
      <a href="#tools" className="hmx-scroll-cue"><span>SCROLL TO EXPLORE</span><span>↓</span></a>
    </section>
    <section className="hmx-section" id="tools"><div className="hmx-section-inner hmx-tool-layout">
      <div className="hmx-tool-intro"><p className="hmx-overline">One desk, many disciplines</p><h2 className="hmx-heading">Your work deserves better tools.</h2><p className="hmx-copy">From a confusing compiler error to tomorrow's revision plan, keep everyday student work in one place.</p><button className="hmx-tool-launch" onClick={() => openWorkspace()}>Explore workspace ↗</button></div>
      <div className="hmx-tool-list">{tools.map(t => <button key={t.id} className="hmx-tool-row" onClick={() => openWorkspace(t.id)}><span className="hmx-tool-index">{t.n}</span><span><span className="hmx-tool-title">{t.title}</span><span className="hmx-tool-desc">{t.desc}</span></span><span className="hmx-tool-arrow">↗</span></button>)}</div>
    </div></section>
    <section className="hmx-toolbox"><div className="hmx-section-inner"><div className="hmx-toolbox-head"><div><h2 className="hmx-heading">Less busywork. More learning.</h2></div><p className="hmx-copy">Practical utilities that help you create, revise and submit with confidence.</p></div>
      <div className="hmx-toolbox-grid">
        <button onClick={() => openWorkspace("pdf")} className="hmx-toolbox-card large"><span className="hmx-card-icon">▧</span><h3>PDF, without the layout panic.</h3><p>Merge, split, reorder and rotate pages while retaining original page content. Text replacement is a separate, font-sensitive operation.</p><span className="hmx-card-open">Open PDF Studio ↗</span></button>
        <button onClick={() => openWorkspace("ppt")} className="hmx-toolbox-card"><span className="hmx-card-icon">▤</span><h3>Presentation builder</h3><p>Organize a topic into clear, editable slides and export a PowerPoint file.</p><span className="hmx-card-open">Build a deck ↗</span></button>
        <button onClick={() => openWorkspace("image")} className="hmx-toolbox-card"><span className="hmx-card-icon">◩</span><h3>Image workshop</h3><p>Make images fit practical files, reports and slides.</p><span className="hmx-card-open">Edit an image ↗</span></button>
        <button onClick={() => openWorkspace("code")} className="hmx-toolbox-card"><span className="hmx-card-icon">{`{ }`}</span><h3>Debug with a plan</h3><p>Find likely syntax issues and investigate runtime errors.</p><span className="hmx-card-open">Check code ↗</span></button>
        <button onClick={() => openWorkspace("exam")} className="hmx-toolbox-card"><span className="hmx-card-icon">✳</span><h3>Revision that sticks</h3><p>Make topic notes, practice questions and review weak areas.</p><span className="hmx-card-open">Start revising ↗</span></button>
      </div>
    </div></section>
    <section className="hmx-section" id="study"><div className="hmx-section-inner hmx-study"><div><h2 className="hmx-heading">Understand it. Practice it. Own it.</h2><p className="hmx-copy">Haryomix by Hariom Builds supports BTech, BCA, diploma and other courses. Bring your topic, notes or syllabus and turn it into a manageable next step.</p><button className="hmx-study-launch" onClick={() => openWorkspace("exam")}>Create a revision plan ↗</button></div><div className="hmx-study-rail"><div className="hmx-study-step"><h3>01 / Break it down</h3><p>Turn a broad subject into small, revision-friendly concepts.</p></div><div className="hmx-study-step"><h3>02 / Practice actively</h3><p>Test your understanding and explain the answer in your own words.</p></div><div className="hmx-study-step"><h3>03 / Review the gaps</h3><p>Use mistakes to decide what to revisit instead of rereading everything.</p></div></div></div></section>
    <section className="hmx-section hmx-seo-content" id="student-tools">
      <div className="hmx-section-inner">
        <p className="hmx-overline">Hariom Builds · Haryomix</p>
        <h2 className="hmx-heading">Free online tools for students, study and everyday assignments.</h2>
        <p className="hmx-copy">Haryomix brings useful student productivity tools into one browser workspace. Edit document pages, prepare images for assignments, organize presentations, investigate code errors and turn a syllabus or topic list into structured revision notes.</p>
        <div className="hmx-toolbox-grid" style={{marginTop:32}}>
          <article className="hmx-toolbox-card"><span className="hmx-card-icon">▧</span><h3>Online PDF tools</h3><p>Merge PDF files, split a PDF into individual pages, extract or remove selected pages, rotate pages, reverse page order, add page numbers or a text watermark, inspect page count, and convert JPG or PNG images to PDF. PDF operations run in your browser. OCR, full PDF-to-Word conversion, password removal and advanced compression are not currently offered.</p></article>
          <article className="hmx-toolbox-card"><span className="hmx-card-icon">◩</span><h3>Image resize and editing</h3><p>Resize images by width and height, crop the centre, rotate, adjust brightness and contrast, preview the result, and export as PNG, JPEG or WebP. Useful for assignment images, reports, slides and everyday student projects.</p></article>
          <article className="hmx-toolbox-card"><span className="hmx-card-icon">✳</span><h3>Syllabus-based notes and exam prep</h3><p>Enter your course, subject, syllabus units or chapter topics to generate detailed revision notes in simple English, Hindi or Hinglish. Optional practice mode requests 25 multiple-choice questions with answers and explanations. Verify syllabus coverage and current-affairs facts before an exam.</p></article>
          <article className="hmx-toolbox-card"><span className="hmx-card-icon">▤</span><h3>PowerPoint and assignment help</h3><p>Structure a topic into editable PowerPoint slides and use the workspace to plan academic content. Review generated work and adapt it to your teacher's format and your own understanding before submission.</p></article>
          <article className="hmx-toolbox-card"><span className="hmx-card-icon">{`{ }`}</span><h3>Code debugging for learners</h3><p>Use Code Doctor to spot common syntax patterns and get a focused debugging checklist for programming practice. It is a first-pass helper, not a replacement for running your program, compiler diagnostics or testing.</p></article>
          <article className="hmx-toolbox-card"><span className="hmx-card-icon">⌁</span><h3>Student-first, browser-based workspace</h3><p>Use practical tools for college assignments, revision, project files and document preparation in one place. Local file-editing tools work in your browser without requiring an upload account.</p></article>
        </div>
        <div style={{marginTop:56}}>
          <h2 className="hmx-heading" style={{fontSize:"clamp(2rem,4vw,3.5rem)"}}>Frequently asked questions</h2>
          <div className="hmx-tool-list" style={{marginTop:24}}>
            <details className="hmx-seo-faq"><summary>Can I edit or merge a PDF online for free?</summary><p>Yes. Haryomix PDF Studio includes browser-based tools to merge PDFs, extract or remove page ranges, split pages, rotate and reorder pages, add page numbers and watermarks, and convert images to PDF. Advanced OCR and arbitrary text editing are not included yet.</p></details>
            <details className="hmx-seo-faq"><summary>Can I resize an image without installing software?</summary><p>Yes. Open Image Studio in a modern browser to change image dimensions, crop, rotate, adjust brightness or contrast, preview and export to PNG, JPEG or WebP.</p></details>
            <details className="hmx-seo-faq"><summary>Can Haryomix make notes from my syllabus?</summary><p>Enter your course, subject and syllabus topics in Exam Copilot to request detailed, topic-by-topic study notes. You can choose English, Hindi or Hinglish and optionally request a 25-question MCQ quiz. Check the output against your official syllabus.</p></details>
            <details className="hmx-seo-faq"><summary>Does Haryomix help with college and competitive exams?</summary><p>Exam Copilot is designed for school, college, university and competitive-exam revision. It can organize topics, explain concepts and create optional practice questions. It does not guarantee exam questions or replace official study material.</p></details>
            <details className="hmx-seo-faq"><summary>Who makes Haryomix?</summary><p>Haryomix is a student productivity workspace by Hariom Builds, bringing together coding help, document and image utilities, presentations and study support.</p></details>
          </div>
        </div>
      </div>
    </section>
    <section className="hmx-cta" id="open-source"><div className="hmx-cta-inner"><div><h2 className="hmx-heading">Build skills, not busywork.</h2><p>Haryomix is a student-first toolkit by Hariom Builds. Explore the workspace, test the tools and help shape what comes next.</p></div><div><button className="hmx-cta-link" onClick={() => openWorkspace()}>Open Haryomix ↗</button><p className="hmx-cta-note">Local utilities need no external AI key.</p></div></div></section>
    <CommunityFeed />
    <footer className="hmx-footer"><span><strong>Hariom Builds</strong> · Haryomix Workspace</span><span>Tools for students, built with care.</span></footer>
  </main>;
}
