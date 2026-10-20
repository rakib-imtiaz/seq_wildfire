// v3 Maquette: the one WebGL engine for the page.
//
//   const m = await createMaquette(canvas, { zone, quality, live, preserve, onLost })
//   m.setProgress(P)   P in 0..6, the beat float (hero, lenses, coverage, team, heat, map, report). Live: eased
//                      toward on the render clock. Every spatial state is a pure function of P (make_3d_website);
//                      continuous motion (props, hover bob, a slow orbit) runs on a separate clock.
//   m.jump(P)          set P immediately and render (review seeks, ?frame=, ?beat=)
//   m.setLens(id)      'all' | 'wide' | 'tele' | 'thermal': isolate one lens in the coverage beat
//   m.onFrame(cb)      cb({ P, labels }) after every render; labels[id] = { x, y, a } in canvas CSS px
//   m.renderStill(P, w, h, { lens }) → Promise<{ url, labels, w, h }>   (the static page's figures)
//   m.resize(), m.stats(), m.dispose()
//
// One scale for everything: the land, the infrastructure and the M3T are all 1:250 (MODEL.S), so the drone is
// 1.4 mm of studio over a 6.4 m model, 106 m above the ground it watches, and its lens footprints are true to it.
// The camera does the rest: a macro close-up of the aircraft in the opening beats, then a pull-back until it is
// a point at the apex of its own field of view. Where it is smaller than a pixel a map symbol marks it.
//
// Two passes, one context: the land (layer 0) and the aircraft (layer 1) are lit by the same key, but each pass has
// its own shadow-casting copy of it, framed on what it shades (the whole model; the 0.4 m aircraft).
// The first frame is rendered synchronously at the end of createMaquette, so a hidden tab still gets a picture.
import { loadThree, loadM3T, clamp, lerp, ease, win } from './util.js';
import { densify } from './util.js';
import { MODEL, buildTerrainData, buildTerrain, buildWater, buildTextures } from './terrain.js';
import { createPlasterKit } from './plaster.js';
import { buildMassing } from './massing.js';
import { buildForest } from './forest.js';
import { createPathLine, createTicks, createCone } from './lines.js';
import { LENSES, STANDOFF } from './optics.js';

export { webglAvailable } from './util.js';

const STUDIO = 0xe2e3e0;
// HEADING, TILT and the hover point are solved from the slope at the hotspot (see 'the M3T' below)
const AGL = 110;              // cruise height above the surface on the way out, zone metres
const KEY = { az: 230, el: 62 };  // studio key light from the north-west: upper left on the north-up map
const N = 7;
const BEAT_IDS = ['hero', 'lenses', 'coverage', 'team', 'heat', 'map', 'report'];
const L_LAND = 0, L_CRAFT = 1;

/* per-beat values, eased between neighbours */
const CONE = [[0, 0, 1, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0, 0], [0, 0, 1, 0, 0.9, 0, 0.9]];
// the footprints draped on the land (coverage beat); from the heat beat on, the thermal footprint is a cased
// outline over the canopy instead (the heat itself is only shown through the lens, in the inset)
const FP = [[0, 0, 1, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0, 0]];
const OUTLINE_IR = [0, 0, 0, 0, 1, 1, 1];
// the routes belong to the team beat and the map; elsewhere they step back so each frame has one subject
const ROUTES = [0, 0, 0, 1, 0, 1, 0];
// the heat beat pales the land outside the thermal footprint, so the eye goes to what the lens is reading
const FOCUS = [0, 0, 0, 0, 1, 0, 0];
const ORBIT = [3.2, 1.6, 1.4, 1.0, 1.2, 0, 2.4];
// distance haze in the close beats (the studio's air over a long model), starting this far beyond the framed
// subject (zone metres); off for the overviews
const HAZE = [1, 1, 1, 0, 1, 0, 0];
const HAZE_NEAR = [70, 70, 240, 240, 240, 240, 240];
// the engraved contours: faint on the model, inked in while it is the map, faint again for the closing shot
const INK = [[0.14, 0.26], [0.14, 0.26], [0.14, 0.26], [0.16, 0.3], [0.14, 0.26], [0.36, 0.66], [0.14, 0.26]];

function keyed(arr, P) {
  const k = Math.min(N - 2, Math.max(0, Math.floor(P)));
  return lerp(arr[k], arr[k + 1], ease(P - k));
}

export async function createMaquette(canvas, opts = {}) {
  const t0 = performance.now();
  const T = await loadThree();
  const [{ buildM3T }, { RoomEnvironment }] = await loadM3T();
  const { zone } = opts;
  const high = opts.quality === 'high';
  const live = opts.live !== false;
  const S = MODEL.S;

  /* ---------------------------------------------------------------- renderer */
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve });
  renderer.setClearColor(new T.Color(STUDIO), 1);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.autoClear = false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  let dprCap = high ? 1.75 : coarse ? 1.5 : 1.3;
  const dpr = () => Math.min(window.devicePixelRatio || 1, dprCap);

  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envRT = pmrem.fromScene(room, 0.04);
  room.dispose();
  pmrem.dispose();
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.36;
  const haze = new T.Fog(STUDIO, 1e3, 2e3);
  scene.fog = haze;

  /* ---------------------------------------------------------------- the model */
  const tb = performance.now();
  const data = buildTerrainData(zone, { step: high ? 6 : 8 });
  const tex = buildTextures(T, zone, data);
  const kit = createPlasterKit(T, tex);
  kit.U.uHot.value.set(zone.hotspot.x, zone.hotspot.z, zone.hotspot.peakC);
  const terr = buildTerrain(T, zone, data);
  const water = buildWater(T, zone, data);
  const buildMs = performance.now() - tb;
  const model = new T.Group();
  model.name = 'maquette';
  const mesh = (g, m, name) => {
    const o = new T.Mesh(g, m);
    o.name = name;
    o.castShadow = true;
    o.receiveShadow = true;
    model.add(o);
    return o;
  };
  mesh(terr.surface, kit.surface, 'surface');
  mesh(terr.sides, kit.sides, 'model_sides');
  const wr = mesh(water.reservoir, kit.water, 'reservoir');
  const wv = mesh(water.river, kit.water, 'river');
  wr.castShadow = wv.castShadow = false;
  const W = MODEL.W * S, D = MODEL.D * S;
  const { RoundedBoxGeometry } = await import(/* @vite-ignore */ new URL('/table/vendor/three/examples/jsm/geometries/RoundedBoxGeometry.js', location.origin).href);
  const baseG = new RoundedBoxGeometry(W + 2 * MODEL.OUT, MODEL.BASE, D + 2 * MODEL.OUT, 3, 0.012);
  const base = new T.Mesh(baseG, kit.base);
  base.position.y = -MODEL.BASE / 2;
  base.receiveShadow = true;
  base.castShadow = true;
  model.add(base);
  const massing = buildMassing(T, zone, data, kit);
  model.add(massing.group);
  const forest = buildForest(T, zone, data, tex, kit.trees, { count: high ? 30000 : 22000 });
  model.add(forest.group);
  scene.add(model);

  // studio floor: unlit, exactly the page colour, so the canvas has no edge; a shadow catcher and a soft contact
  // gradient around the base board ground the model
  const floorY = -MODEL.BASE;
  const floorG = new T.PlaneGeometry(400, 400);
  const floor = new T.Mesh(floorG, new T.MeshBasicMaterial({ color: STUDIO, toneMapped: false, fog: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY - 0.001;
  scene.add(floor);
  const catcher = new T.Mesh(new T.PlaneGeometry(40, 40), new T.ShadowMaterial({ color: 0x1a1c1e, opacity: 0.16, toneMapped: false }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = floorY + 0.0004;
  catcher.receiveShadow = true;
  scene.add(catcher);
  const contact = (() => {
    const cv = document.createElement('canvas');
    cv.width = 320; cv.height = 220;
    const g = cv.getContext('2d');
    const pad = 46;
    g.filter = 'blur(18px)';
    g.fillStyle = 'rgba(0,0,0,0.9)';
    g.fillRect(pad, pad, cv.width - 2 * pad, cv.height - 2 * pad);
    const t = new T.CanvasTexture(cv);
    t.colorSpace = T.SRGBColorSpace;
    const m = new T.Mesh(new T.PlaneGeometry((W + 2 * MODEL.OUT) * 1.42, (D + 2 * MODEL.OUT) * 1.62), new T.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false, color: 0x1a1c1e }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = floorY + 0.0002;
    m.renderOrder = -1;
    scene.add(m);
    return { m, t };
  })();

  /* ---------------------------------------------------------------- light */
  const kd = new T.Vector3(Math.sin((KEY.az * Math.PI) / 180) * Math.cos((KEY.el * Math.PI) / 180), Math.sin((KEY.el * Math.PI) / 180), Math.cos((KEY.az * Math.PI) / 180) * Math.cos((KEY.el * Math.PI) / 180));
  // the key on the land: its shadow frustum covers the whole model
  const key = new T.DirectionalLight(0xfff6ec, 3.3);
  key.position.copy(kd).multiplyScalar(12);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  const SM = high ? 2048 : 1536;
  key.shadow.mapSize.set(SM, SM);
  const sc = key.shadow.camera;
  sc.left = -4.6; sc.right = 4.6; sc.top = 4.6; sc.bottom = -4.6; sc.near = 4; sc.far = 22;
  sc.updateProjectionMatrix();
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.004;
  key.shadow.radius = 3;
  key.layers.set(L_LAND);
  key.shadow.camera.layers.set(L_LAND);
  // the same key on the aircraft: a shadow frustum 0.8 m across, following it
  const craftKey = new T.DirectionalLight(0xfff6ec, 3.3);
  craftKey.castShadow = true;
  craftKey.shadow.mapSize.set(1024, 1024);
  const cc = craftKey.shadow.camera;
  cc.left = -0.4 * S; cc.right = 0.4 * S; cc.top = 0.4 * S; cc.bottom = -0.4 * S; cc.near = 0.2 * S; cc.far = 3 * S;
  cc.updateProjectionMatrix();
  craftKey.shadow.bias = -0.0004;
  craftKey.shadow.normalBias = 0.0012 * S;
  craftKey.shadow.radius = 2;
  craftKey.layers.set(L_CRAFT);
  craftKey.shadow.camera.layers.set(L_CRAFT);
  const fill = new T.HemisphereLight(0xf4f6f8, 0xc9cac6, 0.32);
  fill.layers.enable(L_CRAFT);
  scene.add(key, key.target, craftKey, craftKey.target, fill);

  /* ---------------------------------------------------------------- the M3T */
  const m3t = buildM3T({ detail: 'hero', texSize: high ? 1024 : 512 });
  m3t.group.traverse((o) => {
    o.layers.set(L_CRAFT);
    if (!o.isMesh) return;
    const prop = o.userData.prop || /blur|window|disc/.test(o.name);
    o.castShadow = !prop;
    o.receiveShadow = true;
  });
  const drone = new T.Group();
  drone.name = 'drone';
  drone.scale.setScalar(S);   // the real aircraft (built in metres) at the model's scale
  drone.add(m3t.group);
  scene.add(drone);
  m3t.setFold(1);
  m3t.setPropOpen(1);

  const rad = (d) => (d * Math.PI) / 180;
  // The hotspot sits on a ~37° slope. An operator squares the camera to the slope: the drone stands off along the
  // slope's normal and looks straight into it, so each lens's footprint is close to its true rectangle.
  const HOT = zone.hotspot;
  const gH = (x, z) => data.at(data.H, x, z);
  const gx = (gH(HOT.x + 40, HOT.z) - gH(HOT.x - 40, HOT.z)) / 80, gz = (gH(HOT.x, HOT.z + 40) - gH(HOT.x, HOT.z - 40)) / 80;
  const nl = Math.hypot(gx, 1, gz);
  const nrm = [-gx / nl, 1 / nl, -gz / nl];
  const HEADING = (Math.atan2(-nrm[0], -nrm[2]) * 180) / Math.PI;   // facing the hotspot
  const TILT = -(Math.asin(nrm[1]) * 180) / Math.PI;                // looking along −normal
  const PITCH = [-22, -12, TILT, TILT, TILT, TILT, TILT];
  // it holds the scan heading throughout; the opening shots look at it from the upslope side, across the valley
  const H0 = HEADING;
  const YAW = [H0, H0, HEADING, HEADING, HEADING, HEADING, HEADING];
  const hoverZ = [HOT.x + nrm[0] * STANDOFF, HOT.z + nrm[2] * STANDOFF];
  const topW = (x, z) => data.top(x / S, z / S) * S;          // the surface at world (x, z)
  const hoverW = new T.Vector3(hoverZ[0] * S, (data.top(HOT.x, HOT.z) + nrm[1] * STANDOFF) * S, hoverZ[1] * S);
  const aglM = hoverW.y / S - data.top(hoverZ[0], hoverZ[1]);
  drone.position.copy(hoverW);
  drone.rotation.y = rad(HEADING);

  /* ---------------------------------------------------------------- optics */
  const lensCams = LENSES.map((L) => new T.PerspectiveCamera(L.vfov, L.aspect, 0.05 * S, 12));
  const anchors = [m3t.anchors.wide, m3t.anchors.tele, m3t.anchors.thermal];
  const flipY = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI);
  const cones = LENSES.map(() => createCone(T));
  cones.forEach((c) => scene.add(c.group));
  const tmpV = new T.Vector3(), tmpQ = new T.Quaternion();
  function rayToSurface(o, d) {
    let t = 0, prev = 0;
    const p = new T.Vector3();
    for (let i = 0; i < 600; i++) {
      t += 0.004;
      p.copy(o).addScaledVector(d, t);
      if (p.y <= topW(p.x, p.z) || p.y < 0) {
        let a = prev, b = t;
        for (let k = 0; k < 16; k++) {
          const m = (a + b) / 2;
          p.copy(o).addScaledVector(d, m);
          if (p.y <= topW(p.x, p.z)) b = m; else a = m;
        }
        return p.copy(o).addScaledVector(d, b).clone();
      }
      prev = t;
    }
    return p.clone();
  }
  const footprints = [[], [], []];
  function updateOptics() {
    for (let i = 0; i < 3; i++) {
      const cam = lensCams[i], L = LENSES[i];
      anchors[i].getWorldPosition(cam.position);
      anchors[i].getWorldQuaternion(tmpQ);
      cam.quaternion.copy(tmpQ).multiply(flipY);
      cam.updateMatrixWorld(true);
      kit.U.uLensVP.value[i].multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      kit.U.uLensPos.value[i].copy(cam.position);
      const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      footprints[i] = ring.map(([sx, sy]) => {
        const d = tmpV.set(sx * L.th, sy * L.tv, -1).normalize().applyQuaternion(cam.quaternion).clone();
        return rayToSurface(cam.position, d);
      });
    }
  }

  /* ---------------------------------------------------------------- patrol, flight, observations */
  const lift = 0.8 * S;
  const patrolPts = densify(zone.patrol, 2).pts.map(([x, z]) => [x * S, data.top(x, z) * S + lift, z * S]);
  // routes are drawn the way a map draws them: a graphite line on a pale casing, so they read over any ground
  const patrolCase = createPathLine(T, patrolPts, { width: 6, color: '#F3F3F1', opacity: 0.92 });
  const patrol = createPathLine(T, patrolPts, { width: 2.6, color: '#1A1C1E', opacity: 1 });
  scene.add(patrolCase.mesh, patrol.mesh);
  const flightZ = [...zone.flight, hoverZ];
  const fd = densify(flightZ, 4);
  // altitude: climb out over the first fifth, then hold ~AGL over a smoothed surface profile, ending at the hover
  const smoothTop = fd.pts.map(([x, z], i) => {
    let s = 0, n = 0;
    for (let k = -10; k <= 10; k++) {
      const q = fd.pts[Math.min(fd.pts.length - 1, Math.max(0, i + k))];
      s += data.top(q[0], q[1]); n++;
    }
    return s / n;
  });
  const endY = hoverW.y / S;
  const flightPts = fd.pts.map(([x, z], i) => {
    const s = fd.s[i];
    const climb = Math.min(1, s / 0.2);
    const cl = climb * climb * (3 - 2 * climb);
    let y = smoothTop[i] + 2 + (AGL - 2) * cl;
    const tail = clamp((s - 0.86) / 0.14);
    y = lerp(y, endY, tail * tail * (3 - 2 * tail));
    return [x * S, y * S, z * S];
  });
  // the aerial route: cobalt (the aircraft's colour) dashes in the air, and its shadow track on the ground, so it
  // reads as flown, not driven
  const groundTrack = createPathLine(T, flightPts.map(([x, , z]) => [x, topW(x, z) + 0.4 * S, z]), { width: 1.6, color: '#1A1C1E', opacity: 1 });
  const flight = createPathLine(T, flightPts, { width: 2.6, color: '#2447D6', opacity: 1, dash: [0.03, 0.016], bias: 0.0002 });
  scene.add(groundTrack.mesh, flight.mesh);
  patrolCase.mesh.renderOrder = groundTrack.mesh.renderOrder = 1;
  patrol.mesh.renderOrder = flight.mesh.renderOrder = 2;
  // the thermal footprint's outline, drawn over the canopy (the heat beat on): its corners on the surface, each
  // edge densified so the line follows the ground
  const FP_SEG = 10, fpPts = Array.from({ length: 4 * FP_SEG + 1 }, () => [0, 0, 0]);
  const fpCase = createPathLine(T, fpPts, { width: 5.5, color: '#F3F3F1', opacity: 0.9, overlay: true, bias: 0 });
  const fpLine = createPathLine(T, fpPts, { width: 2.2, color: '#2447D6', opacity: 1, overlay: true, bias: 0 });
  fpCase.mesh.renderOrder = 7;
  fpLine.mesh.renderOrder = 8;
  scene.add(fpCase.mesh, fpLine.mesh);
  // [line, width px, which progress, opacity factor]
  const routeLines = [[patrolCase, 6, 'p', 0.9], [patrol, 2.6, 'p', 1], [groundTrack, 1.6, 'f', 0.28], [flight, 2.6, 'f', 1], [fpCase, 5.5, 'ir', 0.9], [fpLine, 2.2, 'ir', 1]];
  const tickSegs = [];
  for (let i = 0; i < flightPts.length; i += 9) {
    if (fd.s[i] < 0.12 || fd.s[i] > 0.97) continue;
    const [x, y, z] = flightPts[i];
    tickSegs.push([x, y, z, x, topW(x, z) + 0.001, z]);
  }
  const ticks = createTicks(T, tickSegs, { opacity: 0.28 });
  scene.add(ticks.lines);
  const launchW = new T.Vector3(...patrolPts[0]);

  const obsZ = [zone.observations[0], zone.observations[2], zone.observations[4]];
  const obsW = obsZ.map(([x, z]) => new T.Vector3(x * S, data.top(x, z) * S + 0.002, z * S));
  const hotW = new T.Vector3(HOT.x * S, data.top(HOT.x, HOT.z) * S, HOT.z * S);
  // the site's assets, for their name plates in the overviews (what the watch protects)
  const atZ = (x, z, up) => new T.Vector3(x * S, (data.top(x, z) + up) * S, z * S);
  const resC = zone.reservoir.reduce((a, [x, z]) => [a[0] + x / zone.reservoir.length, a[1] + z / zone.reservoir.length], [0, 0]);
  const midTower = zone.towers[Math.floor(zone.towers.length / 2)];
  const midRoad = zone.road[Math.floor(zone.road.length / 2)];
  const assetW = {
    dam: new T.Vector3(zone.dam.x * S, 44 * S, zone.dam.z * S),
    reservoir: new T.Vector3(resC[0] * S, data.WL * S, resC[1] * S),
    powerhouse: atZ(zone.powerhouse.x, zone.powerhouse.z, zone.powerhouse.h),
    line: atZ(midTower[0], midTower[1], 46),
    substation: atZ(zone.substation.x, zone.substation.z, 9),
    road: atZ(midRoad[0], midRoad[1], 1),
  };

  /* ---------------------------------------------------------------- camera and beats */
  const camera = new T.PerspectiveCamera(30, 1, 0.01, 120);
  const box3 = (pts, pad = 0) => {
    const b = new T.Box3();
    pts.forEach((p) => b.expandByPoint(Array.isArray(p) ? tmpV.set(...p) : p));
    b.expandByScalar(pad);
    return b;
  };
  const droneBox = (heading = HEADING) => {
    // AABB of the aircraft with its rotor discs, rotated to the heading (local metres: x ±0.28, y 0..0.11,
    // z −0.25..0.24), at the model's scale
    const pts = [];
    for (const x of [-0.28, 0.28]) for (const y of [0, 0.11]) for (const z of [-0.25, 0.24]) {
      pts.push(new T.Vector3(x, y, z).multiplyScalar(S).applyAxisAngle(new T.Vector3(0, 1, 0), rad(heading)).add(hoverW));
    }
    return box3(pts);
  };
  const corners8 = (b) => [b.min, b.max].flatMap((p, i) => [b.min, b.max].flatMap((q) => [b.min, b.max].map((r) => new T.Vector3(i ? b.max.x : b.min.x, q.y, r.z))));
  // footprints at the scan tilt (state-independent, for framing)
  m3t.setGimbalPitch(rad(TILT));
  drone.updateMatrixWorld(true);
  updateOptics();
  const fpScan = footprints.map((f) => f.map((p) => p.clone()));
  const headC = new T.Vector3();
  m3t.setGimbalPitch(rad(PITCH[1]));
  drone.rotation.y = rad(H0);
  drone.updateMatrixWorld(true);
  anchors.forEach((a) => headC.add(a.getWorldPosition(tmpV)));
  headC.multiplyScalar(1 / 3);
  const mapBox = new T.Box3(new T.Vector3(60 * S, 0, -405 * S), new T.Vector3(700 * S, 0.12, 150 * S));
  // the closing shot: the whole model on its base board, three-quarter from the south-west, key from behind left
  let peak = 0;
  for (const v of data.HT) peak = Math.max(peak, v);
  const modelBox = new T.Box3(new T.Vector3(-W / 2 - MODEL.OUT, -MODEL.BASE, -D / 2 - MODEL.OUT), new T.Vector3(W / 2 + MODEL.OUT, peak * S, D / 2 + MODEL.OUT));
  const CLOSE_RECT = [-0.94, 0.94, -0.36, 0.86];   // the bottom edge follows the report card (setReserve)
  // the team beat looks from the east, down the line of both routes (from the dam to the substation), so the
  // land fills the frame with no cut edge in view
  const keys = {
    wide: [
      { box: droneBox(H0).expandByScalar(0.02 * S), az: H0 + 40, el: 8, fov: 30, fill: 0.98, rect: [-0.86, 1, -0.2, 1] },
      { box: box3([headC], 0.03 * S), az: H0 + 16, el: 9, fov: 22, fill: 0.3, rect: [-1, 1, -1, 1] },
      { box: box3([...fpScan[0], ...corners8(droneBox())], 0.02), az: HEADING + 138, el: 44, fov: 18, fill: 0.6, rect: [-1, 1, -1, 1] },
      { box: box3([...patrolPts, ...flightPts, hoverW], 0.02), az: 82, el: 56, fov: 26, fill: 1.12, rect: [-1, 1, -1, 1] },
      { box: box3([...fpScan[2], ...corners8(droneBox()), hotW], 0.02), az: HEADING + 102, el: 66, fov: 18, fill: 0.44, rect: [-1, 0.36, -1, 1] },
      { box: mapBox, az: 360, el: 88, fov: 12, fill: 0.97, rect: [-1, 1, -1, 1] },
      { box: modelBox, az: 300, el: 38, fov: 22, fill: 1, rect: CLOSE_RECT },
    ],
    tall: [
      { box: droneBox(H0).expandByScalar(0.02 * S), az: H0 + 40, el: 8, fov: 32, fill: 1.22, rect: [-1, 1, -0.3, 1] },
      { box: box3([headC], 0.03 * S), az: H0 + 16, el: 9, fov: 24, fill: 0.36, rect: [-1, 1, -1, 1] },
      { box: box3([...fpScan[0], ...corners8(droneBox())], 0.02), az: HEADING + 138, el: 46, fov: 20, fill: 0.64, rect: [-1, 1, -1, 1] },
      { box: box3([...patrolPts, ...flightPts, hoverW], 0.02), az: 82, el: 58, fov: 28, fill: 1.14, rect: [-1, 1, -1, 1] },
      { box: box3([...fpScan[2], ...corners8(droneBox()), hotW], 0.02), az: HEADING + 102, el: 68, fov: 20, fill: 0.48, rect: [-1, 1, -1, 0.3] },
      { box: mapBox, az: 360, el: 88, fov: 12, fill: 0.98, rect: [-1, 1, -1, 1] },
      { box: modelBox, az: 300, el: 38, fov: 22, fill: 1, rect: CLOSE_RECT },
    ],
  };
  const lerpBox = (a, b, t) => {
    const ca = a.getCenter(new T.Vector3()), cb = b.getCenter(new T.Vector3());
    const ha = a.getSize(new T.Vector3()).multiplyScalar(0.5).max(new T.Vector3(1e-7, 1e-7, 1e-7));
    const hb = b.getSize(new T.Vector3()).multiplyScalar(0.5).max(new T.Vector3(1e-7, 1e-7, 1e-7));
    const h = new T.Vector3(Math.exp(lerp(Math.log(ha.x), Math.log(hb.x), t)), Math.exp(lerp(Math.log(ha.y), Math.log(hb.y), t)), Math.exp(lerp(Math.log(ha.z), Math.log(hb.z), t)));
    // across a big zoom the centre travels with the frame's real size (not with t), so whatever the small frame
    // holds (the aircraft) stays in view until the wide frame has room for both
    const sa = ha.length(), sb = hb.length(), s = h.length();
    const u = Math.abs(sb - sa) > 1e-9 && Math.max(sa, sb) / Math.min(sa, sb) > 4 ? clamp((s - sa) / (sb - sa)) : t;
    return { c: ca.lerp(cb, u), h };
  };
  const corners = Array.from({ length: 8 }, () => new T.Vector3());
  let layout = 'wide';
  let narrow = false;
  let camDist = 1;
  // the share of the view's height the report card takes at the bottom in the closing shot (0 = the full frame)
  let reserve = 0.3;
  const FULL = [-1, 1, -1, 1];
  function solveCamera(P, clock, cam, aspect) {
    const K = keys[layout];
    const k = Math.min(N - 2, Math.max(0, Math.floor(P)));
    const t = ease(P - k);
    const A = K[k], B = K[k + 1];
    const { c, h } = lerpBox(A.box, B.box, t);
    const orbit = keyed(ORBIT, P);
    const az = rad(lerp(A.az, B.az, t) + orbit * Math.sin(clock * 0.16));
    const el = rad(clamp(lerp(A.el, B.el, t) + orbit * 0.25 * Math.sin(clock * 0.11 + 1.2), -20, 88));
    const fov = lerp(A.fov, B.fov, t);
    const fillK = lerp(A.fill, B.fill, t);
    // the closing shot keeps the model clear of the report card under it
    const rectOf = (key, i) => (i !== 6 ? key.rect : reserve > 0 ? [key.rect[0], key.rect[1], Math.min(key.rect[3] - 0.6, -1 + 2 * reserve), key.rect[3]] : FULL);
    const rA = rectOf(A, k), rB = rectOf(B, k + 1);
    const rect = rA.map((v, i) => lerp(v, rB[i], t));
    cam.fov = fov;
    cam.aspect = aspect;
    cam.near = 1e-6;
    cam.updateProjectionMatrix();
    const cx = (rect[0] + rect[1]) / 2, cy = (rect[2] + rect[3]) / 2;
    const hw = ((rect[1] - rect[0]) / 2) * fillK, hh = ((rect[3] - rect[2]) / 2) * fillK;
    cam.projectionMatrix.elements[8] = -cx;
    cam.projectionMatrix.elements[9] = -cy;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    const dir = new T.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    let i = 0;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) corners[i++].set(c.x + sx * h.x, c.y + sy * h.y, c.z + sz * h.z);
    let lo = 1e-5, hi = 160;
    for (let it = 0; it < 44; it++) {
      const d = Math.sqrt(lo * hi);
      cam.position.copy(c).addScaledVector(dir, d);
      cam.lookAt(c);
      cam.updateMatrixWorld(true);
      let ok = true;
      for (const q of corners) {
        tmpV.copy(q).applyMatrix4(cam.matrixWorldInverse);
        if (tmpV.z > -1e-6) { ok = false; break; }
        tmpV.applyMatrix4(cam.projectionMatrix);
        if (Math.abs(tmpV.x - cx) > hw || Math.abs(tmpV.y - cy) > hh) { ok = false; break; }
      }
      if (ok) hi = d; else lo = d;
    }
    cam.position.copy(c).addScaledVector(dir, hi);
    cam.lookAt(c);
    camDist = hi;
    // clip planes from what is in front: the framed box (the aircraft, close up) and the land beyond it
    const span = h.length();
    cam.near = Math.max(2e-6, (hi - span * 1.2) * 0.25);
    cam.far = hi + span * 2 + 14;
    cam.updateProjectionMatrix();
    cam.projectionMatrix.elements[8] = -cx;
    cam.projectionMatrix.elements[9] = -cy;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    // never below the surface
    const floorAt = Math.max(topW(cam.position.x, cam.position.z), 0) + 0.04;
    if (cam.position.y < floorAt) { cam.position.y = floorAt; cam.lookAt(c); }
    cam.updateMatrixWorld(true);
  }

  /* ---------------------------------------------------------------- state */
  let P = 0, targetP = 0, clock = 0, crisp = !live;
  const lensW = [1, 1, 1], lensT = [1, 1, 1];
  const labels = {};
  const craftW = new T.Vector3();
  const LABEL_DEFS = {
    wide: { at: () => anchors[0].getWorldPosition(new T.Vector3()), vis: (p) => win(p, 0.55, 0.9, 1.1, 1.45) },
    tele: { at: () => anchors[1].getWorldPosition(new T.Vector3()), vis: (p) => win(p, 0.55, 0.9, 1.1, 1.45) },
    thermal: { at: () => anchors[2].getWorldPosition(new T.Vector3()), vis: (p) => win(p, 0.55, 0.9, 1.1, 1.45) },
    // footprint names sit on each footprint's left-most corner on screen (tele: its centre), so they never stack
    fpWide: { at: () => leftmost(footprints[0]), vis: (p) => win(p, 1.55, 1.9, 2.1, 2.45) * lensW[0] },
    fpTele: { at: () => footprints[1].reduce((a, q) => a.add(q), new T.Vector3()).multiplyScalar(0.25), vis: (p) => win(p, 1.55, 1.9, 2.1, 2.45) * lensW[1] },
    fpThermal: { at: () => leftmost(footprints[2]), vis: (p) => win(p, 1.55, 1.9, 2.1, 2.45) * lensW[2] },
    // the aircraft once it is too small to see: a map symbol from the pull-back on, named where its height matters
    craft: { at: () => craftW, vis: (p) => win(p, 1.62, 1.95, 2.1, 2.45) },
    craftPin: { at: () => craftW, vis: (p) => win(p, 1.45, 1.8, 5.45, 5.75) },
    patrol: { at: () => new T.Vector3(...patrolPts[Math.round(patrolPts.length * 0.16)]), vis: (p) => win(p, 2.72, 2.96, 3.04, 3.38) },
    flight: { at: () => new T.Vector3(...flightPts[Math.round(flightPts.length * 0.5)]), vis: (p) => win(p, 2.8, 2.98, 3.04, 3.38) },
    // the hotspot is marked on the map and the whole model (in the heat beat the inset carries the reading)
    hotspot: { at: () => hotW, vis: (p) => win(p, 4.5, 4.85) },
    obs0: { at: () => obsW[0], vis: (p) => win(p, 4.55, 4.9, 5.1, 5.45) },
    obs1: { at: () => obsW[1], vis: (p) => win(p, 4.55, 4.9, 5.1, 5.45) },
    obs2: { at: () => obsW[2], vis: (p) => win(p, 4.55, 4.9, 5.1, 5.45) },
    pin0: { at: () => obsW[0], vis: (p) => win(p, 4.5, 4.9, 5.45, 5.75) },
    pin1: { at: () => obsW[1], vis: (p) => win(p, 4.5, 4.9, 5.45, 5.75) },
    pin2: { at: () => obsW[2], vis: (p) => win(p, 4.5, 4.9, 5.45, 5.75) },
    launch: { at: () => launchW, vis: (p) => win(p, 2.7, 2.95, 3.05, 3.35) },
    // the assets: all six in the team beat; the line and the substation on the map; four on the whole model
    aDam: { at: () => assetW.dam, vis: (p) => win(p, 2.7, 2.95, 3.05, 3.35) + win(p, 5.6, 5.95) },
    aReservoir: { at: () => assetW.reservoir, vis: (p) => win(p, 2.7, 2.95, 3.05, 3.35) + win(p, 5.6, 5.95) },
    aPowerhouse: { at: () => assetW.powerhouse, vis: (p) => win(p, 2.7, 2.95, 3.05, 3.35) },
    aRoad: { at: () => assetW.road, vis: (p) => win(p, 2.7, 2.95, 3.05, 3.35) },
    aLine: { at: () => assetW.line, vis: (p) => win(p, 2.7, 2.95, 3.05, 3.35) + win(p, 4.6, 4.9, 5.1, 5.4) + win(p, 5.6, 5.95) },
    aSubstation: { at: () => assetW.substation, vis: (p) => win(p, 2.7, 2.95, 3.05, 3.35) + win(p, 4.6, 4.9, 5.1, 5.4) + win(p, 5.6, 5.95) },
  };

  const lv = new T.Vector3();
  function leftmost(fp) {
    let best = fp[0], bx = Infinity;
    for (const q of fp) { const x = lv.copy(q).project(camera).x; if (x < bx) { bx = x; best = q; } }
    return best;
  }

  function apply(p, clk, w, h) {
    P = p;
    const tt = clk;
    kit.U.uTime.value = crisp ? 0 : tt;
    // drone: a few centimetres of hover bob and a small attitude wobble on the clock
    const bob = crisp ? 0 : 0.03 * S * Math.sin(tt * 1.85);
    drone.position.set(hoverW.x, hoverW.y + bob, hoverW.z);
    drone.rotation.set(0, rad(keyed(YAW, p)), crisp ? 0 : rad(0.45) * Math.sin(tt * 1.4 + 0.7));
    m3t.setGimbalPitch(rad(keyed(PITCH, p)));
    if (crisp) m3t.setProps(0.62, 0);
    else m3t.setProps(tt * 44, 0.92);
    drone.updateMatrixWorld(true);
    craftW.set(hoverW.x, hoverW.y + bob + 0.05 * S, hoverW.z);
    craftKey.target.position.copy(craftW);
    craftKey.position.copy(craftW).addScaledVector(kd, 1.5 * S);
    craftKey.target.updateMatrixWorld();
    solveCamera(p, crisp ? 0 : tt, camera, w / h);
    updateOptics();
    // distance haze, measured from the framed subject outward
    const hz = keyed(HAZE, p);
    haze.near = camDist + keyed(HAZE_NEAR, p) * S + (1 - hz) * 60;
    haze.far = haze.near + 1100 * S + (1 - hz) * 60;
    // lens isolation only matters inside the coverage beat
    const coverW = win(p, 1.45, 1.95, 2.05, 2.55);
    const U = kit.U;
    const on = [0, 1, 2].map((i) => keyed(FP[i], p) * lerp(1, lensW[i], coverW));
    U.uLensOn.value.set(on[0], on[1], on[2]);
    U.uInk.value.set(keyed(INK.map((v) => v[0]), p), keyed(INK.map((v) => v[1]), p));
    // with all three on, the cones are quiet hairlines; an isolated lens gets a fuller volume
    const isolated = Math.min(...lensW) < 0.5 ? coverW : 0;
    for (let i = 0; i < 3; i++) {
      const a = keyed(CONE[i], p) * lerp(1, lensW[i], coverW) * lerp(0.6, 1, isolated);
      const fillA = (i === 1 ? 0.07 : 0.03) * lerp(1, 2, isolated);
      cones[i].set(lensCams[i].position.toArray(), footprints[i].map((q) => q.toArray()), a, fillA);
    }
    const res = new T.Vector2(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    for (const [l, wpx] of routeLines) {
      l.mat.uniforms.uRes.value.copy(res);
      l.mat.uniforms.uWidth.value = wpx * renderer.getPixelRatio();
    }
    const pp = clamp((p - 2.12) / 0.55), fp = clamp((p - 2.42) / 0.5);
    const irOn = keyed(OUTLINE_IR, p);
    if (irOn > 0.01) {
      const c = footprints[2];
      for (let e = 0, k = 0; e < 4; e++) for (let j = 0; j < FP_SEG; j++, k++) {
        const a = c[e], b = c[(e + 1) % 4], t = j / FP_SEG;
        const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        fpPts[k][0] = x; fpPts[k][1] = topW(x, z) + 0.5 * S; fpPts[k][2] = z;
      }
      fpPts[4 * FP_SEG] = fpPts[0].slice();
      fpCase.setPoints(fpPts);
      fpLine.setPoints(fpPts);
    }
    const ra = keyed(ROUTES, p);
    kit.U.uFocus.value = keyed(FOCUS, p);
    for (const [l, , k, f] of routeLines) {
      const v = k === 'p' ? pp : k === 'f' ? fp : 1;
      const a = k === 'ir' ? irOn : ra;
      l.mat.uniforms.uProg.value = v;
      l.mat.uniforms.uOpacity.value = a * f;
      l.mesh.visible = a > 0.01 && v > 0.001;
    }
    ticks.lines.visible = fp > 0.98;
    ticks.mat.opacity = 0.28 * clamp((p - 2.9) / 0.1) * keyed(ROUTES, p);
    // labels, in the canvas's CSS pixels
    for (const [id, L] of Object.entries(LABEL_DEFS)) {
      const vis = Math.min(1, L.vis(p));
      const q = L.at();
      if (!q) { labels[id] = { x: 0, y: 0, a: 0 }; continue; }
      tmpV.copy(q).project(camera);
      const onScreen = tmpV.z < 1 && Math.abs(tmpV.x) < 1.05 && Math.abs(tmpV.y) < 1.05;
      labels[id] = { x: (tmpV.x * 0.5 + 0.5) * w, y: (-tmpV.y * 0.5 + 0.5) * h, a: onScreen ? vis : 0 };
    }
  }

  /* ---------------------------------------------------------------- the thermal inset */
  // What the thermal lens sees, in the heat beat: the land rendered from the lens's own camera with the thermal
  // materials swapped in (unlit SAMPLE temperatures on the ironbow ramp), into a target, then composited into a
  // corner of the view. Story draws its frame, readouts and leader in HTML over the same rect (FrameInfo.ir).
  const irRT = new T.WebGLRenderTarget(4, 4, { samples: 4 });
  const irMat = new T.ShaderMaterial({
    uniforms: { uMap: { value: irRT.texture }, uOpacity: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D uMap; uniform float uOpacity; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(uMap, vUv).rgb, uOpacity); }',
    transparent: true, depthTest: false, depthWrite: false,
  });
  const irQuad = new T.Mesh(new T.PlaneGeometry(1, 1), irMat);
  const hud = new T.Scene();
  hud.add(irQuad);
  const hudCam = new T.OrthographicCamera(0, 1, 0, -1, -1, 1);
  const TH = kit.thermal;
  const irSwap = new Map([[kit.surface, TH.surface], [kit.sides, TH.sides], [kit.trees, TH.trees], [kit.massing, TH.massing], [kit.steel, TH.steel], [kit.gravel, TH.gravel], [kit.water, TH.water]]);
  const swaps = [], irHide = [];
  scene.traverse((o) => {
    if (!o.isMesh && !o.isLine && !o.isPoints) return;
    if (o.isMesh && irSwap.has(o.material)) swaps.push([o, o.material, irSwap.get(o.material)]);
    else irHide.push(o);
  });
  const ir = { x: 0, y: 0, w: 0, h: 0, a: 0, hx: 0, hy: 0 };
  function irLayout(w, h, p) {
    ir.a = win(p, 3.55, 3.85, 4.15, 4.45);
    ir.w = Math.round(clamp(w * (narrow ? 0.48 : 0.36), 170, 420));
    ir.h = Math.round(ir.w / LENSES[2].aspect);
    const m = narrow ? 12 : 22;
    ir.x = w - ir.w - m;
    ir.y = narrow ? 50 : m;            // phones: under the SAMPLE tag, which spans most of the width
    // the hotspot as the lens sees it, in inset px
    tmpV.copy(hotW).project(lensCams[2]);
    ir.hx = (tmpV.x * 0.5 + 0.5) * ir.w;
    ir.hy = (-tmpV.y * 0.5 + 0.5) * ir.h;
  }
  function renderInset(w, h) {
    if (ir.a < 0.01) return;
    const pr = renderer.getPixelRatio();
    const rw = Math.max(4, Math.round(ir.w * pr)), rh = Math.max(4, Math.round(ir.h * pr));
    if (irRT.width !== rw || irRT.height !== rh) irRT.setSize(rw, rh);
    for (const [o, , m] of swaps) o.material = m;
    const vis = irHide.map((o) => o.visible);
    irHide.forEach((o) => (o.visible = false));
    const au = renderer.shadowMap.autoUpdate, fog = scene.fog;
    renderer.shadowMap.autoUpdate = false;
    scene.fog = null;
    const cam = lensCams[2];
    cam.layers.set(L_LAND);
    renderer.setRenderTarget(irRT);
    renderer.setClearColor(0x14002e, 1);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    renderer.setClearColor(STUDIO, 1);
    scene.fog = fog;
    renderer.shadowMap.autoUpdate = au;
    irHide.forEach((o, i) => (o.visible = vis[i]));
    for (const [o, m] of swaps) o.material = m;
    hudCam.right = w; hudCam.bottom = -h;
    hudCam.updateProjectionMatrix();
    irQuad.scale.set(ir.w, ir.h, 1);
    irQuad.position.set(ir.x + ir.w / 2, -(ir.y + ir.h / 2), 0);
    irMat.uniforms.uOpacity.value = ir.a;
    renderer.render(hud, hudCam);
  }

  /** the land, then the aircraft over it (same camera and depth buffer, each pass with its own key), then the
   *  thermal inset in the heat beat */
  function renderPasses(w, h) {
    renderer.clear();
    camera.layers.set(L_LAND);
    renderer.render(scene, camera);
    camera.layers.set(L_CRAFT);
    renderer.render(scene, camera);
    camera.layers.set(L_LAND);
    renderInset(w, h);
  }

  /* ---------------------------------------------------------------- size, loop */
  let cw = 0, ch = 0;
  function measure() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    if (w !== cw || h !== ch || renderer.getPixelRatio() !== dpr()) {
      cw = w; ch = h;
      renderer.setPixelRatio(dpr());
      renderer.setSize(w, h, false);
    }
    narrow = !!window.matchMedia?.('(max-width: 899px)').matches;
    layout = narrow || w / h < 1.12 ? 'tall' : 'wide';
    return true;
  }
  const listeners = new Set();
  function draw() {
    if (!measure()) return;
    apply(P, clock, cw, ch);
    irLayout(cw, ch, P);
    renderPasses(cw, ch);
    for (const cb of listeners) cb({ P, labels, layout, ir });
  }

  let raf = 0, last = 0, running = false, active = true, disposed = false;
  const frameTimes = [];
  let governed = false;
  function tick(now) {
    raf = 0;
    if (disposed) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    clock += dt;
    const k = 1 - Math.exp(-dt / 0.085);
    P += (targetP - P) * k;
    if (Math.abs(targetP - P) < 0.0005) P = targetP;
    for (let i = 0; i < 3; i++) {
      lensW[i] += (lensT[i] - lensW[i]) * (1 - Math.exp(-dt / 0.1));
      if (Math.abs(lensT[i] - lensW[i]) < 0.002) lensW[i] = lensT[i];
    }
    draw();
    // governor: once, at rest, if frames run slow drop the pixel ratio one step
    if (!governed && P === targetP && dt > 0) {
      frameTimes.push(dt * 1000);
      if (frameTimes.length >= 90) {
        const s = frameTimes.slice().sort((a, b) => a - b);
        if (s[Math.floor(s.length * 0.75)] > 26 && dprCap > 1) { dprCap = Math.max(1, dprCap * 0.8); }
        governed = true;
      }
    }
    if (running && active && !document.hidden) raf = requestAnimationFrame(tick);
  }
  function kick() {
    if (!live) { draw(); return; }
    if (!raf && running && active && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); }
    if (document.hidden || !active) draw();
  }
  const io = new IntersectionObserver(([e]) => { active = e.isIntersecting; kick(); }, { rootMargin: '120px' });
  io.observe(canvas);
  const onVis = () => kick();
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(() => { if (!disposed) { measure(); draw(); } });
  ro.observe(canvas);
  const onLost = (e) => { e.preventDefault(); running = false; cancelAnimationFrame(raf); raf = 0; opts.onLost?.(); };
  canvas.addEventListener('webglcontextlost', onLost);

  // warm every program behind the poster: compile (the land's lights match the aircraft's in kind and count),
  // then the first settled frame (also when hidden)
  measure();
  apply(0, 0, cw || 800, ch || 600);
  renderer.compile(scene, camera);
  draw();
  const readyMs = performance.now() - t0;

  const api = {
    canvas,
    beats: BEAT_IDS,
    setProgress(p) {
      targetP = clamp(p, 0, N - 1);
      if (!live || document.hidden) { P = targetP; draw(); } else kick();
    },
    jump(p) { targetP = P = clamp(p, 0, N - 1); draw(); },
    /** the report card's share of the view height (the closing shot frames the model above it) */
    setReserve(f) {
      const v = clamp(f, 0, 0.6);
      if (Math.abs(v - reserve) < 0.002) return;
      reserve = v;
      if (!live || document.hidden) draw(); else kick();
    },
    setLens(id) {
      const i = { wide: 0, tele: 1, thermal: 2 }[id];
      for (let k = 0; k < 3; k++) lensT[k] = i === undefined ? 1 : k === i ? 1 : 0;
      if (!live || document.hidden) { lensW.splice(0, 3, ...lensT); draw(); } else kick();
    },
    start() { running = true; crisp = !live; kick(); },
    stop() { running = false; cancelAnimationFrame(raf); raf = 0; },
    onFrame(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    resize() { measure(); draw(); },
    async renderStill(p, w, h, o = {}) {
      const keepP = P, keepCrisp = crisp, keepLens = lensW.slice(), keepReserve = reserve;
      crisp = true;
      if (o.full) reserve = 0;
      if (o.lens) { const i = { wide: 0, tele: 1, thermal: 2 }[o.lens]; for (let k = 0; k < 3; k++) lensW[k] = i === undefined ? 1 : k === i ? 1 : 0; }
      const keepPR = renderer.getPixelRatio();
      const pr = Math.min(window.devicePixelRatio || 1, 1.6);
      renderer.setPixelRatio(pr);
      renderer.setSize(w, h, false);
      layout = o.layout || (w / h < 1.12 ? 'tall' : 'wide');
      apply(p, 0, w, h);
      irLayout(w, h, p);
      renderPasses(w, h);
      const lab = JSON.parse(JSON.stringify(labels));
      const irStill = { ...ir };
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.9));
      const url = blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png');
      renderer.setPixelRatio(keepPR);
      crisp = keepCrisp; lensW.splice(0, 3, ...keepLens); reserve = keepReserve;
      cw = 0; ch = 0;
      P = keepP;
      return { url, labels: lab, w, h, ir: irStill };
    },
    stats() {
      return {
        tris: renderer.info.render.triangles, calls: renderer.info.render.calls, geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures, buildMs: Math.round(buildMs), heading: Math.round(HEADING), tilt: Math.round(TILT), agl: Math.round(aglM), readyMs: Math.round(readyMs), terrainTris: Math.round(terr.tris), trees: forest.count,
        waterLevel: Math.round(data.WL * 10) / 10, dpr: renderer.getPixelRatio(), dprCap, layout, P, size: [cw, ch],
        programs: renderer.info.programs?.length,
      };
    },
    debug: { T, scene, camera, renderer, kit, drone, m3t, lensCams, footprints, data, hoverW, hotW, keys },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('webglcontextlost', onLost);
      listeners.clear();
      [terr.surface, terr.sides, water.reservoir, water.river, baseG, floorG].forEach((g) => g.dispose());
      floor.material.dispose(); catcher.geometry.dispose(); catcher.material.dispose();
      contact.m.geometry.dispose(); contact.m.material.dispose(); contact.t.dispose();
      massing.dispose(); forest.dispose(); routeLines.forEach(([l]) => l.dispose()); ticks.dispose(); cones.forEach((c) => c.dispose());
      irRT.dispose(); irMat.dispose(); irQuad.geometry.dispose();
      tex.forest.dispose(); tex.temp.dispose(); tex.engrave.dispose();
      kit.dispose();
      m3t.dispose();
      envRT.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
  return api;
}
