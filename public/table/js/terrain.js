// Command Table: the land. A fictional BC Interior river valley, 1600 × 1000 m, as one regular height
// grid that everything else reads.
//
//   height    a valley profile across the river's smoothed centre line (a canyon at the dam, a
//             floodplain downstream, a broad bench on the north side, ridges 120 to 250 m up), spurs
//             and gullies from valley-aligned ridged noise, then the engineered edits in order:
//             road benches (cut and fill with side slopes), pads, the reservoir shore (forced to
//             follow ZONE.reservoir exactly), the river channel below the dam
//   groundAt  the height of the rendered mesh itself (same triangulation), so props, roads and
//             wave 2's draped layers sit exactly on what is drawn
//   masks     one canvas (R gravel, G cleared ground, B damp ground), drawn with 2D strokes and
//             sampled by the ground shader and by the tree placement
//   walls     the slab's four cut faces: soil horizons, glacial till and dipping rock strata, with
//             the reservoir and river shown in section where the cut crosses them
import * as THREE from 'three';
import { ZONE } from './zone.js';
import {
  SLAB, LEVELS, DAM, RIVER, ROAD, ROAD_MAIN, ROAD_BRANCH, densify, project, pointAt, polySD,
  riverFloor, riverSurface, clamp, smooth, lerp,
} from './layout.js';
import { patchMaterial } from './shading.js';

const GRID = { lite: [256, 160], balanced: [384, 240], high: [512, 320] };

export const TERRAIN = { nx: 0, nz: 0, cell: 1, heights: null, forest: null, wet: null, slope: null };

/* --------------------------------------------------------------- CPU noise */
function hash2(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** −1..1 fractal value noise. */
export function fbm(x, z, oct = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let o = 0; o < oct; o++) { s += a * (vnoise(x * f + o * 17.3, z * f - o * 9.1) * 2 - 1); f *= 2.03; a *= 0.5; }
  return s;
}
/** 0..~1 ridged multifractal (sharp crests, soft valleys). */
function ridged(x, z, oct = 4) {
  let s = 0, a = 0.55, f = 1, w = 1;
  for (let o = 0; o < oct; o++) {
    let n = 1 - Math.abs(vnoise(x * f + o * 31.7, z * f + o * 11.3) * 2 - 1);
    n *= n; n *= w; w = clamp(n * 1.8, 0, 1);
    s += n * a; f *= 2.07; a *= 0.5;
  }
  return s;
}

/* --------------------------------------------------- tileable noise texture */
export const NOISE = { N: 256, tex: null };
function tileFbm(N, seed, octs) {
  const out = new Float32Array(N * N);
  let s = seed >>> 0; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (const [cells, amp] of octs) {
    const lat = new Float32Array(cells * cells); for (let i = 0; i < lat.length; i++) lat[i] = r();
    for (let y = 0; y < N; y++) {
      const fy = (y / N) * cells, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty);
      const r0 = (y0 % cells) * cells, r1 = ((y0 + 1) % cells) * cells;
      for (let x = 0; x < N; x++) {
        const fx = (x / N) * cells, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx);
        const c0 = x0 % cells, c1 = (x0 + 1) % cells;
        const top = lat[r0 + c0] + (lat[r0 + c1] - lat[r0 + c0]) * sx, bot = lat[r1 + c0] + (lat[r1 + c1] - lat[r1 + c0]) * sx;
        out[y * N + x] += amp * (top + (bot - top) * sy);
      }
    }
  }
  let lo = Infinity, hi = -Infinity; for (const v of out) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / (hi - lo);
  return out;
}
/** One tileable 256² RGBA value-noise texture (r macro, g meso, b micro, a patches). */
export function makeNoise(aniso = 4) {
  if (NOISE.tex) return NOISE.tex;
  const N = NOISE.N;
  const ch = [
    tileFbm(N, 11, [[4, 1], [8, 0.5], [16, 0.25]]),
    tileFbm(N, 23, [[8, 1], [16, 0.55], [32, 0.3]]),
    tileFbm(N, 37, [[32, 1], [64, 0.6], [128, 0.35]]),
    tileFbm(N, 53, [[6, 1], [12, 0.6], [24, 0.3], [48, 0.15]]),
  ];
  const d = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) for (let c = 0; c < 4; c++) d[i * 4 + c] = Math.round(ch[c][i] * 255);
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = aniso; t.needsUpdate = true;
  NOISE.tex = t;
  return t;
}

/* ------------------------------------------------- river (s, d) on a coarse grid */
const RQ = { step: 16, nx: 0, nz: 0, s: null, d: null };
function buildRiverGrid() {
  if (RQ.s) return;
  const st = RQ.step, nx = Math.round(SLAB.w / st) + 3, nz = Math.round(SLAB.d / st) + 3;
  RQ.nx = nx; RQ.nz = nz; RQ.s = new Float32Array(nx * nz); RQ.d = new Float32Array(nx * nz);
  const q = {}, L = RIVER;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = SLAB.x0 + (i - 1) * st, z = SLAB.z0 + (j - 1) * st;
    project(L, x, z, q);
    // a soft projection for s: the nearest point's arc length jumps across medial lines far from the
    // river (creases in everything that depends on s); a distance-weighted average along the river does not
    const a = Math.abs(q.d), sig = 25 + 0.55 * a, k2 = 1 / (2 * sig * sig);
    let ws = 0, w = 0;
    for (let m = 0; m < L.n; m += 3) {
      const dd = Math.hypot(L.x[m] - x, L.z[m] - z) - a;
      if (dd > 3.5 * sig) continue;
      const e = Math.exp(-dd * dd * k2);
      ws += e * L.s[m]; w += e;
    }
    RQ.s[j * nx + i] = w > 0 ? lerp(q.s, ws / w, smooth(30, 160, a)) : q.s;
    RQ.d[j * nx + i] = q.d;
  }
}
/** River arc length s and signed distance d (south bank positive) at (x, z), interpolated. */
export function riverSD(x, z, out = [0, 0]) {
  const st = RQ.step;
  const gx = clamp((x - SLAB.x0) / st + 1, 0, RQ.nx - 1.001), gz = clamp((z - SLAB.z0) / st + 1, 0, RQ.nz - 1.001);
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, k = j * RQ.nx + i;
  const S = RQ.s, D = RQ.d, n = RQ.nx;
  out[0] = (S[k] * (1 - fx) + S[k + 1] * fx) * (1 - fz) + (S[k + n] * (1 - fx) + S[k + n + 1] * fx) * fz;
  out[1] = (D[k] * (1 - fx) + D[k + 1] * fx) * (1 - fz) + (D[k + n] * (1 - fx) + D[k + n + 1] * fx) * fz;
  return out;
}

/* --------------------------------------------------------- the natural land */
/** Height of the land before any engineering: valley profile + spurs and gullies. */
export function naturalHeight(x, z, s, d) {
  const f = riverFloor(s);
  const k = s - DAM.sRiver;                    // > 0 downstream of the dam
  const a = Math.abs(d);
  const north = d < 0;
  const canyon = 1 - smooth(70, 420, Math.abs(k));            // 1 at the dam: a narrow notch
  const east = smooth(150, 800, k);                            // the valley opens to the south-east
  let h;
  if (north) {
    const w0 = lerp(k > 0 ? 38 : 30, 8, canyon);
    const A1 = lerp(lerp(90, 72, east), 94, canyon);
    const L1 = lerp(lerp(200, 230, east), 168, canyon);
    h = A1 * smooth(w0, w0 + L1, a);
    h += 22 * smooth(w0 + L1 - 20, w0 + L1 + 280, a);         // the broad dry bench
    h += 140 * smooth(565, 820, a);                            // up to the north ridge
  } else {
    const w0 = lerp(k > 0 ? lerp(46, 80, east) : 30, 8, canyon);
    const A1 = lerp(86, 92, canyon);
    const L1 = lerp(210, 170, canyon);
    h = A1 * smooth(w0, w0 + L1, a);
    h += 125 * smooth(w0 + L1 - 40, 640, a);                   // the south ridge (high in the west)
  }
  // terrain texture: weak on the floor, full on the walls
  const wallK = smooth(10, 90, a);
  // spurs and gullies: ridged noise in warped valley coordinates (drainages run roughly downslope,
  // irregular in spacing and direction), plus isotropic massifs so nothing reads as combed
  const wx = fbm(x / 310 + 1.3, z / 310 - 7.7, 3), wz = fbm(x / 310 - 4.1, z / 310 + 2.6, 3);
  // (far from the river the nearest-point arc length jumps across a medial line: fade to plain noise there)
  const near = 1 - smooth(240, 430, a);
  const sg = near * ridged(s / 175 + wx * 0.9 + 3.7, a / 240 + wz * 0.8 + (north ? 0 : 17.1), 4)
    + (1 - near) * ridged(x / 200 + wx * 0.9 - 2.3, z / 200 + wz * 0.9 + 6.1, 4);
  const iso = ridged(x / 420 + wz * 0.6 + 11.3, z / 420 + wx * 0.6 - 5.2, 3);
  const up = 0.4 + 0.6 * smooth(40, 280, a);
  h += (sg - 0.4) * 34 * wallK * up;
  h += (iso - 0.4) * 30 * wallK * up;
  h += 24 * fbm(x / 560 + 3.1, z / 560 - 1.7, 3) * wallK;      // broad undulation
  h += 6.5 * fbm(x / 85 + wx * 0.4 + 0.7, z / 85 + 4.3, 3) * (0.25 + 0.75 * wallK);
  h += 1.3 * fbm(x / 21, z / 21, 2) * (0.4 + 0.6 * wallK);
  return f + h;
}

/* --------------------------------------------------- the river's own shape */
let BRIDGE_RS = -1e9;          // the river's arc length at the branch road's bridge (set by buildHeightfield)
/**
 * The river below the dam by arc length s: a natural channel inside the smoothed valley line. m: the
 * channel's offset from that line (negative: north, away from the road on the south bank); hwN, hwS: half
 * widths to the north and south waterlines (the south one held narrow where the road runs close); bar:
 * 0..1, a gravel bar on the north side (two reaches). Fixed (m 0, 12.5 m) at the dam's toe and the bridge.
 */
export function riverShape(s, out = {}) {
  const k = s - DAM.sRiver;
  const free = smooth(70, 170, k) * smooth(40, 95, Math.abs(s - BRIDGE_RS));
  const n1 = fbm(s / 170 + 4.1, 2.3, 3) * 0.5 + 0.5, n2 = fbm(s / 95 - 1.7, 7.9, 3) * 0.5 + 0.5;
  const bar = Math.max(Math.exp(-(((k - 200) / 62) ** 2)), Math.exp(-(((k - 740) / 78) ** 2))) * free;
  out.m = -(2 + 8 * n1) * free;
  const hw = 12.5 + (n2 - 0.5) * 9 * free;
  out.hwS = Math.min(hw, 12.5);
  out.hwN = hw - 4.5 * bar;
  out.bar = bar;
  return out;
}

/* --------------------------------------------------------------- the edits */
export const PADS = [];          // { name, x, z, w, d, rot, y, gravel }
export const ROADS = [];         // { name, L (line), y (Float32Array per point), half }

function gridIndexRange(x0, x1, z0, z1) {
  const c = TERRAIN.cell;
  return [
    clamp(Math.floor((x0 - SLAB.x0) / c), 0, TERRAIN.nx), clamp(Math.ceil((x1 - SLAB.x0) / c), 0, TERRAIN.nx),
    clamp(Math.floor((z0 - SLAB.z0) / c), 0, TERRAIN.nz), clamp(Math.ceil((z1 - SLAB.z0) / c), 0, TERRAIN.nz),
  ];
}

/** Road profile: the natural ground along the line, smoothed, with fixed heights where given. */
function roadProfile(L, sample, fixes = [], win = 60, maxGrade = 0.16) {
  const n = L.n, raw = new Float32Array(n), out = new Float32Array(n);
  for (let i = 0; i < n; i++) raw[i] = sample(L.x[i], L.z[i]);
  // moving average by arc length (two passes)
  let src = raw;
  for (let pass = 0; pass < 2; pass++) {
    const dst = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0, w = 0;
      for (let j = i; j >= 0 && L.s[i] - L.s[j] <= win; j--) { const k = 1 - (L.s[i] - L.s[j]) / win; sum += src[j] * k; w += k; }
      for (let j = i + 1; j < n && L.s[j] - L.s[i] <= win; j++) { const k = 1 - (L.s[j] - L.s[i]) / win; sum += src[j] * k; w += k; }
      dst[i] = sum / w;
    }
    src = dst;
  }
  out.set(src);
  for (const { s, y, r } of fixes) {
    for (let i = 0; i < n; i++) { const k = 1 - smooth(r * 0.15, r, Math.abs(L.s[i] - s)); out[i] = lerp(out[i], y, k); }
  }
  // limit the grade: relax toward the neighbours wherever a step is steeper than maxGrade, keeping the
  // fixed points (a gravel road may be steep, but never a ramp)
  const fixed = new Uint8Array(n);
  for (const { s } of fixes) { let b = Infinity, bi = 0; for (let i = 0; i < n; i++) { const d = Math.abs(L.s[i] - s); if (d < b) { b = d; bi = i; } } fixed[bi] = 1; }
  for (let it = 0; it < 400; it++) {
    let worst = 0;
    for (let i = 1; i < n - 1; i++) {
      if (fixed[i]) continue;
      const g0 = (out[i] - out[i - 1]) / (L.s[i] - L.s[i - 1]), g1 = (out[i + 1] - out[i]) / (L.s[i + 1] - L.s[i]);
      const m = Math.max(Math.abs(g0), Math.abs(g1));
      if (m > maxGrade) { out[i] = (out[i - 1] + out[i + 1]) / 2; worst = Math.max(worst, m); }
    }
    if (!worst) break;
  }
  return out;
}

/** Bench a road into the grid: flat across its width, cut/fill side slopes beyond. */
function benchRoad(H, L, ys, half, skip) {
  const N = H.length, c = TERRAIN.cell, W1 = TERRAIN.nx + 1;
  const best = new Float32Array(N).fill(1e9), tgt = new Float32Array(N);
  const reach = half + 80;
  for (let i = 0; i < L.n - 1; i++) {
    const ax = L.x[i], az = L.z[i], bx = L.x[i + 1], bz = L.z[i + 1];
    const [i0, i1, j0, j1] = gridIndexRange(Math.min(ax, bx) - reach, Math.max(ax, bx) + reach, Math.min(az, bz) - reach, Math.max(az, bz) + reach);
    const ux = bx - ax, uz = bz - az, uu = ux * ux + uz * uz || 1;
    for (let jz = j0; jz <= j1; jz++) for (let ix = i0; ix <= i1; ix++) {
      const x = SLAB.x0 + ix * c, z = SLAB.z0 + jz * c;
      const f = clamp(((x - ax) * ux + (z - az) * uz) / uu, 0, 1);
      const dd = Math.hypot(x - ax - ux * f, z - az - uz * f);
      const v = jz * W1 + ix;
      if (dd < best[v]) { best[v] = dd; tgt[v] = ys[i] + (ys[i + 1] - ys[i]) * f; }
    }
  }
  for (let v = 0; v < N; v++) {
    if (best[v] > reach) continue;
    if (skip && skip(v)) continue;
    const dl = Math.abs(H[v] - tgt[v]);
    const W = 3 + dl * 1.25;                       // side slopes about 1 : 1.25
    const k = 1 - smooth(half, half + W, best[v]);
    H[v] = lerp(H[v], tgt[v], k);
  }
}

/** Flatten a rotated rectangle pad (half sizes hw, hd) to height y, with blended batters around it. */
function benchPad(H, cx, cz, hw, hd, rot, y, batter = 0.9) {
  const c = TERRAIN.cell, W1 = TERRAIN.nx + 1, reach = Math.max(hw, hd) + 70;
  const [i0, i1, j0, j1] = gridIndexRange(cx - reach, cx + reach, cz - reach, cz + reach);
  const cs = Math.cos(rot), sn = Math.sin(rot);
  for (let jz = j0; jz <= j1; jz++) for (let ix = i0; ix <= i1; ix++) {
    const x = SLAB.x0 + ix * c - cx, z = SLAB.z0 + jz * c - cz;
    const a = x * cs + z * sn, b = -x * sn + z * cs;
    const qx = Math.max(Math.abs(a) - hw, 0), qz = Math.max(Math.abs(b) - hd, 0);
    const dd = Math.hypot(qx, qz);
    const v = jz * W1 + ix;
    const dl = Math.abs(H[v] - y);
    const k = 1 - smooth(0, 2.5 + dl * batter, dd);
    if (k > 0) H[v] = lerp(H[v], y, k);
  }
}

/* ---------------------------------------------------------------- build */
/**
 * Build the height grid for a quality tier. Fills TERRAIN (heights, forest, wet, slope), PADS and
 * ROADS. Deterministic: every tier samples the same functions.
 */
export function buildHeightfield(tier = 'balanced') {
  const [nx, nz] = GRID[tier] || GRID.balanced;
  TERRAIN.nx = nx; TERRAIN.nz = nz; TERRAIN.cell = SLAB.w / nx;
  const W1 = nx + 1, H1 = nz + 1, N = W1 * H1, c = TERRAIN.cell;
  buildRiverGrid();
  const sd = [0, 0];
  const nat = (x, z) => { riverSD(x, z, sd); return naturalHeight(x, z, sd[0], sd[1]); };
  const H = new Float32Array(N);
  for (let jz = 0; jz < H1; jz++) for (let ix = 0; ix < W1; ix++) H[jz * W1 + ix] = nat(SLAB.x0 + ix * c, SLAB.z0 + jz * c);

  /* roads */
  ROADS.length = 0; PADS.length = 0;
  const floorAt = (x, z) => { riverSD(x, z, sd); return riverSurface(sd[0]); };
  // the main road: floodplain, then up the south wall to the dam's south crest end
  const endS = ROAD_MAIN.length;
  const yMain = roadProfile(ROAD_MAIN, (x, z) => Math.max(nat(x, z), floorAt(x, z) + 2.4), [{ s: endS, y: LEVELS.crest, r: 90 }], 55);
  // the substation branch: off the main road, over the river on a bridge, up the north slope
  const sub = ZONE.substation;
  const ySubPad = nat(sub.x, sub.z) - 2;
  const brQ = {};
  let bridgeS = 0; { let b = Infinity; for (let i = 0; i < ROAD_BRANCH.n; i++) { project(RIVER, ROAD_BRANCH.x[i], ROAD_BRANCH.z[i], brQ); if (Math.abs(brQ.d) < b) { b = Math.abs(brQ.d); bridgeS = ROAD_BRANCH.s[i]; } } }
  project(RIVER, ...xzAt(ROAD_BRANCH, bridgeS), brQ);
  const bridgeY = riverSurface(brQ.s) + 5.2;
  const mainAtJunction = yMain[0 + nearestIndex(ROAD_MAIN, ZONE.roadBranch[0][0], ZONE.roadBranch[0][1])];
  const yBranch = roadProfile(ROAD_BRANCH, (x, z) => Math.max(nat(x, z), floorAt(x, z) + 2.4),
    [{ s: 0, y: mainAtJunction, r: 40 }, { s: bridgeS, y: bridgeY, r: 70 }, { s: ROAD_BRANCH.length, y: ySubPad, r: 80 }], 70);
  ROADS.push({ name: 'main', L: ROAD_MAIN, y: yMain, half: ROAD.half });
  ROADS.push({ name: 'branch', L: ROAD_BRANCH, y: yBranch, half: ROAD.half, bridge: { s: bridgeS, y: bridgeY, riverS: brQ.s } });
  BRIDGE_RS = brQ.s;
  // north crest end to the switchyard: a short service road
  const sy = ZONE.switchyard;
  const ySwitch = LEVELS.crest + 0.5;               // a bench at crest level, reached along the crest
  const SERVICE = densify([[-123, -186], [-102, -184], [-84, -180], [sy.x - 24, sy.z]], 4);
  const yService = roadProfile(SERVICE, nat, [{ s: 0, y: LEVELS.crest, r: 40 }, { s: SERVICE.length, y: ySwitch, r: 30 }], 30);
  ROADS.push({ name: 'service', L: SERVICE, y: yService, half: 2.6 });

  const [bx, bz] = xzAt(ROAD_BRANCH, bridgeS);
  ROADS[1].bridge.x = bx; ROADS[1].bridge.z = bz;
  const nearBridge = (x, z) => Math.hypot(x - bx, z - bz) < 34;   // the bridge's abutments stay steep
  benchRoad(H, ROAD_MAIN, yMain, ROAD.half + ROAD.shoulder, null);
  benchRoad(H, ROAD_BRANCH, yBranch, ROAD.half + ROAD.shoulder, null);
  benchRoad(H, SERVICE, yService, 3.6, null);

  /* pads */
  const addPad = (name, x, z, w, d, rot, y, gravel = true, batter = 0.9) => { PADS.push({ name, x, z, w, d, rot, y, gravel }); benchPad(H, x, z, w / 2, d / 2, rot, y, batter); };
  addPad('substation', sub.x, sub.z, sub.w + 12, sub.d + 12, sub.rot, ySubPad);
  {
    // the powerhouse yard at the dam toe (north bank), in the dam frame; a steep rock cut behind it
    // (it reaches back to the dam's toe: the penstocks run across it on saddles)
    const [px, pz] = DAM.toWorld(81, DAM.ph.zl - 3);
    addPad('powerhouse', px, pz, 74, DAM.ph.w + 14, DAM.rot, 3.2, false, 0.55);
  }
  addPad('switchyard', sy.x, sy.z, sy.w + 8, sy.d + 8, 0, ySwitch, true, 0.6);
  {
    // the crest ends: the crest road meets the land at crest height
    for (const zl of [DAM.half - 14, -(DAM.half - 14)]) {
      const [ex, ez] = DAM.toWorld(DAM.arc(zl) + 6, zl);
      addPad(zl > 0 ? 'crest-south' : 'crest-north', ex, ez, 26, 26, DAM.rot, LEVELS.crest, true);
    }
  }
  {
    // the guard's pull-out on the main road, where the truck parks
    const t = ZONE.truckStart;
    const q = project(ROAD_MAIN, t.x, t.z);
    const y = yMain[q.i] + (yMain[q.i + 1] - yMain[q.i]) * q.f;
    addPad('pullout', t.x, t.z, 30, 8, Math.atan2(q.tz, q.tx), y, true);
  }

  /* the reservoir: the shore follows ZONE.reservoir exactly */
  {
    const poly = ZONE.reservoir, WL = LEVELS.reservoir;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const [i0, i1, j0, j1] = gridIndexRange(x0 - 90, x1 + 90, z0 - 90, z1 + 90);
    for (let jz = j0; jz <= j1; jz++) for (let ix = i0; ix <= i1; ix++) {
      const x = SLAB.x0 + ix * c, z = SLAB.z0 + jz * c, v = jz * W1 + ix;
      const [xl, zl] = DAM.toLocal(x, z);
      const downstream = xl > DAM.arc(zl) - 2 && Math.abs(zl) < DAM.half + 30;
      const dd = polySD(poly, x, z);
      if (dd < 0 && !downstream) {
        H[v] = Math.min(H[v], WL - 1.0 - Math.min(0.5 * -dd, 40) - 0.6 * smooth(0, 6, -dd));
      } else if (dd >= 0 && dd < 90 && !downstream) {
        H[v] = Math.max(H[v], WL + 0.5 + 0.42 * dd);
      }
    }
  }

  /* the river channel below the dam: varying width, offset from the valley line, an irregular waterline,
     low gravel bars on the north side, a gentle north bank and a steeper south one (the road's side) */
  {
    const toe = DAM.faceX(DAM.spillZ, LEVELS.damFloor);       // the spillway's toe, downstream of the axis
    const rs = {};
    for (let v = 0; v < N; v++) {
      const ix = v % W1, jz = (v - ix) / W1;
      const x = SLAB.x0 + ix * c, z = SLAB.z0 + jz * c;
      riverSD(x, z, sd);
      const k = sd[0] - DAM.sRiver;
      if (k < toe - 30) continue;
      if (Math.abs(sd[1]) > 75) continue;
      riverShape(sd[0], rs);
      const dd = sd[1] - rs.m, north = dd < 0, a = Math.abs(dd);
      const wl = riverFloor(sd[0]) + 1.3;
      const hw = (north ? rs.hwN : rs.hwS) + 1.6 * fbm(x / 17 + 9.2, z / 17 - 2.2, 2) * smooth(70, 170, k);
      const bn = fbm(x / 23 + 1.1, z / 23 - 3.4, 2);
      const barW = north ? 18 * rs.bar : 0;
      let prof;
      if (a < hw) prof = wl - 3.2 * Math.pow(1 - (a / hw) * (a / hw), 0.7);
      else if (a < hw + barW) prof = wl + 0.12 + 0.22 * smooth(0, barW, a - hw) + 0.1 * bn;
      else prof = wl + (barW > 0.5 ? 0.34 : 0) + (a - hw - barW) * (north ? 0.27 + 0.1 * bn : 0.42) + 0.7 * bn * smooth(0, 5, a - hw - barW);
      const on = smooth(toe - 30, toe + 10, k);                // fades in below the stilling basin
      const core = hw + barW + (north ? 6 : 3), reach = north ? core + 18 : core + 7;
      const w = a < core ? 1 : 1 - smooth(core, reach, a);
      if (a >= hw - 1 && nearBridge(x, z)) continue;            // the bridge abutments stay steep
      H[v] = lerp(H[v], prof, w * on);
    }
  }

  TERRAIN.heights = H;
  computeAttributes();
  return TERRAIN;
}

function xzAt(L, s) { const p = pointAt(L, s); return [p.x, p.z]; }
function nearestIndex(L, x, z) { let b = Infinity, bi = 0; for (let i = 0; i < L.n; i++) { const d = (L.x[i] - x) ** 2 + (L.z[i] - z) ** 2; if (d < b) { b = d; bi = i; } } return bi; }

/** Per-vertex forest density, damp ground and slope (after the final heights). */
function computeAttributes() {
  const { nx, nz, cell: c, heights: H } = TERRAIN, W1 = nx + 1, H1 = nz + 1, N = W1 * H1;
  const forest = new Float32Array(N), wet = new Float32Array(N), slope = new Float32Array(N), waterY = new Float32Array(N), bar = new Float32Array(N);
  const sd = [0, 0], rs = {};
  for (let jz = 0; jz < H1; jz++) for (let ix = 0; ix < W1; ix++) {
    const v = jz * W1 + ix, x = SLAB.x0 + ix * c, z = SLAB.z0 + jz * c;
    const hx = H[jz * W1 + Math.min(ix + 1, nx)] - H[jz * W1 + Math.max(ix - 1, 0)];
    const hz = H[Math.min(jz + 1, nz) * W1 + ix] - H[Math.max(jz - 1, 0) * W1 + ix];
    const g = Math.hypot(hx, hz) / (2 * c);
    slope[v] = g;
    riverSD(x, z, sd);
    const a = Math.abs(sd[1]), k = sd[0] - DAM.sRiver;
    // stands: patches of closed forest, more open on the dry south-facing bench (north bank)
    const stand = smooth(-0.22, 0.18, fbm(x / 230 + 5.3, z / 230 - 2.2, 4) + 0.12 * fbm(x / 60, z / 60, 2));
    let f = 0.42 + 0.58 * stand;
    if (sd[1] < 0) f *= lerp(1, 0.74 + 0.26 * smooth(-0.1, 0.3, fbm(x / 120 + 9, z / 120, 3)), smooth(120, 260, a) * (1 - smooth(470, 560, a)));
    // the floodplain: meadow and scattered trees, riparian edge by the water
    if (k > 0) f *= lerp(0.18, 1, smooth(32, 95, a));
    // cliffs and steep rock
    f *= 1 - smooth(0.85, 1.25, g);
    // the reservoir shore: trees down to a few metres above the water
    if (k < 0) f *= smooth(LEVELS.reservoir + 1.5, LEVELS.reservoir + 5, H[v]);
    // close to the dam and its toe: cleared ground
    { const [xl, zl] = DAM.toLocal(x, z); if (Math.abs(zl) < DAM.half + 25 && xl > -30 && xl < 130) f *= smooth(20, 45, Math.abs(zl) - DAM.half) + (xl > 125 ? 1 : 0); }
    forest[v] = clamp(f, 0, 1);
    // damp ground: by the river below the dam, round the reservoir shore
    wet[v] = (k > 0 ? 1 - smooth(18, 60, a) : 0) + (1 - smooth(0.5, 7, H[v] - LEVELS.reservoir)) * (k < 40 ? 1 : 0) * (H[v] > LEVELS.reservoir - 2 ? 1 : 0);
    wet[v] = clamp(wet[v], 0, 1);
    // the water level beside this point (wet banks, the bed seen through the shallows) and the gravel bars
    waterY[v] = -1000; bar[v] = 0;
    if (k > 0 && a < 80) {
      waterY[v] = riverSurface(sd[0]);
      riverShape(sd[0], rs);
      const dd = sd[1] - rs.m;
      if (dd < 0 && rs.bar > 0.05) bar[v] = rs.bar * smooth(rs.hwN - 1.5, rs.hwN + 1, -dd) * (1 - smooth(rs.hwN + 15 * rs.bar, rs.hwN + 19 * rs.bar, -dd));
    } else if (k <= 0 && H[v] < LEVELS.reservoir + 12) waterY[v] = LEVELS.reservoir;
  }
  TERRAIN.forest = forest; TERRAIN.wet = wet; TERRAIN.slope = slope; TERRAIN.waterY = waterY; TERRAIN.bar = bar;
}

/** Height (m) of the rendered terrain mesh at (x, z) (same triangulation as the mesh). */
export function groundAt(x, z) {
  const { nx, nz, cell: c, heights: H } = TERRAIN, W1 = nx + 1;
  const gx = clamp((x - SLAB.x0) / c, 0, nx - 1e-6), gz = clamp((z - SLAB.z0) / c, 0, nz - 1e-6);
  const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
  const h00 = H[iz * W1 + ix], h10 = H[iz * W1 + ix + 1], h01 = H[(iz + 1) * W1 + ix], h11 = H[(iz + 1) * W1 + ix + 1];
  // each cell is split along its (ix, iz+1)–(ix+1, iz) diagonal
  return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}
/** Bilinear sample of a per-vertex array (forest, wet, slope). */
export function sampleGrid(arr, x, z) {
  const { nx, nz, cell: c } = TERRAIN, W1 = nx + 1;
  const gx = clamp((x - SLAB.x0) / c, 0, nx - 1e-6), gz = clamp((z - SLAB.z0) / c, 0, nz - 1e-6);
  const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz, k = iz * W1 + ix;
  return (arr[k] * (1 - fx) + arr[k + 1] * fx) * (1 - fz) + (arr[k + W1] * (1 - fx) + arr[k + W1 + 1] * fx) * fz;
}
/** Ground normal at (x, z) from the grid (central differences). */
export function normalAt(x, z, out = new THREE.Vector3()) {
  const e = TERRAIN.cell;
  out.set(groundAt(x - e, z) - groundAt(x + e, z), 2 * e, groundAt(x, z - e) - groundAt(x, z + e));
  return out.normalize();
}
/** Road height at (x, z) on a road (nearest point of its centre line). */
export function roadY(road, x, z) {
  const q = project(road.L, x, z);
  return road.y[q.i] + (road.y[q.i + 1] - road.y[q.i]) * q.f;
}

/* ------------------------------------------------------------- the masks */
export const MASK = { canvas: null, tex: null, data: null, W: 0, H: 0 };
/** Draw the ground masks: R gravel (roads, pads), G cleared ground (verges, the line corridor), B damp ground. */
export function buildMasks(tier) {
  const W = tier === 'lite' ? 1024 : 2048, Hh = Math.round(W * SLAB.d / SLAB.w);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const sx = W / SLAB.w;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, Hh);
  g.globalCompositeOperation = 'lighter';
  g.setTransform(sx, 0, 0, sx, -SLAB.x0 * sx, -SLAB.z0 * sx);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const strokeLine = (L, width, color) => {
    g.strokeStyle = color; g.lineWidth = width; g.beginPath();
    g.moveTo(L.x[0], L.z[0]); for (let i = 1; i < L.n; i++) g.lineTo(L.x[i], L.z[i]); g.stroke();
  };
  const soft = (L, width, ch, feather = 4) => {
    const col = (v) => ch === 'r' ? `rgb(${v},0,0)` : ch === 'g' ? `rgb(0,${v},0)` : `rgb(0,0,${v})`;
    strokeLine(L, width + feather * 2, col(70));
    strokeLine(L, width + feather, col(70));
    strokeLine(L, width, col(120));
  };
  // cleared verges along every road, then the gravel itself
  for (const r of ROADS) soft(r.L, (r.half + 9) * 2, 'g', 6);
  for (const r of ROADS) soft(r.L, r.half * 2, 'r', 1.6);
  // the transmission corridor: a cleared right-of-way 44 m wide, from the switchyard to the substation
  const lineL = densify([[ZONE.switchyard.x, ZONE.switchyard.z], ...ZONE.towers, [ZONE.substation.x - 30, ZONE.substation.z]], 6);
  // straight spans, not a curve: redraw as straight segments
  g.strokeStyle = 'rgb(0,70,0)'; g.lineWidth = 52; g.beginPath();
  const tp = [[ZONE.switchyard.x, ZONE.switchyard.z], ...ZONE.towers, [ZONE.substation.x - 30, ZONE.substation.z]];
  g.moveTo(...tp[0]); for (const p of tp.slice(1)) g.lineTo(...p); g.stroke();
  g.strokeStyle = 'rgb(0,190,0)'; g.lineWidth = 40; g.stroke();
  void lineL;
  // pads: gravel (or cleared, for the powerhouse yard), each in a cleared margin
  for (const p of PADS) {
    g.save(); g.translate(p.x, p.z); g.rotate(p.rot);
    g.fillStyle = 'rgb(0,255,0)'; g.fillRect(-p.w / 2 - 12, -p.d / 2 - 12, p.w + 24, p.d + 24);
    if (p.gravel) { g.fillStyle = 'rgb(130,0,0)'; g.fillRect(-p.w / 2 - 1.5, -p.d / 2 - 1.5, p.w + 3, p.d + 3); g.fillStyle = 'rgb(125,0,0)'; g.fillRect(-p.w / 2, -p.d / 2, p.w, p.d); }
    g.restore();
  }
  // damp ground: along the river below the dam, round the reservoir shore
  g.strokeStyle = 'rgb(0,0,60)'; g.lineWidth = 60; g.beginPath();
  for (let i = 0; i < RIVER.n; i++) { if (RIVER.s[i] < DAM.sRiver + 40) continue; g.lineTo(RIVER.x[i], RIVER.z[i]); }
  g.stroke();
  g.lineWidth = 34; g.stroke();
  g.strokeStyle = 'rgb(0,0,90)'; g.lineWidth = 14; g.beginPath();
  ZONE.reservoir.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); g.closePath(); g.stroke();
  g.globalCompositeOperation = 'source-over';
  g.setTransform(1, 0, 0, 1, 0, 0);
  MASK.canvas = cv; MASK.W = W; MASK.H = Hh;
  MASK.data = g.getImageData(0, 0, W, Hh).data;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace; t.flipY = false;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4;
  t.generateMipmaps = true;
  MASK.tex = t;
  return MASK;
}
/** Mask channel (0 r, 1 g, 2 b) at (x, z), 0..1 (nearest texel). */
export function maskAt(ch, x, z) {
  const u = Math.floor(((x - SLAB.x0) / SLAB.w) * MASK.W), v = Math.floor(((z - SLAB.z0) / SLAB.d) * MASK.H);
  if (u < 0 || v < 0 || u >= MASK.W || v >= MASK.H) return 0;
  return MASK.data[(v * MASK.W + u) * 4 + ch] / 255;
}

/* --------------------------------------------------------- terrain mesh */
const GROUND_PARS = /* glsl */`
uniform sampler2D uMask; uniform vec4 uMaskBox; uniform sampler2D uNoise;
varying float vForest; varying float vWet; varying vec3 vTN; varying float vWaterY; varying float vBar;
`;
const GROUND_COLOR = /* glsl */`
{
  vec2 p = vTWp.xz;
  vec4 mk = texture2D( uMask, ( p - uMaskBox.xy ) * uMaskBox.zw );
  vec2 pa = mat2( 0.866, 0.5, -0.5, 0.866 ) * p;
  float nM = texture2D( uNoise, pa * ( 1.0 / 610.0 ) + 0.31 ).r;
  float nP = texture2D( uNoise, p * ( 1.0 / 170.0 ) + 0.17 ).a;
  float nS = texture2D( uNoise, pa * ( 1.0 / 43.0 ) ).g;
  float nF = texture2D( uNoise, p * ( 1.0 / 9.0 ) ).b;
  float slope = 1.0 - clamp( vTN.y, 0.0, 1.0 );
  // dry Interior grassland and sage on the open ground (golden in the dusk light)
  vec3 grass = mix( vec3( 0.135, 0.108, 0.062 ), vec3( 0.082, 0.08, 0.048 ), smoothstep( 0.3, 0.75, nP * 0.65 + nS * 0.35 ) );
  grass = mix( grass, vec3( 0.16, 0.125, 0.07 ), smoothstep( 0.62, 0.86, nM ) * 0.6 );
  vec3 c = grass;
  // forest floor and understorey under the canopy: dark, needle litter
  float fk = smoothstep( 0.12, 0.7, vForest + ( nS - 0.5 ) * 0.25 );
  c = mix( c, vec3( 0.045, 0.055, 0.032 ) * ( 0.8 + 0.5 * nF ), fk );
  // rock on steep faces: grey to warm tan outcrops
  float rock = smoothstep( 0.4, 0.58, slope + ( nS - 0.5 ) * 0.16 );
  vec3 rockC = mix( vec3( 0.17, 0.155, 0.135 ), vec3( 0.30, 0.26, 0.205 ), nF ) * ( 0.78 + 0.35 * nM );
  c = mix( c, rockC, rock * ( 1.0 - fk * 0.55 ) );
  // damp ground: riparian green by the river and the shore
  float wk = clamp( vWet + mk.b * 0.9, 0.0, 1.0 );
  c = mix( c, vec3( 0.045, 0.06, 0.025 ) * ( 0.75 + 0.5 * nS ), wk * 0.8 );
  // cleared ground: grass and low shrubs (the corridor, road verges, pad margins)
  vec3 cleared = mix( vec3( 0.19, 0.155, 0.08 ), vec3( 0.075, 0.08, 0.04 ), smoothstep( 0.35, 0.7, nS * 0.7 + nF * 0.3 ) );
  c = mix( c, cleared, clamp( mk.g * 1.4 - 0.2, 0.0, 1.0 ) * ( 1.0 - rock * 0.7 ) );
  // gravel: roads and pads, a little darker in the wheel tracks
  vec3 gravel = vec3( 0.25, 0.23, 0.195 ) * ( 0.84 + 0.3 * nF );
  float gk = smoothstep( 0.2, 0.6, mk.r );
  c = mix( c, gravel, gk );
  // gravel bars: pale washed cobbles just above the water
  float bk = smoothstep( 0.15, 0.55, vBar + ( nF - 0.5 ) * 0.2 );
  c = mix( c, vec3( 0.2, 0.185, 0.158 ) * ( 0.8 + 0.4 * nF ) * ( 0.85 + 0.3 * nS ), bk );
  // the waterline: banks darken where wet (a soft band, wider on soil than on the bars), the bed under the
  // shallows is dark silt
  float above = vTWp.y - vWaterY;
  float wetB = ( 1.0 - smoothstep( 0.05, mix( 2.4, 0.45, bk ) + 0.6 * nS, above ) ) * step( -40.0, above );
  c *= mix( 1.0, 0.42, wetB );
  c = mix( c, vec3( 0.03, 0.034, 0.028 ), 1.0 - smoothstep( -0.6, 0.0, above ) );
  vGravel = gk; vRock = rock; vWetB = wetB;
  diffuseColor.rgb = c * ( 0.9 + 0.2 * nF );
  // map mode (step 4): a dark hillshade with 20 m contours (100 m index), roads faint, lit by nothing
  tMapC = vec3( 0.0 );
  if ( uMap > 0.001 ) {
    vec3 Lm = normalize( vec3( -0.55, 0.78, -0.42 ) );
    float hs = clamp( dot( normalize( vTN ), Lm ), 0.0, 1.0 );
    float e = vTWp.y + 0.5;
    float fw = max( fwidth( e ), 1e-3 );
    float c20 = 1.0 - smoothstep( 0.35, 1.0, abs( fract( e / 20.0 + 0.5 ) - 0.5 ) * 20.0 / fw );
    float c100 = 1.0 - smoothstep( 0.45, 1.2, abs( fract( e / 100.0 + 0.5 ) - 0.5 ) * 100.0 / fw );
    tMapC = vec3( 0.009, 0.0095, 0.011 ) + vec3( 0.034, 0.035, 0.038 ) * pow( hs, 1.6 );
    tMapC += vec3( 0.011, 0.011, 0.0105 ) * c20 + vec3( 0.026, 0.025, 0.023 ) * c100;
    tMapC += vec3( 0.006, 0.009, 0.006 ) * smoothstep( 0.2, 0.8, vForest );   // the forest as a faint tone
    tMapC = mix( tMapC, vec3( 0.07, 0.065, 0.058 ), gk * 0.7 );
    diffuseColor.rgb *= 1.0 - 0.94 * uMap;
  }
}
`;

export function buildTerrainMesh(noiseTex) {
  const { nx, nz, cell: c, heights: H, forest, wet } = TERRAIN, W1 = nx + 1, H1 = nz + 1, N = W1 * H1;
  const pos = new Float32Array(N * 3);
  for (let jz = 0; jz < H1; jz++) for (let ix = 0; ix < W1; ix++) {
    const v = jz * W1 + ix;
    pos[v * 3] = SLAB.x0 + ix * c; pos[v * 3 + 1] = H[v]; pos[v * 3 + 2] = SLAB.z0 + jz * c;
  }
  const idx = new Uint32Array(nx * nz * 6);
  let t = 0;
  for (let jz = 0; jz < nz; jz++) for (let ix = 0; ix < nx; ix++) {
    const a = jz * W1 + ix, b = (jz + 1) * W1 + ix, cc = (jz + 1) * W1 + ix + 1, d = jz * W1 + ix + 1;
    idx[t++] = a; idx[t++] = b; idx[t++] = d;
    idx[t++] = b; idx[t++] = cc; idx[t++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aForest', new THREE.BufferAttribute(forest, 1));
  geo.setAttribute('aWet', new THREE.BufferAttribute(wet, 1));
  geo.setAttribute('aWaterY', new THREE.BufferAttribute(TERRAIN.waterY, 1));
  geo.setAttribute('aBar', new THREE.BufferAttribute(TERRAIN.bar, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, envMapIntensity: 0.35, name: 'table-ground' });
  patchMaterial(mat, {
    key: 'ground',
    uniforms: {
      uMask: { value: MASK.tex }, uNoise: { value: noiseTex },
      uMaskBox: { value: new THREE.Vector4(SLAB.x0, SLAB.z0, 1 / SLAB.w, 1 / SLAB.d) },
    },
    vertPars: 'attribute float aForest; attribute float aWet; attribute float aWaterY; attribute float aBar; varying float vForest; varying float vWet; varying vec3 vTN; varying float vWaterY; varying float vBar;',
    vertMain: 'vForest = aForest; vWet = aWet; vWaterY = aWaterY; vBar = aBar; vTN = normalize( mat3( modelMatrix ) * objectNormal );',
    fragPars: GROUND_PARS + 'float vGravel; float vRock; float vWetB; vec3 tMapC;',
    emissive: 'totalEmissiveRadiance += tMapC * uMap;',
    color: GROUND_COLOR,
    rough: 'roughnessFactor = mix( roughnessFactor, 0.82, vGravel ); roughnessFactor = mix( roughnessFactor, 0.86, vRock ); roughnessFactor = mix( roughnessFactor, 0.32, vWetB );',
    // the canopy shades the forest floor (no tree shadow map below the high tier): bright gaps between
    // the crowns read as noise
    vis: 'tSunVis *= 1.0 - 0.82 * smoothstep( 0.05, 0.7, vForest ) * ( 1.0 - vGravel );',
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'table:terrain';
  mesh.userData.thermal = 'ground';
  return mesh;
}

/* ------------------------------------------------------------- the cut walls */
const WALL_PARS = /* glsl */`
uniform sampler2D uNoise;
varying float vTop; varying float vWater; varying float vAlong;
float wHash( float n ) { return fract( sin( n * 91.7 ) * 43758.5453 ); }
`;
const WALL_COLOR = /* glsl */`
{
  float y = vTWp.y;
  float dep = vTop - y;
  float al = vAlong;
  float nB = texture2D( uNoise, vec2( al / 900.0, 0.37 ) ).r;
  float nW = texture2D( uNoise, vec2( al / 380.0, y / 260.0 ) ).r;
  float nM = texture2D( uNoise, vec2( al / 140.0, y / 140.0 ) ).g;
  float nF = texture2D( uNoise, vec2( al / 9.0, y / 3.0 ) ).b;
  float nC = texture2D( uNoise, vec2( al / 3.1, y / 3.1 ) ).b;
  float nG = texture2D( uNoise, vec2( al / 1.3, y / 0.9 ) ).a;
  // bedrock: beds of varied thickness that dip, wave and pinch along the face (sandstone, siltstone, grey and
  // green shale, an oxidised band, dark basalt flows, a pale ash bed), each with its own grain
  float yy = y + al * 0.021 + ( nB - 0.5 ) * 8.0 + ( nW - 0.5 ) * 12.0 + sin( al / 230.0 ) * 3.5;
  float L0 = floor( yy / 12.0 );
  float th = 0.5 + 0.95 * wHash( L0 + 11.0 );
  float b = yy / ( 12.0 * th );
  float layer = floor( b ), fr = fract( b );
  float r = wHash( layer * 1.7 + L0 * 0.3 + 3.0 );
  vec3 sand = vec3( 0.13, 0.102, 0.074 ), silt = vec3( 0.098, 0.084, 0.069 ), shale = vec3( 0.058, 0.056, 0.053 ), green = vec3( 0.062, 0.066, 0.056 );
  vec3 rust = vec3( 0.112, 0.064, 0.04 ), basalt = vec3( 0.032, 0.031, 0.03 ), ash = vec3( 0.15, 0.14, 0.124 );
  vec3 c = r < 0.24 ? sand : r < 0.42 ? silt : r < 0.6 ? shale : r < 0.7 ? green : r < 0.8 ? rust : r < 0.93 ? basalt : ash;
  float soft = r < 0.42 || r > 0.93 ? 1.0 : 0.0;                   // sandstones and ash: laminated
  c *= 0.74 + 0.5 * nF;                                           // rock grain
  c *= 0.86 + 0.28 * nG;                                          // fine grain
  c *= 0.9 + 0.2 * nM;
  c *= 1.0 - 0.18 * soft * smoothstep( 0.78, 1.0, fract( yy / 1.7 + nF * 0.35 ) );   // laminae
  c *= 0.55 + 0.45 * smoothstep( 0.0, 0.06, fr );                 // a dark parting at each bed's base
  c *= 1.0 - 0.12 * smoothstep( 0.9, 1.0, fr );                    // and a weathered recess at its top
  // joints: near-vertical fractures through the harder beds, a little open
  float jt = smoothstep( 0.955, 1.0, fract( al / 21.0 + nM * 0.6 + layer * 0.37 ) ) * ( 1.0 - soft );
  c *= 1.0 - 0.45 * jt;
  c *= 0.84 + 0.26 * texture2D( uNoise, vec2( al / 3.5, y / 90.0 ) ).g;   // run-off streaks down the face
  // glacial till: pale, cobbly, its base wavy
  float tillB = 18.0 + ( nM - 0.5 ) * 12.0;
  float till = 1.0 - smoothstep( tillB - 2.0, tillB + 2.0, dep );
  vec3 tc = vec3( 0.11, 0.098, 0.08 ) * ( 0.75 + 0.45 * nF );
  tc = mix( tc, vec3( 0.15, 0.14, 0.125 ) * ( 0.8 + 0.3 * nG ), smoothstep( 0.7, 0.78, nC ) );   // cobbles
  tc *= 1.0 - 0.3 * smoothstep( 0.82, 0.9, nC );                    // their shadows
  c = mix( c, tc, till );
  // subsoil (brown) and topsoil (dark, organic, roots), the grass mat on top
  c = mix( c, vec3( 0.11, 0.074, 0.046 ) * ( 0.8 + 0.35 * nF ), 1.0 - smoothstep( 7.0, 10.0, dep + ( nM - 0.5 ) * 3.0 ) );
  c = mix( c, vec3( 0.032, 0.025, 0.018 ) * ( 0.85 + 0.3 * nG ), 1.0 - smoothstep( 2.4, 3.8, dep + ( nF - 0.5 ) * 1.2 ) );
  // the foot of the cut sits in the slab's own shadow (occlusion toward the base plate)
  c *= mix( 0.5, 1.0, smoothstep( -100.0, -30.0, y ) );
  // the water, in section where the cut crosses the reservoir or the river
  float wsec = step( 0.0, -dep + 0.01 ) * step( y, vWater );
  vec3 wc = mix( vec3( 0.004, 0.012, 0.014 ), vec3( 0.02, 0.06, 0.065 ), smoothstep( vTop, vWater, y ) );
  c = mix( c, wc, wsec );
  vWsec = wsec;
  diffuseColor.rgb = c;
}
`;

/** The room light on the cut faces (world.js sets it per look). */
export const WALL_ROOM = { value: new THREE.Color(0.3, 0.27, 0.23) };

/** The four cut faces, from the slab's underside up to the land (and the water, where cut). */
export function buildWalls(noiseTex) {
  const { nx, nz, cell: c, heights: H } = TERRAIN, W1 = nx + 1;
  const pos = [], nrm = [], top = [], wat = [], along = [], idx = [];
  const sd = [0, 0];
  const waterAt = (x, z) => {
    if (polySD(ZONE.reservoir, x, z) < 0) return LEVELS.reservoir;
    riverSD(x, z, sd);
    if (sd[0] > DAM.sRiver + 40) { const r = riverShape(sd[0]), dd = sd[1] - r.m; if (dd > -r.hwN && dd < r.hwS) return riverSurface(sd[0]); }
    return -1e4;
  };
  // each edge: a list of grid vertices in order, the outward normal; winding chosen so faces point out
  const edges = [
    { n: [0, 0, -1], pts: Array.from({ length: W1 }, (_, i) => i) },                               // north (z0)
    { n: [0, 0, 1], pts: Array.from({ length: W1 }, (_, i) => nz * W1 + (nx - i)) },               // south (z1)
    { n: [-1, 0, 0], pts: Array.from({ length: nz + 1 }, (_, j) => (nz - j) * W1) },               // west (x0)
    { n: [1, 0, 0], pts: Array.from({ length: nz + 1 }, (_, j) => j * W1 + nx) },                  // east (x1)
  ];
  for (const e of edges) {
    const base = pos.length / 3;
    e.pts.forEach((v) => {
      const ix = v % W1, jz = (v - ix) / W1, x = SLAB.x0 + ix * c, z = SLAB.z0 + jz * c;
      const h = H[v], w = waterAt(x, z), t = Math.max(h, w);
      const al = x + z * 1.37;
      pos.push(x, t, z, x, SLAB.base, z);
      for (let k = 0; k < 2; k++) { nrm.push(...e.n); top.push(h); wat.push(w); along.push(al); }
    });
    for (let i = 0; i < e.pts.length - 1; i++) {
      const a = base + i * 2, b = a + 1, c2 = a + 2, d = a + 3;
      idx.push(a, b, c2, b, d, c2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
  geo.setAttribute('aWater', new THREE.Float32BufferAttribute(wat, 1));
  geo.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
  geo.setIndex(idx);
  // make sure the winding faces outward (compare the geometric normal with the declared one)
  {
    const p = geo.attributes.position, ia = geo.index.array, n = geo.attributes.normal;
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), Nn = new THREE.Vector3();
    for (let i = 0; i < ia.length; i += 3) {
      A.fromBufferAttribute(p, ia[i]); B.fromBufferAttribute(p, ia[i + 1]); C.fromBufferAttribute(p, ia[i + 2]);
      Nn.subVectors(B, A).cross(C.sub(A));
      if (Nn.lengthSq() < 1e-9) continue;
      if (Nn.dot(new THREE.Vector3().fromBufferAttribute(n, ia[i])) < 0) { const t = ia[i + 1]; ia[i + 1] = ia[i + 2]; ia[i + 2] = t; }
    }
  }
  geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, envMapIntensity: 0.5, name: 'table-walls' });
  patchMaterial(mat, {
    // no terrain mask on the cut faces: their sun rays always leave the slab (a face either looks away from
    // the sun or out of the slab), and the mask's filtering at the edge would leak the land's shadow heights
    key: 'walls', haze: false, sun: false,
    vis: 'tSunVis = 0.55;',                    // the low sun on a cut face: warm, not blazing
    uniforms: { uNoise: { value: noiseTex }, uRoomLight: WALL_ROOM },
    // the room's soft overhead light on the cut faces: the strata read even on the faces away from the sun
    end: 'gl_FragColor.rgb += diffuseColor.rgb * uRoomLight * ( 0.55 + 0.45 * smoothstep( -100.0, 120.0, vTWp.y ) ) * ( 1.0 - vWsec );',
    vertPars: 'attribute float aTop; attribute float aWater; attribute float aAlong; varying float vTop; varying float vWater; varying float vAlong;',
    vertMain: 'vTop = aTop; vWater = aWater; vAlong = aAlong;',
    fragPars: WALL_PARS + 'uniform vec3 uRoomLight; float vWsec;',
    color: WALL_COLOR,
    rough: 'roughnessFactor = mix( roughnessFactor, 0.12, vWsec );',
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'table:walls';
  mesh.userData.thermal = 'strata';
  return mesh;
}
