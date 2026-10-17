// Command Table: the six camera poses and the moves between them. A pose is a direction (yaw: the
// camera's bearing from its target measured from south toward east: 0 = from the south looking north,
// 90° = from the east looking west;
// pitch: degrees above the horizon), a target, a lens, a lens shift, and a set of points it must
// frame with margins. The distance is solved per aspect ratio (project the points, binary search),
// so the framing holds at every screen shape; portrait screens get their own steeper, closer poses
// that frame the part of the table that matters for that step.
//
//   S0 hero      dusk, low oblique from the downstream end, the dam and reservoir up the valley
//   S1 patrol    three-quarter, the road, the substation and the dam in one view
//   S2 launch    three-quarter, closer: the truck on the floor, the north slope it will fly to
//   S3 thermal   higher: the hotspot slope, the line, the truck
//   S4 map       straight down, north up, the whole slab
//   S5 report    pulled back, the slab on the left, the right of the frame left free for the card
import * as THREE from 'three';
import { ZONE } from './zone.js';
import { SLAB } from './layout.js';

const D = THREE.MathUtils.degToRad;
const P = (x, y, z) => new THREE.Vector3(x, y, z);

// framing sets
const slabTop = () => {
  const pts = [];
  for (const x of [SLAB.x0, 0, SLAB.x1]) for (const z of [SLAB.z0, SLAB.z1]) pts.push(P(x, 60, z));
  for (const z of [SLAB.z0, 0, SLAB.z1]) for (const x of [SLAB.x0, SLAB.x1]) pts.push(P(x, 60, z));
  for (const x of [SLAB.x0, SLAB.x1]) for (const z of [SLAB.z0, SLAB.z1]) pts.push(P(x, SLAB.table, z));
  return pts;
};
const region = (pts, y = 40) => pts.map(([x, z]) => P(x, y, z));
const T = ZONE.truckStart, H = ZONE.hotspot, S = ZONE.substation;

export const POSES = [
  {
    name: 'hero', target: P(-60, -10, -40), yaw: 78, pitch: 18, fov: 30, fit: slabTop, mx: 0.03, my: 0.1,
    // near-square containers (the site's phone hero is ~345–415 × 439): the slab's top fills the width, the hotspot central
    compact: { target: P(40, 0, -60), yaw: 74, pitch: 24, fov: 32, fit: () => [P(SLAB.x0, 60, SLAB.z0), P(SLAB.x1, 60, SLAB.z0), P(SLAB.x0, 60, SLAB.z1), P(SLAB.x1, 60, SLAB.z1), P(SLAB.x1, SLAB.table, SLAB.z1)], mx: -0.01, my: 0.05 },
    portrait: { target: P(140, 10, -170), yaw: 70, pitch: 28, fov: 38, fit: () => region([[-300, -250], [-260, 40], [H.x + 80, H.z - 60], [H.x + 60, H.z + 120], [220, 160]], 30), mx: 0.03, my: 0.2 },
  },
  {
    name: 'patrol', target: P(170, 10, -30), yaw: 22, pitch: 33, fov: 32, fit: () => region([[-240, -200], [-200, 40], [S.x + 50, S.z - 40], [S.x + 40, S.z + 40], [ZONE.road[0][0], ZONE.road[0][1]], [430, 260]], 30), mx: 0.05, my: 0.08,
    portrait: { target: P(260, 10, -40), yaw: 20, pitch: 46, fov: 40, fit: () => region([[T.x, T.z + 30], [S.x + 30, S.z - 30], [80, -60], [520, 120]], 30), mx: 0.04, my: 0.04, shiftY: 0.2, fitY: [-0.18, 0.86] },
  },
  {
    name: 'launch', target: P(330, 20, -90), yaw: 28, pitch: 35, fov: 32, fit: () => region([[T.x - 60, T.z + 50], [H.x + 60, H.z - 70], [S.x + 30, S.z], [100, -150], [520, 160]], 30), mx: 0.06, my: 0.08,
    portrait: { target: P(340, 20, -100), yaw: 26, pitch: 48, fov: 40, fit: () => region([[T.x, T.z + 30], [H.x, H.z - 50], [250, -200], [460, 60]], 30), mx: 0.05, my: 0.04, shiftY: 0.2, fitY: [-0.18, 0.62] },
  },
  {
    name: 'thermal', target: P(370, 40, -200), yaw: 12, pitch: 52, fov: 32, fit: () => region([[T.x - 40, T.z + 40], [H.x - 120, H.z - 90], [H.x + 140, H.z - 90], [S.x + 40, S.z + 20], [150, 60]], 40), mx: 0.06, my: 0.08,
    portrait: { target: P(380, 40, -220), yaw: 10, pitch: 60, fov: 40, fit: () => region([[T.x, T.z + 20], [H.x - 90, H.z - 70], [H.x + 110, H.z - 70], [350, 0]], 40), mx: 0.05, my: 0.04, shiftY: 0.2, fitY: [-0.18, 0.86] },
  },
  {
    name: 'map', target: P(0, 0, 0), yaw: 0, pitch: 89.6, fov: 14, fit: () => [P(SLAB.x0, 0, SLAB.z0), P(SLAB.x1, 0, SLAB.z0), P(SLAB.x0, 0, SLAB.z1), P(SLAB.x1, 0, SLAB.z1)], mx: 0.05, my: 0.08,
    portrait: { target: P(200, 0, -150), yaw: 90, pitch: 89.6, fov: 16, fit: () => region([[-250, -230], [-250, 60], [660, -470], [660, -250], [320, 190]], 20), mx: 0.03, my: 0.02, shiftY: 0.2, fitY: [-0.2, 0.9] },
  },
  {
    name: 'report', target: P(0, -20, 0), yaw: 36, pitch: 40, fov: 30, fit: slabTop, mx: 0.04, my: 0.14, shiftX: 0.24,
    // (shiftX 0: the wide pose's card-side shift is not inherited; on phones the card sits below the slab)
    portrait: { target: P(0, -20, 0), yaw: 10, pitch: 55, fov: 30, fit: slabTop, mx: 0.03, my: 0.02, shiftX: 0, shiftY: 0.36, fitY: [0.42, 0.9] },
  },
];

const _v = new THREE.Vector3();

/** Place a camera for a solved/interpolated rig state. */
export function placeCamera(cam, r, w, h) {
  const yaw = D(r.yaw), pitch = D(r.pitch);
  const dir = _v.set(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw));
  cam.fov = r.fov;
  cam.aspect = w / h;
  cam.position.copy(r.target).addScaledVector(dir, r.dist);
  cam.up.set(0, 1, 0);
  if (r.pitch > 89) {
    // straight down: screen-up is the bearing away from the camera (yaw 0 → north up)
    cam.up.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  }
  cam.lookAt(r.target);
  cam.near = Math.max(5, r.dist * 0.08);
  cam.far = r.dist * 4 + 4000;
  // lens shift: the subject moves by shiftX/shiftY of the frame (positive x: subject to the left)
  if (r.shiftX || r.shiftY) cam.setViewOffset(w, h, (r.shiftX || 0) * w, (r.shiftY || 0) * h, w, h);
  else cam.clearViewOffset();
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
}

/** Aspect class for pose selection (continuous at the site's phone hero sizes: no split between 360 and 390). */
export const aspectClass = (w, h) => (w / h < 0.7 ? 'portrait' : w / h < 1.2 ? 'compact' : 'wide');

/**
 * Solve the distance so every framing point is inside the frame with margins. extra overrides pose
 * fields; extra.fitX = [xmin, xmax] limits the framing to part of the frame in NDC (e.g. the hero's
 * right 56 % beside the site's copy column: [-0.12, 1] with shiftX -0.22).
 */
export function solvePose(pose, w, h, cls, extra = null) {
  // cls: 'portrait' (aspect < 0.7), 'compact' (0.7–1.2), 'wide'; a pose without that variant uses its wide form
  const v = cls === 'portrait' ? pose.portrait : cls === 'compact' ? pose.compact : null;
  const p = { ...(v ? { ...pose, ...v } : pose), ...(extra || {}) };
  const fx0 = p.fitX ? p.fitX[0] : -1, fx1 = p.fitX ? p.fitX[1] : 1, fy0 = p.fitY ? p.fitY[0] : -1, fy1 = p.fitY ? p.fitY[1] : 1;
  const r = { target: p.target.clone(), yaw: p.yaw, pitch: p.pitch, fov: p.fov, shiftX: p.shiftX || 0, shiftY: p.shiftY || 0, dist: 1000 };
  const pts = p.fit();
  const cam = new THREE.PerspectiveCamera();
  const fits = (d) => {
    r.dist = d;
    placeCamera(cam, r, w, h);
    for (const q of pts) {
      _v.copy(q).project(cam);
      if (_v.z > 1 || _v.z < -1) return false;
      if (_v.x < fx0 + 2 * p.mx || _v.x > fx1 - 2 * p.mx || _v.y < fy0 + 2 * p.my || _v.y > fy1 - 2 * p.my) return false;
    }
    return true;
  };
  let lo = 100, hi = 30000;
  for (let i = 0; i < 40; i++) { const mid = Math.sqrt(lo * hi); if (fits(mid)) hi = mid; else lo = mid; }
  r.dist = hi;
  return r;
}

/**
 * The hero's framing at any stage shape: the look-dev frame (frame-00), a low oblique from the downstream
 * end at golden dusk, the whole slab one object on the table with its cut faces showing. A small search over
 * bearing (60..86 deg: from the east-south-east, up the valley; the low sun grazes the ridges from the left)
 * and pitch (12..20 deg), then over lens shift, keeps the largest slab that
 *   - is whole and uncropped (land, cut faces and plinth) with opts.margin px clear of every edge of the
 *     frame and under the fixed header (opts.top px),
 *   - from 1024 px wide sits in the right 56 % (opts.right: the left limit as a fraction of the width) and
 *     clear of the site's copy block (opts.avoid = [x0, y0, x1, y1] px; the hull of the slab's projected
 *     outline must not touch it),
 *   - gives the lens (opts.lens px) room centred on the hotspot: its distance on screen to every cut edge of
 *     the slab is more than the lens radius, so the lens at rest shows only terrain.
 * Near-ties go to a pitch near 17 deg and a bearing near 76 deg. opts.ground(x, z) is the land height.
 */
export function solveHero(w, h, { ground = () => 60, avoid = null, top = 0, lens = 0, margin = 40, right = 0, debug = null } = {}) {
  const fov = 26;
  const pts = [], edges = [[], [], [], []];
  const gx = (x) => THREE.MathUtils.clamp(x, SLAB.x0 + 2, SLAB.x1 - 2), gz = (z) => THREE.MathUtils.clamp(z, SLAB.z0 + 2, SLAB.z1 - 2);
  // the outline: the land along the cut edges (canopy included), the corners down to the base plate's foot
  for (let x = SLAB.x0; x <= SLAB.x1; x += 100) for (const [k, z] of [[0, SLAB.z0], [1, SLAB.z1]]) { const q = P(x, ground(gx(x), gz(z)) + 24, z); pts.push(q); edges[k].push(q); }
  for (let z = SLAB.z0; z <= SLAB.z1; z += 100) for (const [k, x] of [[2, SLAB.x0], [3, SLAB.x1]]) { const q = P(x, ground(gx(x), gz(z)) + 24, z); pts.push(q); edges[k].push(q); }
  for (const x of [SLAB.x0 - 4, SLAB.x1 + 4]) for (const z of [SLAB.z0 - 4, SLAB.z1 + 4]) pts.push(P(x, SLAB.table, z));
  const hot = P(ZONE.hotspot.x, ground(ZONE.hotspot.x, ZONE.hotspot.z) + 8, ZONE.hotspot.z);
  const cam = new THREE.PerspectiveCamera();
  const r = { target: P(0, 0, 0), yaw: 76, pitch: 17, fov, shiftX: 0, shiftY: 0, dist: 1000 };
  const mx = 2 * margin / w, my = 2 * margin / h;
  const xMin = -1 + Math.max(mx, 2 * right), yTop = 1 - 2 * Math.max(margin, top + 16) / h, yBot = -1 + my;
  const A = avoid ? [(avoid[0] - 18) / w * 2 - 1, 1 - (avoid[3] + 18) / h * 2, (avoid[2] + 18) / w * 2 - 1, 1 - (avoid[1] - 18) / h * 2] : null;
  const S = [], hull = [];
  const fits = (d) => {
    r.dist = d;
    placeCamera(cam, r, w, h);
    S.length = 0;
    for (const q of pts) {
      _v.copy(q).project(cam);
      if (_v.z > 1 || _v.z < -1) return false;
      if (_v.x < xMin || _v.x > 1 - mx || _v.y > yTop || _v.y < yBot) return false;
      S.push(_v.x, _v.y);
    }
    // the lens ring (centred on the hotspot) inside the frame and under the header
    _v.copy(hot).project(cam);
    const lx = 2 * (lens + 10) / w, ly = 2 * (lens + 10) / h;
    if (_v.x < -1 + lx || _v.x > 1 - lx || _v.y < -1 + ly || _v.y > 1 - 2 * (top + lens + 10) / h) return false;
    if (A) { convexHull(S, hull); if (hullHitsRect(hull, A)) return false; }
    return true;
  };
  // room for the lens: the hotspot's distance on screen to every cut edge (grows with the slab)
  const px = (q) => { _v.copy(q).project(cam); return [(_v.x + 1) * w / 2, (1 - _v.y) * h / 2]; };
  const room = () => {
    const hp = px(hot);
    let best = Infinity;
    for (const L of edges) {
      const E = L.map(px);
      for (let i = 0; i < E.length - 1; i++) {
        const a = E[i], b = E[i + 1], dx = b[0] - a[0], dy = b[1] - a[1];
        const t = THREE.MathUtils.clamp(((hp[0] - a[0]) * dx + (hp[1] - a[1]) * dy) / Math.max(1e-6, dx * dx + dy * dy), 0, 1);
        best = Math.min(best, Math.hypot(hp[0] - a[0] - dx * t, hp[1] - a[1] - dy * t));
      }
    }
    return best;
  };
  const solve = () => {
    let lo = 200, hi = 60000;
    if (!fits(hi)) return Infinity;
    for (let i = 0; i < 24; i++) { const mid = Math.sqrt(lo * hi); if (fits(mid)) hi = mid; else lo = mid; }
    fits(hi);
    return hi;
  };
  // the free room's centre (placement among equally large fits)
  const cx = (xMin + 1 - mx) / 2, cy = (yTop + yBot) / 2;
  const cands = [];
  const tryOne = (yaw, pitch, sx, sy) => {
    r.yaw = yaw; r.pitch = pitch; r.shiftX = sx; r.shiftY = sy;
    const d = solve();
    if (!isFinite(d)) return null;
    const rm = room();
    convexHull(S, hull);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < hull.length; i += 2) { x0 = Math.min(x0, hull[i]); x1 = Math.max(x1, hull[i]); y0 = Math.min(y0, hull[i + 1]); y1 = Math.max(y1, hull[i + 1]); }
    const c = { yaw, pitch, shiftX: sx, shiftY: sy, dist: d, roomy: rm >= lens + 16, score: (1 / d) * (1 - 0.01 * Math.abs(pitch - 17) - 0.002 * Math.abs(yaw - 76)), pen: Math.abs((x0 + x1) / 2 - cx) + Math.abs((y0 + y1) / 2 - cy) };
    cands.push(c);
    return c;
  };
  const pick = () => {
    const ok = cands.filter((c) => c.roomy), pool = ok.length ? ok : cands;
    const best = Math.max(...pool.map((c) => c.score));
    return pool.filter((c) => c.score >= best * 0.995).sort((a, b) => a.pen - b.pen)[0];
  };
  const SH = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3];
  for (const yaw of [64, 70, 76, 82]) for (const pitch of [12, 15, 18, 20]) for (const sx of SH) for (const sy of SH) tryOne(yaw, pitch, sx, sy);
  if (!cands.length) return { target: P(0, 0, 0), yaw: 76, pitch: 17, fov, shiftX: 0, shiftY: 0, dist: 6000, rest: [0, 0], inward: [-1, 0] };
  // refine: shifts finely, then pitch and bearing
  let cur = pick();
  for (const step of [0.05, 0.025, 0.012]) {
    for (let it = 0; it < 6; it++) {
      const before = cur;
      for (const [dyaw, dp, dx, dy] of [[0, 0, step, 0], [0, 0, -step, 0], [0, 0, 0, step], [0, 0, 0, -step], [0, 1.5, 0, 0], [0, -1.5, 0, 0], [2, 0, 0, 0], [-2, 0, 0, 0]]) {
        tryOne(Math.max(60, Math.min(86, cur.yaw + dyaw)), Math.max(12, Math.min(20, cur.pitch + dp)), cur.shiftX + dx, cur.shiftY + dy);
      }
      cur = pick();
      if (cur === before) break;
    }
  }
  const b = pick();
  if (debug) { debug.cands = cands.slice().sort((x, y) => y.score - x.score).slice(0, 12); debug.room = b.roomy; }
  // the lens rests centred on the hotspot; inward: toward the slab's middle (the idle sweep drifts that way)
  r.yaw = b.yaw; r.pitch = b.pitch; r.shiftX = b.shiftX; r.shiftY = b.shiftY; r.dist = b.dist;
  placeCamera(cam, r, w, h);
  const hp = px(hot), mid = px(P(-120, 60, 0));
  const il = Math.hypot(mid[0] - hp[0], mid[1] - hp[1]) || 1;
  return { target: P(0, 0, 0), fov, yaw: b.yaw, pitch: b.pitch, shiftX: b.shiftX, shiftY: b.shiftY, dist: b.dist, rest: [0, 0], inward: [(mid[0] - hp[0]) / il, (mid[1] - hp[1]) / il] };
}

/** Convex hull of 2D points (flat [x0, y0, x1, y1, ...]) into out (flat, counter-clockwise). */
function convexHull(S, out) {
  const n = S.length / 2, idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => S[2 * a] - S[2 * b] || S[2 * a + 1] - S[2 * b + 1]);
  const cross = (o, a, b) => (S[2 * a] - S[2 * o]) * (S[2 * b + 1] - S[2 * o + 1]) - (S[2 * a + 1] - S[2 * o + 1]) * (S[2 * b] - S[2 * o]);
  const H = [];
  for (const i of idx) { while (H.length >= 2 && cross(H[H.length - 2], H[H.length - 1], i) <= 0) H.pop(); H.push(i); }
  const lower = H.length + 1;
  for (let k = n - 2; k >= 0; k--) { const i = idx[k]; while (H.length >= lower && cross(H[H.length - 2], H[H.length - 1], i) <= 0) H.pop(); H.push(i); }
  H.pop();
  out.length = 0;
  for (const i of H) out.push(S[2 * i], S[2 * i + 1]);
  return out;
}

/** Does a convex polygon (flat, counter-clockwise) touch the rect [x0, y0, x1, y1]? (separating axes) */
function hullHitsRect(P2, R) {
  const n = P2.length / 2;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) { minX = Math.min(minX, P2[2 * i]); maxX = Math.max(maxX, P2[2 * i]); minY = Math.min(minY, P2[2 * i + 1]); maxY = Math.max(maxY, P2[2 * i + 1]); }
  if (maxX < R[0] || minX > R[2] || maxY < R[1] || minY > R[3]) return false;
  const rc = [[R[0], R[1]], [R[2], R[1]], [R[2], R[3]], [R[0], R[3]]];
  for (let i = 0; i < n; i++) {
    const ax = P2[2 * i], ay = P2[2 * i + 1], bx = P2[2 * ((i + 1) % n)], by = P2[2 * ((i + 1) % n) + 1];
    const nx = by - ay, ny = ax - bx;   // outward normal of a counter-clockwise edge
    const lim = nx * ax + ny * ay;
    if (rc.every(([x, y]) => nx * x + ny * y > lim)) return false;
  }
  return true;
}

const ease = (t) => t * t * (3 - 2 * t);

/** Interpolate two rig states (yaw by the short way round, distance in log space). */
export function lerpRig(a, b, t, out = { target: new THREE.Vector3() }) {
  out.target.copy(a.target).lerp(b.target, t);
  let dy = b.yaw - a.yaw; dy = ((dy + 540) % 360) - 180;
  out.yaw = a.yaw + dy * t;
  out.pitch = a.pitch + (b.pitch - a.pitch) * t;
  out.fov = a.fov + (b.fov - a.fov) * t;
  out.dist = Math.exp(Math.log(a.dist) + (Math.log(b.dist) - Math.log(a.dist)) * t);
  out.shiftX = a.shiftX + (b.shiftX - a.shiftX) * t;
  out.shiftY = a.shiftY + (b.shiftY - a.shiftY) * t;
  return out;
}

/**
 * Scroll progress u (0..1) → { i, t } between poses i and i + 1 (eased, with a hold at each pose so the
 * camera rests on every state for a while).
 */
export function progressToSegment(u, n = POSES.length) {
  const f = THREE.MathUtils.clamp(u, 0, 1) * (n - 1);
  const i = Math.min(n - 2, Math.floor(f));
  const raw = f - i;
  const hold = 0.14;
  const t = ease(THREE.MathUtils.clamp((raw - hold) / (1 - 2 * hold), 0, 1));
  return { i, t, nearest: Math.round(f) };
}
