// Pilot section: the DJI Mavic 3 Thermal (M3T) on its own small stage.
//
//   mountM3T(el, { onReady, motion, dev }) → { dispose(), resize(), renderAt(t), setView(name), stats() }
//
// Contract with src/sections/Pilot.tsx + src/lib/table3d.ts: dynamic import, mountM3T(el, { onReady, motion }),
// optional dispose(). The site never calls resize() here, so the stage watches its own size (ResizeObserver).
//   · its own renderer + transparent canvas filling `el` (the slot's ash gradient shows through), DPR capped
//     by the quality tier (lib/quality.js)
//   · first view (its own IntersectionObserver): folded → arms unfold (1.6 s, eased, no bounce) → props flick
//     open → spin up and lift a few cm → gimbal tilts to −30° → labels → slow idle (hover bob, ±15° sway)
//   · motion === false: the final pose, static, rendered once and again on resize; no loop
//   · pauses when the slot is off screen or the tab is hidden; optional drag-to-orbit (touch-action: pan-y)
//   · three DOM labels (verified M3T figures only) on dark plates with leader lines to the lens anchors,
//     in a column beside the aircraft so they never cover it; short text on narrow slots
//   · onReady() after the first rendered frame; dispose() frees everything and removes the canvas and labels
// dev (sandbox only, public/table/m3t.html): { view, fold, pitch, detail, frame, labels, blur, prop, yaw,
//   wire, sil, q }
import * as THREE from 'three';
import { buildM3T } from './m3t/model.js';
import { RoomEnvironment } from './m3t/room-environment.js';
import { detectQuality } from './lib/quality.js';

const LABELS = [
  { id: 'thermal', full: 'Thermal · 640×512 · 40 mm eq', short: 'Thermal · 640×512' },
  { id: 'wide', full: 'Wide · 48 MP · 24 mm eq', short: 'Wide · 48 MP' },
  { id: 'tele', full: 'Tele · 12 MP · 162 mm eq', short: 'Tele · 12 MP' },
];
// hero camera: 3/4 front from the aircraft's left (+X), slightly high
const HERO = { az: 34, el: 20, fov: 24 };
const VIEWS = {
  front: { az: 0, el: 0 }, back: { az: 180, el: 0 }, left: { az: 90, el: 0 }, right: { az: -90, el: 0 },
  top: { az: 0, el: 90 }, bottom: { az: 0, el: -90 }, '34': HERO, folded: HERO,
};
const LIFT = 0.032;           // hover height, m
const PITCH = -30;            // final gimbal tilt, deg
const SWAY = 15;              // idle turntable sway, ±deg

/* ------------------------------------------------------------------ timeline (seconds from first view) */
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut3 = (t) => 1 - Math.pow(1 - clamp01(t), 3);
const easeInOutSine = (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
const TL = (() => {
  const unfold0 = 0.35, unfold1 = unfold0 + 1.6;
  const flick0 = unfold1 + 0.06, flick1 = flick0 + 0.3;
  const spin0 = flick1 + 0.12, spin1 = spin0 + 0.9;
  const lift0 = spin0 + 0.35, lift1 = lift0 + 1.5;
  const tilt0 = flick1 + 0.3, tilt1 = tilt0 + 1.3;
  return { unfold0, unfold1, flick0, flick1, spin0, spin1, lift0, lift1, tilt0, tilt1, labels: tilt1 - 0.25, idle: lift1 };
})();
const OMEGA = Math.PI * 2 * 7;   // display rotor speed at full spin (rad/s); real rotors alias anyway

function poseAt(t) {
  const fold = clamp01((t - TL.unfold0) / (TL.unfold1 - TL.unfold0));     // linear: the model eases each arm
  const propOpen = easeOut3((t - TL.flick0) / (TL.flick1 - TL.flick0));
  const sd = TL.spin1 - TL.spin0;
  const ts = Math.max(0, t - TL.spin0);
  const angle = ts < sd ? OMEGA * ts * ts / (2 * sd) : OMEGA * (sd / 2 + (ts - sd));
  const blur = sstep(TL.spin0 + 0.15, TL.spin1, t) * 0.95;
  const lift = LIFT * easeInOutSine((t - TL.lift0) / (TL.lift1 - TL.lift0));
  const pitch = PITCH * easeInOutSine((t - TL.tilt0) / (TL.tilt1 - TL.tilt0));
  const ti = Math.max(0, t - TL.idle);
  const ramp = sstep(0, 2.5, ti);
  const bob = 0.0034 * Math.sin((ti / 3.4) * Math.PI * 2) * ramp;
  const yaw = SWAY * Math.sin((ti / 20) * Math.PI * 2) * sstep(0, 4, ti);
  const roll = 0.5 * Math.sin((ti / 4.3) * Math.PI * 2 + 1.1) * ramp;
  const labels = t >= TL.labels ? 1 : 0;
  return { fold, propOpen, angle, blur, lift: lift + bob, pitch, yaw, roll, labels };
}
const FINAL = { fold: 1, propOpen: 1, angle: 0.62, blur: 0, lift: LIFT, pitch: PITCH, yaw: 0, roll: 0, labels: 1 };

/* ------------------------------------------------------------------ styles (scoped, shared by instances) */
const STYLE_ID = 'm3t3d-style';
let styleRefs = 0;
const CSS = `
.m3t3d{position:absolute;inset:0;overflow:hidden;touch-action:pan-y;-webkit-tap-highlight-color:transparent;user-select:none}
.m3t3d>canvas{position:absolute;inset:0;width:100%;height:100%;display:block;outline:none}
.m3t3d[data-drag]{cursor:grab}
.m3t3d[data-drag="on"]{cursor:grabbing}
.m3t3d__labs{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .8s cubic-bezier(.2,.7,.2,1)}
.m3t3d__labs[data-on]{opacity:1}
.m3t3d__svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.m3t3d__svg polyline{fill:none;stroke:rgba(236,231,224,.6);stroke-width:1}
.m3t3d__svg .m3t3d__dot{fill:#ECE7E0}
.m3t3d__svg .m3t3d__ring{fill:none;stroke:rgba(236,231,224,.42);stroke-width:1}
.m3t3d__lab{position:absolute;left:0;top:0;box-sizing:border-box;padding:6px 9px;background:rgba(15,14,13,.9);border:1px solid rgba(236,231,224,.16);border-radius:0;color:#ECE7E0;font-family:"JetBrains Mono",ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;font-weight:500;font-size:11px;line-height:1.25;letter-spacing:.02em;white-space:nowrap}
`;
function addStyle() {
  styleRefs++;
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s);
}
function removeStyle() {
  styleRefs = Math.max(0, styleRefs - 1);
  if (!styleRefs) document.getElementById(STYLE_ID)?.remove();
}

/* ------------------------------------------------------------------ small textures */
function radialTexture(size, inner, outer) {
  const data = new Uint8Array(size * size * 4), c = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot((x - c) / c, (y - c) / c);
    const a = 1 - sstep(inner, outer, r);
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 0; data[i + 3] = Math.round(255 * a * a);
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/* ================================================================== mount */
export function mountM3T(el, { onReady, motion = true, dev = {} } = {}) {
  const review = !!dev.view && dev.view !== '34';
  const still = !!dev.view || dev.frame != null || motion === false;
  const Q = detectQuality(dev.q ? { search: `?q=${dev.q}` } : undefined);
  const detail = dev.detail === 'table' ? 'table' : 'hero';
  addStyle();

  /* ---------------------------------------------------------------- DOM */
  const wrap = document.createElement('div');
  wrap.className = 'm3t3d';
  wrap.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!dev.preserve });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const dpr = () => Math.min(window.devicePixelRatio || 1, Math.max(1, Q.dprCap));
  renderer.setPixelRatio(dpr());
  wrap.appendChild(renderer.domElement);
  const labs = document.createElement('div'); labs.className = 'm3t3d__labs';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('class', 'm3t3d__svg');
  labs.appendChild(svg);
  const labelsOn = dev.labels !== false && dev.labels !== 0 && dev.labels !== '0';
  const items = LABELS.map((L) => {
    const div = document.createElement('div'); div.className = 'm3t3d__lab'; div.textContent = L.full;
    const line = document.createElementNS(SVGNS, 'polyline');
    const ring = document.createElementNS(SVGNS, 'circle'); ring.setAttribute('class', 'm3t3d__ring'); ring.setAttribute('r', '4.5');
    const dot = document.createElementNS(SVGNS, 'circle'); dot.setAttribute('class', 'm3t3d__dot'); dot.setAttribute('r', '1.8');
    svg.append(line, ring, dot); labs.appendChild(div);
    return { ...L, div, line, ring, dot, w: 0, h: 0 };
  });
  if (labelsOn) wrap.appendChild(labs);
  const corners = el.querySelector(':scope > .corners');
  if (corners) el.insertBefore(wrap, corners); else el.appendChild(wrap);

  /* ---------------------------------------------------------------- scene */
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envRT = pmrem.fromScene(room, 0.035);
  room.dispose(); pmrem.dispose();
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.75;
  scene.environmentRotation = new THREE.Euler(0, THREE.MathUtils.degToRad(-35), 0);

  const camera = new THREE.PerspectiveCamera(HERO.fov, 1.6, 0.01, 20);
  // studio: warm bone key (front-left, high), faint neutral fill, ember rim from behind
  const key = new THREE.DirectionalLight(0xf3e8d8, 3.4); key.position.set(-0.9, 1.35, 1.1);
  const fill = new THREE.HemisphereLight(0xd6d0c8, 0x16130f, 0.45);
  // ember rim: low and behind, so it only catches edges that face away from the camera
  const rim = new THREE.DirectionalLight(0xff6a1f, 0.5);
  const rim2 = new THREE.DirectionalLight(0xff6a1f, 0.28);
  scene.add(key, fill, rim, rim2);

  const model = buildM3T({ detail, texSize: detail === 'hero' ? (Q.texSize || 512) : 0 });   // tier knob: 512 lite/balanced, 1024 high
  const stage = new THREE.Group(); stage.name = 'm3t-stage';   // yaw (sway / drag) about the footprint centre
  const lifter = new THREE.Group();                              // hover height + attitude wobble
  stage.add(lifter); lifter.add(model.group); scene.add(stage);
  if (dev.wire) model.group.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.wireframe = true; } });
  let silMat = null;
  if (dev.sil) {
    silMat = new THREE.MeshBasicMaterial({ color: 0xece7e0 });
    model.group.traverse((o) => { if (o.isMesh) o.material = silMat; });
    scene.environment = null;
  }
  // contact shadow: a soft ellipse under the aircraft + four small foot blobs while landed
  const shadowTex = radialTexture(128, 0.0, 1.0);
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.6, color: 0x000000 });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.0004; shadow.scale.set(0.36, 0.34, 1); shadow.renderOrder = -1;
  const footMat = shadowMat.clone(); footMat.opacity = 0.55;
  const feet = new THREE.Group();
  for (const [x, z] of [[0.164, 0.115], [-0.164, 0.115], [0.129, -0.128], [-0.129, -0.128]]) {
    const f = new THREE.Mesh(shadow.geometry, footMat); f.rotation.x = -Math.PI / 2; f.position.set(x, 0.0005, z); f.scale.set(0.03, 0.03, 1); f.renderOrder = -1; feet.add(f);
  }
  const ground = new THREE.Group(); ground.add(shadow, feet); stage.add(ground);
  if (dev.sil) ground.visible = false;

  /* ---------------------------------------------------------------- pose */
  // lowest point of the aircraft (no props) as a function of the fold, sampled once
  const groundTable = (() => {
    const out = [], v = new THREE.Vector3(), N = 16;
    for (let i = 0; i <= N; i++) {
      model.setFold(i / N); model.setGimbalPitch(0); model.group.updateMatrixWorld(true);
      let lo = Infinity;
      model.group.traverse((o) => {
        if (!o.isMesh || o.userData.prop || /^prop_/.test(o.name)) return;
        const p = o.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 400));
        for (let j = 0; j < p.count; j += step) lo = Math.min(lo, v.fromBufferAttribute(p, j).applyMatrix4(o.matrixWorld).y);
      });
      out.push(Math.max(0, lo));
    }
    return out;
  })();
  const groundAt = (f) => { const x = clamp01(f) * (groundTable.length - 1), i = Math.min(groundTable.length - 2, Math.floor(x)); return groundTable[i] + (groundTable[i + 1] - groundTable[i]) * (x - i); };
  let dragYaw = 0;
  let current = { ...FINAL };
  function applyPose(p) {
    current = p;
    model.setFold(p.fold);
    model.setPropOpen(p.propOpen);
    model.setProps(p.angle, p.blur);
    model.setGimbalPitch(THREE.MathUtils.degToRad(p.pitch));
    lifter.rotation.z = THREE.MathUtils.degToRad(p.roll || 0);
    stage.rotation.y = THREE.MathUtils.degToRad((p.yaw || 0) + dragYaw);
    // folded, the aircraft rests on its belly/gimbal; the legs lift it as the arms swing out
    lifter.position.y = p.lift - groundAt(p.fold);
    const air = clamp01(p.lift / LIFT), k = clamp01(p.fold * 1.15);
    shadowMat.opacity = 0.62 - 0.3 * air;
    shadow.scale.set(0.13 + 0.23 * k + 0.06 * air, 0.25 + 0.08 * k + 0.05 * air, 1);
    footMat.opacity = 0.5 * sstep(0.75, 1, p.fold) * (1 - sstep(0, 0.35, air));
    labs.toggleAttribute('data-on', !!p.labels && labelsOn && !review);
  }

  /* ---------------------------------------------------------------- framing */
  const view = VIEWS[dev.view] || HERO;
  const camDir = (v) => {
    const az = THREE.MathUtils.degToRad(v.az), elv = THREE.MathUtils.degToRad(v.el);
    return new THREE.Vector3(Math.sin(az) * Math.cos(elv), Math.sin(elv), Math.cos(az) * Math.cos(elv));
  };
  /** Points that bound the aircraft (vertices of every part, plus the rotor discs), in stage space */
  function samplePoints(pose, discs) {
    const keep = current, keepDrag = dragYaw;
    dragYaw = 0; applyPose({ ...pose, yaw: 0 });
    stage.updateMatrixWorld(true);
    const pts = [], v = new THREE.Vector3();
    // ?focus=hinge_FL etc.: everything within 34 mm of that arm's hinge pivot
    const hingeKey = /^hinge_(FL|FR|RL|RR)$/.exec(dev.focus || '')?.[1];
    const centreH = hingeKey ? model.group.getObjectByName(`arm_${hingeKey}`).getWorldPosition(new THREE.Vector3()) : null;
    const scope = dev.focus && !hingeKey ? model.group.getObjectByName(dev.focus) || model.group : model.group;
    scope.traverse((o) => {
      if (!o.isMesh || !o.visible || (o.userData.prop && (discs || hingeKey) && !(dev.focus && !hingeKey))) return;
      const p = o.geometry.attributes.position, step = hingeKey ? 1 : Math.max(1, Math.floor(p.count / 60));
      for (let i = 0; i < p.count; i += step) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        if (centreH && v.distanceTo(centreH) > 0.034) continue;
        pts.push(v.clone());
      }
    });
    if (discs && !dev.focus && pose.fold > 0.95 && pose.propOpen > 0.95) for (const k of ['FL', 'FR', 'RL', 'RR']) {
      const m = model.group.getObjectByName(`motor_${k}`), c = new THREE.Vector3();
      m.getWorldPosition(c); c.y += 0.0157;
      for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; pts.push(c.clone().add(new THREE.Vector3(Math.cos(a) * 0.1195, 0, Math.sin(a) * 0.1195))); }
    }
    dragYaw = keepDrag; applyPose(keep);
    return pts;
  }
  let fitPts = null, fitPose = null;
  const target = new THREE.Vector3(), tmp = new THREE.Vector3();
  let W = 0, H = 0;
  // Labels always live in a band along the bottom edge (the aircraft is wider than tall, so that band is the
  // free space at every slot shape: 16:10 desktop, 1:1 phone). 'row' = the three plates side by side;
  // 'stack' = three rows, left- or right-aligned, leaders leaving the plates' outer edge. The plate order and
  // side are chosen so no leader crosses another over the whole idle sway.
  const layout = { mode: 'row', side: 'left', order: ['tele', 'thermal', 'wide'], compact: false, colW: 0, rowW: 0, labH: 0, gap: 0, m: 16 };
  const rowGap = () => (W < 400 ? 6 : 10);
  const stackGap = () => (W < 400 ? 5 : 7);
  const bandH = (mode) => (mode === 'row' ? layout.labH : 3 * layout.labH + 2 * stackGap());
  const PERMS = [['tele', 'thermal', 'wide'], ['tele', 'wide', 'thermal'], ['thermal', 'tele', 'wide'], ['thermal', 'wide', 'tele'], ['wide', 'tele', 'thermal'], ['wide', 'thermal', 'tele']];
  const byId = (id) => items.find((i) => i.id === id);
  /** Plate rectangles and leader polylines (ending at the anchor) for a layout, given projected anchors A */
  function arrange(A, mode, side, order) {
    const m = layout.m, its = order.map(byId), out = [];
    if (mode === 'row') {
      const g = rowGap();
      const cx = its.reduce((t, it) => t + A[it.id].x, 0) / its.length;
      let x = Math.round(Math.min(W - m - layout.rowW, Math.max(m, cx - layout.rowW / 2)));
      const y = Math.round(H - m - layout.labH);
      for (const it of its) {
        const yy = y + (layout.labH - it.h), ex = Math.round(x + it.w / 2) + 0.5;
        out.push({ it, x, y: yy, pts: [[ex, yy], [ex, yy - 7], [A[it.id].x, A[it.id].y]] });
        x += it.w + g;
      }
      return out;
    }
    const g = stackGap();
    let y = Math.round(H - m - bandH('stack'));
    const X = side === 'left' ? m + layout.colW + 9.5 : W - m - layout.colW - 9.5;
    for (const it of its) {
      const x = side === 'left' ? m : W - m - it.w;
      const ey = y + it.h / 2 + 0.5, ex = side === 'left' ? x + it.w : x;
      out.push({ it, x, y, pts: [[ex, ey], [X, ey], [A[it.id].x, A[it.id].y]] });
      y += it.h + g;
    }
    return out;
  }
  const orient = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  const segX = (p1, p2, p3, p4) => orient(p1, p2, p3) * orient(p1, p2, p4) < 0 && orient(p3, p4, p1) * orient(p3, p4, p2) < 0;
  function crossings(arr) {
    let n = 0;
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i].pts, b = arr[j].pts;
      for (let u = 0; u < a.length - 1; u++) for (let v = 0; v < b.length - 1; v++) if (segX(a[u], a[u + 1], b[v], b[v + 1])) n++;
    }
    return n;
  }

  function setLabelMode(compact) {
    const fs = W < 400 ? 10 : W < 1100 ? 11 : 12;
    let maxW = 0, maxH = 0, sum = 0;
    for (const it of items) {
      it.div.textContent = compact ? it.short : it.full;
      it.div.style.fontSize = `${fs}px`;
      it.div.style.padding = W < 400 ? '4px 7px' : '6px 9px';
      it.w = it.div.offsetWidth; it.h = it.div.offsetHeight;
      maxW = Math.max(maxW, it.w); maxH = Math.max(maxH, it.h); sum += it.w;
    }
    layout.compact = compact; layout.colW = maxW; layout.labH = maxH;
    layout.rowW = sum + rowGap() * (items.length - 1);
  }

  /** Fit the camera so the bounding points (over the whole idle sway) fill the free rectangle */
  function fit() {
    W = el.clientWidth; H = el.clientHeight;
    if (!W || !H) return false;
    renderer.setPixelRatio(dpr());
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = review ? 14 : HERO.fov;
    camera.up.set(0, 1, 0);
    if (dev.view === 'top' || dev.view === 'bottom') camera.up.set(0, 0, 1);
    camera.updateProjectionMatrix();
    // animated: rotor discs over the whole idle sway; static: the real blades at the final yaw
    const animated = !review && motion !== false && !dev.view;
    const pose = animated ? FINAL : current;
    if (!fitPts || fitPose !== pose) { fitPts = samplePoints(pose, animated); fitPose = pose; }
    const yaws = animated ? [-SWAY, -SWAY / 2, 0, SWAY / 2, SWAY] : [current.yaw || 0];
    const quats = yaws.map((yw) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(yw)));
    const dir = camDir(view);
    const centre = new THREE.Box3().setFromPoints(fitPts).getCenter(new THREE.Vector3());
    const m = layout.m = Math.round(Math.max(18, Math.min(32, W * 0.026)));
    layout.gap = W < 400 ? 12 : 20;
    const right = new THREE.Vector3(), up = new THREE.Vector3();
    /** iterate camera distance + pan until the bounds fill rect; returns the distance */
    const solve = (rect) => {
      target.copy(centre);
      let dist = 0.9;
      for (let it = 0; it < 6; it++) {
        camera.position.copy(target).addScaledVector(dir, dist);
        camera.lookAt(target); camera.updateMatrixWorld(true);
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const q of quats) for (const p of fitPts) {
          tmp.copy(p).applyQuaternion(q).project(camera);
          const px = (tmp.x * 0.5 + 0.5) * W, py = (-tmp.y * 0.5 + 0.5) * H;
          if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
        }
        const k = Math.min((rect.x1 - rect.x0) / (x1 - x0), (rect.y1 - rect.y0) / (y1 - y0));
        const wpp = (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / H;
        right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
        target.addScaledVector(right, -((rect.x0 + rect.x1) / 2 - (x0 + x1) / 2) * wpp);
        target.addScaledVector(up, ((rect.y0 + rect.y1) / 2 - (y0 + y1) / 2) * wpp);
        dist /= k;
      }
      camera.position.copy(target).addScaledVector(dir, dist);
      camera.lookAt(target); camera.updateMatrixWorld(true);
      return dist;
    };
    if (!labelsOn || review) { layout.rect = { x0: m, x1: W - m, y0: m, y1: H - m }; solve(layout.rect); return true; }
    // text and band: full text in one row; else short text in one row; else short text stacked in three rows
    let choice = null;
    for (const compact of W < 560 ? [true] : [false, true]) {
      setLabelMode(compact);
      if (layout.rowW <= W - 2 * m) { choice = { compact, mode: 'row' }; break; }
    }
    if (!choice) { setLabelMode(true); choice = { compact: true, mode: 'stack' }; }
    layout.mode = choice.mode;
    layout.rect = { x0: m, x1: W - m, y0: m, y1: H - m - bandH(layout.mode) - layout.gap };
    solve(layout.rect);
    // plate order (and stack side): no crossing leaders over the whole sway, then the shortest leaders
    const anchorsAt = (yawDeg) => {
      const keep = current, kd = dragYaw;
      dragYaw = 0; applyPose({ ...(animated ? FINAL : current), yaw: yawDeg });
      stage.updateMatrixWorld(true);
      const A = {};
      for (const it of items) { model.anchors[it.id].getWorldPosition(tmp).project(camera); A[it.id] = { x: (tmp.x * 0.5 + 0.5) * W, y: (-tmp.y * 0.5 + 0.5) * H }; }
      dragYaw = kd; applyPose(keep);
      return A;
    };
    const sets = (animated ? [-SWAY, 0, SWAY] : [current.yaw || 0]).map(anchorsAt);
    let best = null;
    for (const side of layout.mode === 'row' ? ['left'] : ['left', 'right']) for (const order of PERMS) {
      let n = 0, len = 0;
      for (const A of sets) {
        const arr = arrange(A, layout.mode, side, order);
        n += crossings(arr);
        for (const r of arr) { const q = r.pts, a = q[q.length - 2], b = q[q.length - 1]; len += Math.hypot(b[0] - a[0], b[1] - a[1]); }
      }
      const score = n * 1e6 + len;
      if (!best || score < best.score) best = { side, order, score, n };
    }
    layout.side = best.side; layout.order = best.order; layout.crossings = best.n;
    return true;
  }

  /* ---------------------------------------------------------------- labels */
  function placeLabels() {
    if (!labelsOn || review || !W) return;
    stage.updateMatrixWorld(true);
    const A = {};
    for (const it of items) {
      model.anchors[it.id].getWorldPosition(tmp).project(camera);
      A[it.id] = { x: (tmp.x * 0.5 + 0.5) * W, y: (-tmp.y * 0.5 + 0.5) * H };
    }
    for (const r of arrange(A, layout.mode, layout.side, layout.order)) {
      r.it.div.style.transform = `translate3d(${Math.round(r.x)}px, ${Math.round(r.y)}px, 0)`;
      const a = r.pts[r.pts.length - 1];
      r.it.line.setAttribute('points', r.pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
      r.it.ring.setAttribute('cx', a[0].toFixed(1)); r.it.ring.setAttribute('cy', a[1].toFixed(1));
      r.it.dot.setAttribute('cx', a[0].toFixed(1)); r.it.dot.setAttribute('cy', a[1].toFixed(1));
    }
  }

  /* ---------------------------------------------------------------- render */
  let disposed = false, readySent = false;
  function render() {
    if (disposed || !W || !H) return;
    // key light sits up-left of the camera; rims stay behind the aircraft
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const fwd = new THREE.Vector3().subVectors(target, camera.position).normalize();
    key.position.copy(target).addScaledVector(right, -0.9).addScaledVector(fwd, -0.9).add(new THREE.Vector3(0, 1.3, 0));
    rim.position.copy(target).addScaledVector(fwd, 1.2).addScaledVector(right, 0.55).add(new THREE.Vector3(0, 0.12, 0));
    rim2.position.copy(target).addScaledVector(fwd, 0.8).addScaledVector(right, -1.0).add(new THREE.Vector3(0, 0.06, 0));
    rim.target.position.copy(target); rim2.target.position.copy(target); key.target.position.copy(target);
    rim.target.updateMatrixWorld(); rim2.target.updateMatrixWorld(); key.target.updateMatrixWorld();
    renderer.render(scene, camera);
    placeLabels();
    if (!readySent) { readySent = true; try { onReady?.(); } catch { /* the shell's problem */ } }
  }

  /* ---------------------------------------------------------------- initial pose */
  if (review) {
    const p = { ...FINAL, yaw: +(dev.yaw || 0) };
    if (dev.view === 'folded') { p.fold = 0; p.propOpen = 0; p.lift = 0; p.pitch = 0; }
    if (dev.fold != null) { p.fold = +dev.fold; p.propOpen = p.fold >= 1 ? 1 : 0; if (p.fold < 1) p.lift = 0; }
    if (dev.pitch != null) p.pitch = +dev.pitch;
    if (dev.blur != null) p.blur = +dev.blur;
    if (dev.prop != null) p.angle = THREE.MathUtils.degToRad(+dev.prop);
    if (['front', 'back', 'left', 'right', 'top', 'bottom'].includes(dev.view)) { p.lift = 0; }
    applyPose(p);
    ground.visible = !dev.sil && !['bottom'].includes(dev.view);
  } else if (dev.frame != null) {
    applyPose(poseAt(+dev.frame));
  } else if (!motion || dev.view === '34') {
    const p = { ...FINAL, yaw: +(dev.yaw || 0) };
    if (dev.blur != null) p.blur = +dev.blur;
    if (dev.prop != null) p.angle = THREE.MathUtils.degToRad(+dev.prop);
    if (dev.fold != null) p.fold = +dev.fold;
    if (dev.pitch != null) p.pitch = +dev.pitch;
    applyPose(p);
  } else {
    applyPose(poseAt(0));
  }
  fit();
  render();

  /* ---------------------------------------------------------------- loop, visibility, resize */
  let raf = 0, last = 0, clock = 0, started = false, inView = false;
  const running = () => !still && started && inView && !document.hidden && !disposed;
  const kick = () => { if (!raf && running()) { last = 0; raf = requestAnimationFrame(frame); } };
  let dragTarget = 0, dragVel = 0, dragging = false;
  function frame(ts) {
    raf = 0;
    if (!running()) return;
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
    last = ts;
    clock += dt;
    if (!dragging) { // critically damped return of the drag offset
      const k = 9;
      dragVel += (-k * k * dragYaw - 2 * k * dragVel) * dt;
      dragYaw += dragVel * dt;
    } else dragYaw += (dragTarget - dragYaw) * Math.min(1, dt * 14);
    applyPose(poseAt(clock));
    render();
    raf = requestAnimationFrame(frame);
  }
  const io = typeof IntersectionObserver !== 'undefined' && !still
    ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        inView = e.isIntersecting;
        if (inView && e.intersectionRatio >= 0.3) started = true;
      }
      kick();
    }, { threshold: [0, 0.3, 0.6] })
    : null;
  io?.observe(el);
  if (!io && !still) { started = true; inView = true; kick(); }
  const onVis = () => kick();
  document.addEventListener('visibilitychange', onVis);
  let roPending = false;
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
    if (roPending) return;
    roPending = true;
    requestAnimationFrame(() => { roPending = false; if (disposed) return; if (fit()) render(); });
    // background tabs never fire rAF: fall back so a still still re-renders
    setTimeout(() => { if (roPending && !disposed) { roPending = false; if (fit()) render(); } }, 120);
  }) : null;
  ro?.observe(el);
  const fontsReady = document.fonts?.ready;
  fontsReady?.then(() => { if (!disposed && fit()) render(); });

  // drag to orbit (subtle, horizontal only; vertical pans keep scrolling the page)
  let endDrag = null;
  const onDown = (e) => {
    if (still || e.button > 0) return;
    endDrag?.();
    dragging = true; wrap.dataset.drag = 'on';
    const x0 = e.clientX, y0 = dragYaw; dragTarget = dragYaw;
    const move = (ev) => { dragTarget = Math.max(-28, Math.min(28, y0 + (ev.clientX - x0) * 0.3)); };
    const up = () => {
      dragging = false; wrap.dataset.drag = ''; dragVel = 0; endDrag = null;
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    };
    endDrag = up;
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    kick();
  };
  if (!still) { wrap.dataset.drag = ''; wrap.addEventListener('pointerdown', onDown); }

  /* ---------------------------------------------------------------- handle */
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    io?.disconnect(); ro?.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    wrap.removeEventListener('pointerdown', onDown);
    endDrag?.();
    model.dispose();
    silMat?.dispose();
    if (dev.wire) model.group.traverse((o) => { if (o.isMesh) o.material.dispose(); });
    shadow.geometry.dispose(); shadowMat.dispose(); footMat.dispose(); shadowTex.dispose();
    envRT.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    wrap.remove();
    removeStyle();
  }
  return {
    dispose,
    resize() { if (fit()) render(); },
    /** Deterministic still at timeline time t (seconds) */
    renderAt(t) { applyPose(poseAt(t)); render(); return poseAt(t); },
    /** Static pose overrides for review: { fold, propOpen, angle (deg), blur, lift, pitch, yaw } */
    pose(p) { const q = { ...current, ...p }; if (p.angle != null) q.angle = THREE.MathUtils.degToRad(p.angle); applyPose(q); render(); },
    stats() {
      return {
        triangles: model.triangles(), detail: model.detail, tier: Q.tier, dpr: renderer.getPixelRatio(),
        draws: renderer.info.render.calls, rendered: renderer.info.render.triangles, size: [W, H],
        dims: { unfolded: model.measure(1).size, folded: model.measure(0).size }, labels: { mode: layout.mode, side: layout.side, compact: layout.compact, order: layout.order, crossings: layout.crossings },
      };
    },
    timeline: TL,
    model, renderer, scene, camera,
  };
}
