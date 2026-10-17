// Command Table: everything derived from ZONE that the 3D needs, as plain numbers and helpers (no
// meshes): the slab box, smoothed centre lines for the river and the roads, nearest-point queries,
// the dam's local frame and the placement of the dam's parts. Every module builds from these, so the
// terrain carving, the props and wave 2's draped layers all agree.
//
// Dam frame: local x runs downstream (along ZONE.dam.rot measured as atan2(dz, dx), the river's
// heading at the dam), local z runs along the crest toward the south bank. world = c + u·x + v·z.
import { ZONE } from './zone.js';

export const SLAB = {
  x0: -ZONE.size[0] / 2, x1: ZONE.size[0] / 2, z0: -ZONE.size[1] / 2, z1: ZONE.size[1] / 2,
  w: ZONE.size[0], d: ZONE.size[1],
  base: -100,          // the slab's flat underside (the cut edges run from here up to the land)
  plinth: 5,           // a dark machined base plate under the slab
};
SLAB.table = SLAB.base - SLAB.plinth;   // the operations table's top surface

export const LEVELS = {
  reservoir: 45.0,     // reservoir surface
  crest: 48.5,         // dam crest road (freeboard 3.5 m)
  damFloor: -1.0,      // river bed at the dam
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------------ polylines */
/** Centripetal Catmull-Rom through pts ([[x, z], ...]), resampled every ~step metres. ext extends both ends straight. */
export function densify(pts, step = 4, ext = 0) {
  const P = pts.map((p) => [p[0], p[1]]);
  if (ext > 0) {
    const a = P[0], b = P[1], n = Math.hypot(a[0] - b[0], a[1] - b[1]);
    P.unshift([a[0] + (a[0] - b[0]) / n * ext, a[1] + (a[1] - b[1]) / n * ext]);
    const c = P[P.length - 1], d = P[P.length - 2], m = Math.hypot(c[0] - d[0], c[1] - d[1]);
    P.push([c[0] + (c[0] - d[0]) / m * ext, c[1] + (c[1] - d[1]) / m * ext]);
  }
  const out = [];
  const get = (i) => P[clamp(i, 0, P.length - 1)];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(2, Math.ceil(segLen / step));
    // centripetal parameterisation
    const tj = (pa, pb) => Math.pow(Math.max(Math.hypot(pb[0] - pa[0], pb[1] - pa[1]), 1e-4), 0.5);
    const t0 = 0, t1 = t0 + tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
    for (let k = 0; k < n; k++) {
      const t = t1 + (t2 - t1) * (k / n);
      const A1 = mixp(p0, p1, t0, t1, t), A2 = mixp(p1, p2, t1, t2, t), A3 = mixp(p2, p3, t2, t3, t);
      const B1 = mixp(A1, A2, t0, t2, t), B2 = mixp(A2, A3, t1, t3, t);
      out.push(mixp(B1, B2, t1, t2, t));
    }
  }
  const end = P[P.length - 1];
  const last = out[out.length - 1];
  if (last && Math.hypot(last[0] - end[0], last[1] - end[1]) < step * 0.5) out.pop();   // no sliver segment at the end
  out.push(end.slice());
  return toLine(out);
}
function mixp(a, b, ta, tb, t) {
  const d = tb - ta; if (Math.abs(d) < 1e-9) return a.slice();
  const k = (t - ta) / d; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}
/** A line: flat arrays x, z, cumulative length s, unit tangents tx, tz. */
export function toLine(pts) {
  const n = pts.length, x = new Float64Array(n), z = new Float64Array(n), s = new Float64Array(n);
  for (let i = 0; i < n; i++) { x[i] = pts[i][0]; z[i] = pts[i][1]; if (i) s[i] = s[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]); }
  return { n, x, z, s, length: s[n - 1] };
}
/**
 * Nearest point on a line to (px, pz): { s, d, qx, qz, tx, tz, i, f }. d is signed: positive to the
 * right of the direction of travel when x runs east and z south (for the river: the south bank).
 */
export function project(L, px, pz, out = {}) {
  let best = Infinity, bi = 0, bf = 0;
  for (let i = 0; i < L.n - 1; i++) {
    const ax = L.x[i], az = L.z[i], ux = L.x[i + 1] - ax, uz = L.z[i + 1] - az;
    const uu = ux * ux + uz * uz;
    let f = uu > 0 ? ((px - ax) * ux + (pz - az) * uz) / uu : 0;
    f = f < 0 ? 0 : f > 1 ? 1 : f;
    const dx = px - ax - ux * f, dz = pz - az - uz * f, dd = dx * dx + dz * dz;
    if (dd < best) { best = dd; bi = i; bf = f; }
  }
  const ax = L.x[bi], az = L.z[bi], ux = L.x[bi + 1] - ax, uz = L.z[bi + 1] - az, ul = Math.hypot(ux, uz) || 1;
  out.qx = ax + ux * bf; out.qz = az + uz * bf;
  out.tx = ux / ul; out.tz = uz / ul;
  out.s = L.s[bi] + (L.s[bi + 1] - L.s[bi]) * bf;
  out.d = out.tx * (pz - out.qz) - out.tz * (px - out.qx);
  out.i = bi; out.f = bf;
  return out;
}
/** Point and tangent at arc length s. */
export function pointAt(L, s, out = {}) {
  s = clamp(s, 0, L.length);
  let lo = 0, hi = L.n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L.s[m] <= s) lo = m; else hi = m; }
  const seg = L.s[hi] - L.s[lo] || 1, f = (s - L.s[lo]) / seg;
  out.x = L.x[lo] + (L.x[hi] - L.x[lo]) * f; out.z = L.z[lo] + (L.z[hi] - L.z[lo]) * f;
  const ul = Math.hypot(L.x[hi] - L.x[lo], L.z[hi] - L.z[lo]) || 1;
  out.tx = (L.x[hi] - L.x[lo]) / ul; out.tz = (L.z[hi] - L.z[lo]) / ul;
  return out;
}
/** Signed distance to a closed polygon ([[x, z], ...]): negative inside. */
export function polySD(poly, px, pz) {
  let best = Infinity, inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [bx, bz] = poly[i];
    const ux = bx - ax, uz = bz - az, uu = ux * ux + uz * uz;
    const f = clamp(((px - ax) * ux + (pz - az) * uz) / uu, 0, 1);
    best = Math.min(best, Math.hypot(px - ax - ux * f, pz - az - uz * f));
    if ((az > pz) !== (bz > pz) && px < ((bx - ax) * (pz - az)) / (bz - az) + ax) inside = !inside;
  }
  return inside ? -best : best;
}

/* ---------------------------------------------------------------- the river */
export const RIVER = densify(ZONE.river, 4, 260);

/* ------------------------------------------------------------------ the dam */
const th = ZONE.dam.rot;
export const DAM = {
  cx: ZONE.dam.x, cz: ZONE.dam.z, rot: th,
  ux: Math.cos(th), uz: Math.sin(th),          // downstream
  vx: -Math.sin(th), vz: Math.cos(th),         // along the crest, toward the south bank
  half: ZONE.dam.crest / 2,                    // 120 m: crest half length (ends keyed into the abutments)
  R: 380,                                      // plan radius of the arch (convex upstream)
  crestW: 8,                                   // crest road width
  slope: 0.78,                                 // downstream face batter (horizontal per vertical)
  gates: ZONE.dam.spillwayGates,
  gateW: 8.5, pierW: 2.6,
};
DAM.toLocal = (x, z) => { const dx = x - DAM.cx, dz = z - DAM.cz; return [dx * DAM.ux + dz * DAM.uz, dx * DAM.vx + dz * DAM.vz]; };
DAM.toWorld = (xl, zl) => [DAM.cx + DAM.ux * xl + DAM.vx * zl, DAM.cz + DAM.uz * xl + DAM.vz * zl];
/** Upstream face offset (local x) at crest position zl: the arch bows upstream in the middle. */
DAM.arc = (zl) => DAM.R - Math.sqrt(Math.max(DAM.R * DAM.R - zl * zl, 0));
/** Local x of the downstream toe at height y (the face batter from the crest down). */
DAM.faceX = (zl, y) => DAM.arc(zl) + DAM.crestW + DAM.slope * Math.max(0, LEVELS.crest - 4 - y);
// where the river crosses the dam axis: the spillway is centred there
{
  let best = Infinity, zs = 0;
  for (let zl = -80; zl <= 80; zl += 0.5) {
    const [x, z] = DAM.toWorld(DAM.arc(zl), zl);
    const q = project(RIVER, x, z);
    if (Math.abs(q.d) < best) { best = Math.abs(q.d); zs = zl; }
  }
  DAM.spillZ = zs;
  DAM.spillHalf = (DAM.gates * DAM.gateW + (DAM.gates + 1) * DAM.pierW) / 2;   // 23.5 m
  DAM.sRiver = project(RIVER, ...DAM.toWorld(DAM.arc(zs), zs)).s;             // river arc length at the dam
}
/** The powerhouse sits on the north bank at the toe (ZONE.powerhouse), the intake tower and the two
 *  penstocks in line with it; the switchyard is just north of it. */
{
  const [xl, zl] = DAM.toLocal(ZONE.powerhouse.x, ZONE.powerhouse.z);
  DAM.ph = { xl, zl, w: ZONE.powerhouse.w, d: ZONE.powerhouse.d, h: ZONE.powerhouse.h };
  DAM.intakeZ = zl;
}

/** True when (x, z) is inside the dam's plan footprint (between its upstream face and its toe). */
export function inDamFootprint(x, z, pad = 0) {
  const [xl, zl] = DAM.toLocal(x, z);
  if (Math.abs(zl) > DAM.half + pad) return false;
  return xl > DAM.arc(zl) - pad && xl < DAM.faceX(zl, LEVELS.damFloor) + pad;
}

/* ------------------------------------------------------------------ the roads */
export const ROAD = { half: 3.2, shoulder: 1.6 };
export const ROAD_MAIN = densify(ZONE.road, 4);
export const ROAD_BRANCH = densify(ZONE.roadBranch, 4);

/** River level along the river (arc length s): the reservoir upstream of the dam, then the falling river. */
export function riverFloor(s) {
  const k = s - DAM.sRiver;
  return k < 0 ? LEVELS.damFloor + 0.012 * -k : LEVELS.damFloor - 0.0085 * k;
}
export function riverSurface(s) {
  return s < DAM.sRiver ? LEVELS.reservoir : riverFloor(s) + 1.3;
}
