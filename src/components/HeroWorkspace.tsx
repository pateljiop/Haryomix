import { useRef, useState, type PointerEvent } from "react";

const codeLines = [
  { n: "01", code: "const idea = await build();", tone: "blue" },
  { n: "02", code: "workspace.create(idea);", tone: "white" },
  { n: "03", code: "await ship({ quality: true });", tone: "red" },
];

export function HeroWorkspace() {
  const scene = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, px: 50, py: 50 });

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    setTilt({ x: (0.5 - py) * 9, y: (px - 0.5) * 12, px: px * 100, py: py * 100 });
  };
  const reset = () => setTilt({ x: 0, y: 0, px: 50, py: 50 });

  return <div className="hmx-hero-art hmx-hero-workspace" aria-label="Interactive 3D developer workspace">
    <div className="hmx-scene-orbit hmx-orbit-one" />
    <div className="hmx-scene-orbit hmx-orbit-two" />
    <div className="hmx-scene-glow" />
    <div
      ref={scene}
      className="hmx-3d-scene"
      onPointerMove={move}
      onPointerLeave={reset}
      style={{
        "--scene-rx": `${tilt.x}deg`,
        "--scene-ry": `${tilt.y}deg`,
        "--scene-mx": `${tilt.px}%`,
        "--scene-my": `${tilt.py}%`,
      } as React.CSSProperties}
    >
      <div className="hmx-float-card hmx-float-code">
        <div className="hmx-code-top"><span className="hmx-window-dots"><i/><i/><i/></span><span>build.ts</span><span className="hmx-code-live">● LIVE</span></div>
        <div className="hmx-code-lines">{codeLines.map(line => <div className="hmx-code-line" key={line.n}><span>{line.n}</span><code className={line.tone}>{line.code}</code></div>)}</div>
        <div className="hmx-code-status"><span/> All checks passed <span className="hmx-code-time">12ms</span></div>
      </div>
      <div className="hmx-laptop-wrap">
        <div className="hmx-laptop-screen">
          <div className="hmx-screen-top"><span className="hmx-window-dots"><i/><i/><i/></span><span>HARYOMIX / WORKSPACE</span><span className="hmx-screen-status">● READY</span></div>
          <div className="hmx-screen-layout">
            <div className="hmx-screen-sidebar"><b>H.</b><span className="active">⌘</span><span>▤</span><span>◈</span><span>✳</span><small>HB</small></div>
            <div className="hmx-screen-content">
              <div className="hmx-screen-eyebrow">YOUR CREATIVE SYSTEM</div>
              <div className="hmx-screen-title">Make something<br/><em>remarkable.</em></div>
              <div className="hmx-screen-subtitle">One workspace. Room to think.</div>
              <div className="hmx-screen-modules"><span><b>⌘</b> Code Doctor</span><span><b>▤</b> PPT Studio</span><span><b>✳</b> Exam Copilot</span></div>
              <div className="hmx-screen-bottom"><span><i/> All systems operational</span><span>HMX — 001</span></div>
            </div>
          </div>
          <div className="hmx-screen-reflection"/>
        </div>
        <div className="hmx-laptop-hinge"/>
        <div className="hmx-laptop-base"><div className="hmx-laptop-trackpad"/><div className="hmx-laptop-edge"/></div>
      </div>
      <div className="hmx-float-card hmx-float-insight"><span className="hmx-insight-icon">✳</span><div><small>STUDY SESSION</small><strong>Focus mode</strong><span>25 min · Deep work</span></div><span className="hmx-insight-check">✓</span></div>
      <div className="hmx-float-card hmx-float-metric"><span className="hmx-metric-label">WORKFLOW STATUS</span><strong><i/> Ready to create</strong><div className="hmx-metric-bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div>
      <div className="hmx-scene-crosshair">✳</div>
    </div>
    <span className="hmx-art-note hmx-art-note-one">01 / MAKE</span>
    <span className="hmx-art-note hmx-art-note-two">02 / LEARN</span>
    <span className="hmx-art-index">HMX — 001 / INTERACTIVE SCENE</span>
  </div>;
}
