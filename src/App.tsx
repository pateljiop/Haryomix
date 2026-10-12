import { useState } from "react";
import { HaryomixWorkspace } from "./components/HaryomixWorkspace";
import { CommunityFeed } from "./components/CommunityFeed";
import { ModerationDashboard } from "./components/ModerationDashboard";

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
      <a className="hmx-brand" href="#top"><img src="/assets/brand/favicon.svg" alt="" /> Haryomix <span className="hmx-byline">BY HARIOM BUILDS</span></a>
      <div className="hmx-navlinks"><a href="#tools">Workspace</a><a href="#study">Study tools</a><a href="#open-source">Open source</a></div>
      <button className="hmx-nav-cta" onClick={() => openWorkspace()}>Open workspace ↗</button>
    </nav>
    <section id="top" className="hmx-hero">
      <div className="hmx-hero-copy"><p className="hmx-overline">Your student workspace</p><h1 className="hmx-heading">Make student work move.</h1><p className="hmx-copy">One calm workspace for code, documents, visuals and exam prep. Spend less time switching tools and more time understanding what you are building.</p><div className="hmx-hero-actions"><button className="hmx-tool-launch" onClick={() => openWorkspace()}>Explore workspace ↗</button><a className="hmx-study-launch" href="#tools">See what you can do ↓</a></div><div className="hmx-hero-tags"><span>Code</span><span>Create</span><span>Revise</span></div></div>
      <div className="hmx-hero-art" aria-label="Illustrated student desk"><div className="hmx-art-frame"><img src="/assets/world/hero-scene.svg" alt="A laptop, notes and study materials arranged on a bright desk" /></div><span className="hmx-art-note hmx-art-note-one">01 / MAKE</span><span className="hmx-art-note hmx-art-note-two">02 / LEARN</span><span className="hmx-art-index">HMX — 001</span></div>
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
    <section className="hmx-section" id="study"><div className="hmx-section-inner hmx-study"><div><h2 className="hmx-heading">Understand it. Practice it. Own it.</h2><p className="hmx-copy">Haryomix supports BTech, BCA, diploma and other courses. Bring your topic, notes or syllabus and turn it into a manageable next step.</p><button className="hmx-study-launch" onClick={() => openWorkspace("exam")}>Create a revision plan ↗</button></div><div className="hmx-study-rail"><div className="hmx-study-step"><h3>01 / Break it down</h3><p>Turn a broad subject into small, revision-friendly concepts.</p></div><div className="hmx-study-step"><h3>02 / Practice actively</h3><p>Test your understanding and explain the answer in your own words.</p></div><div className="hmx-study-step"><h3>03 / Review the gaps</h3><p>Use mistakes to decide what to revisit instead of rereading everything.</p></div></div></div></section>
    <section className="hmx-cta" id="open-source"><div className="hmx-cta-inner"><div><h2 className="hmx-heading">Build skills, not busywork.</h2><p>Haryomix is a student-first toolkit. Explore the workspace, test the tools and help shape what comes next.</p></div><div><button className="hmx-cta-link" onClick={() => openWorkspace()}>Open Haryomix ↗</button><p className="hmx-cta-note">Local utilities need no external AI key.</p></div></div></section>
    <CommunityFeed />
    <footer className="hmx-footer"><span><strong>Haryomix</strong> by Hariom Builds</span><span>Tools for students, built with care.</span></footer>
  </main>;
}
