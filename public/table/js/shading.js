// Command Table: the shader pieces every slab material shares, patched into three's standard
// materials with onBeforeCompile (so they keep PBR lighting, the environment and shadow maps).
//
//   sun mask   the terrain's own cast shadows on every tier, from a baked "shadow height" texture
//              (sunmask.js): a point at world height y is in the dusk sun when y is above the height
//              S(x, z) the terrain shadows to there. The ridges, the dam and the slab itself shade
//              the valley, the trees, the props and the table; no shadow map needed. Only the first
//              directional light (the sun) is masked, so the cool fill stays even.
//   haze       a thin height fog that lives inside the valley: optical depth integrated through an
//              exponential layer, so it reads the same from any camera height (the room has none)
//   world pos  vTWp, the world position (instancing included), for both of the above
import * as THREE from 'three';

/** One set of uniforms shared by every patched material (updating one value updates them all). */
export const SHARED = {
  uSunS: { value: null },                                  // RG: shadow height S, occluder distance
  uSunBox: { value: new THREE.Vector4(0, 0, 1, 1) },       // xmin, zmin, 1/width, 1/depth
  uSunOn: { value: 0 },                                    // 0 until the mask is baked
  uSunDirW: { value: new THREE.Vector3(0, 1, 0) },         // world direction to the sun
  uHaze: { value: new THREE.Vector4(0.00065, -10, 80, 0.5) },   // density /m, floor y, scale height, amount
  uHazeCool: { value: new THREE.Color() },
  uHazeWarm: { value: new THREE.Color() },
  uTime: { value: 0 },
  uMap: { value: 0 },                                      // 0 visible .. 1 map mode (step 4)
};

const VERT_PARS = /* glsl */`
varying vec3 vTWp; uniform float uMap;
`;
const VERT_MAIN = /* glsl */`
{
  vec4 tw = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    tw = instanceMatrix * tw;
  #endif
  vTWp = ( modelMatrix * tw ).xyz;
}
`;

const FRAG_PARS = /* glsl */`
varying vec3 vTWp;
uniform sampler2D uSunS; uniform vec4 uSunBox; uniform float uSunOn; uniform vec3 uSunDirW;
uniform vec4 uHaze; uniform vec3 uHazeCool; uniform vec3 uHazeWarm; uniform float uTime; uniform float uMap;
float tableSunVis( vec3 wp ) {
  if ( uSunOn < 0.5 ) return 1.0;
  vec2 uv = ( wp.xz - uSunBox.xy ) * uSunBox.zw;
  if ( uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 ) return 1.0;
  vec2 s = texture2D( uSunS, uv ).rg;
  // penumbra widens with the distance to the occluder (a big soft lamp, not a pin-point sun)
  float k = 1.2 + s.g * 0.018;
  return smoothstep( s.r - k, s.r + k, wp.y );
}
vec3 tableHaze( vec3 c, vec3 wp ) {
  // optical depth through an exponential layer (density uHaze.x at floor uHaze.y, scale height uHaze.z)
  float dist = length( wp - cameraPosition );
  float a = ( cameraPosition.y - uHaze.y ) / uHaze.z, b = ( wp.y - uHaze.y ) / uHaze.z;
  float ea = exp( -max( a, -1.5 ) ), eb = exp( -max( b, -1.5 ) );
  float dy = a - b;
  float t = abs( dy ) < 1e-3 ? eb : ( eb - ea ) / dy;
  float f = ( 1.0 - exp( -uHaze.x * dist * max( t, 0.0 ) ) ) * uHaze.w;
  vec3 v = wp - cameraPosition; v.y = 0.0;
  vec3 sd = uSunDirW; sd.y = 0.0;
  float sunward = pow( max( dot( normalize( v + 1e-4 ), normalize( sd + 1e-4 ) ), 0.0 ), 5.0 );
  return mix( c, mix( uHazeCool, uHazeWarm, sunward ), clamp( f, 0.0, 1.0 ) );
}
`;

/** lights_fragment_begin with the sun (directional light 0) multiplied by the baked terrain mask. */
const LIGHTS_BEGIN = THREE.ShaderChunk.lights_fragment_begin.replace(
  'getDirectionalLightInfo( directionalLight, directLight );',
  'getDirectionalLightInfo( directionalLight, directLight );\n\t\tif ( UNROLLED_LOOP_INDEX == 0 ) directLight.color *= tSunVis;',
);
if (LIGHTS_BEGIN === THREE.ShaderChunk.lights_fragment_begin) console.warn('[table] sun-mask patch point not found');

/**
 * Patch a MeshStandardMaterial (or Physical / Lambert-free standard family) with the shared table
 * shading. opts:
 *   key        unique program cache key (required when the patch differs between materials)
 *   haze       apply the valley haze (default true)
 *   sun        apply the baked sun mask (default true)
 *   uniforms   extra uniforms object (merged into the shader)
 *   vertPars / vertMain / fragPars   extra GLSL (vertMain runs after project_vertex)
 *   color      GLSL run after color_fragment (may write diffuseColor.rgb)
 *   rough      GLSL run after roughnessmap_fragment (may write roughnessFactor)
 *   emissive   GLSL run after emissivemap_fragment (may write totalEmissiveRadiance)
 *   end        GLSL run after opaque_fragment, before the haze (may write gl_FragColor)
 *   vis        GLSL run right after tSunVis is set (may scale tSunVis: the sun's reach on this surface)
 *   lightsEnd  GLSL run after lights_fragment_end (may scale reflectedLight's terms)
 */
export function patchMaterial(mat, opts = {}) {
  const { key = mat.name || 'table', haze = true, sun = true, uniforms = {}, vertPars = '', vertMain = '', vertBegin = '', fragPars = '', color = '', rough = '', emissive = '', end = '', vis = '', lightsEnd = '' } = opts;
  mat.userData.tableUniforms = uniforms;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SHARED, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS + vertPars)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + vertBegin)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_MAIN + vertMain);
    let fs = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS + fragPars);
    if (color) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + color);
    if (rough) fs = fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + rough);
    if (emissive) fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + emissive);
    fs = fs.replace('#include <lights_fragment_begin>', (sun ? 'float tSunVis = tableSunVis( vTWp );\n' : 'float tSunVis = 1.0;\n') + vis + '\n' + LIGHTS_BEGIN);
    if (lightsEnd) fs = fs.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>' + String.fromCharCode(10) + lightsEnd);
    fs = fs.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n' + end + (haze ? '\ngl_FragColor.rgb = tableHaze( gl_FragColor.rgb, vTWp );' : ''));
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => 'table:' + key + (haze ? ':h' : '') + (sun ? ':s' : '');
  return mat;
}

/** The shared GLSL (sun mask + haze functions, world-position varying) for custom ShaderMaterials. */
export const TABLE_GLSL = { VERT_PARS, VERT_MAIN, FRAG_PARS };

/** Linear colour from sRGB hex (for values written straight into shaders / instance colours). */
export const lin = (hex) => new THREE.Color(hex);   // THREE.Color(hex) converts sRGB → linear (ColorManagement on)
