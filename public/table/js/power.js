// Command Table: the electrical works.
//   towers      230 kV single-circuit lattice suspension towers at ZONE.towers: a tapered square body
//               with X-bracing, leg extensions to the ground at each corner (concrete footings), a
//               V-waist window, a triangular-truss cross-arm, three I-string insulators and two
//               ground-wire peaks. The cross-arm bisects the line's angle at each tower.
//   wires       exact catenaries (kit.catenary) from the switchyard's dead-end gantry, over the five
//               towers, to the substation's gantry: three phases + two ground wires; and a short
//               steep span from the powerhouse yard up to the switchyard. 1 px lines (wires are
//               thinner than a pixel at table scale; a line stays a crisp, steady 1 px).
//   switchyard  gantries, breakers and bus on its bench, fenced
//   substation  a fenced gravel pad: chain-link with barbed wire, the incoming gantry, tubular bus
//               on post insulators, breakers, two power transformers with radiators and conservators
//               behind a firewall, and a control building
import * as THREE from 'three';
import { ZONE } from './zone.js';
import { DAM } from './layout.js';
import { groundAt, PADS } from './terrain.js';
import { Parts, catenary } from './kit.js';
import { patchMaterial } from './shading.js';

const T = { waistY: 20, armY: 27, topY: 28.6, peakY: 34, armHalf: 10.5, phase: [-8, 0, 8], insul: 2.7, gwX: 4.5, base: 4.0, waist: 1.3, depth: 0.9 };
const LEG = 0.55, BR = 0.32;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** A frame: world matrix at (x, y, z) with local +z along `dir` (xz unit vector). */
function frame(x, y, z, dir) {
  const m = new THREE.Matrix4();
  const zA = v3(dir[0], 0, dir[1]).normalize(), yA = v3(0, 1, 0), xA = new THREE.Vector3().crossVectors(yA, zA);
  m.makeBasis(xA, yA, zA).setPosition(x, y, z);
  return m;
}

/** One lattice suspension tower into parts; returns its attachment points (world). */
function tower(P, x, z, dir) {
  const gy = groundAt(x, z);
  const m = frame(x, gy, z, dir);
  const inv = m.clone().invert();
  const { base: b, waist: w, waistY: WY } = T;
  const half = (y) => b + (w - b) * (y / WY);
  // leg feet: each corner on its own ground (leg extensions on a slope)
  const feet = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const wp = v3(sx * b, 0, sz * b).applyMatrix4(m);
    const ly = groundAt(wp.x, wp.z) - gy;
    feet.push(v3(sx * half(ly), ly, sz * half(ly)));
    // concrete footing
    const f = v3(sx * half(ly), ly + 0.1, sz * half(ly)).applyMatrix4(m);
    P.box('footing', 1.3, 1.0, 1.3, f.x, f.y, f.z);
  }
  const lowest = Math.max(...feet.map((f) => f.y));
  const levels = [lowest + 3.5, 8, 13, 17, WY].filter((y, i, a) => y >= lowest + 2 && (i === 0 || y > a[0] + 2));
  const corner = (y, sx, sz) => v3(sx * half(y), y, sz * half(y));
  const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  // legs
  C.forEach(([sx, sz], k) => P.member('steel', feet[k], corner(WY, sx, sz), LEG, m));
  // rings and X-bracing on the four faces
  const ringYs = [null, ...levels];
  for (let i = 0; i < levels.length; i++) {
    const y = levels[i];
    for (let k = 0; k < 4; k++) P.member('steel', corner(y, ...C[k]), corner(y, ...C[(k + 1) % 4]), BR, m);
    for (let k = 0; k < 4; k++) {
      const k1 = (k + 1) % 4;
      const lowA = i === 0 ? feet[k] : corner(ringYs[i], ...C[k]);
      const lowB = i === 0 ? feet[k1] : corner(ringYs[i], ...C[k1]);
      P.member('steel', lowA, corner(y, ...C[k1]), BR * 0.85, m);
      P.member('steel', lowB, corner(y, ...C[k]), BR * 0.85, m);
    }
  }
  // the V-waist: two legs up from each waist corner to the cross-arm, a window in the middle
  const D = T.depth;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wc = corner(WY, sx, sz);
      P.member('steel', wc, v3(sx * 5.4, T.armY, sz * D), LEG * 0.85, m);
      P.member('steel', wc, v3(sx * 3.6, T.armY, sz * D), LEG * 0.75, m);
      P.member('steel', v3(sx * 2.4, 23.5, sz * (D + 0.25)), v3(sx * 4.6, 23.5, sz * (D + 0.25)), BR, m);
      P.member('steel', v3(sx * 2.4, 23.5, sz * (D + 0.25)), v3(sx * 5.4, T.armY, sz * D), BR * 0.8, m);
    }
    P.member('steel', v3(sx * 2.4, 23.5, -D - 0.25), v3(sx * 2.4, 23.5, D + 0.25), BR * 0.8, m);
  }
  // the cross-arm: a triangular truss (two bottom chords, one top chord), laced
  const A = T.armHalf;
  for (const sz of [-1, 1]) P.member('steel', v3(-A, T.armY, sz * D), v3(A, T.armY, sz * D), LEG * 0.8, m);
  P.member('steel', v3(-A + 1.5, T.topY, 0), v3(A - 1.5, T.topY, 0), LEG * 0.8, m);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.member('steel', v3(sx * (A - 1.5), T.topY, 0), v3(sx * A, T.armY, sz * D), BR, m);
  for (let xx = -A + 1.5, k = 0; xx < A - 1.4; xx += 1.5, k++) {
    for (const sz of [-1, 1]) P.member('steel', v3(xx, T.topY, 0), v3(xx + 1.5 * (k % 2 ? -1 : 1) * 0.5 + 0.75, T.armY, sz * D), BR * 0.7, m);
    P.member('steel', v3(xx, T.armY, -D), v3(xx + 1.5, T.armY, D), BR * 0.6, m);
  }
  // the ground-wire peaks
  const gw = [];
  for (const sx of [-1, 1]) {
    const peak = v3(sx * T.gwX, T.peakY, 0);
    P.member('steel', v3(sx * (T.gwX - 1.2), T.topY, 0), peak, LEG * 0.7, m);
    P.member('steel', v3(sx * (T.gwX + 1.2), T.topY, 0), peak, LEG * 0.7, m);
    for (const sz of [-1, 1]) P.member('steel', v3(sx * T.gwX, T.topY, sz * D), peak, BR * 0.8, m);
    P.member('steel', v3(sx * (T.gwX - 0.8), 31, 0), v3(sx * (T.gwX + 0.8), 31, 0), BR * 0.7, m);
    gw.push(v3(sx * T.gwX, T.peakY + 0.1, 0).applyMatrix4(m));
  }
  // insulator strings (I-strings) with a yoke at the bottom
  const att = [];
  for (const px of T.phase) {
    P.rod('insulator', v3(px, T.armY - 0.2, 0), v3(px, T.armY - T.insul, 0), 0.24, 8, m);
    P.box('steel', 0.7, 0.18, 0.18, ...v3(px, T.armY - T.insul - 0.1, 0).applyMatrix4(m).toArray());
    att.push(v3(px, T.armY - T.insul - 0.2, 0).applyMatrix4(m));
  }
  void inv;
  return { att, gw, m, base: v3(x, gy, z) };
}

/** A dead-end gantry (two lattice columns and a beam). Its frame's +z is the line's direction of travel
 *  (so phases keep their side along the whole line); strain insulators point along `facing` × dir. */
function gantry(P, x, y, z, dir, { span = 9, h = 14, phases = [-6, 0, 6], facing = 1 } = {}) {
  const m = frame(x, y, z, dir);
  for (const sx of [-1, 1]) {
    const cx = sx * span;
    const c = [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]];
    c.forEach(([a, b2], k) => P.member('steel', v3(cx + a, 0, b2), v3(cx + a * 0.7, h + 2.5, b2 * 0.7), 0.3, m));
    for (let yy = 2; yy < h + 2; yy += 2.5) {
      for (let k = 0; k < 4; k++) { const [a, b2] = c[k], [a2, b3] = c[(k + 1) % 4]; P.member('steel', v3(cx + a, yy, b2), v3(cx + a2, yy + 2.5, b3), 0.16, m); }
    }
    P.box('footing', 2, 0.8, 2, ...v3(cx, 0.1, 0).applyMatrix4(m).toArray());
  }
  // the beam: a box truss across the top
  for (const sz of [-0.6, 0.6]) for (const yy of [h - 0.6, h + 0.6]) P.member('steel', v3(-span, yy, sz), v3(span, yy, sz), 0.28, m);
  for (let xx = -span; xx < span - 0.1; xx += 1.5) for (const sz of [-0.6, 0.6]) P.member('steel', v3(xx, h - 0.6, sz), v3(xx + 1.5, h + 0.6, sz), 0.14, m);
  const att = [];
  for (const px of phases) {
    P.rod('insulator', v3(px, h - 0.6, 0.6 * facing), v3(px, h - 0.9, 3.2 * facing), 0.2, 8, m);
    att.push(v3(px, h - 0.9, 3.3 * facing).applyMatrix4(m));
  }
  const gw = [v3(-span, h + 2.6, 0).applyMatrix4(m), v3(span, h + 2.6, 0).applyMatrix4(m)];
  return { att, gw, m };
}

/** A rectangular chain-link fence with barbed wire on outrigger arms. Returns wire segments. */
function fence(P, cx, y, cz, rot, w, d, wires) {
  const m = new THREE.Matrix4().makeRotationY(-rot).setPosition(cx, y, cz);
  const corners = [v3(-w / 2, 0, -d / 2), v3(w / 2, 0, -d / 2), v3(w / 2, 0, d / 2), v3(-w / 2, 0, d / 2)];
  const H = 2.4;
  for (let k = 0; k < 4; k++) {
    const a = corners[k], b = corners[(k + 1) % 4], L = a.distanceTo(b), n = Math.ceil(L / 3);
    const out = v3(b.z - a.z, 0, a.x - b.x).normalize();   // outward (corners run clockwise seen from above)
    for (let i = 0; i <= n; i++) {
      const p = a.clone().lerp(b, i / n).applyMatrix4(m);
      const gy = groundAt(p.x, p.z);
      P.box('steel', 0.12, H + 0.4, 0.12, p.x, gy + (H + 0.4) / 2 - 0.2, p.z);
    }
    // fabric: one quad per side, following the ground at the ends
    const pa = a.clone().applyMatrix4(m), pb = b.clone().applyMatrix4(m);
    const ga = groundAt(pa.x, pa.z), gb = groundAt(pb.x, pb.z);
    const segs = Math.ceil(L / 6);
    for (let i = 0; i < segs; i++) {
      const p0 = pa.clone().lerp(pb, i / segs), p1 = pa.clone().lerp(pb, (i + 1) / segs);
      const g0 = groundAt(p0.x, p0.z), g1 = groundAt(p1.x, p1.z);
      P.quad('fabric', v3(p0.x, g0 + 0.05, p0.z), v3(p1.x, g1 + 0.05, p1.z), v3(p1.x, g1 + H, p1.z), v3(p0.x, g0 + H, p0.z), null);
    }
    // three strands of barbed wire on the outriggers
    const ow = out.clone().applyMatrix4(new THREE.Matrix4().makeRotationY(-rot));
    for (let s = 0; s < 3; s++) {
      const o = ow.clone().multiplyScalar(0.12 + s * 0.14);
      wires.push(pa.clone().add(o).setY(ga + H + 0.1 + s * 0.13), pb.clone().add(o).setY(gb + H + 0.1 + s * 0.13));
    }
    void ga; void gb;
  }
}

/** Box-section transformer: tank, radiators, conservator, bushings. In a local frame (matrix m). */
function transformer(P, m, x, z) {
  const at = (lx, ly, lz) => v3(x + lx, ly, z + lz).applyMatrix4(m);
  const box = (key, w, h, d, lx, ly, lz) => { const p = at(lx, ly, lz); const g = new THREE.BoxGeometry(w, h, d); g.applyMatrix4(new THREE.Matrix4().extractRotation(m)); g.translate(p.x, p.y, p.z); P.add(key, g); };
  box('concrete', 8, 0.6, 6, 0, 0.3, 0);                       // plinth
  box('trafo', 5.6, 4.2, 3.4, 0, 2.7, 0);                      // tank
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) box('trafo', 0.16, 3.2, 1.3, -2.2 + i * 0.85, 2.6, s * 2.4);   // radiators
  P.rod('trafo', at(-2.2, 5.6, -1.1), at(-2.2, 5.6, 1.1), 0.55, 12);   // conservator
  for (const s of [-1, 1]) P.rod('steel', at(-2.2, 4.8, s * 0.7), at(-2.2, 5.3, s * 0.7), 0.1, 6);
  for (const lz of [-1, 0, 1]) P.rod('insulator', at(1.0, 4.8, lz * 1.0), at(1.0, 7.2, lz * 1.0), 0.17, 8);   // HV bushings
  for (const lz of [-1, 0, 1]) P.rod('insulator', at(-0.8, 4.8, lz * 0.7), at(-0.8, 5.9, lz * 0.7), 0.11, 6);  // LV bushings
}

export class Power {
  constructor(Q) {
    const P = new Parts();
    const wires = [];           // pairs of Vector3 (line segments)
    const pushCurve = (pts) => { for (let i = 0; i < pts.length - 1; i++) wires.push(pts[i], pts[i + 1]); };

    /* the line: switchyard gantry → towers → substation gantry */
    const tw = ZONE.towers;
    const sy = ZONE.switchyard, sub = ZONE.substation;
    const dirOf = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); return [dx / l, dz / l]; };
    const syPad = PADS.find((p) => p.name === 'switchyard'), subPad = PADS.find((p) => p.name === 'substation');
    const d0 = dirOf([sy.x, sy.z], tw[0]);
    const gA = gantry(P, sy.x + d0[0] * 18, syPad.y, sy.z + d0[1] * 18, d0);
    const d1 = dirOf([sub.x, sub.z], tw[tw.length - 1]);
    const gB = gantry(P, sub.x + d1[0] * 36, subPad.y, sub.z + d1[1] * 36, [-d1[0], -d1[1]], { facing: -1 });
    this.towers = tw.map((p, i) => {
      const prev = i === 0 ? [sy.x, sy.z] : tw[i - 1], next = i === tw.length - 1 ? [sub.x, sub.z] : tw[i + 1];
      const a = dirOf(prev, p), b = dirOf(p, next);
      const bis = [a[0] + b[0], a[1] + b[1]], bl = Math.hypot(...bis);
      return tower(P, p[0], p[1], [bis[0] / bl, bis[1] / bl]);
    });
    // the gantries' phase order must match the towers' (cross-arm x runs the same way): match by side
    const chain = [gA, ...this.towers, gB];
    for (let k = 0; k < 3; k++) for (let i = 0; i < chain.length - 1; i++) pushCurve(catenary(chain[i].att[k], chain[i + 1].att[k], 900, 28));
    for (let j = 0; j < 2; j++) for (let i = 0; i < chain.length - 1; i++) pushCurve(catenary(chain[i].gw[j], chain[i + 1].gw[j], 1150, 28));

    /* the powerhouse feeder: a small gantry in the powerhouse yard, a steep span up to the switchyard */
    {
      const [px, pz] = DAM.toWorld(DAM.ph.xl - 4, DAM.ph.zl - DAM.ph.w / 2 - 7);
      const tgt = [sy.x - 12, sy.z + sy.d / 2 - 4];
      const dir = dirOf([px, pz], tgt);
      const gP = gantry(P, px, 3.2, pz, dir, { span: 5, h: 12, phases: [-3.5, 0, 3.5] });
      const gS = gantry(P, tgt[0], syPad.y, tgt[1], dir, { span: 5, h: 10, phases: [-3.5, 0, 3.5], facing: -1 });
      for (let k = 0; k < 3; k++) pushCurve(catenary(gP.att[k], gS.att[k], 500, 20));
    }

    /* switchyard: breakers and bus between its gantries, a kiosk, the fence */
    {
      const m = new THREE.Matrix4().setPosition(sy.x, syPad.y, sy.z);
      for (let i = 0; i < 3; i++) {
        const z = -6 + i * 6;
        P.rod('steel', v3(-8, 0, z).applyMatrix4(m), v3(-8, 2.2, z).applyMatrix4(m), 0.15, 6);
        P.rod('breaker', v3(-10, 2.6, z).applyMatrix4(m), v3(-6, 2.6, z).applyMatrix4(m), 0.55, 12);
        P.rod('steel', v3(4, 0, z).applyMatrix4(m), v3(4, 5.5, z).applyMatrix4(m), 0.18, 6);
        P.rod('insulator', v3(4, 5.5, z).applyMatrix4(m), v3(4, 7.2, z).applyMatrix4(m), 0.16, 8);
      }
      P.box('building', 6, 3.2, 4, ...v3(-16, 1.6, 10).applyMatrix4(m).toArray());
      P.box('roof', 6.4, 0.3, 4.4, ...v3(-16, 3.35, 10).applyMatrix4(m).toArray());
      fence(P, sy.x, syPad.y, sy.z, 0, sy.w, sy.d, wires);
    }

    /* substation */
    {
      const rot = sub.rot;
      const m = new THREE.Matrix4().makeRotationY(-rot).setPosition(sub.x, subPad.y, sub.z);
      const at = (x, y, z) => v3(x, y, z).applyMatrix4(m);
      // incoming bus: three phases of tubular bus on post insulators, from the gantry eastward
      const gx = -36;
      for (const [k, pz] of [[0, -6], [1, 0], [2, 6]]) {
        for (const x of [-26, -14, -2, 10]) {
          P.member('steel', at(x, 0, pz), at(x, 5.6, pz), 0.35);
          P.rod('insulator', at(x, 5.6, pz), at(x, 7.6, pz), 0.17, 8);
        }
        P.rod('bus', at(gx + 6, 7.75, pz), at(10, 7.75, pz), 0.12, 6);
        wires.push(gB.att[2 - k].clone(), at(gx + 6, 7.75, pz));                   // the drop from the gantry (its +x is north)
        // disconnect switches and a dead-tank breaker per phase
        P.rod('breaker', at(-20, 2.4, pz - 1.5), at(-20, 2.4, pz + 1.5), 0.6, 12);
        P.box('steel', 0.4, 1.8, 2.4, ...at(-20, 0.9, pz).toArray());
        void k;
      }
      // bus support frames (lattice A-frames across the bus)
      for (const x of [-8, 4]) {
        for (const pz of [-11, 11]) P.member('steel', at(x, 0, pz), at(x, 10, pz * 0.8), 0.4);
        P.member('steel', at(x, 10, -9), at(x, 10, 9), 0.4);
      }
      // two transformers behind a firewall, with a busbar drop to each
      transformer(P, m, 22, -11);
      transformer(P, m, 22, 11);
      P.box('concrete', 9, 7.5, 0.5, ...at(22, 3.75, 0).toArray(), -rot);
      // the control building
      P.box('building', 12, 4.2, 7, ...at(-30, 2.1, 23).toArray(), -rot);
      P.box('roof', 12.6, 0.4, 7.6, ...at(-30, 4.4, 23).toArray(), -rot);
      P.box('steelPaint', 0.2, 2.4, 1.4, ...at(-23.9, 1.2, 23).toArray(), -rot);
      fence(P, sub.x, subPad.y, sub.z, rot, sub.w, sub.d, wires);
    }

    /* materials */
    const std = (name, o) => patchMaterial(new THREE.MeshStandardMaterial({ name, envMapIntensity: 0.9, ...o }), { key: 'std' });
    this.materials = {
      steel: std('pw-steel', { color: 0x8c9093, roughness: 0.48, metalness: 0.65 }),
      steelPaint: std('pw-steel-paint', { color: 0x4f5458, roughness: 0.55, metalness: 0.4 }),
      insulator: std('pw-insulator', { color: 0x7d8a84, roughness: 0.25, metalness: 0.1 }),
      footing: std('pw-footing', { color: 0x8f8a80, roughness: 0.9 }),
      concrete: std('pw-concrete', { color: 0x9c978c, roughness: 0.9 }),
      trafo: std('pw-trafo', { color: 0x6c7277, roughness: 0.5, metalness: 0.35 }),
      breaker: std('pw-breaker', { color: 0x9aa0a4, roughness: 0.4, metalness: 0.5 }),
      bus: std('pw-bus', { color: 0xb0a48a, roughness: 0.35, metalness: 0.8 }),
      building: std('pw-building', { color: 0xb3a88f, roughness: 0.85 }),
      roof: std('pw-roof', { color: 0x2a2a2a, roughness: 0.9 }),
      fabric: patchMaterial(new THREE.MeshStandardMaterial({ name: 'pw-fabric', color: 0x9a9da0, roughness: 0.6, metalness: 0.5, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }), { key: 'std' }),
    };
    this.group = new THREE.Group();
    this.group.name = 'table:power';
    P.build(this.group, this.materials, {
      shadows: Q.shadows, name: 'power',
      thermal: { steel: 'steel', steelPaint: 'steel', insulator: 'insulator', footing: 'concrete', concrete: 'concrete', trafo: 'transformer', breaker: 'breaker', bus: 'bus', building: 'building', roof: 'roof', fabric: 'fence' },
    });
    for (const c of this.group.children) if (c.material === this.materials.fabric) { c.castShadow = false; c.renderOrder = 2; }

    const wg = new THREE.BufferGeometry().setFromPoints(wires);
    this.wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color().setRGB(0.05, 0.048, 0.046, THREE.LinearSRGBColorSpace), transparent: true, opacity: 0.55, depthWrite: false, name: 'pw-wire' });
    this.wires = new THREE.LineSegments(wg, this.wireMat);
    this.wires.name = 'table:wires';
    this.wires.userData.thermal = 'wire';
    this.group.add(this.wires);
    this.chain = chain;
  }

  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of Object.values(this.materials)) m.dispose();
    this.wireMat.dispose();
  }
}
