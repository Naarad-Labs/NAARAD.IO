/* A two-colour ordered-dither background, drawn with WebGL.
 *
 * mountDither(el) puts a canvas behind el's content. With no WebGL, or when the
 * visitor asks for reduced motion, the canvas is drawn once (or not at all, and
 * el.dataset.ditherFallback = "1" lets the stylesheet show a static gradient).
 * No dependency; the idea follows ordered dithering with a 4x4 Bayer matrix. */

export const PALETTES = {
  navy: { back: '#0B1D3A', front: '#F26A1C' },
  sand: { back: '#F2E8DB', front: '#E4D9C3' },
  forest: { back: '#1E5B46', front: '#F2E8DB' },
};

export const pickPalette = (name) => PALETTES[name] || PALETTES.navy;

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** The ordered-dither threshold for pixel (x, y): one of 16 values in [0, 1). */
export const bayer4 = (x, y) => (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

export const shouldAnimate = ({ reducedMotion, hasWebGL }) => !reducedMotion && hasWebGL;

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

const VERTEX = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
const FRAGMENT = `precision mediump float;
uniform vec2 res; uniform float t; uniform vec3 back; uniform vec3 front;
float hash(vec2 s){ return fract(sin(dot(s, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 s){
  vec2 i = floor(s), f = fract(s); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float bayer(vec2 c){
  vec2 m = mod(c, 4.0);
  float i = m.y * 4.0 + m.x;
  float v = 0.0;
  ${BAYER4.map((n, i) => `if (abs(i - ${i}.0) < 0.5) v = ${n}.0;`).join('\n  ')}
  return (v + 0.5) / 16.0;
}
void main(){
  vec2 uv = gl_FragCoord.xy / res;
  float v = noise(uv * vec2(3.0, 3.0 * res.y / res.x) + vec2(t, t * 0.6));
  v = v * 0.7 + uv.x * 0.3;
  gl_FragColor = vec4(mix(back, front, step(bayer(gl_FragCoord.xy), v * 0.55)), 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

/** Returns a teardown function. Never throws. */
export function mountDither(el, { palette, scale = 3, speed = 0.15 } = {}) {
  const fallback = () => { el.dataset.ditherFallback = '1'; return () => {}; };
  try {
    const canvas = el.ownerDocument.createElement('canvas');
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return fallback();
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vs || !fs) return fallback();
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return fallback();
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const at = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    const colors = pickPalette(palette || el.dataset.dither);
    gl.uniform3fv(gl.getUniformLocation(program, 'back'), rgb(colors.back));
    gl.uniform3fv(gl.getUniformLocation(program, 'front'), rgb(colors.front));
    const uRes = gl.getUniformLocation(program, 'res');
    const uTime = gl.getUniformLocation(program, 't');

    canvas.className = 'dither-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    el.prepend(canvas);

    const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animate = shouldAnimate({ reducedMotion, hasWebGL: true });
    let raf = 0, visible = true, stopped = false;
    const start = performance.now();

    const draw = () => {
      raf = 0;
      if (stopped) return;
      gl.uniform1f(uTime, ((performance.now() - start) / 1000) * speed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (animate && visible && document.visibilityState === 'visible') raf = requestAnimationFrame(draw);
    };
    const kick = () => { if (!raf && !stopped) raf = requestAnimationFrame(draw); };
    const resize = () => {
      const k = Math.max(1, scale) / Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(el.clientWidth / k));
      canvas.height = Math.max(1, Math.round(el.clientHeight / k));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      kick();
    };

    const watchers = [];
    if (typeof ResizeObserver === 'function') { const o = new ResizeObserver(resize); o.observe(el); watchers.push(o); }
    if (animate && typeof IntersectionObserver === 'function') {
      const o = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; kick(); });
      o.observe(el); watchers.push(o);
    }
    const onVisibility = () => kick();
    document.addEventListener('visibilitychange', onVisibility);

    const teardown = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      watchers.forEach((o) => o.disconnect());
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.remove();
    };
    // A lost context leaves a blank canvas: drop it and let the static gradient show.
    canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); teardown(); el.dataset.ditherFallback = '1'; });
    resize();
    return teardown;
  } catch {
    return fallback();
  }
}
