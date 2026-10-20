// v3 Maquette: the forest, four BC Interior conifers at true size for the model's 1:250 (ported from the v1
// table's forest, public/table/js/forest.js):
//   0 Douglas-fir        broad layered cone (the most common)
//   1 spruce / fir       a narrow dark spire (the cooler north-facing slopes)
//   2 lodgepole pine     a bare trunk and a short narrow crown
//   3 ponderosa pine     a bare trunk and an open rounded crown (the dry south-facing benches)
// Crowns are star-sectioned tiers (alternating long and short branch tips), so a stand reads as branchy rather
// than as smooth cones; a vertex shade darkens the inner, lower parts of each tier. Per tree: species, size, yaw,
// a slight lean and a tint, with stand-scale colour patches and a few beetle-killed red and grey snags.
// Placement is random over the forest density (stands clump and open up like real ones; no planted grid).
// The material is the plaster kit's, so the lens footprints and the SAMPLE heat drape over the crowns.
import { MODEL } from './terrain.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One star-sectioned tier: a rim of 2k points (long and short tips), the apex above. Unit tree height = 1. */
function tier(k, r, y0, y1, droop, seed) {
  const pos = [], col = [];
  const R = rng(seed);
  const rim = [];
  for (let i = 0; i < 2 * k; i++) {
    const a = (i / (2 * k)) * Math.PI * 2 + (R() - 0.5) * 0.2;
    const rr = r * (i % 2 ? 0.58 : 1) * (0.85 + R() * 0.3);
    rim.push([Math.cos(a) * rr, y0 - (i % 2 ? 0 : droop * r), Math.sin(a) * rr, i % 2 ? 0.5 : 1]);
  }
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i], b = rim[(i + 1) % rim.length];
    pos.push(0, y1, 0, b[0], b[1], b[2], a[0], a[1], a[2]);
    const sb = 0.55 + 0.35 * b[3], sa = 0.55 + 0.35 * a[3];
    col.push(1, 1, 1, sb, sb, sb, sa, sa, sa);
  }
  return { pos, col };
}
function trunk(r, h, sides = 4) {
  const pos = [], col = [];
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
    const x0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r, x1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
    const t = 0.55;
    pos.push(x0, 0, z0, x1 * t, h, z1 * t, x1, 0, z1, x0, 0, z0, x0 * t, h, z0 * t, x1 * t, h, z1 * t);
    for (let j = 0; j < 6; j++) col.push(0.5, 0.42, 0.36);
  }
  return { pos, col };
}
/** an irregular rounded crown mass (ponderosa) */
function blob(T, r, y, sy, seed, ox = 0, oz = 0) {
  const g = new T.IcosahedronGeometry(r, 0);
  const p = g.attributes.position, R = rng(seed), col = [];
  const jit = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!jit.has(key)) jit.set(key, 0.78 + R() * 0.4);
    const k = jit.get(key);
    const yy = p.getY(i);
    p.setXYZ(i, ox + p.getX(i) * k, y + yy * k * sy, oz + p.getZ(i) * k);
    const sh = 0.4 + 0.6 * Math.min(1, Math.max(0, (yy / r) * 0.5 + 0.5));
    col.push(sh, sh, sh);
  }
  const out = { pos: Array.from(p.array), col };
  g.dispose();
  return out;
}
function build(T, parts) {
  const pos = [], col = [];
  for (const p of parts) { pos.push(...p.pos); col.push(...p.col); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // the crown's own shade: dark low in the crown, bright at the top (a crown reads by its lit top)
  const cc = g.attributes.color, cp = g.attributes.position;
  for (let i = 0; i < cc.count; i++) {
    const k = 0.38 + 0.62 * Math.pow(Math.min(1, Math.max(0, cp.getY(i))), 0.8);
    cc.setXYZ(i, cc.getX(i) * k, cc.getY(i) * k, cc.getZ(i) * k);
  }
  // foliage normals: mostly a soft radial-and-up field (a crown lights like one mass of needles, not like
  // faceted cones), a little of the face normal kept for texture
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) {
    const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i), l = Math.hypot(x, z);
    const ox = l > 1e-4 ? x / l : 0, oz = l > 1e-4 ? z / l : 0;
    const nx = n.getX(i) * 0.2 + ox * 0.75, ny = n.getY(i) * 0.2 + 0.45 + 0.3 * y, nz = n.getZ(i) * 0.2 + oz * 0.75;
    const nl = Math.hypot(nx, ny, nz);
    n.setXYZ(i, nx / nl, ny / nl, nz / nl);
  }
  return g;
}

/** The four species: geometry (height 1, base at 0), crown width ratio, height range (m), tint (linear RGB). */
function species(T) {
  return [
    { name: 'douglas-fir', geo: build(T, [trunk(0.012, 0.2), tier(6, 0.2, 0.08, 0.42, 0.25, 1), tier(6, 0.165, 0.3, 0.64, 0.25, 2), tier(6, 0.12, 0.5, 0.84, 0.22, 3), tier(5, 0.07, 0.7, 1.0, 0.2, 4)]), h: [16, 30], w: 0.95, tint: [0.045, 0.085, 0.042] },
    { name: 'spruce', geo: build(T, [trunk(0.01, 0.15), tier(6, 0.13, 0.05, 0.4, 0.3, 5), tier(6, 0.105, 0.3, 0.66, 0.3, 6), tier(5, 0.075, 0.55, 0.86, 0.25, 7), tier(5, 0.042, 0.76, 1.0, 0.2, 8)]), h: [15, 28], w: 0.9, tint: [0.036, 0.075, 0.058] },
    { name: 'lodgepole', geo: build(T, [trunk(0.011, 0.42, 4), tier(6, 0.12, 0.3, 0.7, 0.18, 9), tier(5, 0.095, 0.5, 0.86, 0.15, 10), tier(5, 0.06, 0.72, 1.0, 0.12, 15)]), h: [16, 26], w: 1.0, tint: [0.06, 0.09, 0.04] },
    { name: 'ponderosa', geo: build(T, [trunk(0.014, 0.45, 4), blob(T, 0.11, 0.55, 0.9, 11, 0.05, 0.01), blob(T, 0.105, 0.64, 0.95, 12, -0.05, 0.035), blob(T, 0.1, 0.72, 0.9, 13, 0.0, -0.055), blob(T, 0.085, 0.85, 1.0, 14, 0.01, 0.0)]), h: [18, 32], w: 1.0, tint: [0.068, 0.095, 0.042] },
  ];
}

export function buildForest(T, zone, data, tex, material, { count = 22000 } = {}) {
  const { S, W, D, X0, Z0 } = MODEL;
  const [gx, gz] = tex.size;
  const G = W / (gx - 1);
  const dens = (x, z) => {
    const i = Math.round((x - X0) / G), j = Math.round((z - Z0) / G);
    if (i < 0 || j < 0 || i >= gx || j >= gz) return 0;
    return tex.forestData[j * gx + i] / 255;
  };
  // stand-scale noise: drier yellow-green stands, darker dense ones
  const patch = (x, z, f) => Math.sin(x * f + 1.7) * Math.sin(z * f * 1.3 - 0.6) * 0.6 + Math.sin((x + z) * f * 0.7 + 2.2) * 0.4;
  const V = species(T);
  const R = rng(4242);
  const lists = V.map(() => []);
  const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s = new T.Vector3(), p = new T.Vector3();
  const col = new T.Color();
  let n = 0, tries = 0;
  while (n < count && tries < count * 14) {
    tries++;
    const x = X0 + R() * W, z = Z0 + R() * D;
    const f = dens(x, z);
    if (R() > f) continue;
    // keep 6 m in from the cut edges, so no crown overhangs the model's side
    if (x < X0 + 6 || x > X0 + W - 6 || z < Z0 + 6 || z > Z0 + D - 6) continue;
    // the SAMPLE hotspot is a smouldering stump in a small gap in the canopy (as in the report's imagery)
    if (Math.hypot(x - zone.hotspot.x, z - zone.hotspot.z) < 13 + 5 * R()) continue;
    // species by aspect: ponderosa on the dry south-facing benches, spruce on the cooler north-facing side
    const nz = (data.top(x, z + 6) - data.top(x, z - 6)) / 12;       // > 0: the ground falls to the north
    const dry = nz < -0.08 ? 1 : 0;
    const w = [0.46, dry ? 0.08 : nz > 0.08 ? 0.42 : 0.3, 0.24, dry ? 0.16 : 0.03];
    let pick = R() * (w[0] + w[1] + w[2] + w[3]), vi = 0;
    for (; vi < 3; vi++) { if (pick < w[vi]) break; pick -= w[vi]; }
    const v = V[vi];
    // young regrowth in the cut blocks (low density) stands at half height or less
    const h = (v.h[0] + (v.h[1] - v.h[0]) * Math.pow(R(), 0.8) * (0.8 + 0.25 * f)) * (f < 0.45 ? 0.35 + f : 1);
    const wid = h * v.w * (0.85 + R() * 0.3) * (1 + 0.3 * f);     // fuller crowns in the closed stands
    e.set((R() - 0.5) * 0.06, R() * Math.PI * 2, (R() - 0.5) * 0.06);
    q.setFromEuler(e);
    m.compose(p.set(x * S, (data.top(x, z) - 0.6) * S, z * S), q, s.set(wid * S, h * S, wid * S));
    const k = 0.72 + R() * 0.5;
    let [r, g, b] = v.tint;
    const pv = patch(x, z, 1 / 150), pw = patch(x + 300, z - 200, 1 / 60);
    r *= 1 + 0.35 * pv + 0.15 * pw; g *= 1 + 0.18 * pv + 0.1 * pw; b *= 1 - 0.1 * pv;
    const u = R();
    // a few beetle-killed pines, a dull rust (never as bright as the SAMPLE heat), and grey snags
    if (vi === 2 && u < 0.05) { r = 0.075; g = 0.05; b = 0.032; }
    else if (vi === 2 && u < 0.11) { r = 0.085; g = 0.08; b = 0.072; }
    col.setRGB(r * k, g * k, b * k, T.LinearSRGBColorSpace);
    lists[vi].push([m.clone(), col.clone()]);
    n++;
  }
  const group = new T.Group();
  group.name = 'forest';
  const meshes = V.map((v, i) => {
    const L = lists[i];
    const im = new T.InstancedMesh(v.geo, material, Math.max(1, L.length));
    L.forEach(([mm, cc], j) => { im.setMatrixAt(j, mm); im.setColorAt(j, cc); });
    im.count = L.length;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.name = `forest-${v.name}`;
    im.castShadow = true;
    im.receiveShadow = true;
    group.add(im);
    return im;
  });
  return {
    group,
    count: n,
    dispose() { meshes.forEach((im) => { im.geometry.dispose(); im.dispose(); }); },
  };
}
