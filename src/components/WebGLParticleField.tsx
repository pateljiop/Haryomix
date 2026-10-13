import { useEffect, useRef } from "react";

const vertexShader = [
  "attribute vec3 aPosition;",
  "attribute float aSeed;",
  "uniform float uTime;",
  "uniform float uAspect;",
  "uniform float uPixelRatio;",
  "uniform float uMotion;",
  "varying float vDepth;",
  "varying float vSeed;",
  "void main() {",
  "  float angle = uTime * 0.12 * uMotion;",
  "  float ca = cos(angle);",
  "  float sa = sin(angle);",
  "  vec3 p = vec3(aPosition.x * ca - aPosition.z * sa, aPosition.y, aPosition.x * sa + aPosition.z * ca);",
  "  float tilt = sin(uTime * 0.07) * 0.12 * uMotion;",
  "  float ct = cos(tilt);",
  "  float st = sin(tilt);",
  "  p = vec3(p.x, p.y * ct - p.z * st, p.y * st + p.z * ct);",
  "  float depth = 3.1 + p.z;",
  "  gl_Position = vec4((p.x / depth) * 1.72 / uAspect + 0.10, (p.y / depth) * 1.72 + 0.02, 0.0, 1.0);",
  "  gl_PointSize = (1.25 + aSeed * 2.4) * (1.5 / depth) * uPixelRatio;",
  "  vDepth = (p.z + 1.0) * 0.5;",
  "  vSeed = aSeed;",
  "}",
].join("\n");

const fragmentShader = [
  "precision mediump float;",
  "varying float vDepth;",
  "varying float vSeed;",
  "void main() {",
  "  float distanceFromCenter = distance(gl_PointCoord, vec2(0.5));",
  "  if (distanceFromCenter > 0.5) discard;",
  "  float glow = smoothstep(0.5, 0.02, distanceFromCenter);",
  "  vec3 blue = vec3(0.18, 0.36, 0.96);",
  "  vec3 cyan = vec3(0.20, 0.82, 1.0);",
  "  vec3 color = mix(blue, cyan, clamp(vDepth * 0.82 + vSeed * 0.18, 0.0, 1.0));",
  "  gl_FragColor = vec4(color, glow * (0.15 + vDepth * 0.5));",
  "}",
].join("\n");

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function WebGLParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, powerPreference: "low-power" });
    if (!gl) return;

    const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
    if (!vertex || !fragment) {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    const count = 520;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * i;
      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * radius;
      seeds[i] = (i % 13) / 12;
    }

    const positionBuffer = gl.createBuffer();
    const seedBuffer = gl.createBuffer();
    if (!positionBuffer || !seedBuffer) {
      if (positionBuffer) gl.deleteBuffer(positionBuffer);
      if (seedBuffer) gl.deleteBuffer(seedBuffer);
      gl.deleteProgram(program);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const positionLocation = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, seedBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    const seedLocation = gl.getAttribLocation(program, "aSeed");
    gl.enableVertexAttribArray(seedLocation);
    gl.vertexAttribPointer(seedLocation, 1, gl.FLOAT, false, 0, 0);

    const timeLocation = gl.getUniformLocation(program, "uTime");
    const aspectLocation = gl.getUniformLocation(program, "uAspect");
    const pixelRatioLocation = gl.getUniformLocation(program, "uPixelRatio");
    const motionLocation = gl.getUniformLocation(program, "uMotion");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let disposed = false;

    const resize = () => {
      if (disposed) return;
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      if (aspectLocation) gl.uniform1f(aspectLocation, canvas.width / canvas.height);
      if (pixelRatioLocation) gl.uniform1f(pixelRatioLocation, ratio);
      if (motionLocation) gl.uniform1f(motionLocation, reducedMotion ? 0 : 1);
    };

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    window.addEventListener("resize", resize, { passive: true });
    resize();

    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);

    const startedAt = performance.now();
    const draw = (now: number) => {
      if (disposed) return;
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (timeLocation) gl.uniform1f(timeLocation, reducedMotion ? 0 : (now - startedAt) / 1000);
      gl.drawArrays(gl.POINTS, 0, count);
      if (!reducedMotion) frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(seedBuffer);
      gl.deleteProgram(program);
    };
  }, []);

  return <canvas ref={canvasRef} className="hmx-webgl-field" aria-hidden="true" />;
}
