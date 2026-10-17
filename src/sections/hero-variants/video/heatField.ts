import { frameToSource, sourceToFrame, type Cam } from "./aerialPath";

/**
 * The synthetic thermal field for the aerial clip (there is no real thermal clip yet). One model, two copies kept
 * side by side on purpose: GLSL for the lens fill, JS for the SAMPLE readout under the lens.
 *
 *  - background heat from the visible colour: canopy (dark green) cool, bare ground / gravel / rock (bright,
 *    neutral) warmer, haze and sky (blue cast, or far: above the near ridge in the source still) cold;
 *  - a hotspot cluster at the smoke base (white-yellow core, orange halo) and a faint warm plume above it, scaled
 *    with the camera zoom so it stays glued to the footage.
 *
 * Heat h is a display value 0..1 mapped through the ironbow ramp. tempOf() turns it into the SAMPLE reading:
 * about 2 to 31 °C across the scene, rising steeply to the zone's peak (312.0) at the hotspot core.
 */

/* ---------- shared GLSL ---------- */

export const HEAT_GLSL = /* glsl */ `
float heatBg(vec3 c, vec2 src) {
  float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float sat = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
  float green = clamp((c.g - max(c.r, c.b)) * 9.0, 0.0, 1.0);
  float blue = clamp((c.b - c.r) * 7.0, 0.0, 1.0);
  float bare = (1.0 - smoothstep(0.05, 0.17, sat)) * smoothstep(0.20, 0.50, L) * (1.0 - blue);
  float h = 0.15 + 0.16 * smoothstep(0.04, 0.32, L) + 0.22 * bare - 0.05 * green;
  float edge = 0.318 - 0.19 * smoothstep(0.40, 0.72, src.x);
  float far = smoothstep(-0.03, 0.05, edge - src.y);
  return mix(h, 0.03 + 0.07 * smoothstep(0.15, 0.70, L), far);
}

float blob(vec2 q, vec2 o, float s, float k) {
  vec2 d = q - o;
  return k * exp(-dot(d, d) / (2.0 * s * s));
}

/* q: offset from the hotspot in frame-height units (y down); s: core size */
float heatHot(float h, vec2 q, float s) {
  float k = s / 0.013;
  // an irregular core, drawn out upward (heat rises): merged blobs in a stretched space
  vec2 qe = vec2(q.x, q.y * (q.y < 0.0 ? 0.72 : 1.15));
  float hot = max(max(blob(qe, vec2(0.0), s, 1.0), blob(qe, vec2(0.55 * s, 0.3 * s), 0.75 * s, 0.9)),
                  max(blob(qe, vec2(-0.5 * s, 0.4 * s), 0.7 * s, 0.86), blob(qe, vec2(0.12 * s, -0.95 * s), 0.55 * s, 0.82)));
  float r2 = dot(q, q);
  float halo = max(0.5 * exp(-r2 / (2.0 * (2.4 * s) * (2.4 * s))), 0.36 * exp(-r2 / (2.0 * (4.5 * s) * (4.5 * s))));
  float up = -q.y / k;
  float py = clamp(up / 0.30, 0.0, 1.0);
  float px = q.x / k + 0.02 * py;
  float smokeM = exp(-px * px / (2.0 * (0.016 + 0.05 * py) * (0.016 + 0.05 * py))) * smoothstep(0.0, 0.05, up) * (1.0 - smoothstep(0.7, 1.0, py));
  float plume = 0.13 * exp(-px * px / (2.0 * (0.010 + 0.03 * py) * (0.010 + 0.03 * py))) * smoothstep(0.0, 0.08, up) * (1.0 - py);
  h = h * (1.0 - 0.75 * smokeM) + 0.12 * smokeM;
  return max(h + plume, max(hot, halo));
}
`;

/* ---------- JS twin ---------- */

const ss = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const cl = (x: number) => Math.min(1, Math.max(0, x));

/** heatBg() from HEAT_GLSL. rgb 0..1, src = source fractions. */
export function heatBg(r: number, g: number, b: number, sx: number, sy: number): number {
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  const green = cl((g - Math.max(r, b)) * 9);
  const blue = cl((b - r) * 7);
  const bare = (1 - ss(0.05, 0.17, sat)) * ss(0.2, 0.5, L) * (1 - blue);
  const h = 0.15 + 0.16 * ss(0.04, 0.32, L) + 0.22 * bare - 0.05 * green;
  const edge = 0.318 - 0.19 * ss(0.4, 0.72, sx);
  const far = ss(-0.03, 0.05, edge - sy);
  return h * (1 - far) + (0.03 + 0.07 * ss(0.15, 0.7, L)) * far;
}

const blob = (qx: number, qy: number, ox: number, oy: number, s: number, k: number) => {
  const dx = qx - ox;
  const dy = qy - oy;
  return k * Math.exp(-(dx * dx + dy * dy) / (2 * s * s));
};

/** heatHot() from HEAT_GLSL (without the sensor noise). */
export function heatHot(h: number, qx: number, qy: number, s: number): number {
  const k = s / 0.013;
  const qe = qy * (qy < 0 ? 0.72 : 1.15);
  const hot = Math.max(
    blob(qx, qe, 0, 0, s, 1),
    blob(qx, qe, 0.55 * s, 0.3 * s, 0.75 * s, 0.9),
    blob(qx, qe, -0.5 * s, 0.4 * s, 0.7 * s, 0.86),
    blob(qx, qe, 0.12 * s, -0.95 * s, 0.55 * s, 0.82),
  );
  const r2 = qx * qx + qy * qy;
  const halo = Math.max(0.5 * Math.exp(-r2 / (2 * (2.4 * s) ** 2)), 0.36 * Math.exp(-r2 / (2 * (4.5 * s) ** 2)));
  const up = -qy / k;
  const py = cl(up / 0.3);
  const px = qx / k + 0.02 * py;
  const sm = 0.016 + 0.05 * py;
  const sp = 0.01 + 0.03 * py;
  const smokeM = Math.exp(-(px * px) / (2 * sm * sm)) * ss(0, 0.05, up) * (1 - ss(0.7, 1, py));
  const plume = 0.13 * Math.exp(-(px * px) / (2 * sp * sp)) * ss(0, 0.08, up) * (1 - py);
  const hb = h * (1 - 0.75 * smokeM) + 0.12 * smokeM;
  return Math.max(hb + plume, hot, halo);
}

/** The hotspot core size (frame-height units) for a camera: it grows with the push-in. */
export const hotSize = (c: Cam) => (0.013 * c.z) / 1.25;

/** Display heat -> SAMPLE °C: about 2 to 31 °C across the scene, then steeply up to the peak at the core. */
export function tempOf(h: number, peak: number): number {
  if (h <= 0.5) return 2 + 58 * Math.max(0, h);
  return 31 + (peak - 31) * Math.pow(Math.min(1, (h - 0.5) / 0.5), 2.2);
}

/* ---------- background heat grid (from the poster) ---------- */

export interface HeatGrid {
  w: number;
  h: number;
  data: Float32Array;
  /** the camera of the frame the grid was taken from */
  cam: Cam;
}

/** Background heat of the poster frame on a coarse grid (the readout's ground truth; cheap to sample). */
export function buildGrid(img: CanvasImageSource, cam: Cam, aspect: number, w = 192): HeatGrid | null {
  const h = Math.round(w / aspect);
  try {
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    const data = new Float32Array(w * h);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const k = (j * w + i) * 4;
        const [sx, sy] = frameToSource(cam, (i + 0.5) / w, (j + 0.5) / h, aspect);
        data[j * w + i] = heatBg(px[k] / 255, px[k + 1] / 255, px[k + 2] / 255, sx, sy);
      }
    }
    return { w, h, data, cam };
  } catch {
    return null;
  }
}

/** Background heat at frame point (u, v) of a frame shot with camera `cam` (bilinear on the poster grid). */
export function sampleGrid(g: HeatGrid, cam: Cam, u: number, v: number, aspect: number): number {
  const [sx, sy] = frameToSource(cam, u, v, aspect);
  const [pu, pv] = sourceToFrame(g.cam, sx, sy, aspect);
  const x = Math.min(g.w - 1, Math.max(0, pu * g.w - 0.5));
  const y = Math.min(g.h - 1, Math.max(0, pv * g.h - 0.5));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(g.w - 1, x0 + 1);
  const y1 = Math.min(g.h - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const d = g.data;
  const a = d[y0 * g.w + x0] * (1 - fx) + d[y0 * g.w + x1] * fx;
  const b = d[y1 * g.w + x0] * (1 - fx) + d[y1 * g.w + x1] * fx;
  return a * (1 - fy) + b * fy;
}
