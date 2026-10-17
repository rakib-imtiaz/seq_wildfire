// Command Table: the hydro works. A curved concrete gravity dam (an arch in plan, 380 m radius,
// convex upstream; every cross-section is radial), keyed into the canyon walls:
//   body        upstream face, 8 m crest with parapets and an asphalt crest road, downstream face at
//               0.78 : 1, swept on both sides of the spillway and buried below the terrain
//   spillway    an ogee crest at 40 m, a chute down to a stilling basin with an end sill, training
//               walls, five round-nosed piers, four radial (Tainter) gates with arms and girders, the
//               crest road bridge over the piers, a hoist on each pier
//   intake      a concrete intake tower in the reservoir with a hoist house and an access bridge
//   penstocks   two steel pipes out of the downstream face, down on saddles to the powerhouse
//   powerhouse  ZONE.powerhouse on the north bank at the toe: hall, roof, window band, door, vents
// One merged geometry per material. The concrete shader adds monolith joints, run-off streaks and a
// damp toe. Built in the dam's local frame (x downstream, z along the crest), then placed.
import * as THREE from 'three';
import { Parts } from './kit.js';
import { DAM, LEVELS } from './layout.js';
import { groundAt } from './terrain.js';
import { patchMaterial } from './shading.js';

const CREST = LEVELS.crest;
const SILL = 40.2;                 // ogee crest
const BURY = -24;                  // the body continues this far down (inside the rock)

/* ------------------------------------------------------------- builders */
/** Position on the arch: radial section angle phi, offset xr downstream of the upstream face, height y. */
function archPt(phi, xr, y, out = new THREE.Vector3()) {
  const R = DAM.R, c = Math.cos(phi), s = Math.sin(phi);
  return out.set(R - R * c + xr * c, y, R * s - xr * s);
}
/** The radial (downstream) direction at phi, as a 3D vector. */
const radial = (phi) => new THREE.Vector3(Math.cos(phi), 0, -Math.sin(phi));
const phiOf = (zl) => Math.asin(zl / DAM.R);

/** A prism in a radial plane: polygon [[xr, y], ...] extruded from crest position zl0 by thickness (toward +z). */
function radialPrism(P, key, zl0, thickness, pts) {
  const phi = phiOf(zl0 + thickness / 2);
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: thickness, bevelEnabled: false });
  const r = radial(phi), up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi));
  const o = archPt(phi, 0, 0).sub(side.clone().multiplyScalar(thickness / 2));
  g.applyMatrix4(new THREE.Matrix4().makeBasis(r, up, side).setPosition(o));
  P.add(key, g);
}

/** Sweep a closed 2D section [[xr, y], ...] (counter-clockwise) between two arch angles. */
function sweep(P, key, sectionAt, phi0, phi1, step, caps = true) {
  const n = Math.max(1, Math.ceil(Math.abs(phi1 - phi0) * DAM.R / step));
  for (let i = 0; i < n; i++) {
    const pa = phi0 + (phi1 - phi0) * (i / n), pb = phi0 + (phi1 - phi0) * ((i + 1) / n);
    const A = sectionAt(pa), B = sectionAt(pb);
    const pm = (pa + pb) / 2, rm = radial(pm);
    for (let k = 0; k < A.length; k++) {
      const k1 = (k + 1) % A.length;
      if (A[k].skip) continue;
      // outward normal of the edge in section space (section is CCW: outward = (dy, -dx))
      const ex = A[k1][0] - A[k][0], ey = A[k1][1] - A[k][1];
      const out = rm.clone().multiplyScalar(ey).add(new THREE.Vector3(0, -ex, 0));
      P.quad(A[k].key || key, archPt(pa, A[k][0], A[k][1]), archPt(pa, A[k1][0], A[k1][1]), archPt(pb, B[k1][0], B[k1][1]), archPt(pb, B[k][0], B[k][1]), out);
    }
  }
  if (caps) {
    for (const [phi, sgn] of [[phi0, -1], [phi1, 1]]) {
      const S = sectionAt(phi), t = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi)).multiplyScalar(sgn * Math.sign(phi1 - phi0));
      const c = S.reduce((m, p) => [m[0] + p[0] / S.length, m[1] + p[1] / S.length], [0, 0]);
      for (let k = 0; k < S.length; k++) {
        const k1 = (k + 1) % S.length;
        const g = new THREE.BufferGeometry();
        const a = archPt(phi, c[0], c[1]), b = archPt(phi, S[k][0], S[k][1]), d = archPt(phi, S[k1][0], S[k1][1]);
        let tri = [a, b, d];
        const nn = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a));
        if (nn.dot(t) < 0) tri = [a, d, b];
        g.setAttribute('position', new THREE.Float32BufferAttribute(tri.flatMap((v) => [v.x, v.y, v.z]), 3));
        g.computeVertexNormals();
        P.add(key, g);
      }
    }
  }
}

/* ------------------------------------------------------------- the dam */
function damBody(P) {
  const W = DAM.crestW, toeY = -6;
  const section = () => {
    // CCW in (xr, y): upstream face bottom → toe → downstream face → crest → upstream face top
    const toeX = W + DAM.slope * (CREST - 4 - toeY);
    const s = [[0, BURY], [toeX + 6, BURY], [toeX, toeY], [W, CREST - 4], [W, CREST], [0, CREST]];
    s[0].skip = true;                           // the buried underside
    s[4].key = 'asphalt';                       // crest top: the road
    return s;
  };
  const p0 = phiOf(-DAM.half), p1 = phiOf(DAM.spillZ - DAM.spillHalf), p2 = phiOf(DAM.spillZ + DAM.spillHalf), p3 = phiOf(DAM.half);
  sweep(P, 'concrete', section, p0, p1, 4);
  sweep(P, 'concrete', section, p2, p3, 4);
  // parapets on both edges of the crest (and along the spillway bridge)
  const parapet = (xr) => () => [[xr, CREST], [xr + 0.45, CREST], [xr + 0.45, CREST + 1.1], [xr, CREST + 1.1]];
  for (const xr of [0, W - 0.45]) { sweep(P, 'concrete', parapet(xr), p0, p1, 4); sweep(P, 'concrete', parapet(xr), p1, p2, 4); sweep(P, 'concrete', parapet(xr), p2, p3, 4); }
  // crest lamp posts every ~24 m on the downstream parapet
  for (let zl = -DAM.half + 10; zl < DAM.half - 8; zl += 24) {
    const ph = phiOf(zl), b = archPt(ph, W - 0.3, CREST + 1.1);
    P.box('steelDark', 0.25, 4.2, 0.25, b.x, b.y + 2.1, b.z);
    P.box('steelDark', 0.5, 0.3, 0.5, b.x, b.y + 4.3, b.z, ph);
  }
}

function spillway(P) {
  const W = DAM.crestW;
  const zA = DAM.spillZ - DAM.spillHalf, zB = DAM.spillZ + DAM.spillHalf;
  const pA = phiOf(zA), pB = phiOf(zB);
  // the ogee and chute section (the gates sit on the ogee crest at xr ≈ 1.5)
  const chuteToe = 9 + (37 + 1) * DAM.slope;           // where the chute meets the basin
  const BASIN_END = chuteToe + 34, BASIN_Y = -4;
  const ogee = () => {
    const s = [[0, BURY], [BASIN_END + 4, BURY], [BASIN_END + 4, BASIN_Y + 2.4], [BASIN_END + 1.5, BASIN_Y + 2.4], [BASIN_END, BASIN_Y], [chuteToe + 6, BASIN_Y], [chuteToe, -1],
      [9, 37], [6.5, 39.3], [4, 40.35], [2, SILL + 0.45], [0.6, SILL + 0.3], [0, SILL - 0.3]];
    s[0].skip = true;
    return s;
  };
  sweep(P, 'concrete', ogee, pA, pB, 2.5, false);
  // the chute's side walls are the dam body's own end faces (6 m above the chute); below the body's toe
  // the stilling basin gets training walls of its own, down into the rock
  const wallT = 2.2;
  const basinWall = [[chuteToe - 14, BURY], [BASIN_END + 4, BURY], [BASIN_END + 4, BASIN_Y + 8.5], [chuteToe + 2, BASIN_Y + 8.5], [chuteToe - 14, 18]];
  radialPrism(P, 'concrete', zA, wallT, basinWall);
  radialPrism(P, 'concrete', zB - wallT, wallT, basinWall);
  // piers: from below the ogee and chute surface up to the deck, round-nosed upstream
  const n = DAM.gates + 1;
  const PT = CREST - 1.45;                  // pier tops carry the bridge deck (its underside at CREST - 1.4)
  const pierProfile = [[-3, 35.5], [17, 26.5], [17, 31.5], [10.5, PT], [-3, PT]];
  for (let i = 0; i < n; i++) {
    const z0 = zA + i * (DAM.gateW + DAM.pierW);
    radialPrism(P, 'concrete', z0, DAM.pierW, pierProfile);
    const phi = phiOf(z0 + DAM.pierW / 2), r = radial(phi), ry = Math.atan2(-r.z, r.x);
    const nose = new THREE.CylinderGeometry(DAM.pierW / 2, DAM.pierW / 2, PT - 35.5, 12);
    const np = archPt(phi, -3, (35.5 + PT) / 2);
    nose.translate(np.x, np.y, np.z);
    P.add('concrete', nose);
    // a gate hoist on the pier top, just downstream of the road
    const hp = archPt(phi, 9.4, PT);
    P.box('steelPaint', 2.2, 2.2, 1.7, hp.x, hp.y + 1.1, hp.z, ry);
  }
  // the bridge deck over the spillway (the crest road), on the piers
  const deck = () => { const s = [[0, CREST - 1.4], [W, CREST - 1.4], [W, CREST], [0, CREST]]; s[2].key = 'asphalt'; return s; };
  sweep(P, 'concrete', deck, pA, pB, 2.5, false);
  // radial gates between the piers: skin plate arc (convex upstream), two arms to a trunnion, girders
  const TX = 10.4, TY = 43.6, Rg = Math.hypot(TX - 1.6, TY - (SILL + 0.4));
  const f0 = Math.asin((SILL + 0.4 - TY) / Rg), f1 = Math.asin((LEVELS.reservoir + 1.2 - TY) / Rg);
  for (let g = 0; g < DAM.gates; g++) {
    const z0 = zA + DAM.pierW + g * (DAM.gateW + DAM.pierW), z1 = z0 + DAM.gateW;
    const phi0 = phiOf(z0 + 0.05), phi1 = phiOf(z1 - 0.05);
    const segs = 8;
    for (let k = 0; k < segs; k++) {
      const fa = f0 + (f1 - f0) * (k / segs), fb = f0 + (f1 - f0) * ((k + 1) / segs);
      const xa = TX - Rg * Math.cos(fa), ya = TY + Rg * Math.sin(fa), xb = TX - Rg * Math.cos(fb), yb = TY + Rg * Math.sin(fb);
      const outN = radial((phi0 + phi1) / 2).multiplyScalar(-Math.cos((fa + fb) / 2)).add(new THREE.Vector3(0, Math.sin((fa + fb) / 2), 0));
      P.quad('gate', archPt(phi0, xa, ya), archPt(phi1, xa, ya), archPt(phi1, xb, yb), archPt(phi0, xb, yb), outN);
      P.quad('gate', archPt(phi0, xa + 0.25, ya), archPt(phi1, xa + 0.25, ya), archPt(phi1, xb + 0.25, yb), archPt(phi0, xb + 0.25, yb), outN.clone().negate());
    }
    // arms (two per gate, at the piers) and three horizontal girders behind the plate
    for (const zz of [z0 + 0.6, z1 - 0.6]) {
      const ph = phiOf(zz);
      for (const f of [f0 + 0.12, f1 - 0.12]) {
        const a = archPt(ph, TX - Rg * Math.cos(f) + 0.4, TY + Rg * Math.sin(f)), b = archPt(ph, TX, TY);
        const len = a.distanceTo(b), mid = a.clone().add(b).multiplyScalar(0.5);
        const arm = new THREE.BoxGeometry(len, 0.55, 0.45);
        arm.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(a).normalize()));
        arm.translate(mid.x, mid.y, mid.z);
        P.add('gate', arm);
      }
    }
    for (const f of [f0 + 0.15, (f0 + f1) / 2, f1 - 0.15]) {
      const xr = TX - Rg * Math.cos(f) + 0.7, y = TY + Rg * Math.sin(f);
      const sec = () => [[xr, y - 0.35], [xr + 0.6, y - 0.35], [xr + 0.6, y + 0.35], [xr, y + 0.35]];
      sweep(P, 'gate', sec, phi0, phi1, 3, true);
    }
  }
  return { chuteToe, basinEnd: BASIN_END };
}

function intake(P) {
  const zl = DAM.intakeZ, phi = phiOf(zl), r = radial(phi), ry = Math.atan2(-r.z, r.x);
  const c = archPt(phi, -17, 0);
  const top = CREST + 6;
  // the tower shaft (it stands on the reservoir bed), with pilasters and a trash-rack face
  const bot = -8;
  P.box('concrete', 11, top - bot, 10, c.x, (top + bot) / 2, c.z, ry);
  for (const s of [-1, 1]) {
    const p = c.clone().add(new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi)).multiplyScalar(s * 5.3));
    P.box('concrete', 11.6, top - bot, 1.2, p.x, (top + bot) / 2, p.z, ry);
  }
  const rack = c.clone().add(r.clone().multiplyScalar(-5.6));
  P.box('steelDark', 0.3, LEVELS.reservoir - 6 - bot, 8, rack.x, (LEVELS.reservoir - 6 + bot) / 2, rack.z, ry);
  // the hoist house on top
  P.box('concrete', 9, 5.5, 8.5, c.x, top + 2.75, c.z, ry);
  P.box('roof', 9.8, 0.5, 9.3, c.x, top + 5.75, c.z, ry);
  P.box('glass', 9.05, 1.1, 6.5, c.x, top + 3.6, c.z, ry);
  // the access bridge from the crest to the tower: deck and rails
  const a = archPt(phi, 0, CREST - 0.6), b = archPt(phi, -11.5, CREST - 0.6);
  const mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
  P.box('concrete', len, 1.2, 3.4, mid.x, mid.y, mid.z, ry);
  const side = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi));
  for (const s of [-1, 1]) { const q = mid.clone().addScaledVector(side, s * 1.6); P.box('steelDark', len, 0.12, 0.12, q.x, CREST + 0.5, q.z, ry); }
}

function penstocks(P) {
  const zl = DAM.intakeZ, ph = DAM.ph;
  const yard = 3.2;
  for (const off of [-3.6, 3.6]) {
    const z = zl + off, phi = phiOf(z);
    const fx = (y) => DAM.crestW + DAM.slope * (CREST - 4 - y);         // the downstream face at y (section coords)
    const p0 = archPt(phi, fx(29) - 3, 29);
    const p1 = archPt(phi, fx(29) + 2.3, 28.6);
    const p2 = archPt(phi, fx(9) + 2.6, 8.4);
    const p3 = archPt(phi, fx(9) + 9, 5.6);
    // to the powerhouse's upstream wall, in the dam frame (powerhouse is radial-agnostic: it is a box)
    const p4 = new THREE.Vector3(ph.xl - ph.d / 2 - 0.5, 5.4, ph.zl + off);
    const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3, p4], false, 'centripetal', 0.2);
    P.add('penstock', new THREE.TubeGeometry(curve, 60, 1.9, 12, false));
    // anchor blocks at the bends, saddles every ~9 m on the run to the powerhouse
    for (const p of [p1, p2]) P.box('concrete', 6, 5, 6, p.x, p.y - 0.5, p.z, phi);
    const L = p3.distanceTo(p4);
    for (let t = 6; t < L - 3; t += 9) {
      const q = p3.clone().lerp(p4, t / L);
      const h = q.y - 1.9 - (yard - 0.5);
      if (h > 0.2) P.box('concrete', 2.2, h, 5, q.x, yard - 0.5 + h / 2, q.z);
    }
  }
}

function powerhouse(P) {
  const { xl, zl, w, d, h } = DAM.ph, yard = 3.2;
  const base = -6, top = yard + h;
  // the hall
  P.box('concreteLight', d, top - base, w, xl, (top + base) / 2, zl);
  // a darker plinth band and the roof with its parapet and plant
  P.box('concrete', d + 0.6, yard + 1.2 - base, w + 0.6, xl, (yard + 1.2 + base) / 2, zl);
  P.box('roof', d - 0.8, 0.4, w - 0.8, xl, top + 0.05, zl);
  for (const [dx, dz, ww, dd] of [[0, w / 2 - 0.3, d, 0.6], [0, -w / 2 + 0.3, d, 0.6], [d / 2 - 0.3, 0, 0.6, w], [-d / 2 + 0.3, 0, 0.6, w]]) P.box('concreteLight', ww, 1.0, dd, xl + dx, top + 0.5, zl + dz);
  for (const [dx, dz] of [[-6, -10], [-6, 2], [5, 12]]) P.box('steelPaint', 3, 1.6, 3.5, xl + dx, top + 0.85, zl + dz);
  // a high window band on the long sides, and on the downstream end
  for (const s of [-1, 1]) P.box('glass', d - 6, 3.2, 0.3, xl, top - 4.2, zl + s * (w / 2 + 0.1));
  P.box('glass', 0.3, 3.2, w - 8, xl + d / 2 + 0.1, top - 4.2, zl);
  // the vertical mullions break the band into bays
  for (let i = 0; i <= 6; i++) for (const s of [-1, 1]) P.box('concreteLight', 0.5, 3.4, 0.45, xl - (d - 6) / 2 + i * (d - 6) / 6, top - 4.2, zl + s * (w / 2 + 0.12));
  // the roll-up door on the yard side (north)
  P.box('steelPaint', 7, 8, 0.3, xl - 3, yard + 4, zl - w / 2 - 0.12);
  // the draft-tube outlets on the downstream face, at the tailwater
  for (const dz of [-9, 9]) P.box('glass', 0.3, 3.5, 7, xl + d / 2 + 0.12, 0.6, zl + dz);
}

/* ------------------------------------------------------------- materials */
const CONCRETE_PARS = /* glsl */`
uniform sampler2D uNoise; uniform vec4 uDamF; uniform float uDamR;
`;
const CONCRETE_COLOR = /* glsl */`
{
  vec2 d = vTWp.xz - uDamF.xy;
  float xl = dot( d, uDamF.zw ), zl = dot( d, vec2( -uDamF.w, uDamF.z ) );
  float arcS = uDamR * atan( zl, uDamR - xl );          // position along the crest (m)
  float y = vTWp.y;
  // run-off streaks below the crest, efflorescence, a damp toe
  float st = texture2D( uNoise, vec2( arcS / 5.0, y / 70.0 ) ).g;
  float st2 = texture2D( uNoise, vec2( arcS / 1.7, y / 26.0 ) ).b;
  float k = 0.86 + 0.18 * st + 0.08 * st2;
  k *= 1.0 - 0.22 * smoothstep( 0.55, 0.8, st2 ) * smoothstep( 46.0, 30.0, y );
  k *= mix( 0.62, 1.0, smoothstep( -2.0, 8.0, y ) );
  // monolith joints every 15 m along the crest (on the faces, not on the crest top)
  float j = abs( fract( arcS / 15.0 + 0.5 ) - 0.5 ) * 15.0;
  k *= mix( 1.0, 0.62, ( 1.0 - smoothstep( 0.08, 0.22, j ) ) * ( 1.0 - step( 0.9, vTN2.y ) ) );
  diffuseColor.rgb *= k;
}
`;

export class Dam {
  constructor(Q, noiseTex) {
    const P = new Parts();
    damBody(P);
    this.spill = spillway(P);
    intake(P);
    penstocks(P);
    powerhouse(P);

    const concreteUniforms = { uNoise: { value: noiseTex }, uDamF: { value: new THREE.Vector4(DAM.cx, DAM.cz, DAM.ux, DAM.uz) }, uDamR: { value: DAM.R } };
    const concrete = (name, hex) => patchMaterial(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.86, metalness: 0, envMapIntensity: 0.6, name }), {
      key: 'concrete', uniforms: concreteUniforms,
      vertPars: 'varying vec3 vTN2;', vertMain: 'vTN2 = normalize( mat3( modelMatrix ) * objectNormal );',
      fragPars: CONCRETE_PARS + 'varying vec3 vTN2;', color: CONCRETE_COLOR,
    });
    const std = (name, o) => patchMaterial(new THREE.MeshStandardMaterial({ name, envMapIntensity: 0.8, ...o }), { key: 'std' });
    this.materials = {
      concrete: concrete('dam-concrete', 0x8b867c),
      concreteLight: concrete('dam-concrete-light', 0x98928a),
      asphalt: std('dam-asphalt', { color: 0x2b2a28, roughness: 0.92 }),
      gate: std('dam-gate', { color: 0x4d5559, roughness: 0.5, metalness: 0.55 }),
      steelPaint: std('dam-steel', { color: 0x5c6063, roughness: 0.55, metalness: 0.4 }),
      steelDark: std('dam-steel-dark', { color: 0x2a2c2e, roughness: 0.6, metalness: 0.5 }),
      penstock: std('dam-penstock', { color: 0x3b4038, roughness: 0.45, metalness: 0.5 }),
      roof: std('dam-roof', { color: 0x262626, roughness: 0.9 }),
      glass: std('dam-glass', { color: 0x0b0e10, roughness: 0.12, metalness: 0.7 }),
    };
    this.group = new THREE.Group();
    this.group.name = 'table:dam';
    this.group.position.set(DAM.cx, 0, DAM.cz);
    this.group.rotation.y = -DAM.rot;
    const thermal = { concrete: 'concrete', concreteLight: 'concrete', asphalt: 'asphalt', gate: 'steel', steelPaint: 'steel', steelDark: 'steel', penstock: 'steel', roof: 'roof', glass: 'glass' };
    for (const [key, mat] of Object.entries(this.materials)) {
      const g = P.geo(key);
      if (!g) continue;
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.name = 'table:dam-' + key;
      m.userData.thermal = thermal[key];
      m.castShadow = Q.shadows; m.receiveShadow = Q.shadows;
      this.group.add(m);
    }
    this.group.updateMatrixWorld(true);
  }

  /** Height of the dam's walkable top (crest road, bridge) at (x, z), or null off the crest. */
  crestAt(x, z) {
    const [xl, zl] = DAM.toLocal(x, z);
    if (Math.abs(zl) > DAM.half) return null;
    const phi = phiOf(zl), xr = (xl - (DAM.R - DAM.R * Math.cos(phi))) / Math.cos(phi);
    return xr >= -0.2 && xr <= DAM.crestW + 0.2 ? CREST : null;
  }

  dispose() {
    this.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of Object.values(this.materials)) m.dispose();
  }
}

export { phiOf, archPt };
void groundAt;
