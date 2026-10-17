// Command Table: the forest. Four BC Interior conifers as instanced meshes (one draw each), placed
// from the terrain's forest density and kept off the water, the roads and their verges, the line
// corridor, the pads and the dam:
//   0 Douglas-fir        broad layered cone (the most common)
//   1 spruce / fir       a narrow dark spire
//   2 lodgepole pine     a bare trunk and a short narrow crown
//   3 ponderosa pine     a bare trunk and an open rounded crown (the dry benches)
// Crowns are star-sectioned tiers (alternating long and short branch tips), which read as branchy
// rather than as smooth cones; a vertex shade darkens the inner, lower parts of each tier. Per tree:
// size, yaw, a slight lean and a tint (a few beetle-killed red or grey pines among the lodgepoles).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ZONE } from './zone.js';
import { SLAB, LEVELS, DAM, polySD, inDamFootprint, clamp } from './layout.js';
import { TERRAIN, groundAt, sampleGrid, maskAt, riverSD, riverShape, fbm } from './terrain.js';
import { patchMaterial } from './shading.js';

export const FOREST_COUNTS = { lite: 12000, balanced: 24000, high: 38000 };

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** One star-sectioned tier: rim of 2k points (long and short tips), apex above. Unit tree height = 1. */
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
    // apex, b, a (counter-clockwise from outside)
    pos.push(0, y1, 0, b[0], b[1], b[2], a[0], a[1], a[2]);
    col.push(1, 1, 1, 0.55 + 0.35 * b[3], 0.55 + 0.35 * b[3], 0.55 + 0.35 * b[3], 0.55 + 0.35 * a[3], 0.55 + 0.35 * a[3], 0.55 + 0.35 * a[3]);
  }
  return { pos, col };
}
function trunk(r, h, sides = 4) {
  const pos = [], col = [];
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
    const x0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r, x1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
    const t = 0.55;   // tapered top
    pos.push(x0, 0, z0, x1 * t, h, z1 * t, x1, 0, z1, x0, 0, z0, x0 * t, h, z0 * t, x1 * t, h, z1 * t);
    for (let j = 0; j < 6; j++) col.push(0.5, 0.42, 0.36);
  }
  return { pos, col };
}
function blob(r, y, sy, seed, ox = 0, oz = 0) {
  // an irregular rounded crown mass (ponderosa)
  const g = new THREE.IcosahedronGeometry(r, 0);                 // (already non-indexed)
  const p = g.attributes.position, R = rng(seed), col = [];
  const jit = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!jit.has(key)) jit.set(key, 0.78 + R() * 0.4);
    const k = jit.get(key);
    const yy = p.getY(i);
    p.setXYZ(i, ox + p.getX(i) * k, y + yy * k * sy, oz + p.getZ(i) * k);
    const sh = 0.4 + 0.6 * clamp((yy / r) * 0.5 + 0.5, 0, 1);
    col.push(sh, sh, sh);
  }
  return { pos: Array.from(p.array), col };
}
function build(parts) {
  const pos = [], col = [];
  for (const p of parts) { pos.push(...p.pos); col.push(...p.col); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // the crown's own shade: dark low in the crown, bright at the top (a crown reads by its lit top)
  const cc = g.attributes.color, cp = g.attributes.position;
  for (let i = 0; i < cc.count; i++) { const k = 0.38 + 0.62 * Math.pow(clamp(cp.getY(i), 0, 1), 0.8); cc.setXYZ(i, cc.getX(i) * k, cc.getY(i) * k, cc.getZ(i) * k); }
  // foliage normals: mostly a soft radial-and-up field (a crown lights like one mass of needles, not
  // like faceted cones), a little of the face normal kept for texture
  const n = g.attributes.normal, pp = g.attributes.position;
  for (let i = 0; i < n.count; i++) {
    const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i), l = Math.hypot(x, z);
    const ox = l > 1e-4 ? x / l : 0, oz = l > 1e-4 ? z / l : 0;
    const nx = n.getX(i) * 0.2 + ox * 0.75, ny = n.getY(i) * 0.2 + 0.45 + 0.3 * y, nz = n.getZ(i) * 0.2 + oz * 0.75;
    const nl = Math.hypot(nx, ny, nz); n.setXYZ(i, nx / nl, ny / nl, nz / nl);
  }
  return g;
}

/** The four species: geometry (height 1, base at 0), crown radius ratio, size range (m), weight. */
function species() {
  return [
    { name: 'douglas-fir', geo: build([trunk(0.012, 0.2), tier(6, 0.2, 0.08, 0.42, 0.25, 1), tier(6, 0.165, 0.3, 0.64, 0.25, 2), tier(6, 0.12, 0.5, 0.84, 0.22, 3), tier(5, 0.07, 0.7, 1.0, 0.2, 4)]), h: [16, 30], w: 0.95, tint: [0.045, 0.085, 0.042] },
    { name: 'spruce', geo: build([trunk(0.01, 0.15), tier(6, 0.13, 0.05, 0.4, 0.3, 5), tier(6, 0.105, 0.3, 0.66, 0.3, 6), tier(5, 0.075, 0.55, 0.86, 0.25, 7), tier(5, 0.042, 0.76, 1.0, 0.2, 8)]), h: [15, 28], w: 0.9, tint: [0.036, 0.075, 0.058] },
    { name: 'lodgepole', geo: build([trunk(0.011, 0.42, 4), tier(6, 0.12, 0.3, 0.7, 0.18, 9), tier(5, 0.095, 0.5, 0.86, 0.15, 10), tier(5, 0.06, 0.72, 1.0, 0.12, 15)]), h: [16, 26], w: 1.0, tint: [0.06, 0.09, 0.04] },
    { name: 'ponderosa', geo: build([trunk(0.014, 0.45, 4), blob(0.11, 0.55, 0.9, 11, 0.05, 0.01), blob(0.105, 0.64, 0.95, 12, -0.05, 0.035), blob(0.1, 0.72, 0.9, 13, 0.0, -0.055), blob(0.085, 0.85, 1.0, 14, 0.01, 0.0)]), h: [18, 32], w: 1.0, tint: [0.068, 0.095, 0.042] },
  ];
}

export class Forest {
  /**
   * @param {object} Q quality tier
   * @param {object} keepOut extra no-tree tests: (x, z, r) => boolean
   */
  constructor(Q, keepOut = () => false) {
    const target = FOREST_COUNTS[Q.tier] || FOREST_COUNTS.balanced;
    const V = species();
    const R = rng(4242);
    const lists = V.map(() => []);
    const sd = [0, 0];
    this.trees = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    let tries = 0;
    while (this.trees.length < target && tries < target * 14) {
      tries++;
      const x = SLAB.x0 + R() * SLAB.w, z = SLAB.z0 + R() * SLAB.d;
      const f = sampleGrid(TERRAIN.forest, x, z);
      if (R() > f) continue;
      // keep 7 m in from the cut edges (no crown hangs over the cut)
      if (x < SLAB.x0 + 7 || x > SLAB.x1 - 7 || z < SLAB.z0 + 7 || z > SLAB.z1 - 7) continue;
      if (maskAt(1, x, z) > 0.25 || maskAt(0, x, z) > 0.05) continue;     // cleared ground, gravel
      if (polySD(ZONE.reservoir, x, z) < 4) continue;
      riverSD(x, z, sd);
      if (sd[0] > DAM.sRiver) { const r = riverShape(sd[0]), dd = sd[1] - r.m; if (dd > -(r.hwN + 18 * r.bar + 5) && dd < r.hwS + 5) continue; }
      if (inDamFootprint(x, z, 30)) continue;
      if (keepOut(x, z, 6)) continue;
      const g = groundAt(x, z);
      if (g < LEVELS.reservoir + 1.5 && polySD(ZONE.reservoir, x, z) < 14) continue;
      // species: ponderosa on the dry open ground, spruce on the cooler north-facing side, lodgepole in between
      riverSD(x, z, sd);
      const dry = sd[1] < 0 ? 1 : 0;            // north bank faces south: dry
      const w = [0.46, dry ? 0.08 : 0.3, 0.22, dry ? 0.32 : 0.06];
      let pick = R() * (w[0] + w[1] + w[2] + w[3]), vi = 0;
      for (; vi < 3; vi++) { if (pick < w[vi]) break; pick -= w[vi]; }
      const v = V[vi];
      const h = v.h[0] + (v.h[1] - v.h[0]) * Math.pow(R(), 0.8) * (0.8 + 0.25 * f);
      const wid = h * v.w * (0.85 + R() * 0.3) * (1 + 0.3 * f);     // fuller crowns in the closed stands
      e.set((R() - 0.5) * 0.06, R() * Math.PI * 2, (R() - 0.5) * 0.06);
      q.setFromEuler(e);
      m.compose(p.set(x, g - 0.6, z), q, s.set(wid, h, wid));
      const k = 0.72 + R() * 0.5;
      let [r, gg, b] = v.tint;
      // stand-scale variation: drier yellow-green stands, darker dense ones, a bluer cast in the gullies
      const pv = fbm(x / 150 + 2.1, z / 150 - 6.3, 3), pw = fbm(x / 60 - 4.4, z / 60 + 1.9, 2);
      r *= 1 + 0.35 * pv + 0.15 * pw; gg *= 1 + 0.18 * pv + 0.1 * pw; b *= 1 - 0.1 * pv;
      const u = R();
      if (vi === 2 && u < 0.09) { r = 0.16; gg = 0.075; b = 0.036; }            // beetle-killed red
      else if (vi === 2 && u < 0.16) { r = 0.11; gg = 0.1; b = 0.09; }     // grey snag
      col.setRGB(r * k, gg * k, b * k, THREE.LinearSRGBColorSpace);
      lists[vi].push({ m: m.clone(), c: col.clone() });
      this.trees.push({ x, z, g, h, r: wid * 0.2, sp: vi });
    }
    this.material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 0.25, name: 'table-conifer' });
    patchMaterial(this.material, {
      key: 'conifer',
      // needles are matte: almost no specular (it sparkled on every crown tip against the low sun), and a
      // wrapped diffuse so the lit side of a crown is a soft warm cap rather than a bright facet
      lightsEnd: 'reflectedLight.directSpecular *= 0.12; reflectedLight.indirectSpecular *= 0.35;',
      vertBegin: 'transformed *= 1.0 - 0.995 * uMap;',             // map mode: the trees step out of the way (the hillshade carries the land)
      color: 'diffuseColor.rgb *= 1.0 - 0.9 * uMap;',
    });
    this.meshes = V.map((v, i) => {
      const L = lists[i];
      const im = new THREE.InstancedMesh(v.geo, this.material, Math.max(1, L.length));
      L.forEach((t, j) => { im.setMatrixAt(j, t.m); im.setColorAt(j, t.c); });
      im.count = L.length;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere(); im.computeBoundingBox();
      im.name = `table:trees-${v.name}`;
      im.userData.thermal = 'forest';
      // cast into the shadow map (their shadows on the ground), but not receive: crowns already take the
      // baked terrain shadows, and shadow-map lookups on every crown fragment cost more than they show
      im.castShadow = Q.shadows; im.receiveShadow = false;
      return im;
    });
    this.group = new THREE.Group();
    this.group.name = 'table:forest';
    for (const im of this.meshes) this.group.add(im);
  }

  dispose() {
    for (const im of this.meshes) { im.geometry.dispose(); im.dispose(); }
    this.material.dispose();
  }
}
