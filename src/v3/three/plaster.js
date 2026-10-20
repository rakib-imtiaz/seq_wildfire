// v3 Maquette: the model's material kit, MeshStandardMaterial with a shader patch.
//
//   GROUND   the surface painted as the land: dry open ground, the forest floor under the stands, rock on the
//            steep faces, gravel on the roads and pads; a faint two-scale mottle
//   CONTOURS the surface: engraved contour lines every 10 m, an index line every 50 m, a constant pixel width;
//            uInk sets their depth (faint on the model, inked in when it becomes the map)
//   STRATA   the four cut sides in section: topsoil, subsoil and glacial till over dipping rock beds, and the
//            reservoir's water where the cut crosses it
//   WATER    the reservoir and the river: colour from the depth under the surface (a pale wet rim at the shore,
//            shallow teal, deep blue-black in the basin), a fine ripple in the normal so the studio's light and
//            sky glint off it
//   LENS     every surface of the model: the three M3T lens frusta projected onto it (a cobalt fill set per beat
//            and a ~3 px outline, only on faces that look back at the lens)
//
// The thermal kit (kit.thermal) is what the thermal lens sees, for the inset: unlit SAMPLE temperatures on the
// ironbow ramp (cool crowns, warmer open ground, cold water, the hotspot white). The lens and ironbow colours are
// written after the output conversion, so cobalt is exactly #2447D6 and the ironbow stops are the shared ramp.
import { MODEL } from './terrain.js';

const IRON = ['#14002e', '#4a0c6a', '#a2195b', '#e8452c', '#ff9e1b', '#ffe6a0', '#ffffff'];

export function createPlasterKit(T, tex) {
  // display-space (sRGB) components, for colours applied after the output conversion
  const srgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return new T.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  };
  const U = {
    uForest: { value: tex.forest },
    uEngrave: { value: tex.engrave },
    uTemp: { value: tex.temp },
    uZone: { value: new T.Vector4(MODEL.X0, MODEL.Z0, 1 / MODEL.W, 1 / MODEL.D) },
    uS: { value: MODEL.S },
    uCI: { value: MODEL.CI },
    uInk: { value: new T.Vector2(0.14, 0.26) },
    // the painted land (linear): dry open ground, forest floor, rock, gravel
    uOpen: { value: new T.Color('#A69C7B') },
    uFloor: { value: new T.Color('#5C5A45') },
    uRock: { value: new T.Color('#A09C90') },
    uGravel: { value: new T.Color('#A39D8E') },
    uLensVP: { value: [new T.Matrix4(), new T.Matrix4(), new T.Matrix4()] },
    uLensPos: { value: [new T.Vector3(), new T.Vector3(), new T.Vector3()] },
    uLensOn: { value: new T.Vector3(0, 0, 0) },
    // each footprint's fill strength (the outline is always full)
    uFill: { value: new T.Vector3(0.2, 0.36, 0.2) },
    // the heat beat's focus: outside the thermal footprint the land pales toward the studio (display space)
    uFocus: { value: 0 },
    uVeil: { value: srgb('#E2E3E0') },
    uHeight: { value: tex.height },
    uHN: { value: new T.Vector2(tex.height.image.width, tex.height.image.height) },
    uWaterRim: { value: new T.Color('#8E9283') },
    uWaterShallow: { value: new T.Color('#3E6A66') },
    uWaterDeep: { value: new T.Color('#0E2A36') },
    uTime: { value: 0 },
    uHot: { value: new T.Vector3(0, 0, 312) },
    uCobalt: { value: srgb('#2447D6') },
    uIron: { value: IRON.map(srgb) },
  };

  const COMMON = /* glsl */ `
    varying vec3 vWorld;
    varying vec3 vWN;
  `;
  const FRAG_HEAD = /* glsl */ `
    uniform sampler2D uForest;
    uniform sampler2D uEngrave;
    uniform sampler2D uTemp;
    uniform vec4 uZone;
    uniform float uS;
    uniform float uCI;
    uniform vec2 uInk;
    uniform vec3 uOpen;
    uniform vec3 uFloor;
    uniform vec3 uRock;
    uniform vec3 uGravel;
    uniform mat4 uLensVP[3];
    uniform vec3 uLensPos[3];
    uniform vec3 uLensOn;
    uniform vec3 uFill;
    uniform float uFocus;
    uniform vec3 uVeil;
    uniform sampler2D uHeight;
    uniform vec2 uHN;
    uniform vec3 uWaterRim;
    uniform vec3 uWaterShallow;
    uniform vec3 uWaterDeep;
    uniform float uTime;
    uniform vec3 uHot;
    uniform vec3 uCobalt;
    uniform vec3 uIron[7];
    float mqHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float mqH1(float n) { return fract(sin(n * 91.7) * 43758.5453); }
    float mqNoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mqHash(i), mqHash(i + vec2(1.0, 0.0)), f.x), mix(mqHash(i + vec2(0.0, 1.0)), mqHash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    vec3 mqIron(float s) {
      float t = clamp(s, 0.0, 1.0) * 6.0;
      int i = int(min(floor(t), 5.0));
      float f = t - float(i);
      vec3 a = uIron[0], b = uIron[1];
      for (int k = 0; k < 6; k++) { if (k == i) { a = uIron[k]; b = uIron[k + 1]; } }
      return mix(a, b, f);
    }
    vec2 mqUV(vec3 w) { vec2 zp = w.xz / uS; return vec2((zp.x - uZone.x) * uZone.z, (zp.y - uZone.y) * uZone.w); }
    // the lens gain: cool ground in the deep purples, 60 °C at the ramp's red, the hotspot through to white
    float mqGain(float tc) { return tc <= 60.0 ? clamp((tc - 6.0) / 54.0, 0.0, 1.0) * 0.6 : 0.6 + 0.4 * clamp(log(tc / 60.0) / log(5.0), 0.0, 1.0); }
  `;

  function patch(shader, defs) {
    Object.assign(shader.uniforms, U);
    let vert = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${COMMON}${defs.strata ? '\nattribute float aBed;\nattribute float aAlong;\nvarying float vBed;\nvarying float vAlong;' : ''}${defs.water ? '\nattribute vec4 aFlow;\nvarying vec4 vFlow;' : ''}`)
      .replace('#include <project_vertex>', /* glsl */ `#include <project_vertex>
  #ifdef USE_INSTANCING
    vWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
    mat3 mqIm = mat3(instanceMatrix);
    vec3 mqN = objectNormal / vec3(dot(mqIm[0], mqIm[0]), dot(mqIm[1], mqIm[1]), dot(mqIm[2], mqIm[2]));
    vWN = normalize(mat3(modelMatrix) * (mqIm * mqN));
  #else
    vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
    vWN = normalize(mat3(modelMatrix) * objectNormal);
  #endif${defs.strata ? '\n    vBed = aBed; vAlong = aAlong;' : ''}${defs.water ? '\n    vFlow = aFlow;' : ''}`);
    // MeshBasicMaterial has no objectNormal in its vertex shader unless it has an env map or a normal map
    if (defs.thermal) vert = vert.replace('#include <begin_vertex>', '#include <beginnormal_vertex>\n#include <begin_vertex>');
    shader.vertexShader = vert;
    let frag = shader.fragmentShader.replace('#include <common>', `#include <common>\n${COMMON}\n${FRAG_HEAD}${defs.strata ? '\nvarying float vBed;\nvarying float vAlong;' : ''}${defs.water ? '\nvarying vec4 vFlow;' : ''}`);
    let surface = '';
    if (defs.ground) surface += /* glsl */ `
      {
        // the land painted on: dry open ground, the forest floor where the stands are (so gaps between crowns read
        // as shade, not as bare model), rock on the steep faces, gravel on the roads and pads; the vertex AO and a
        // faint two-scale mottle on top, so large areas never read as CG-flat (the trees are in forest.js)
        vec2 zp = vWorld.xz / uS;
        vec2 uv = mqUV(vWorld);
        float eng = texture2D(uEngrave, uv).r;
        float dens = texture2D(uForest, uv).r;
        vec2 g1 = floor(zp * 0.9), g2 = floor(zp * 0.23);
        float grain = (mqHash(g1) - 0.5) * 0.05 + (mqHash(g2 + 3.7) - 0.5) * 0.07;
        vec3 land = mix(uOpen, uFloor, smoothstep(0.15, 0.85, dens));
        land = mix(land, uRock, smoothstep(0.62, 0.42, vWN.y) * 0.8);
        land = mix(land, uGravel, eng);
        diffuseColor.rgb = land * vColor * (1.0 + grain);
      }`;
    if (defs.contours) surface += /* glsl */ `
      {
        // engraved contours: distance to the nearest level in pixels, so every line is ~1.5 px (index ~2 px)
        // wherever it is; where lines crowd closer than a few pixels they fade out instead of turning to grey
        float hz = vWorld.y / uS;
        float a = hz / uCI, fa = max(fwidth(a), 0.002);
        float minor = (1.0 - smoothstep(0.35, 1.1, abs(fract(a + 0.5) - 0.5) / fa)) * (1.0 - smoothstep(0.16, 0.34, fa));
        float b = hz / (uCI * 5.0), fb = max(fwidth(b), 0.0004);
        float major = (1.0 - smoothstep(0.55, 1.45, abs(fract(b + 0.5) - 0.5) / fb)) * (1.0 - smoothstep(0.16, 0.34, fb));
        diffuseColor.rgb *= 1.0 - clamp(uInk.x * minor + uInk.y * major, 0.0, 0.9);
      }`;
    if (defs.strata) surface += /* glsl */ `
      {
        // the cut in section (zone metres): rock beds of varied thickness that dip, wave and pinch along the face
        // (sandstone, siltstone, grey and green shale, an oxidised band, basalt, a pale ash bed), glacial till,
        // brown subsoil and a dark organic topsoil under the land; the reservoir in section where the cut crosses it
        float y = vWorld.y / uS;
        float al = vAlong;
        float dep = vBed - y;
        float nB = mqNoise(vec2(al / 300.0, 0.37));
        float nW = mqNoise(vec2(al / 140.0, y / 90.0));
        float nM = mqNoise(vec2(al / 45.0, y / 45.0));
        float nF = mqNoise(vec2(al / 3.0, y / 1.1));
        float yy = y + al * 0.021 + (nB - 0.5) * 8.0 + (nW - 0.5) * 10.0 + sin(al / 230.0) * 3.5;
        float L0 = floor(yy / 12.0);
        float th = 0.5 + 0.95 * mqH1(L0 + 11.0);
        float bb = yy / (12.0 * th);
        float layer = floor(bb), fr = fract(bb);
        float r = mqH1(layer * 1.7 + L0 * 0.3 + 3.0);
        vec3 c = r < 0.24 ? vec3(0.26, 0.205, 0.15) : r < 0.42 ? vec3(0.2, 0.17, 0.14) : r < 0.6 ? vec3(0.13, 0.125, 0.12)
               : r < 0.7 ? vec3(0.135, 0.145, 0.125) : r < 0.8 ? vec3(0.23, 0.13, 0.08) : r < 0.93 ? vec3(0.075, 0.072, 0.07) : vec3(0.3, 0.28, 0.25);
        c *= 0.8 + 0.4 * nF;
        c *= 0.9 + 0.2 * nM;
        c *= 0.6 + 0.4 * smoothstep(0.0, 0.07, fr);                    // a dark parting at each bed's base
        float tillB = 18.0 + (nM - 0.5) * 12.0;
        c = mix(c, vec3(0.24, 0.215, 0.18) * (0.78 + 0.4 * nF), 1.0 - smoothstep(tillB - 2.0, tillB + 2.0, dep));
        c = mix(c, vec3(0.22, 0.15, 0.095) * (0.8 + 0.35 * nF), 1.0 - smoothstep(7.0, 10.0, dep + (nM - 0.5) * 3.0));
        c = mix(c, vec3(0.07, 0.055, 0.04) * (0.85 + 0.3 * nF), 1.0 - smoothstep(2.4, 3.8, dep));
        c = mix(c, vec3(0.045, 0.075, 0.085), step(0.0, -dep - 0.05));   // water in section, above the lake bed
        diffuseColor.rgb = c * vColor;
      }`;
    if (defs.water) surface += /* glsl */ `
      {
        vec2 uvh = (mqUV(vWorld) * (uHN - 1.0) + 0.5) / uHN;
        float depth = max(0.0, vWorld.y / uS - texture2D(uHeight, uvh).r);
        vec3 wc = mix(uWaterShallow, uWaterDeep, smoothstep(0.4, 16.0, depth));
        wc = mix(wc, uWaterRim, (1.0 - smoothstep(0.0, 1.1, depth)) * 0.6);
        // the river: streaks of broken water carried downstream (noise stretched along the current), froth along
        // both banks, and whitewater where it leaves the dam's spillway
        float river = step(0.5, length(vFlow.xy));
        if (river > 0.5) {
          vec2 fd = normalize(vFlow.xy), fs = vec2(-fd.y, fd.x);
          vec2 zp = vWorld.xz / uS;
          vec2 q = vec2(dot(zp, fd) - uTime * 2.4, dot(zp, fs));
          float streak = mqNoise(vec2(q.x * 0.045, q.y * 0.42)) * 0.65 + mqNoise(vec2(q.x * 0.11 + 3.1, q.y * 0.9)) * 0.35;
          wc = mix(wc, vec3(0.55, 0.62, 0.6), smoothstep(0.62, 0.86, streak) * 0.55);
          float bank = smoothstep(0.55, 0.95, abs(vFlow.w));
          wc = mix(wc, vec3(0.7, 0.74, 0.71), bank * smoothstep(0.45, 0.8, mqNoise(vec2(q.x * 0.2, q.y * 0.6 + 9.0))) * 0.6);
          float white = 1.0 - smoothstep(10.0, 70.0, vFlow.z);
          wc = mix(wc, vec3(0.86, 0.89, 0.88), white * smoothstep(0.3, 0.7, mqNoise(vec2(q.x * 0.16, q.y * 0.5))) );
        }
        diffuseColor.rgb = wc;
      }`;
    if (surface) frag = frag.replace('#include <color_fragment>', `#include <color_fragment>\n${surface}`);
    if (defs.water) frag = frag.replace('#include <normal_fragment_maps>', /* glsl */ `#include <normal_fragment_maps>
      {
        // ripples: two octaves of value noise as a height, its slope tilts the normal; on the river they ride the
        // current downstream, on the reservoir a light wind drifts them
        vec2 rp = vWorld.xz / uS;
        rp -= (length(vFlow.xy) > 0.5 ? normalize(vFlow.xy) * 2.4 : vec2(0.35, 0.2)) * uTime;
        float e = 3.0;
        float h0 = mqNoise(rp * 0.05) + 0.4 * mqNoise(rp * 0.13 + 7.3);
        float hx = mqNoise((rp + vec2(e, 0.0)) * 0.05) + 0.4 * mqNoise((rp + vec2(e, 0.0)) * 0.13 + 7.3);
        float hz = mqNoise((rp + vec2(0.0, e)) * 0.05) + 0.4 * mqNoise((rp + vec2(0.0, e)) * 0.13 + 7.3);
        vec3 wn = normalize(vec3(-(hx - h0) * 0.5, 1.0, -(hz - h0) * 0.5));
        normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
      }`);
    if (defs.lens) {
      frag = frag.replace('#include <colorspace_fragment>', /* glsl */ `#include <colorspace_fragment>
      {
        vec3 col = gl_FragColor.rgb;
        float irIn = 0.0;
        for (int i = 0; i < 3; i++) {
          vec4 cp = uLensVP[i] * vec4(vWorld, 1.0);
          if (cp.w <= 0.0) continue;
          vec2 nd = cp.xy / cp.w;
          float m = max(abs(nd.x), abs(nd.y));
          float fw = fwidth(m) + 1e-5;
          float inside = 1.0 - smoothstep(1.0 - fw * 0.5, 1.0 + fw * 0.5, m);
          // the frustum drapes over every face inside it, except faces turned fully away from the lens
          float facing = smoothstep(-0.7, -0.2, dot(vWN, normalize(uLensPos[i] - vWorld)));
          float on = (i == 0 ? uLensOn.x : (i == 1 ? uLensOn.y : uLensOn.z)) * facing;
          float fill = i == 0 ? uFill.x : (i == 1 ? uFill.y : uFill.z);
          // a ~3 px outline strong enough to read over the dark stands
          float edge = (1.0 - smoothstep(1.6, 3.2, (1.0 - m) / fw)) * inside;
          col = mix(col, uCobalt, inside * on * fill);
          col = mix(col, uCobalt, edge * on * 0.92);
          if (i == 2) irIn = inside;
        }
        if (uFocus > 0.001) {
          float lum = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(col, mix(vec3(lum), uVeil, 0.55), 0.62 * uFocus * (1.0 - irIn));
        }
        gl_FragColor.rgb = col;
      }`);
    }
    if (defs.thermal) {
      // what the thermal lens reads, °C (SAMPLE): each kind of surface at its own dusk temperature, the ground
      // warmed in a tight halo around the hotspot and the 312 °C core itself
      const T_OF = {
        ground: '2.0 + texture2D(uTemp, mqUV(vWorld)).r * 48.0',
        tree: '10.5 + 6.0 * vColor.r',
        built: '23.0',
        steel: '15.0',
        water: '8.0',
      };
      frag = frag.replace('#include <colorspace_fragment>', /* glsl */ `#include <colorspace_fragment>
      {
        vec2 zq = vWorld.xz / uS - uHot.xy;
        float d2 = dot(zq, zq);
        float tc = ${T_OF[defs.thermal]};
        tc += ${defs.thermal === 'tree' ? '26.0 * exp(-d2 / 500.0)' : '14.0 * exp(-d2 / 700.0)'};
        ${defs.thermal === 'ground' ? 'tc = max(tc, uHot.z * exp(-d2 / 45.0));' : ''}
        float lam = 0.82 + 0.18 * clamp(dot(vWN, normalize(vec3(-0.35, 0.85, -0.4))), 0.0, 1.0);
        gl_FragColor = vec4(mqIron(mqGain(tc)) * lam, 1.0);
      }`);
    }
    shader.fragmentShader = frag;
  }

  const mats = [];
  function make(name, params, defs, Base = T.MeshStandardMaterial) {
    const m = new Base({ name, ...params });
    m.onBeforeCompile = (sh) => patch(sh, defs);
    m.customProgramCacheKey = () => `mq-${defs.ground ? 1 : 0}${defs.contours ? 1 : 0}${defs.lens ? 1 : 0}${defs.strata ? 1 : 0}${defs.water ? 1 : 0}${defs.thermal || ''}`;
    mats.push(m);
    return m;
  }
  const ir = (name, kind, extra = {}) => make(name, { color: '#ffffff', fog: false, toneMapped: false, ...extra }, { thermal: kind }, T.MeshBasicMaterial);
  const kit = {
    U,
    surface: make('mq-surface', { color: '#ffffff', roughness: 0.95, metalness: 0, vertexColors: true, envMapIntensity: 0.5 }, { ground: true, contours: true, lens: true }),
    sides: make('mq-sides', { color: '#ffffff', roughness: 0.92, metalness: 0, vertexColors: true, envMapIntensity: 0.6 }, { strata: true, lens: true }),
    // the conifers: colour from the per-tree tint and the crown's vertex shade; needles are matte
    trees: make('mq-trees', { color: '#ffffff', roughness: 1, metalness: 0, vertexColors: true, envMapIntensity: 0.3 }, { lens: true }),
    massing: make('mq-massing', { color: '#D3D1CA', roughness: 0.9, metalness: 0, envMapIntensity: 0.6 }, { lens: true }),
    steel: make('mq-steel', { color: '#A3A8AB', roughness: 0.55, metalness: 0.35, envMapIntensity: 0.9 }, { lens: true }),
    gravel: make('mq-gravel', { color: '#ABA493', roughness: 1, metalness: 0, envMapIntensity: 0.4 }, { lens: true }),
    water: make('mq-water', { color: '#ffffff', roughness: 0.26, metalness: 0, envMapIntensity: 1.0 }, { water: true, lens: true }),
    base: make('mq-base', { color: '#E9EAE7', roughness: 0.9, metalness: 0, envMapIntensity: 0.55 }, {}),
    // the thermal lens's view, for the inset (engine swaps these in for one render)
    thermal: {
      surface: ir('ir-ground', 'ground'),
      sides: ir('ir-sides', 'built'),
      trees: ir('ir-trees', 'tree', { vertexColors: true }),
      massing: ir('ir-built', 'built'),
      steel: ir('ir-steel', 'steel'),
      gravel: ir('ir-gravel', 'built'),
      water: ir('ir-water', 'water'),
    },
    dispose() { mats.forEach((m) => m.dispose()); },
  };
  return kit;
}
