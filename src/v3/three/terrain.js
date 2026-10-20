// v3 Maquette: the land as a milled plaster model.
//
// The fictional watch zone (zone.js, 1600 × 1000 m) is modelled at 1:250 as one continuous milled surface: the
// zone's height field (src/lib/terrain.ts makeField, the same field the v1 2D map uses) on a 6 to 8 m grid. The
// plaster shader engraves its contour lines (every 10 m, an index line every 50 m). Everything on the model, the
// drone included, is at the same 1:250, so sizes, heights, slopes and lens footprints are true to each other.
// Units: world metres of the studio (zone metres × S). y = 0 is the top of the base board.
//
// Output: the surface (one grid mesh), the four cut sides, the reservoir and river sheets, the data textures the
// plaster shader samples (forest density, engraved roads, SAMPLE temperature) and an exact `top(x, z)`
// (the same triangles the mesh is built from) for anything that sits on the model.
import { makeField, SUN } from '../../lib/terrain.ts';
import { clamp, sstep, polyDist, inPoly, densify, hash } from './util.js';

export const MODEL = {
  S: 1 / 250,      // 1:250
  CI: 10,          // contour interval, zone metres (index line every 5th)
  W: 1600, D: 1000, X0: -800, Z0: -500,
  BASE: 0.07,      // base board thickness, studio metres
  OUT: 0.045,      // base board overhang
};

/** signed distance to a closed polygon (negative inside), zone metres */
function polySD(poly, x, z) {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [bx, bz] = poly[i];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / l2);
    const px = ax + dx * t - x, pz = az + dz * t - z;
    d = Math.min(d, px * px + pz * pz);
  }
  d = Math.sqrt(d);
  return inPoly(poly, x, z) ? -d : d;
}

export function buildTerrainData(zone, { step = 8 } = {}) {
  const { W, D, X0, Z0 } = MODEL;
  const field = makeField(zone);
  const nx = Math.round(W / step) + 1, nz = Math.round(D / step) + 1;
  // the reservoir: a basin milled into the valley upstream of the dam. Its level sits 14 m under the dam's 44 m
  // crest; the lake bed shelves down from a low bank on the designed shoreline, and the land around it eases to
  // that bank over 60 m (upstream of the dam only; downstream the valley keeps its natural floor)
  const R = zone.reservoir;
  const WL = 30;
  const flow = [Math.cos(zone.dam.rot), Math.sin(zone.dam.rot)];
  const H = new Float32Array(nx * nz);    // natural height (for heat and shade)
  const HT = new Float32Array(nx * nz);   // the milled surface
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = X0 + i * step, z = Z0 + j * step, k = j * nx + i;
    const h = field.height(x, z);
    H[k] = h;
    const sd = polySD(R, x, z);
    const s = (x - zone.dam.x) * flow[0] + (z - zone.dam.z) * flow[1];
    const bank = WL + 1.5;
    if (sd < 0) HT[k] = Math.min(h, bank + (WL - 9 - bank) * sstep(0, 46, -sd));
    else if (s < -14) HT[k] = bank + (h - bank) * sstep(0, 60, sd);
    else HT[k] = h;
  }
  /** bilinear sample of a grid (heat, shade) */
  const at = (G, x, z) => {
    const fx = clamp((x - X0) / step, 0, nx - 1.0001), fz = clamp((z - Z0) / step, 0, nz - 1.0001);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const a = G[j * nx + i], b = G[j * nx + i + 1], c = G[(j + 1) * nx + i], d = G[(j + 1) * nx + i + 1];
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
  };
  /** the model's surface at (x, z), zone metres: the exact triangle the mesh draws there */
  const top = (x, z) => {
    const fx = clamp((x - X0) / step, 0, nx - 1.0001), fz = clamp((z - Z0) / step, 0, nz - 1.0001);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const a = HT[j * nx + i], b = HT[j * nx + i + 1], c = HT[(j + 1) * nx + i], d = HT[(j + 1) * nx + i + 1];
    return tx + tz <= 1 ? a + (b - a) * tx + (c - a) * tz : d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  };
  return { field, step, nx, nz, H, HT, WL, at, top };
}

/* ------------------------------------------------------------------ geometry */

export function buildTerrain(T, zone, data) {
  const { S, X0, Z0, W, D } = MODEL;
  const { step, nx, nz, HT, WL, top } = data;

  // ambient occlusion: the horizon angle to the surrounding land in 8 directions
  const DIRS = Array.from({ length: 8 }, (_, a) => [Math.cos((a / 8) * Math.PI * 2 + 0.2), Math.sin((a / 8) * Math.PI * 2 + 0.2)]);
  const RADII = [16, 48];
  function aoAt(x, z, y) {
    let occ = 0;
    for (const [dx, dz] of DIRS) {
      let m = 0;
      for (const r of RADII) {
        const dh = top(x + dx * r, z + dz * r) - y;
        if (dh > 0) m = Math.max(m, Math.atan(dh / r));
      }
      occ += m / (Math.PI / 2);
    }
    return 1 - 0.7 * (occ / DIRS.length);
  }

  const n = nx * nz;
  const p = new Float32Array(n * 3), nr = new Float32Array(n * 3), c = new Float32Array(n * 3);
  const g = (i, j) => HT[clamp(j, 0, nz - 1) * nx + clamp(i, 0, nx - 1)];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = X0 + i * step, z = Z0 + j * step, y = HT[k];
    p[k * 3] = x * S; p[k * 3 + 1] = y * S; p[k * 3 + 2] = z * S;
    const sx = (g(i + 1, j) - g(i - 1, j)) / ((Math.min(i + 1, nx - 1) - Math.max(i - 1, 0)) * step);
    const sz = (g(i, j + 1) - g(i, j - 1)) / ((Math.min(j + 1, nz - 1) - Math.max(j - 1, 0)) * step);
    const l = Math.hypot(sx, 1, sz);
    nr[k * 3] = -sx / l; nr[k * 3 + 1] = 1 / l; nr[k * 3 + 2] = -sz / l;
    const a = aoAt(x, z, y);
    c[k * 3] = c[k * 3 + 1] = c[k * 3 + 2] = a;
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let q = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, cc = a + nx, d = cc + 1;
    // split along b–c, the diagonal top() uses
    idx[q++] = a; idx[q++] = cc; idx[q++] = b;
    idx[q++] = b; idx[q++] = cc; idx[q++] = d;
  }
  const surface = new T.BufferGeometry();
  surface.setAttribute('position', new T.BufferAttribute(p, 3));
  surface.setAttribute('normal', new T.BufferAttribute(nr, 3));
  surface.setAttribute('color', new T.BufferAttribute(c, 3));
  surface.setIndex(new T.BufferAttribute(idx, 1));
  surface.computeBoundingSphere();

  // the four cut sides, from the base board up to the surface (the lake is cut at its water level). Each vertex
  // carries the ground's height there (aBed) and its distance along the cut (aAlong), so the shader can draw the
  // soil horizons, the till and the rock beds in section, and the reservoir's water where the cut crosses it
  const sides = { p: [], n: [], c: [], bed: [], al: [] };
  function side(pts, nrm) {
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, az, ha, ga] = pts[s], [bx, bz, hb, gb] = pts[s + 1];
      const P = [[ax, 0, az, ga], [bx, 0, bz, gb], [bx, hb, bz, gb], [ax, ha, az, ga]];
      const fx = -(bz - az), fz = bx - ax;
      const tri = fx * nrm[0] + fz * nrm[2] < 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
      for (const t of tri) {
        const [x, y, z, g] = P[t];
        sides.p.push(x * S, y * S, z * S);
        sides.n.push(...nrm);
        const a = y === 0 ? 0.88 : 1;
        sides.c.push(a, a, a);
        sides.bed.push(g);
        sides.al.push(x + z * 1.37);
      }
    }
  }
  const lake = (x, z) => (polySD(zone.reservoir, x, z) < 0 ? Math.max(top(x, z), WL) : top(x, z));
  const edge = (count, at) => Array.from({ length: count }, (_, s) => at(s));
  const pt = (x, z) => [x, z, lake(x, z), top(x, z)];
  side(edge(nx, (i) => pt(X0 + i * step, Z0)), [0, 0, -1]);
  side(edge(nx, (i) => pt(X0 + i * step, Z0 + D)), [0, 0, 1]);
  side(edge(nz, (j) => pt(X0, Z0 + j * step)), [-1, 0, 0]);
  side(edge(nz, (j) => pt(X0 + W, Z0 + j * step)), [1, 0, 0]);
  const sg = new T.BufferGeometry();
  sg.setAttribute('position', new T.Float32BufferAttribute(sides.p, 3));
  sg.setAttribute('normal', new T.Float32BufferAttribute(sides.n, 3));
  sg.setAttribute('color', new T.Float32BufferAttribute(sides.c, 3));
  sg.setAttribute('aBed', new T.Float32BufferAttribute(sides.bed, 1));
  sg.setAttribute('aAlong', new T.Float32BufferAttribute(sides.al, 1));
  sg.computeBoundingSphere();

  return { surface, sides: sg, tris: idx.length / 3 + sides.p.length / 9 };
}

/* ------------------------------------------------------------------ water sheets */

export function buildWater(T, zone, data) {
  const { S } = MODEL;
  // reservoir: the designed shoreline polygon at the water level; the lake bed is milled down under it
  const shape = new T.Shape(zone.reservoir.map(([x, z]) => new T.Vector2(x * S, z * S)));
  const res = new T.ShapeGeometry(shape, 6);
  res.rotateX(Math.PI / 2);                         // shape y → world z (no mirror: x stays, y → +z)
  res.translate(0, data.WL * S, 0);
  // the river below the dam: a 16 m ribbon along the centre line, lying on the valley floor
  const { dam } = zone;
  const river = zone.river;
  let best = 0, bestD = Infinity;
  for (let i = 0; i < river.length; i++) {
    const d = Math.hypot(river[i][0] - dam.x, river[i][1] - dam.z);
    if (d < bestD) { bestD = d; best = i; }
  }
  const line = [[dam.x, dam.z], ...river.slice(best + 1)];
  const { pts } = densify(line, 6);
  const half = 8;
  const p = [], idx = [], flow = [];
  let run = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    if (i > 0) run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    // downstream direction (zone x, z), distance from the dam (m), and which bank (-1 / +1)
    flow.push(tx, tz, run, -1, tx, tz, run, 1);
    const w = half * (0.85 + 0.15 * Math.sin(i * 0.37) * Math.sin(i * 0.11));
    const L = [pts[i][0] - tz * w, pts[i][1] + tx * w], Rr = [pts[i][0] + tz * w, pts[i][1] - tx * w];
    // the sheet sits on the lower bank, so it never hangs over the channel
    const y = Math.min(data.top(...L), data.top(...Rr), data.top(...pts[i])) + 0.35;
    p.push(L[0] * S, y * S, L[1] * S, Rr[0] * S, y * S, Rr[1] * S);
    if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const riv = new T.BufferGeometry();
  riv.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  riv.setAttribute('aFlow', new T.Float32BufferAttribute(flow, 4));
  // the reservoir: no current (a slow wind drift in the shader), far from the dam's outflow
  const rc = res.attributes.position.count;
  res.setAttribute('aFlow', new T.Float32BufferAttribute(new Float32Array(rc * 4).map((_, k) => (k % 4 === 2 ? 1e4 : 0)), 4));
  riv.setIndex(idx);
  riv.computeVertexNormals();
  // make sure both face up
  for (const g of [res, riv]) {
    const n = g.attributes.normal;
    if (n && n.getY(0) < 0) {
      const ix = g.index.array;
      for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
      g.index.needsUpdate = true;
    }
    for (let i = 0; i < g.attributes.position.count; i++) g.attributes.normal.setXYZ(i, 0, 1, 0);
  }
  return { reservoir: res, river: riv };
}

/* ------------------------------------------------------------------ data textures */

/** Forest density (R8, 4 m), engraved roads (canvas, 1 m/px) and SAMPLE temperature (R8, 4 m) */
export function buildTextures(T, zone, data) {
  const { W, D, X0, Z0 } = MODEL;
  const { field } = data;
  const G = 4, gx = W / G + 1, gz = D / G + 1;
  const forest = new Uint8Array(gx * gz);
  const temp = new Uint8Array(gx * gz);
  const line = [[zone.switchyard.x, zone.switchyard.z], ...zone.towers, [zone.substation.x, zone.substation.z]];
  const roads = [zone.road, zone.roadBranch];
  // cut blocks: a few irregular, straight-edged logging blocks of different ages (sparse young regrowth), kept
  // off the water and well clear of the SAMPLE hotspot's stand
  const blocks = [];
  for (let k = 0; blocks.length < 9 && k < 200; k++) {
    const cx = X0 + 80 + hash(k * 3.1 + 0.7) * (W - 160), cz = Z0 + 80 + hash(k * 5.3 + 2.9) * (D - 160);
    if (Math.hypot(cx - zone.hotspot.x, cz - zone.hotspot.z) < 170) continue;
    if (polySD(zone.reservoir, cx, cz) < 60 || polyDist(zone.river, cx, cz) < 70) continue;
    if (blocks.some((b) => Math.hypot(b.x - cx, b.z - cz) < b.r + 120)) continue;
    const r = 45 + hash(k * 7.7 + 1.3) * 60, nv = 5 + Math.floor(hash(k * 9.1 + 4.2) * 3), rot = hash(k * 2.3) * 6.28;
    const poly = Array.from({ length: nv }, (_, v) => {
      const a = rot + (v / nv) * Math.PI * 2 + (hash(k * 13 + v * 1.9) - 0.5) * 0.7;
      const rr = r * (0.7 + 0.5 * hash(k * 17 + v * 2.7));
      return [cx + Math.cos(a) * rr * 1.25, cz + Math.sin(a) * rr * 0.85];
    });
    blocks.push({ x: cx, z: cz, r, poly, regrowth: 0.12 + 0.26 * hash(k * 19.3 + 0.1) });
  }
  const pads = [
    { x: zone.dam.x, z: zone.dam.z, r: zone.dam.crest * 0.62 },
    { x: zone.powerhouse.x, z: zone.powerhouse.z, r: 44 },
    { x: zone.switchyard.x, z: zone.switchyard.z, r: 46 },
    { x: zone.substation.x, z: zone.substation.z, r: 70 },
  ];
  for (let j = 0; j < gz; j++) for (let i = 0; i < gx; i++) {
    const x = X0 + i * G, z = Z0 + j * G, k = j * gx + i;
    const h = data.at(data.H, x, z);
    const water = polySD(zone.reservoir, x, z) < 0;
    // forest: everywhere except water, the river banks, roads, pads, the line's cleared corridor and cut blocks
    let f = 1;
    f *= sstep(6, 18, polySD(zone.reservoir, x, z));
    f *= sstep(16, 30, polyDist(zone.river, x, z));
    for (const r of roads) f *= sstep(7, 13, polyDist(r, x, z));
    f *= sstep(18, 26, polyDist(line, x, z));
    for (const p of pads) f *= sstep(p.r, p.r + 14, Math.hypot(x - p.x, z - p.z));
    for (const b of blocks) {
      if (Math.hypot(x - b.x, z - b.z) > b.r * 1.6) continue;
      const cut = sstep(-3, 3, -polySD(b.poly, x, z));           // a crisp cut edge
      f *= 1 - cut * (1 - b.regrowth);
    }
    f *= 1 - sstep(300, 330, h) * 0.6;               // thinner on the highest crests
    forest[k] = Math.round(clamp(f) * 255);
    // SAMPLE thermal: the shared field's surface model, lit by its own (dusk) sun term, with the hotspot core
    const e = 4;
    const hx = data.at(data.H, x + e, z) - data.at(data.H, x - e, z), hz = data.at(data.H, x, z + e) - data.at(data.H, x, z - e);
    let nxv = -hx / (2 * e), nyv = 1, nzv = -hz / (2 * e);
    const l = Math.hypot(nxv, nyv, nzv);
    nxv /= l; nyv /= l; nzv /= l;
    const shade = Math.max(0, nxv * SUN[0] + nyv * SUN[1] + nzv * SUN[2]);
    // ambient ground only (the shared field's broad 72 m halo removed); the plaster shader adds a tight halo
    // and the 312 °C core analytically, so the hotspot stays crisp at any zoom
    const dh = Math.hypot(x - zone.hotspot.x, z - zone.hotspot.z);
    const c = field.temp(x, z, h, shade, water, false) - 30 * Math.exp(-(dh * dh) / (2 * 72 * 72));
    temp[k] = Math.round(clamp(c / 80) * 255);
  }
  const mkData = (arr) => {
    const t = new T.DataTexture(arr, gx, gz, T.RedFormat, T.UnsignedByteType);
    t.magFilter = T.LinearFilter;
    t.minFilter = T.LinearFilter;
    t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  };
  // engraved roads: 1 m per pixel
  const cv = document.createElement('canvas');
  cv.width = 1600; cv.height = 1000;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = (pts) => {
    ctx.beginPath();
    pts.forEach(([x, z], i) => (i ? ctx.lineTo(x - X0, z - Z0) : ctx.moveTo(x - X0, z - Z0)));
    ctx.stroke();
  };
  ctx.lineWidth = 6.5;
  roads.forEach(path);
  // pad outlines (switchyard, substation), engraved
  ctx.lineWidth = 2;
  for (const p of [zone.switchyard, zone.substation]) {
    ctx.save();
    ctx.translate(p.x - X0, p.z - Z0);
    ctx.rotate(p.rot || 0);
    ctx.strokeRect(-p.w / 2 - 4, -p.d / 2 - 4, p.w + 8, p.d + 8);
    ctx.restore();
  }
  const engrave = new T.CanvasTexture(cv);
  engrave.colorSpace = T.NoColorSpace;
  engrave.wrapS = engrave.wrapT = T.ClampToEdgeWrapping;
  engrave.anisotropy = 4;
  // the milled surface's heights (zone metres, half float), so the water shader can read its depth
  const hb = new Uint16Array(data.HT.length);
  for (let i = 0; i < hb.length; i++) hb[i] = T.DataUtils.toHalfFloat(data.HT[i]);
  const height = new T.DataTexture(hb, data.nx, data.nz, T.RedFormat, T.HalfFloatType);
  height.magFilter = T.LinearFilter;
  height.minFilter = T.LinearFilter;
  height.wrapS = height.wrapT = T.ClampToEdgeWrapping;
  height.needsUpdate = true;
  return { forest: mkData(forest), forestData: forest, temp: mkData(temp), engrave, height, size: [gx, gz] };
}
