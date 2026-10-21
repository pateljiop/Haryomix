import { useEffect, useState } from "react";
import { HaryomixWorkspace } from "./components/HaryomixWorkspace";
import { CommunityFeed } from "./components/CommunityFeed";
import { ModerationDashboard } from "./components/ModerationDashboard";
import { HeroWorkspace } from "./components/HeroWorkspace";

type ToolId = "index" | "code" | "ppt" | "pdf" | "image" | "exam" | "examcenter" | "quiz" | "progress" | "questionbank" | "ai" | "create" | "notes" | "flashcards" | "focus" | "utilities" | "calculator" | "converter" | "idarranger" | "algorithms";
const toolRoutes: Record<ToolId, string> = { index: "/workspace", code: "/workspace/code-doctor", ppt: "/workspace/ppt-studio", pdf: "/workspace/pdf-studio", image: "/workspace/image-studio", exam: "/workspace/exam-copilot", examcenter: "/workspace/exam-center", quiz: "/workspace/practice-quiz", progress: "/workspace/progress-tracker", questionbank: "/workspace/question-bank", ai: "/workspace/haryomix-ai", create: "/workspace/ai-create-studio", notes: "/workspace/notes", flashcards: "/workspace/flashcards", focus: "/workspace/focus-timer", utilities: "/workspace/student-utilities", calculator: "/workspace/scientific-calculator", converter: "/workspace/unit-converter", idarranger: "/workspace/id-arranger", algorithms: "/workspace/algorithms-lab" };
function toolFromPath(path: string): ToolId | null { const normalizedPath = path.replace(/\/+$/, "") || "/"; if (normalizedPath === "/workspace/study-planner") return "examcenter"; if (normalizedPath === "/workspace/study-library") return "notes"; const entry = (Object.entries(toolRoutes) as [ToolId, string][]).find(([, route]) => route === normalizedPath); return entry?.[0] ?? null; }
const tools: { id: ToolId; n: string; title: string; desc: string }[] = [
  { id: "code", n: "01", title: "Code Doctor", desc: "Describe a coding problem or paste code and get a suggested fix." },
  { id: "algorithms", n: "02", title: "Algorithms Lab", desc: "Generate algorithm implementations with complexity notes, examples and test cases." },
  { id: "ppt", n: "03", title: "PPT Studio", desc: "Turn a topic into structured, editable PowerPoint slides." },
  { id: "pdf", n: "04", title: "PDF Studio", desc: "Merge, split, rotate and reorder without rebuilding text." },
  { id: "image", n: "05", title: "Image Studio", desc: "Crop, resize, rotate, adjust and export in your browser." },
  { id: "examcenter", n: "05", title: "Exam Center", desc: "Choose Class 6–12, graduation or competitive-exam preparation and open focused study tools." },
  { id: "ai", n: "06", title: "Haryomix AI", desc: "Get help with coding, study and writing in one assistant." },
  { id: "create", n: "07", title: "AI Create Studio", desc: "Create presentation decks and images with the built-in creative tools." },
  { id: "calculator", n: "08", title: "Scientific Calculator", desc: "Evaluate scientific calculations locally without AI or an API key." },
  { id: "converter", n: "09", title: "Unit Converter", desc: "Convert length, mass, temperature, area, volume, speed, time and digital storage." },
  { id: "idarranger", n: "10", title: "ID Arranger", desc: "Arrange card front/back images into print-ready A4 sheets, locally in your browser." },
];

export default function App() {
  const [workspace, setWorkspace] = useState(() => toolFromPath(window.location.pathname) !== null);
  const [initialTool, setInitialTool] = useState<ToolId>(() => toolFromPath(window.location.pathname) ?? "code");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const openWorkspace = (tool: ToolId = "index") => { window.history.pushState({}, "", toolRoutes[tool]); setInitialTool(tool); setWorkspace(true); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const goHome = () => { window.history.pushState({}, "", "/"); setWorkspace(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  useEffect(() => { const syncRoute = () => { const tool = toolFromPath(window.location.pathname); setWorkspace(tool !== null); if (tool) setInitialTool(tool); }; window.addEventListener("popstate", syncRoute); return () => window.removeEventListener("popstate", syncRoute); }, []);
  if (window.location.pathname === "/moderation") return <ModerationDashboard onHome={() => { window.location.href = "/"; }} />;
  if (workspace) return <HaryomixWorkspace key={initialTool} initialTool={initialTool} onHome={goHome} />;
  return <main className="hmx-app">
    <nav className="hmx-nav" aria-label="Main navigation">
      <a className="hmx-brand" href="#top"><img src="/assets/brand/02_Compact_Logo.png" alt="" /> Hariom Builds <span className="hmx-byline">HARYOMIX WORKSPACE</span></a>
      <div id="hmx-mobile-navigation" className={`hmx-navlinks${mobileMenuOpen ? " is-open" : ""}`}>
        <a href="#tools" onClick={() => setMobileMenuOpen(false)}>Features</a>
        <a href="#tools" onClick={() => { setMobileMenuOpen(false); openWorkspace(); }}>Workspace</a>
        <a href="/workspace/exam-center" onClick={event => { event.preventDefault(); setMobileMenuOpen(false); openWorkspace("examcenter"); }}>Exam Center</a>
        <a href="#student-tools" onClick={() => setMobileMenuOpen(false)}>Utility Hub</a>
      </div>
      <div className="hmx-nav-actions">
        <button className="hmx-nav-menu" type="button" aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileMenuOpen} aria-controls="hmx-mobile-navigation" onClick={() => setMobileMenuOpen(open => !open)}>{mobileMenuOpen ? "×" : "☰"}</button>
        <button className="hmx-nav-cta" onClick={() => { setMobileMenuOpen(false); openWorkspace("index"); }}>Open workspace ↗</button>
      </div>
    </nav>
    <section id="top" className="hmx-hero">
      <div className="hmx-hero-copy"><p className="hmx-overline">HARYOMIX <span aria-hidden="true">/</span> BUILT BY HARIOM BUILDS</p><h1 className="hmx-heading">A better desk<br/>for the work<br/><span className="hmx-hero-gradient">you actually do.</span></h1><p className="hmx-copy">Made for real student work: clean up a PDF, prepare a presentation, resize an image, check a code snippet or organise exam revision. Open the tool you need and get straight to the task.</p><div className="hmx-hero-actions"><button className="hmx-tool-launch" onClick={() => openWorkspace("index")}>Launch workspace ↗</button><a className="hmx-study-launch" href="#tools">Explore capabilities ↓</a></div><div className="hmx-hero-tags"><span>#code</span><span>#build</span><span>#revise</span><span>#tools</span></div></div>
      <HeroWorkspace />
      <a href="#tools" className="hmx-scroll-cue"><span>SCROLL TO EXPLORE</span><span>↓</span></a>
    </section>
    <section className="hmx-section" id="tools"><div className="hmx-section-inner hmx-tool-layout">
      <div className="hmx-tool-intro"><p className="hmx-overline">One desk, many disciplines</p><h2 className="hmx-heading">Useful tools. No unnecessary steps.</h2><p className="hmx-copy">Small, practical tools for assignments, projects and revision—each with its own focused workspace.</p><button className="hmx-tool-launch" onClick={() => openWorkspace("index")}>Explore workspace ↗</button></div>
      <div className="hmx-tool-list">{tools.map(t => <button key={t.id} className="hmx-tool-row" onClick={() => openWorkspace(t.id)}><span className="hmx-tool-index">{t.n}</span><span><span className="hmx-tool-title">{t.title}</span><span className="hmx-tool-desc">{t.desc}</span></span><span className="hmx-tool-arrow">↗</span></button>)}</div>
    </div></section>
    <section className="hmx-toolbox"><div className="hmx-section-inner"><div className="hmx-toolbox-head"><div><h2 className="hmx-heading">Made for the work between classes.</h2></div><p className="hmx-copy">Straightforward tools for documents, images, code and study.</p></div>
      <div className="hmx-toolbox-grid">
        <button onClick={() => openWorkspace("pdf")} className="hmx-toolbox-card large"><span className="hmx-card-icon">▧</span><h3>PDF, without the layout panic.</h3><p>Merge, split, reorder and rotate pages while retaining original page content. Text replacement is a separate, font-sensitive operation.</p><span className="hmx-card-open">Open PDF Studio ↗</span></button>
        <button onClick={() => openWorkspace("ppt")} className="hmx-toolbox-card"><span className="hmx-card-icon">▤</span><h3>Presentation builder</h3><p>Organize a topic into clear, editable slides and export a PowerPoint file.</p><span className="hmx-card-open">Build a deck ↗</span></button>
        <button onClick={() => openWorkspace("image")} className="hmx-toolbox-card"><span className="hmx-card-icon">◩</span><h3>Image workshop</h3><p>Make images fit practical files, reports and slides.</p><span className="hmx-card-open">Edit an image ↗</span></button>
        <button onClick={() => openWorkspace("code")} className="hmx-toolbox-card"><span className="hmx-card-icon">{`{ }`}</span><h3>Debug with a plan</h3><p>Find likely syntax issues and investigate runtime errors.</p><span className="hmx-card-open">Check code ↗</span></button>
        <button onClick={() => openWorkspace("ai")} className="hmx-toolbox-card"><span className="hmx-card-icon">✦</span><h3>Haryomix AI assistant</h3><p>Get help with coding, study and writing through the configured assistant.</p><span className="hmx-card-open">Open Haryomix AI ↗</span></button>
        <button onClick={() => openWorkspace("create")} className="hmx-toolbox-card"><span className="hmx-card-icon">✧</span><h3>AI Create Studio</h3><p>Explore the configured creative workflow for presentation decks and images.</p><span className="hmx-card-open">Create something ↗</span></button>
        <button onClick={() => openWorkspace("examcenter")} className="hmx-toolbox-card"><span className="hmx-card-icon">✳</span><h3>Exam Center</h3><p>Choose Class 6–12, graduation semester preparation or a one-day competitive exam from one learning hub.</p><span className="hmx-card-open">Explore exam prep ↗</span></button>
      </div>
    </div></section>
    <section className="hmx-section" id="study"><div className="hmx-section-inner hmx-study"><div><h2 className="hmx-heading">A study routine that makes sense.</h2><p className="hmx-copy">Start with the syllabus or topic you have. Break it into smaller ideas, practise what you understand and use mistakes to decide what to review next.</p><div className="hmx-hero-actions"><button className="hmx-study-launch" onClick={() => openWorkspace("examcenter")}>Open Exam Center ↗</button></div></div><div className="hmx-study-rail"><div className="hmx-study-step"><h3>01 / Break it down</h3><p>Turn a broad subject into small, revision-friendly concepts.</p></div><div className="hmx-study-step"><h3>02 / Practice actively</h3><p>Test your understanding and explain the answer in your own words.</p></div><div className="hmx-study-step"><h3>03 / Review the gaps</h3><p>Use mistakes to decide what to revisit instead of rereading everything.</p></div></div></div></section>
    <section className="hmx-section hmx-seo-content" id="student-tools">
      <div className="hmx-section-inner">
        <p className="hmx-overline">Hariom Builds · Haryomix</p>
        <h2 className="hmx-heading">Free online tools for students, study and everyday assignments.</h2>
        <p className="hmx-copy">Haryomix brings useful student productivity tools into one browser workspace. Edit document pages, prepare images for assignments, organize presentations, investigate code errors and turn a syllabus or topic list into structured revision notes.</p>
        <div className="hmx-toolbox-grid" style={{marginTop:32}}>
          <article className="hmx-toolbox-card"><span className="hmx-card-icon">✳</span><h3>Exam Center</h3><p>Pick school, graduation or competitive-exam preparation, then open the tool you need.</p><button className="hmx-card-open" onClick={() => openWorkspace("examcenter")}>Explore Exam Center ↗</button></article>
          <article className="hmx-toolbox-card"><span className="hmx-card-icon">▧</span><h3>Online PDF tools</h3><p>Merge PDF files, split a PDF into individual pages, extract or remove selected pages, rotate pages, reverse page order, add page numbers or a text watermark, inspect page count, and convert JPG or PNG images to PDF. PDF operations run in your browser. OCR, full PDF-to-Word conversion, password removal and advanced compression are not currently offered.</p></article>
          <article className="hmx-toolbox-card"><span className="hmx-card-icon">◩</span><h3>Image resize and editing</h3><p>Resize images by width and height, crop the centre, rotate, adjust brightness and contrast, preview the result, and export as PNG, JPEG or WebP. Useful for assignment images, reports, slides and everyday student projects.</p></article>
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
    <section className="hmx-cta" id="open-source"><div className="hmx-cta-inner"><div><h2 className="hmx-heading">Made to be useful, not complicated.</h2><p>A practical student workspace by Hariom Builds. Use the tools, keep what helps and send feedback when something could work better.</p></div><div><button className="hmx-cta-link" onClick={() => openWorkspace()}>Open Haryomix ↗</button><p className="hmx-cta-note">Local utilities need no external AI key.</p></div></div></section>
    <CommunityFeed />
    <footer className="hmx-footer"><span><strong>Hariom Builds</strong> · Haryomix Workspace</span><span>Tools for students, built with care.</span></footer>
  </main>;
}
