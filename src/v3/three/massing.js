// v3 Maquette: the infrastructure. Concrete (dam, powerhouse, control building), the switchyard and substation as
// fenced gravel yards with steel equipment (transformers, gantries), and galvanized lattice pylons: four raked legs,
// X-bracing on every face, lattice crossarms.
// Positions and sizes come from zone.js (the same layout the v1 table and 2D map use), in true zone metres at the
// model's 1:250. Everything is seated on the surface: each block reaches down below the lowest point under its
// footprint, so nothing floats, and pads on a slope become raised platforms (cut and fill).
import { MODEL } from './terrain.js';

export function buildMassing(T, zone, data, kit) {
  const { S } = MODEL;
  const { top } = data;
  const group = new T.Group();
  group.name = 'massing';
  const geos = [];
  const lattice = [];          // hairlines (zone metres): pylon bracing, yard fences

  /** min / max surface height under a rotated rectangle footprint (zone metres) */
  function footprint(x, z, w, d, rot = 0) {
    let lo = Infinity, hi = -Infinity;
    const c = Math.cos(rot), s = Math.sin(rot);
    for (let i = -1; i <= 1; i += 0.5) for (let j = -1; j <= 1; j += 0.5) {
      const lx = (i * w) / 2, lz = (j * d) / 2;
      const h = top(x + lx * c - lz * s, z + lx * s + lz * c);
      lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    return { lo, hi };
  }
  function box(name, x, z, w, d, y0, y1, rot = 0, mat = kit.massing) {
    const g = new T.BoxGeometry(w * S, (y1 - y0) * S, d * S);
    geos.push(g);
    const m = new T.Mesh(g, mat);
    m.name = name;
    m.position.set(x * S, ((y0 + y1) / 2) * S, z * S);
    m.rotation.y = -rot;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  /** a block seated on the surface: from below the lowest point under it to `h` above the highest */
  function seated(name, x, z, w, d, h, rot = 0, mat = kit.massing) {
    const f = footprint(x, z, w, d, rot);
    box(name, x, z, w, d, f.lo - 6, f.hi + h, rot, mat);
    return f.hi;
  }
  /** a chain-link fence 3 m outside a yard, drawn as a hairline at its top */
  function fence(x, z, w, d, rot, y) {
    const c = Math.cos(rot), s = Math.sin(rot), hw = w / 2 + 3, hd = d / 2 + 3;
    const P = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => [x + lx * c - lz * s, y, z + lx * s + lz * c]);
    for (let i = 0; i < 4; i++) lattice.push(P[i], P[(i + 1) % 4]);
  }

  /* ---- dam: a gently arched wall on the reservoir's downstream edge (zone.reservoir[4] → [5]) ---- */
  {
    const A = zone.reservoir[4], B = zone.reservoir[5];
    const flow = [Math.cos(zone.dam.rot), Math.sin(zone.dam.rot)];
    const up = [-flow[0], -flow[1]];
    const sag = 12, thick = 11, N = 16;
    const front = [], back = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, b = 4 * t * (1 - t) * sag;
      const x = A[0] + (B[0] - A[0]) * t + up[0] * b, z = A[1] + (B[1] - A[1]) * t + up[1] * b;
      front.push([x, z]);
      back.push([x + flow[0] * thick, z + flow[1] * thick]);
    }
    const pts = [...front, ...back.reverse()];
    const shape = new T.Shape(pts.map(([x, z]) => new T.Vector2(x * S, z * S)));
    const top = 44;
    const g = new T.ExtrudeGeometry(shape, { depth: top * S, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(Math.PI / 2);
    g.translate(0, top * S, 0);
    g.computeVertexNormals();
    geos.push(g);
    const dam = new T.Mesh(g, kit.massing);
    dam.name = 'dam';
    dam.castShadow = dam.receiveShadow = true;
    group.add(dam);
    // spillway piers: four small blocks on the crest, the gates' rhythm reads at model scale
    for (let k = 1; k <= 4; k++) {
      const t = 0.3 + k * 0.08, b = 4 * t * (1 - t) * sag;
      const x = A[0] + (B[0] - A[0]) * t + up[0] * b + flow[0] * thick * 0.5;
      const z = A[1] + (B[1] - A[1]) * t + up[1] * b + flow[1] * thick * 0.5;
      box('dam_pier', x, z, 4, thick + 4, top, top + 5, Math.atan2(B[1] - A[1], B[0] - A[0]));
    }
  }

  /* ---- powerhouse at the dam toe, switchyard, substation ---- */
  {
    const p = zone.powerhouse;
    seated('powerhouse', p.x, p.z, p.w, p.d, p.h, p.rot);
  }
  {
    const s = zone.switchyard;
    const top = seated('switchyard_pad', s.x, s.z, s.w, s.d, 1.5, 0, kit.gravel) + 1.5;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      box('switchyard_eq', s.x - 15 + i * 15, s.z - 7 + j * 14, 5, 5, top, top + 7, 0, kit.steel);
    }
    fence(s.x, s.z, s.w, s.d, 0, top + 2.4);
  }
  {
    const s = zone.substation;
    const top = seated('substation_pad', s.x, s.z, s.w, s.d, 1.5, s.rot, kit.gravel) + 1.5;
    fence(s.x, s.z, s.w, s.d, s.rot, top + 2.4);
    const c = Math.cos(s.rot), sn = Math.sin(s.rot);
    const at = (lx, lz) => [s.x + lx * c - lz * sn, s.z + lx * sn + lz * c];
    for (let i = 0; i < 4; i++) {
      const [x, z] = at(-30 + i * 17, -12);
      box('transformer', x, z, 10, 8, top, top + 9, s.rot, kit.steel);
    }
    const [bx, bz] = at(28, 18);
    box('control_building', bx, bz, 18, 12, top, top + 7, s.rot);
    for (let i = 0; i < 2; i++) {
      const [gx, gz] = at(-20 + i * 30, 14);
      box('gantry_post', gx, gz, 1.6, 1.6, top, top + 16, s.rot, kit.steel);
    }
    const [gx, gz] = at(-5, 14);
    box('gantry_beam', gx, gz, 32, 1.4, top + 14.6, top + 16, s.rot, kit.steel);
  }

  /* ---- transmission line: galvanized lattice pylons, and the conductors ---- */
  const line = [[zone.switchyard.x, zone.switchyard.z], ...zone.towers, [zone.substation.x, zone.substation.z]];
  const attach = [];
  const H = 46, ARM1 = 35, ARM2 = 42.5;
  const legR = 0.32;
  zone.towers.forEach(([x, z], i) => {
    const a = line[i], b = line[i + 2];
    const dir = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const f = footprint(x, z, 7, 7);
    const base = f.lo - 2, ground = f.hi;
    const c = Math.cos(dir), sn = Math.sin(dir);
    // four legs raked in from a 7 m square at the ground to a 1.6 m square at the top
    const half = (y) => 3.5 + (0.8 - 3.5) * ((y - ground) / H);
    const corner = (k, y) => {
      const hx = (k & 1 ? 1 : -1) * half(y), hz = (k & 2 ? 1 : -1) * half(y);
      return [x + hx * c - hz * sn, y, z + hx * sn + hz * c];
    };
    for (let k = 0; k < 4; k++) {
      const p0 = corner(k, base), p1 = corner(k, ground + H);
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      const g = new T.CylinderGeometry(legR * 0.7 * S, legR * S, len * S, 4, 1);
      geos.push(g);
      const m = new T.Mesh(g, kit.steel);
      m.name = 'pylon_leg';
      m.position.set(((p0[0] + p1[0]) / 2) * S, ((p0[1] + p1[1]) / 2) * S, ((p0[2] + p1[2]) / 2) * S);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]).normalize());
      m.castShadow = m.receiveShadow = true;
      group.add(m);
    }
    // X-bracing on the four faces, in panels that shorten toward the top
    const levels = [ground, ground + 9, ground + 17, ground + 24, ground + 30, ground + ARM1, ground + 39, ground + ARM2, ground + H];
    const faces = [[0, 1], [1, 3], [3, 2], [2, 0]];
    for (let l = 0; l < levels.length - 1; l++) for (const [k0, k1] of faces) {
      const a0 = corner(k0, levels[l]), b0 = corner(k1, levels[l]), a1 = corner(k0, levels[l + 1]), b1 = corner(k1, levels[l + 1]);
      lattice.push(a0, b1, b0, a1, a1, b1);
    }
    // crossarms run across the line: a lattice box each
    const perp = dir + Math.PI / 2;
    const px = Math.cos(perp), pz = Math.sin(perp);
    for (const [yA, span, dep] of [[ground + ARM1, 9, 1.4], [ground + ARM2, 6.6, 1.2]]) {
      box('pylon_arm', x, z, span * 2, dep, yA - 0.35, yA + 0.35, perp, kit.steel);
      for (const sgn of [1, -1]) {
        const tip = [x + px * span * sgn, yA, z + pz * span * sgn];
        const root = [x + px * half(yA) * sgn, yA + 3.2, z + pz * half(yA) * sgn];
        lattice.push(tip, root);
      }
    }
    attach.push([
      [x + px * 8.4, ground + ARM1 - 0.7, z + pz * 8.4], [x - px * 8.4, ground + ARM1 - 0.7, z - pz * 8.4],
      [x + px * 6.1, ground + ARM2 - 0.6, z + pz * 6.1], [x - px * 6.1, ground + ARM2 - 0.6, z - pz * 6.1],
    ]);
  });
  const wire = [];
  const SEG = 22;
  for (let i = 0; i < attach.length - 1; i++) for (let k = 0; k < 4; k++) {
    const p = attach[i][k], q = attach[i + 1][k];
    const span = Math.hypot(q[0] - p[0], q[2] - p[2]);
    const sag = span * 0.045;
    for (let s = 0; s < SEG; s++) {
      for (const t of [s / SEG, (s + 1) / SEG]) {
        wire.push((p[0] + (q[0] - p[0]) * t) * S, (p[1] + (q[1] - p[1]) * t - 4 * t * (1 - t) * sag) * S, (p[2] + (q[2] - p[2]) * t) * S);
      }
    }
  }
  const bg = new T.BufferGeometry();
  bg.setAttribute('position', new T.Float32BufferAttribute(lattice.flatMap((q) => q.map((v) => v * S)), 3));
  geos.push(bg);
  const bmat = new T.LineBasicMaterial({ color: 0x6f767b, transparent: true, opacity: 0.85 });
  const bracing = new T.LineSegments(bg, bmat);
  bracing.name = 'pylon_bracing';
  group.add(bracing);
  const wg = new T.BufferGeometry();
  wg.setAttribute('position', new T.Float32BufferAttribute(wire, 3));
  geos.push(wg);
  const wmat = new T.LineBasicMaterial({ color: 0x3a3e42, transparent: true, opacity: 0.5, toneMapped: false });
  const wires = new T.LineSegments(wg, wmat);
  wires.name = 'wires';
  group.add(wires);

  return {
    group,
    dispose() { geos.forEach((g) => g.dispose()); wmat.dispose(); bmat.dispose(); },
  };
}
