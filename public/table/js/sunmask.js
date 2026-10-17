// Command Table: the terrain's cast shadows, baked once on the GPU. For each point of a box that
// covers the slab and the table where its shadow falls, march toward the sun over the height grid and
// keep S = max over t of (h(p + dir·t) − t·tan(elevation)): anything at that (x, z) lower than S is in
// shadow. One full-screen pass into a small half-float target (R: S, G: distance to the occluder, for
// the penumbra). shading.js reads it in every slab material, so the ridges shade the valley, the
// trees and the props on every tier, with no shadow map. Rebake only if the sun moves.
import * as THREE from 'three';
import { SLAB } from './layout.js';
import { TERRAIN } from './terrain.js';
import { SHARED } from './shading.js';

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FS = /* glsl */`
precision highp float;
uniform sampler2D tH; uniform vec2 uGrid; uniform vec4 uSlab; uniform vec4 uBox; uniform vec3 uL; uniform float uTable;
varying vec2 vUv;
float H( vec2 p ) {
  // manual bilinear on the vertex grid (float texture, nearest filtering: no extension needed)
  vec2 g = ( p - uSlab.xy ) / ( uSlab.zw - uSlab.xy ) * uGrid;
  g = clamp( g, vec2( 0.0 ), uGrid - 0.001 );
  vec2 i = floor( g ), f = g - i;
  vec2 ts = 1.0 / ( uGrid + 1.0 );
  vec2 c = ( i + 0.5 ) * ts;
  float a = texture2D( tH, c ).r, b = texture2D( tH, c + vec2( ts.x, 0.0 ) ).r;
  float d = texture2D( tH, c + vec2( 0.0, ts.y ) ).r, e = texture2D( tH, c + ts ).r;
  return mix( mix( a, b, f.x ), mix( d, e, f.x ), f.y );
}
bool inSlab( vec2 p ) { return p.x >= uSlab.x && p.y >= uSlab.y && p.x <= uSlab.z && p.y <= uSlab.w; }
void main() {
  vec2 p = uBox.xy + vUv * uBox.zw;
  vec2 dir = normalize( uL.xz );
  float tanE = uL.y / length( uL.xz );
  float best = uTable - 1.0, bestT = 0.0;
  float t = 1.5;
  bool entered = false;
  for ( int k = 0; k < 220; k++ ) {
    vec2 q = p + dir * t;
    if ( inSlab( q ) ) {
      entered = true;
      float s = H( q ) - t * tanE;
      if ( s > best ) { best = s; bestT = t; }
    } else if ( entered ) break;           // a rectangle: once the ray leaves it, it never comes back
    // the slab's cut faces occlude too: a ray that enters through a wall meets the base-to-top face there
    t += 1.6 + t * 0.012;
    if ( t * tanE > 420.0 ) break;
  }
  gl_FragColor = vec4( best, bestT, 0.0, 1.0 );
}`;

export class SunMask {
  constructor(renderer, { res = 1024 } = {}) {
    this.renderer = renderer;
    this.res = res;
    const { nx, nz, heights } = TERRAIN;
    this.hTex = new THREE.DataTexture(new Float32Array(heights), nx + 1, nz + 1, THREE.RedFormat, THREE.FloatType);
    this.hTex.magFilter = this.hTex.minFilter = THREE.NearestFilter;
    this.hTex.needsUpdate = true;
    this.rt = new THREE.WebGLRenderTarget(res, res, { type: THREE.HalfFloatType, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter });
    this.rt.texture.generateMipmaps = false;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, depthTest: false, depthWrite: false,
      uniforms: {
        tH: { value: this.hTex }, uGrid: { value: new THREE.Vector2(nx, nz) },
        uSlab: { value: new THREE.Vector4(SLAB.x0, SLAB.z0, SLAB.x1, SLAB.z1) },
        uBox: { value: new THREE.Vector4() }, uL: { value: new THREE.Vector3(0, 1, 0) }, uTable: { value: SLAB.table },
      },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /** Bake for a sun direction (unit vector toward the sun). */
  bake(sunDir) {
    const L = sunDir.clone().normalize();
    const hl = Math.hypot(L.x, L.z), tanE = L.y / Math.max(hl, 1e-4);
    // the box: the slab, stretched away from the sun by the longest shadow (to the table, off the highest ridge)
    let hi = -Infinity; for (const v of TERRAIN.heights) hi = Math.max(hi, v);
    const len = Math.min(1800, (hi - SLAB.table) / Math.max(tanE, 0.05));
    const dx = -L.x / hl * len, dz = -L.z / hl * len;
    const x0 = Math.min(SLAB.x0, SLAB.x0 + dx) - 20, x1 = Math.max(SLAB.x1, SLAB.x1 + dx) + 20;
    const z0 = Math.min(SLAB.z0, SLAB.z0 + dz) - 20, z1 = Math.max(SLAB.z1, SLAB.z1 + dz) + 20;
    const u = this.mat.uniforms;
    u.uBox.value.set(x0, z0, x1 - x0, z1 - z0);
    u.uL.value.copy(L);
    const r = this.renderer, prev = r.getRenderTarget();
    r.setRenderTarget(this.rt);
    r.render(this.quad, this.cam);
    r.setRenderTarget(prev);
    this.box = [x0, z0, 1 / (x1 - x0), 1 / (z1 - z0)];
    this.dir = L;
    this.bind();
  }

  /** Point the shared uniforms at this instance's mask (two tables can be mounted at once). */
  bind() {
    if (!this.box) return;
    SHARED.uSunS.value = this.rt.texture;
    SHARED.uSunBox.value.set(...this.box);
    SHARED.uSunOn.value = 1;
    SHARED.uSunDirW.value.copy(this.dir);
  }

  dispose() {
    this.rt.dispose(); this.hTex.dispose(); this.mat.dispose(); this.quad.geometry.dispose();
    SHARED.uSunOn.value = 0; SHARED.uSunS.value = null;
  }
}
