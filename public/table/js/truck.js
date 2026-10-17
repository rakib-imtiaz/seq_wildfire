// Command Table: the guard's pickup at ZONE.truckStart. An unbranded charcoal full-size crew cab
// (5.9 × 2.0 × 1.95 m, 3.7 m wheelbase), black wheels and trim, plain doors, an amber LED beacon bar
// on the roof. At table scale it is a dark speck with an amber point; it is modelled properly anyway
// for wave 2's close-ups (picture-in-picture, the drone lifting off its bed).
// Local frame: +z is the nose, origin on the ground midway between the axles.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ZONE } from './zone.js';
import { PADS } from './terrain.js';
import { Parts } from './kit.js';
import { patchMaterial } from './shading.js';

export class Truck {
  constructor(Q) {
    const P = new Parts();
    const rbox = (key, w, h, d, x, y, z, r = 0.12, rx = 0) => {
      const g = new RoundedBoxGeometry(w, h, d, 2, r);
      if (rx) g.rotateX(rx);
      g.translate(x, y, z);
      P.add(key, g);
    };
    const W = 2.0;
    // body: lower body, hood, crew cab, roof, bed
    rbox('paint', W, 0.78, 5.75, 0, 0.86, 0, 0.14);
    rbox('paint', W - 0.06, 0.34, 1.75, 0, 1.28, 1.95, 0.12, -0.04);
    rbox('paint', W - 0.1, 0.9, 2.55, 0, 1.6, 0.2, 0.16);
    for (const s of [-1, 1]) rbox('paint', 0.1, 0.5, 1.85, s * (W / 2 - 0.05), 1.4, -1.85, 0.03);
    rbox('paint', W - 0.04, 0.5, 0.1, 0, 1.4, -2.83, 0.03);
    P.box('trim', W - 0.24, 0.05, 1.8, 0, 1.2, -1.85);
    // glass: windshield (raked), rear window, side windows
    rbox('glass', W - 0.3, 0.62, 0.06, 0, 1.68, 1.47, 0.03, -0.5);
    rbox('glass', W - 0.4, 0.42, 0.05, 0, 1.72, -1.07, 0.02);
    for (const s of [-1, 1]) {
      rbox('glass', 0.04, 0.44, 1.05, s * (W / 2 - 0.035), 1.73, 0.83, 0.02);
      rbox('glass', 0.04, 0.44, 0.95, s * (W / 2 - 0.035), 1.73, -0.35, 0.02);
    }
    // trim: grille, bumpers, fender flares, mirrors, running boards
    P.box('trim', W - 0.36, 0.42, 0.08, 0, 1.0, 2.9);
    rbox('trim', W + 0.06, 0.24, 0.22, 0, 0.55, 2.85, 0.06);
    rbox('trim', W + 0.06, 0.22, 0.2, 0, 0.55, -2.86, 0.06);
    for (const [x, z] of [[1, 1.85], [-1, 1.85], [1, -1.85], [-1, -1.85]]) rbox('trim', 0.12, 0.38, 1.12, x * (W / 2 + 0.02), 0.98, z, 0.05);
    for (const s of [-1, 1]) {
      rbox('trim', 0.12, 0.22, 0.3, s * (W / 2 + 0.12), 1.62, 1.25, 0.04);
      P.box('trim', 0.18, 0.06, 2.4, s * (W / 2 + 0.03), 0.48, 0.2);
    }
    // wheels: tyre and rim
    for (const [x, z] of [[1, 1.85], [-1, 1.85], [1, -1.85], [-1, -1.85]]) {
      const t = new THREE.CylinderGeometry(0.41, 0.41, 0.3, 20).rotateZ(Math.PI / 2).translate(x * 0.86, 0.41, z);
      P.add('tyre', t);
      const r = new THREE.CylinderGeometry(0.25, 0.25, 0.31, 14).rotateZ(Math.PI / 2).translate(x * 0.86, 0.41, z);
      P.add('rim', r);
    }
    // lamps
    for (const s of [-1, 1]) {
      P.box('head', 0.38, 0.14, 0.05, s * 0.68, 1.12, 2.92);
      P.box('tail', 0.07, 0.36, 0.12, s * (W / 2 - 0.02), 1.32, -2.86);
    }
    // the beacon bar on the cab roof: a black base and the amber lens
    P.box('trim', 1.25, 0.06, 0.3, 0, 2.08, 0.7);
    rbox('beacon', 1.18, 0.09, 0.24, 0, 2.15, 0.7, 0.035);

    const std = (name, o) => patchMaterial(new THREE.MeshStandardMaterial({ name, envMapIntensity: 1.0, ...o }), { key: 'std' });
    this.materials = {
      paint: std('truck-paint', { color: 0x26292c, roughness: 0.32, metalness: 0.55 }),
      trim: std('truck-trim', { color: 0x111214, roughness: 0.75, metalness: 0.1 }),
      glass: std('truck-glass', { color: 0x07090b, roughness: 0.06, metalness: 0.8 }),
      tyre: std('truck-tyre', { color: 0x0e0e0f, roughness: 0.92 }),
      rim: std('truck-rim', { color: 0x1c1d1f, roughness: 0.4, metalness: 0.7 }),
      head: std('truck-head', { color: 0xdedede, emissive: 0xfff1d6, emissiveIntensity: 0, roughness: 0.2 }),
      tail: std('truck-tail', { color: 0x3a0806, emissive: 0xff2410, emissiveIntensity: 0.6, roughness: 0.3 }),
      beacon: std('truck-beacon', { color: 0x4a2a05, emissive: 0xff8a12, emissiveIntensity: 9, roughness: 0.3 }),
    };
    this.group = new THREE.Group();
    this.group.name = 'table:truck';
    P.build(this.group, this.materials, { shadows: Q.shadows, name: 'truck', thermal: { paint: 'truckBody', trim: 'truckBody', glass: 'glass', tyre: 'tyre', rim: 'tyre', head: 'lamp', tail: 'lamp', beacon: 'lamp' } });
    // the hot engine under the hood, for wave 2's thermal view
    const hood = this.group.children.find((c) => c.material === this.materials.paint);
    if (hood) hood.userData.thermal = 'truckBody';

    // park it: at ZONE.truckStart, on the pull-out, facing ZONE heading (atan2(dz, dx))
    const t = ZONE.truckStart, pad = PADS.find((p) => p.name === 'pullout');
    const dx = Math.cos(t.heading), dz = Math.sin(t.heading);
    this.group.position.set(t.x, pad ? pad.y : 0, t.z);
    this.group.rotation.y = Math.atan2(dx, dz);
    // the beacon's glow: one point sprite with a minimum on-screen size, so the amber point never drops
    // between pixel centres at table scale (the lens itself is ~1 px there); HDR, so it blooms
    this.glowU = { uCol: { value: new THREE.Color(1.0, 0.36, 0.05).multiplyScalar(5) }, uLevel: { value: 1 }, uMinPx: { value: 3.2 }, uSize: { value: 0.9 }, uScale: { value: 800 } };
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute([0, 2.2, 0.7], 3));
    this.glow = new THREE.Points(gg, new THREE.ShaderMaterial({
      uniforms: this.glowU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        uniform float uMinPx; uniform float uSize; uniform float uScale;
        void main() {
          vec4 mv = modelViewMatrix * vec4( position, 1.0 );
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max( uMinPx, uScale * uSize / -mv.z );
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uCol; uniform float uLevel;
        void main() {
          float r = length( gl_PointCoord - 0.5 ) * 2.0;
          float a = exp( -r * r * 4.5 ) * ( 1.0 - smoothstep( 0.85, 1.0, r ) );
          gl_FragColor = vec4( uCol * a * uLevel, 1.0 );
        }`,
    }));
    this.glow.name = 'table:beacon-glow';
    this.glow.frustumCulled = false;
    this.glow.layers.set(1);
    this.group.add(this.glow);
    this.group.updateMatrixWorld(true);
    /** The bed floor's centre (world), where wave 2's drone sits and lifts off. */
    this.bedTop = new THREE.Vector3(0, 1.23, -1.85).applyMatrix4(this.group.matrixWorld);
  }

  /** Beacon level 0..1 (multiplies its HDR glow) and the headlights (0 off .. 1 on). */
  setLights({ beacon = 1, head = 0 } = {}) {
    this.materials.beacon.emissiveIntensity = 9 * beacon;
    this.materials.head.emissiveIntensity = 6 * head;
    this.glowU.uLevel.value = beacon;
  }

  /** Pixel scale for the glow's size (call on resize: drawing-buffer height / (2·tan(fov/2))). */
  setPixelScale(s) { this.glowU.uScale.value = s; }

  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of Object.values(this.materials)) m.dispose();
  }
}
