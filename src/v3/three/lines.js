// v3 Maquette: lines drawn on and over the model.
//   createPathLine   a constant-pixel-width ribbon along a 3D polyline (screen-space expansion in the vertex
//                    shader), with a draw-progress uniform and optional dashes in model metres. Used for the
//                    graphite patrol route on the surface, the dashed flight path in the air and the thermal
//                    footprint's outline (setPoints moves it every frame; overlay: drawn over the trees).
//   createTicks      thin plumb lines from the flight path down to the surface (architectural altitude notation)
//   createCone       one lens's field of view: four cobalt edges from the lens to the footprint corners and four
//                    faint faces. Positions are rewritten every frame (the drone bobs, the gimbal tilts).

export function createPathLine(T, pts, { width = 2.5, color = '#1A1C1E', opacity = 1, dash = null, bias = 0.0006, overlay = false } = {}) {
  // pts: [[x, y, z], ...] in world metres; s: cumulative arc length (world metres)
  const n = pts.length;
  const pos = new Float32Array(n * 6), prev = new Float32Array(n * 6), next = new Float32Array(n * 6), arc = new Float32Array(n * 2);
  const side = [], idx = [];
  for (let i = 0; i < n; i++) {
    side.push(-1, 1);
    if (i < n - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  let acc = 0;
  function fill(P) {
    acc = 0;
    for (let i = 0; i < n; i++) {
      if (i) acc += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]);
      const p = P[i], a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      for (let k = 0; k < 2; k++) {
        pos.set(p, (i * 2 + k) * 3); prev.set(a, (i * 2 + k) * 3); next.set(b, (i * 2 + k) * 3); arc[i * 2 + k] = acc;
      }
    }
  }
  fill(pts);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('aPrev', new T.BufferAttribute(prev, 3));
  g.setAttribute('aNext', new T.BufferAttribute(next, 3));
  g.setAttribute('aSide', new T.Float32BufferAttribute(side, 1));
  g.setAttribute('aArc', new T.BufferAttribute(arc, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const hex = parseInt(color.slice(1), 16);
  const mat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: !overlay,
    side: T.DoubleSide, // the ribbon's winding flips with its screen direction
    uniforms: {
      uRes: { value: new T.Vector2(1, 1) },
      uWidth: { value: width },
      uColor: { value: new T.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255) },
      uOpacity: { value: opacity },
      uProg: { value: 1 },
      uLen: { value: acc },
      uDash: { value: new T.Vector2(dash ? dash[0] : 0, dash ? dash[1] : 0) },
      uBias: { value: bias },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aPrev;
      attribute vec3 aNext;
      attribute float aSide;
      attribute float aArc;
      uniform vec2 uRes;
      uniform float uWidth;
      uniform float uBias;
      varying float vArc;
      varying float vSide;
      vec2 scr(vec4 c) { return (c.xy / c.w) * 0.5 * uRes; }
      void main() {
        mat4 pv = projectionMatrix * modelViewMatrix;
        vec4 c = pv * vec4(position, 1.0);
        vec4 a = pv * vec4(aPrev, 1.0);
        vec4 b = pv * vec4(aNext, 1.0);
        vec2 sc = scr(c), sa = scr(a), sb = scr(b);
        vec2 d1 = sc - sa, d2 = sb - sc;
        if (length(d1) < 1e-4) d1 = d2;
        if (length(d2) < 1e-4) d2 = d1;
        vec2 t1 = normalize(d1 + vec2(1e-6)), t2 = normalize(d2 + vec2(1e-6));
        vec2 tg = normalize(t1 + t2 + vec2(1e-6));
        vec2 nrm = vec2(-tg.y, tg.x);
        float miter = 1.0 / max(0.35, dot(nrm, vec2(-t1.y, t1.x)));
        vec2 off = nrm * aSide * uWidth * 0.5 * miter;
        c.xy += off / (0.5 * uRes) * c.w;
        c.z -= uBias * c.w;
        gl_Position = c;
        vArc = aArc;
        vSide = aSide;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uProg;
      uniform float uLen;
      uniform vec2 uDash;
      varying float vArc;
      varying float vSide;
      void main() {
        if (vArc > uProg * uLen) discard;
        if (uDash.x > 0.0 && mod(vArc, uDash.x + uDash.y) > uDash.x) discard;
        gl_FragColor = vec4(uColor, uOpacity);
      }`,
  });
  const mesh = new T.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  /** move the line (same point count) */
  function setPoints(P) {
    fill(P);
    for (const k of ['position', 'aPrev', 'aNext', 'aArc']) g.attributes[k].needsUpdate = true;
    mat.uniforms.uLen.value = acc;
  }
  return { mesh, mat, length: acc, setPoints, dispose() { g.dispose(); mat.dispose(); } };
}

export function createTicks(T, segs, { color = 0x1a1c1e, opacity = 0.3 } = {}) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(segs.flat(), 3));
  const mat = new T.LineBasicMaterial({ color, transparent: true, opacity, toneMapped: false, depthWrite: false });
  const lines = new T.LineSegments(g, mat);
  lines.renderOrder = 4;
  return { lines, mat, dispose() { g.dispose(); mat.dispose(); } };
}

export function createCone(T, cobalt = 0x2447d6) {
  const edgeG = new T.BufferGeometry();
  edgeG.setAttribute('position', new T.BufferAttribute(new Float32Array(8 * 3), 3));
  const edgeM = new T.LineBasicMaterial({ color: cobalt, transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false });
  const edges = new T.LineSegments(edgeG, edgeM);
  const faceG = new T.BufferGeometry();
  faceG.setAttribute('position', new T.BufferAttribute(new Float32Array(12 * 3), 3));
  const faceM = new T.MeshBasicMaterial({ color: cobalt, transparent: true, opacity: 0.06, toneMapped: false, depthWrite: false, side: T.DoubleSide });
  const faces = new T.Mesh(faceG, faceM);
  edges.frustumCulled = faces.frustumCulled = false;
  edges.renderOrder = 6; faces.renderOrder = 3;
  const group = new T.Group();
  group.add(faces, edges);
  /** apex [x,y,z], corners [[x,y,z] × 4] (in ring order), alpha 0..1 */
  function set(apex, corners, alpha, fillAlpha = 0.06) {
    group.visible = alpha > 0.002;
    if (!group.visible) return;
    const e = edgeG.attributes.position.array, f = faceG.attributes.position.array;
    for (let i = 0; i < 4; i++) {
      e.set(apex, i * 6); e.set(corners[i], i * 6 + 3);
      f.set(apex, i * 9); f.set(corners[i], i * 9 + 3); f.set(corners[(i + 1) % 4], i * 9 + 6);
    }
    edgeG.attributes.position.needsUpdate = true;
    faceG.attributes.position.needsUpdate = true;
    edgeM.opacity = 0.85 * alpha;
    faceM.opacity = fillAlpha * alpha;
  }
  return { group, set, dispose() { edgeG.dispose(); edgeM.dispose(); faceG.dispose(); faceM.dispose(); } };
}
