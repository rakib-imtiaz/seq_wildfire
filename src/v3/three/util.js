// v3 Maquette: small shared helpers and the runtime loaders for three r170 and the M3T build.
//
// three is NOT bundled: the page's import map points "three" at /table/vendor/three/build/three.module.min.js.
// These modules are plain JS under src/v3 (Vite serves them), so they cannot `import 'three'` statically; the
// engine loads three once with a full URL (Vite leaves @vite-ignore imports alone) and passes it to every
// factory. The M3T model module imports 'three' through the import map, which resolves to the same URL, so both
// share one three instance.

const abs = (p) => new URL(p, window.location.origin).href;
export const URLS = {
  three: abs('/table/vendor/three/build/three.module.min.js'),
  m3t: abs('/table/js/m3t/model.js'),
  room: abs('/table/js/m3t/room-environment.js'),
};

let threeP = null;
export function loadThree() {
  if (!threeP) threeP = import(/* @vite-ignore */ URLS.three);
  return threeP;
}
export function loadM3T() {
  return Promise.all([import(/* @vite-ignore */ URLS.m3t), import(/* @vite-ignore */ URLS.room)]);
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const ok = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** smootherstep, for camera and state easing between beats (zero velocity and acceleration at both ends) */
export const ease = (t) => {
  t = clamp(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
/** window: 0 before a, ramps to 1 by b, holds, ramps back to 0 from c to d */
export const win = (x, a, b, c, d) => sstep(a, b, x) * (c === undefined ? 1 : 1 - sstep(c, d, x));

export function hash(n) {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** Distance from (x, z) to a polyline [[x, z], ...] */
export function polyDist(line, x, z) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / l2);
    const px = ax + dx * t - x, pz = az + dz * t - z;
    const d = px * px + pz * pz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

export function inPoly(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Resample a polyline every `step` metres; returns { pts: [[x,z]...], s: [0..1 arc fraction], len } */
export function densify(line, step) {
  const pts = [], s = [];
  let len = 0;
  const seg = [];
  for (let i = 0; i < line.length - 1; i++) {
    const l = Math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]);
    seg.push(l);
    len += l;
  }
  let acc = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const n = Math.max(1, Math.ceil(seg[i] / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      pts.push([line[i][0] + (line[i + 1][0] - line[i][0]) * t, line[i][1] + (line[i + 1][1] - line[i][1]) * t]);
      s.push((acc + seg[i] * t) / len);
    }
    acc += seg[i];
  }
  pts.push(line[line.length - 1].slice());
  s.push(1);
  return { pts, s, len };
}
