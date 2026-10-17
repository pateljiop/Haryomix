import { useState, type PointerEvent } from "react";
import { WebGLParticleField } from "./WebGLParticleField";

const modules = [
  { icon: "▤", name: "PDF Studio", note: "Pages, order, exports" },
  { icon: "▧", name: "Image Studio", note: "Crop, resize, convert" },
  { icon: "{ }", name: "Code Doctor", note: "Inspect common errors" },
  { icon: "✳", name: "Exam Copilot", note: "Notes and practice" },
];

export function HeroWorkspace() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    setTilt({ x: (0.5 - py) * 3, y: (px - 0.5) * 4 });
  };
  const reset = () => setTilt({ x: 0, y: 0 });

  return <div className="hmx-hero-art hmx-hero-workspace" aria-label="Preview of the Haryomix student workspace">
    <WebGLParticleField />
    <div className="hmx-3d-scene hmx-product-scene" onPointerMove={move} onPointerLeave={reset}
      style={{ "--scene-rx": `${tilt.x}deg`, "--scene-ry": `${tilt.y}deg` } as React.CSSProperties}>
      <div className="hmx-product-window">
        <header className="hmx-product-window-bar">
          <span className="hmx-window-dots"><i/><i/><i/></span>
          <span className="hmx-product-breadcrumb">HARYOMIX <span>/</span> WORKSPACE</span>
          <span className="hmx-product-window-label">TOOL DIRECTORY</span>
        </header>
        <div className="hmx-product-layout">
          <aside className="hmx-product-sidebar">
            <div className="hmx-product-monogram">H.</div>
            <span className="active">⌘</span><span>▤</span><span>◈</span><span>✳</span>
            <small>HB</small>
          </aside>
          <section className="hmx-product-main">
            <p className="hmx-product-eyebrow">YOUR WORKSPACE</p>
            <h3>What are you<br/>working on?</h3>
            <p className="hmx-product-subtitle">Choose a tool and get straight to it.</p>
            <div className="hmx-product-module-grid">
              {modules.map(module => <div className="hmx-product-module" key={module.name}>
                <span className="hmx-product-module-icon">{module.icon}</span>
                <span><strong>{module.name}</strong><small>{module.note}</small></span>
                <span className="hmx-product-module-arrow">↗</span>
              </div>)}
            </div>
            <footer className="hmx-product-footer"><span>Haryomix by Hariom Builds</span><span>Tools for real student work</span></footer>
          </section>
        </div>
      </div>
      <div className="hmx-product-caption"><span className="hmx-product-caption-mark">01</span><span><strong>One place to get it done.</strong><small>Documents · Creative work · Study</small></span></div>
    </div>
    <span className="hmx-art-note hmx-art-note-one">MAKE / 01</span>
    <span className="hmx-art-note hmx-art-note-two">LEARN / 02</span>
    <span className="hmx-art-index">HARYOMIX — PRODUCT PREVIEW</span>
  </div>;
}
