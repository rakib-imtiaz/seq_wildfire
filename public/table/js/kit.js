// Command Table: small geometry helpers shared by the prop builders. Parts collects geometries per
// material key and merges each key into one geometry (one draw call per material per prop).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion();

export class Parts {
  constructor() { this.map = new Map(); }
  add(key, geo) {
    if (!this.map.has(key)) this.map.set(key, []);
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    if (!g.attributes.normal) g.computeVertexNormals();
    this.map.get(key).push(g);
    return g;
  }
  /** Two triangles a b c d (quad, in order), oriented so the face normal agrees with `out`. */
  quad(key, a, b, c, d, out) {
    const p = [a, b, c, a, c, d];
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (out && n.dot(out) < 0) { p[1] = c; p[2] = b; p[4] = d; p[5] = c; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p.flatMap((v) => [v.x, v.y, v.z]), 3));
    g.computeVertexNormals();
    this.add(key, g);
  }
  /** An axis box (w × h × d) centred at (x, y, z), turned ry about y. */
  box(key, w, h, d, x, y, z, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    return this.add(key, g);
  }
  /** A square-section member from a to b (thickness t), e.g. a lattice angle or a brace. */
  member(key, a, b, t, m = null) {
    _a.copy(a); _b.copy(b);
    if (m) { _a.applyMatrix4(m); _b.applyMatrix4(m); }
    const len = _a.distanceTo(_b);
    if (len < 1e-4) return null;
    const g = new THREE.BoxGeometry(t, len, t);
    _q.setFromUnitVectors(_y, _b.clone().sub(_a).normalize());
    g.applyQuaternion(_q);
    g.translate((_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2);
    return this.add(key, g);
  }
  /** A cylinder from a to b (radius r, radial segments n). */
  rod(key, a, b, r, n = 8, m = null) {
    _a.copy(a); _b.copy(b);
    if (m) { _a.applyMatrix4(m); _b.applyMatrix4(m); }
    const len = _a.distanceTo(_b);
    if (len < 1e-4) return null;
    const g = new THREE.CylinderGeometry(r, r, len, n);
    _q.setFromUnitVectors(_y, _b.clone().sub(_a).normalize());
    g.applyQuaternion(_q);
    g.translate((_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2);
    return this.add(key, g);
  }
  geo(key) { const L = this.map.get(key); return L && L.length ? mergeGeometries(L) : null; }
  keys() { return [...this.map.keys()]; }
  /** One mesh per material key into `group`. */
  build(group, materials, { shadows = false, thermal = {}, name = 'part' } = {}) {
    for (const key of this.keys()) {
      const mat = materials[key];
      if (!mat) { console.warn('[table] no material for', key); continue; }
      const g = this.geo(key);
      if (!g) continue;
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.name = `table:${name}-${key}`;
      if (thermal[key]) m.userData.thermal = thermal[key];
      m.castShadow = shadows; m.receiveShadow = shadows;
      group.add(m);
    }
    return group;
  }
}

/**
 * Catenary between two 3D points: n+1 points, sag parameter a (m; larger = tighter). Exact: the
 * lowest point is placed so the curve passes through both ends at their own heights.
 */
export function catenary(A, B, a = 900, n = 24) {
  const dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz), h = B.y - A.y;
  const x0 = L / 2 - a * Math.asinh(h / (2 * a * Math.sinh(L / (2 * a))));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const x = (L * i) / n;
    const y = A.y + a * (Math.cosh((x - x0) / a) - Math.cosh(x0 / a));
    out.push(new THREE.Vector3(A.x + (dx * i) / n, y, A.z + (dz * i) / n));
  }
  return out;
}
