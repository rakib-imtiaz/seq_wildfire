// Command Table: screen-space lines and markers. A Ribbon keeps a constant pixel width at any distance
// and always faces the camera (a flat ribbon on the ground collapses to nothing at a grazing view), is
// drawn up to a length (uDraw, metres along the line) and may be dashed. Marks are point markers with a
// constant pixel size, each revealed when a progress passes its own threshold. Both are depth-tested,
// so ridges and the dam hide what is behind them. They live on layer 1 (no thermal, no picture-in-picture
// clutter unless asked for).
import * as THREE from 'three';

const RIB_VS = /* glsl */`
attribute vec3 aTan; attribute float aS; attribute float aSide;
uniform float uWidthPx; uniform float uResY;
varying float vS; varying float vSide;
void main() {
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  vec3 t = ( modelViewMatrix * vec4( position + aTan, 1.0 ) ).xyz - mv.xyz;
  vec3 side = normalize( cross( t, normalize( -mv.xyz ) ) + 1e-6 );
  float px = -mv.z * 2.0 / ( uResY * projectionMatrix[ 1 ][ 1 ] );     // one pixel, in view units, at this depth
  mv.xyz += side * aSide * uWidthPx * 0.5 * px;
  gl_Position = projectionMatrix * mv;
  vS = aS; vSide = aSide;
}`;
const RIB_FS = /* glsl */`
uniform vec3 uColor; uniform float uOpacity; uniform float uDraw; uniform float uDash; uniform float uGap; uniform float uFrom;
varying float vS; varying float vSide;
void main() {
  if ( vS > uDraw || vS < uFrom ) discard;
  if ( uDash > 0.0 && mod( vS, uDash + uGap ) > uDash ) discard;
  float a = 1.0 - smoothstep( 0.55, 1.0, abs( vSide ) );
  gl_FragColor = vec4( uColor, a * uOpacity );
}`;

export class Ribbon {
  /**
   * @param {THREE.Vector3[]} pts  the line (world), at least 2 points
   * @param {object} o  color (THREE.Color, linear; HDR allowed), width (px), dash / gap (m), opacity, closed
   */
  constructor(pts, { color = new THREE.Color(1, 1, 1), width = 2, dash = 0, gap = 0, opacity = 1, closed = false, renderOrder = 5 } = {}) {
    this.uniforms = {
      uColor: { value: color.clone() }, uOpacity: { value: opacity }, uDraw: { value: 1e9 }, uFrom: { value: -1 },
      uDash: { value: dash }, uGap: { value: gap }, uWidthPx: { value: width }, uResY: { value: 1000 },
    };
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: RIB_VS, fragmentShader: RIB_FS, transparent: true, depthWrite: false, name: 'table-ribbon' });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.mesh.layers.set(1);
    this.closed = closed;
    this.setPoints(pts);
  }

  setPoints(pts) {
    const P = this.closed ? [...pts, pts[0]] : pts;
    const n = P.length, pos = new Float32Array(n * 6), tan = new Float32Array(n * 6), s = new Float32Array(n * 2), side = new Float32Array(n * 2);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      if (i) acc += P[i].distanceTo(P[i - 1]);
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      const tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z, tl = Math.hypot(tx, ty, tz) || 1;
      for (let k = 0; k < 2; k++) {
        const j = i * 2 + k;
        pos[j * 3] = P[i].x; pos[j * 3 + 1] = P[i].y; pos[j * 3 + 2] = P[i].z;
        tan[j * 3] = tx / tl; tan[j * 3 + 1] = ty / tl; tan[j * 3 + 2] = tz / tl;
        s[j] = acc; side[j] = k ? 1 : -1;
      }
    }
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = this.mesh.geometry;
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aTan', new THREE.BufferAttribute(tan, 3));
    g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    this.length = acc;
  }

  /** Draw from `from` to `to` (fractions of the length), with an opacity. */
  set(to = 1, opacity = 1, from = 0) {
    this.uniforms.uDraw.value = to * this.length + 1e-3;
    this.uniforms.uFrom.value = from > 0 ? from * this.length : -1;
    this.uniforms.uOpacity.value = opacity;
    this.mesh.visible = opacity > 0.002 && to > 0.0005;
  }

  setResY(h) { this.uniforms.uResY.value = h; }
  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); }
}

const MARK_VS = /* glsl */`
attribute float aT; attribute float aSize;
uniform float uProgress; uniform float uScale;
varying float vOn;
void main() {
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mv;
  vOn = smoothstep( aT, aT + 0.02, uProgress );
  gl_PointSize = aSize * uScale * ( 0.6 + 0.4 * vOn );
}`;
const MARK_FS = /* glsl */`
uniform vec3 uColor; uniform vec3 uFill; uniform float uOpacity; uniform float uShape;
varying float vOn;
void main() {
  if ( vOn < 0.01 ) discard;
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float d = uShape < 0.5 ? max( abs( q.x ), abs( q.y ) ) : length( q );
  if ( d > 1.0 ) discard;
  float edge = smoothstep( 0.58, 0.72, d );                 // an outlined marker with a dark core
  vec3 c = mix( uFill, uColor, edge );
  gl_FragColor = vec4( c, uOpacity * vOn * ( 1.0 - smoothstep( 0.92, 1.0, d ) ) );
}`;

export class Marks {
  /** @param {{p: THREE.Vector3, t: number, size?: number}[]} items  t: reveal threshold (0..1) */
  constructor(items, { color = new THREE.Color(1, 0.4, 0.1), fill = new THREE.Color(0.02, 0.018, 0.016), size = 8, shape = 'square' } = {}) {
    const pos = [], t = [], sz = [];
    for (const it of items) { pos.push(it.p.x, it.p.y, it.p.z); t.push(it.t); sz.push(it.size || size); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(sz, 1));
    this.uniforms = { uProgress: { value: 0 }, uScale: { value: 1 }, uColor: { value: color.clone() }, uFill: { value: fill.clone() }, uOpacity: { value: 1 }, uShape: { value: shape === 'square' ? 0 : 1 } };
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: MARK_VS, fragmentShader: MARK_FS, transparent: true, depthWrite: false, name: 'table-marks' });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.points.layers.set(1);
  }
  set(progress, opacity = 1) { this.uniforms.uProgress.value = progress; this.uniforms.uOpacity.value = opacity; this.points.visible = opacity > 0.002; }
  setScale(dpr) { this.uniforms.uScale.value = dpr; }
  dispose() { this.points.geometry.dispose(); this.material.dispose(); }
}

/** A soft glow point with a minimum pixel size (lights, the ember glow). Additive, HDR. */
export class Glow {
  constructor(color, { size = 2, minPx = 3, count = 1 } = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
    this.uniforms = { uCol: { value: color.clone() }, uLevel: { value: 1 }, uMinPx: { value: minPx }, uSize: { value: size }, uScale: { value: 800 } };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, name: 'table-glow',
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
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.layers.set(1);
  }
  setAt(i, v) { const a = this.points.geometry.attributes.position; a.setXYZ(i, v.x, v.y, v.z); a.needsUpdate = true; }
  set(level) { this.uniforms.uLevel.value = level; this.points.visible = level > 0.002; }
  setPixelScale(s) { this.uniforms.uScale.value = s; }
  dispose() { this.points.geometry.dispose(); this.material.dispose(); }
}
