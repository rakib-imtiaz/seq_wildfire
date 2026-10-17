// Command Table: the DOM over the canvas (steps mode). Everything is driven by 3D screen anchors each
// frame, so it lands on its targets at any size:
//   tags     dark plates with a leader to their anchor; placed beside the anchor away from the nearer
//            edge, nudged so none overlap, kept inside the insets (the site's header, badge and caption
//            card) and off the picture-in-picture
//   layers   step 4's map layers as SVG, in order: infrastructure, patrol route, observation points,
//            hotspot, estimated affected area (stepping through the three SAMPLE times), escalation hatch
//   report   step 5's monitoring report (real text, SAMPLE), thumbnails rendered from the scene, and leader
//            lines from the slab to two tokens: authorized client representatives, relevant emergency
//            authorities (the brief's wording)
// Every readout and timestamp here is SAMPLE data and says so.
import { ZONE } from './zone.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const CSS = /* css */`
.ct-ov { position: absolute; inset: 0; pointer-events: none; z-index: 2; overflow: hidden; contain: layout paint;
  --ct-bone: var(--bone, #ece7e0); --ct-bone2: var(--bone-2, #c9c3bb); --ct-smoke: var(--smoke, #8c8781); --ct-ember: var(--ember, #ff6a1f);
  --ct-plate: rgba(15, 14, 13, 0.86); --ct-line: rgba(236, 231, 224, 0.55); --ct-mono: var(--f-mono, "JetBrains Mono", ui-monospace, Menlo, monospace);
  --ct-display: var(--f-display, "Barlow Condensed", "Arial Narrow", sans-serif); }
.ct-ov svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.ct-lead { fill: none; stroke: var(--ct-line); stroke-width: 1; }
.ct-lead--heat { stroke: rgba(255, 158, 27, 0.8); }
.ct-dot { fill: var(--ct-bone); }
.ct-dot--heat { fill: #ffe6a0; }
.ct-tag { position: absolute; left: 0; top: 0; display: grid; gap: 2px; padding: 5px 9px 6px; background: var(--ct-plate);
  border-left: 1px solid rgba(236, 231, 224, 0.45); color: var(--ct-bone); font: 500 11px/1.25 var(--ct-mono); letter-spacing: 0.04em;
  text-transform: uppercase; white-space: nowrap; font-variant-numeric: tabular-nums; will-change: transform; transition: opacity 0.25s ease; }
.ct-tag__s { color: var(--ct-smoke); font-size: 10px; }
.ct-tag--heat { color: #ffe6a0; border-left-color: #ff9e1b; }
.ct-tag[data-side="l"] { border-left: 0; border-right: 1px solid rgba(236, 231, 224, 0.45); text-align: right; }
.ct-tag--heat[data-side="l"] { border-right-color: #ff9e1b; }
.ct-l-infra { fill: rgba(236, 231, 224, 0.08); stroke: rgba(236, 231, 224, 0.85); stroke-width: 1.2; }
.ct-l-dam { fill: none; stroke: var(--ct-bone); stroke-width: 3; stroke-linecap: round; }
.ct-l-line { fill: none; stroke: rgba(236, 231, 224, 0.6); stroke-width: 1; stroke-dasharray: 1 0; }
.ct-l-tower { fill: var(--ct-bone); }
.ct-l-patrol { fill: none; stroke: var(--ct-ember); stroke-width: 2; stroke-dasharray: 7 4; stroke-linejoin: round; }
.ct-l-obs { fill: var(--ct-bone); stroke: rgba(15, 14, 13, 0.9); stroke-width: 1.2; }
.ct-l-hot { fill: var(--ct-ember); stroke: #ffe6a0; stroke-width: 1.2; }
.ct-l-hotring { fill: none; stroke: var(--ct-ember); stroke-width: 1.2; }
.ct-l-area { fill: rgba(255, 106, 31, 0.24); stroke: #ff8a3d; stroke-width: 1.4; stroke-linejoin: round; }
.ct-l-esc { fill: url(#ct-hatch); stroke: #ff9e1b; stroke-width: 1.1; stroke-dasharray: 4 3; }
.ct-legend { position: absolute; left: 0; top: 0; margin: 0; display: grid; gap: 4px; padding: 8px 10px; background: var(--ct-plate); border-left: 1px solid rgba(236, 231, 224, 0.35);
  font: 500 10px/1.3 var(--ct-mono); letter-spacing: 0.05em; text-transform: uppercase; color: var(--ct-bone2); }
.ct-legend li { list-style: none; display: flex; align-items: center; gap: 8px; opacity: 0.25; transition: opacity 0.3s ease; }
.ct-legend li[data-on] { opacity: 1; color: var(--ct-bone); }
.ct-legend i { display: inline-block; width: 14px; height: 8px; }
.ct-legend b { font-weight: 500; color: var(--ct-smoke); }
.ct-vh { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.ct-report { position: absolute; left: 0; top: 0; display: grid; gap: 10px; padding: 14px 16px 12px; background: rgba(23, 22, 21, 0.96); border: 1px solid rgba(236, 231, 224, 0.16);
  color: var(--ct-bone); font: 400 11px/1.35 var(--ct-mono); letter-spacing: 0.03em; pointer-events: auto; }
.ct-report__head { display: flex; justify-content: space-between; align-items: center; color: var(--ct-smoke); text-transform: uppercase; }
.ct-report__sample { padding: 1px 6px; border: 1px solid var(--ct-ember); color: var(--ct-ember); font-size: 10px; letter-spacing: 0.08em; }
.ct-report__title { font: 700 20px/1 var(--ct-display); text-transform: uppercase; letter-spacing: 0.01em; }
.ct-report__thumbs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.ct-report__thumbs figure { margin: 0; display: grid; gap: 3px; }
.ct-report__thumbs canvas, .ct-report__thumbs img { width: 100%; aspect-ratio: 16 / 10; display: block; background: #0f0e0d; box-shadow: 0 0 0 1px rgba(236, 231, 224, 0.12); }
.ct-report__thumbs figcaption { color: var(--ct-smoke); font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.06em; }
.ct-report dl { display: grid; margin: 0; border-top: 1px solid rgba(236, 231, 224, 0.1); }
.ct-report dl div { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; border-bottom: 1px solid rgba(236, 231, 224, 0.08); }
.ct-report dt { color: var(--ct-smoke); text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; }
.ct-report dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
.ct-report__fu { color: var(--ct-bone2); }
.ct-report [data-r] { opacity: 0; transform: translateY(4px); transition: opacity 0.35s ease, transform 0.35s ease; }
.ct-report [data-r][data-on] { opacity: 1; transform: none; }
.ct-token { position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: 9px; padding: 7px 11px 7px 8px; background: var(--ct-plate);
  border: 1px solid rgba(236, 231, 224, 0.22); color: var(--ct-bone); font: 500 10.5px/1.25 var(--ct-mono); letter-spacing: 0.05em; text-transform: uppercase; max-width: 210px; }
.ct-token svg { position: static; width: 22px; height: 22px; flex: 0 0 auto; stroke: var(--ct-bone); fill: none; stroke-width: 1.3; }
.ct-tokline { fill: none; stroke: rgba(236, 231, 224, 0.6); stroke-width: 1; stroke-dasharray: 3 3; }
.ct-report--compact .ct-report__thumbs, .ct-report--compact dl div:nth-child(n+5) { display: none; }
.ct-report--min dl div:nth-child(n+3) { display: none; }
@media (max-width: 599px) {
  .ct-tag { font-size: 10px; padding: 4px 7px 5px; }
  .ct-report { gap: 7px; padding: 10px 11px 9px; font-size: 10px; }
  .ct-report__title { font-size: 16px; }
  .ct-report dl div { padding: 3px 0; }
  .ct-token { font-size: 9.5px; padding: 5px 8px 5px 6px; max-width: 160px; }
  .ct-token svg { width: 18px; height: 18px; }
}
html[data-motion="off"] .ct-ov *, .ct-ov[data-still] * { transition: none !important; animation: none !important; }
`;

function ensureStyles() {
  if (document.getElementById('ct-ov-style')) return;
  const s = document.createElement('style'); s.id = 'ct-ov-style'; s.textContent = CSS; document.head.appendChild(s);
}
const el = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; };
const sv = (tag, attrs, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const pathD = (pts) => pts.length ? 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') : '';

const ICON_CLIENT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/></svg>';
const ICON_AUTH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>';

export class Overlay {
  constructor(container, { still = false } = {}) {
    ensureStyles();
    this.root = el('div', 'ct-ov', null);
    if (still) this.root.setAttribute('data-still', '');
    this.svg = sv('svg', { 'aria-hidden': 'true' }, this.root);
    const defs = sv('defs', {}, this.svg);
    const pat = sv('pattern', { id: 'ct-hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    sv('rect', { width: 7, height: 7, fill: 'rgba(255, 158, 27, 0.06)' }, pat);
    sv('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: 'rgba(255, 158, 27, 0.75)', 'stroke-width': 1.4 }, pat);
    this.gLayers = sv('g', {}, this.svg);
    this.gLeads = sv('g', {}, this.svg);
    this.tags = new Map();
    this.insets = { top: 64, bottom: 12, left: 10, right: 10 };
    container.appendChild(this.root);
    this.buildLayers();
    this.buildReport();
    this.w = 1; this.h = 1;
  }

  setInsets(o) { Object.assign(this.insets, o); }

  /* ------------------------------------------------------------- tags */
  tag(id) {
    let t = this.tags.get(id);
    if (!t) {
      const e = el('div', 'ct-tag', this.root);
      e.setAttribute('aria-hidden', 'true');
      const a = el('span', 'ct-tag__t', e), b = el('span', 'ct-tag__s', e);
      const lead = sv('path', { class: 'ct-lead' }, this.gLeads), dot = sv('circle', { r: 2.2, class: 'ct-dot' }, this.gLeads);
      t = { e, a, b, lead, dot, w: 0, h: 0, text: '', sub: '' };
      this.tags.set(id, t);
    }
    return t;
  }

  placeTags(labels, project, avoid) {
    const { top, bottom, left, right } = this.insets, W = this.w, H = this.h;
    const used = [];
    const placed = [];
    for (const L of labels) {
      const q = project(L.anchor);
      if (!q || q.x < -20 || q.x > W + 20 || q.y < top - 10 || q.y > H - bottom + 10) continue;
      const t = this.tag(L.id);
      if (t.text !== L.text) { t.a.textContent = L.text; t.text = L.text; t.w = 0; }
      if (t.sub !== (L.sub || '')) { t.b.textContent = L.sub || ''; t.sub = L.sub || ''; t.w = 0; }
      t.e.classList.toggle('ct-tag--heat', !!L.heat);
      t.lead.setAttribute('class', 'ct-lead' + (L.heat ? ' ct-lead--heat' : ''));
      t.dot.setAttribute('class', 'ct-dot' + (L.heat ? ' ct-dot--heat' : ''));
      if (!t.w) { t.w = t.e.offsetWidth; t.h = t.e.offsetHeight; }
      placed.push({ L, t, q });
    }
    placed.sort((a, b) => a.q.y - b.q.y);
    for (const P of placed) {
      const { t, q } = P;
      const side = q.x > W * 0.6 ? 'l' : 'r';
      let x = side === 'r' ? q.x + 26 : q.x - 26 - t.w;
      let y = q.y - 34 - t.h * 0.5;
      x = Math.min(Math.max(x, left), W - right - t.w);
      y = Math.min(Math.max(y, top), H - bottom - t.h);
      const boxes = [...used, ...(avoid || [])];
      for (let it = 0; it < 6; it++) {
        const hit = boxes.find((b) => x < b.x + b.w + 6 && x + t.w + 6 > b.x && y < b.y + b.h + 6 && y + t.h + 6 > b.y);
        if (!hit) break;
        y = hit.y + hit.h + 8;
        if (y + t.h > H - bottom) { y = hit.y - t.h - 8; }
      }
      y = Math.min(Math.max(y, top), H - bottom - t.h);
      used.push({ x, y, w: t.w, h: t.h });
      t.e.dataset.side = side;
      t.e.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      t.e.style.opacity = '1';
      const ex = side === 'r' ? x : x + t.w, ey = y + t.h * 0.5;
      const mx = ex + (side === 'r' ? -10 : 10);
      t.lead.setAttribute('d', `M${q.x.toFixed(1)} ${q.y.toFixed(1)}L${mx.toFixed(1)} ${ey.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}`);
      t.dot.setAttribute('cx', q.x.toFixed(1)); t.dot.setAttribute('cy', q.y.toFixed(1));
      t.lead.style.opacity = t.dot.style.opacity = '1';
      P.done = true;
    }
    const live = new Set(placed.map((P) => P.L.id));
    for (const [id, t] of this.tags) if (!live.has(id)) { t.e.style.opacity = '0'; t.lead.style.opacity = t.dot.style.opacity = '0'; }
  }

  /* ------------------------------------------------------------- S4 layers */
  buildLayers() {
    const g = this.gLayers;
    this.L = {
      area: sv('path', { class: 'ct-l-area' }, g),
      esc: sv('path', { class: 'ct-l-esc' }, g),
      line: sv('path', { class: 'ct-l-line' }, g),
      boxes: [0, 1, 2].map(() => sv('path', { class: 'ct-l-infra' }, g)),
      dam: sv('path', { class: 'ct-l-dam' }, g),
      towers: ZONE.towers.map(() => sv('rect', { class: 'ct-l-tower', width: 4, height: 4 }, g)),
      patrol: sv('path', { class: 'ct-l-patrol' }, g),
      obs: ZONE.observations.map(() => sv('circle', { class: 'ct-l-obs', r: 3.6 }, g)),
      hotring: sv('circle', { class: 'ct-l-hotring', r: 13 }, g),
      hot: sv('circle', { class: 'ct-l-hot', r: 5.5 }, g),
    };
    this.legend = el('ul', 'ct-legend', this.root);
    this.legend.setAttribute('aria-hidden', 'true');
    const items = [
      ['Infrastructure', 'background: transparent; box-shadow: inset 0 0 0 1px #ece7e0'],
      ['Patrol route', 'background: repeating-linear-gradient(90deg, #ff6a1f 0 5px, transparent 5px 8px); height: 2px'],
      ['Observation points', 'background: #ece7e0; width: 7px; height: 7px; border-radius: 50%'],
      ['Hotspot', 'background: #ff6a1f; width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 0 2px rgba(255,230,160,.6)'],
      ['Estimated affected area', 'background: rgba(255,106,31,.35); box-shadow: inset 0 0 0 1px #ff8a3d'],
      ['Escalation', 'background: repeating-linear-gradient(45deg, #ff9e1b 0 1.5px, transparent 1.5px 4px); box-shadow: inset 0 0 0 1px #ff9e1b'],
    ];
    this.legendItems = items.map(([t, css]) => { const li = el('li', '', this.legend); const i = el('i', '', li); i.style.cssText = css; li.appendChild(document.createTextNode(t)); return li; });
    const sample = el('li', '', this.legend); sample.innerHTML = '<b>Sample data · fictional zone</b>'; sample.dataset.on = '';
    this.legendSample = sample;
    this.legend.style.opacity = '0';
  }

  drawLayers(S, layers, project) {
    const L = this.L;
    const show = (node, a) => { node.style.opacity = a.toFixed(3); };
    if (!layers || layers.fade <= 0.001) {
      this.gLayers.style.opacity = '0'; this.legend.style.opacity = '0';
      return;
    }
    const p = layers.p, f = layers.fade;
    this.gLayers.style.opacity = f.toFixed(3);
    const pts = (arr) => arr.map((v) => { const q = project(v); return q ? [q.x, q.y] : [0, 0]; });
    const a = { infra: sm(0, 0.12, p), patrol: sm(0.1, 0.28, p), obs: sm(0.26, 0.36, p), hot: sm(0.34, 0.42, p), area: sm(0.4, 0.5, p), esc: sm(0.78, 0.88, p) };
    // infrastructure
    const infra = S.layers.infra;
    L.dam.setAttribute('d', pathD(pts(infra[0].pts))); show(L.dam, a.infra);
    for (let i = 0; i < 3; i++) { L.boxes[i].setAttribute('d', pathD(pts(infra[i + 1].pts)) + 'Z'); show(L.boxes[i], a.infra); }
    L.line.setAttribute('d', pathD(pts(infra[4].pts))); show(L.line, a.infra * 0.9);
    S.layers.towers.forEach((v, i) => { const q = project(v); if (q) { L.towers[i].setAttribute('x', (q.x - 2).toFixed(1)); L.towers[i].setAttribute('y', (q.y - 2).toFixed(1)); } show(L.towers[i], a.infra); });
    // patrol: drawn along its length
    const pp = pts(S.layers.patrol);
    const nDraw = Math.max(0, Math.round(pp.length * a.patrol));
    L.patrol.setAttribute('d', pathD(pp.slice(0, Math.max(2, nDraw)))); show(L.patrol, a.patrol > 0.01 ? 1 : 0);
    // observation points, one after another
    S.layers.obs.forEach((v, i) => { const q = project(v); if (q) { L.obs[i].setAttribute('cx', q.x.toFixed(1)); L.obs[i].setAttribute('cy', q.y.toFixed(1)); } show(L.obs[i], sm(0.26 + i * 0.018, 0.3 + i * 0.018, p)); });
    // hotspot
    const qh = project(S.layers.hot);
    if (qh) for (const c of [L.hot, L.hotring]) { c.setAttribute('cx', qh.x.toFixed(1)); c.setAttribute('cy', qh.y.toFixed(1)); }
    show(L.hot, a.hot); show(L.hotring, a.hot * 0.8);
    // affected area: steps through the three sample times
    const idx = p < 0.62 ? 0 : p < 0.74 ? 1 : 2;
    L.area.setAttribute('d', pathD(pts(S.layers.perimeters[idx].pts)) + 'Z'); show(L.area, a.area);
    this.areaTime = a.area > 0.5 ? S.layers.perimeters[idx].t : null;
    // escalation hatch
    L.esc.setAttribute('d', pathD(pts(S.layers.escalation)) + 'Z'); show(L.esc, a.esc);
    // legend
    const on = [a.infra, a.patrol, a.obs, a.hot, a.area, a.esc];
    this.legendItems.forEach((li, i) => li.toggleAttribute('data-on', on[i] > 0.5));
    this.legend.style.opacity = f.toFixed(3);
  }

  /* ------------------------------------------------------------- S5 report */
  buildReport() {
    const r = el('section', 'ct-report', this.root);
    r.setAttribute('aria-label', 'Sample monitoring report');
    r.removeAttribute('aria-hidden');
    r.innerHTML = `
      <div class="ct-report__head" data-r><span>Monitoring report</span><span class="ct-report__sample">Sample</span></div>
      <p class="ct-report__title" data-r>${ZONE.name}</p>
      <div class="ct-report__thumbs" data-r>
        <figure><span data-thumb="thermal"></span><figcaption>Thermal · geotagged</figcaption></figure>
        <figure><span data-thumb="map"></span><figcaption>Map · 6 layers</figcaption></figure>
      </div>
      <p class="ct-vh" data-r>Shared with authorized client representatives and relevant emergency authorities through established procedures.</p>
      <dl>
        <div data-r><dt>Flight record</dt><dd>FLT-07 · M3T</dd></div>
        <div data-r><dt>Thermal observation</dt><dd>1 hotspot · Max ${ZONE.hotspot.peakC} °C</dd></div>
        <div data-r><dt>Incident location</dt><dd>E +${String(ZONE.hotspot.x).padStart(4, '0')} N +${String(-ZONE.hotspot.z).padStart(4, '0')}</dd></div>
        <div data-r><dt>Timestamps</dt><dd>${ZONE.checkpoints[0].t} to ${ZONE.checkpoints[ZONE.checkpoints.length - 1].t}</dd></div>
        <div data-r><dt>Follow-up</dt><dd class="ct-report__fu">Additional monitoring</dd></div>
      </dl>`;
    this.report = r;
    this.reportRows = [...r.querySelectorAll('[data-r]')];
    this.tokens = [
      ['Authorized client representatives', ICON_CLIENT],
      ['Relevant emergency authorities', ICON_AUTH],
    ].map(([t, icon]) => { const e = el('div', 'ct-token', this.root); e.setAttribute('aria-hidden', 'true'); e.innerHTML = `${icon}<span>${t}</span>`; return e; });
    this.tokLines = [0, 1].map(() => sv('path', { class: 'ct-tokline' }, this.gLeads));
    this.report.style.opacity = '0';
    this.tokens.forEach((t) => (t.style.opacity = '0'));
    this.report.setAttribute('aria-hidden', 'true');
  }

  setThumbs(thermal, map) {
    for (const [k, c] of [['thermal', thermal], ['map', map]]) {
      const slot = this.report.querySelector(`[data-thumb="${k}"]`);
      if (slot && c && !slot.firstChild) slot.appendChild(c);
    }
  }

  drawReport(report, project, slabAnchor) {
    const W = this.w, H = this.h, { top, bottom } = this.insets;
    if (!report) {
      this.report.style.opacity = '0'; this.report.setAttribute('aria-hidden', 'true');
      this.tokens.forEach((t) => (t.style.opacity = '0')); this.tokLines.forEach((l) => (l.style.opacity = '0'));
      return;
    }
    const p = report.p;
    this.report.removeAttribute('aria-hidden');
    const narrow = W < 640 || bottom > H * 0.25;               // phones, and tablets with the caption card over the view
    const cw = narrow ? Math.min(W - 20, 360) : Math.min(330, W * 0.4);
    this.report.style.width = cw + 'px';
    let x, y, ch, pos;
    const tw = this.tokens.map((t) => t.offsetWidth), th = this.tokens.map((t) => t.offsetHeight);
    if (narrow) {
      // phones: the slab in a band at the top, the two tokens in a row under it, the report under them; the
      // report sheds its thumbnails, then rows, until it fits above the caption card
      const half = (W - 30) / 2;
      this.tokens.forEach((t) => (t.style.maxWidth = half + 'px'));
      const tw2 = this.tokens.map((t) => t.offsetWidth), th2 = Math.max(...this.tokens.map((t) => t.offsetHeight));
      const ty = Math.max(top + 4, H * 0.3);
      pos = [[10, ty], [W - 10 - tw2[1], ty]];
      y = ty + th2 + 10; x = (W - cw) / 2;
      const room = H - bottom - y;
      this.report.classList.remove('ct-report--compact', 'ct-report--min');
      ch = this.report.offsetHeight;
      if (ch > room) { this.report.classList.add('ct-report--compact'); ch = this.report.offsetHeight; }
      if (ch > room) { this.report.classList.add('ct-report--min'); ch = this.report.offsetHeight; }
      if (ch > room) {                                   // still short: slide the tokens and report up into the slab band
        const up = Math.min(ch - room, ty - (top + 4));
        pos = pos.map(([px, py]) => [px, py - up]); y -= up;
      }
      th[0] = th[1] = th2;
    } else {
      this.tokens.forEach((t) => (t.style.maxWidth = ''));
      ch = this.report.offsetHeight;
      x = W - cw - Math.max(20, W * 0.04); y = Math.max(top, (H - ch) / 2 - 30);
      pos = [[x, y + ch + 22], [x, y + ch + 30 + th[0]]];
    }
    this.report.style.transform = `translate(${x.toFixed(1)}px, ${(y + 10 * (1 - sm(0, 0.25, p))).toFixed(1)}px)`;
    this.report.style.opacity = sm(0, 0.22, p).toFixed(3);
    this.reportRows.forEach((r, i) => r.toggleAttribute('data-on', p > 0.12 + i * 0.05));
    // leaders from the slab to each token
    const s = slabAnchor ? project(slabAnchor) : null;
    this.tokens.forEach((t, i) => {
      t.style.transform = `translate(${pos[i][0].toFixed(1)}px, ${pos[i][1].toFixed(1)}px)`;
      t.style.opacity = sm(0.55 + i * 0.08, 0.75 + i * 0.08, p).toFixed(3);
      const l = this.tokLines[i];
      if (s) {
        const ex = narrow ? pos[i][0] + t.offsetWidth / 2 : pos[i][0], ey = narrow ? pos[i][1] : pos[i][1] + th[i] / 2;
        const mx = (s.x + ex) / 2, my = (s.y + ey) / 2;
        l.setAttribute('d', narrow
          ? `M${s.x.toFixed(1)} ${s.y.toFixed(1)}C${s.x.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`
          : `M${s.x.toFixed(1)} ${s.y.toFixed(1)}C${mx.toFixed(1)} ${s.y.toFixed(1)} ${mx.toFixed(1)} ${ey.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
        const len = l.getTotalLength ? l.getTotalLength() : 600;
        const d = sm(0.4 + i * 0.08, 0.7 + i * 0.08, p);
        l.style.strokeDasharray = `${(len * d).toFixed(1)} ${len.toFixed(1)}`;
        l.style.opacity = d > 0.001 ? '1' : '0';
      } else l.style.opacity = '0';
    });
  }

  /** One frame. frame: { w, h, project, labels, layers, report, story, pipRect, slabAnchor } */
  update(f) {
    this.w = f.w; this.h = f.h;
    const avoid = [];
    if (f.pipRect) avoid.push(f.pipRect);
    const stacked = f.w < 640 || this.insets.bottom > f.h * 0.25;
    this.legend.style.display = f.w < 640 ? 'none' : '';
    if (f.layers && f.layers.fade > 0.01 && f.w >= 640) {
      this.legend.style.transform = '';
      const lw = this.legend.offsetWidth, lh = this.legend.offsetHeight;
      const lx = f.w - lw - Math.max(12, this.insets.right), ly = stacked ? this.insets.top : Math.max(this.insets.top, f.h - this.insets.bottom - lh - 12);
      this.legend.style.left = '0px'; this.legend.style.top = '0px';
      this.legend.style.transform = `translate(${lx}px, ${ly}px)`;
      avoid.push({ x: lx, y: ly, w: lw, h: lh });
    }
    this.drawLayers(f.story, f.layers, f.project);
    const labels = [...(f.labels || [])];
    if (f.layers && f.layers.fade > 0.5) {
      labels.push({ id: 'm-dam', anchor: f.story.layers.dam, text: 'Dam', sub: 'Infrastructure' });
      labels.push({ id: 'm-sub', anchor: f.story.layers.substation, text: 'Substation', sub: 'Infrastructure' });
      if (this.areaTime) labels.push({ id: 'm-area', anchor: f.story.layers.hot, text: `Affected area ${this.areaTime}`, sub: 'Sample estimate', heat: true });
    }
    if (f.report) {
      const rr = this.report.getBoundingClientRect(), base = this.root.getBoundingClientRect();
      avoid.push({ x: rr.left - base.left, y: rr.top - base.top, w: rr.width, h: rr.height + 90 });
    }
    this.placeTags(labels, f.project, avoid);
    this.drawReport(f.report, f.project, f.slabAnchor);
  }

  /**
   * Paint the overlay onto a 2D canvas (stills for the lite tier): the SVG (layers, leaders) with its styles
   * inlined, then the label plates and the legend as canvas text. The report and its tokens are left out (the
   * page shows a static report card over the step 5 still).
   */
  async paintTo(ctx, scale = 1) {
    const PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity'];
    const clone = this.svg.cloneNode(true);
    const src = [this.svg, ...this.svg.querySelectorAll('*')], dst = [clone, ...clone.querySelectorAll('*')];
    src.forEach((n, i) => {
      if (n.classList && n.classList.contains('ct-tokline')) { dst[i].setAttribute('style', 'display:none'); return; }
      const cs = getComputedStyle(n);
      dst[i].setAttribute('style', PROPS.map((k) => `${k}:${cs.getPropertyValue(k)}`).join(';') + ';opacity:' + (n.style.opacity || cs.opacity));
    });
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', this.w); clone.setAttribute('height', this.h);
    clone.setAttribute('viewBox', `0 0 ${this.w} ${this.h}`);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    await img.decode();
    ctx.drawImage(img, 0, 0, this.w * scale, this.h * scale);
    const box = this.root.getBoundingClientRect();
    const plate = (e, lines) => {
      if (Number(e.style.opacity || getComputedStyle(e).opacity) < 0.5) return;
      const r = e.getBoundingClientRect();
      const x = (r.left - box.left) * scale, y = (r.top - box.top) * scale, w = r.width * scale, h = r.height * scale;
      ctx.fillStyle = 'rgba(15, 14, 13, 0.86)'; ctx.fillRect(x, y, w, h);
      const right = e.dataset.side === 'l';
      ctx.fillStyle = e.classList.contains('ct-tag--heat') ? '#ff9e1b' : 'rgba(236, 231, 224, 0.45)';
      ctx.fillRect(right ? x + w - scale : x, y, scale, h);
      lines(x, y, w, h, right);
    };
    for (const t of this.tags.values()) {
      plate(t.e, (x, y, w, h, right) => {
        ctx.textBaseline = 'top'; ctx.textAlign = right ? 'right' : 'left';
        const tx = right ? x + w - 9 * scale : x + 9 * scale;
        ctx.font = `500 ${11 * scale}px "JetBrains Mono", ui-monospace, monospace`;
        ctx.fillStyle = t.e.classList.contains('ct-tag--heat') ? '#ffe6a0' : '#ece7e0';
        ctx.fillText(t.text.toUpperCase(), tx, y + 5 * scale);
        ctx.font = `500 ${10 * scale}px "JetBrains Mono", ui-monospace, monospace`;
        ctx.fillStyle = '#8c8781';
        if (t.sub) ctx.fillText(t.sub.toUpperCase(), tx, y + 20 * scale);
      });
    }
    if (Number(this.legend.style.opacity) > 0.5 && this.legend.style.display !== 'none') {
      plate(this.legend, (x, y) => {
        ctx.textBaseline = 'top'; ctx.textAlign = 'left';
        ctx.font = `500 ${10 * scale}px "JetBrains Mono", ui-monospace, monospace`;
        [...this.legend.querySelectorAll('li')].forEach((li, i) => {
          ctx.fillStyle = li.hasAttribute('data-on') ? '#ece7e0' : 'rgba(201, 195, 187, 0.3)';
          ctx.fillText(li.textContent.toUpperCase(), x + (i < 6 ? 32 : 10) * scale, y + (8 + i * 17) * scale);
          const sw = li.querySelector('i');
          if (sw) { ctx.fillStyle = ['#ece7e0', '#ff6a1f', '#ece7e0', '#ff6a1f', 'rgba(255,106,31,.6)', '#ff9e1b'][i]; ctx.fillRect(x + 10 * scale, y + (10 + i * 17) * scale, 14 * scale, 6 * scale); }
        });
      });
    }
  }

  dispose() { this.root.remove(); }
}
