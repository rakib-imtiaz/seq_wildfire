// Command Table: the reservoir and the river. Dark, glossy water, one shader for both:
//   - small ripple normals from the shared noise texture, stretched across the line of sight (wavelets
//     read as streaks at a distance), in calm and breezy patches; frozen under ?frame=
//   - a Fresnel reflection of a dusk sky gradient: deep blue overhead, a low band glowing warm across the
//     sun's half of the horizon; the ripples tip the reflection into that band, so the glow breaks into
//     streaks. Where the water lies in the valley's shadow the glow is dimmer (the ridge hides that sky)
//   - the ridges reflected: the reflected ray is marched a few steps over the height grid; where it meets
//     the land the water shows the land's dark mass, warm where the sun mask says it is lit
//   - depth: the shallows show their dark bed and fade out at the waterline (no hard edge: the wet bank,
//     darkened by the ground shader, takes over); the sun's glint; the valley haze
//   - the reservoir ends at the dam's curved upstream face (fragments downstream are discarded)
//   - the river follows terrain.js's riverShape (varying width, offset channel, gravel bars)
import * as THREE from 'three';
import { ZONE } from './zone.js';
import { SLAB, LEVELS, DAM, RIVER, pointAt, riverSurface } from './layout.js';
import { TERRAIN, riverShape } from './terrain.js';
import { SHARED, TABLE_GLSL } from './shading.js';

const VS = /* glsl */`
${TABLE_GLSL.VERT_PARS}
void main() {
  vec3 transformed = position;
  vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
  ${TABLE_GLSL.VERT_MAIN}
}`;

const FS = /* glsl */`
${TABLE_GLSL.FRAG_PARS}
uniform sampler2D uNoise; uniform sampler2D uH; uniform vec2 uGrid; uniform vec4 uSlab;
uniform vec3 uSunCol; uniform vec3 uSkyLow; uniform vec3 uSkyHigh; uniform vec3 uSkyWarm; uniform vec3 uDeep; uniform vec3 uBed;
uniform vec3 uLand; uniform vec3 uLandLit; uniform float uWaterTime; uniform float uRipple; uniform float uSheen;
uniform vec4 uDam; uniform float uDamR; uniform float uClipDam; uniform float uDebug;
float Hg( vec2 p ) {
  vec2 g = clamp( ( p - uSlab.xy ) / ( uSlab.zw - uSlab.xy ) * uGrid, vec2( 0.0 ), uGrid - 0.001 );
  vec2 i = floor( g ), f = g - i, ts = 1.0 / ( uGrid + 1.0 ), c = ( i + 0.5 ) * ts;
  return mix( mix( texture2D( uH, c ).r, texture2D( uH, c + vec2( ts.x, 0.0 ) ).r, f.x ),
              mix( texture2D( uH, c + vec2( 0.0, ts.y ) ).r, texture2D( uH, c + ts ).r, f.x ), f.y );
}
// the dusk sky the water mirrors: lit = how much of the low western glow this spot can see
vec3 sky( vec3 r, float lit ) {
  vec3 h = normalize( vec3( r.x, 0.0, r.z ) + 1e-5 );
  vec3 s = normalize( vec3( uSunDirW.x, 0.0, uSunDirW.z ) );
  float toward = dot( h, s ) * 0.5 + 0.5;
  float el = max( r.y, 0.0 );
  // deep blue overhead, a dusky band low down: the gradient a lake mirrors upside down (the far water shows
  // the low sky, the near water the high sky), the band warm across the sun's half of the horizon
  vec3 c = mix( uSkyLow, uSkyHigh, smoothstep( 0.04, 0.42, el ) );
  float band = exp( -el * 7.0 );
  c += uSkyLow * band * 1.3;                                       // the pale twilight band itself
  c += uSkyWarm * band * ( 0.02 + 0.4 * pow( toward, 4.0 ) ) * lit;
  c += uSkyWarm * 0.6 * pow( max( dot( r, uSunDirW ), 0.0 ), 18.0 ) * lit;
  return c;
}
void main() {
  vec3 wp = vTWp;
  if ( wp.x < uSlab.x || wp.x > uSlab.z || wp.z < uSlab.y || wp.z > uSlab.w ) discard;
  if ( uClipDam > 0.5 ) {
    // dam frame: local x downstream, local z along the crest
    vec2 d = wp.xz - uDam.xy;
    float xl = dot( d, uDam.zw ), zl = dot( d, vec2( -uDam.w, uDam.z ) );
    if ( abs( zl ) < 140.0 && xl > uDamR - sqrt( max( uDamR * uDamR - zl * zl, 0.0 ) ) + 1.0 ) discard;
  }
  vec2 p = wp.xz;
  float depth = wp.y - Hg( p );
  if ( depth < -0.05 ) discard;
  float t = uWaterTime;
  vec3 v = normalize( cameraPosition - wp );
  // ripples in a frame across (rt) and along (fw) the camera's heading (one frame for the whole picture: a
  // per-pixel line of sight would fan the pattern out from the camera into stripes): long across, short along
  vec2 fw = normalize( -vec2( viewMatrix[ 0 ][ 2 ], viewMatrix[ 2 ][ 2 ] ) + 1e-5 ), rt = vec2( -fw.y, fw.x );
  // (far water: bigger wavelets, so the streaks stay a few pixels long instead of averaging to grey)
  float lod = clamp( length( cameraPosition - wp ) / 1100.0, 1.0, 4.0 );
  vec2 q = vec2( dot( p, rt ), dot( p, fw ) ) / lod;
  // (one noise tile holds features about a quarter of its size: tiles of tens of metres, so the wavelets stay
  // above the texture's mip blur at any range)
  // (the line of sight foreshortens the water about four times: a tile longer along it than across makes
  // wavelets that read as short horizontal streaks)
  float r1 = texture2D( uNoise, vec2( q.x / 30.0, q.y / 64.0 ) + vec2( t * 0.003, t * 0.012 ) ).b - 0.5;
  float r2 = texture2D( uNoise, vec2( q.x / 14.0, q.y / 30.0 ) + vec2( -t * 0.005, t * 0.019 ) ).g - 0.5;
  vec2 pw = mat2( 0.71, -0.71, 0.71, 0.71 ) * p;                 // wind lanes along the NE wind
  float sw = texture2D( uNoise, vec2( pw.x / 230.0, pw.y / 80.0 ) + vec2( t * 0.0021, -t * 0.0014 ) ).r - 0.5;
  float breeze = smoothstep( -0.22, 0.28, sw );                 // calm and breezy patches
  float sF = ( r1 * 0.11 + r2 * 0.06 ) * ( 0.3 + 0.7 * breeze ) * uRipple;
  float sR = r2 * 0.025 * uRipple;
  vec3 n = normalize( vec3( fw.x * sF + rt.x * sR, 1.0, fw.y * sF + rt.y * sR ) );
  float fres = 0.04 + 0.96 * pow( 1.0 - max( dot( n, v ), 0.0 ), 4.0 );
  fres = mix( fres, 1.0, uSheen );                                // a dull sheen of the sky: the water reads as a surface
  vec3 r = reflect( -v, n );
  r.y = max( r.y, 0.003 );
  float vis = tableSunVis( wp + vec3( 0.0, 3.0, 0.0 ) );
  float lit = mix( 0.4, 1.0, vis );
  vec3 refl = sky( r, lit );
  // the glow streaks: ripple faces tipped toward the low glow catch it (a steeper look-up of the same band)
  vec3 rg = reflect( -v, normalize( vec3( fw.x * sF * 3.0, 1.0, fw.y * sF * 3.0 ) ) );
  vec3 hg = normalize( vec3( rg.x, 0.0, rg.z ) + 1e-5 ), sg = normalize( vec3( uSunDirW.x, 0.0, uSunDirW.z ) );
  float streak = smoothstep( 0.32, 0.0, max( rg.y, 0.0 ) ) * pow( dot( hg, sg ) * 0.5 + 0.5, 2.0 ) * smoothstep( 0.0, 0.06, sF );
  vec3 glow = uSkyWarm * streak * lit * ( 0.4 + 0.6 * breeze );
  // the land in the reflection: march the reflected ray over the height grid
  vec2 rd = normalize( r.xz + 1e-5 );
  float rise = r.y / max( length( r.xz ), 1e-3 );
  float tt = 6.0;
  for ( int k = 0; k < 14; k++ ) {
    vec2 qq = p + rd * tt;
    if ( qq.x < uSlab.x || qq.x > uSlab.z || qq.y < uSlab.y || qq.y > uSlab.w ) break;
    float hy = Hg( qq );
    if ( hy > wp.y + rise * tt ) {
      float lt = tableSunVis( vec3( qq.x, hy + 6.0, qq.y ) );
      refl = mix( uLand, uLandLit, lt * 0.8 );
      break;
    }
    tt *= 1.42;
  }
  // the banks' own reflection: the forested shores mirror as a dark band along every bank (the shallows are
  // near the bank); the open water between them shows the sky
  float bankRefl = ( 1.0 - smoothstep( 2.0, 15.0, depth ) ) * ( 1.0 - uMap );
  refl = mix( refl, uLand * 2.0, bankRefl * 0.8 );
  // the body: near black, the dark bed showing through the shallows
  vec3 body = mix( uBed, uDeep, smoothstep( 0.1, 2.2, depth ) ) * mix( 0.6, 1.0, vis );
  vec3 col = mix( body, refl * mix( 0.62, 1.25, breeze ), fres ) + glow * 0.5;    // (cat's paws: breezy patches greyer, calm ones mirror the deep sky)
  // glints: sparse wavelet crests across the line of sight catching the warm sky (a few px long at any range)
  float gn = texture2D( uNoise, vec2( q.x / 15.0, q.y / 34.0 ) + vec2( t * 0.004, t * 0.03 ) ).a
           * texture2D( uNoise, p / ( 46.0 * lod ) + vec2( 0.37 - t * 0.006, 0.71 + t * 0.02 ) ).b * 4.0;
  // (denser where wavelets lap the shallows along a shore, brightest at grazing angles: the far shore)
  float shore = 1.0 - smoothstep( 1.5, 14.0, depth );
  float glint = smoothstep( mix( 1.42, 1.22, shore ), mix( 1.72, 1.5, shore ), gn ) * ( 0.35 + 0.65 * breeze ) * smoothstep( 0.55, 0.08, max( r.y, 0.0 ) );
  col += uSkyWarm * glint * ( 0.5 + 0.8 * shore ) * lit * ( 0.3 + 0.7 * pow( dot( normalize( vec3( r.x, 0.0, r.z ) + 1e-5 ), sg ) * 0.5 + 0.5, 2.0 ) );            // (a tipped wavelet sees the glow at a grazing angle)
  // the sun's glint (masked by the terrain's shadow)
  col += uSunCol * pow( max( dot( r, uSunDirW ), 0.0 ), 600.0 ) * 8.0 * vis;
  col = tableHaze( col, wp );
  col = mix( col, vec3( 0.008, 0.016, 0.026 ), uMap );
  float alpha = smoothstep( 0.0, 0.9, depth );                   // the waterline: fade into the wet bank
  alpha = mix( alpha, 1.0, uMap );
  if ( uDebug > 4.5 ) { col = vec3( glint ); alpha = 1.0; }
  else if ( uDebug > 0.5 ) { col = uDebug < 1.5 ? vec3( clamp( depth / 10.0, 0.0, 1.0 ), clamp( -depth / 10.0, 0.0, 1.0 ), 0.0 ) : uDebug < 2.5 ? vec3( fres ) : uDebug < 3.5 ? body * 10.0 : refl; alpha = 1.0; }
  gl_FragColor = vec4( col, alpha );
}`;

export class Water {
  constructor(noiseTex, hTex) {
    const lc = (h) => new THREE.Color(h);
    this.uniforms = {
      ...SHARED,
      uNoise: { value: noiseTex }, uH: { value: hTex }, uGrid: { value: new THREE.Vector2(TERRAIN.nx, TERRAIN.nz) },
      uSlab: { value: new THREE.Vector4(SLAB.x0, SLAB.z0, SLAB.x1, SLAB.z1) },
      uSunCol: { value: lc(0xffb070) }, uSkyLow: { value: lc(0x5a4a48) }, uSkyHigh: { value: lc(0x1c2433) }, uSkyWarm: { value: lc(0xff9a50) },
      uDeep: { value: new THREE.Color().setRGB(0.002, 0.006, 0.009) }, uBed: { value: new THREE.Color().setRGB(0.028, 0.026, 0.019) },
      uLand: { value: new THREE.Color().setRGB(0.004, 0.006, 0.006) }, uLandLit: { value: new THREE.Color().setRGB(0.024, 0.022, 0.012) },
      uWaterTime: { value: 0 }, uDebug: { value: 0 }, uRipple: { value: 1 }, uSheen: { value: 0.06 },
      uDam: { value: new THREE.Vector4(DAM.cx, DAM.cz, DAM.ux, DAM.uz) }, uDamR: { value: DAM.R }, uClipDam: { value: 1 },
    };
    const mk = (clip, ripple, sheen) => {
      const u = { ...this.uniforms, uClipDam: { value: clip }, uRipple: { value: ripple }, uSheen: { value: sheen } };
      return new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: true, name: 'table-water' });
    };
    this.resMat = mk(1, 1, 0.05);
    this.riverMat = mk(0, 1.5, 0.32);            // running water: livelier, and in a shaded valley it reads by its sheen of the sky
    this.group = new THREE.Group();
    this.group.name = 'table:water';

    // the reservoir: the ZONE polygon, flat at the water level (the shoreline is where the land rises out)
    const shape = new THREE.Shape(ZONE.reservoir.map(([x, z]) => new THREE.Vector2(x, -z)));
    const rg = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
    rg.translate(0, LEVELS.reservoir, 0);
    this.reservoir = new THREE.Mesh(rg, this.resMat);
    this.reservoir.name = 'table:reservoir';
    this.reservoir.userData.thermal = 'water';
    this.group.add(this.reservoir);

    // the river below the dam: a ribbon over the channel (riverShape), level across, sloping down the valley;
    // wider than the water: the banks rise through it and the shader fades it out at the waterline
    const s0 = DAM.sRiver + DAM.faceX(DAM.spillZ, LEVELS.damFloor) - 6, s1 = RIVER.length;
    const across = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
    const pos = [], idx = [];
    const P = {}, rs = {};
    let rows = 0;
    for (let s = s0; s <= s1 + 0.01; s += 4) {
      pointAt(RIVER, s, P);
      riverShape(s, rs);
      const nx = -P.tz, nz = P.tx, y = riverSurface(s);
      const lo = rs.hwN + 18 * rs.bar + 6, hi = rs.hwS + 5;
      for (const f of across) { const d = rs.m + (f < 0 ? f * lo : f * hi); pos.push(P.x + nx * d, y, P.z + nz * d); }
      if (rows > 0) {
        const r0 = (rows - 1) * across.length, r1 = rows * across.length;
        for (let k = 0; k < across.length - 1; k++) idx.push(r0 + k, r1 + k, r0 + k + 1, r0 + k + 1, r1 + k, r1 + k + 1);
      }
      rows++;
      if (P.x > SLAB.x1 + 40 || P.z > SLAB.z1 + 40) break;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // make every triangle face up
    { const ia = geo.index.array, pa = geo.attributes.position.array;
      for (let i = 0; i < ia.length; i += 3) {
        const A = ia[i] * 3, B = ia[i + 1] * 3, C = ia[i + 2] * 3;
        const ux = pa[B] - pa[A], uz = pa[B + 2] - pa[A + 2], vx = pa[C] - pa[A], vz = pa[C + 2] - pa[A + 2];
        if (uz * vx - ux * vz < 0) { const tmp = ia[i + 1]; ia[i + 1] = ia[i + 2]; ia[i + 2] = tmp; }
      } }
    this.river = new THREE.Mesh(geo, this.riverMat);
    this.river.name = 'table:river';
    this.river.userData.thermal = 'water';
    this.group.add(this.river);
  }

  /** Light-only: the sky the water reflects, the sun's colour (linear, intensity included). */
  setLook({ skyLow, skyHigh, skyWarm, sunCol }) {
    const u = this.uniforms;
    if (skyLow) u.uSkyLow.value.copy(skyLow);
    if (skyHigh) u.uSkyHigh.value.copy(skyHigh);
    if (skyWarm) u.uSkyWarm.value.copy(skyWarm);
    if (sunCol) u.uSunCol.value.copy(sunCol);
  }

  update(t) { this.uniforms.uWaterTime.value = t; }

  dispose() {
    this.reservoir.geometry.dispose(); this.river.geometry.dispose();
    this.resMat.dispose(); this.riverMat.dispose();
  }
}
