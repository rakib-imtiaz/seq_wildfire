// Command Table: the module the site mounts (src/lib/table3d.ts is the contract).
//
//   import { mountTable } from '/table/js/table.js';
//   const t = mountTable(el, { mode: 'hero' | 'steps', onReady, onStep, onLens, motion });
//   t.setProgress(u)            steps: 0..1 across the pinned track (step k is the k-th fifth)
//   t.setStep(n, { instant })   0 = the hero state, 1..5 the steps; glides unless instant or the page drives u
//   t.setLens({ x, y, r, active })  hero: the thermal lens (x, y 0..1 of the container, r its radius as a
//                               fraction of the width). Returns { maxC, e, n } from the thermal field.
//   t.getHotspot()              { x, y, visible } (0..1 of the container) where the hidden hotspot is
//   t.setInsets({ top, bottom, left, right })  px the DOM labels must keep clear of (header, caption card)
//   t.resize() / t.dispose()
// Review: renderFrame(u), view(rig), capture(type, q), stats(); sandbox flags in table.html.
//
// One engine (renderer, world, post, thermal, story, inset) serves every mount on the page: the WebGL
// canvas lives in the view that is most on screen and moves when another takes over; the view it leaves
// keeps a still of its last frame. Memory stays at one world however many sections mount the table.
import * as THREE from 'three';
import { detectQuality, startGovernor } from './lib/quality.js';
import { Post } from './finish.js';
import { World, LOOKS } from './world.js';
import { POSES, solvePose, solveHero, placeCamera, lerpRig, aspectClass } from './cameras.js';
import { ZONE } from './zone.js';
import { Thermal } from './thermal.js';
import { Story } from './story.js';
import { Overlay } from './overlay.js';
import { Pip } from './pip.js';
import { SHARED } from './shading.js';

/** The light look for each state: [from, to, t]. */
const STATE_LOOKS = [
  [LOOKS.dusk, LOOKS.dusk, 0],
  [LOOKS.dusk, LOOKS.blue, 0.6],
  [LOOKS.blue, LOOKS.blue, 0],
  [LOOKS.blue, LOOKS.night, 0.3],
  [LOOKS.night, LOOKS.night, 0],
  [LOOKS.blue, LOOKS.night, 0.25],
];
/** The finish: bloom only on the brightest sources (the beacon, lamps, the hottest glows), a gentle contrast S, split tone. */
const GRADE = { threshold: 4.5, curve: 0.5, split: 1, pivot: 0.13 };
const RESID = [1, 0.92, 0.85, 0.8, 0.7, 0.8];   // afternoon heat still held by the ground, per state
const N = 5;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (t) => t * t * (3 - 2 * t);
const sm = (a, b, x) => smooth(clamp01((x - a) / (b - a)));

let ENGINE = null;

function blendLook([a, b, t]) {
  if (!t) return a;
  const o = {};
  for (const k of Object.keys(a)) o[k] = a[k] instanceof THREE.Color ? a[k].clone().lerp(b[k], t) : a[k] + (b[k] - a[k]) * t;
  return o;
}
const LOOK_CACHE = STATE_LOOKS.map(blendLook);

/* =============================================================== engine */
class Engine {
  constructor(opts) {
    this.Q = opts.q || detectQuality();
    this.still = !!opts.still || opts.motion === false;
    this.debug = !!opts.debug;
    const canvas = document.createElement('canvas');
    canvas.className = 'command-table__canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'A 3D model of a sample wildfire watch zone: a river valley with a hydro dam, a transmission line, a substation and a patrol truck, on an operations table');
    Object.assign(canvas.style, { display: 'block', position: 'absolute', inset: '0', width: '100%', height: '100%', outline: 'none' });
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: this.still || this.debug });
    const r = this.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = this.Q.shadows;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.dprOverride = opts.dpr || 0;
    this.world = new World(r, this.Q);
    this.post = new Post(r, { q: this.Q });
    this.thermal = new Thermal(r, this.world, this.Q);
    this.story = new Story(this.world, this.Q);
    this.pip = this.Q.tier === 'lite' ? null : new Pip(r, this.Q);
    this.pip?.install(this.world.scene);
    this.camera = new THREE.PerspectiveCamera(30, 1, 10, 20000);
    this.camera.layers.enableAll();
    this.views = new Set();
    this.active = null;
    this.raf = 0; this.lastT = 0; this.clock0 = performance.now();
    this.size = [0, 0];
    this.thumbs = null;
    this.onVis = () => { if (document.hidden) this.stop(); else this.kick(); };
    document.addEventListener('visibilitychange', this.onVis);
    this.governor = this.still ? null : startGovernor({
      renderer: r, q: this.Q, cap: this.dpr(),
      setDpr: (v) => { r.setPixelRatio(v); this.resized(true); },
      onStep: (s) => (s === 'streak-off' ? this.post.setStreak(false) : s === 'bloom-down' ? this.post.bloomDown() : false),
    });
    this.assets = null;
    fetch(new URL('../assets.json', import.meta.url).href).then((res) => (res.ok ? res.json() : null)).then((a) => {
      this.assets = a;
      return this.story.loadAssets(a);
    }).then(() => { if (!this.disposed) this.invalidate(); }).catch(() => { /* optional assets */ });
  }

  dpr() { return this.dprOverride || Math.min(window.devicePixelRatio || 1, this.Q.dprCap); }

  /** Choose the view that is most on screen; move the canvas into it. */
  pick() {
    let best = null;
    for (const v of this.views) if (v.ratio > 0 && (!best || v.ratio > best.ratio + 0.01)) best = v;
    if (!best) best = this.active && this.views.has(this.active) ? this.active : [...this.views][0] || null;
    if (best && best !== this.active) this.attach(best);
    this.kick();
  }

  attach(view) {
    const prev = this.active;
    if (prev && prev !== view && this.canvas.parentNode === prev.container) {
      // the view we leave keeps a still of its last frame
      try { this.renderView(prev, performance.now()); prev.keepSnapshot(this.canvas); } catch (e) { /* fine */ }
    }
    this.active = view;
    view.container.insertBefore(this.canvas, view.container.firstChild);
    view.dropSnapshot();
    this.resized(false);
  }

  resized(fromGovernor) {
    const v = this.active; if (!v) return;
    v.measure();
    const r = this.renderer;
    if (!fromGovernor) r.setPixelRatio(this.dpr());
    r.setSize(v.w, v.h, false);
    this.post.setSize(v.w, v.h);
    const s = r.getDrawingBufferSize(new THREE.Vector2());
    this.thermal.setSize(s.x, s.y);
    this.thermal.dirty = true;
    this.size = [v.w, v.h];
  }

  kick() {
    if (this.disposed || !this.active) return;
    if (this.still || document.hidden) { this.invalidate(); return; }
    if (this.raf) return;
    this.lastT = 0;
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }
  stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
  /** Render now, outside the loop (still mode, hidden tabs, after a state change). */
  invalidate() { if (this.active && !this.disposed) this.renderView(this.active, performance.now()); }

  frame(now) {
    this.raf = 0;
    const v = this.active;
    if (!v || this.disposed || document.hidden) return;
    if (v.ratio <= 0) return;                         // off screen: rest until it comes back
    const dt = this.lastT ? now - this.lastT : 16.7;
    this.lastT = now;
    this.renderView(v, now);
    this.governor?.frame(dt);
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  /** Apply the view's state and draw it (canvas, thermal composite, inset, DOM overlay). */
  renderView(v, now) {
    const r = this.renderer, w = this.world, cam = this.camera;
    if (this.size[0] !== v.w || this.size[1] !== v.h) this.resized(false);
    const time = this.still ? 0 : (now - this.clock0) / 1000;
    const st = v.override ? { ...v.state(now), rig: v.override, rigKey: v.override } : v.state(now);
    // camera first: everything after reads it
    placeCamera(cam, st.rig, v.w, v.h);
    if (v.lastRig !== st.rigKey || !st.rigKey) { this.thermal.dirty = true; v.lastRig = st.rigKey; }
    w.applyLook(st.lookA, st.lookB, st.lookT);
    r.toneMappingExposure = w.look.exposure;
    r.setClearColor(w.look.room, 1);
    const bufH = v.h * r.getPixelRatio();
    const focal = bufH / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
    w.truck.setPixelScale(focal);
    const out = this.story.apply(st.story, cam, { bufH, dpr: r.getPixelRatio(), focal });
    w.update(time, this.still);
    // the thermal field: the hero lens (rendered when the view changes), or step 3's flip (every frame)
    const heroLens = v.mode === 'hero' && v.lens.active;
    if ((heroLens && this.thermal.dirty) || out.thermal) {
      this.thermal.render(w.scene, cam, { resid: st.resid, maskC: out.thermal ? out.thermal.maskC : null, truckEngine: out.engine, readback: heroLens });
    }
    // (the grade is for the lit table; step 4's map keeps its own flat dark tones)
    const mapK = 1 - Math.min(1, SHARED.uMap.value);
    this.post.render(w.scene, cam, { time, bloom: 0.42, grain: 0.028, vignette: 0.5, ...GRADE, curve: GRADE.curve * mapK, split: GRADE.split * mapK });
    if (heroLens) this.thermal.composite({ lens: v.lens, time, w: v.w, h: v.h });
    else if (out.thermal) this.thermal.composite({ world: out.thermal.world, alpha: out.thermal.alpha, time, w: v.w, h: v.h });
    // the picture-in-picture
    let pipRect = null;
    if (this.pip && out.pip && out.pip.show > 0.01) {
      const near = this.pip.aim(out.pip.pos, out.pip.heading, (x, z) => w.groundAt(x, z));
      if (near > 150) {
        pipRect = v.pipRect();
        this.pip.render(w.scene, pipRect, { fade: out.pip.show, exposure: w.look.exposure });
      }
    }
    // the DOM overlay
    if (v.overlay) {
      if (out.report && !this.thumbs) this.makeThumbs();
      if (out.report && this.thumbs) v.overlay.setThumbs(this.thumbs[0], this.thumbs[1]);
      v.overlay.update({ w: v.w, h: v.h, project: v.projector(cam), labels: out.labels, layers: out.layers, report: out.report, story: this.story, pipRect, slabAnchor: this.story.layers.hot });
    }
    v.lastOut = out;
    v.afterRender();
  }

  /** Two small images for the report, rendered from the scene once: the thermal field and the map. */
  makeThumbs() {
    try {
      const w = this.world, W = 320, H = 200;
      const h = this.story.hot;
      const cam = new THREE.PerspectiveCamera(34, W / H, 10, 6000);
      cam.position.set(h.x + 150, h.y + 330, h.z + 250); cam.lookAt(h.x, h.y, h.z); cam.updateMatrixWorld(true);
      const th = this.thermal.thumb(w.scene, cam, W, H);
      const mcam = new THREE.PerspectiveCamera(16, W / H, 100, 20000);
      mcam.position.set(0, 4400, 1); mcam.up.set(0, 0, -1); mcam.lookAt(0, 0, 0); mcam.updateMatrixWorld(true);
      const prev = w.look.exposure;
      w.setMapMode(1);
      const mp = this.thermal.thumbVisible(w.scene, mcam, W, H, Math.max(1.5, prev));
      this.thumbs = [th, mp];
    } catch (e) { this.thumbs = [null, null]; }
  }

  dispose() {
    this.disposed = true;
    this.stop();
    document.removeEventListener('visibilitychange', this.onVis);
    this.governor?.stop();
    this.story.dispose(); this.thermal.dispose(); this.pip?.dispose(); this.world.dispose(); this.post.dispose();
    this.renderer.dispose();
    try { this.renderer.forceContextLoss(); } catch (e) { /* gone */ }
    this.canvas.remove();
    if (ENGINE === this) ENGINE = null;
  }
}

/* =============================================================== a mounted view */
class View {
  constructor(engine, container, opts) {
    this.engine = engine;
    this.container = container;
    this.mode = opts.mode === 'hero' ? 'hero' : 'steps';
    this.cb = { onReady: opts.onReady, onStep: opts.onStep, onLens: opts.onLens };
    this.u = 0.1; this.driven = false; this.tween = null; this.lastStep = -1;
    this.lens = { x: 0.5, y: 0.5, r: 0.12, active: false };
    this.ratio = 1;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    this.overlay = this.mode === 'steps' ? new Overlay(container, { still: engine.still }) : null;
    this.measure();
    this.io = new IntersectionObserver(([e]) => { this.ratio = e.isIntersecting ? Math.max(0.001, e.intersectionRatio) : 0; engine.pick(); }, { threshold: [0, 0.05, 0.25, 0.5, 0.75, 1] });
    this.io.observe(container);
    this.ro = new ResizeObserver(() => { const w = this.w, h = this.h; this.measure(); if (engine.active === this && (w !== this.w || h !== this.h)) { engine.resized(false); engine.invalidate(); } });
    this.ro.observe(container);
  }

  measure() {
    const r = this.container.getBoundingClientRect();
    const w = Math.max(2, Math.round(r.width)), h = Math.max(2, Math.round(r.height));
    const covered = this.mode === 'steps' && this.overlay && this.overlay.insets.bottom > h * 0.25;   // a caption card over the view
    if (w === this.w && h === this.h && this.rigs && covered === this.covered && !this.heroStale) return;
    this.w = w; this.h = h; this.covered = covered; this.heroStale = false;
    this.cls = covered ? 'portrait' : aspectClass(w, h);
    this.rigs = POSES.map((p) => solvePose(p, w, h, this.cls));
    // hero: the largest slab clear of the site's copy block and header (solveHero); the page reports them
    // through setInsets({ top, avoid, lens }), until then a typical layout is assumed
    if (this.mode === 'hero') {
      const f = this.heroFrame(w, h), key = `${w}x${h}:${f.top}:${f.lens}:${f.margin}:${f.right}:${f.avoid ? f.avoid.map(Math.round).join(',') : '-'}`;
      if (key !== this.heroKey) { this.heroKey = key; this.heroRig = solveHero(w, h, { ground: (x, z) => this.engine.world.groundAt(x, z), ...f }); }
    }
  }

  /** The hero's frame constraints: the page's (setInsets) or the site's typical layout at this size. */
  heroFrame(w, h) {
    // (the site's desktop layout follows its 1024 px breakpoint; a scrollbar makes the stage a little narrower)
    const desk = w >= 1024 || (w > 900 && typeof matchMedia !== 'undefined' && matchMedia('(min-width: 1024px)').matches);
    const lens = desk ? Math.min(140, Math.max(62, w * 0.062)) : Math.min(88, Math.max(42, w * 0.12));
    // desktop: the slab in the right 56 %, 40 px clear of the frame; below: the whole stage, a slimmer margin on phones
    const def = desk ? { top: 76, avoid: [0, Math.max(76, h - 660), Math.max(w * 0.455, 545), h - 100], lens, margin: 40, right: 0.44 } : { top: 0, avoid: null, lens, margin: w < 600 ? 18 : 32, right: 0 };
    const o = this.heroInsets;
    return o ? { ...def, top: o.top ?? def.top, avoid: o.avoid !== undefined ? o.avoid : def.avoid, lens: o.lens ?? def.lens, margin: o.margin ?? def.margin, right: o.right ?? def.right } : def;
  }

  /** u → step k (1..5), progress p (0..1), the camera's glide to k+1 (tcam), light, rig. */
  state(now) {
    if (this.tween) {
      const t = clamp01((now - this.tween.t0) / this.tween.dur);
      this.u = this.tween.from + (this.tween.to - this.tween.from) * smooth(t);
      if (t >= 1) this.tween = null;
    }
    if (this.mode === 'hero') {
      return { rig: this.heroRig, rigKey: this.heroRig, lookA: LOOK_CACHE[0], lookB: null, lookT: 0, resid: RESID[0], story: { mode: 'hero', k: 0, p: 0, tcam: 0, time: 0, still: this.engine.still } };
    }
    const x = clamp01(this.u) * N;
    let k = Math.min(N, Math.floor(x) + 1), p = x - (k - 1);
    if (this.u >= 1) { k = N; p = 1; }
    const tcam = k < N ? smooth(sm(0.74, 1, p)) : 0;
    const rig = tcam > 0 ? lerpRig(this.rigs[k], this.rigs[k + 1], tcam, this.tmpRig || (this.tmpRig = { target: new THREE.Vector3() })) : this.rigs[k];
    if (k !== this.lastStep) { this.lastStep = k; this.cb.onStep?.(k); }
    return {
      rig, rigKey: tcam > 0 ? null : rig, lookA: LOOK_CACHE[k], lookB: LOOK_CACHE[Math.min(N, k + 1)], lookT: tcam,
      resid: RESID[k] + (RESID[Math.min(N, k + 1)] - RESID[k]) * tcam,
      story: { mode: 'steps', k, p, tcam, time: this.engine.still ? 0 : (now - this.engine.clock0) / 1000, still: this.engine.still },
    };
  }

  /** World point → CSS px within the container (null when behind the camera). */
  projector(cam) {
    const v = new THREE.Vector3(), W = this.w, H = this.h;
    return (p) => { v.copy(p).project(cam); if (v.z > 1 || v.z < -1) return null; return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H }; };
  }

  /** The inset's rectangle: top right, under the step badge; smaller on phones. */
  pipRect() {
    const W = this.w, phone = W < 640;
    const w = Math.round(phone ? Math.min(W * 0.42, 170) : Math.min(W * 0.3, 320)), h = Math.round(w * 0.625);
    const top = Math.round((this.overlay?.insets.top ?? 64) + 6), right = phone ? 10 : 20;
    return { x: W - w - right, y: top, w, h };
  }

  keepSnapshot(src) {
    if (!this.snap) {
      this.snap = document.createElement('canvas'); this.snap.className = 'command-table__still';
      Object.assign(this.snap.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
      this.snap.setAttribute('aria-hidden', 'true');
    }
    this.snap.width = src.width; this.snap.height = src.height;
    this.snap.getContext('2d').drawImage(src, 0, 0);
    this.container.insertBefore(this.snap, this.container.firstChild);
  }
  dropSnapshot() { if (this.snap) this.snap.remove(); }

  afterRender() {
    if (this.readySent) return;
    this.readySent = true;
    const r = { ok: true, quality: this.engine.Q, buildMs: Math.round(this.engine.world.buildMs) };
    queueMicrotask(() => this.cb.onReady?.(r));
  }

  dispose() {
    this.io.disconnect(); this.ro.disconnect();
    this.overlay?.dispose();
    this.dropSnapshot();
    const e = this.engine;
    e.views.delete(this);
    if (e.active === this) { e.active = null; if (e.canvas.parentNode === this.container) this.container.removeChild(e.canvas); }
    if (!e.views.size) e.dispose(); else e.pick();
  }
}

/* =============================================================== mount */
export function mountTable(container, opts = {}) {
  let engine;
  try {
    if (!ENGINE || ENGINE.disposed) ENGINE = new Engine(opts);
    engine = ENGINE;
  } catch (e) {
    queueMicrotask(() => opts.onReady?.({ ok: false, error: e }));
    const noop = () => {};
    return { ok: false, setProgress: noop, setStep: noop, setLens: noop, getHotspot: () => null, setInsets: noop, resize: noop, dispose: noop, renderFrame: noop };
  }
  const view = new View(engine, container, opts);
  engine.views.add(view);
  engine.pick();

  const api = {
    ok: true,
    quality: engine.Q,
    setProgress(u) {
      if (engine.disposed) return;
      view.driven = true; view.tween = null;
      view.u = clamp01(Number(u) || 0);
      if (engine.active === view) engine.kick();
    },
    setStep(n, { instant = false } = {}) {
      if (engine.disposed) return;
      n = Math.max(0, Math.min(N, Math.round(n)));
      if (view.mode === 'hero') { if (engine.active === view) engine.invalidate(); return; }
      if (view.driven && !instant) return;            // the page drives u by scroll; the step follows from it
      const to = n === 0 ? 0 : (n - 0.5) / N;
      if (instant || engine.still) { view.u = to; view.tween = null; if (engine.active === view) engine.invalidate(); return; }
      view.tween = { from: view.u, to, t0: performance.now(), dur: 1100 };
      engine.kick();
    },
    setLens({ x = 0.5, y = 0.5, r, active = false } = {}) {
      if (engine.disposed) return undefined;
      view.lens = { x, y, r: r || view.lens.r || 0.12, active };
      if (engine.active === view && (engine.still || engine.thermal.dirty || !engine.thermal.grid)) engine.invalidate();
      if (!active) return undefined;
      const p = groundUnder(engine, view, x, y);
      let m = engine.active === view ? engine.thermal.maxIn(x, y, view.lens.r) : null;
      // the raster can miss the hotspot's narrow core at small sizes: evaluate the same field analytically at
      // the hotspot's nearest point inside the lens (when the hotspot is visible from here)
      const hp = api.getHotspot();
      if (hp && hp.visible) {
        const dpx = Math.hypot((hp.x - x) * view.w, (hp.y - y) * view.h), rpx = view.lens.r * view.w;
        if (dpx < rpx + 40) {
          const mpp = hp.mpp || 1;
          const dm = Math.max(0, dpx - rpx) * mpp;
          const v = hotField(dm);
          m = m === null ? v : Math.max(m, v);
        }
      }
      const out = {};
      if (m !== null) out.maxC = Math.round(m * 10) / 10;
      if (p) { out.e = Math.round(p.x); out.n = Math.round(-p.z); }
      return out.maxC === undefined && out.e === undefined ? undefined : out;
    },
    getHotspot() {
      if (engine.disposed) return null;
      view.measure();                                  // never project with a stale (or not yet laid out) size
      if (view.w < 40 || view.h < 40) return null;
      const cam = new THREE.PerspectiveCamera();
      const rig = view.state(performance.now()).rig;
      placeCamera(cam, rig, view.w, view.h);
      const h = ZONE.hotspot, g = engine.world.groundAt(h.x, h.z) + 6;
      const v = new THREE.Vector3(h.x, g, h.z).project(cam);
      if (v.z > 1 || v.z < -1) return null;
      const out = { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
      if (!Number.isFinite(out.x) || !Number.isFinite(out.y)) return null;
      const onScreen = out.x > 0.02 && out.x < 0.98 && out.y > 0.02 && out.y < 0.98;
      // metres per screen pixel at the hotspot (for the readout)
      const v2 = new THREE.Vector3(h.x + 20, g, h.z).project(cam);
      out.mpp = 20 / Math.max(0.5, Math.hypot((v2.x - v.x) / 2 * view.w, (v2.y - v.y) / 2 * view.h));
      // visible: the first surface under that pixel is the hotspot's ground (a grazing view at a small scale
      // lands a few pixels' worth of metres away from it)
      const q = groundUnder(engine, view, out.x, out.y);
      out.visible = onScreen && !!q && Math.hypot(q.x - h.x, q.z - h.z) < Math.max(40, out.mpp * 14);
      // hero: where the lens rests (off-centre, away from the nearest cut edge) and the slab's interior from there
      if (rig.rest) { out.rest = { x: out.x + rig.rest[0] / view.w, y: out.y + rig.rest[1] / view.h }; out.inward = { x: rig.inward[0], y: rig.inward[1] }; }
      return out;
    },
    setInsets(o) {
      view.overlay?.setInsets(o || {});
      if (view.mode === 'hero' && o) { view.heroInsets = { top: o.top, avoid: o.avoid, lens: o.lens, margin: o.margin, right: o.leftLimit }; view.heroStale = true; }
      view.measure();
      if (engine.active === view) engine.invalidate();
    },
    resize() { view.measure(); if (engine.active === view) { engine.resized(false); engine.invalidate(); } },
    /** Review: render progress u synchronously (no rAF); returns the camera position. */
    renderFrame(u) {
      if (view.mode === 'steps') { view.u = clamp01(u); view.tween = null; view.driven = true; }
      if (engine.active !== view) engine.attach(view);
      engine.renderView(view, performance.now());
      return engine.camera.position.toArray().map((v) => Math.round(v));
    },
    /** Review: hold the camera on a rig ({ target: [x, y, z], yaw, pitch, dist, fov }; null releases it). */
    view(r) {
      view.override = r ? { shiftX: 0, shiftY: 0, fov: 30, ...r, target: new THREE.Vector3(...(r.target || [0, 0, 0])) } : null;
      if (engine.active !== view) engine.attach(view);
      engine.renderView(view, performance.now());
      return view.override;
    },
    /** Render now and return the canvas as a data URL (stills). */
    capture(type = 'image/webp', q = 0.86) { if (engine.active !== view) engine.attach(view); engine.renderView(view, performance.now()); return engine.canvas.toDataURL(type, q); },
    get camera() { return engine.camera; },
    get world() { return engine.world; },
    get story() { return engine.story; },
    get thermal() { return engine.thermal; },
    get renderer() { return engine.renderer; },
    get canvas() { return engine.canvas; },
    get overlay() { return view.overlay; },
    get lastOut() { return view.lastOut; },
    stats() {
      const i = engine.renderer.info;
      return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, dpr: engine.renderer.getPixelRatio(), size: [view.w, view.h], tier: engine.Q.tier, governor: engine.governor?.state(), buildMs: Math.round(engine.world.buildMs), trees: engine.world.forest.trees.length, views: engine.views.size, active: engine.active === view, m3t: engine.story.drone.real };
    },
    dispose() { view.dispose(); },
  };
  return api;
}

/** The thermal field's hotspot terms at a distance d (m) from its centre, on a dusk ambient (thermal.js). */
function hotField(d) {
  const core = ZONE.hotspot.peakC * Math.exp(-Math.pow(d / 21, 6));
  const halo = 62 * Math.exp(-(d * d) / 500) + 15 * Math.exp(-(d * d) / 4400);
  return Math.max(18 + halo, core);
}

/** The first surface point under a container point (0..1), marching the view ray over surfaceAt. */
function groundUnder(engine, view, x, y) {
  const cam = new THREE.PerspectiveCamera();
  placeCamera(cam, view.override || view.state(performance.now()).rig, view.w, view.h);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(x * 2 - 1, 1 - y * 2), cam);
  const o = ray.ray.origin, d = ray.ray.direction, w = engine.world;
  const above = (t) => o.y + d.y * t - w.surfaceAt(o.x + d.x * t, o.z + d.z * t);
  let t = 0, prev = 0;
  const step = Math.max(4, cam.position.length() / 400);
  for (let i = 0; i < 2000; i++) {
    const px = o.x + d.x * t, pz = o.z + d.z * t;
    if (px > -800 && px < 800 && pz > -500 && pz < 500 && above(t) < 0) {
      let a = prev, b = t;
      for (let k = 0; k < 24; k++) { const m = (a + b) / 2; if (above(m) < 0) b = m; else a = m; }
      return { x: o.x + d.x * b, y: o.y + d.y * b, z: o.z + d.z * b };
    }
    if (o.y + d.y * t < -120) return null;
    prev = t; t += step;
  }
  return null;
}
