// Command Table: the M3T on the table. The real model comes from the M3T build (/table/js/m3t/model.js,
// buildM3T({ detail: 'table' }) → { group, setFold, setGimbalPitch, setProps, anchors, dispose }), loaded
// only when /table/assets.json lists it (no 404 probes); a proxy with the same API stands in otherwise.
// The M3T build's semantics: setFold(t) 0 folded .. 1 unfolded; setGimbalPitch(rad) 0 level, negative down;
// setProps(angle, blur) rotor angle (rad), blur 0 crisp .. 1 spinning. Metres, Y up, +Z nose, feet at y = 0.
// At table scale the aircraft is sub-pixel: a strobe glow (min pixel size) marks it in the main view; the
// picture-in-picture shows the model itself.
import * as THREE from 'three';
import { ZONE } from './zone.js';
import { densify, pointAt } from './layout.js';
import { groundAt } from './terrain.js';
import { Glow } from './lines.js';

/** A stand-in M3T with the real API (proportions from DJI's published dimensions: 347.5 × 283 × 107.7 mm unfolded). */
export function buildProxyM3T() {
  const g = new THREE.Group(); g.name = 'm3t-proxy';
  const dark = new THREE.MeshStandardMaterial({ color: 0x34373a, roughness: 0.45, metalness: 0.3, name: 'm3t-proxy-body' });
  const black = new THREE.MeshStandardMaterial({ color: 0x0c0d0e, roughness: 0.3, metalness: 0.4, name: 'm3t-proxy-black' });
  const glass = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.05, metalness: 0.9, name: 'm3t-proxy-glass' });
  const prop = new THREE.MeshBasicMaterial({ color: 0x1a1b1c, transparent: true, opacity: 0.35, depthWrite: false, name: 'm3t-proxy-prop' });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.07, 0.2), dark); body.position.y = 0.05; g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.12), dark); top.position.set(0, 0.095, -0.01); g.add(top);
  const arms = [], motors = [], props = [];
  const ARM = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (const [sx, sz] of ARM) {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.04, 0.05, sz * 0.06);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.016, 0.13), dark); arm.position.z = 0.065; pivot.add(arm);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.025, 12), black); motor.position.set(0, 0.012, 0.125); pivot.add(motor);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.115, 24).rotateX(-Math.PI / 2), prop); disc.position.set(0, 0.03, 0.125); pivot.add(disc);
    pivot.userData.base = Math.atan2(sx * 0.9, sz * 1.0);   // unfolded: arms splay out from the body
    pivot.userData.sx = sx; pivot.userData.sz = sz;
    g.add(pivot); arms.push(pivot); motors.push(motor); props.push(disc);
  }
  const gimbal = new THREE.Group(); gimbal.position.set(0, 0.03, 0.11); g.add(gimbal);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.035), black); gimbal.add(head);
  for (const [x, r] of [[-0.013, 0.006], [0.0, 0.006], [0.015, 0.009]]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.006, 14).rotateX(Math.PI / 2), glass); l.position.set(x, 0, 0.019); gimbal.add(l);
  }
  const api = {
    group: g,
    anchors: { gimbal },
    setFold(t) {
      for (const p of arms) {
        const folded = p.userData.sz > 0 ? 0 : Math.PI;            // folded: arms along the body
        p.rotation.y = THREE.MathUtils.lerp(folded + p.userData.sx * 0.08, p.userData.base, t);
      }
    },
    setGimbalPitch(rad) { gimbal.rotation.x = -rad; },
    setProps(angle, blur = 0) { for (const d of props) d.visible = blur > 0.05; prop.opacity = 0.18 + 0.25 * Math.min(1, blur); },
    dispose() { g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); [dark, black, glass, prop].forEach((m) => m.dispose()); },
  };
  api.setFold(0); api.setProps(0, 0);
  g.traverse((o) => { if (o.isMesh) o.userData.thermal = 'steel'; });
  return api;
}

/** The flight: lift off the truck bed, climb along ZONE.flight to 120 m above the ground over the hotspot slope. */
export class Flight {
  constructor(bedTop) {
    this.bed = bedTop.clone();
    this.L = densify(ZONE.flight, 6);
    const n = this.L.n;
    // ground under the path, smoothed by a running max (the aircraft does not dip into every gully)
    const g = new Float32Array(n);
    for (let i = 0; i < n; i++) g[i] = groundAt(this.L.x[i], this.L.z[i]);
    const gm = new Float32Array(n);
    for (let i = 0; i < n; i++) { let m = -1e9; for (let j = Math.max(0, i - 8); j <= Math.min(n - 1, i + 8); j++) m = Math.max(m, g[j]); gm[i] = m; }
    this.alt = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = this.L.s[i] / this.L.length;
      const agl = 28 + 92 * (1 - Math.pow(1 - t, 2.6));          // ≤ 120 m AGL (the Canadian RPAS ceiling is 122 m)
      this.alt[i] = Math.min(Math.max(gm[i] + agl, this.bed.y + 28 * Math.min(1, t * 8), g[i] + 25), g[i] + 120);   // 25..120 m above the ground below
    }
    this.points = [];
    for (let i = 0; i < n; i++) this.points.push(new THREE.Vector3(this.L.x[i], this.alt[i], this.L.z[i]));
    // the climb out of the bed: straight up first
    this.points[0] = new THREE.Vector3(this.bed.x, this.bed.y + 28, this.bed.z);
    this.end = this.points[n - 1].clone();
  }

  /** Position and heading at flight progress f (0 = 28 m over the bed, 1 = the observation hover). */
  at(f, out = new THREE.Vector3()) {
    const s = THREE.MathUtils.clamp(f, 0, 1) * this.L.length;
    const P = pointAt(this.L, s);
    let i = 0; while (i < this.L.n - 2 && this.L.s[i + 1] < s) i++;
    const k = (s - this.L.s[i]) / Math.max(1e-6, this.L.s[i + 1] - this.L.s[i]);
    const y = f <= 0 ? this.bed.y + 28 : this.alt[i] + (this.alt[i + 1] - this.alt[i]) * k;
    out.set(f <= 0 ? this.bed.x : P.x, y, f <= 0 ? this.bed.z : P.z);
    return { pos: out, heading: Math.atan2(P.tx, P.tz) };
  }
}

export class Drone {
  constructor() {
    this.root = new THREE.Group(); this.root.name = 'table:m3t';
    this.model = buildProxyM3T();
    this.root.add(this.model.group);
    this.strobe = new Glow(new THREE.Color(1.0, 0.97, 0.9).multiplyScalar(4), { size: 0.5, minPx: 2.6 });
    this.strobe.points.name = 'table:m3t-strobe';
    this.real = false;
  }

  /** Swap in the real M3T if /table/assets.json lists it. */
  async load(assets) {
    if (!assets || !assets.m3t) return false;
    try {
      const mod = await import(new URL('../' + assets.m3t, import.meta.url).href);
      if (typeof mod.buildM3T !== 'function') return false;
      const m = mod.buildM3T({ detail: 'table' });
      if (!m || !m.group) return false;
      this.root.remove(this.model.group); this.model.dispose?.();
      this.model = m; this.root.add(m.group); this.real = true;
      m.group.traverse((o) => { if (o.isMesh && !o.userData.thermal) o.userData.thermal = 'steel'; });
      return true;
    } catch (e) { return false; }
  }

  set({ pos, heading = 0, pitch = 0, fold = 0, props = 1, gimbal = -30, visible = true, strobe = 1, time = 0 }) {
    this.spin = (time * 37) % (Math.PI * 2);
    this.root.visible = visible;
    this.strobe.set(visible ? strobe : 0);
    if (!visible) return;
    this.root.position.copy(pos);
    this.root.rotation.set(0, heading, 0);
    this.root.rotateX(pitch);
    const m = this.model;
    // (story values: fold 1 = folded, props 0..1 speed, gimbal in degrees → the M3T build's API)
    try { m.setFold?.(1 - fold); m.setProps?.(props * this.spin, props); m.setGimbalPitch?.(THREE.MathUtils.degToRad(gimbal)); } catch (e) { /* model API mismatch: keep going */ }
    this.strobe.setAt(0, new THREE.Vector3(pos.x, pos.y + 0.12, pos.z));
  }

  dispose() { this.model.dispose?.(); this.strobe.dispose(); }
}
