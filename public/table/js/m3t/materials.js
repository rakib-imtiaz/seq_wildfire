// DJI Mavic 3 Thermal (M3T): procedural materials and textures.
// Every texture is generated in code (DataTexture, no canvas, no image files), so the model also builds in
// Node for measuring. Independent noise fields per channel: albedo mottle, roughness blotch and bump grain are
// never the same field.
//
// createM3TMaterials({ detail: 'hero' | 'table', texSize }) → { M, T, dispose() }
//   M.shell        enterprise dark grey satin plastic, loft-space maps (panel seams baked into albedo/bump/rough)
//   M.battery      same plastic, its own grip pattern
//   M.plastic      arms, housings, legs, gimbal brackets (box-projected metre-scale noise)
//   M.plasticDark  gimbal face panel, recesses
//   M.rubber       feet, dampers
//   M.bell         motor bells: dark anodised aluminium, circular brushing
//   M.metal        lens rings (bright), M.metalDark: screws, thermal ring
//   M.glass        camera / vision glass, AR-coating sheen (iridescence)
//   M.glassDeep    lens elements behind the front glass
//   M.germanium    thermal window: near-black, faint blue-violet thin-film sheen
//   M.vent         black vent interiors
//   M.blade        propeller blades (atlas: graphite with orange tips), fades for motion blur
//   M.disc         rotor blur disc
//   M.ledRed / ledGreen / ledWhite / ledAmber
import * as THREE from 'three';

/* ------------------------------------------------------------------ noise */
export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable value-noise fBm. octaves: [[cellsX, cellsY, amplitude], ...] → Float32Array in 0..1 */
function fbm(w, h, seed, octaves) {
  const out = new Float32Array(w * h), r = rng(seed);
  let total = 0;
  for (const [cx, cy, amp] of octaves) {
    const lat = new Float32Array(cx * cy);
    for (let i = 0; i < lat.length; i++) lat[i] = r();
    for (let y = 0; y < h; y++) {
      const fy = (y / h) * cy, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty);
      const r0 = (y0 % cy) * cx, r1 = ((y0 + 1) % cy) * cx;
      for (let x = 0; x < w; x++) {
        const fx = (x / w) * cx, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx);
        const c0 = x0 % cx, c1 = (x0 + 1) % cx;
        const top = lat[r0 + c0] + (lat[r0 + c1] - lat[r0 + c0]) * sx;
        const bot = lat[r1 + c0] + (lat[r1 + c1] - lat[r1 + c0]) * sx;
        out[y * w + x] += amp * (top + (bot - top) * sy);
      }
    }
    total += amp;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function dataTexture(w, h, fn, { srgb = false, wrapS = THREE.RepeatWrapping, wrapT = THREE.RepeatWrapping, alpha = null } = {}) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    const v = fn(x, y, y * w + x);
    const r = typeof v === 'number' ? v : v[0], g = typeof v === 'number' ? v : v[1], b = typeof v === 'number' ? v : v[2];
    data[i] = Math.max(0, Math.min(255, r * 255));
    data[i + 1] = Math.max(0, Math.min(255, g * 255));
    data[i + 2] = Math.max(0, Math.min(255, b * 255));
    data[i + 3] = alpha ? Math.max(0, Math.min(255, alpha(x, y, y * w + x) * 255)) : 255;
  }
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.wrapS = wrapS; t.wrapT = wrapT;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** 0..1 line mask: 1 on a line at position c (same units as x), half-width w, soft edge s */
const lineMask = (x, c, w, s) => 1 - smooth(w, w + s, Math.abs(x - c));

/* ------------------------------------------------------------------ textures */
/**
 * Loft-space textures for the body shell. u = arc-length fraction around the cross-section starting at the
 * bottom centre (0.25 = left (+X) flank, 0.5 = top centre, 0.75 = right flank); v = 0 at the nose → 1 at the
 * battery seam. Panel lines: the top-deck border (both upper shoulders, fading out over the nose) and a
 * waist line along each flank. They are drawn into albedo (darker), roughness (rougher) and bump (a groove).
 */
function shellTextures(N) {
  const mottle = fbm(N, N, 11, [[6, 6, 1], [12, 12, 0.5], [32, 32, 0.25], [96, 96, 0.12]]);
  const seam = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    const v = y / (N - 1);
    const deckFade = smooth(0.05, 0.16, v);           // the deck border runs out over the nose
    for (let x = 0; x < N; x++) {
      const u = x / N;
      let s = 0;
      s = Math.max(s, deckFade * lineMask(u, 0.405, 0.0011, 0.0011));
      s = Math.max(s, deckFade * lineMask(u, 0.595, 0.0011, 0.0011));
      // waist line along each flank, stepping up at the front-arm root
      const waist = 0.205 + 0.02 * smooth(0.18, 0.3, v);
      s = Math.max(s, smooth(0.12, 0.2, v) * lineMask(u, waist, 0.0009, 0.001));
      s = Math.max(s, smooth(0.12, 0.2, v) * lineMask(u, 1 - waist, 0.0009, 0.001));
      seam[y * N + x] = s;
    }
  }
  const opt = { wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping };
  return {
    shellAlbedo: dataTexture(N, N, (x, y, i) => (0.9 + 0.12 * mottle[i]) * (1 - 0.62 * seam[i]), { srgb: true, ...opt }),
    // panel seams also as occlusion (darkens the environment light in the groove, like a real cut line)
    shellSeamAO: dataTexture(N, N, (x, y, i) => 1 - 0.75 * seam[i], opt),
  };
}

/** Battery: same plastic, with a fine horizontal grip band across the rear half of each flank. */
function batteryTextures(N) {
  const mottle = fbm(N, N, 61, [[6, 6, 1], [24, 24, 0.4], [96, 96, 0.12]]);
  const grip = new Float32Array(N * N), seam = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    const v = y / (N - 1);
    for (let x = 0; x < N; x++) {
      const u = x / N;
      const flank = Math.max(lineMask(u, 0.25, 0.07, 0.03), lineMask(u, 0.75, 0.07, 0.03));
      const ribs = 0.5 + 0.5 * Math.cos(v * Math.PI * 2 * 26);
      grip[y * N + x] = 0 * flank * ribs;   // (grip ribs removed: they strobed under the rim light)
      // the battery's lower edge: a panel line low on each flank (the frame carries on below it)
      seam[y * N + x] = (1 - smooth(0.9, 0.97, v)) * Math.max(lineMask(u, 0.158, 0.0013, 0.0012), lineMask(u, 0.842, 0.0013, 0.0012));
    }
  }
  const opt = { wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping };
  return {
    batAlbedo: dataTexture(N, N, (x, y, i) => (0.88 + 0.12 * mottle[i]) * (1 - 0.12 * grip[i]) * (1 - 0.6 * seam[i]), { srgb: true, ...opt }),
    batSeamAO: dataTexture(N, N, (x, y, i) => 1 - 0.75 * seam[i], opt),
  };
}

/** Tiling metre-scale noise for box-projected parts (arms, housings, legs, gimbal). */
function tileTextures(N) {
  const mottle = fbm(N, N, 101, [[4, 4, 1], [8, 8, 0.5], [16, 16, 0.25], [64, 64, 0.08]]);
  const blotch = fbm(N, N, 103, [[6, 6, 1], [24, 24, 0.55], [96, 96, 0.3]]);
  const grain = fbm(N, N, 107, [[64, 64, 1], [128, 128, 0.7], [256, 256, 0.5]]);
  return {
    mottle: dataTexture(N, N, (x, y, i) => 0.88 + 0.12 * mottle[i], { srgb: true }),
    rough: dataTexture(N, N, (x, y, i) => 0.62 + 0.38 * blotch[i]),
    grain: dataTexture(N, N, (x, y, i) => grain[i]),
  };
}

/** Circular brushing for lathe parts: u runs around the axis, so streaks along v read as radial... we want
 *  concentric marks, i.e. variation along v (the profile) and long correlation along u. */
function brushedTexture(N) {
  const f = fbm(N, N, 131, [[2, 96, 1], [4, 192, 0.6], [8, 384, 0.35]]);
  return dataTexture(N, N, (x, y, i) => 0.55 + 0.45 * f[i]);
}

/** Blade atlas. u = span (root 0 → tip 1), v = chord (upper surface 0..0.5, lower 0.5..1). */
function bladeTextures(W, H) {
  const f = fbm(W, H, 151, [[16, 4, 1], [128, 32, 0.4]]);        // albedo variation
  const fr = fbm(W, H, 157, [[8, 2, 1], [64, 16, 0.5]]);          // roughness: an independent field
  const tip = (u) => smooth(0.885, 0.895, u);
  const opt = { wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping };
  return {
    bladeAlbedo: dataTexture(W, H, (x, y, i) => {
      const u = x / (W - 1), k = tip(u);
      const g = 0.17 * (0.94 + 0.12 * f[i]);
      // tip band: DJI enterprise props carry an orange tip (see the M3E/M3T product photos)
      return [g + (0.86 - g) * k, g + (0.3 - g) * k, g * 1.03 + (0.09 - g) * k];
    }, { srgb: true, ...opt }),
    bladeRough: dataTexture(W, H, (x, y, i) => 0.5 + 0.14 * fr[i] - 0.08 * tip(x / (W - 1)), opt),
  };
}

/** Rotor blur disc: radial alpha (hub → tip) with two faint blade smears and the orange tip ring. */
function discTexture(N) {
  const f = fbm(N, N, 171, [[24, 24, 1], [64, 64, 0.5]]);
  const c = (N - 1) / 2;
  const col = (x, y) => {
    const dx = (x - c) / c, dy = (y - c) / c, r = Math.hypot(dx, dy);
    const k = 0.12 * smooth(0.875, 0.9, r) * (1 - smooth(0.985, 1.0, r));   // the orange tips, smeared to a faint warm hint
    const g = 0.14;
    return [g + (0.5 - g) * k, g + (0.22 - g) * k, g + (0.11 - g) * k];
  };
  const a = (x, y, i) => {
    const dx = (x - c) / c, dy = (y - c) / c, r = Math.hypot(dx, dy);
    if (r > 1) return 0;
    const ang = Math.atan2(dy, dx);
    const smear = 0.7 + 0.3 * Math.pow(0.5 + 0.5 * Math.cos(2 * ang), 3);
    const radial = smooth(0.1, 0.25, r) * (1 - smooth(0.95, 1.0, r)) * (0.42 + 0.58 * (1 - r));
    const ring = smooth(0.89, 0.905, r) * (1 - smooth(0.975, 0.995, r)) * 0.025;
    return Math.min(1, (radial * smear + ring) * (0.9 + 0.2 * f[i]));
  };
  return dataTexture(N, N, (x, y) => col(x, y), { srgb: true, alpha: a, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
}

/* ------------------------------------------------------------------ materials */
export function createM3TMaterials({ detail = 'hero', texSize } = {}) {
  const hero = detail !== 'table';
  const N = texSize || (hero ? 1024 : 0);
  const T = {};
  if (N) {
    Object.assign(T, shellTextures(N), batteryTextures(Math.max(256, N / 2)), tileTextures(Math.min(512, N)));
    T.brushed = brushedTexture(256);
  }
  Object.assign(T, bladeTextures(hero ? 512 : 128, hero ? 64 : 16));
  T.disc = discTexture(hero ? 256 : 128);

  const withRepeat = (tex, metres) => { const t = tex.clone(); t.repeat.set(1 / metres, 1 / metres); t.needsUpdate = true; return t; };
  const own = [];   // textures cloned per material (disposed with it)
  const tile = (tex, metres) => { const t = withRepeat(tex, metres); own.push(t); return t; };

  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);

  // Enterprise grey: DJI's M3E/M3T shell reads as a cool dark slate grey under studio light.
  const SHELL = 0x41444a, PLASTIC = 0x3e4146, DARK = 0x1b1c1f;
  const M = {
    shell: phys({ name: 'm3t-shell', color: SHELL, roughness: 0.62, metalness: 0, clearcoat: hero ? 0.12 : 0, clearcoatRoughness: 0.5, envMapIntensity: 0.9 }),
    battery: phys({ name: 'm3t-battery', color: 0x323438, roughness: 0.66, metalness: 0, clearcoat: hero ? 0.08 : 0, clearcoatRoughness: 0.55, envMapIntensity: 0.9 }),
    plastic: std({ name: 'm3t-plastic', color: PLASTIC, roughness: 0.6, metalness: 0, envMapIntensity: 0.9 }),
    plasticDark: phys({ name: 'm3t-plastic-dark', color: DARK, roughness: 0.32, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.25 }),
    rubber: std({ name: 'm3t-rubber', color: 0x161617, roughness: 0.92, metalness: 0 }),
    bell: std({ name: 'm3t-motor-bell', color: 0x5d6066, roughness: 0.34, metalness: 1, envMapIntensity: 1.1 }),
    metal: std({ name: 'm3t-metal-bright', color: 0xa9adb3, roughness: 0.26, metalness: 1 }),
    metalDark: std({ name: 'm3t-metal-dark', color: 0x2f3134, roughness: 0.36, metalness: 0.85 }),
    glass: phys({ name: 'm3t-glass', color: 0x030405, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02,
      iridescence: hero ? 0.55 : 0, iridescenceIOR: 1.45, iridescenceThicknessRange: [420, 580], envMapIntensity: 1.4 }),
    glassDeep: phys({ name: 'm3t-glass-deep', color: 0x0a1220, roughness: 0.18, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.05,
      iridescence: hero ? 0.8 : 0, iridescenceIOR: 1.6, iridescenceThicknessRange: [250, 450] }),
    // germanium window: near-black, metallic-looking, with a faint blue-violet thin-film sheen
    germanium: phys({ name: 'm3t-germanium', color: 0x15121c, roughness: 0.07, metalness: 0.7, clearcoat: 1, clearcoatRoughness: 0.03,
      iridescence: hero ? 1 : 0, iridescenceIOR: 1.35, iridescenceThicknessRange: [300, 330], envMapIntensity: 1.5,
      sheen: hero ? 0.3 : 0, sheenColor: 0x5a48c8, sheenRoughness: 0.4 }),
    vent: std({ name: 'm3t-vent', color: 0x08080a, roughness: 0.85, metalness: 0 }),
    blade: std({ name: 'm3t-blade', color: 0xffffff, roughness: 0.6, metalness: 0.02, map: T.bladeAlbedo, roughnessMap: T.bladeRough,
      side: THREE.DoubleSide, transparent: true, opacity: 1 }),
    disc: std({ name: 'm3t-rotor-blur', color: 0xffffff, roughness: 0.7, metalness: 0, map: T.disc, transparent: true, opacity: 0,
      depthWrite: false, side: THREE.DoubleSide }),
    ledRed: std({ name: 'm3t-led-red', color: 0x3a0806, roughness: 0.35, emissive: 0xff2414, emissiveIntensity: 1.6 }),
    ledGreen: std({ name: 'm3t-led-green', color: 0x07240c, roughness: 0.35, emissive: 0x2cff6a, emissiveIntensity: 1.1 }),
    ledWhite: std({ name: 'm3t-led-white', color: 0x2a2a2a, roughness: 0.3, emissive: 0xfff4e6, emissiveIntensity: 0.55 }),
    ledAmber: phys({ name: 'm3t-beacon-lens', color: 0x2a1a08, roughness: 0.15, transmission: 0, clearcoat: 1, emissive: 0xffa040, emissiveIntensity: 0.12 }),
    core: std({ name: 'm3t-seam-core', color: 0x17181a, roughness: 0.8, metalness: 0 }),
    face: phys({ name: 'm3t-camera-face', color: 0x2a2c30, roughness: 0.42, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
    bezel: std({ name: 'm3t-window-frame', color: 0x4a4e54, roughness: 0.3, metalness: 0.7 }),
    cavity: std({ name: 'm3t-lens-cavity', color: 0x111215, roughness: 0.6, metalness: 0.2 }),
  };
  M.blade.userData.baseOpacity = 1;

  if (N) {
    // shell + battery: seams/mottle in loft space (uv), grain and roughness in metre space (uv1) so nothing
    // pinches where the loft closes at the nose and tail
    const ch1 = (t) => { t.channel = 1; return t; };
    Object.assign(M.shell, { map: T.shellAlbedo, aoMap: T.shellSeamAO, aoMapIntensity: 1, roughnessMap: ch1(tile(T.rough, 0.05)), bumpMap: ch1(tile(T.grain, 0.010)), bumpScale: 0.3 });
    Object.assign(M.battery, { map: T.batAlbedo, aoMap: T.batSeamAO, aoMapIntensity: 1, roughnessMap: ch1(tile(T.rough, 0.05)), bumpMap: ch1(tile(T.grain, 0.010)), bumpScale: 0.3 });
    M.shell.userData.boxUV1 = true; M.battery.userData.boxUV1 = true;
    Object.assign(M.plastic, { map: tile(T.mottle, 0.12), roughnessMap: tile(T.rough, 0.06), bumpMap: tile(T.grain, 0.010), bumpScale: 0.32 });
    Object.assign(M.rubber, { bumpMap: tile(T.grain, 0.006), bumpScale: 0.8 });
    Object.assign(M.bell, { roughnessMap: T.brushed });
    M.plastic.userData.boxUV = true; M.rubber.userData.boxUV = true;
    // cheap locality bake (vertex AO) on the matte plastics
    for (const k of ['shell', 'battery', 'plastic', 'rubber', 'plasticDark', 'face']) M[k].vertexColors = true;
  }

  const dispose = () => {
    for (const m of Object.values(M)) m.dispose();
    for (const t of Object.values(T)) t.dispose();
    for (const t of own) t.dispose();
  };
  return { M, T, dispose };
}
