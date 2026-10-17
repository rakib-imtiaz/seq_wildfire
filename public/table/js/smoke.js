// Command Table: the hotspot's smoke. A thin, soft plume: a few dozen camera-facing puffs along a path
// that rises from the hotspot and leans away downwind (north-east, the way the sample perimeters grow),
// widening and thinning as it goes. Each puff's shape is shader noise (two scrolling octaves of the shared
// noise texture through a soft round falloff); puffs cycle up the path on the clock, frozen under ?frame=.
// Lit by the dusk key from one side, never bright, never a flame. Optional upgrade: smoke sprites listed in
// /table/assets.json (converted from media/incoming/fx-smoke-*.png) replace the noise.
import * as THREE from 'three';
import { ZONE } from './zone.js';
import { groundAt } from './terrain.js';

const VS = /* glsl */`
attribute vec3 aCentre; attribute vec4 aPuff;        // aPuff: t0 (0..1 along the plume), seed, spin, size scale
uniform float uTime; uniform vec3 uOrigin; uniform vec3 uWind; uniform float uRise; uniform float uDrift;
varying vec2 vUv; varying float vT; varying float vSeed; varying float vLight;
uniform vec3 uSunDirW;
void main() {
  float t = fract( aPuff.x + uTime * 0.018 );
  // the path: up, then leaning downwind (quadratic), a little sway
  vec3 c = uOrigin + vec3( 0.0, uRise * t, 0.0 ) + uWind * ( uDrift * t * t );
  c.x += sin( t * 7.0 + aPuff.y * 6.28 ) * 6.0 * t; c.z += cos( t * 5.0 + aPuff.y * 3.1 ) * 6.0 * t;
  float size = mix( 9.0, 75.0, pow( t, 0.8 ) ) * aPuff.w;
  vec4 mv = modelViewMatrix * vec4( c, 1.0 );
  float a = aPuff.z * uTime * 0.05 + aPuff.y * 6.28;
  vec2 q = mat2( cos( a ), sin( a ), -sin( a ), cos( a ) ) * position.xy;
  mv.xy += q * size;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy + 0.5; vT = t; vSeed = aPuff.y;
  vLight = 0.55 + 0.45 * max( dot( normalize( uSunDirW ), normalize( vec3( position.x, 0.6, position.y ) ) ), 0.0 );
}`;

const FS = /* glsl */`
uniform sampler2D uNoise; uniform sampler2D uSprite; uniform float uUseSprite; uniform float uAmount; uniform float uTime;
uniform vec3 uCol; uniform vec3 uWarm;
varying vec2 vUv; varying float vT; varying float vSeed; varying float vLight;
void main() {
  vec2 p = vUv - 0.5;
  float r = length( p ) * 2.0;
  float d;
  if ( uUseSprite > 0.5 ) {
    d = texture2D( uSprite, vUv ).r;
  } else {
    float n1 = texture2D( uNoise, vUv * 0.55 + vec2( vSeed * 3.7, uTime * 0.01 + vSeed ) ).g;
    float n2 = texture2D( uNoise, vUv * 1.3 + vec2( -uTime * 0.017, vSeed * 1.9 ) ).b;
    d = smoothstep( 0.32, 0.85, n1 * 0.7 + n2 * 0.45 ) * ( 1.0 - smoothstep( 0.25, 1.0, r ) );
  }
  // born thin, densest low, fading out high; never opaque
  float life = smoothstep( 0.0, 0.08, vT ) * ( 1.0 - smoothstep( 0.45, 1.0, vT ) );
  float a = d * life * uAmount * 0.32;
  if ( a < 0.004 ) discard;
  vec3 c = mix( uWarm, uCol, smoothstep( 0.0, 0.25, vT ) ) * vLight;
  gl_FragColor = vec4( c, a );
}`;

export class Smoke {
  constructor(noiseTex, { count = 36 } = {}) {
    const h = ZONE.hotspot, g = groundAt(h.x, h.z);
    const quad = [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0];
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(quad, 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const puff = new Float32Array(count * 4), centre = new Float32Array(count * 3);
    let s = 7;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < count; i++) {
      puff[i * 4] = i / count; puff[i * 4 + 1] = r(); puff[i * 4 + 2] = (r() - 0.5) * 2; puff[i * 4 + 3] = 0.75 + r() * 0.5;
    }
    geo.setAttribute('aPuff', new THREE.InstancedBufferAttribute(puff, 4));
    geo.setAttribute('aCentre', new THREE.InstancedBufferAttribute(centre, 3));
    geo.instanceCount = count;
    const wind = new THREE.Vector3(0.72, 0, -0.69).normalize();
    this.uniforms = {
      uTime: { value: 0 }, uOrigin: { value: new THREE.Vector3(h.x, g + 4, h.z) }, uWind: { value: wind }, uRise: { value: 170 }, uDrift: { value: 230 },
      uNoise: { value: noiseTex }, uSprite: { value: null }, uUseSprite: { value: 0 }, uAmount: { value: 0 },
      uCol: { value: new THREE.Color(0.32, 0.31, 0.3) }, uWarm: { value: new THREE.Color(0.55, 0.36, 0.22) }, uSunDirW: { value: new THREE.Vector3(-0.9, 0.2, 0.3) },
    };
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, name: 'table-smoke' });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 8;
    this.mesh.layers.set(1);
    this.mesh.name = 'table:smoke';
    this.mesh.visible = false;
  }

  /** Optional: smoke sprites listed in /table/assets.json replace the procedural puffs. */
  async useSprite(url) {
    try {
      const tex = await new THREE.TextureLoader().loadAsync(url);
      tex.colorSpace = THREE.NoColorSpace;
      this.uniforms.uSprite.value = tex;
      this.uniforms.uUseSprite.value = 1;
    } catch (e) { /* procedural it stays */ }
  }

  /** amount 0..1 (0 hides it), time in seconds (0 under ?frame=), the light colour scale. */
  set(amount, time, light = 1, sunDir = null) {
    this.uniforms.uAmount.value = amount;
    this.uniforms.uTime.value = time;
    this.uniforms.uCol.value.setRGB(0.3 * light, 0.29 * light, 0.285 * light);
    if (sunDir) this.uniforms.uSunDirW.value.copy(sunDir);
    this.mesh.visible = amount > 0.003;
  }

  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); this.uniforms.uSprite.value?.dispose?.(); }
}
