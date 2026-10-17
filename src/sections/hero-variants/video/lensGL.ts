import { HEAT_GLSL } from "./heatField";

/**
 * The thermal lens fill: a small raw WebGL canvas (WebGL2, else WebGL1; no three.js) the size of the lens ring,
 * drawn over the <video>. It samples the current video frame (or the poster) with the same object-fit: cover
 * mapping as the element, so it lines up pixel for pixel. Outside the lens circle it is fully transparent; inside,
 * the synthetic heat field (or a real thermal clip, when one is set) through the ironbow ramp, softened like a
 * 640x512 sensor, with a little noise and a thin bright rim.
 */

export interface LensFrame {
  /** lens centre and radius in stage CSS px */
  x: number;
  y: number;
  r: number;
  /** where the video frame sits in the stage (object-fit: cover + object-position), CSS px */
  cover: { ox: number; oy: number; w: number; h: number };
  /** frame aspect (w / h) */
  aspect: number;
  /** camera: anchor frame point (fx, fy), zoom, roll, anchor in source (ax, ay) */
  cam: { fx: number; fy: number; z: number; th: number; ax: number; ay: number };
  /** hotspot in frame fractions and its core size (frame-height units) */
  hot: { x: number; y: number; s: number };
  seed: number;
}

export interface LensGL {
  /** match the canvas to the lens: CSS size in px, device pixel ratio (capped by the caller) */
  resize(css: number, dpr: number): void;
  /** upload a new visible frame (video or poster image) */
  upload(src: TexImageSource): void;
  /** upload a new real thermal frame; mode "gray" maps white-hot luminance through the ramp */
  uploadThermal(src: TexImageSource | null, mode?: "color" | "gray"): void;
  draw(f: LensFrame): void;
  ok(): boolean;
  dispose(): void;
}

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uTex;
uniform sampler2D uThermal;
uniform float uThermalOn;   // 0 synthetic, 1 colour thermal clip, 2 white-hot thermal clip
uniform vec2 uRes;          // canvas px
uniform float uScale;       // canvas px per CSS px
uniform vec3 uLens;         // x, y, r (stage CSS px)
uniform vec4 uCover;        // ox, oy, w, h (stage CSS px)
uniform float uAspect;
uniform vec4 uCam;          // fx, fy, z, roll
uniform vec2 uAnchor;       // anchor in source fractions
uniform vec3 uHot;          // hotspot x, y (frame fractions), core size
uniform float uSeed;

${HEAT_GLSL}

vec3 ironbow(float x) {
  x = clamp(x, 0.0, 1.0) * 6.0;
  vec3 c = mix(vec3(0.0784, 0.0, 0.1804), vec3(0.2902, 0.0471, 0.4157), clamp(x, 0.0, 1.0));
  c = mix(c, vec3(0.6353, 0.098, 0.3569), clamp(x - 1.0, 0.0, 1.0));
  c = mix(c, vec3(0.9098, 0.2706, 0.1725), clamp(x - 2.0, 0.0, 1.0));
  c = mix(c, vec3(1.0, 0.6196, 0.1059), clamp(x - 3.0, 0.0, 1.0));
  c = mix(c, vec3(1.0, 0.902, 0.6275), clamp(x - 4.0, 0.0, 1.0));
  return mix(c, vec3(1.0), clamp(x - 5.0, 0.0, 1.0));
}

float hash(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}

void main() {
  vec2 d = vec2(gl_FragCoord.x - uRes.x * 0.5, uRes.y * 0.5 - gl_FragCoord.y) / uScale;
  float r = length(d);
  float aa = 1.0 / uScale;
  float inside = 1.0 - smoothstep(uLens.z - aa, uLens.z + aa * 0.5, r);
  if (inside <= 0.0) { gl_FragColor = vec4(0.0); return; }

  vec2 stage = uLens.xy + d;
  vec2 uv = (stage - uCover.xy) / uCover.zw;

  vec3 col;
  if (uThermalOn > 0.5) {
    vec3 t = texture2D(uThermal, uv).rgb;
    col = uThermalOn > 1.5 ? ironbow(dot(t, vec3(0.2126, 0.7152, 0.0722))) : t;
  } else {
    // sensor softness: a small blur of the visible frame before the heat model
    vec2 o = 1.7 / uCover.zw;
    vec3 c = texture2D(uTex, uv).rgb * 0.36
      + (texture2D(uTex, uv + vec2(o.x, 0.0)).rgb + texture2D(uTex, uv - vec2(o.x, 0.0)).rgb
      + texture2D(uTex, uv + vec2(0.0, o.y)).rgb + texture2D(uTex, uv - vec2(0.0, o.y)).rgb) * 0.12
      + (texture2D(uTex, uv + o).rgb + texture2D(uTex, uv - o).rgb
      + texture2D(uTex, uv + vec2(o.x, -o.y)).rgb + texture2D(uTex, uv + vec2(-o.x, o.y)).rgb) * 0.04;
    // frame -> source (for the far / sky cue)
    vec2 q = vec2((uv.x - uCam.x) * uAspect, uv.y - uCam.y);
    float cs = cos(uCam.w), sn = sin(uCam.w);
    vec2 src = vec2(uAnchor.x + (cs * q.x - sn * q.y) / (uCam.z * uAspect), uAnchor.y + (sn * q.x + cs * q.y) / uCam.z);
    float h = heatBg(c, src);
    h = heatHot(h, vec2((uv.x - uHot.x) * uAspect, uv.y - uHot.y), uHot.z);
    // sensor noise, per frame (seeded), on a slightly coarse grid
    h += (hash(floor(gl_FragCoord.xy / max(1.0, uScale)) + uSeed * 17.0) - 0.5) * 0.035;
    col = ironbow(h);
  }

  // a thin bright rim just inside the ring
  float rim = smoothstep(uLens.z - 2.4, uLens.z - 0.7, r);
  col = mix(col, vec3(1.0, 0.95, 0.9), rim * 0.55);
  gl_FragColor = vec4(col * inside, inside);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    console.warn("[hero-video] lens shader:", gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function makeTex(gl: WebGLRenderingContext): WebGLTexture | null {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  // 1x1 placeholder so the sampler is complete before the first frame
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([15, 14, 13, 255]));
  return t;
}

export function createLensGL(canvas: HTMLCanvasElement): LensGL | null {
  const opts: WebGLContextAttributes = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" };
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = (canvas.getContext("webgl2", opts) as WebGLRenderingContext | null) ?? (canvas.getContext("webgl", opts) as WebGLRenderingContext | null);
  } catch {
    gl = null;
  }
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("[hero-video] lens program:", gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const U = (n: string) => gl!.getUniformLocation(prog, n);
  const u = {
    tex: U("uTex"), thermal: U("uThermal"), thermalOn: U("uThermalOn"), res: U("uRes"), scale: U("uScale"), lens: U("uLens"),
    cover: U("uCover"), aspect: U("uAspect"), cam: U("uCam"), anchor: U("uAnchor"), hot: U("uHot"), seed: U("uSeed"),
  };
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.activeTexture(gl.TEXTURE1);
  const thermalTex = makeTex(gl);
  gl.activeTexture(gl.TEXTURE0);
  const tex = makeTex(gl);
  gl.uniform1i(u.tex, 0);
  gl.uniform1i(u.thermal, 1);
  gl.clearColor(0, 0, 0, 0);

  let lost = false;
  let thermalMode = 0;
  let scale = 1;
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
  };
  canvas.addEventListener("webglcontextlost", onLost);

  const upload = (unit: number, t: WebGLTexture | null, src: TexImageSource) => {
    if (lost || !gl) return false;
    try {
      gl.activeTexture(unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.activeTexture(gl.TEXTURE0);
      return true;
    } catch {
      return false;
    }
  };

  return {
    resize(css, dpr) {
      const px = Math.max(2, Math.round(css * dpr));
      if (canvas.width !== px) {
        canvas.width = px;
        canvas.height = px;
      }
      canvas.style.width = `${css}px`;
      canvas.style.height = `${css}px`;
      scale = px / css;
    },
    upload(src) {
      upload(gl!.TEXTURE0, tex, src);
    },
    uploadThermal(src, mode = "color") {
      thermalMode = src && upload(gl!.TEXTURE1, thermalTex, src) ? (mode === "gray" ? 2 : 1) : 0;
    },
    draw(f) {
      if (lost || !gl) return;
      const W = canvas.width;
      const H = canvas.height;
      gl.viewport(0, 0, W, H);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.res, W, H);
      gl.uniform1f(u.scale, scale);
      gl.uniform3f(u.lens, f.x, f.y, f.r);
      gl.uniform4f(u.cover, f.cover.ox, f.cover.oy, f.cover.w, f.cover.h);
      gl.uniform1f(u.aspect, f.aspect);
      gl.uniform4f(u.cam, f.cam.fx, f.cam.fy, f.cam.z, f.cam.th);
      gl.uniform2f(u.anchor, f.cam.ax, f.cam.ay);
      gl.uniform3f(u.hot, f.hot.x, f.hot.y, f.hot.s);
      gl.uniform1f(u.seed, f.seed % 997);
      gl.uniform1f(u.thermalOn, thermalMode);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    ok: () => !lost,
    dispose() {
      canvas.removeEventListener("webglcontextlost", onLost);
      if (!gl || lost) return;
      gl.deleteTexture(tex);
      gl.deleteTexture(thermalTex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      // (no loseContext(): a StrictMode remount gets this same canvas, and with it the same context, back)
    },
  };
}
