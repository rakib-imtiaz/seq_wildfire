import type { Pt, Zone } from "./zone";
import {
  buildGrid,
  cellContours,
  damAxes,
  duskRGB,
  fbm,
  ironbow,
  sampleH,
  SLAB_BASE,
  tempToS,
  WATER_LEVEL,
  type Grid,
  type Seg,
} from "./terrain";

/**
 * 2D canvas stand-in for the command table: an oblique, painter's-order render of the zone heightfield with
 * occluded contour lines, strata cut edges and the infrastructure. Visible (dusk) and thermal (ironbow) modes
 * share one projection so the thermal lens lines up exactly. Replaced by the WebGL table when it mounts.
 */

export interface CamSpec {
  /** degrees; 0 = camera south of the slab looking north, positive swings toward the east */
  az: number;
  /** degrees above the horizon */
  el: number;
  /** distance from target in metres (controls perspective strength) */
  dist: number;
  /** vertical exaggeration */
  exag: number;
  target?: [number, number, number];
}

/** Where the slab is fitted inside the canvas (css px); ax/ay align it inside that rect (0..1). */
export interface Fit {
  x: number;
  y: number;
  w: number;
  h: number;
  ax: number;
  ay: number;
}

export interface View {
  w: number;
  h: number;
  zone: Zone;
  grid: Grid;
  exag: number;
  cam: [number, number, number];
  project(x: number, y: number, z: number): [number, number, number];
  ground(x: number, z: number, lift?: number): [number, number, number];
  /** grid vertex positions on screen (css px), interleaved x,y */
  vs: Float32Array;
  order: Int32Array;
  depthNear: number;
  depthFar: number;
}

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

export function makeView(Z: Zone, step: number, spec: CamSpec, w: number, h: number, fit: Fit): View {
  const grid = buildGrid(Z, step);
  const exag = spec.exag;
  const T: V3 = spec.target ?? [0, 70 * exag, 0];
  const az = (spec.az * Math.PI) / 180;
  const el = (spec.el * Math.PI) / 180;
  const C: V3 = [
    T[0] + spec.dist * Math.sin(az) * Math.cos(el),
    T[1] + spec.dist * Math.sin(el),
    T[2] + spec.dist * Math.cos(az) * Math.cos(el),
  ];
  const f = norm(sub(T, C));
  const r = norm([-f[2], 0, f[0]]);
  const u: V3 = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];

  const raw = (x: number, y: number, z: number): V3 => {
    const p: V3 = [x - C[0], y - C[1], z - C[2]];
    const zc = dot3(p, f);
    return [dot3(p, r) / zc, -dot3(p, u) / zc, zc];
  };

  // fit: every surface vertex plus the base corners
  const { nx, nz, x0, z0 } = grid;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const N = nx * nz;
  const rawV = new Float32Array(N * 2);
  for (let k = 0; k < N; k++) {
    const i = k % nx;
    const j = (k / nx) | 0;
    const p = raw(x0 + i * step, grid.h[k] * exag, z0 + j * step);
    rawV[k * 2] = p[0];
    rawV[k * 2 + 1] = p[1];
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  const [W, D] = Z.size;
  for (const cx of [-W / 2, W / 2])
    for (const cz of [-D / 2, D / 2]) {
      const p = raw(cx, SLAB_BASE * exag, cz);
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
  const bw = maxX - minX;
  const bh = maxY - minY;
  const s = Math.min(fit.w / bw, fit.h / bh);
  const ox = fit.x + (fit.w - bw * s) * fit.ax - minX * s;
  const oy = fit.y + (fit.h - bh * s) * fit.ay - minY * s;

  const project = (x: number, y: number, z: number): V3 => {
    const p = raw(x, y, z);
    return [p[0] * s + ox, p[1] * s + oy, p[2]];
  };

  const vs = new Float32Array(N * 2);
  for (let k = 0; k < N; k++) {
    vs[k * 2] = rawV[k * 2] * s + ox;
    vs[k * 2 + 1] = rawV[k * 2 + 1] * s + oy;
  }

  // painter's order: far cells first
  const cells = (nx - 1) * (nz - 1);
  const depth = new Float32Array(cells);
  let dn = Infinity;
  let df = -Infinity;
  for (let j = 0; j < nz - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const k = j * nx + i;
      const hc = (grid.h[k] + grid.h[k + 1] + grid.h[k + nx] + grid.h[k + nx + 1]) / 4;
      const d = raw(x0 + (i + 0.5) * step, hc * exag, z0 + (j + 0.5) * step)[2];
      depth[j * (nx - 1) + i] = d;
      if (d < dn) dn = d;
      if (d > df) df = d;
    }
  const order = new Int32Array(cells);
  for (let c = 0; c < cells; c++) order[c] = c;
  order.sort((a, b) => depth[b] - depth[a]);

  return {
    w,
    h,
    zone: Z,
    grid,
    exag,
    cam: C,
    project,
    ground: (x, z, lift = 0) => project(x, (sampleH(grid, x, z) + lift) * exag, z),
    vs,
    order,
    depthNear: dn,
    depthFar: df,
  };
}

/* ---------- colour caches ---------- */

const colCache = new WeakMap<Grid, { visible: Uint8ClampedArray; thermal: Uint8ClampedArray }>();

function vertexColours(g: Grid) {
  const hit = colCache.get(g);
  if (hit) return hit;
  const N = g.nx * g.nz;
  const visible = new Uint8ClampedArray(N * 3);
  const thermal = new Uint8ClampedArray(N * 3);
  for (let k = 0; k < N; k++) {
    const i = k % g.nx;
    const j = (k / g.nx) | 0;
    const x = g.x0 + i * g.step;
    const z = g.z0 + j * g.step;
    const n = fbm(x / 36, z / 36, 2, 7);
    const water = g.water[k] === 1;
    // the reservoir picks up the warm western sky
    const wn = water ? 0.5 + 0.5 * Math.max(0, -x / 800) * (0.6 + 0.4 * n) : n;
    const v = duskRGB(g.shade[k], g.h[k], water, wn);
    visible[k * 3] = v[0];
    visible[k * 3 + 1] = v[1];
    visible[k * 3 + 2] = v[2];
    const t = ironbow(tempToS(g.tempBase[k]));
    thermal[k * 3] = t[0];
    thermal[k * 3 + 1] = t[1];
    thermal[k * 3 + 2] = t[2];
  }
  const out = { visible, thermal };
  colCache.set(g, out);
  return out;
}

const segCache = new WeakMap<Grid, Seg[][]>();
function segsFor(g: Grid): Seg[][] {
  let s = segCache.get(g);
  if (!s) {
    const levels: number[] = [];
    for (let L = 12; L < 340; L += 12) levels.push(L);
    s = cellContours(g, levels);
    segCache.set(g, s);
  }
  return s;
}

/* ---------- render ---------- */

export type Mode = "visible" | "thermal";

export function renderTable(ctx: CanvasRenderingContext2D, v: View, mode: Mode): void {
  const { grid: g, exag } = v;
  const { nx } = g;
  const cols = vertexColours(g)[mode];
  const segs = segsFor(g);
  const vs = v.vs;
  ctx.clearRect(0, 0, v.w, v.h);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const cells = v.order.length;
  for (let o = 0; o < cells; o++) {
    const c = v.order[o];
    const i = c % (nx - 1);
    const j = (c / (nx - 1)) | 0;
    const a = j * nx + i;
    const b = a + 1;
    const d = a + nx;
    const e = d + 1;
    const r = (cols[a * 3] + cols[b * 3] + cols[d * 3] + cols[e * 3]) / 4;
    const gg = (cols[a * 3 + 1] + cols[b * 3 + 1] + cols[d * 3 + 1] + cols[e * 3 + 1]) / 4;
    const bb = (cols[a * 3 + 2] + cols[b * 3 + 2] + cols[d * 3 + 2] + cols[e * 3 + 2]) / 4;
    const col = `rgb(${r | 0},${gg | 0},${bb | 0})`;
    ctx.beginPath();
    ctx.moveTo(vs[a * 2], vs[a * 2 + 1]);
    ctx.lineTo(vs[b * 2], vs[b * 2 + 1]);
    ctx.lineTo(vs[e * 2], vs[e * 2 + 1]);
    ctx.lineTo(vs[d * 2], vs[d * 2 + 1]);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 0.7;
    ctx.stroke();

    const cs = segs[c];
    if (cs && cs.length) {
      const depthT = (cells - o) / cells; // 1 far .. 0 near
      for (const s of cs) {
        const major = s.level % 60 === 0;
        const p = v.project(s.ax, s.level * exag, s.az);
        const q = v.project(s.bx, s.level * exag, s.bz);
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(q[0], q[1]);
        if (mode === "visible") {
          const al = (major ? 0.42 : 0.2) * (1 - 0.5 * depthT);
          ctx.strokeStyle = `rgba(236,231,224,${al.toFixed(3)})`;
          ctx.lineWidth = major ? 1 : 0.7;
        } else {
          ctx.strokeStyle = "rgba(20,0,46,0.28)";
          ctx.lineWidth = 0.7;
        }
        ctx.stroke();
      }
    }
  }

  if (mode === "thermal") softenOnce(ctx, 1.6);
  else drawShore(ctx, v);
  drawFaces(ctx, v, mode);
  drawInfra(ctx, v, mode);
}

/** One-off blur of what is on the canvas so far: thermal sensors are soft, and it hides the cell facets. */
function softenOnce(ctx: CanvasRenderingContext2D, px: number) {
  if (!("filter" in ctx)) return;
  const cv = ctx.canvas;
  const tmp = document.createElement("canvas");
  tmp.width = cv.width;
  tmp.height = cv.height;
  const t = tmp.getContext("2d");
  if (!t) return;
  t.drawImage(cv, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.filter = `blur(${px * (cv.width / Math.max(1, cv.clientWidth || cv.width))}px)`;
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
  tmp.width = tmp.height = 1;
}

/** Reservoir shoreline: an interpolated contour just above the water level, only in cells touching water. */
const shoreCache = new WeakMap<Grid, Seg[]>();
function drawShore(ctx: CanvasRenderingContext2D, v: View) {
  const g = v.grid;
  let segs = shoreCache.get(g);
  if (!segs) {
    const cells = cellContours(g, [WATER_LEVEL + 0.6]);
    segs = [];
    const { nx } = g;
    for (let c = 0; c < cells.length; c++) {
      const i = c % (nx - 1);
      const j = (c / (nx - 1)) | 0;
      const k = j * nx + i;
      if (g.water[k] || g.water[k + 1] || g.water[k + nx] || g.water[k + nx + 1]) segs.push(...cells[c]);
    }
    shoreCache.set(g, segs);
  }
  ctx.beginPath();
  for (const s of segs) {
    const a = v.project(s.ax, s.level * v.exag, s.az);
    const b = v.project(s.bx, s.level * v.exag, s.bz);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.strokeStyle = "rgba(236,231,224,0.38)";
  ctx.lineWidth = 0.9;
  ctx.stroke();
}

/* ---------- slab cut faces (strata) ---------- */

function drawFaces(ctx: CanvasRenderingContext2D, v: View, mode: Mode) {
  const { grid: g, exag, zone: Z } = v;
  const [W, D] = Z.size;
  const C = v.cam;
  const faces: { pts: Pt[]; lit: number }[] = [];
  const edge = (fixed: "x" | "z", val: number): Pt[] => {
    const out: Pt[] = [];
    if (fixed === "z") for (let i = 0; i < g.nx; i++) out.push([g.x0 + i * g.step, val]);
    else for (let j = 0; j < g.nz; j++) out.push([val, g.z0 + j * g.step]);
    return out;
  };
  if (C[2] > D / 2) faces.push({ pts: edge("z", D / 2), lit: 1 });
  if (C[2] < -D / 2) faces.push({ pts: edge("z", -D / 2), lit: 0.6 });
  if (C[0] > W / 2) faces.push({ pts: edge("x", W / 2), lit: 0.45 });
  if (C[0] < -W / 2) faces.push({ pts: edge("x", -W / 2), lit: 0.85 });

  const base = SLAB_BASE * exag;
  for (const face of faces) {
    const top = face.pts.map(([x, z]) => v.project(x, sampleH(g, x, z) * exag, z));
    const bot = face.pts.map(([x, z]) => v.project(x, base, z));
    const poly = (upper: number[][], lower: number[][]) => {
      ctx.beginPath();
      ctx.moveTo(upper[0][0], upper[0][1]);
      for (const p of upper) ctx.lineTo(p[0], p[1]);
      for (let k = lower.length - 1; k >= 0; k--) ctx.lineTo(lower[k][0], lower[k][1]);
      ctx.closePath();
    };
    const L = face.lit * (mode === "thermal" ? 0.7 : 1);
    // body
    poly(top, bot);
    ctx.fillStyle = `rgb(${(20 + 9 * L) | 0},${(19 + 7 * L) | 0},${(17 + 6 * L) | 0})`;
    ctx.fill();
    // topsoil band follows the surface
    const soil = face.pts.map(([x, z]) => v.project(x, (sampleH(g, x, z) - 9) * exag, z));
    poly(top, soil);
    ctx.fillStyle = `rgb(${(34 + 18 * L) | 0},${(29 + 13 * L) | 0},${(25 + 9 * L) | 0})`;
    ctx.fill();
    // flat rock beds
    const beds = [-14, -24, -37, -50];
    beds.forEach((y, bi) => {
      const line = face.pts.map(([x, z]) => v.project(x, y * exag, z));
      if (bi % 2 === 1) {
        const next = face.pts.map(([x, z]) => v.project(x, (beds[bi + 1] ?? SLAB_BASE) * exag, z));
        poly(line, next);
        ctx.fillStyle = `rgba(0,0,0,${(0.16 + 0.04 * bi).toFixed(2)})`;
        ctx.fill();
      }
      ctx.beginPath();
      line.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.strokeStyle = `rgba(236,231,224,${(0.05 + 0.03 * L).toFixed(3)})`;
      ctx.lineWidth = 0.75;
      ctx.stroke();
    });
    // crisp cut line and base line
    ctx.beginPath();
    top.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.strokeStyle = mode === "visible" ? "rgba(236,231,224,0.5)" : "rgba(236,231,224,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    bot.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.strokeStyle = "rgba(236,231,224,0.14)";
    ctx.stroke();
    // corners
    for (const k of [0, top.length - 1]) {
      ctx.beginPath();
      ctx.moveTo(top[k][0], top[k][1]);
      ctx.lineTo(bot[k][0], bot[k][1]);
      ctx.strokeStyle = "rgba(236,231,224,0.22)";
      ctx.stroke();
    }
  }
}

/* ---------- infrastructure ---------- */

function densify(line: Pt[], step: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i];
    const [bx, bz] = line[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  out.push(line[line.length - 1]);
  return out;
}

export function rectPts(cx: number, cz: number, w: number, d: number, ax: Pt): Pt[] {
  const bx: Pt = [-ax[1], ax[0]];
  const hw = w / 2;
  const hd = d / 2;
  return [
    [cx + ax[0] * hw + bx[0] * hd, cz + ax[1] * hw + bx[1] * hd],
    [cx - ax[0] * hw + bx[0] * hd, cz - ax[1] * hw + bx[1] * hd],
    [cx - ax[0] * hw - bx[0] * hd, cz - ax[1] * hw - bx[1] * hd],
    [cx + ax[0] * hw - bx[0] * hd, cz + ax[1] * hw - bx[1] * hd],
  ];
}

function rgb(c: [number, number, number], a = 1) {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}

function drawInfra(ctx: CanvasRenderingContext2D, v: View, mode: Mode) {
  const Z = v.zone;
  const g = v.grid;
  const T = mode === "thermal";
  const stroke = (pts: number[][], style: string, width: number, dash: number[] = []) => {
    ctx.beginPath();
    pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.setLineDash(dash);
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // river below the dam
  const { crest, flow } = damAxes(Z);
  const river = densify(Z.river, 10).filter(([x, z]) => (x - Z.dam.x) * flow[0] + (z - Z.dam.z) * flow[1] > 6);
  stroke(river.map(([x, z]) => v.ground(x, z, 0.5)), T ? rgb(ironbow(0.06)) : "rgba(150,152,156,0.75)", 1.8);

  // roads
  for (const road of [Z.road, Z.roadBranch]) {
    const pts = densify(road, 8).map(([x, z]) => v.ground(x, z, 1));
    stroke(pts, T ? rgb(ironbow(0.36), 0.95) : "rgba(236,231,224,0.34)", T ? 1.6 : 1.1, T ? [] : [4, 3]);
  }

  // dam: downstream face + crest
  const half = Z.dam.crest / 2;
  const crestY = (WATER_LEVEL + 5) * v.exag;
  const cA: Pt = [Z.dam.x + crest[0] * half, Z.dam.z + crest[1] * half];
  const cB: Pt = [Z.dam.x - crest[0] * half, Z.dam.z - crest[1] * half];
  const toe = 16;
  const tA: Pt = [cA[0] + flow[0] * toe, cA[1] + flow[1] * toe];
  const tB: Pt = [cB[0] + flow[0] * toe, cB[1] + flow[1] * toe];
  const p1 = v.project(cA[0], crestY, cA[1]);
  const p2 = v.project(cB[0], crestY, cB[1]);
  const p3 = v.ground(tB[0], tB[1]);
  const p4 = v.ground(tA[0], tA[1]);
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.lineTo(p3[0], p3[1]);
  ctx.lineTo(p4[0], p4[1]);
  ctx.closePath();
  ctx.fillStyle = T ? rgb(ironbow(0.42)) : "rgb(62,58,53)";
  ctx.fill();
  stroke([p1, p2], T ? rgb(ironbow(0.5)) : "rgba(236,231,224,0.8)", 2);
  // spillway gate ticks
  for (let k = 1; k <= Z.dam.spillwayGates; k++) {
    const t = -0.18 + (0.36 * k) / (Z.dam.spillwayGates + 1);
    const gx = Z.dam.x + crest[0] * Z.dam.crest * t;
    const gz = Z.dam.z + crest[1] * Z.dam.crest * t;
    const a = v.project(gx, crestY, gz);
    const b = v.project(gx + flow[0] * toe * 0.8, crestY * 0.55, gz + flow[1] * toe * 0.8);
    stroke([a, b], T ? rgb(ironbow(0.3)) : "rgba(236,231,224,0.35)", 0.8);
  }

  // powerhouse + switchyard + substation footprints
  const ph = Z.powerhouse;
  const phPts = rectPts(ph.x, ph.z, ph.w, ph.d, crest).map(([x, z]) => v.project(x, (sampleH(g, ph.x, ph.z) + ph.h) * v.exag, z));
  ctx.beginPath();
  phPts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.fillStyle = T ? rgb(ironbow(0.47)) : "rgb(52,49,45)";
  ctx.fill();
  ctx.strokeStyle = T ? rgb(ironbow(0.55)) : "rgba(236,231,224,0.55)";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  const sw = Z.switchyard;
  stroke(
    [...rectPts(sw.x, sw.z, sw.w, sw.d, [1, 0]), rectPts(sw.x, sw.z, sw.w, sw.d, [1, 0])[0]].map(([x, z]) => v.ground(x, z, 0.5)),
    T ? rgb(ironbow(0.45)) : "rgba(236,231,224,0.45)",
    0.8,
  );

  const ss = Z.substation;
  const sAx: Pt = [Math.cos(ss.rot), Math.sin(ss.rot)];
  const ring = rectPts(ss.x, ss.z, ss.w, ss.d, sAx);
  stroke([...ring, ring[0]].map(([x, z]) => v.ground(x, z, 0.5)), T ? rgb(ironbow(0.4)) : "rgba(236,231,224,0.6)", 0.9);
  for (const off of [-0.22, 0.18]) {
    const cx = ss.x + sAx[0] * ss.w * off;
    const cz = ss.z + sAx[1] * ss.w * off;
    const box = rectPts(cx, cz, 12, 9, sAx).map(([x, z]) => v.ground(x, z, 5));
    ctx.beginPath();
    box.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fillStyle = T ? rgb(ironbow(0.66)) : "rgb(70,66,61)";
    ctx.fill();
  }

  // towers + wires
  const towerH = 38;
  const tops: number[][][] = [];
  const pts = Z.towers;
  for (let k = 0; k < pts.length; k++) {
    const [x, z] = pts[k];
    const nb = pts[Math.min(pts.length - 1, k + 1)];
    const pb = pts[Math.max(0, k - 1)];
    const dir = norm2([nb[0] - pb[0], nb[1] - pb[1]]);
    const perp: Pt = [-dir[1], dir[0]];
    const gy = sampleH(g, x, z);
    const base1 = v.project(x + perp[0] * 5, gy * v.exag, z + perp[1] * 5);
    const base2 = v.project(x - perp[0] * 5, gy * v.exag, z - perp[1] * 5);
    const top = v.project(x, (gy + towerH) * v.exag, z);
    const armY = (gy + towerH - 7) * v.exag;
    const armA = v.project(x + perp[0] * 11, armY, z + perp[1] * 11);
    const armB = v.project(x - perp[0] * 11, armY, z - perp[1] * 11);
    const col = T ? rgb(ironbow(0.34)) : "rgba(236,231,224,0.62)";
    stroke([base1, top, base2], col, 0.9);
    stroke([armA, armB], col, 0.9);
    tops.push([
      [x + perp[0] * 11, armY, z + perp[1] * 11],
      [x - perp[0] * 11, armY, z - perp[1] * 11],
    ]);
  }
  for (let k = 0; k < tops.length - 1; k++) {
    for (const side of [0, 1]) {
      const a = tops[k][side];
      const b = tops[k + 1][side];
      const line: number[][] = [];
      for (let t = 0; t <= 1.0001; t += 1 / 14) {
        const sag = 9 * v.exag * 4 * t * (1 - t);
        line.push(v.project(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag, a[2] + (b[2] - a[2]) * t));
      }
      stroke(line, T ? rgb(ironbow(0.3), 0.8) : "rgba(236,231,224,0.3)", 0.6);
    }
  }

  // the guard's truck: amber beacon (visible) / warm engine (thermal)
  const tr = v.ground(Z.truckStart.x, Z.truckStart.z, 3);
  if (T) {
    dot(ctx, tr, 2.6, rgb(ironbow(0.8)));
  } else {
    const gr = ctx.createRadialGradient(tr[0], tr[1], 0, tr[0], tr[1], 11);
    gr.addColorStop(0, "rgba(255,106,31,0.55)");
    gr.addColorStop(1, "rgba(255,106,31,0)");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(tr[0], tr[1], 11, 0, Math.PI * 2);
    ctx.fill();
    dot(ctx, tr, 2.1, "#ff6a1f");
  }

  // the hidden hotspot: only in the thermal view
  if (T) {
    const hs = Z.hotspot;
    const c = v.ground(hs.x, hs.z, 2);
    const edge = v.ground(hs.x + 40, hs.z, 2);
    const r = Math.max(8, Math.hypot(edge[0] - c[0], edge[1] - c[1]));
    const gr = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.2, "rgba(255,230,160,0.95)");
    gr.addColorStop(0.5, "rgba(255,158,27,0.6)");
    gr.addColorStop(1, "rgba(232,69,44,0)");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function dot(ctx: CanvasRenderingContext2D, p: number[], r: number, fill: string) {
  ctx.beginPath();
  ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function norm2(p: Pt): Pt {
  const l = Math.hypot(p[0], p[1]) || 1;
  return [p[0] / l, p[1] / l];
}

/* ---------- lens readout sampling ---------- */

export interface LensSample {
  maxC: number;
  x: number;
  z: number;
}

/** Max SAMPLE temperature under a screen-space circle, and the zone position nearest its centre. */
export function sampleLens(v: View, sx: number, sy: number, r: number): LensSample | null {
  const g = v.grid;
  const r2 = r * r;
  let maxC = -Infinity;
  let best = Infinity;
  let bx = 0;
  let bz = 0;
  const N = g.nx * g.nz;
  for (let k = 0; k < N; k++) {
    const dx = v.vs[k * 2] - sx;
    const dy = v.vs[k * 2 + 1] - sy;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    if (g.temp[k] > maxC) maxC = g.temp[k];
    if (d2 < best) {
      best = d2;
      bx = g.x0 + (k % g.nx) * g.step;
      bz = g.z0 + ((k / g.nx) | 0) * g.step;
    }
  }
  if (best === Infinity) return null;
  // the grid is coarser than the hotspot, so resolve its peak analytically
  const hs = v.zone.hotspot;
  const hp = v.ground(hs.x, hs.z);
  const he = v.ground(hs.x + 40, hs.z);
  const pxPerM = Math.max(0.01, Math.hypot(he[0] - hp[0], he[1] - hp[1]) / 40);
  const gap = Math.max(0, Math.hypot(hp[0] - sx, hp[1] - sy) - r) / pxPerM;
  maxC = Math.max(maxC, hs.peakC * Math.exp(-(gap * gap) / (2 * 16 * 16)));
  return { maxC, x: bx, z: bz };
}

/** Size a canvas for the given css box and return a dpr-scaled 2D context. */
export function prepCanvas(cv: HTMLCanvasElement, w: number, h: number, maxDpr = 1.5): CanvasRenderingContext2D | null {
  const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(w * dpr));
  cv.height = Math.max(1, Math.round(h * dpr));
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
