// Command Table: the five steps as pure functions of scroll. Step k (1..5) covers a fifth of the pinned
// track; p (0..1) is the progress through it. Each step's action completes by p ≈ 0.55 (the step's centre,
// where the site's step buttons land) and holds; the camera glides to the next pose over p 0.74..1.
//   1 Ground monitoring   the ember patrol route draws (draped, road-snapped, over the dam crest); the truck
//                         drives it out to the substation and back to its pull-out; checkpoints tick on
//   2 Aerial inspection   the M3T unfolds on the truck bed, lifts, climbs along ZONE.flight; the inset
//                         follows it; observation points appear while it holds over the slope
//   3 Thermal detection   a scan cone; the ground under it turns to the thermal field, then the whole
//                         table; the hotspot blooms with pulse rings; a thin plume rises downwind
//   4 Digital mapping     top-down; the slab becomes a dark hillshade with contours; the six layers draw
//                         (the DOM overlay draws them; this module supplies their geometry and timing)
//   5 Reporting           the camera pulls back; the report assembles (DOM overlay)
// The hero (S0) keeps everything quiet: the truck parked with its beacon, the hotspot hidden in the visible
// view (only the thermal lens finds it).
import * as THREE from 'three';
import { ZONE } from './zone.js';
import { DAM, LEVELS, ROAD_MAIN, project, pointAt, clamp, smooth } from './layout.js';
import { groundAt, ROADS } from './terrain.js';
import { Ribbon, Marks, Glow } from './lines.js';
import { Drone, Flight } from './drone.js';
import { Smoke } from './smoke.js';

const sm = (a, b, x) => smooth(a, b, x);
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
const EMBER = lin(1.0, 0.28, 0.05);

/** Densify a polyline with straight segments every `step` metres. */
function straight(pts, step = 5) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

export class Story {
  constructor(world, Q) {
    this.world = world; this.Q = Q;
    const scene = world.scene;
    const surf = (x, z) => world.surfaceAt(x, z);
    // snap a point to a road centre line when it is on one, to the dam crest when it is on it
    const snap = ([x, z]) => {
      const [xl, zl] = DAM.toLocal(x, z);
      if (Math.abs(zl) < DAM.half - 2 && Math.abs(xl - (DAM.arc(zl) + 4)) < 16) return DAM.toWorld(DAM.arc(zl) + 4, zl);
      let best = null, bd = 13;
      for (const r of ROADS) { const q = project(r.L, x, z); const d = Math.hypot(q.qx - x, q.qz - z); if (d < bd) { bd = d; best = [q.qx, q.qz]; } }
      return best || [x, z];
    };
    const drape = (xz, lift) => xz.map((p) => { const [x, z] = snap(p); return new THREE.Vector3(x, surf(x, z) + lift, z); });

    /* the patrol route (step 1; step 4 redraws it as a map layer) */
    this.patrolXZ = straight(ZONE.patrol, 4);
    this.patrolPts = drape(this.patrolXZ, 2.2);
    this.patrol = new Ribbon(this.patrolPts, { color: EMBER.clone().multiplyScalar(1.7), width: 2.6, dash: 13, gap: 8 });
    const cum = [0]; for (let i = 1; i < this.patrolPts.length; i++) cum.push(cum[i - 1] + this.patrolPts[i].distanceTo(this.patrolPts[i - 1]));
    this.patrolCum = cum; this.patrolLen = cum[cum.length - 1];
    // where each ZONE.patrol vertex falls along the dense line
    const vertS = []; { let k = 0; for (let i = 0; i < ZONE.patrol.length; i++) { while (k < this.patrolXZ.length - 1 && (this.patrolXZ[k][0] !== ZONE.patrol[i][0] || this.patrolXZ[k][1] !== ZONE.patrol[i][1])) k++; vertS.push(cum[k]); } }
    this.vertS = vertS;
    this.cps = ZONE.checkpoints.map((c, j) => {
      const s = vertS[c.i] / this.patrolLen;
      const idx = Math.max(0, cum.findIndex((v) => v >= vertS[c.i] - 1e-6));
      return { ...c, n: j + 1, s, p: this.patrolPts[idx].clone() };
    });
    this.cpMarks = new Marks(this.cps.map((c) => ({ p: c.p.clone().add(new THREE.Vector3(0, 1.5, 0)), t: c.s })), { color: EMBER.clone().multiplyScalar(2.4), size: 9, shape: 'square' });

    /* the truck's drive: out along the patrol to the substation and back (patrol 0..12), then home to the pull-out */
    const s12 = vertS[12];
    this.truckS12 = s12;
    const home = ZONE.truckStart;
    const q0 = project(ROAD_MAIN, ZONE.patrol[12][0], ZONE.patrol[12][1]), q1 = project(ROAD_MAIN, home.x, home.z);
    const back = [];
    for (let s = q0.s; s >= q1.s - 0.01 && back.length < 200; s -= 3) { const P = pointAt(ROAD_MAIN, s); back.push([P.x, P.z]); }
    back.push([home.x, home.z]);
    this.backPts = back.map(([x, z]) => new THREE.Vector3(x, surf(x, z), z));
    const bc = [0]; for (let i = 1; i < this.backPts.length; i++) bc.push(bc[i - 1] + this.backPts[i].distanceTo(this.backPts[i - 1]));
    this.backCum = bc;

    /* the drone, its flight, the dotted flight line, observation points */
    this.drone = new Drone();
    scene.add(this.drone.root, this.drone.strobe.points);
    this.flight = new Flight(world.truck.bedTop);
    this.flightLine = new Ribbon([new THREE.Vector3().copy(world.truck.bedTop), ...this.flight.points], { color: lin(0.86, 0.82, 0.76).multiplyScalar(1.4), width: 1.7, dash: 2.5, gap: 7 });
    this.obs = ZONE.observations.map(([x, z]) => new THREE.Vector3(x, surf(x, z) + 3, z));
    this.obsMarks = new Marks(this.obs.map((p, i) => ({ p, t: (i + 1) / (this.obs.length + 1) })), { color: lin(0.95, 0.92, 0.86).multiplyScalar(1.6), size: 7, shape: 'circle' });

    /* step 3: the scan cone, its footprint, pulse rings, the ember glow, smoke */
    const H = ZONE.hotspot;
    this.hot = new THREE.Vector3(H.x, groundAt(H.x, H.z), H.z);
    this.coneU = { uOpacity: { value: 0 }, uCol: { value: lin(1.0, 0.88, 0.55) } };
    this.cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 48, 1, true).translate(0, -0.5, 0), new THREE.ShaderMaterial({
      uniforms: this.coneU, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = -position.y; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uOpacity; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = 1.0 - abs(dot(vN, vV)); float a = (0.05 + 0.55 * pow(f, 3.0)) * uOpacity * smoothstep(0.0, 0.15, vY); gl_FragColor = vec4(uCol * a, 1.0); }',
    }));
    this.cone.frustumCulled = false; this.cone.layers.set(1); this.cone.renderOrder = 7;
    const ring = (r, lift = 2.5) => { const pts = []; for (let a = 0; a < 72; a++) { const t = (a / 72) * Math.PI * 2, x = H.x + Math.cos(t) * r, z = H.z + Math.sin(t) * r; pts.push(new THREE.Vector3(x, surf(x, z) + lift, z)); } return pts; };
    this.footprint = new Ribbon(ring(70), { color: lin(1.0, 0.88, 0.55).multiplyScalar(1.5), width: 1.4, dash: 6, gap: 5, closed: true });
    this.pulse = [0, 1, 2].map(() => new Ribbon(ring(30), { color: lin(1.0, 0.82, 0.45).multiplyScalar(2.2), width: 1.6, closed: true }));
    this.pulseRadii = [];
    this.ember = new Glow(lin(1.0, 0.36, 0.06).multiplyScalar(3.2), { size: 7, minPx: 3 });
    this.ember.setAt(0, this.hot.clone().add(new THREE.Vector3(0, 1.2, 0)));
    this.smoke = new Smoke(world.noise);
    this.smoke.mesh.layers.set(2);
    for (const o of [this.patrol.mesh, this.cpMarks.points, this.flightLine.mesh, this.obsMarks.points, this.cone, this.footprint.mesh, ...this.pulse.map((r) => r.mesh), this.ember.points, this.smoke.mesh]) scene.add(o);
    this.ribbons = [this.patrol, this.flightLine, this.footprint, ...this.pulse];
    this.marks = [this.cpMarks, this.obsMarks];

    /* map layers (S4): world polylines the DOM overlay projects */
    this.layers = this.buildLayers(surf);

    this.tmpV = new THREE.Vector3();
  }

  /** Optional assets (the real M3T, smoke sprites). */
  async loadAssets(assets) {
    if (!assets) return;
    if (assets.m3t) await this.drone.load(assets);
    if (assets.smoke && assets.smoke[0]) this.smoke.useSprite(new URL('../' + assets.smoke[0], import.meta.url).href);
  }

  buildLayers(surf) {
    const d = (xz, lift = 2) => xz.map(([x, z]) => new THREE.Vector3(x, surf(x, z) + lift, z));
    const rect = (cx, cz, w, h, rot = 0) => { const c = Math.cos(rot), s = Math.sin(rot); return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2], [-w / 2, -h / 2]].map(([a, b]) => [cx + a * c - b * s, cz + a * s + b * c]); };
    const S = ZONE.substation, Y = ZONE.switchyard;
    const crest = []; for (let zl = -DAM.half; zl <= DAM.half; zl += 6) crest.push(DAM.toWorld(DAM.arc(zl) + 4, zl));
    const ph = DAM.ph, phr = []; for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]) phr.push(DAM.toWorld(ph.xl + (a * ph.d) / 2, ph.zl + (b * ph.w) / 2));
    return {
      infra: [
        { kind: 'dam', pts: crest.map(([x, z]) => new THREE.Vector3(x, LEVELS.crest + 1, z)) },
        { kind: 'box', pts: d(phr) },
        { kind: 'box', pts: d(rect(S.x, S.z, S.w, S.d, S.rot)) },
        { kind: 'box', pts: d(rect(Y.x, Y.z, Y.w, Y.d)) },
        { kind: 'line', pts: d([[Y.x, Y.z], ...ZONE.towers, [S.x, S.z]], 30) },
      ],
      towers: ZONE.towers.map(([x, z]) => new THREE.Vector3(x, surf(x, z) + 30, z)),
      patrol: this.patrolPts,
      obs: this.obs,
      hot: this.hot.clone().add(new THREE.Vector3(0, 2, 0)),
      perimeters: ZONE.perimeters.map((P) => ({ t: P.t, pts: d([...P.pts, P.pts[0]]) })),
      escalation: d([...ZONE.escalation, ZONE.escalation[0]]),
      dam: new THREE.Vector3(DAM.cx, LEVELS.crest + 2, DAM.cz),
      substation: new THREE.Vector3(S.x, surf(S.x, S.z) + 4, S.z),
    };
  }

  /** Truck pose for step-1 progress b (0..1 of the drawn route). */
  truckAt(b) {
    const sHead = b * this.patrolLen;
    const P = this.patrolPts, C = this.patrolCum;
    if (sHead <= this.truckS12) {
      let i = 0; while (i < C.length - 2 && C[i + 1] < sHead) i++;
      const k = (sHead - C[i]) / Math.max(1e-6, C[i + 1] - C[i]);
      const pos = P[i].clone().lerp(P[i + 1], k);
      pos.y = this.world.surfaceAt(pos.x, pos.z);
      const dir = P[Math.min(P.length - 1, i + 1)].clone().sub(P[i]);
      return { pos, heading: Math.atan2(dir.x, dir.z) };
    }
    const r = (sHead - this.truckS12) / Math.max(1, this.patrolLen - this.truckS12);
    const B = this.backPts, bc = this.backCum, sb = clamp(r * 1.6, 0, 1) * bc[bc.length - 1];
    let i = 0; while (i < bc.length - 2 && bc[i + 1] < sb) i++;
    const k = (sb - bc[i]) / Math.max(1e-6, bc[i + 1] - bc[i]);
    const pos = B[i].clone().lerp(B[i + 1], Math.min(1, k));
    const dir = B[Math.min(B.length - 1, i + 1)].clone().sub(B[i]);
    return { pos, heading: Math.atan2(dir.x, dir.z) };
  }

  /**
   * Apply a story state. st: { mode: 'hero'|'steps', k: 1..5, p: 0..1, tcam: 0..1 (gliding to k+1), time, still }.
   * Returns { labels, layers (S4 timing), report (S5 timing), pip, thermal, anchors }.
   */
  apply(st, camera, pxScale) {
    const w = this.world, { k, p, tcam } = st;
    const hero = st.mode === 'hero';
    for (const r of this.ribbons) r.setResY(pxScale.bufH);
    for (const m of this.marks) m.setScale(pxScale.dpr);
    this.ember.setPixelScale(pxScale.focal); this.drone.strobe.setPixelScale(pxScale.focal);
    const out = { labels: [], layers: null, report: null, pip: null, thermal: null, anchors: {} };
    const tr = w.truck;

    /* the truck */
    let truck;
    if (!hero && k === 1) {
      const b = sm(0.02, 0.58, p);
      truck = this.truckAt(b);
    } else {
      const t = ZONE.truckStart;
      truck = { pos: new THREE.Vector3(t.x, groundAt(t.x, t.z), t.z), heading: Math.atan2(Math.cos(t.heading), Math.sin(t.heading)) };
      if (!hero && k >= 2) { const back = this.truckAt(1); truck.heading = back.heading; }
    }
    const pad = w.pullout;
    tr.group.position.set(truck.pos.x, (k === 1 && !hero) ? truck.pos.y : (pad ? pad.y : truck.pos.y), truck.pos.z);
    tr.group.rotation.set(0, truck.heading, 0);
    tr.group.updateMatrixWorld(true);
    const bed = new THREE.Vector3(0, 1.23, -1.85).applyMatrix4(tr.group.matrixWorld);
    const engine = new THREE.Vector3(0, 1.1, 2.0).applyMatrix4(tr.group.matrixWorld);
    out.anchors.truck = tr.group.position.clone().add(new THREE.Vector3(0, 3, 0));
    out.engine = engine;

    /* step 1: the patrol route and checkpoints */
    const draw1 = hero ? 0 : k === 1 ? sm(0.02, 0.58, p) : 1;
    const patrolOp = hero ? 0 : k === 1 ? 1 : k === 2 ? 1 - 0.88 * sm(0, 0.22, p) : k === 3 ? 0.12 * (1 - sm(0, 0.3, p)) : 0;
    this.patrol.set(draw1, patrolOp);
    this.cpMarks.set(draw1, hero ? 0 : k === 1 ? 1 : k === 2 ? 1 - 0.6 * sm(0, 0.25, p) : 0);
    if (!hero && k === 1) {
      out.labels.push({ id: 'truck', anchor: out.anchors.truck, text: 'Patrol unit', sub: 'Ground monitoring' });
      const done = this.cps.filter((c) => c.s <= draw1 + 1e-4);
      const last = done[done.length - 1];
      if (last) out.labels.push({ id: 'cp', anchor: last.p.clone().add(new THREE.Vector3(0, 2, 0)), text: `CP-${String(last.n).padStart(2, '0')} ${last.t}`, sub: 'Sample' });
    }

    /* step 2: the drone and its flight; step 3: hover and scan */
    let dronePos = bed.clone(), heading = truck.heading, fold = 1, props = 0, gimbal = -10, pitch = 0, flying = false, droneOn = !hero && k <= 3;
    let fprog = 0;
    if (!hero && k === 2) {
      fold = 1 - sm(0.02, 0.1, p);
      props = sm(0.06, 0.12, p);
      const lift = sm(0.1, 0.2, p);
      fprog = sm(0.2, 0.58, p);
      if (fprog <= 0) { dronePos.copy(bed).add(new THREE.Vector3(0, 28 * lift + 0.05, 0)); }
      else { const a = this.flight.at(fprog); dronePos.copy(a.pos); heading = a.heading; pitch = 0.14 * (1 - sm(0.5, 0.6, p)); }
      flying = lift > 0;
      gimbal = -20;
    } else if (!hero && k === 3) {
      const a = this.flight.at(1); dronePos.copy(a.pos); heading = a.heading; fold = 0; props = 1; flying = true; fprog = 1;
      gimbal = -20 - 55 * sm(0, 0.15, p);
    } else if (!hero && k > 3) { droneOn = false; fprog = 1; }
    this.drone.set({ pos: dronePos, heading, pitch, fold, props, gimbal, visible: droneOn, strobe: flying ? 1 : 0, time: st.still ? 0.4 : st.time });
    out.anchors.drone = dronePos.clone();
    this.flightLine.set(!hero && k >= 2 ? (k === 2 ? 0.02 + 0.98 * fprog : 1) : 0, !hero ? (k === 2 ? 1 : k === 3 ? 0.55 * (1 - tcam) : 0) : 0);
    this.obsMarks.set(!hero && k === 2 ? sm(0.56, 0.72, p) : k === 3 ? 1 : 0, !hero && (k === 2 || k === 3) ? (k === 3 ? 1 - tcam : 1) : 0);
    if (!hero && k === 2 && flying) {
      const agl = Math.round(dronePos.y - groundAt(dronePos.x, dronePos.z));
      out.labels.push({ id: 'drone', anchor: dronePos, text: `M3T · ${agl} m AGL`, sub: 'Aerial inspection' });
      // the picture-in-picture: only once the nearest framed ground is > 150 m away
      out.pip = { pos: dronePos.clone(), heading, show: sm(0.2, 0.3, p) * (1 - sm(0.9, 0.98, p)) };
    }
    if (!hero && k === 3) out.labels.push({ id: 'drone', anchor: dronePos, text: 'M3T · thermal 640×512', sub: `Gimbal ${Math.round(gimbal)}°` });

    /* step 3: cone, thermal flip, bloom, plume */
    const coneOn = !hero && k === 3 ? sm(0, 0.12, p) * (1 - tcam) : 0;
    this.coneU.uOpacity.value = coneOn;
    this.cone.visible = coneOn > 0.003;
    if (this.cone.visible) {
      const apex = dronePos, base = this.hot;
      const h = apex.distanceTo(base);
      this.cone.position.copy(apex);
      this.cone.scale.set(70, h, 70);
      this.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), base.clone().sub(apex).normalize());
    }
    this.footprint.set(1, coneOn);
    if (!hero && k === 3) {
      const r1 = 75 * sm(0.1, 0.28, p), r2 = 2600 * sm(0.3, 0.55, p);
      out.thermal = { world: { radius: Math.max(r1, r2), feather: r2 > 0 ? 120 : 18 }, alpha: 1 - tcam, maskC: this.hot };
    }
    const bloom = !hero && k === 3 ? sm(0.22, 0.4, p) * (1 - tcam) : 0;
    for (let i = 0; i < 3; i++) {
      const ph = st.still ? (i / 3 + 0.15) % 1 : ((st.time * 0.45) + i / 3) % 1;
      const rr = 14 + 70 * ph;
      if (bloom > 0) {
        const pts = []; for (let a = 0; a < 72; a++) { const t = (a / 72) * Math.PI * 2, x = this.hot.x + Math.cos(t) * rr, z = this.hot.z + Math.sin(t) * rr; pts.push(new THREE.Vector3(x, w.surfaceAt(x, z) + 2.5, z)); }
        if (!st.still || this.pulseRadii[i] !== rr) { this.pulse[i].setPoints(pts); this.pulseRadii[i] = rr; }
      }
      this.pulse[i].set(1, bloom * (1 - ph) * 0.9);
    }
    if (bloom > 0.05) out.labels.push({ id: 'hot', anchor: this.hot.clone().add(new THREE.Vector3(0, 6, 0)), text: `Max ${ZONE.hotspot.peakC} °C`, sub: 'Sample hotspot', heat: true });
    out.anchors.hot = this.hot.clone();
    const smokeAmt = hero || k === 1 ? 0 : k === 2 ? 0.35 * sm(0.3, 0.6, p) : k === 3 ? 0.35 + 0.55 * sm(0.0, 0.3, p) : k === 4 ? 0.25 : 0.4;
    this.smoke.set(smokeAmt, st.still ? 0 : st.time, w.look.sun / 6 + 0.25, w.sun.position.clone().normalize());
    this.ember.set(hero ? 0 : k === 2 ? 0.5 * sm(0.3, 0.6, p) : k === 3 ? 1 : k >= 4 ? 0.6 : 0);

    /* step 4: map mode and layers; step 5: report */
    const map = hero ? 0 : k === 3 ? tcam : k === 4 ? 1 : k === 5 ? 1 - sm(0, 0.35, p) : 0;
    w.setMapMode(map);
    if (!hero && k === 4) out.layers = { p: sm(0.0, 0.6, p), fade: 1 - tcam, map };
    if (!hero && k === 3 && tcam > 0) out.layers = { p: 0, fade: 0, map };
    if (!hero && k === 5) out.report = { p: sm(0.0, 0.55, p) };
    out.anchors.dam = this.layers.dam; out.anchors.substation = this.layers.substation;
    out.anchors.checkpoints = this.cps.map((c) => c.p);
    return out;
  }

  dispose() {
    for (const r of this.ribbons) r.dispose();
    for (const m of this.marks) m.dispose();
    this.ember.dispose(); this.smoke.dispose(); this.drone.dispose();
    this.cone.geometry.dispose(); this.cone.material.dispose();
  }
}
