import type { Pt, Zone } from "./zone";

/**
 * A procedural heightfield for the fictional watch zone, derived from zone.js geometry (river valley, reservoir,
 * dam, pads). Used only by the 2D placeholders and the sample map, so they agree with the 3D layout. All data is
 * SAMPLE data. Metres; x east, z south, heights up.
 */

/* ---------- noise ---------- */

function hash2(ix: number, iz: number, seed: number): number {
  let h = (Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263) + Math.imul(seed | 0, 144665)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm(x: number, z: number, oct = 4, seed = 1): number {
  let s = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    s += amp * vnoise(x * f, z * f, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return s / norm;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/* ---------- geometry helpers ---------- */

function polyInfo(line: Pt[], x: number, z: number): { d: number; side: number; dir: Pt } {
  let best = Infinity;
  let side = 1;
  let dir: Pt = [1, 0];
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i];
    const [bx, bz] = line[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const t = clamp01(((x - ax) * dx + (z - az) * dz) / len2);
    const px = ax + dx * t;
    const pz = az + dz * t;
    const dd = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (dd < best) {
      best = dd;
      side = dx * (z - az) - dz * (x - ax) > 0 ? 1 : -1;
      const l = Math.sqrt(len2);
      dir = [dx / l, dz / l];
    }
  }
  return { d: Math.sqrt(best), side, dir };
}

export function inPoly(poly: Pt[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Direction of the river at the dam (unit), and the crest direction (perpendicular). */
export function damAxes(Z: Zone): { flow: Pt; crest: Pt } {
  const { dir } = polyInfo(Z.river, Z.dam.x, Z.dam.z);
  return { flow: dir, crest: [-dir[1], dir[0]] };
}

/* ---------- the field ---------- */

export const WATER_LEVEL = 32;
export const SLAB_BASE = -52;

export interface Field {
  height(x: number, z: number): number;
  isWater(x: number, z: number, h: number): boolean;
  /** SAMPLE surface temperature; `peak` adds the narrow hotspot core (drawn as a smooth glow in images) */
  temp(x: number, z: number, h: number, shade: number, water: boolean, peak?: boolean): number;
}

/** Sun for the dusk light: low, from the west-south-west (the hero's "left"). */
export const SUN: [number, number, number] = (() => {
  const v: [number, number, number] = [-0.82, 0.36, 0.3];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

export function makeField(Z: Zone): Field {
  const { flow } = damAxes(Z);

  const raw = (x: number, z: number) => {
    const { d, side } = polyInfo(Z.river, x, z);
    const north = side < 0;
    const ridge = north ? 262 : 196;
    const width = north ? 560 : 420;
    const t = sstep(24, width, d);
    let h = ridge * Math.pow(t, 1.2);
    h += (fbm(x / 340 + 3.1, z / 340 - 1.7, 4, 11) - 0.5) * 128 * (0.12 + t);
    h += (fbm(x / 92, z / 92, 3, 23) - 0.5) * 20 * (0.2 + t);
    const s = (x - Z.dam.x) * flow[0] + (z - Z.dam.z) * flow[1];
    h += (1 - sstep(-30, 30, s)) * 16;
    return h;
  };

  const pads = [
    { x: Z.substation.x, z: Z.substation.z, r: Math.max(Z.substation.w, Z.substation.d) * 0.75, h: 0 },
    { x: Z.switchyard.x, z: Z.switchyard.z, r: Math.max(Z.switchyard.w, Z.switchyard.d) * 0.8, h: 0 },
  ];
  pads.forEach((p) => (p.h = raw(p.x, p.z)));

  const height = (x: number, z: number) => {
    let h = raw(x, z);
    for (const p of pads) {
      const d = Math.hypot(x - p.x, z - p.z);
      const k = 1 - sstep(p.r, p.r * 1.9, d);
      h = h + (p.h - h) * k;
    }
    return Math.max(2, h);
  };

  const isWater = (x: number, z: number, h: number) => h < WATER_LEVEL && inPoly(Z.reservoir, x, z);

  const hs = Z.hotspot;
  const temp = (x: number, z: number, h: number, shade: number, water: boolean, peak = true) => {
    if (water) return 8.5 + (fbm(x / 80, z / 80, 2, 51) - 0.5) * 1.6;
    let c = 12.5 + 21 * shade - 0.022 * h + (fbm(x / 58, z / 58, 3, 41) - 0.5) * 5.5;
    const dx = x - hs.x;
    const dz = z - hs.z;
    const d2 = dx * dx + dz * dz;
    c += 30 * Math.exp(-d2 / (2 * 72 * 72));
    return peak ? Math.max(c, hs.peakC * Math.exp(-d2 / (2 * 16 * 16))) : c;
  };

  return { height, isWater, temp };
}

/* ---------- grid ---------- */

export interface Grid {
  nx: number;
  nz: number;
  step: number;
  x0: number;
  z0: number;
  h: Float32Array; // render height (water flattened to WATER_LEVEL)
  shade: Float32Array; // 0..1 sun term
  temp: Float32Array; // degrees C (SAMPLE), with the hotspot core, for readouts
  tempBase: Float32Array; // without the narrow core, for colour (the core is drawn as a smooth glow)
  water: Uint8Array;
  field: Field;
}

const gridCache = new Map<string, Grid>();

export function buildGrid(Z: Zone, step: number): Grid {
  const key = `${step}|${Z.size.join("x")}|${Z.hotspot.x},${Z.hotspot.z}`;
  const hit = gridCache.get(key);
  if (hit) return hit;
  const field = makeField(Z);
  const [W, D] = Z.size;
  const x0 = -W / 2;
  const z0 = -D / 2;
  const nx = Math.round(W / step) + 1;
  const nz = Math.round(D / step) + 1;
  const N = nx * nz;
  const h = new Float32Array(N);
  const shade = new Float32Array(N);
  const temp = new Float32Array(N);
  const tempBase = new Float32Array(N);
  const water = new Uint8Array(N);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const x = x0 + i * step;
      const z = z0 + j * step;
      const hh = field.height(x, z);
      const w = field.isWater(x, z, hh);
      water[k] = w ? 1 : 0;
      h[k] = w ? WATER_LEVEL : hh;
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const hl = h[j * nx + Math.max(0, i - 1)];
      const hr = h[j * nx + Math.min(nx - 1, i + 1)];
      const hu = h[Math.max(0, j - 1) * nx + i];
      const hd = h[Math.min(nz - 1, j + 1) * nx + i];
      // normal of the surface (x east, y up, z south)
      let nxv = -(hr - hl) / (2 * step);
      let nyv = 1;
      let nzv = -(hd - hu) / (2 * step);
      const l = Math.hypot(nxv, nyv, nzv);
      nxv /= l;
      nyv /= l;
      nzv /= l;
      const s = Math.max(0, nxv * SUN[0] + nyv * SUN[1] + nzv * SUN[2]);
      shade[k] = s;
      const x = x0 + i * step;
      const z = z0 + j * step;
      temp[k] = field.temp(x, z, h[k], s, water[k] === 1);
      tempBase[k] = field.temp(x, z, h[k], s, water[k] === 1, false);
    }
  }
  const g: Grid = { nx, nz, step, x0, z0, h, shade, temp, tempBase, water, field };
  gridCache.set(key, g);
  return g;
}

export function sampleH(g: Grid, x: number, z: number): number {
  const fx = clamp01((x - g.x0) / ((g.nx - 1) * g.step)) * (g.nx - 1);
  const fz = clamp01((z - g.z0) / ((g.nz - 1) * g.step)) * (g.nz - 1);
  const i = Math.min(g.nx - 2, Math.floor(fx));
  const j = Math.min(g.nz - 2, Math.floor(fz));
  const tx = fx - i;
  const tz = fz - j;
  const a = g.h[j * g.nx + i];
  const b = g.h[j * g.nx + i + 1];
  const c = g.h[(j + 1) * g.nx + i];
  const d = g.h[(j + 1) * g.nx + i + 1];
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}

/* ---------- colour ---------- */

const IB: [number, number, number][] = [
  [0x14, 0x00, 0x2e],
  [0x4a, 0x0c, 0x6a],
  [0xa2, 0x19, 0x5b],
  [0xe8, 0x45, 0x2c],
  [0xff, 0x9e, 0x1b],
  [0xff, 0xe6, 0xa0],
  [0xff, 0xff, 0xff],
];

export function ironbow(s: number): [number, number, number] {
  const t = clamp01(s) * (IB.length - 1);
  const i = Math.min(IB.length - 2, Math.floor(t));
  const f = t - i;
  const a = IB[i];
  const b = IB[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Map a SAMPLE temperature to the ramp: ambient spreads over the cool half, heat compresses toward white. */
export function tempToS(c: number): number {
  if (c <= 60) return clamp01((c - 2) / 58) * 0.6;
  return 0.6 + 0.4 * clamp01(Math.log(c / 60) / Math.log(300 / 60));
}

/** Dusk palette for the visible view: ash in shadow, warm grey-brown where the low sun grazes. */
export function duskRGB(shade: number, h: number, water: boolean, n: number): [number, number, number] {
  if (water) {
    const f = 0.35 + 0.65 * n;
    return [15 + 26 * f, 15 + 15 * f, 16 + 8 * f];
  }
  const s = Math.pow(shade, 1.35);
  const e = Math.min(1, h / 260);
  const k = 0.88 + 0.22 * n;
  return [(18 + 78 * s + 10 * e) * k, (17 + 55 * s + 9 * e) * k, (16 + 38 * s + 8 * e) * k];
}

/* ---------- contours (marching squares) ---------- */

export interface Seg {
  level: number;
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

/** Per-cell contour segments, indexed by cell (j * (nx-1) + i). */
export function cellContours(g: Grid, levels: number[]): Seg[][] {
  const { nx, nz, step, x0, z0, h } = g;
  const out: Seg[][] = new Array((nx - 1) * (nz - 1));
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const v0 = h[j * nx + i];
      const v1 = h[j * nx + i + 1];
      const v2 = h[(j + 1) * nx + i + 1];
      const v3 = h[(j + 1) * nx + i];
      const segs: Seg[] = [];
      const xa = x0 + i * step;
      const za = z0 + j * step;
      for (const L of levels) {
        let c = 0;
        if (v0 >= L) c |= 1;
        if (v1 >= L) c |= 2;
        if (v2 >= L) c |= 4;
        if (v3 >= L) c |= 8;
        if (c === 0 || c === 15) continue;
        // edge points: e0 top (v0-v1), e1 right (v1-v2), e2 bottom (v3-v2), e3 left (v0-v3)
        const e = (k: number): Pt => {
          switch (k) {
            case 0: return [xa + step * ((L - v0) / (v1 - v0)), za];
            case 1: return [xa + step, za + step * ((L - v1) / (v2 - v1))];
            case 2: return [xa + step * ((L - v3) / (v2 - v3)), za + step];
            default: return [xa, za + step * ((L - v0) / (v3 - v0))];
          }
        };
        const pairs = CASES[c] ?? [];
        const centre = (v0 + v1 + v2 + v3) / 4 >= L;
        const use = c === 5 || c === 10 ? (centre ? SADDLE_HI[c] : SADDLE_LO[c]) : pairs;
        for (const [p, q] of use) {
          const a = e(p);
          const b = e(q);
          segs.push({ level: L, ax: a[0], az: a[1], bx: b[0], bz: b[1] });
        }
      }
      out[j * (nx - 1) + i] = segs;
    }
  }
  return out;
}

const CASES: Record<number, [number, number][]> = {
  1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]],
  9: [[0, 2]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]],
};
const SADDLE_LO: Record<number, [number, number][]> = { 5: [[3, 0], [1, 2]], 10: [[0, 1], [2, 3]] };
const SADDLE_HI: Record<number, [number, number][]> = { 5: [[3, 2], [0, 1]], 10: [[3, 0], [1, 2]] };

/** Stitched contour polylines (for SVG paths). */
export function contourPaths(g: Grid, levels: number[]): { level: number; d: string }[] {
  const cells = cellContours(g, levels);
  const byLevel = new Map<number, Seg[]>();
  for (const segs of cells) for (const s of segs) {
    let a = byLevel.get(s.level);
    if (!a) byLevel.set(s.level, (a = []));
    a.push(s);
  }
  const key = (x: number, z: number) => `${Math.round(x * 10)},${Math.round(z * 10)}`;
  const res: { level: number; d: string }[] = [];
  for (const [level, segs] of byLevel) {
    const ends = new Map<string, number[]>();
    segs.forEach((s, idx) => {
      for (const k of [key(s.ax, s.az), key(s.bx, s.bz)]) {
        const l = ends.get(k);
        if (l) l.push(idx);
        else ends.set(k, [idx]);
      }
    });
    const used = new Uint8Array(segs.length);
    let d = "";
    for (let s0 = 0; s0 < segs.length; s0++) {
      if (used[s0]) continue;
      used[s0] = 1;
      const pts: Pt[] = [[segs[s0].ax, segs[s0].az], [segs[s0].bx, segs[s0].bz]];
      // grow forward then backward
      for (const dirn of [1, -1]) {
        for (;;) {
          const tip = dirn === 1 ? pts[pts.length - 1] : pts[0];
          const cand = ends.get(key(tip[0], tip[1])) ?? [];
          const next = cand.find((c) => !used[c]);
          if (next === undefined) break;
          used[next] = 1;
          const s = segs[next];
          const other: Pt = key(s.ax, s.az) === key(tip[0], tip[1]) ? [s.bx, s.bz] : [s.ax, s.az];
          if (dirn === 1) pts.push(other);
          else pts.unshift(other);
        }
      }
      d += "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L");
    }
    res.push({ level, d });
  }
  return res.sort((a, b) => a.level - b.level);
}

/* ---------- hillshade images (top-down, for the sample map) ---------- */

const imgCache = new Map<string, Promise<string>>();

export function hillshadeURL(Z: Zone, mode: "visible" | "thermal", w = 960, h = 600): Promise<string> {
  const k = `${mode}|${w}x${h}|${Z.hotspot.x}`;
  const hit = imgCache.get(k);
  if (hit) return hit;
  const p = new Promise<string>((resolve) => {
    const g = buildGrid(Z, 10);
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d");
    if (!ctx) return resolve("");
    const img = ctx.createImageData(w, h);
    const { nx, nz } = g;
    const colR = new Float32Array(nx * nz);
    const colG = new Float32Array(nx * nz);
    const colB = new Float32Array(nx * nz);
    for (let k2 = 0; k2 < nx * nz; k2++) {
      const i = k2 % nx;
      const j = (k2 / nx) | 0;
      const x = g.x0 + i * g.step;
      const z = g.z0 + j * g.step;
      let c: [number, number, number];
      if (mode === "thermal") {
        c = ironbow(tempToS(g.tempBase[k2]));
      } else if (g.water[k2]) {
        c = [13, 13, 14];
      } else {
        // GIS-style hillshade: neutral ash, light from the north-west at 45 degrees
        const i = k2 % nx;
        const j = (k2 / nx) | 0;
        const hl = g.h[j * nx + Math.max(0, i - 1)];
        const hr = g.h[j * nx + Math.min(nx - 1, i + 1)];
        const hu = g.h[Math.max(0, j - 1) * nx + i];
        const hd = g.h[Math.min(nz - 1, j + 1) * nx + i];
        let ex = -(hr - hl) / (2 * g.step);
        let ey = 1;
        let ez = -(hd - hu) / (2 * g.step);
        const l = Math.hypot(ex, ey, ez);
        ex /= l;
        ey /= l;
        ez /= l;
        const lam = Math.max(0, ex * -0.5 + ey * 0.707 + ez * -0.5);
        const n = fbm(x / 40, z / 40, 2, 7);
        const v = (14 + 46 * Math.pow(lam, 1.6) + 10 * Math.min(1, g.h[k2] / 260)) * (0.94 + 0.1 * n);
        c = [v * 1.03, v, v * 0.95];
      }
      colR[k2] = c[0];
      colG[k2] = c[1];
      colB[k2] = c[2];
    }
    let p2 = 0;
    for (let py = 0; py < h; py++) {
      const fz = (py / (h - 1)) * (nz - 1);
      const j = Math.min(nz - 2, Math.floor(fz));
      const tz = fz - j;
      for (let px = 0; px < w; px++) {
        const fx = (px / (w - 1)) * (nx - 1);
        const i = Math.min(nx - 2, Math.floor(fx));
        const tx = fx - i;
        const a = j * nx + i;
        const b = a + 1;
        const c = a + nx;
        const d = c + 1;
        const wa = (1 - tx) * (1 - tz);
        const wb = tx * (1 - tz);
        const wc = (1 - tx) * tz;
        const wd = tx * tz;
        const grain = mode === "visible" ? (hash2(px, py, 3) - 0.5) * 5 : (hash2(px, py, 5) - 0.5) * 7;
        img.data[p2++] = colR[a] * wa + colR[b] * wb + colR[c] * wc + colR[d] * wd + grain;
        img.data[p2++] = colG[a] * wa + colG[b] * wb + colG[c] * wc + colG[d] * wd + grain;
        img.data[p2++] = colB[a] * wa + colB[b] * wb + colB[c] * wc + colB[d] * wd + grain;
        img.data[p2++] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (mode === "thermal") {
      // a smooth hot core: the grid is coarser than the hotspot
      const sx = ((Z.hotspot.x - g.x0) / (Z.size[0])) * w;
      const sy = ((Z.hotspot.z - g.z0) / (Z.size[1])) * h;
      const r = (34 / Z.size[0]) * w;
      const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      gr.addColorStop(0, "rgba(255,255,255,1)");
      gr.addColorStop(0.25, "rgba(255,230,160,0.95)");
      gr.addColorStop(0.6, "rgba(255,158,27,0.55)");
      gr.addColorStop(1, "rgba(232,69,44,0)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    cv.toBlob(
      (b) => resolve(b ? URL.createObjectURL(b) : cv.toDataURL("image/jpeg", 0.88)),
      "image/jpeg",
      0.9,
    );
  });
  imgCache.set(k, p);
  return p;
}
