// Command Table: the thermal view. A temperature field (°C, SAMPLE), not a colour filter:
//   - every slab mesh carries userData.thermal (what it is); for the thermal pass its material is swapped
//     for a field material of that kind, which writes R = temperature, G = horizontal distance to the
//     mask centre, A = 1 into a half-float target (half resolution on lite/balanced)
//   - the field: slopes that faced the low westerly sun all afternoon hold heat, shaded slopes and the
//     canopy are cool, water is cold, gravel, asphalt and concrete are warm, transformers and the truck's
//     engine bay are hot; a Gaussian hotspot peaks at ZONE.hotspot.peakC with a warm halo
//   - the cut faces, plinth and table stay physical: they write depth only (A = 0), so the composite
//     shows the visible frame there
//   - the composite maps the field through IRONBOW (zone.js) with 640 × 512 sensor softness and a little
//     noise, inside a screen circle (the hero lens; the DOM draws the ring) or a world radius around a
//     centre (step 3: the ground under the scan cone, then the whole table)
//   - after each thermal render a small max-filtered copy is read back once, so the lens readout (maxC)
//     comes from the field under the lens, with no GPU stall per pointer move
import * as THREE from 'three';
import { ZONE, IRONBOW } from './zone.js';
import { SLAB } from './layout.js';
import { MASK } from './terrain.js';
import { SHARED, TABLE_GLSL } from './shading.js';

export const KINDS = { ground: 0, forest: 1, water: 2, concrete: 3, asphalt: 4, steel: 5, transformer: 6, truckBody: 7, roof: 8, glass: 9, wire: 10, fence: 10, lamp: 11, tyre: 12, insulator: 5, breaker: 6, bus: 5, building: 8, footing: 3 };
const PHYSICAL = new Set(['strata', 'plinth', 'table']);

const FIELD_VS = /* glsl */`
attribute float aForest; attribute float aWet;
varying vec3 vWp; varying vec3 vWn; varying float vF; varying float vW;
void main() {
  vec3 p = position; vec3 n = normal + vec3( 0.0, 1e-4, 0.0 );
  #ifdef USE_INSTANCING
    p = ( instanceMatrix * vec4( p, 1.0 ) ).xyz;
    n = mat3( instanceMatrix ) * n;
  #endif
  vec4 wp = modelMatrix * vec4( p, 1.0 );
  vWp = wp.xyz; vWn = normalize( mat3( modelMatrix ) * n );
  vF = aForest; vW = aWet;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FIELD_FS = /* glsl */`
${TABLE_GLSL.FRAG_PARS.replace('varying vec3 vTWp;', '')}
uniform float uKind; uniform vec4 uHot; uniform vec3 uEngine; uniform vec2 uMaskC; uniform float uResid; uniform float uPhysical;
uniform sampler2D uMask; uniform vec4 uMaskBox; uniform sampler2D uNoise;
varying vec3 vWp; varying vec3 vWn; varying float vF; varying float vW;
void main() {
  if ( uPhysical > 0.5 ) { gl_FragColor = vec4( 0.0 ); return; }
  vec3 n = normalize( vWn );
  float vis = tableSunVis( vWp );
  float ndl = max( dot( n, uSunDirW ), 0.0 ) * vis;
  vec2 sh = normalize( uSunDirW.xz );
  float asp = clamp( dot( n.xz, sh ) * 1.7, -1.0, 1.0 );   // facing the afternoon sun (n.xz grows with the slope)
  float nz = texture2D( uNoise, vWp.xz / 41.0 ).g - 0.5;
  float nf = texture2D( uNoise, vWp.xz / 7.0 ).b - 0.5;
  int k = int( uKind + 0.5 );
  float T = 17.0;
  if ( k == 0 ) {
    vec4 mk = texture2D( uMask, ( vWp.xz - uMaskBox.xy ) * uMaskBox.zw );
    float slope = 1.0 - clamp( n.y, 0.0, 1.0 );
    T = 15.0 + 12.0 * max( asp, 0.0 ) * uResid - 4.0 * max( -asp, 0.0 ) + 5.0 * ndl;
    T -= 6.0 * smoothstep( 0.15, 0.7, vF );
    T -= 6.0 * clamp( vW + mk.b, 0.0, 1.0 );
    T += 7.0 * smoothstep( 0.2, 0.6, mk.r ) * uResid;
    T += 6.0 * smoothstep( 0.4, 0.6, slope ) * max( asp, 0.0 ) * uResid;
    T += nz * 3.0 + nf * 1.2;
  } else if ( k == 1 ) {
    T = 12.5 + 4.5 * max( asp, 0.0 ) * uResid + 2.5 * ndl + nz * 2.4 + nf;
  } else if ( k == 2 ) {
    T = 10.5 + nz * 0.8;
  } else if ( k == 3 ) {
    T = 18.0 + 10.0 * max( asp, 0.0 ) * uResid + 5.0 * ndl + nz;
  } else if ( k == 4 ) {
    T = 24.0 + 9.0 * uResid + nz;
  } else if ( k == 5 ) {
    T = 15.5 + 5.0 * ndl;
  } else if ( k == 6 ) {
    T = 63.0 + nz * 5.0;
  } else if ( k == 7 ) {
    float d = distance( vWp, uEngine );
    T = 22.0 + 60.0 * exp( -d * d / 1.8 );
  } else if ( k == 8 ) {
    T = 21.0 + 7.0 * uResid + nz;
  } else if ( k == 9 ) {
    T = 8.5;
  } else if ( k == 10 ) {
    T = 17.5;
  } else if ( k == 11 ) {
    T = 44.0;
  } else if ( k == 12 ) {
    T = 30.0;
  }
  // the hotspot: a smouldering core, heated ground and canopy round it (uHot: x, z, peak, gain)
  float dh = distance( vWp.xz, uHot.xy );
  float core = uHot.z * exp( -pow( dh / 21.0, 6.0 ) );    // flat-topped: the smouldering stump and the crowns heated over it
  float halo = 62.0 * exp( -dh * dh / 500.0 ) + 15.0 * exp( -dh * dh / 4400.0 );
  T = max( T + halo * uHot.w, core * uHot.w );
  gl_FragColor = vec4( T, distance( vWp.xz, uMaskC ), 0.0, 1.0 );
}`;

const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const ramp = IRONBOW.map((h) => new THREE.Color(h));   // sRGB values as given (display space)
const RAMP_GLSL = /* glsl */`
vec3 ironbow( float t ) {
  t = clamp( t, 0.0, 1.0 ) * 6.0;
  ${ramp.map((c, i) => `vec3 c${i} = vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)});`).join(' ')}
  return t < 1.0 ? mix( c0, c1, t ) : t < 2.0 ? mix( c1, c2, t - 1.0 ) : t < 3.0 ? mix( c2, c3, t - 2.0 ) : t < 4.0 ? mix( c3, c4, t - 3.0 ) : t < 5.0 ? mix( c4, c5, t - 4.0 ) : mix( c5, c6, t - 5.0 );
}`;
// (THREE.Color from a hex string converts to linear; take the hex values back as display-space numbers)
const RAMP_SRGB = /* glsl */`
vec3 ironbow( float t ) {
  t = clamp( t, 0.0, 1.0 ) * 6.0;
  ${IRONBOW.map((h, i) => { const v = parseInt(h.slice(1), 16); return `vec3 c${i} = vec3(${((v >> 16) & 255) / 255}, ${((v >> 8) & 255) / 255}, ${(v & 255) / 255});`; }).join(' ')}
  return t < 1.0 ? mix( c0, c1, t ) : t < 2.0 ? mix( c1, c2, t - 1.0 ) : t < 3.0 ? mix( c2, c3, t - 2.0 ) : t < 4.0 ? mix( c3, c4, t - 3.0 ) : t < 5.0 ? mix( c4, c5, t - 4.0 ) : mix( c5, c6, t - 5.0 );
}`;
void RAMP_GLSL;

const COMP_FS = /* glsl */`
uniform sampler2D tT; uniform vec2 uTex; uniform vec2 uScreen; uniform vec3 uLens; uniform float uLensOn;
uniform vec3 uWorld; uniform float uWorldOn; uniform float uTime; uniform vec2 uRange; uniform float uAlpha; uniform float uGlow;
varying vec2 vUv;
${RAMP_SRGB}
float hash( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
void main() {
  vec4 s = texture2D( tT, vUv );
  if ( s.a < 0.5 ) discard;
  vec2 px = vUv * uScreen;
  float dl = length( px - uLens.xy * uScreen );
  float mL = uLensOn * ( 1.0 - smoothstep( uLens.z - 1.0, uLens.z + 0.6, dl ) );
  float mW = uWorldOn * ( 1.0 - smoothstep( uWorld.x - uWorld.y, uWorld.x, s.g ) );
  float m = max( mL, mW ) * uAlpha;
  if ( m < 0.003 ) discard;
  // 640 × 512 sensor softness: a small tent over the field (valid taps only)
  vec2 st = 1.6 / uTex;
  float T = s.r, w = 1.0;
  for ( int i = 0; i < 4; i++ ) {
    vec2 o = vec2( i == 0 ? 1.0 : i == 1 ? -1.0 : 0.0, i == 2 ? 1.0 : i == 3 ? -1.0 : 0.0 ) * st;
    vec4 q = texture2D( tT, vUv + o );
    if ( q.a > 0.5 ) { T += q.r * 0.6; w += 0.6; }
  }
  T /= w;
  vec2 cell = floor( vUv * vec2( 640.0, 512.0 ) );
  T += ( hash( cell + fract( uTime * 7.3 ) * 97.0 ) - 0.5 ) * 0.9;
  float t = ( T - uRange.x ) / ( uRange.y - uRange.x );
  vec3 c = ironbow( pow( clamp( t, 0.0, 1.0 ), 0.9 ) );
  // the hottest source blooms a little (the sensor's own flare round a fire): a soft halo from the
  // field's hot texels around this one
  float g = 0.0;
  for ( int i = 0; i < 8; i++ ) {
    float a = float( i ) * 0.7854;
    vec2 d8 = vec2( cos( a ), sin( a ) );
    vec4 q1 = texture2D( tT, vUv + d8 * 5.0 / uTex );
    vec4 q2 = texture2D( tT, vUv + d8 * 11.0 / uTex );
    if ( q1.a > 0.5 ) g += smoothstep( 110.0, 300.0, q1.r );
    if ( q2.a > 0.5 ) g += 0.5 * smoothstep( 110.0, 300.0, q2.r );
  }
  c += vec3( 1.0, 0.82, 0.55 ) * ( g / 12.0 ) * 0.55 * uGlow;
  gl_FragColor = vec4( min( c, vec3( 1.0 ) ), m );
}`;

// max-filter downsample for the readback (a cell is the max of the valid texels under it)
const MAX_FS = /* glsl */`
uniform sampler2D tT; uniform vec2 uTex; uniform float uK;
varying vec2 vUv;
void main() {
  float m = -999.0;
  vec2 base = vUv - 0.5 * uK / uTex;
  for ( int y = 0; y < 4; y++ ) for ( int x = 0; x < 4; x++ ) {
    vec4 q = texture2D( tT, base + ( vec2( float( x ), float( y ) ) + 0.5 ) * ( uK / 4.0 ) / uTex );
    if ( q.a > 0.5 ) m = max( m, q.r );
  }
  gl_FragColor = vec4( m, 0.0, 0.0, 1.0 );
}`;

const FINISH_FS = /* glsl */`
uniform sampler2D tSrc; uniform float uExp; varying vec2 vUv;
vec3 fit( vec3 v ) { vec3 a = v * ( v + 0.0245786 ) - 0.000090537; vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081; return a / b; }
void main() {
  vec3 c = texture2D( tSrc, vUv ).rgb * uExp / 0.6;
  const mat3 IN = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
  const mat3 OUT = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
  c = clamp( OUT * fit( IN * c ), 0.0, 1.0 );
  c = mix( pow( c, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), c * 12.92, vec3( lessThanEqual( c, vec3( 0.0031308 ) ) ) );
  gl_FragColor = vec4( c, 1.0 );
}`;

/** Read an 8-bit render target into a new 2D canvas (rows flipped to top-down). */
function readCanvas(r, rt, W, H) {
  const px = new Uint8Array(W * H * 4);
  r.readRenderTargetPixels(rt, 0, 0, W, H, px);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
  g.putImageData(img, 0, 0);
  return c;
}

export class Thermal {
  constructor(renderer, world, Q) {
    this.renderer = renderer; this.world = world; this.Q = Q;
    this.scale = Q.tier === 'high' ? 1 : 0.5;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.rt.texture.generateMipmaps = false;
    this.small = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.engine = new THREE.Vector3();
    this.fieldU = {
      ...SHARED,
      uHot: { value: new THREE.Vector4(ZONE.hotspot.x, ZONE.hotspot.z, ZONE.hotspot.peakC, 1) },
      uEngine: { value: this.engine }, uMaskC: { value: new THREE.Vector2(ZONE.hotspot.x, ZONE.hotspot.z) }, uResid: { value: 1 },
      uMask: { value: MASK.tex }, uMaskBox: { value: new THREE.Vector4(SLAB.x0, SLAB.z0, 1 / SLAB.w, 1 / SLAB.d) }, uNoise: { value: world.noise },
    };
    this.mats = new Map();
    const mk = (kind, physical = 0) => {
      const m = new THREE.ShaderMaterial({ uniforms: { ...this.fieldU, uKind: { value: kind }, uPhysical: { value: physical } }, vertexShader: FIELD_VS, fragmentShader: FIELD_FS, name: 'table-thermal' });
      return m;
    };
    for (const [name, k] of Object.entries(KINDS)) this.mats.set(name, mk(k));
    this.physMat = mk(0, 1);
    this.lineMat = mk(KINDS.wire);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.compU = {
      tT: { value: this.rt.texture }, uTex: { value: new THREE.Vector2(1, 1) }, uScreen: { value: new THREE.Vector2(1, 1) },
      uLens: { value: new THREE.Vector3(0.5, 0.5, 100) }, uLensOn: { value: 0 }, uWorld: { value: new THREE.Vector3(0, 60, 0) }, uWorldOn: { value: 0 },
      uTime: { value: 0 }, uRange: { value: new THREE.Vector2(6, 72) }, uAlpha: { value: 1 }, uGlow: { value: 1 },
    };
    this.comp = new THREE.ShaderMaterial({ uniforms: this.compU, vertexShader: QUAD_VS, fragmentShader: COMP_FS, transparent: true, depthTest: false, depthWrite: false, name: 'table-thermal-comp' });
    this.maxU = { tT: { value: this.rt.texture }, uTex: { value: new THREE.Vector2(1, 1) }, uK: { value: 4 } };
    this.maxMat = new THREE.ShaderMaterial({ uniforms: this.maxU, vertexShader: QUAD_VS, fragmentShader: MAX_FS, depthTest: false, depthWrite: false });
    this.grid = null; this.gridW = 0; this.gridH = 0;
    this.swapped = [];
    this.dirty = true;
  }

  setSize(bufW, bufH) {
    const w = Math.max(2, Math.round(bufW * this.scale)), h = Math.max(2, Math.round(bufH * this.scale));
    if (this.rt.width !== w || this.rt.height !== h) { this.rt.setSize(w, h); this.dirty = true; }
    this.compU.uTex.value.set(w, h);
    this.maxU.uTex.value.set(w, h);
    const sw = Math.max(1, Math.ceil(w / 4)), sh = Math.max(1, Math.ceil(h / 4));
    if (this.small.width !== sw || this.small.height !== sh) this.small.setSize(sw, sh);
  }

  /** Swap every slab mesh to its field material (physical ones to depth-only), run fn, swap back. */
  withFieldMaterials(scene, fn) {
    const sw = this.swapped; sw.length = 0;
    scene.traverse((o) => {
      if (!o.visible) return;
      if (!(o.isMesh || o.isLineSegments || o.isLine)) return;
      if (!o.layers.isEnabled(0)) return;
      const kind = o.userData.thermal;
      let m;
      if (o.isLineSegments || o.isLine) m = this.lineMat;
      else if (!kind || PHYSICAL.has(kind)) m = this.physMat;
      else m = this.mats.get(kind) || this.mats.get('steel');
      sw.push(o, o.material);
      o.material = m;
    });
    try { fn(); } finally { for (let i = 0; i < sw.length; i += 2) sw[i].material = sw[i + 1]; sw.length = 0; }
  }

  /** Render the field for this camera (layer 0 only) and read back the max grid. */
  render(scene, camera, { resid = 1, hotGain = 1, maskC = null, truckEngine = null, readback = true, target = null } = {}) {
    const r = this.renderer;
    this.fieldU.uResid.value = resid;
    this.fieldU.uHot.value.w = hotGain;
    if (maskC) this.fieldU.uMaskC.value.set(maskC.x, maskC.z !== undefined ? maskC.z : maskC.y);
    if (truckEngine) this.engine.copy(truckEngine);
    const prevRT = r.getRenderTarget(), prevClear = r.getClearColor(new THREE.Color()), prevA = r.getClearAlpha();
    const mask = camera.layers.mask;
    camera.layers.set(0);
    const bg = scene.background; scene.background = null;
    r.setRenderTarget(target || this.rt);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, false);
    this.withFieldMaterials(scene, () => r.render(scene, camera));
    scene.background = bg;
    camera.layers.mask = mask;
    if (target || !readback) { r.setRenderTarget(prevRT); r.setClearColor(prevClear, prevA); if (!target) this.dirty = false; return; }
    // max-filtered readback for the lens readout
    this.quad.material = this.maxMat;
    r.setRenderTarget(this.small);
    r.render(this.quad, this.cam);
    const n = this.small.width * this.small.height;
    if (!this.half || this.half.length !== n * 4) this.half = new Uint16Array(n * 4);
    r.readRenderTargetPixels(this.small, 0, 0, this.small.width, this.small.height, this.half);
    if (!this.grid || this.grid.length !== n) this.grid = new Float32Array(n);
    for (let i = 0; i < n; i++) this.grid[i] = THREE.DataUtils.fromHalfFloat(this.half[i * 4]);
    this.gridW = this.small.width; this.gridH = this.small.height;
    r.setRenderTarget(prevRT);
    r.setClearColor(prevClear, prevA);
    this.dirty = false;
  }

  /** The field's maximum inside a screen circle (centre 0..1 of the frame, radius as a fraction of its width), °C. */
  maxIn(cx, cy, rFrac) {
    if (!this.grid) return null;
    const W = this.gridW, H = this.gridH, aspect = this.rt.width / this.rt.height;
    const rx = rFrac * W, ry = rFrac * W;   // the grid keeps the frame's aspect: a circle is round in cells
    void aspect;
    const gx = cx * W, gy = (1 - cy) * H;   // readback rows run bottom to top
    let m = -Infinity;
    for (let y = Math.max(0, Math.floor(gy - ry)); y <= Math.min(H - 1, Math.ceil(gy + ry)); y++) {
      for (let x = Math.max(0, Math.floor(gx - rx)); x <= Math.min(W - 1, Math.ceil(gx + rx)); x++) {
        const dx = (x + 0.5 - gx) / rx, dy = (y + 0.5 - gy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        const v = this.grid[y * W + x];
        if (v > m) m = v;
      }
    }
    return m > -900 ? m : null;
  }

  /** Composite the field onto the current frame (the canvas): lens circle and/or world radius. */
  composite({ lens = null, world = null, time = 0, alpha = 1, w = 1, h = 1 } = {}) {
    const u = this.compU, r = this.renderer;
    u.uScreen.value.set(w, h);
    u.uLensOn.value = lens ? 1 : 0;
    if (lens) u.uLens.value.set(lens.x, 1 - lens.y, lens.r * w);
    u.uWorldOn.value = world ? 1 : 0;
    if (world) u.uWorld.value.set(world.radius, world.feather || 30, 0);
    u.uTime.value = time; u.uAlpha.value = alpha;
    // the hero lens reads a dusk scene at rest: a narrower span (the camera's auto gain on a smaller view)
    // so the sun-warmed slopes, road and dam show as magenta to red over the cold forest and river
    if (lens && !world) u.uRange.value.set(6, 56); else u.uRange.value.set(6, 72);
    this.quad.material = this.comp;
    const ac = r.autoClear; r.autoClear = false;
    r.setRenderTarget(null);
    r.render(this.quad, this.cam);
    r.autoClear = ac;
  }

  /** A small thermal image (ironbow) of the scene from a camera, as a 2D canvas (the report thumbnail). */
  thumb(scene, cam, W, H) {
    const r = this.renderer;
    const src = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    const dst = new THREE.WebGLRenderTarget(W, H);
    this.render(scene, cam, { target: src, maskC: { x: 0, z: 0 } });
    const u = this.compU, keep = { t: u.tT.value, tex: u.uTex.value.clone(), scr: u.uScreen.value.clone() };
    u.tT.value = src.texture; u.uTex.value.set(W, H); u.uScreen.value.set(W, H);
    u.uLensOn.value = 0; u.uWorldOn.value = 1; u.uWorld.value.set(1e5, 10, 0); u.uAlpha.value = 1; u.uTime.value = 0; u.uRange.value.set(6, 72);
    const prev = r.getRenderTarget();
    r.setRenderTarget(dst); r.setClearColor(0x0f0e0d, 1); r.clear();
    this.quad.material = this.comp; r.render(this.quad, this.cam);
    const c = readCanvas(r, dst, W, H);
    u.tT.value = keep.t; u.uTex.value.copy(keep.tex); u.uScreen.value.copy(keep.scr);
    r.setRenderTarget(prev);
    src.dispose(); dst.dispose();
    return c;
  }

  /** A small visible image (tone-mapped) of the scene from a camera, as a 2D canvas. */
  thumbVisible(scene, cam, W, H, exposure = 1.4) {
    const r = this.renderer;
    const src = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    const dst = new THREE.WebGLRenderTarget(W, H);
    const prev = r.getRenderTarget();
    const mask = cam.layers.mask; cam.layers.set(0);
    r.setRenderTarget(src); r.clear(); r.render(scene, cam);
    cam.layers.mask = mask;
    if (!this.finish) this.finish = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uExp: { value: 1 } }, vertexShader: QUAD_VS, fragmentShader: FINISH_FS, depthTest: false, depthWrite: false });
    this.finish.uniforms.tSrc.value = src.texture; this.finish.uniforms.uExp.value = exposure;
    r.setRenderTarget(dst); this.quad.material = this.finish; r.render(this.quad, this.cam);
    const c = readCanvas(r, dst, W, H);
    r.setRenderTarget(prev);
    src.dispose(); dst.dispose();
    return c;
  }

  dispose() {
    this.finish?.dispose();
    this.rt.dispose(); this.small.dispose();
    for (const m of this.mats.values()) m.dispose();
    this.physMat.dispose(); this.lineMat.dispose(); this.comp.dispose(); this.maxMat.dispose(); this.quad.geometry.dispose();
  }
}
