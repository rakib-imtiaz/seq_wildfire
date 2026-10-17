// DJI Mavic 3 Thermal (M3T): procedural three.js model at real scale (metres).
// Y up, nose toward +Z, +X is the aircraft's LEFT side. Origin: centre of the unfolded footprint, y = 0 at
// the feet of the landing gear. No logos, no lettering, no laser rangefinder.
//
//   import { buildM3T } from './m3t/model.js';
//   const m = buildM3T({ detail: 'hero' | 'table' });
//   scene.add(m.group);
//   m.setFold(t);             // 0 folded .. 1 unfolded. Pass a linear t: the front arms lead (0..0.7), the rear
//                             // arms follow (0.3..1), each eased in and out
//   m.setPropOpen(u);         // optional: 0 blades folded along the arms .. 1 open. Until it is called, the
//                             // blades follow the fold (they open over the last 14 % of it)
//   m.setGimbalPitch(rad);    // 0 level, negative = down; clamped to DJI's controllable range −90°..+35°
//   m.setProps(angle, blur);  // rotor angle (rad; each motor turns its own way), blur 0 crisp .. 1 spinning
//   m.anchors.thermal / .wide / .tele   (Object3D at each lens front, child of the pitch node)
//   m.measure(fold)           // bounding size without propellers → { size: [x, y, z], min, max }
//   m.triangles()             // visible triangle count
//   m.dispose();
//
// Layout and every derived number are documented in public/table/M3T_LOG.md. DJI figures (FACTS §3 and the
// DJI spec page): unfolded 347.5 × 283 × 107.7 mm without props, folded 221 × 96.3 × 90.3 mm, diagonal
// 380.1 mm, 9453F propellers, M3T gimbal tilt controllable −90°..+35°.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createM3TMaterials } from './materials.js';

export const M3T_SPECS = Object.freeze({
  unfolded: [0.3475, 0.283, 0.1077], // span across the front motors × nose-to-tail × height, no props
  folded: [0.221, 0.0963, 0.0903],    // length × width × height, no props
  diagonal: 0.3801,
  propDiameter: 0.239,                // 9453F: 9.4 in
  tiltRange: [-90, 35],               // controllable tilt, degrees
});

/* ================================================================== layout (metres) */
const MR = 0.0135;            // motor housing radius (front span 2 × 0.16025 + 2 × MR = 0.3475)
const PROP_R = 0.1195;        // 9453F tip radius
const PIVOT_R = 0.0072;       // folding-blade pivot radius on the hub
const ARMS = {
  // side: +1 = aircraft left (+X). hinge: fold pivot. motor: motor axis point (housing centre), unfolded.
  // fold: where the motor point goes when folded [x, y, ±1 = backward / forward]. spin: +1 = CCW from above.
  FL: { side: +1, front: true, hinge: [0.0375, 0.092, 0.0705], motor: [0.16025, 0.066, 0.1201], fold: [0.0347, 0.0872, -1], spin: -1 },
  FR: { side: -1, front: true, hinge: [-0.0375, 0.092, 0.0705], motor: [-0.16025, 0.066, 0.1201], fold: [-0.0347, 0.0872, -1], spin: +1 },
  RL: { side: +1, front: false, hinge: [0.031, 0.036, -0.040], motor: [0.129, 0.022, -0.128], fold: [0.0347, 0.041, +1], spin: +1 },
  RR: { side: -1, front: false, hinge: [-0.031, 0.036, -0.040], motor: [-0.129, 0.022, -0.128], fold: [-0.0347, 0.041, +1], spin: -1 },
};
// Body cross-sections, nose → tail: [z, half-width, top y, bottom y, top roundness, bottom roundness].
// One continuous wedge (tallest at the nose shoulders, sloping down to the tail, as in DJI's side views); the
// frame shell and the battery are two lofts of the same surface split by a seam at z ≈ −0.0055.
const BODY_ST = [
  [0.1255, 0.0380, 0.1048, 0.0630, 4.4, 2.6],
  [0.1150, 0.0391, 0.1058, 0.0622, 4.4, 2.5],
  [0.1050, 0.0397, 0.1062, 0.0622, 4.3, 2.5],
  [0.0950, 0.0400, 0.1060, 0.0624, 4.2, 2.5],
  [0.0870, 0.0401, 0.1056, 0.0600, 4.0, 2.5],
  [0.0830, 0.0401, 0.1053, 0.0560, 4.0, 2.6],
  [0.0790, 0.0400, 0.1049, 0.0420, 4.0, 2.8],
  [0.0750, 0.0399, 0.1045, 0.0330, 4.0, 3.0],
  [0.0600, 0.0394, 0.1032, 0.0300, 4.0, 2.8],
  [0.0400, 0.0384, 0.1010, 0.0292, 3.9, 2.7],
  [0.0200, 0.0372, 0.0984, 0.0292, 3.8, 2.7],
  [0.0000, 0.0358, 0.0955, 0.0295, 3.7, 2.7],
  [-0.0200, 0.0340, 0.0925, 0.0300, 3.5, 2.7],
  [-0.0400, 0.0315, 0.0893, 0.0310, 3.2, 2.7],
  [-0.0550, 0.0286, 0.0866, 0.0322, 2.9, 2.7],
  [-0.0680, 0.0263, 0.0842, 0.0340, 2.6, 2.6],
];
const NOSE_CAP = 0.011;       // nose tip at z = 0.1365
const TAIL_CAP = 0.0115;      // tail at z = −0.0795 → folded length 0.1418 − (−0.0795) ≈ 0.221
const SEAM = [-0.0050, -0.0062]; // battery seam: frame ends / battery starts (1.2 mm gap)
const TUMBLE = 0.10;          // flanks lean in toward the top deck
// Gimbal (world points, unfolded): yaw axis, roll axis, pitch axis = camera head centre.
const G = {
  yaw: [0, 0.052, 0.0925], roll: [0, 0.044, 0.0965], pitch: [0, 0.0355, 0.120],
  head: [0.041, 0.036, 0.0345],    // W × H × D of the housing; a 3.5 mm face plate (with the lens holes) sits
                                   // in front, so the face is at z = 0.14075 and the lens rims reach ≈ 0.1418
};

const HERO_Q = { ring: 96, rings: 84, cap: 9, armSeg: 20, armSteps: 28, lathe: 48, blade: [34, 9], small: 28, details: true };
const TABLE_Q = { ring: 16, rings: 14, cap: 3, armSeg: 6, armSteps: 5, lathe: 10, blade: [7, 2], small: 8, details: false };

/* ================================================================== small math helpers */
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const UP = new THREE.Vector3(0, 1, 0);
const ZAX = new THREE.Vector3(0, 0, 1);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s1 = new THREE.Vector3(1, 1, 1);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (t) => { t = clamp01(t); return t * t * t * (t * (6 * t - 15) + 10); }; // smootherstep
const qFromTo = (a, b) => new THREE.Quaternion().setFromUnitVectors(a.clone().normalize(), b.clone().normalize());

/** Fritsch–Carlson monotone cubic through (xs ascending, ys) → f(x) */
function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const hh = xs[i + 1] - xs[i], t = (x - xs[i]) / hh, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * hh * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * hh * m[i + 1];
  };
}
/** Station table → column functions of z */
function stationFns(st) {
  const zs = st.map((s) => -s[0]);
  const col = (c) => { const f = monotone(zs, st.map((s) => s[c])); return (z) => f(-z); };
  return { hw: col(1), yT: col(2), yB: col(3), nT: col(4), nB: col(5), z0: st[0][0], z1: st[st.length - 1][0] };
}

/* ================================================================== geometry helpers */
function xf(geo, { p = [0, 0, 0], r = null, q = null, s = null } = {}) {
  if (q) _q.copy(q); else _q.setFromEuler(_e.set(...(r || [0, 0, 0])));
  _m.compose(Array.isArray(p) ? V(p) : p, _q, s ? V(s) : _s1);
  geo.applyMatrix4(_m);
  return geo;
}
const cyl = (r1, r2, h, seg = 24, open = false) => new THREE.CylinderGeometry(r1, r2, h, seg, 1, open);
/** Lathe around Y from [r, y] pairs, traced bottom/outside → up → across → down the inside (outward normals) */
function lathe(profile, seg = 32) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), seg);
}
/** The same lathe with its axis along +Z (profile y becomes z: front = +z) */
const latheZ = (profile, seg) => xf(lathe(profile, seg), { r: [Math.PI / 2, 0, 0] });
const rboxBase = (w, h, d, r = 0.002, seg = 3) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5, d / 2 - 1e-5));
function roundedRectShape(w, h, r, hole = null) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  if (hole) {
    const [hw, hh, hr] = hole, p = new THREE.Path(), X = -hw / 2, Y = -hh / 2;
    p.moveTo(X + hr, Y); p.quadraticCurveTo(X, Y, X, Y + hr); p.lineTo(X, Y + hh - hr);
    p.quadraticCurveTo(X, Y + hh, X + hr, Y + hh); p.lineTo(X + hw - hr, Y + hh);
    p.quadraticCurveTo(X + hw, Y + hh, X + hw, Y + hh - hr); p.lineTo(X + hw, Y + hr);
    p.quadraticCurveTo(X + hw, Y, X + hw - hr, Y); p.lineTo(X + hr, Y);
    s.holes.push(p);
  }
  return s;
}
/** Extrude a shape from z = 0 back to z = −depth (front face at z = 0) */
function extrudeBack(shape, depth, curveSegments = 8) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments });
  return xf(g, { p: [0, 0, -depth] });
}
/** Superellipse cross-section sampled at equal arc length, starting at the bottom centre and running
 *  through +x (u 0.25), the top (0.5), −x (0.75). Returns { pts: [x, y, ...], u } with seg + 1 points. */
function seSection(hw, hh, nT, nB, seg, tumble = 0) {
  const S = 360, raw = new Float32Array((S + 1) * 2);
  for (let i = 0; i <= S; i++) {
    const t = -Math.PI / 2 + (i / S) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    const e = 2 / (s >= 0 ? nT : nB);
    const y = hh * Math.sign(s) * Math.pow(Math.abs(s), e);
    let x = hw * Math.sign(c) * Math.pow(Math.abs(c), e);
    if (tumble) x *= 1 - tumble * Math.max(0, y / hh);
    raw[i * 2] = x; raw[i * 2 + 1] = y;
  }
  const L = new Float32Array(S + 1);
  for (let i = 1; i <= S; i++) L[i] = L[i - 1] + Math.hypot(raw[i * 2] - raw[i * 2 - 2], raw[i * 2 + 1] - raw[i * 2 - 1]);
  const pts = new Float32Array((seg + 1) * 2), u = new Float32Array(seg + 1);
  let k = 0;
  for (let j = 0; j <= seg; j++) {
    const target = (j / seg) * L[S];
    while (k < S - 1 && L[k + 1] < target) k++;
    const f = (target - L[k]) / Math.max(1e-12, L[k + 1] - L[k]);
    pts[j * 2] = raw[k * 2] + (raw[k * 2 + 2] - raw[k * 2]) * f;
    pts[j * 2 + 1] = raw[k * 2 + 1] + (raw[k * 2 + 3] - raw[k * 2 + 1]) * f;
    u[j] = j / seg;
  }
  pts[seg * 2] = pts[0]; pts[seg * 2 + 1] = pts[1];
  return { pts, u };
}
/** Average the normals of the duplicated seam column (j = 0 and j = seg) so the closing seam is invisible */
function weldSeamNormals(geo, nRings, seg) {
  const n = geo.attributes.normal, s = seg + 1, a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i < nRings; i++) {
    const i0 = i * s, i1 = i * s + seg;
    a.fromBufferAttribute(n, i0); b.fromBufferAttribute(n, i1); a.add(b).normalize();
    n.setXYZ(i0, a.x, a.y, a.z); n.setXYZ(i1, a.x, a.y, a.z);
  }
  n.needsUpdate = true;
}
/** Ring-loft geometry. rings: [{ P: centre, X / Y: axes for the section's x / y, sec, sx, sy, v }].
 *  Checked and flipped if it came out inside-out. */
function loftGeometry(rings, seg) {
  const stride = seg + 1, nR = rings.length;
  const pos = new Float32Array(nR * stride * 3), uv = new Float32Array(nR * stride * 2);
  const p = new THREE.Vector3();
  rings.forEach((r, i) => {
    for (let j = 0; j <= seg; j++) {
      const o = i * stride + j, x = r.sec.pts[j * 2] * r.sx, y = r.sec.pts[j * 2 + 1] * r.sy;
      p.copy(r.P).addScaledVector(r.X, x).addScaledVector(r.Y, y);
      pos[o * 3] = p.x; pos[o * 3 + 1] = p.y; pos[o * 3 + 2] = p.z;
      uv[o * 2] = r.sec.u[j]; uv[o * 2 + 1] = r.v;
    }
  });
  const idx = [];
  for (let i = 0; i < nR - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * stride + j, b = a + 1, c = a + stride, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mid = Math.floor(nR / 2), n = g.attributes.normal, q = new THREE.Vector3(), nn = new THREE.Vector3();
  let dot = 0;
  for (let j = 0; j < seg; j += Math.max(1, Math.floor(seg / 8))) {
    const o = mid * stride + j;
    q.fromBufferAttribute(g.attributes.position, o).sub(rings[mid].P);
    nn.fromBufferAttribute(n, o); dot += q.dot(nn);
  }
  if (dot < 0) {
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.setIndex(idx); g.computeVertexNormals();
  }
  weldSeamNormals(g, nR, seg);
  return g;
}
/** Body loft along −z over [z0, z1] of the station functions F, with optional rounded caps. */
function bodyLoft(F, { z0, z1, seg, rings, capFront = 0, capBack = 0, capK = 6, capA = 0.55, vRange, inset = 0 }) {
  const list = [];
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  const vOf = (z) => (vRange[0] - z) / (vRange[0] - vRange[1]);
  const ringAt = (z, s = 1, zOff = 0) => {
    const hw = F.hw(z) - inset, yT = F.yT(z) - inset, yB = F.yB(z) + inset;
    const sec = seSection(hw, (yT - yB) / 2, F.nT(z), F.nB(z), seg, TUMBLE);
    return { P: new THREE.Vector3(0, (yT + yB) / 2, z + zOff), X, Y, sec, sx: s, sy: s, v: vOf(z + zOff) };
  };
  if (capFront) for (let k = capK; k >= 1; k--) {
    const phi = (k / capK) * Math.PI / 2;
    list.push(ringAt(z0, Math.max(0.004, Math.pow(Math.cos(phi), capA)), capFront * Math.sin(phi)));
  }
  for (let i = 0; i < rings; i++) list.push(ringAt(z0 + (z1 - z0) * (i / (rings - 1))));
  if (capBack) for (let k = 1; k <= capK; k++) {
    const phi = (k / capK) * Math.PI / 2;
    list.push(ringAt(z1, Math.max(0.004, Math.pow(Math.cos(phi), capA)), -capBack * Math.sin(phi)));
  }
  return loftGeometry(list, seg);
}
/** Tube loft along a Catmull-Rom path with a superellipse section(t) → { hw, hh, nT, nB }.
 *  Section x runs along B = T × N, section y along N (the part of `up` normal to the path). */
function tubeLoft(points, { seg, steps, section, up = [0, 1, 0], capStart = 0, capEnd = 0, capK = 3 }) {
  const curve = new THREE.CatmullRomCurve3(points.map(V), false, 'centripetal');
  const U = V(up).normalize();
  const ringAt = (t, s = 1, along = 0) => {
    const P = curve.getPointAt(t), T = curve.getTangentAt(t);
    const N = U.clone().addScaledVector(T, -U.dot(T)).normalize();
    const B = new THREE.Vector3().crossVectors(T, N).normalize();
    const sc = section(t);
    const sec = seSection(sc.hw, sc.hh, sc.nT || 2.6, sc.nB || 2.6, seg);
    return { P: P.addScaledVector(T, along), X: B, Y: N, sec, sx: s, sy: s, v: t };
  };
  const list = [];
  if (capStart) for (let k = capK; k >= 1; k--) { const phi = (k / capK) * Math.PI / 2; list.push(ringAt(0, Math.max(0.05, Math.cos(phi)), -capStart * Math.sin(phi))); }
  for (let i = 0; i <= steps; i++) list.push(ringAt(i / steps));
  if (capEnd) for (let k = 1; k <= capK; k++) { const phi = (k / capK) * Math.PI / 2; list.push(ringAt(1, Math.max(0.05, Math.cos(phi)), capEnd * Math.sin(phi))); }
  return loftGeometry(list, seg);
}
/** Per-vertex box projection of UVs in metres (for tiling noise on plastics) */
function boxUV(geo, attr = 'uv') {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ax >= ay && ax >= az) { uv[i * 2] = p.getZ(i); uv[i * 2 + 1] = p.getY(i); }
    else if (ay >= az) { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = p.getZ(i); }
    else { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = p.getY(i); }
  }
  geo.setAttribute(attr, new THREE.BufferAttribute(uv, 2));
  return geo;
}
/** Cheap locality bake: undersides darker (hemispherical occlusion) as vertex colour */
function bakeAO(geo, k = 0.28) {
  const n = geo.attributes.normal, col = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const c = 1 - k * (1 - (0.5 + 0.5 * n.getY(i)));
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = c;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
/** Make geometries mergeable: non-indexed, with normal, uv and color only */
function normalise(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.color) bakeAO(g);
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  g.morphAttributes = {};
  g.clearGroups();
  if (g !== geo) geo.dispose();
  return g;
}

/* ================================================================== builder */
export function buildM3T({ detail = 'hero', texSize } = {}) {
  const hero = detail !== 'table';
  const Qd = hero ? HERO_Q : TABLE_Q;
  const rbox = (w, h, d, r = 0.002, seg = 3) => (hero ? rboxBase(w, h, d, r, seg) : new THREE.BoxGeometry(w, h, d));   // table: plain boxes
  const { M, dispose: disposeMaterials } = createM3TMaterials({ detail, texSize });
  const meshes = {};

  /** Add a named mesh. Plastic-like parts get box UVs; every part gets a vertex-AO colour attribute. */
  const mesh = (parent, name, geo, matKey, { ao = 0.28 } = {}) => {
    if (M[matKey]?.userData?.boxUV) boxUV(geo);
    if (M[matKey]?.userData?.boxUV1) boxUV(geo, 'uv1');      // loft UV for seams, metre UV for grain
    if (!geo.attributes.color) bakeAO(geo, ao);
    const m = new THREE.Mesh(geo, M[matKey]);
    m.name = name;
    parent.add(m);
    meshes[name] = m;
    return m;
  };
  /** Merge small parts per material under one parent (named `${name}_${material}`) */
  const bucket = () => {
    const by = new Map();
    return {
      add(matKey, geo, ao = 0.28) {
        if (M[matKey]?.userData?.boxUV) boxUV(geo);
        if (!geo.attributes.color) bakeAO(geo, ao);
        if (!by.has(matKey)) by.set(matKey, []);
        by.get(matKey).push(normalise(geo));
      },
      flush(parent, name) {
        for (const [k, list] of by) {
          const g = list.length === 1 ? list[0] : mergeGeometries(list, false);
          if (list.length > 1) for (const x of list) x.dispose();
          mesh(parent, `${name}_${k}`, g, k);
        }
        by.clear();
      },
    };
  };

  const root = new THREE.Group(); root.name = 'M3T';
  const body = new THREE.Group(); body.name = 'body'; root.add(body);

  /* ---------------------------------------------------------------- body frame + battery */
  const F = stationFns(BODY_ST);
  const zTail = F.z1;
  const shellGeo = bodyLoft(F, { z0: F.z0, z1: SEAM[0], seg: Qd.ring, rings: Qd.rings, capFront: NOSE_CAP, capK: Qd.cap + 2, capA: 0.3, vRange: [0.1365, SEAM[0]] });
  const shell = mesh(body, 'body_shell', shellGeo, 'shell', { ao: 0.3 });
  const battery = new THREE.Group(); battery.name = 'battery'; body.add(battery);
  const battGeo = bodyLoft(F, { z0: SEAM[1], z1: zTail, seg: Qd.ring, rings: Math.max(6, Math.round(Qd.rings * 0.42)), capBack: TAIL_CAP, capK: Qd.cap, capA: 0.62, vRange: [SEAM[1], zTail - TAIL_CAP] });
  const battShell = mesh(battery, 'battery_shell', battGeo, 'battery', { ao: 0.3 });
  // seam: a dark core just inside the surface fills the 2 mm gap between frame and battery
  mesh(body, 'battery_seam', bodyLoft(F, { z0: SEAM[0] + 0.0012, z1: SEAM[1] - 0.0012, seg: Math.max(12, Qd.ring / 2), rings: 2, vRange: [0, -1], inset: 0.0005 }), 'core', { ao: 0 });

  const ray = new THREE.Raycaster();
  /** Surface hit on a mesh from outside: origin point, direction → { p, n } (world = body space here) */
  const hit = (m, origin, dir) => {
    m.updateMatrixWorld(true);
    ray.set(V(origin), V(dir).normalize()); ray.far = 1;
    const h = ray.intersectObject(m, false)[0];
    if (!h) return null;
    return { p: h.point.clone(), n: h.face.normal.clone().transformDirection(m.matrixWorld).normalize(), uv: h.uv ? h.uv.clone() : null };
  };
  /** Analytic top-deck height of the body at (x, z): front frame, or the battery behind the seam */
  const topY = (x, z) => {
    const hw = F.hw(z), yT = F.yT(z), yB = F.yB(z), hh = (yT - yB) / 2, n = F.nT(z);
    let yr = 0.9;
    for (let i = 0; i < 5; i++) {
      const xe = Math.min(0.999, Math.abs(x) / (hw * (1 - TUMBLE * yr)));
      yr = Math.pow(1 - Math.pow(xe, n), 1 / n);
    }
    return yB + hh + hh * yr;
  };
  /** Orient an object built along +Z so that +Z = dir, at point p */
  const place = (obj, p, dir) => { obj.position.copy(p); obj.quaternion.copy(qFromTo(ZAX, dir)); return obj; };

  /* ---------------------------------------------------------------- lens / sensor assemblies (built along +Z) */
  /** Round lens: bezel barrel, thin retaining ring, domed front element. Front of the bezel at z = 0. */
  const lensRound = (name, { ringR, glassR, depth = 0.008, bezel = 'plasticDark', ring = 'metal', glass = 'glass', dome = 0.0008, lip = 0.0007 }) => {
    const g = new THREE.Group(); g.name = name;
    const seg = Qd.small;
    mesh(g, `${name}_bezel`, latheZ([[ringR, -depth], [ringR, -0.0005], [ringR - 0.0005, 0], [glassR + lip, 0], [glassR + lip * 0.6, -0.0007], [glassR + 0.0002, -0.0016]], seg), bezel, { ao: 0.1 });
    if (hero && ring) mesh(g, `${name}_ring`, latheZ([[glassR + 0.00035, -0.0019], [glassR + 0.00045, -0.0012], [glassR + 0.0001, -0.0010], [glassR, -0.0014]], seg), ring, { ao: 0 });
    const Rs = (glassR * glassR + dome * dome) / (2 * dome), th = Math.asin(Math.min(1, glassR / Rs));
    const cap = new THREE.SphereGeometry(Rs, seg, Math.max(3, Math.round(seg / 5)), 0, Math.PI * 2, 0, th);
    xf(cap, { r: [Math.PI / 2, 0, 0], p: [0, 0, -0.0014 + dome - Rs] });
    mesh(g, `${name}_glass`, cap, glass, { ao: 0 });
    return g;
  };

  /* ---------------------------------------------------------------- body details */
  const det = bucket();
  const bdet = bucket();      // details that live on the battery (flushed into the battery group)
  if (hero) {
    // front air intake: a long stadium slot with fins across the top deck of the nose (DJI photos)
    const slotZ = 0.1175, slotL = 0.046, slotW = 0.0078;
    const conform = (geo, lift) => {      // drape a flat (x, y = height, z) geometry over the deck
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, topY(p.getX(i), p.getZ(i)) + p.getY(i) + lift);
      geo.computeVertexNormals();
      return geo;
    };
    const stad = roundedRectShape(slotL, slotW, slotW / 2 - 1e-5);
    det.add('vent', conform(xf(new THREE.ShapeGeometry(stad, 12), { r: [-Math.PI / 2, 0, 0], p: [0, 0, slotZ] }), 0.00022), 0);
    const rim = new THREE.ExtrudeGeometry(roundedRectShape(slotL + 0.0028, slotW + 0.0028, (slotW + 0.0028) / 2 - 1e-5, [slotL + 0.0002, slotW + 0.0002, (slotW + 0.0002) / 2 - 1e-5]), { depth: 0.0006, bevelEnabled: false, curveSegments: 10 });
    det.add('plasticDark', conform(xf(rim, { r: [-Math.PI / 2, 0, 0], p: [0, 0, slotZ] }), -0.0002), 0.1);
    const fins = 21, straight = slotL / 2 - slotW / 2;
    for (let i = 0; i < fins; i++) {
      const x = -slotL / 2 + slotW * 0.5 + (i / (fins - 1)) * (slotL - slotW);
      const over = Math.max(0, Math.abs(x) - straight) / (slotW / 2);
      const half = Math.sqrt(Math.max(0, 1 - over * over)) * (slotW / 2) * 0.86;
      if (half < 0.0008) continue;
      det.add('plastic', conform(xf(new THREE.BoxGeometry(0.00075, 0.0006, half * 2), { p: [x, 0.0003, slotZ] }), 0.0001), 0.1);
    }
    // top accessory port: raised rounded cover on the deck centre line, two screws, a lid line
    const portZ = 0.0725, portTop = M3T_SPECS.unfolded[2];
    const deckY = topY(0, portZ);
    mesh(body, 'top_port', xf(rbox(0.0158, portTop - deckY + 0.0012, 0.0222, 0.0028, 3), { p: [0, (portTop + deckY - 0.0012) / 2, portZ] }), 'plastic', { ao: 0.18 });
    det.add('core', xf(rbox(0.0112, 0.00025, 0.0012, 0.0001, 1), { p: [0, portTop - 0.00014, portZ + 0.0052] }), 0);
    for (const sx of [-1, 1]) det.add('metalDark', xf(cyl(0.0011, 0.0011, 0.0005, 12), { p: [sx * 0.0046, portTop - 0.0003, portZ - 0.0062] }), 0);
    // battery: release buttons on both flanks
    for (const sx of [-1, 1]) {
      const h = hit(battShell, [sx * 0.08, 0.066, -0.0135], [-sx, 0, 0]);
      if (h) bdet.add('plastic', xf(rbox(0.0040, 0.0060, 0.0115, 0.0016, 2), { p: h.p, q: qFromTo(new THREE.Vector3(sx, 0, 0), h.n) }));
    }
    // frame: two slanted intake slots high on each flank behind the front sensors (DJI side views)
    for (const sx of [-1, 1]) {
      const h = hit(shell, [sx * 0.08, 0.0905, 0.082], [-sx, 0, 0]);
      if (!h) continue;
      const qv = qFromTo(ZAX, h.n).multiply(new THREE.Quaternion().setFromAxisAngle(ZAX, sx * 0.35));
      for (let i = 0; i < 3; i++) det.add('vent', xf(rbox(0.0016, 0.0075, 0.0005, 0.0006, 1), { p: h.p.clone().add(new THREE.Vector3(0, 0, (i - 1) * 0.0042)), q: qv }), 0);
    }
    // frame: slotted vents low on each flank, ahead of the rear-arm hinge
    for (const sx of [-1, 1]) {
      const h = hit(shell, [sx * 0.08, 0.044, 0.026], [-sx, 0, 0]);
      if (!h) continue;
      const qv = qFromTo(ZAX, h.n);
      for (let i = 0; i < 6; i++) det.add('vent', xf(rbox(0.0013, 0.0090, 0.0005, 0.0005, 1), { p: h.p.clone().add(new THREE.Vector3(0, 0, (i - 2.5) * 0.0032)), q: qv }), 0);
    }
    // battery rear face: four level LEDs and the power button; frame rear: cooling slots
    const rear = (m, x, y) => hit(m, [x, y, -0.3], [0, 0, 1]);
    for (let i = 0; i < 4; i++) {
      const h = rear(battShell, -0.0105 + i * 0.0052, 0.060);
      if (h) bdet.add('ledWhite', xf(cyl(0.00085, 0.00085, 0.0012, 12), { p: h.p.clone().addScaledVector(h.n, -0.00045), q: qFromTo(UP, h.n) }), 0);
    }
    { const h = rear(battShell, 0.0128, 0.060); if (h) bdet.add('plastic', xf(rbox(0.0062, 0.0040, 0.0016, 0.0012, 2), { p: h.p.clone().addScaledVector(h.n, -0.0005), q: qFromTo(new THREE.Vector3(0, 0, -1), h.n) })); }
    for (let i = 0; i < 4; i++) {
      const h = rear(battShell, 0, 0.0475 - i * 0.0029);
      if (h) bdet.add('vent', xf(rbox(0.017, 0.0011, 0.0008, 0.0005, 1), { p: h.p, q: qFromTo(new THREE.Vector3(0, 0, -1), h.n) }), 0);
    }
    // beacon lens (the M3T has a built-in beacon; placed top-centre at the tail, inferred from a top view)
    { const h = hit(battShell, [0, 0.3, -0.0702], [0, -1, 0]);
      if (h) mesh(battery, 'beacon', xf(new THREE.SphereGeometry(0.0034, 18, 6, 0, Math.PI * 2, 0, Math.PI / 2), { s: [1, 0.42, 1] }).applyQuaternion(qFromTo(UP, h.n)).translate(h.p.x, h.p.y, h.p.z), 'ledAmber', { ao: 0 }); }
    // downward sensing: two vision cameras, the infrared ToF pair, the auxiliary bottom light
    for (const sx of [-1, 1]) {
      const h = hit(shell, [sx * 0.0135, -0.3, 0.058], [0, 1, 0]);
      if (h) body.add(place(lensRound(`vision_down_${sx > 0 ? 'L' : 'R'}`, { ringR: 0.0052, glassR: 0.0036, depth: 0.006, dome: 0.0009 }), h.p.clone().addScaledVector(h.n, 0.0008), h.n));
      const t = hit(shell, [sx * 0.0058, -0.3, 0.034], [0, 1, 0]);
      if (t) det.add('glass', xf(rbox(0.0052, 0.0011, 0.0042, 0.0008, 2), { p: t.p }), 0);
    }
    { const h = hit(shell, [0, -0.3, 0.018], [0, 1, 0]); if (h) det.add('ledWhite', xf(rbox(0.0085, 0.0011, 0.0042, 0.0012, 2), { p: h.p }), 0); }
  }
  det.flush(body, 'body_detail');
  bdet.flush(battery, 'battery_detail');

  // vision sensors: big round windows at both front corners of the nose (DJI photos), a smaller pair at the
  // tail corners, and an upward pair on the deck shoulders
  const visionSpec = hero ? { ringR: 0.0079, glassR: 0.0057, depth: 0.010, dome: 0.0016 } : { ringR: 0.0075, glassR: 0.0055, depth: 0.004, dome: 0.001 };
  for (const sx of [-1, 1]) {
    const side = sx > 0 ? 'L' : 'R';
    const dirF = new THREE.Vector3(sx * 0.42, 0.04, 1).normalize();
    const target = new THREE.Vector3(sx * 0.0262, 0.0905, 0.128);
    const h = hit(shell, target.clone().addScaledVector(dirF, 0.06).toArray(), dirF.clone().negate().toArray());
    if (h) {
      const d = h.n.clone().lerp(dirF, 0.5).normalize();
      const s = lensRound(`vision_front_${side}`, visionSpec);
      body.add(place(s, h.p.clone().addScaledVector(d, 0.0014), d));
      if (hero) mesh(s, `vision_front_${side}_boss`, latheZ([[visionSpec.ringR + 0.0022, -0.007], [visionSpec.ringR + 0.0022, -0.0013], [visionSpec.ringR + 0.0012, -0.0003], [visionSpec.ringR - 0.0002, -0.0003]], Qd.small), 'shell', { ao: 0.1 });
    }
    const dirB = new THREE.Vector3(sx * 0.3, 0.12, -1).normalize();
    const hb = hit(battShell, new THREE.Vector3(sx * 0.0160, 0.0755, -0.073).addScaledVector(dirB, 0.06).toArray(), dirB.clone().negate().toArray());
    if (hb && hero) { const d = hb.n.clone().lerp(dirB, 0.5).normalize(); battery.add(place(lensRound(`vision_rear_${side}`, { ...visionSpec, ringR: 0.0060, glassR: 0.0042, depth: 0.008 }), hb.p.clone().addScaledVector(d, 0.0009), d)); }
  }

  /* ---------------------------------------------------------------- gimbal: mount → yaw → roll → pitch (camera head) */
  const gimbal = new THREE.Group(); gimbal.name = 'gimbal'; body.add(gimbal);
  const gyaw = new THREE.Group(); gyaw.name = 'gimbal_yaw'; gyaw.position.fromArray(G.yaw); gimbal.add(gyaw);
  const groll = new THREE.Group(); groll.name = 'gimbal_roll'; groll.position.copy(V(G.roll).sub(V(G.yaw))); gyaw.add(groll);
  const gpitch = new THREE.Group(); gpitch.name = 'gimbal_pitch'; gpitch.position.copy(V(G.pitch).sub(V(G.roll))); groll.add(gpitch);
  const local = (geo, origin) => geo.translate(-origin[0], -origin[1], -origin[2]);
  // mount plate and dampers (fixed to the body)
  mesh(gimbal, 'gimbal_mount', xf(rbox(0.028, 0.0028, 0.024, 0.0012, 2), { p: [0, 0.0612, 0.0985] }), 'plastic');
  if (hero) {
    const damp = bucket();
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) damp.add('rubber', xf(new THREE.SphereGeometry(0.0024, 12, 8), { s: [1, 0.8, 1], p: [sx * 0.0095, 0.0583, 0.0985 + sz * 0.0072] }));
    damp.flush(gimbal, 'gimbal_dampers');
  }
  // yaw stage: top plate + yaw motor (axis Y); roll motor (axis Z) behind the head
  mesh(gyaw, 'gimbal_yaw_plate', local(xf(rbox(0.024, 0.0016, 0.0205, 0.0007, 2), { p: [0, 0.0563, 0.0985] }), G.yaw), 'plastic');
  mesh(gyaw, 'gimbal_yaw_motor', local(xf(lathe([[0.0087, 0.0486], [0.0091, 0.0492], [0.0091, 0.0548], [0.0084, 0.0556], [0, 0.0557]], Qd.small), { p: [0, 0, G.yaw[2]] }), G.yaw), 'plastic');
  mesh(groll, 'gimbal_roll_motor', local(xf(latheZ([[0.0080, 0.0920], [0.0083, 0.0928], [0.0083, 0.1000], [0.0076, 0.1008], [0, 0.1009]], Qd.small), { p: [0, G.roll[1], 0] }), G.roll), 'plastic');
  // roll → tilt bracket: a strap from behind the head round the aircraft-left (+X) side to the tilt motor
  const strap = tubeLoft([[0.003, 0.0452, 0.1004], [0.0205, 0.0455, 0.1016], [0.0244, 0.0430, 0.1075], [0.0248, 0.0378, 0.1160], [0.0247, 0.0357, 0.1212]], {
    seg: Qd.armSeg, steps: Math.max(6, Math.round(Qd.armSteps * 0.6)), section: () => ({ hw: 0.0015, hh: 0.0046, nT: 3, nB: 3 }), capStart: 0.0008, capEnd: 0.0008,
  });
  mesh(groll, 'gimbal_bracket', local(strap, G.roll), 'plastic');
  const tilt = xf(lathe([[0, -0.0040], [0.0101, -0.0040], [0.0105, -0.0034], [0.0105, 0.0026], [0.0098, 0.0036], [0.0060, 0.0040], [0, 0.0041]], Qd.small), { r: [0, 0, -Math.PI / 2], p: [0.0247, G.pitch[1], G.pitch[2]] });
  mesh(groll, 'gimbal_tilt_motor', local(tilt, G.roll), 'plastic');
  if (hero) mesh(groll, 'gimbal_tilt_ring', local(xf(new THREE.TorusGeometry(0.0102, 0.00045, 6, Qd.small), { r: [0, Math.PI / 2, 0], p: [0.0285, G.pitch[1], G.pitch[2]] }), G.roll), 'metal', { ao: 0 });
  // camera head (pitch node at the head centre)
  const [HW, HH, HD] = G.head;
  mesh(gpitch, 'camera_head', rbox(HW, HH, HD, 0.0055, hero ? 5 : 1), 'plastic', { ao: 0.22 });
  // lens layout on the face (x to the viewer's right when facing the aircraft, y up)
  const LZ = { wide: [0.0072, 0.0082, 0.0168, 0.0098], thermal: [0.0074, -0.0060, 0.0088], tele: [-0.0086, -0.0058, 0.0066] };
  const FZ = HD / 2 + 0.0035;   // face plate front
  const faceShape = roundedRectShape(0.0362, 0.0312, 0.0042);
  for (const k of ['thermal', 'tele']) { const [x, y, r] = LZ[k]; const h = new THREE.Path(); h.absarc(x, y, r, 0, Math.PI * 2, true); faceShape.holes.push(h); }
  { const [x, y, w, h] = LZ.wide; const r = 0.0021, hp = new THREE.Path(), X = x - w / 2, Y = y - h / 2;
    hp.moveTo(X + r, Y); hp.quadraticCurveTo(X, Y, X, Y + r); hp.lineTo(X, Y + h - r); hp.quadraticCurveTo(X, Y + h, X + r, Y + h);
    hp.lineTo(X + w - r, Y + h); hp.quadraticCurveTo(X + w, Y + h, X + w, Y + h - r); hp.lineTo(X + w, Y + r); hp.quadraticCurveTo(X + w, Y, X + w - r, Y); hp.lineTo(X + r, Y);
    faceShape.holes.push(hp); }
  mesh(gpitch, 'camera_face', xf(extrudeBack(faceShape, 0.0040, hero ? 12 : 4), { p: [0, 0, FZ] }), 'face', { ao: 0 });
  if (hero) {
    const fin = bucket();
    for (let i = 0; i < 9; i++) fin.add('vent', xf(rbox(0.0019, 0.0006, 0.0034, 0.0003, 1), { p: [-0.012 + i * 0.003, HH / 2 + 0.00005, HD / 2 - 0.0058] }), 0);
    fin.flush(gpitch, 'camera_vents');
  }
  // Lenses (front view, +X to the viewer's right): wide = rectangular window top right; thermal = the large
  // round window bottom right; tele = the smaller round lens bottom left. Evidence in M3T_LOG.md.
  const thermal = lensRound('lens_thermal', { ringR: 0.0088, glassR: 0.0066, depth: 0.007, bezel: 'metalDark', ring: 'metalDark', glass: 'germanium', dome: 0.0006, lip: 0.0009 });
  thermal.position.set(LZ.thermal[0], LZ.thermal[1], FZ + 0.0010); gpitch.add(thermal);
  const tele = lensRound('lens_tele', { ringR: 0.0066, glassR: 0.0043, depth: 0.007, bezel: 'metal', ring: 'metalDark', glass: 'glass', dome: 0.0009, lip: 0.0008 });
  tele.position.set(LZ.tele[0], LZ.tele[1], FZ + 0.0010); gpitch.add(tele);
  const wide = new THREE.Group(); wide.name = 'lens_wide'; wide.position.set(LZ.wide[0], LZ.wide[1], FZ + 0.0008); gpitch.add(wide);
  mesh(wide, 'lens_wide_bezel', extrudeBack(roundedRectShape(0.0168, 0.0098, 0.0021, [0.0148, 0.0078, 0.0013]), 0.0045, hero ? 8 : 3), 'bezel', { ao: 0 });
  if (hero) {
    // behind the window: a dark back wall (open toward the glass) and the lens element itself
    mesh(wide, 'lens_wide_cavity', xf(rbox(0.0160, 0.0090, 0.0008, 0.0006, 1), { p: [0, 0, -0.0040] }), 'cavity', { ao: 0 });
    const wideEl = lensRound('lens_wide_element', { ringR: 0.0040, glassR: 0.0030, depth: 0.003, bezel: 'metalDark', ring: 'metal', glass: 'glassDeep', dome: 0.0009, lip: 0.0004 });
    wideEl.position.set(-0.0022, 0, -0.0009); wide.add(wideEl);
  }
  M.window = new THREE.MeshPhysicalMaterial({ name: 'm3t-window', color: 0x0a0c10, roughness: 0.03, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.32, envMapIntensity: 1.6, depthWrite: false });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.0149, 0.0079), M.window);
  win.name = 'lens_wide_window'; win.position.z = -0.0006; win.renderOrder = 2; wide.add(win);
  // anchors at each lens front (for labels / effects)
  const anchor = (name, parent, z) => { const o = new THREE.Object3D(); o.name = name; o.position.set(0, 0, z); parent.add(o); return o; };
  const anchors = { thermal: anchor('anchor_thermal', thermal, 0.0004), wide: anchor('anchor_wide', wide, 0.0004), tele: anchor('anchor_tele', tele, 0.0004) };

  /* ---------------------------------------------------------------- arms, motors, landing gear, props */
  const bladeGeos = { [+1]: bladeGeometry(+1, Qd.blade), [-1]: bladeGeometry(-1, Qd.blade) };
  const discGeo = xf(new THREE.CircleGeometry(PROP_R, hero ? 72 : 24), { r: [-Math.PI / 2, 0, 0] });
  const arms = {};
  const pockets = [];
  for (const [key, A] of Object.entries(ARMS)) arms[key] = buildArm(key, A);
  paintPockets();

  /** Darken the hinge pockets into the loft-space albedo + AO maps of the frame shell and the battery */
  function paintPockets() {
    for (const pk of pockets) {
      const mat = pk.mesh.material, maps = [mat.map, mat.aoMap].filter((t) => t && t.image && t.image.data);
      if (!maps.length) continue;
      const vLen = pk.mesh === shell ? 0.1365 - SEAM[0] : SEAM[1] - (zTail - TAIL_CAP);
      const hw = F.hw(pk.z), hh = (F.yT(pk.z) - F.yB(pk.z)) / 2;
      const perim = 2 * Math.PI * Math.sqrt((hw * hw + hh * hh) / 2) * 1.05;
      const du = pk.h / perim, dv = pk.w / vLen, vc = pk.uv.y + pk.shift / vLen, uc = pk.uv.x;
      for (const tex of maps) {
        const { width: Wt, height: Ht, data } = tex.image, isAO = tex === mat.aoMap;
        const x0 = Math.floor((uc - du) * Wt), x1 = Math.ceil((uc + du) * Wt);
        const y0 = Math.max(0, Math.floor((vc - dv) * (Ht - 1))), y1 = Math.min(Ht - 1, Math.ceil((vc + dv) * (Ht - 1)));
        for (let y = y0; y <= y1; y++) for (let xx = x0; xx <= x1; xx++) {
          const x = ((xx % Wt) + Wt) % Wt;
          const dx = Math.abs((xx / Wt - uc) / (du / 2)), dy = Math.abs((y / (Ht - 1) - vc) / (dv / 2));
          const d = Math.pow(Math.pow(dx, 5) + Math.pow(dy, 5), 1 / 5);            // rounded rectangle
          const inside = 1 - smoothstep(0.92, 1.0, d), rim = smoothstep(0.86, 0.96, d) * (1 - smoothstep(1.0, 1.08, d));
          const k = isAO ? 1 - 0.55 * inside - 0.35 * rim : 1 - 0.5 * inside - 0.35 * rim;
          const i = (y * Wt + x) * 4;
          for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * k);
        }
        tex.needsUpdate = true;
      }
    }
  }

  function buildArm(key, A) {
    const H = V(A.hinge), Mw = V(A.motor), s = A.side;
    const Ml = Mw.clone().sub(H);                         // motor point in the arm's frame (unfolded orientation)
    const L = Ml.length();
    // folded target at the same distance from the hinge
    const dx = A.fold[0] - H.x, dy = A.fold[1] - H.y;
    const Fl = new THREE.Vector3(dx, dy, A.fold[2] * Math.sqrt(Math.max(0, L * L - dx * dx - dy * dy)));
    // hinge axis: the axis closest to vertical that carries Ml onto Fl in one rotation
    const d = Ml.clone().sub(Fl).normalize();
    const n = UP.clone().addScaledVector(d, -UP.dot(d)).normalize();
    const a = Ml.clone().addScaledVector(n, -Ml.dot(n)), b = Fl.clone().addScaledVector(n, -Fl.dot(n));
    const phi = Math.atan2(n.dot(new THREE.Vector3().crossVectors(a, b)), a.dot(b));
    const qFold = new THREE.Quaternion().setFromAxisAngle(n, phi);

    const arm = new THREE.Group(); arm.name = `arm_${key}`; arm.position.copy(H); root.add(arm);
    arm.userData.hinge = { axis: n.toArray(), foldAngleDeg: THREE.MathUtils.radToDeg(phi) };
    // ---- hinge. Body side (fixed): a housing boss above and below the knuckle, split lines, a dark pocket in
    // the shell where the root seats, and (front) the pivot-pin cap on the shoulder. Arm side (rotating): the
    // knuckle barrel on the pivot axis and a thick root block that flows into the tapering beam.
    const kq = qFromTo(UP, n);
    const rk = A.front ? 0.0095 : 0.0092, kh = A.front ? 0.018 : 0.016;       // knuckle radius / height
    const rb = rk + 0.0006, gap = 0.0004;                                        // housing bosses
    const bhUp = A.front ? 0.0040 : 0.0095, bhDn = 0.0042;
    const onAxis = (geo) => geo.applyQuaternion(kq);
    const barrel = (r, h, bevel) => lathe([[0, -h / 2], [r - bevel, -h / 2], [r, -h / 2 + bevel], [r, h / 2 - bevel], [r - bevel, h / 2], [0, h / 2]], Qd.small);
    mesh(arm, `arm_${key}_knuckle`, onAxis(barrel(rk, kh, 0.0009)), 'plastic', { ao: 0.2 });
    const hb = bucket();
    for (const e of [-1, 1]) {
      const bh = e > 0 ? bhUp : bhDn, yc = e * (kh / 2 + gap + bh / 2);
      hb.add('plastic', onAxis(barrel(rb, bh, 0.0008).translate(0, yc, 0)).translate(H.x, H.y, H.z), 0.2);
      if (hero) hb.add('core', onAxis(xf(new THREE.TorusGeometry(rk + 0.0002, 0.00042, 4, Qd.small), { r: [Math.PI / 2, 0, 0], p: [0, e * (kh / 2 + gap / 2), 0] })).translate(H.x, H.y, H.z), 0);
    }
    if (A.front && hero) {   // pivot-pin cap on the shoulder (the two round marks on DJI's top view)
      hb.add('metalDark', onAxis(barrel(0.0034, 0.0008, 0.0003).translate(0, kh / 2 + gap + bhUp + 0.0003, 0)).translate(H.x, H.y, H.z), 0);
    }
    // the pocket: a recess painted into the shell's own albedo/occlusion maps around the hinge (it follows
    // the curved flank exactly), stretched toward the side the root sweeps when the arm folds
    {
      const out = new THREE.Vector3(s, 0, 0);
      const target = A.front ? shell : battShell;
      const h = hit(target, H.clone().addScaledVector(out, 0.08).toArray(), out.clone().negate().toArray());
      if (h && h.uv) pockets.push({ mesh: target, uv: h.uv, z: H.z, w: 2 * rb + 0.016, h: kh + 2 * gap + bhDn + bhUp + 0.004, shift: -A.fold[2] * 0.007 });
    }
    hb.flush(body, `hinge_${key}`);

    // ---- beam: thick root block at the knuckle, then a flattened section tapering ~2x to the motor, a raised
    // top-cover strip along the top, and a slight outboard bow so the folded arm lies outside the shell
    const toHinge = new THREE.Vector3(-Ml.x, 0, -Ml.z).normalize();
    const end = Ml.clone().addScaledVector(toHinge, MR - 0.0022).add(new THREE.Vector3(0, -0.0035, 0));
    const along = end.clone().setY(0).normalize();
    const outF = new THREE.Vector3(s, 0, 0).applyQuaternion(qFold.clone().invert());   // folded "outboard", arm frame
    outF.y = 0; outF.addScaledVector(along, -outF.dot(along));
    const bow = outF.lengthSq() > 1e-8 ? outF.normalize().multiplyScalar(A.front ? 0.0046 : 0.0066) : new THREE.Vector3();
    const P0 = end.clone().multiplyScalar(0.16).add(bow.clone().multiplyScalar(0.8));
    const P1 = end.clone().multiplyScalar(0.45).add(bow).add(new THREE.Vector3(0, A.front ? 0.0012 : 0.0018, 0));
    const P2 = end.clone().add(bow.clone().multiplyScalar(0.35));
    const rootS = A.front ? [0.0084, 0.0080] : [0.0084, 0.0076];
    const neck = A.front ? [0.0068, 0.0060] : [0.0064, 0.0056];
    const tip = A.front ? [0.0040, 0.0036] : [0.0038, 0.0034];
    const sect = (t) => {
      const a = smoothstep(0, 0.22, t), b = clamp01((t - 0.22) / 0.78);
      const w = t < 0.22 ? rootS[0] + (neck[0] - rootS[0]) * a : neck[0] + (tip[0] - neck[0]) * b;
      const hgt = t < 0.22 ? rootS[1] + (neck[1] - rootS[1]) * a : neck[1] + (tip[1] - neck[1]) * b;
      return { hw: w, hh: hgt, nT: 4.2, nB: 3.0 };
    };
    const path = [[0, 0, 0], P0.toArray(), P1.toArray(), P2.toArray()];
    mesh(arm, `arm_${key}_beam`, tubeLoft(path, { seg: Qd.armSeg, steps: Qd.armSteps + (hero ? 6 : 1), section: sect, capEnd: 0 }), 'plastic', { ao: 0.32 });
    if (hero) {
      const curve = new THREE.CatmullRomCurve3(path.map(V), false, 'centripetal');
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const t = 0.1 + (0.8 - 0.1) * (i / 10);
        pts.push(curve.getPointAt(t).add(new THREE.Vector3(0, sect(t).hh + 0.0002, 0)).toArray());
      }
      const cover = tubeLoft(pts, { seg: Qd.armSeg, steps: 22, section: (u) => ({ hw: 0.74 * sect(0.1 + 0.7 * u).hw, hh: 0.0006, nT: 4, nB: 4 }), capStart: 0.0012, capEnd: 0.0012 });
      mesh(arm, `arm_${key}_cover`, cover, 'plastic', { ao: 0.2 });
    }

    // motor unit
    const motor = new THREE.Group(); motor.name = `motor_${key}`; motor.position.copy(Ml); arm.add(motor);
    const grooves = [];
    if (hero) for (let i = 0; i < 3; i++) { const y = -0.0118 + i * 0.0021; grooves.push([MR, y + 0.0006], [MR - 0.0005, y + 0.0009], [MR - 0.0005, y + 0.0012], [MR, y + 0.0015]); }
    const housing = lathe([[0, -0.0146], [0.0088, -0.0146], [0.0117, -0.0139], [0.0130, -0.0126], [MR, -0.0122], ...grooves, [MR, 0.0020], [0.0131, 0.0035], [0.0122, 0.0042], [0.0108, 0.0042], [0.0106, 0.0028]], Qd.lathe);
    mesh(motor, `motor_${key}_housing`, housing, 'plastic', { ao: 0.3 });
    const rotor = new THREE.Group(); rotor.name = `rotor_${key}`; motor.add(rotor);
    mesh(rotor, `motor_${key}_bell`, lathe([[0.0103, 0.0026], [0.0121, 0.0032], [0.0124, 0.0040], [0.0124, 0.0104], [0.0118, 0.0118], [0.0092, 0.0124], [0.0062, 0.0127], [0.0060, 0.0132], [0, 0.0133]], Qd.lathe), 'bell', { ao: 0.15 });
    const hub = bucket();
    if (!hero) hub.add('plasticDark', xf(cyl(0.0080, 0.0088, 0.0045, Qd.small), { p: [0, 0.0157, 0] }));
    if (hero) {
      hub.add('plasticDark', xf(cyl(0.0088, 0.0090, 0.0013, Qd.small), { p: [0, 0.01395, 0] }));
      hub.add('plasticDark', xf(cyl(0.0084, 0.0088, 0.0013, Qd.small), { p: [0, 0.0170, 0] }));
      hub.add('plasticDark', xf(cyl(0.0046, 0.0050, 0.0035, Qd.small), { p: [0, 0.0155, 0] }));
      hub.add('plasticDark', xf(new THREE.SphereGeometry(0.0046, Qd.small, 6, 0, Math.PI * 2, 0, Math.PI / 2), { s: [1, 0.55, 1], p: [0, 0.0176, 0] }));
      for (const e of [-1, 1]) hub.add('metal', xf(cyl(0.0012, 0.0012, 0.0041, 10), { p: [e * PIVOT_R, 0.0157, 0] }), 0);
      for (let i = 0; i < 6; i++) { const ang = (i / 6) * Math.PI * 2 + 0.3; hub.add('vent', xf(rbox(0.0032, 0.0006, 0.0014, 0.0003, 1), { p: [Math.cos(ang) * 0.0094, 0.0123, Math.sin(ang) * 0.0094], r: [0, -ang, 0] }), 0); }
    }
    hub.flush(rotor, `prop_${key}_hub`);
    const prop = new THREE.Group(); prop.name = `prop_${key}`; rotor.add(prop);
    const blades = [0, 1].map((i) => {
      const bg = new THREE.Group(); bg.name = `blade_${key}_${i}`;
      bg.position.set(i === 0 ? PIVOT_R : -PIVOT_R, i === 0 ? 0.0151 : 0.0163, 0);
      const bm = new THREE.Mesh(bladeGeos[A.spin], M.blade); bm.name = `blade_${key}_${i}_mesh`; bm.userData.prop = true;
      bg.add(bm); prop.add(bg);
      return bg;
    });
    const disc = new THREE.Mesh(discGeo, M.disc); disc.name = `prop_${key}_blur`; disc.position.y = 0.0157; disc.renderOrder = 3; disc.visible = false; disc.userData.prop = true;
    motor.add(disc);

    // folded blades: along the folded arm toward the hinge, turned outboard so they clear the body, and
    // coned (front: tips up over the deck, as the raised orange tips in DJI's folded photo; rear: slightly down)
    const back = Ml.clone().negate().applyQuaternion(qFold); back.y = 0; back.normalize();
    const want = back.addScaledVector(new THREE.Vector3(s, 0, 0), Math.tan(THREE.MathUtils.degToRad(A.front ? 14 : 20))).normalize();
    const cone = THREE.MathUtils.degToRad(A.front ? 8 : -3);
    const wl = want.applyQuaternion(qFold.clone().invert());
    const beta = Math.atan2(-wl.z, wl.x);
    const hubFold = beta + Math.PI / 2;

    // lights: front LEDs face forward on the front motor housings; status indicator on the rear housings
    if (A.front) {
      const dir = new THREE.Vector3(0.24 * s, 0, 0.97).normalize();
      mesh(motor, `led_${key}`, xf(rbox(0.0042, 0.0022, 0.0016, 0.0009, 2), { p: dir.clone().multiplyScalar(MR - 0.0003).add(new THREE.Vector3(0, -0.0105, 0)), q: qFromTo(ZAX, dir) }), 'ledRed', { ao: 0 });
    } else {
      const dir = new THREE.Vector3(s * 0.8, 0, -0.6).normalize();
      mesh(motor, `led_${key}`, xf(rbox(0.0024, 0.0042, 0.0016, 0.0009, 2), { p: dir.clone().multiplyScalar(MR - 0.0003).add(new THREE.Vector3(0, -0.0065, 0)), q: qFromTo(ZAX, dir) }), 'ledGreen', { ao: 0 });
    }
    // landing gear: front legs (antennas inside) under the front motors; short feet under the rear motors
    const yG = -Mw.y;                                       // the ground, in the motor frame
    if (A.front) {
      const leg = tubeLoft([[0, -0.0118, 0.0012], [s * 0.0014, yG * 0.55, -0.0018], [s * 0.0040, yG + 0.0024, -0.0050]], {
        seg: Qd.armSeg, steps: Math.max(4, Math.round(Qd.armSteps * 0.7)), up: [0, 0, 1],
        section: (t) => ({ hw: 0.0030 - 0.0008 * t, hh: 0.0076 - 0.0028 * t, nT: 2.4, nB: 2.4 }), capEnd: 0.0012,
      });
      mesh(motor, `leg_${key}`, leg, 'plastic', { ao: 0.25 });
      mesh(motor, `foot_${key}`, xf(rbox(0.0056, 0.0030, 0.0104, 0.0013, 2), { p: [s * 0.0040, yG + 0.0015, -0.0050] }), 'rubber', { ao: 0.1 });
    } else {
      mesh(motor, `foot_${key}`, lathe([[0, yG], [0.0052, yG], [0.0060, yG + 0.0012], [0.0062, -0.0138], [0, -0.0138]], Qd.small), 'rubber', { ao: 0.1 });
    }
    return { key, A, arm, motor, rotor, prop, blades, disc, qFold, beta, hubFold, cone, spin: A.spin };
  }

  /* ---------------------------------------------------------------- state */
  const state = { fold: 1, propOpen: 1, propAuto: true, angle: 0, blur: 0, pitch: 0 };
  const qTmp = new THREE.Quaternion();
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  function applyProps() {
    const u = ease(state.propOpen);
    for (const r of Object.values(arms)) {
      r.rotor.rotation.y = r.hubFold + r.spin * state.angle;
      for (let i = 0; i < 2; i++) {             // blade i's pivot sits at hub + iπ; folded it points along beta
        const relFold = wrap(r.beta - r.hubFold - i * Math.PI);
        r.blades[i].rotation.y = i * Math.PI + relFold * (1 - u);
        r.blades[i].rotation.z = r.cone * (1 - u);
      }
      r.disc.visible = state.blur > 0.001 && state.propOpen > 0.99;
      r.disc.rotation.y = state.angle * 0.05 * r.spin;
    }
    M.blade.opacity = 1 - 0.94 * clamp01(state.blur);   // ghost blades (their orange tips) nearly gone at full spin
    M.blade.depthWrite = state.blur < 0.05;
    M.disc.opacity = 0.34 * clamp01(state.blur);
  }
  function setFold(t) {
    state.fold = clamp01(t);
    const tf = ease(state.fold / 0.7), tr = ease((state.fold - 0.3) / 0.7);
    for (const r of Object.values(arms)) {
      const k = r.A.front ? tf : tr;           // 1 = unfolded (identity), 0 = folded (qFold)
      r.arm.quaternion.copy(qTmp.identity().slerp(r.qFold, 1 - k));
    }
    if (state.propAuto) { state.propOpen = smoothstep(0.86, 1, state.fold); applyProps(); }
  }
  function setPropOpen(u) { state.propAuto = false; state.propOpen = clamp01(u); applyProps(); }
  function setGimbalPitch(rad) {
    const lo = THREE.MathUtils.degToRad(M3T_SPECS.tiltRange[0]), hi = THREE.MathUtils.degToRad(M3T_SPECS.tiltRange[1]);
    state.pitch = Math.min(hi, Math.max(lo, rad));
    gpitch.rotation.x = -state.pitch;
  }
  function setProps(angle, blur = 0) { state.angle = angle; state.blur = clamp01(blur); applyProps(); }

  setFold(1); setGimbalPitch(0); setProps(0, 0);

  /* ---------------------------------------------------------------- runtime maps (action-ready contract) */
  const nodes = {};
  root.traverse((o) => { if (o.name) nodes[o.name] = o; });
  root.userData.sculptRuntime = {
    nodes, meshes,
    sockets: { thermal: anchors.thermal, wide: anchors.wide, tele: anchors.tele, topPort: meshes.top_port || null, gimbalMount: meshes.gimbal_mount },
    colliders: {
      body: { type: 'box', node: 'body', size: [0.08, 0.078, 0.216], center: [0, 0.068, 0.0285] },
      battery: { type: 'box', node: 'battery', size: [0.07, 0.06, 0.074], center: [0, 0.061, -0.042] },
      cameraHead: { type: 'box', node: 'gimbal_pitch', size: [G.head[0], G.head[1], G.head[2] + 0.0045], center: [0, 0, 0.002] },
      ...Object.fromEntries(Object.values(arms).flatMap((r) => [
        [`arm_${r.key}`, { type: 'capsule', node: r.arm.name, from: [0, 0, 0], to: r.motor.position.toArray(), radius: 0.008 }],
        [`motor_${r.key}`, { type: 'cylinder', node: r.motor.name, radius: MR, height: 0.035, center: [0, 0, 0] }],
        [`rotor_${r.key}`, { type: 'cylinder', node: r.motor.name, radius: PROP_R, height: 0.012, center: [0, 0.0157, 0], trigger: true }],
      ])),
    },
    destructionGroups: { battery },
    hinges: Object.fromEntries(Object.values(arms).map((r) => [r.key, r.arm.userData.hinge])),
  };

  function triangles() {
    let n = 0;
    root.traverse((o) => { if (o.isMesh && o.visible) { const g = o.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
    return Math.round(n);
  }
  /** Bounding size without propellers (blades, hubs, blur discs) at a given fold */
  function measure(fold = 1) {
    const keep = { fold: state.fold, auto: state.propAuto, open: state.propOpen, pitch: state.pitch };
    setFold(fold); gpitch.rotation.x = 0;
    root.updateMatrixWorld(true);
    // in the model's own frame (the stage may be yawed / lifted), vertex-precise
    const box = new THREE.Box3(), v = new THREE.Vector3(), rel = new THREE.Matrix4(), inv = root.matrixWorld.clone().invert();
    root.traverse((o) => {
      if (!o.isMesh || o.userData.prop || /^prop_/.test(o.name)) return;
      rel.multiplyMatrices(inv, o.matrixWorld);
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(rel));
    });
    state.propAuto = keep.auto; state.propOpen = keep.open; setFold(keep.fold); applyProps(); setGimbalPitch(keep.pitch);
    root.updateMatrixWorld(true);
    return { size: box.getSize(new THREE.Vector3()).toArray(), min: box.min.toArray(), max: box.max.toArray() };
  }
  function dispose() {
    const gs = new Set();
    root.traverse((o) => { if (o.isMesh) gs.add(o.geometry); });
    for (const g of gs) g.dispose();
    bladeGeos[1].dispose(); bladeGeos[-1].dispose(); discGeo.dispose();
    disposeMaterials();
  }

  return {
    group: root,
    setFold, setPropOpen, setGimbalPitch, setProps,
    anchors,
    parts: { body, battery, gimbal, gimbalYaw: gyaw, gimbalRoll: groll, gimbalPitch: gpitch, arms: Object.fromEntries(Object.entries(arms).map(([k, r]) => [k, r.arm])) },
    materials: M,
    state,
    triangles, measure, dispose,
    detail: hero ? 'hero' : 'table',
  };
}

/* ================================================================== propeller blade (9453F-like) */
/** One folding blade from its pivot along +X. spin +1 = CCW from above (leading edge toward −Z). */
function bladeGeometry(spin, [NS, NC]) {
  const x0 = -0.0045, R = PROP_R - PIVOT_R;          // span from the pivot; the tip sits at PROP_R from the axis
  const pitch = 0.1346;                               // 5.3 in
  const verts = [], uvs = [], idx = [];
  const chord = (t) => {
    if (t < 0.06) return 0.0102 + 0.0042 * (t / 0.06);          // root lug
    if (t < 0.30) return 0.0144 + (0.0226 - 0.0144) * Math.sin(((t - 0.06) / 0.24) * Math.PI / 2);
    return 0.0094 + (0.0226 - 0.0094) * Math.pow(1 - (t - 0.30) / 0.70, 0.9);
  };
  const thick = (t) => (t < 0.06 ? 0.0042 : 0.0032 * (1 - t) + 0.0008 * t);
  const ring = 2 * (NC + 1);
  for (let s = 0; s <= NS; s++) {
    const t = s / NS;
    const tipRound = t > 0.92 ? Math.sqrt(Math.max(0, 1 - ((t - 0.92) / 0.08) ** 2)) : 1;
    const c = chord(t) * Math.max(tipRound, 0.08);
    const x = x0 + (R - x0) * t, r = Math.max(0.012, PIVOT_R + x);
    const tw = Math.min(THREE.MathUtils.degToRad(30), Math.atan(pitch / (2 * Math.PI * r)));
    const th = thick(t) * Math.max(tipRound, 0.3);
    const sweep = -0.0045 * Math.pow(t, 2.2);          // trailing-edge sweep toward the tip
    for (let side = 0; side < 2; side++) {
      for (let k = 0; k <= NC; k++) {
        const f = side === 0 ? k / NC : 1 - k / NC;       // 0 leading edge → 1 trailing edge
        const a = 0.38 * c - f * c + sweep * f;           // + toward the leading edge
        const tp = th * 2.6 * Math.sqrt(Math.max(f, 1e-4)) * (1 - f);
        const camber = c * 0.035 * Math.sin(Math.PI * f);
        const yl = (side === 0 ? 0.62 * tp : -0.38 * tp) + camber;
        const ah = a * Math.cos(tw) - yl * Math.sin(tw);   // pitch: leading edge up
        const y = a * Math.sin(tw) + yl * Math.cos(tw);
        verts.push(x, y, -spin * ah);
        uvs.push(t, side === 0 ? (k / NC) * 0.5 : 0.5 + (k / NC) * 0.5);
      }
    }
  }
  for (let s = 0; s < NS; s++) for (let j = 0; j < ring - 1; j++) {
    const a = s * ring + j, b = a + 1, c = a + ring, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  for (let j = 1; j < ring - 2; j++) idx.push(0, j + 1, j);   // close the root
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.attributes.normal, mid = Math.floor(NS / 2) * ring + Math.floor(NC / 2);
  if (n.getY(mid) < 0) {
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    g.index.needsUpdate = true; g.computeVertexNormals();
  }
  bakeAO(g, 0.1);
  return g;
}
