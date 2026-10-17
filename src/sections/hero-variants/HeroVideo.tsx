import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Link } from "react-router-dom";
import { Arrow, Stamp, Ticker } from "../../components/Motifs";
import { CTA_SHORT, HERO } from "../../data/copy";
import { clamp, useMotion } from "../../lib/motion";
import { useZone } from "../../lib/zone";
import "../../styles/hero.css";
import "./hero-video.css";
import { camForTime, fixedCam, frameToSource, type Cam } from "./video/aerialPath";
import { AERIAL, type AerialClip } from "./video/clip";
import { buildGrid, heatHot, hotSize, sampleGrid, tempOf, type HeatGrid } from "./video/heatField";
import { createLensGL, type LensGL } from "./video/lensGL";

/** Desktop hero layout (stage fills the hero, copy bottom-left): the CSS breakpoint, as in Hero.tsx. */
const isDesk = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
/** Lens ring radius (px) for a stage width, as in Hero.tsx. */
const lensRadius = (w: number, desk: boolean) => (desk ? clamp(w * 0.062, 62, 140) : clamp(w * 0.12, 42, 88));
const fmtGrid = (v: number) => (v < 0 ? "−" : "+") + String(Math.abs(Math.round(v))).padStart(4, "0");

const DPR_CAP = 1.5;
/** Metres per source-image height for the SAMPLE E/N readout (a simple grid around the hotspot). */
const M_PER_SRC = 1600;
/** The fixed header covers the top of the desktop stage. */
const HEADER_DESK = 76;
/** How long a pointer holds the lens before the idle sweep takes it back. */
const HOLD_MS = 2600;

/** 720p when the hero is narrower than about 900 CSS px or the visitor asked to save data; 1080p otherwise. */
function pickSd(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return document.documentElement.clientWidth < 900 || nav.connection?.saveData === true;
}

interface Api {
  pointer(x: number, y: number): void;
  posterReady(): void;
  refresh(): void;
}

/**
 * Hero variant 1 (?hero=1): full-bleed aerial footage replaces the 3D command table (the Steps section keeps it).
 * The thermal lens rides over the footage: a small WebGL canvas the size of the ring re-renders the current video
 * frame through a synthetic heat field (or a real thermal clip) inside the circle only.
 * The clip, its poster and the optional thermal clip are configured in ./video/clip.ts (one-line swap).
 */
export function HeroVideo({ clip = AERIAL }: { clip?: AerialClip } = {}) {
  const zone = useZone();
  const motion = useMotion();
  const [sd] = useState(pickSd);
  const [drawn, setDrawn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [glOn, setGlOn] = useState(false);
  const [posterSrc, setPosterSrc] = useState<string | undefined>(undefined);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const thermalRef = useRef<HTMLVideoElement>(null);
  const posterRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maxRef = useRef<HTMLElement>(null);
  const eRef = useRef<HTMLSpanElement>(null);
  const nRef = useRef<HTMLSpanElement>(null);
  const zoneRef = useRef(zone);
  zoneRef.current = zone;
  const api = useRef<Api | null>(null);

  useEffect(() => {
    const st = stageRef.current;
    const cv = canvasRef.current;
    if (!st || !cv) return;
    const video = motion ? videoRef.current : null;
    const thermal = motion && clip.thermal ? thermalRef.current : null;
    const poster = posterRef.current;
    const lens: LensGL | null = createLensGL(cv);
    setGlOn(!!lens);
    const rvfc = !!video && typeof video.requestVideoFrameCallback === "function";
    if (video) {
      video.muted = true;
      video.defaultMuted = true;
    }

    const s = {
      W: 0,
      H: 0,
      desk: false,
      lr: 60,
      x: 0,
      y: 0,
      placed: false,
      cover: { ox: 0, oy: 0, w: 1, h: 1 },
      user: false,
      lastUser: -1e9,
      inView: true,
      alive: true,
      /** clip time of the frame on screen (0 = the poster) */
      t: 0,
      lastT: -1,
      videoReady: false,
      texFresh: false,
      posterUp: false,
      dirty: true,
      raf: 0,
      vfc: 0,
      seed: 0,
      grid: null as HeatGrid | null,
      read: "",
      t0: performance.now(),
      lastNow: performance.now(),
    };

    const camNow = (): Cam => (clip.path ? camForTime(clip.path, s.t) : fixedCam(clip.hotspot.x, clip.hotspot.y));
    const toStage = (u: number, v: number): [number, number] => [s.cover.ox + u * s.cover.w, s.cover.oy + v * s.cover.h];

    const applyLens = (x: number, y: number) => {
      const lr = s.lr;
      // keep the whole ring inside the stage and clear of the fixed header (the desktop stage runs under it)
      const top = (s.desk ? HEADER_DESK : 0) + lr + 8;
      x = clamp(x, lr + 8, s.W - lr - 8);
      y = clamp(y, top, Math.max(top, s.H - lr - 8));
      if (s.placed && Math.abs(x - s.x) < 0.05 && Math.abs(y - s.y) < 0.05) return;
      s.x = x;
      s.y = y;
      s.placed = true;
      st.style.setProperty("--lx", `${x.toFixed(1)}px`);
      st.style.setProperty("--ly", `${y.toFixed(1)}px`);
      st.style.setProperty("--lr", `${lr.toFixed(1)}px`);
      st.toggleAttribute("data-flip", x > s.W - lr - 230);
      st.toggleAttribute("data-lens", true);
      s.dirty = true;
    };

    /** Where the lens rests: on the hotspot (the smoke base), wherever the footage has carried it. */
    const restPoint = () => {
      const c = camNow();
      return toStage(c.fx, c.fy);
    };

    const measure = () => {
      const W = st.clientWidth;
      const H = st.clientHeight;
      if (W < 10 || H < 10) return;
      s.W = W;
      s.H = H;
      s.desk = isDesk();
      s.lr = lensRadius(W, s.desk);
      // object-fit: cover. Phones and tablets crop to the centre, shifted so the smoke base sits mid-stage.
      const a = clip.aspect;
      const dh = Math.max(H, W / a);
      const dw = dh * a;
      const px = !s.desk && dw > W + 1 ? clamp((W / 2 - clip.hotspot.x * dw) / (W - dw)) : 0.5;
      s.cover = { ox: (W - dw) * px, oy: (H - dh) * 0.5, w: dw, h: dh };
      st.style.setProperty("--vpos", `${(px * 100).toFixed(2)}% 50%`);
      lens?.resize(2 * s.lr + 4, Math.min(window.devicePixelRatio || 1, DPR_CAP));
      st.style.setProperty("--lr", `${s.lr.toFixed(1)}px`);
      s.placed = false;
      if (!s.user || !motion) {
        const [rx, ry] = restPoint();
        applyLens(rx, ry);
      } else applyLens(s.x, s.y);
      s.dirty = true;
      schedule();
    };

    /** Max °C under the lens from the synthetic field, and the lens centre on a simple grid around the hotspot. */
    const readout = () => {
      const c = camNow();
      const a = clip.aspect;
      const g = s.grid;
      const hs = hotSize(c);
      const peak = zoneRef.current?.hotspot.peakC ?? 312;
      let best = 0;
      const sample = (x: number, y: number) => {
        const u = (x - s.cover.ox) / s.cover.w;
        const v = (y - s.cover.oy) / s.cover.h;
        const hb = g ? sampleGrid(g, c, u, v, a) : 0.2;
        const h = heatHot(hb, (u - c.fx) * a, v - c.fy, hs);
        if (h > best) best = h;
      };
      const R = s.lr;
      const N = 6;
      for (let j = -N; j <= N; j++) {
        for (let i = -N; i <= N; i++) {
          const dx = (i / N) * R;
          const dy = (j / N) * R;
          if (dx * dx + dy * dy <= R * R) sample(s.x + dx, s.y + dy);
        }
      }
      // the disc point nearest the hotspot (the reading peaks exactly at the core)
      const [hx, hy] = toStage(c.fx, c.fy);
      let dx = hx - s.x;
      let dy = hy - s.y;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx *= R / d;
        dy *= R / d;
      }
      sample(s.x + dx, s.y + dy);
      const [sx, sy] = frameToSource(c, (s.x - s.cover.ox) / s.cover.w, (s.y - s.cover.oy) / s.cover.h, a);
      const hz = zoneRef.current?.hotspot;
      const e = (hz?.x ?? 0) + (sx - c.ax) * a * M_PER_SRC;
      const n = (hz ? -hz.z : 0) - (sy - c.ay) * M_PER_SRC;
      const max = tempOf(best, peak).toFixed(1);
      const ee = fmtGrid(e);
      const nn = fmtGrid(n);
      const key = `${max}|${ee}|${nn}`;
      if (key === s.read) return;
      s.read = key;
      if (maxRef.current) maxRef.current.textContent = max;
      if (eRef.current) eRef.current.textContent = ee;
      if (nRef.current) nRef.current.textContent = nn;
    };

    const draw = () => {
      if (!lens) return;
      if (!lens.ok()) {
        setGlOn(false);
        return;
      }
      if (s.videoReady && video) {
        if (s.texFresh) {
          lens.upload(video);
          if (thermal && thermal.readyState >= 2) lens.uploadThermal(thermal, clip.thermal?.mode);
          s.texFresh = false;
        }
      } else if (!s.posterUp && poster?.complete && poster.naturalWidth > 0) {
        lens.upload(poster);
        s.posterUp = true;
      }
      const c = camNow();
      lens.draw({ x: s.x, y: s.y, r: s.lr, cover: s.cover, aspect: clip.aspect, cam: c, hot: { x: c.fx, y: c.fy, s: hotSize(c) }, seed: s.seed });
    };

    /** A slow sweep around the hotspot (as the 3D hero's idle lens), eased so it never jumps. */
    const idleStep = (now: number) => {
      const dt = Math.min(0.1, (now - s.lastNow) / 1000);
      const [hx, hy] = restPoint();
      const t = (now - s.t0) / 1000;
      const tx = hx + s.lr * 0.8 * Math.sin(t * 0.31);
      const ty = hy + s.lr * 0.4 * Math.sin(t * 0.47 + 0.9);
      const k = 1 - Math.exp(-dt * 2.2);
      applyLens(s.x + (tx - s.x) * k, s.y + (ty - s.y) * k);
    };

    const newFrame = (t: number) => {
      s.t = t;
      s.videoReady = true;
      s.texFresh = true;
      s.seed += 1;
      s.dirty = true;
      if (thermal && video && thermal.readyState >= 1 && Math.abs(thermal.currentTime - video.currentTime) > 0.15) {
        thermal.currentTime = video.currentTime;
      }
    };

    // the one loop: idle sweep (motion on), video polling (no requestVideoFrameCallback), drawing only when dirty
    const frame = (now: number) => {
      s.raf = 0;
      if (!s.alive || !s.inView || document.hidden) return;
      let again = false;
      if (motion) {
        if (s.user && now - s.lastUser > HOLD_MS) s.user = false;
        if (!s.user) idleStep(now);
        again = true;
      }
      if (video && !rvfc && !video.paused && video.readyState >= 2) {
        if (video.currentTime !== s.lastT) {
          s.lastT = video.currentTime;
          newFrame(video.currentTime);
        }
        again = true;
      }
      s.lastNow = now;
      if (s.dirty) {
        s.dirty = false;
        draw();
        readout();
      }
      if (again) schedule();
    };
    function schedule() {
      if (!s.raf && s.alive) s.raf = requestAnimationFrame(frame);
    }

    const onVideoFrame = (_now: number, meta: VideoFrameCallbackMetadata) => {
      if (!s.alive || !video) return;
      newFrame(meta.mediaTime);
      schedule();
      s.vfc = video.requestVideoFrameCallback(onVideoFrame);
    };
    if (video && rvfc) s.vfc = video.requestVideoFrameCallback(onVideoFrame);

    // play only while on screen and the tab is visible
    const syncPlayback = () => {
      if (!video) return;
      if (s.inView && !document.hidden) {
        video.play().catch(() => {});
        thermal?.play().catch(() => {});
      } else {
        video.pause();
        thermal?.pause();
      }
    };
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([e]) => {
            s.inView = e.isIntersecting;
            syncPlayback();
            if (s.inView) {
              s.lastNow = performance.now();
              schedule();
            }
          })
        : null;
    io?.observe(st);
    const onVis = () => {
      syncPlayback();
      if (!document.hidden) {
        s.lastNow = performance.now();
        schedule();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    let tm = 0;
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            window.clearTimeout(tm);
            tm = window.setTimeout(measure, 120);
          })
        : null;
    ro?.observe(st);

    const posterReady = () => {
      if (!poster || !poster.naturalWidth) return;
      s.grid = buildGrid(poster, clip.path ? camForTime(clip.path, 0) : fixedCam(clip.hotspot.x, clip.hotspot.y), clip.aspect);
      s.posterUp = false;
      s.read = "";
      s.dirty = true;
      schedule();
    };

    api.current = {
      pointer(x, y) {
        s.user = true;
        s.lastUser = performance.now();
        applyLens(x, y);
        schedule();
      },
      posterReady,
      refresh() {
        s.read = "";
        s.dirty = true;
        schedule();
      },
    };

    measure();
    if (poster?.complete) posterReady();

    return () => {
      s.alive = false;
      cancelAnimationFrame(s.raf);
      if (video && rvfc) video.cancelVideoFrameCallback(s.vfc);
      window.clearTimeout(tm);
      io?.disconnect();
      ro?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      lens?.dispose();
      api.current = null;
    };
  }, [clip, motion]);

  // the zone (name, hotspot grid and peak) arrives async: refresh the readout
  useEffect(() => {
    api.current?.refresh();
  }, [zone]);

  const onPointer = (e: RPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    api.current?.pointer(e.clientX - r.left, e.clientY - r.top);
  };

  const onPosterLoad = () => {
    setDrawn(true);
    setPosterSrc(posterRef.current?.currentSrc || clip.poster);
    api.current?.posterReady();
  };

  return (
    <section className="hero hero--video" aria-labelledby="hero-title">
      <div
        ref={stageRef}
        className="hero__stage"
        data-drawn={drawn ? "" : undefined}
        data-gl={glOn ? "" : undefined}
        role="img"
        aria-label={clip.label}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
      >
        <img
          ref={posterRef}
          className="hero-video__poster"
          src={clip.poster}
          srcSet={clip.posterSmall ? `${clip.posterSmall} 960w, ${clip.poster} 1920w` : undefined}
          sizes={clip.posterSmall ? "100vw" : undefined}
          alt=""
          aria-hidden="true"
          decoding="async"
          fetchPriority="high"
          onLoad={onPosterLoad}
          onError={() => setDrawn(true)}
        />
        {motion && (
          <video
            ref={videoRef}
            className="hero-video__clip"
            data-on={playing ? "" : undefined}
            src={sd ? clip.sd : clip.hd}
            poster={posterSrc}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            disablePictureInPicture
            aria-hidden="true"
            tabIndex={-1}
            onPlaying={() => setPlaying(true)}
          />
        )}
        {motion && clip.thermal && (
          <video
            ref={thermalRef}
            className="hero-video__thermal"
            src={sd ? clip.thermal.sd : clip.thermal.hd}
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
          />
        )}
        <div className="hero-video__scrim" aria-hidden="true" />
        <canvas ref={canvasRef} className="hero-video__gl" aria-hidden="true" />
        <div className="lens" aria-hidden="true">
          <span className="lens__ring">
            <i />
          </span>
          <span className="lens__read mono mono--s">
            <span className="lens__max">
              Max <b ref={maxRef}>---.-</b> &deg;C
            </span>
            <span>
              E <span ref={eRef}>+0000</span> &nbsp;N <span ref={nRef}>+0000</span>
            </span>
            <span className="sample">Sample zone</span>
          </span>
        </div>
      </div>

      <div className="hero__copy wrap">
        <p className="hero__eyebrow mono" data-reveal>
          <span className="hero__eyebrow-rule" aria-hidden="true" />
          {HERO.eyebrow}
        </p>
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
        <p className="hero__lead lead" data-reveal style={{ ["--i" as string]: 2 }}>
          {HERO.lead}
        </p>
        <div className="hero__ctas" data-reveal style={{ ["--i" as string]: 3 }}>
          <Link to="/proposal" className="btn btn--ember btn--lg">
            {CTA_SHORT}
            <Arrow />
          </Link>
          <a href="#how" className="btn btn--ghost btn--lg">
            How it works
          </a>
        </div>
      </div>

      <div className="hero__strip">
        <div className="wrap hero__strip-in">
          <Stamp
            className="hero__stamp"
            items={[
              zone?.name ?? "Sample watch zone 07",
              <Ticker key="t" from="00:14:32" />,
              <span key="s" className="hide-s">M3T thermal 640&times;512</span>,
              <span key="g" className="hide-m">Low gain 0 to 500 &deg;C</span>,
            ]}
          />
          <p className="hero__hint mono mono--s smoke">
            <span className="hint-fine">Move across the footage</span>
            <span className="hint-touch">Drag across the footage</span>: thermal lens
          </p>
        </div>
      </div>
    </section>
  );
}
