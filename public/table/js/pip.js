// Command Table: the picture-in-picture that follows the M3T in step 2. A camera 1.3 m behind the aircraft
// (relative to the middle of the table) and 0.6 m above it, looking ~25° down toward the table's middle, so
// the model fills the inset and everything else in frame is the valley, river and reservoir far beyond it. It is shown only once the aircraft is high enough that the
// nearest ground in frame (the bottom edge of the view) is more than 150 m away: trees and the truck are
// never framed closer than that (they are table-scale models). The inset is rendered at low resolution
// into its own HDR target and finished (ACES, sRGB, a fine frame line) into a rectangle of the canvas.
import * as THREE from 'three';

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FS = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uRes; uniform float uFade;
varying vec2 vUv;
void main() {
  vec3 c = texture2D( tSrc, vUv ).rgb;
  vec2 d = vUv - 0.5;
  c *= mix( 1.0, smoothstep( 0.85, 0.25, length( d * vec2( 1.0, 0.8 ) ) ), 0.45 );
  gl_FragColor = vec4( c * uFade, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  vec2 px = vUv * uRes;
  if ( px.x < 1.0 || px.y < 1.0 || px.x > uRes.x - 1.0 || px.y > uRes.y - 1.0 ) gl_FragColor.rgb = vec3( 0.84, 0.81, 0.77 ) * uFade;
}`;

export class Pip {
  constructor(renderer, Q) {
    this.renderer = renderer;
    this.cam = new THREE.PerspectiveCamera(26, 1.6, 0.05, 7000);
    this.cam.layers.set(0); this.cam.layers.enable(2);
    this.res = Q.tier === 'high' ? 1 : 0.75;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: Q.tier === 'high' ? 4 : 0 });
    this.mat = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: this.rt.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uFade: { value: 1 } }, vertexShader: VS, fragmentShader: FS, depthTest: false, depthWrite: false });
    this.mat.toneMapped = true;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.rect = null;   // CSS px { x, y (from top), w, h }
    this.fwd = new THREE.Vector3(); this.tmp = new THREE.Vector3();
    // a soft fill that lights the aircraft for the inset only (range 9 m: the land is untouched); it stays in the
    // scene at zero so switching it on never recompiles a shader
    this.fill = new THREE.PointLight(0xdfe6ef, 0, 9, 2);
    this.fill.name = 'table:pip-fill';
  }

  /** Add the fill light to the scene once (at zero). */
  install(scene) { if (!this.fill.parent) scene.add(this.fill); }

  /**
   * Aim the chase camera at the aircraft. Returns the distance to the ground at the bottom of the view
   * (the nearest framed ground); the caller shows the inset only when it is > 150 m.
   */
  aim(dronePos, heading, groundAt) {
    // look from behind the aircraft toward the middle of the table, ~25° down: the backdrop is the valley,
    // the river and the reservoir far beyond it, never the room past the slab's edge
    void heading;
    const f = this.fwd.set(-dronePos.x, 0, -dronePos.z);
    if (f.lengthSq() < 1) f.set(0, 0, 1);
    f.normalize();
    this.cam.position.copy(dronePos).addScaledVector(f, -1.3).add(this.tmp.set(0, 0.62, 0));
    const look = dronePos.clone().addScaledVector(f, 1.0).add(this.tmp.set(0, -0.32, 0));
    this.cam.lookAt(look);
    this.cam.updateMatrixWorld(true);
    // march the bottom-centre ray of the view to the ground
    const dir = new THREE.Vector3(0, -1, -1 / Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2))).normalize().transformDirection(this.cam.matrixWorld);
    const o = this.cam.position;
    for (let t = 2; t < 3000; t *= 1.08) {
      const x = o.x + dir.x * t, y = o.y + dir.y * t, z = o.z + dir.z * t;
      if (y <= groundAt(x, z) + 25) return t;   // + 25 m: the canopy
    }
    return 3000;
  }

  /** Render the inset into rect (CSS px within the canvas). */
  render(scene, rect, { fade = 1, exposure = 1.4 } = {}) {
    exposure *= 1.7;                                   // the inset reads a little brighter than the table
    const r = this.renderer, dpr = r.getPixelRatio();
    const W = Math.max(2, Math.round(rect.w * dpr * this.res)), H = Math.max(2, Math.round(rect.h * dpr * this.res));
    if (this.rt.width !== W || this.rt.height !== H) this.rt.setSize(W, H);
    this.cam.aspect = rect.w / rect.h; this.cam.updateProjectionMatrix();
    const prev = r.getRenderTarget();
    this.fill.position.copy(this.cam.position).add(this.tmp.set(0.4, 0.9, 0));
    this.fill.intensity = 2.2;
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(scene, this.cam);
    this.fill.intensity = 0;
    r.setRenderTarget(null);
    const size = r.getSize(new THREE.Vector2());
    const y = size.y - rect.y - rect.h;
    r.setViewport(rect.x, y, rect.w, rect.h);
    r.setScissor(rect.x, y, rect.w, rect.h);
    r.setScissorTest(true);
    this.mat.uniforms.uRes.value.set(rect.w * dpr, rect.h * dpr);
    this.mat.uniforms.uFade.value = fade;
    const ex = r.toneMappingExposure; r.toneMappingExposure = exposure;
    const ac = r.autoClear; r.autoClear = false;
    r.render(this.quad, this.ortho);
    r.autoClear = ac; r.toneMappingExposure = ex;
    r.setScissorTest(false);
    r.setViewport(0, 0, size.x, size.y);
    r.setRenderTarget(prev);
  }

  dispose() { this.rt.dispose(); this.mat.dispose(); this.quad.geometry.dispose(); }
}
