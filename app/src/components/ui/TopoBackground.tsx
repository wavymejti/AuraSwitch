import { useEffect, useRef } from "react";

const VERTEX = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

// Animated topographic contour lines over a drifting simplex-noise height field.
const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_intensity;
out vec4 outColor;

vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float noise(vec2 p) {
  const float K1 = 0.366025404;
  const float K2 = 0.211324865;
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  float m = step(a.y, a.x);
  vec2 o = vec2(m, 1.0 - m);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n = h * h * h * h * vec3(dot(a, hash(i)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));
  return dot(n, vec3(70.0));
}
float fbm(vec2 p) {
  float f = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { f += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return f;
}
float contour(float v, float width) {
  float d = abs(fract(v - 0.5) - 0.5);
  float w = fwidth(v) * width;
  return 1.0 - smoothstep(0.0, w, d);
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  vec2 p = uv * 1.45 + u_mouse * 0.06;
  float t = u_time * 0.028;
  float h = fbm(p + vec2(t, -0.6 * t)) + 0.45 * fbm(p * 0.55 - vec2(0.3 * t, t));
  float v = h * 9.0;
  float minor = contour(v, 1.1);
  float major = contour(v / 5.0, 1.6);

  // Lines brighten on the ridges and toward the upper right, fade at the edges.
  float ridge = smoothstep(-0.3, 0.6, h);
  vec2 q = gl_FragCoord.xy / u_res;
  float vignette = smoothstep(1.25, 0.25, length((q - vec2(0.62, 0.62)) * vec2(1.25, 1.0)));
  float alpha = (minor * 0.16 + major * 0.42) * (0.45 + 0.55 * ridge) * vignette * u_intensity;

  vec3 lavender = vec3(0.67, 0.62, 0.95);
  vec3 pink = vec3(1.0, 0.62, 0.81);
  vec3 col = mix(lavender, pink, smoothstep(0.2, 0.9, q.x * 0.6 + h * 0.5));
  outColor = vec4(col * alpha, alpha);
}`;

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
  return s;
};

/** Full-screen animated topography (WebGL2). Renders nothing if WebGL2 is unavailable. */
export const TopoBackground = ({ intensity = 1 }: { intensity?: number }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext("webgl2", { premultipliedAlpha: true, antialias: false });
    if (!canvas || !gl) return;

    let program: WebGLProgram;
    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    } catch {
      return;
    }
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "u_res");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uMouse = gl.getUniformLocation(program, "u_mouse");
    const uIntensity = gl.getUniformLocation(program, "u_intensity");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, reduced ? 12 : (now - start) / 1000 + 12);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uIntensity, intensity);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (document.visibilityState === "visible") raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intensity]);

  return (
    <>
      <div className="bg-glow" aria-hidden />
      <canvas ref={ref} className="topo-bg" aria-hidden />
    </>
  );
};
