import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CTA_SHORT, HERO } from "../data/copy";
import { Arrow } from "../components/Motifs";
import { clamp, motionOn } from "../lib/motion";
import { mountTableInto, safe, TABLE_STILLS, type HeroStillData, type HeroVariant, type Insets, type LensReadout, type TableHandle } from "../lib/table3d";
import { useZone } from "../lib/zone";
import "../styles/hero.css";

type Variant = HeroVariant;

/** The desktop hero layout (stage fills the hero, copy bottom-left): the CSS breakpoint, not the stage's width
 *  (a scrollbar makes the stage narrower than the viewport the media query sees). */
const isDesk = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

/** Which rendered still matches the live hero framing at this stage size (desktop: by aspect, the copy bottom-left). */
const variantFor = (w: number, h: number, desk = isDesk()): Variant => {
  const a = w / Math.max(1, h);
  if (desk) return a >= 1.3 ? "desk" : a >= 0.85 ? "sq" : "tall";
  return a >= 1.2 ? "tab" : "phone";
};

type Pt = { x: number; y: number };
/** A usable screen point (0..1 of the stage): finite and on the stage. */
const onStage = (p?: Pt | null): p is Pt => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > 0.02 && p.x < 0.98 && p.y > 0.02 && p.y < 0.98;

/** The lens ring's radius (px) for a stage width. */
const lensRadius = (w: number, desk = isDesk()) => (desk ? clamp(w * 0.062, 62, 140) : clamp(w * 0.12, 42, 88));

/** object-fit: cover mapping from image fractions to stage px. */
function coverMap(W: number, H: number, iw: number, ih: number) {
  const s = Math.max(W / iw, H / ih);
  const ox = (W - iw * s) / 2;
  const oy = (H - ih * s) / 2;
  return {
    toStage: (fx: number, fy: number): [number, number] => [ox + fx * iw * s, oy + fy * ih * s],
    toImage: (x: number, y: number): [number, number] => [(x - ox) / (iw * s), (y - oy) / (ih * s)],
    scale: s,
  };
}

const fmtGrid = (v: number) => (v < 0 ? "−" : "+") + String(Math.abs(Math.round(v))).padStart(4, "0");

/**
 * The 3D command-table hero. Optional slots for the hero review variants (?hero=2 / ?hero=3):
 * `backdrop` renders behind the stage, `actions` after the CTAs, `className` on the section.
 */
export function Hero({ backdrop, actions, className = "" }: { backdrop?: ReactNode; actions?: ReactNode; className?: string } = {}) {
  const zone = useZone();
  const stageRef = useRef<HTMLDivElement>(null);
  const slot3dRef = useRef<HTMLDivElement>(null);
  const maxRef = useRef<HTMLElement>(null);
  const eRef = useRef<HTMLSpanElement>(null);
  const nRef = useRef<HTMLSpanElement>(null);
  const lrRef = useRef(110);
  const inwardRef = useRef<Pt | null>(null);
  const insetsKey = useRef("");
  const pointer = useRef({ x: 0, y: 0, user: false, last: 0 });
  const handle = useRef<TableHandle | null>(null);
  const live3d = useRef(false);
  const inView = useRef(true);
  const stillData = useRef<HeroStillData | null>(null);
  const [variant, setVariant] = useState<Variant>(() =>
    typeof window === "undefined" ? "desk" : variantFor(window.innerWidth, isDesk() ? window.innerHeight : 440),
  );
  const [isLive, setIsLive] = useState(false);
  const [drawn, setDrawn] = useState(false);

  const reported = useRef(false); // the 3D has sent at least one readout through onLens
  const clearReadout = useCallback(() => {
    if (maxRef.current) maxRef.current.textContent = "---.-";
    if (eRef.current) eRef.current.textContent = "-----";
    if (nRef.current) nRef.current.textContent = "-----";
  }, []);

  const writeReadout = useCallback((r: LensReadout) => {
    if (r.maxC !== undefined && maxRef.current) maxRef.current.textContent = r.maxC.toFixed(1);
    if (r.e !== undefined && eRef.current) eRef.current.textContent = fmtGrid(r.e);
    if (r.n !== undefined && nRef.current) nRef.current.textContent = fmtGrid(r.n);
  }, []);

  /** The stills' readout: the SAMPLE field maxima of the grid cells under the lens (rendered from the 3D field). */
  const stillReadout = useCallback((x: number, y: number, lr: number): LensReadout | null => {
    const d = stillData.current;
    const st = stageRef.current;
    if (!d || !st) return null;
    const W = st.clientWidth;
    const H = st.clientHeight;
    const map = coverMap(W, H, d.w, d.h);
    const { cols, rows, maxC, e, n } = d.grid;
    let best = -Infinity;
    let cell = -1;
    let cellD = Infinity;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const [cx, cy] = map.toStage((i + 0.5) / cols, (j + 0.5) / rows);
        const dd = Math.hypot(cx - x, cy - y);
        const k = j * cols + i;
        if (dd <= lr && maxC[k] !== null && maxC[k] > best) best = maxC[k];
        if (dd < cellD && e[k] !== null) {
          cellD = dd;
          cell = k;
        }
      }
    }
    const out: LensReadout = {};
    if (best > -Infinity) out.maxC = best;
    if (cell >= 0) {
      out.e = e[cell] as number;
      out.n = n[cell] as number;
    }
    return out;
  }, []);

  const applyLens = useCallback(
    (x: number, y: number, active: boolean) => {
      const st = stageRef.current;
      if (!st) return;
      const w = st.clientWidth;
      const h = st.clientHeight;
      const lr = lrRef.current;
      // keep the whole ring inside the stage and clear of the fixed header (desktop stage runs under it)
      const top = (isDesk() ? 76 : 0) + lr + 8;
      x = clamp(x, lr + 8, w - lr - 8);
      y = clamp(y, top, Math.max(top, h - lr - 8));
      st.style.setProperty("--lx", `${x.toFixed(1)}px`);
      st.style.setProperty("--ly", `${y.toFixed(1)}px`);
      st.style.setProperty("--lr", `${lr.toFixed(1)}px`);
      st.toggleAttribute("data-flip", x > w - lr - 230);
      st.toggleAttribute("data-lens", active);
      const hnd = handle.current;
      if (live3d.current) {
        const res = hnd?.setLens ? safe(() => hnd.setLens!({ x: x / w, y: y / h, r: lr / w, active })) : undefined;
        if (res) writeReadout(res);
        else if (!reported.current) clearReadout();
        return;
      }
      const s = stillReadout(x, y, lr);
      if (s) writeReadout(s);
    },
    [writeReadout, clearReadout, stillReadout],
  );

  /**
   * Where the lens rests: over the hidden hotspot, a little off-centre toward the slab's interior (the 3D says
   * where: clear of the cut edges). A 3D answer that is not usable yet (no size, NaN, off stage, hidden) falls
   * back to the still's hotspot.
   */
  const restPoint = useCallback((): [number, number] => {
    const st = stageRef.current;
    const w = st?.clientWidth || 1200;
    const h = st?.clientHeight || 800;
    const lr = lrRef.current;
    if (live3d.current) {
      const hp = handle.current?.getHotspot ? safe(() => handle.current!.getHotspot!()) : null;
      if (hp && hp.visible !== false && onStage(hp)) {
        const r = onStage(hp.rest) ? hp.rest : { x: hp.x - (lr * 0.22) / w, y: hp.y };
        inwardRef.current = hp.inward ?? null;
        return [r.x * w, r.y * h];
      }
    }
    const d = stillData.current;
    if (d) {
      const map = coverMap(w, h, d.w, d.h);
      const r = d.rest ?? d.hotspot;
      const [x, y] = map.toStage(r.x, r.y);
      if (Number.isFinite(x) && Number.isFinite(y) && x > 0 && x < w && y > 0 && y < h) {
        inwardRef.current = d.inward ?? null;
        return d.rest ? [x, y] : [x - lr * 0.22, y];
      }
    }
    return [isDesk() ? w * 0.72 : w * 0.62, h * 0.5];
  }, []);

  /** Tell the 3D where the copy block and header are (desktop), so the slab is framed clear of them. */
  const pushInsets = useCallback(() => {
    const st = stageRef.current;
    const hnd = handle.current;
    if (!st || !hnd?.setInsets) return;
    const lens = Math.round(lrRef.current);
    let ins: Insets = { top: 0, avoid: null, lens, margin: st.clientWidth < 600 ? 18 : 32, leftLimit: 0 };
    if (isDesk()) {
      const sr = st.getBoundingClientRect();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      st.parentElement?.querySelectorAll(".hero__copy > *:not(.hero__ctas), .hero__ctas > *").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
      });
      const header = document.querySelector("header")?.getBoundingClientRect().bottom ?? 76;
      ins = {
        top: Math.max(0, Math.round(header - sr.top)),
        // (the copy may still be easing in from below: reach a little higher than measured)
        avoid: x1 > x0 ? [Math.round(x0 - sr.left), Math.round(y0 - sr.top - 28), Math.round(x1 - sr.left), Math.round(y1 - sr.top)] : null,
        lens,
        // the look-dev frame: the slab whole in the right 56 %, 40 px clear of every edge
        margin: 40,
        leftLimit: 0.44,
      };
    }
    const key = JSON.stringify(ins);
    if (key === insetsKey.current) return;
    insetsKey.current = key;
    safe(() => hnd.setInsets!(ins));
    // the framing just changed: the lens follows the hotspot to its new place (unless the visitor holds it)
    requestAnimationFrame(() => {
      if (pointer.current.user || !live3d.current) return;
      const [rx, ry] = cb.current.restPoint();
      cb.current.applyLens(rx, ry, true);
    });
  }, []);

  // stage size → the matching still variant and lens radius; load that still's readout data
  useEffect(() => {
    const st = stageRef.current;
    if (!st) return;
    let tm = 0;
    let lastV: Variant | null = null;
    const measure = () => {
      const w = st.clientWidth;
      const h = st.clientHeight;
      if (w < 10 || h < 10) return;
      lrRef.current = lensRadius(w);
      pushInsets();
      const v = variantFor(w, h);
      setVariant(v);
      if (v !== lastV) {
        lastV = v;
        stillData.current = null;
        fetch(TABLE_STILLS.heroData(v))
          .then((r) => (r.ok ? r.json() : null))
          .then((d: HeroStillData | null) => {
            if (lastV !== v) return;
            stillData.current = d;
            if (!pointer.current.user) {
              const [rx, ry] = restPoint();
              applyLens(rx, ry, true);
            }
          })
          .catch(() => {});
      }
      if (!pointer.current.user) {
        const [rx, ry] = restPoint();
        applyLens(rx, ry, true);
      }
    };
    const first = window.setTimeout(measure, 0);
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            window.clearTimeout(tm);
            tm = window.setTimeout(measure, 120);
          })
        : null;
    ro?.observe(st);
    const copy = st.parentElement?.querySelector(".hero__copy");
    if (copy) ro?.observe(copy);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(tm);
      ro?.disconnect();
    };
  }, [applyLens, restPoint, pushInsets]);

  // idle sweep (parks on the hotspot when motion is off)
  useEffect(() => {
    if (!zone || !motionOn()) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!inView.current || document.hidden) return;
      const p = pointer.current;
      if (p.user && now - p.last < 2600) return;
      p.user = false;
      // a slow drift from the rest point into the slab and along it (never out over the cut edge)
      const [hx, hy] = restPoint();
      const lr = lrRef.current;
      const t = (now - t0) / 1000;
      const iw = inwardRef.current ?? { x: -1, y: 0 };
      const a = 0.5 - 0.5 * Math.cos(t * 0.31);
      const b = Math.sin(t * 0.47 + 0.9);
      const x = hx + iw.x * lr * 0.95 * a - iw.y * lr * 0.5 * b;
      const y = hy + iw.y * lr * 0.95 * a + iw.x * lr * 0.5 * b;
      applyLens(x, y, true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [zone, applyLens, restPoint]);

  // pause work when the hero is off screen
  useEffect(() => {
    const st = stageRef.current;
    if (!st || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => (inView.current = e.isIntersecting));
    io.observe(st);
    return () => io.disconnect();
  }, []);

  // latest callbacks for the one-time 3D mount below
  const cb = useRef({ applyLens, restPoint, writeReadout, pushInsets });
  cb.current = { applyLens, restPoint, writeReadout, pushInsets };

  // mount the WebGL table when (if) it exists; the poster stills stay until it has drawn
  useEffect(() => {
    const el = slot3dRef.current;
    if (!el) return;
    return mountTableInto(
      el,
      {
        mode: "hero",
        onReady: () => {
          live3d.current = true;
          setIsLive(true);
          // park now, and again once the first frames are out (the 3D's framing settles with its size and insets)
          const park = () => {
            if (pointer.current.user) return;
            const [rx, ry] = cb.current.restPoint();
            cb.current.applyLens(rx, ry, true);
          };
          park();
          requestAnimationFrame(() => requestAnimationFrame(park));
          window.setTimeout(park, 450);
          window.setTimeout(park, 1400);
        },
        onLens: (r) => {
          reported.current = true;
          cb.current.writeReadout(r);
        },
      },
      (h) => {
        handle.current = h;
        insetsKey.current = "";
        cb.current.pushInsets();
        safe(() => h.setStep?.(0));
      },
    );
  }, []);

  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const st = stageRef.current;
    if (!st) return;
    const r = st.getBoundingClientRect();
    pointer.current = { x: e.clientX - r.left, y: e.clientY - r.top, user: true, last: performance.now() };
    applyLens(pointer.current.x, pointer.current.y, true);
  };

  return (
    <section className={`hero ${className}`.trim()} aria-labelledby="hero-title">
      {backdrop}
      <div
        ref={stageRef}
        className="hero__stage"
        data-slot="table-hero"
        data-live={isLive ? "" : undefined}
        data-drawn={drawn ? "" : undefined}
        role="img"
        aria-label="Sample command table: a fictional British Columbia watch zone with a dam, a transmission line and a substation, inspected through a thermal lens."
        onPointerMove={onMove}
        onPointerDown={onMove}
      >
        <img
          key={`v-${variant}`}
          className="hero__cv"
          src={TABLE_STILLS.hero(variant, "visible")}
          alt=""
          aria-hidden="true"
          decoding="async"
          fetchPriority="high"
          onLoad={() => setDrawn(true)}
        />
        <img key={`t-${variant}`} className="hero__cv hero__cv--th" src={TABLE_STILLS.hero(variant, "thermal")} alt="" aria-hidden="true" decoding="async" />
        <div ref={slot3dRef} className="hero__3d" />
        <div className="lens" aria-hidden="true">
          <span className="lens__ring">
            <i />
          </span>
          <span className="lens__read mono mono--s">
            <span className="lens__max">
              Max <b ref={maxRef}>---.-</b> &deg;C
            </span>
            <span className="sample">Sample zone</span>
          </span>
        </div>
      </div>

      <div className="hero__copy wrap">
        <h1 id="hero-title" className="hero__title display" data-reveal style={{ ["--i" as string]: 1 }}>
          <span className="hero__t1">
            {HERO.title[0]} <br />
            {HERO.title[1]}
          </span>{" "}
          <br />
          <span className="hero__t2">
            {HERO.title[2]} <br />
            {HERO.title[3]}
          </span>
        </h1>
        <div className="hero__ctas" data-reveal style={{ ["--i" as string]: 3 }}>
          <Link to="/proposal" className="btn btn--ember btn--lg">
            {CTA_SHORT}
            <Arrow />
          </Link>
          <a href="#how" className="btn btn--ghost btn--lg">
            How it works
          </a>
          {actions}
        </div>
      </div>

      <div className="hero__strip">
        <div className="wrap hero__strip-in">
          <p className="hero__hint mono mono--s smoke">
            <span className="hint-fine">Move across the table</span>
            <span className="hint-touch">Drag across the table</span>: thermal lens
          </p>
        </div>
      </div>
    </section>
  );
}
