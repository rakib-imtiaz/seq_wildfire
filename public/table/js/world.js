// Command Table: the world, assembled. The precision terrain slab (land, cut strata walls, water,
// forest, dam, power, roads, truck) on a machined base plate, on a dark matte operations table in a
// dim room. No sky dome: the room is dark; a warm low key light is the dusk sun, a cool fill and a
// painted room environment give the shadows colour and the metals something to reflect.
//
// Light is a set of numbers (LOOKS) blended by the state: dusk → blue hour → night. Nothing in a
// look compiles a shader; the sun's direction never changes (its terrain shadows are baked once).
//
// For wave 2: world.groundAt / surfaceAt, world.truck.bedTop, world.power.chain (attachment points),
// world.dam, world.forest.trees, and userData.thermal on every mesh (what it is, for the heat view).
import * as THREE from 'three';
import { ZONE } from './zone.js';
import { SLAB, LEVELS, DAM, polySD } from './layout.js';
import { buildHeightfield, buildMasks, buildTerrainMesh, buildWalls, makeNoise, groundAt, TERRAIN, PADS, ROADS, riverSD, WALL_ROOM } from './terrain.js';
import { SHARED, patchMaterial } from './shading.js';
import { SunMask } from './sunmask.js';
import { Water } from './water.js';
import { Forest } from './forest.js';
import { Dam } from './dam.js';
import { Power } from './power.js';
import { Truck } from './truck.js';
import { Parts } from './kit.js';
import { pointAt } from './layout.js';

const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);

/** The dusk sun's direction (toward the light): low, from the south-west (ahead and to the left of the hero
 *  camera, which looks west: it grazes the ridges from the left and rims their crests). */
export const SUN_AZ = 215, SUN_EL = 13;
export const SUN_DIR = (() => {
  const az = THREE.MathUtils.degToRad(SUN_AZ), el = THREE.MathUtils.degToRad(SUN_EL);   // azimuth from north, clockwise
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
})();

/** Light looks per state (linear colours). */
export const LOOKS = {
  dusk: {
    // a strong warm key low from the south-west (rims the crests), a cool blue-hour fill in the shadows,
    // haze in the valley lit cool away from the sun and warm toward it
    sun: 10, sunCol: lin(1.0, 0.5, 0.21), fill: 1.7, fillSky: lin(0.2, 0.32, 0.66), fillGround: lin(0.05, 0.045, 0.04),
    env: 0.5, exposure: 2.0, beacon: 1, head: 0,
    hazeCool: lin(0.045, 0.062, 0.105), hazeWarm: lin(0.42, 0.21, 0.08), haze: 0.7,
    skyLow: lin(0.07, 0.085, 0.12), skyHigh: lin(0.012, 0.02, 0.05), skyWarm: lin(1.5, 0.52, 0.12), room: lin(0.0045, 0.0042, 0.004), roomLight: lin(0.5, 0.42, 0.34),
  },
  blue: {
    sun: 2.4, sunCol: lin(1.0, 0.5, 0.3), fill: 1.3, fillSky: lin(0.26, 0.36, 0.62), fillGround: lin(0.06, 0.06, 0.07),
    env: 0.5, exposure: 1.65, beacon: 1, head: 1,
    hazeCool: lin(0.035, 0.045, 0.075), hazeWarm: lin(0.14, 0.09, 0.07), haze: 0.5,
    skyLow: lin(0.07, 0.07, 0.11), skyHigh: lin(0.008, 0.013, 0.03), skyWarm: lin(0.42, 0.2, 0.1), room: lin(0.004, 0.004, 0.0045), roomLight: lin(0.42, 0.42, 0.46),
  },
  night: {
    sun: 1.0, sunCol: lin(0.6, 0.62, 0.8), fill: 1.1, fillSky: lin(0.2, 0.26, 0.42), fillGround: lin(0.04, 0.04, 0.05),
    env: 0.35, exposure: 1.6, beacon: 1, head: 1,
    hazeCool: lin(0.04, 0.05, 0.08), hazeWarm: lin(0.06, 0.06, 0.08), haze: 0.35,
    skyLow: lin(0.04, 0.045, 0.06), skyHigh: lin(0.01, 0.015, 0.03), skyWarm: lin(0.1, 0.08, 0.08), room: lin(0.0035, 0.0035, 0.004), roomLight: lin(0.36, 0.38, 0.45),
  },
};

/** A painted dark room → PMREM: a warm glow toward the key light, a cool strip opposite, dark everywhere else. */
function roomEnvironment(renderer) {
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#0d0e11'); grd.addColorStop(0.45, '#1c1d20'); grd.addColorStop(0.52, '#141312'); grd.addColorStop(1, '#070706');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  const blob = (x, y, rx, ry, col) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.translate(x, y); g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); g.translate(-x, -y);
    g.fillStyle = rg; g.fillRect(x - Math.max(rx, ry), y - Math.max(rx, ry), Math.max(rx, ry) * 2, Math.max(rx, ry) * 2); g.restore();
  };
  // equirect u: azimuth. The key light (sun azimuth 203°) and a cool fill opposite
  const u = (azDeg) => (((azDeg + 90) % 360) / 360) * W;
  blob(u(SUN_AZ), H * 0.43, 120, 34, 'rgba(255,170,100,0.85)');
  blob(u(SUN_AZ + 180), H * 0.38, 150, 40, 'rgba(110,140,190,0.45)');
  blob(W / 2, H * 0.05, 260, 40, 'rgba(60,64,72,0.5)');
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromEquirectangular(tex).texture;
  pm.dispose(); tex.dispose();
  return env;
}

export class World {
  constructor(renderer, Q) {
    this.Q = Q;
    const t0 = performance.now();
    this.scene = new THREE.Scene();
    this.scene.name = 'table';
    this.scene.background = null;

    /* the land */
    buildHeightfield(Q.tier);
    const tH = performance.now();
    buildMasks(Q.tier);
    this.noise = makeNoise(Q.aniso);
    this.terrain = buildTerrainMesh(this.noise);
    this.terrain.receiveShadow = Q.shadows;
    this.walls = buildWalls(this.noise);
    this.walls.receiveShadow = Q.shadows;
    this.scene.add(this.terrain, this.walls);

    /* the sun's terrain shadows (baked), then the water (which reuses the height texture) */
    this.sunMask = new SunMask(renderer, { res: Q.tier === 'lite' ? 512 : 1024 });
    this.sunMask.bake(SUN_DIR);
    this.water = new Water(this.noise, this.sunMask.hTex);
    this.scene.add(this.water.group);

    /* structures */
    this.dam = new Dam(Q, this.noise);
    this.power = new Power(Q);
    this.truck = new Truck(Q);
    this.scene.add(this.dam.group, this.power.group, this.truck.group);
    this.bridge = buildBridge(Q);
    this.scene.add(this.bridge.group);

    /* the forest (kept off the structures) */
    const keepOut = (x, z, r) => {
      for (const p of this.power.chain) { if (p.base && Math.hypot(x - p.base.x, z - p.base.z) < 14 + r) return true; }
      const t = ZONE.truckStart; if (Math.hypot(x - t.x, z - t.z) < 16) return true;
      return false;
    };
    this.forest = new Forest(Q, keepOut);
    this.scene.add(this.forest.group);

    /* the base plate and the table */
    this.base = buildBase();
    this.table = buildTable();
    this.scene.add(this.base, this.table);

    /* lights */
    this.env = roomEnvironment(renderer);
    this.scene.environment = this.env;
    this.scene.environmentIntensity = 0.42;
    this.sun = new THREE.DirectionalLight(0xffffff, 4);
    this.sun.position.copy(SUN_DIR).multiplyScalar(3000);
    this.sun.target.position.set(0, 0, 0);
    this.scene.add(this.sun, this.sun.target);
    if (Q.shadows) {
      // high tier: a real shadow map for what the baked mask cannot see (trees, the dam, the props)
      this.sun.castShadow = true;
      const s = this.sun.shadow;
      s.mapSize.set(4096, 4096);
      const cam = s.camera;
      // fit the slab in the light's view
      const lightView = new THREE.Matrix4().lookAt(this.sun.position, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
      const inv = lightView.clone().invert();
      const box = new THREE.Box3();
      for (const x of [SLAB.x0, SLAB.x1]) for (const z of [SLAB.z0, SLAB.z1]) for (const y of [SLAB.base, 260]) box.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(inv));
      cam.left = box.min.x - 10; cam.right = box.max.x + 10; cam.bottom = box.min.y - 10; cam.top = box.max.y + 10;
      cam.near = 10; cam.far = 3000 + 2200;
      cam.updateProjectionMatrix();
      s.bias = -0.0004; s.normalBias = 0.6;
      s.autoUpdate = false; s.needsUpdate = true;
    }
    this.hemi = new THREE.HemisphereLight(0x8899bb, 0x221a14, 0.5);
    this.scene.add(this.hemi);

    this.look = {};
    this.applyLook(LOOKS.dusk);
    this.buildMs = performance.now() - t0;
    this.heightMs = tH - t0;
  }

  /** Blend of looks (a, b, t) → lights, haze, water, the room. */
  applyLook(a, b = null, t = 0) {
    const L = this.look;
    const mix = (k) => {
      const va = a[k], vb = b ? b[k] : va;
      if (va instanceof THREE.Color) return (L[k] || (L[k] = new THREE.Color())).copy(va).lerp(vb, t);
      return va + (vb - va) * t;
    };
    for (const k of Object.keys(LOOKS.dusk)) L[k] = mix(k);
    this.sun.color.copy(L.sunCol); this.sun.intensity = L.sun;
    this.hemi.color.copy(L.fillSky); this.hemi.groundColor.copy(L.fillGround); this.hemi.intensity = L.fill;
    this.scene.environmentIntensity = L.env;
    SHARED.uHazeCool.value.copy(L.hazeCool); SHARED.uHazeWarm.value.copy(L.hazeWarm); SHARED.uHaze.value.w = L.haze;
    this.water.setLook({ skyLow: L.skyLow, skyHigh: L.skyHigh, skyWarm: L.skyWarm, sunCol: L.sunCol.clone().multiplyScalar(L.sun * 0.25) });
    this.truck.setLights({ beacon: L.beacon, head: L.head });
    TABLE_ROOM.value.copy(L.roomLight);
    WALL_ROOM.value.copy(L.roomLight).multiplyScalar(0.55);
    return L;
  }

  /** Continuous motion (a clock, not the scroll): water ripples, the beacon's flash. Also re-binds this
   *  world's shared shader values (sun mask, haze), so two mounted tables never read each other's. */
  update(time, still = false) {
    this.sunMask.bind();
    SHARED.uHazeCool.value.copy(this.look.hazeCool); SHARED.uHazeWarm.value.copy(this.look.hazeWarm); SHARED.uHaze.value.w = this.look.haze;
    TABLE_ROOM.value.copy(this.look.roomLight);
    WALL_ROOM.value.copy(this.look.roomLight).multiplyScalar(0.55);
    SHARED.uTime.value = time;
    this.water.update(still ? 0 : time);
    // the beacon flashes (a double pulse every 1.2 s); a still frame shows it lit
    const ph = (time % 1.2) / 1.2;
    const pulse = still ? 1 : Math.max(Math.exp(-((ph - 0.08) ** 2) / 0.0018), Math.exp(-((ph - 0.28) ** 2) / 0.0018)) * 0.85 + 0.15;
    this.truck.setLights({ beacon: this.look.beacon * pulse, head: this.look.head });
  }

  /** Height of the walkable top at (x, z): the dam crest, the bridge deck, water surfaces, or the land. */
  surfaceAt(x, z) {
    const c = this.dam.crestAt(x, z);
    if (c !== null) return c;
    const b = this.bridge.deckAt(x, z);
    if (b !== null) return b;
    const g = groundAt(x, z);
    if (polySD(ZONE.reservoir, x, z) < 0) return Math.max(g, LEVELS.reservoir);
    return g;
  }
  groundAt(x, z) { return groundAt(x, z); }

  /** Step 4's map look (0 visible .. 1 dark hillshade with contours). */
  setMapMode(v) { SHARED.uMap.value = v; }

  get pullout() { return PADS.find((p) => p.name === 'pullout'); }

  dispose() {
    this.dam.dispose(); this.power.dispose(); this.truck.dispose(); this.forest.dispose(); this.water.dispose(); this.bridge.dispose();
    this.sunMask.dispose();
    for (const m of [this.terrain, this.walls, this.base, this.table]) {
      m.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((mm) => mm.dispose()); });
    }
    this.env.dispose();
    if (this.sun.shadow.map) this.sun.shadow.map.dispose();
    this.scene.clear();
  }
}

/* --------------------------------------------------------------- the bridge */
/** The branch road's bridge over the river: a concrete deck on two abutments, with kerbs. */
function buildBridge(Q) {
  const road = ROADS.find((r) => r.name === 'branch'), br = road.bridge;
  const P = new Parts();
  const p = pointAt(road.L, br.s);
  const half = 20;                        // deck half length along the road
  const a = new THREE.Vector3(p.x - p.tx * half, br.y, p.z - p.tz * half), b = new THREE.Vector3(p.x + p.tx * half, br.y, p.z + p.tz * half);
  const ry = Math.atan2(p.tx, p.tz);      // local +z along the road
  const mid = a.clone().add(b).multiplyScalar(0.5);
  P.box('concrete', 8.4, 1.1, half * 2, mid.x, br.y - 0.55, mid.z, ry);
  P.box('asphalt', 7.2, 0.06, half * 2, mid.x, br.y + 0.03, mid.z, ry);
  for (const s of [-1, 1]) {
    const o = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry)).multiplyScalar(s * 3.9);
    P.box('concrete', 0.5, 0.8, half * 2, mid.x + o.x, br.y + 0.4, mid.z + o.z, ry);
  }
  // abutments (down to the ground at each end) and a pier mid-river
  for (const e of [a, b]) {
    const g = groundAt(e.x, e.z);
    const h = br.y - 1.1 - g + 3;
    if (h > 0.2) P.box('concrete', 9, h, 3, e.x, g - 3 + h / 2, e.z, ry);
  }
  const gm = groundAt(mid.x, mid.z);
  P.box('concrete', 7, br.y - 1.1 - gm + 2, 1.6, mid.x, (br.y - 1.1 + gm - 2) / 2, mid.z, ry);
  const std = (name, o) => patchMaterial(new THREE.MeshStandardMaterial({ name, envMapIntensity: 0.6, ...o }), { key: 'std' });
  const materials = { concrete: std('bridge-concrete', { color: 0x9e988c, roughness: 0.88 }), asphalt: std('bridge-deck', { color: 0x3a3936, roughness: 0.9 }) };
  const group = new THREE.Group(); group.name = 'table:bridge';
  P.build(group, materials, { shadows: Q.shadows, name: 'bridge', thermal: { concrete: 'concrete', asphalt: 'asphalt' } });
  const inv = new THREE.Matrix4().makeRotationY(-ry);
  return {
    group,
    deckAt(x, z) {
      const d = new THREE.Vector3(x - mid.x, 0, z - mid.z).applyMatrix4(inv);
      return Math.abs(d.x) < 3.6 && Math.abs(d.z) < half ? br.y + 0.06 : null;
    },
    dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); Object.values(materials).forEach((m) => m.dispose()); },
  };
}

/* ----------------------------------------------------------- base and table */
function buildBase() {
  const g = new THREE.Group(); g.name = 'table:base';
  const m = new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.38, metalness: 0.7, envMapIntensity: 1.0, name: 'table-plinth' });
  patchMaterial(m, { key: 'plinth', haze: false, sun: false });
  const o = 4;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(SLAB.w + o * 2, SLAB.plinth, SLAB.d + o * 2), m);
  plate.position.set(0, SLAB.base - SLAB.plinth / 2, 0);
  plate.name = 'table:plinth';
  g.add(plate);
  // a thin brighter chamfer line along the plate's top edge (machined)
  const em = new THREE.MeshStandardMaterial({ color: 0x55575a, roughness: 0.25, metalness: 0.9, envMapIntensity: 1.3, name: 'table-plinth-edge' });
  patchMaterial(em, { key: 'plinth-edge', haze: false, sun: false });
  const ew = 0.9;
  for (const [w, d, x, z] of [[SLAB.w + o * 2, ew, 0, -(SLAB.d / 2 + o - ew / 2)], [SLAB.w + o * 2, ew, 0, SLAB.d / 2 + o - ew / 2], [ew, SLAB.d + o * 2, -(SLAB.w / 2 + o - ew / 2), 0], [ew, SLAB.d + o * 2, SLAB.w / 2 + o - ew / 2, 0]]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.5, d + 0.02), em);
    e.position.set(x, SLAB.base - 0.24, z);
    g.add(e);
  }
  g.traverse((c) => { if (c.isMesh) c.userData.thermal = 'plinth'; });
  return g;
}

/** The operations room's dim overhead light on the table around the slab (set per look). */
const TABLE_ROOM = { value: new THREE.Color(0.2, 0.2, 0.2) };

function buildTable() {
  const W = 9000, D = 6400, T = 60;
  const m = new THREE.MeshStandardMaterial({ color: 0x22211f, roughness: 0.96, metalness: 0, envMapIntensity: 0.45, name: 'table-top' });
  patchMaterial(m, {
    key: 'tabletop', haze: false,
    // a soft pool of the room's light hugging the plinth, falling to black within ~250 m (no sun: a lit
    // patch of table beside the slab read as a smudge behind the hero copy)
    fragPars: 'uniform vec3 uRoomLight; float tablePool( vec3 p ) { vec2 q = max( abs( p.xz ) - vec2( 806.0, 506.0 ), 0.0 ); return exp( -length( q ) / 110.0 ); }',
    color: '{ vec2 q = vTWp.xz; float n = fract( sin( dot( floor( q * 0.6 ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); diffuseColor.rgb *= 0.96 + 0.04 * n; }',
    vis: 'tSunVis = 0.0;',
    uniforms: { uRoomLight: TABLE_ROOM },
    end: 'gl_FragColor.rgb *= mix( 0.04, 1.0, tablePool( vTWp ) ); gl_FragColor.rgb += diffuseColor.rgb * uRoomLight * 0.45 * tablePool( vTWp );',
  });
  const g = new THREE.BoxGeometry(W, T, D);
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(250, SLAB.table - T / 2, 0);
  mesh.name = 'table:tabletop';
  mesh.userData.thermal = 'table';
  return mesh;
}

export { TERRAIN, PADS, ROADS, riverSD, DAM };
