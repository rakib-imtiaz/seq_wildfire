import { useCallback, useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { BEATS, LENS_BUTTONS, SAMPLE_NOTE } from "../data/copy";
import { createMaquette, type FrameInfo, type LensId, type Maquette } from "../three/engine.js";
import { loadZone } from "../../lib/zone";
import { afterPaint } from "../../lib/table3d";
import { QA, quality } from "../lib/page";
import { Labels, type LabelLayer } from "../components/Labels";
import { ReportCard } from "../components/ReportCard";
import { Icon } from "../components/Icon";
import { BeatFacts } from "../components/BeatFacts";
import { ThermalFrame, type ThermalLayer } from "../components/ThermalFrame";
import { Scramble, SplitText } from "../components/TextMotion";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const N = BEATS.length;
/** inactive beats: out of the tab order and the accessibility tree (React 18 types have no `inert`) */
const INERT = { inert: "", "aria-hidden": true } as unknown as React.HTMLAttributes<HTMLElement>;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * The pinned maquette. The stage is sticky inside a tall track; ScrollTrigger maps the track to P = 0..6 and snaps
 * one beat per gesture (a gesture moves at most one beat from the last settled one; a long deliberate drag snaps to
 * the nearest). Prev / next arrows and an autoplay tour (pause at any time) drive the same scroll, so the URL,
 * the scrollbar and the story always agree.
 */
export function Story({ onFailed }: { onFailed: () => void }) {
  const track = useRef<HTMLElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labels = useRef<LabelLayer>(null);
  const thermal = useRef<ThermalLayer>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const eng = useRef<Maquette | null>(null);
  const stRef = useRef<ScrollTrigger | null>(null);
  const start = QA.frame ?? QA.beat ?? 0;
  const Pref = useRef(start);
  const settled = useRef(Math.round(start));
  const beatRef = useRef(Math.round(start));
  const [beat, setBeat] = useState(Math.round(start));
  const [ready, setReady] = useState(false);
  const [lens, setLensState] = useState<LensId>(QA.lens ?? "all");
  const [playing, setPlaying] = useState(false);

  const drive = useCallback((P: number) => {
    Pref.current = P;
    eng.current?.setProgress(P);
    const b = Math.round(P);
    if (b !== beatRef.current) {
      beatRef.current = b;
      setBeat(b);
    }
  }, []);

  /* ---- the engine: after first paint, at idle ---- */
  useEffect(() => {
    let dead = false;
    let m: Maquette | null = null;
    let off: (() => void) | null = null;
    const onFrame = (f: FrameInfo) => {
      const v = viewRef.current;
      if (!v) return;
      labels.current?.update(f, v.clientWidth, v.clientHeight);
      thermal.current?.update(f);
      const a = smooth(5.45, 5.9, f.P);
      const card = cardRef.current;
      if (card) {
        card.style.opacity = String(a);
        card.style.transform = `translate3d(0, ${((1 - a) * 20).toFixed(1)}px, 0)`;
        card.style.visibility = a < 0.01 ? "hidden" : "visible";
      }
      const tag = tagRef.current;
      if (tag) tag.style.opacity = String(smooth(2.55, 2.9, f.P));
    };
    (async () => {
      await afterPaint();
      const zm = await loadZone();
      const cv = canvasRef.current;
      if (!zm || dead || !cv) {
        if (!zm && !dead) onFailed();
        return;
      }
      try {
        m = await createMaquette(cv, {
          zone: zm.ZONE,
          quality: quality() === "high" ? "high" : "balanced",
          live: QA.frame === null,
          preserve: QA.frame !== null || new URLSearchParams(location.search).has("debug"),
          onLost: () => onFailed(),
        });
      } catch (e) {
        if (import.meta.env.DEV) console.info("[v3] 3D unavailable, static story instead", e);
        if (!dead) onFailed();
        return;
      }
      if (dead) {
        m.dispose();
        return;
      }
      eng.current = m;
      (window as unknown as { __v3: unknown }).__v3 = { engine: m, seek: (p: number) => m?.jump(p), stats: () => m?.stats() };
      off = m.onFrame(onFrame);
      if (QA.lens) m.setLens(QA.lens);
      m.jump(Pref.current);
      m.start();
      setReady(true);
    })();
    return () => {
      dead = true;
      off?.();
      m?.dispose();
      eng.current = null;
    };
  }, [onFailed]);

  /* ---- the closing shot frames the model above the report card: tell the engine the card's share of the view ---- */
  useEffect(() => {
    const v = viewRef.current, card = cardRef.current;
    if (!ready || !v || !card) return;
    const GAP = 20;
    const fit = () => {
      if (!v.clientHeight) return;
      eng.current?.setReserve((v.clientHeight - card.offsetTop + GAP) / v.clientHeight);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(v);
    ro.observe(card);
    return () => ro.disconnect();
  }, [ready]);

  /* ---- scroll → P, one beat per gesture ---- */
  useEffect(() => {
    const el = track.current;
    if (!el || QA.frame !== null) return;
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => drive(self.progress * (N - 1)),
      snap: {
        snapTo: (v: number) => {
          const raw = v * (N - 1);
          const cur = settled.current;
          let k: number;
          if (Math.abs(raw - cur) < 0.03) k = cur;
          else if (Math.abs(raw - cur) > 1.6) k = Math.round(raw);
          else k = clamp(cur + Math.sign(raw - cur), 0, N - 1);
          return k / (N - 1);
        },
        duration: { min: 0.45, max: 0.9 },
        delay: 0.04,
        ease: "power2.inOut",
        inertia: false,
        onComplete: (self) => {
          settled.current = Math.round(self.progress * (N - 1));
        },
      },
      onLeave: () => (settled.current = N - 1),
      onLeaveBack: () => (settled.current = 0),
    });
    stRef.current = st;
    if (QA.beat !== null) {
      const y = st.start + (QA.beat / (N - 1)) * (st.end - st.start);
      window.scrollTo(0, y);
      settled.current = QA.beat;
      drive(QA.beat);
    } else {
      settled.current = Math.round(st.progress * (N - 1));
      drive(st.progress * (N - 1));
    }
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => {
      st.kill();
      stRef.current = null;
    };
  }, [drive]);

  const goTo = useCallback((k: number) => {
    const st = stRef.current;
    const n = clamp(k, 0, N - 1);
    if (!st) {
      if (QA.frame !== null) return;
      return;
    }
    const y = st.start + (n / (N - 1)) * (st.end - st.start);
    settled.current = n;
    gsap.to(window, { scrollTo: { y, autoKill: true }, duration: 0.95, ease: "power2.inOut" });
  }, []);

  const next = useCallback(() => {
    if (beatRef.current >= N - 1) {
      document.getElementById("services")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    goTo(beatRef.current + 1);
  }, [goTo]);

  /* ---- autoplay tour, paused by any input ---- */
  useEffect(() => {
    if (!playing) return;
    const stop = () => setPlaying(false);
    const t = window.setInterval(() => {
      if (beatRef.current >= N - 1) {
        setPlaying(false);
        return;
      }
      goTo(beatRef.current + 1);
    }, 4200);
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("keydown", stop);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [playing, goTo]);

  /* ---- lens isolation (coverage beat) ---- */
  const pickLens = (id: LensId) => {
    const nextLens = lens === id ? "all" : id;
    setLensState(nextLens);
    eng.current?.setLens(nextLens);
  };

  const onKey = (e: RKeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(beatRef.current - 1);
    }
  };

  const nextName = beat < N - 1 ? BEATS[beat + 1].name : "Services";

  return (
    <section ref={track} id="story" className="st" aria-label="How the service works" onKeyDown={onKey}>
      <div className="st__stage">
        <div className="st__view" ref={viewRef} data-ready={ready ? "" : undefined}>
          <canvas ref={canvasRef} className="st__canvas" aria-hidden="true" />
          <Labels ref={labels} />
          <ThermalFrame ref={thermal} />
          <div ref={tagRef} className="st__tag tag" style={{ opacity: 0 }}>
            {SAMPLE_NOTE}
          </div>
          <ReportCard ref={cardRef} className="st__card" style={{ visibility: "hidden", opacity: 0 }} />
        </div>
        <div className="st__copy">
          <div className="st__beats">
            {BEATS.map((b, i) => {
              const on = i === beat;
              const H = i === 0 ? "h1" : "h2";
              return (
                <article key={b.id} className={`beat beat--${b.id}`} data-on={on ? "" : undefined} {...(on ? {} : INERT)}>
                  <p className="beat__k" aria-hidden="true">
                    <b>
                      <Scramble text={String(i + 1).padStart(2, "0")} active={on} />
                    </b>{" "}
                    / {String(N).padStart(2, "0")}
                  </p>
                  <H className={i === 0 ? "beat__h1" : "beat__h2"}>
                    <SplitText text={b.title} />
                    {b.title2 ? (
                      <span className="beat__h1b">
                        <SplitText text={b.title2} offset={b.title.split(" ").length} />
                      </span>
                    ) : null}
                  </H>
                  <p className="beat__line">{b.line}</p>
                  {b.id === "coverage" ? (
                    <div className="lenses" role="group" aria-label="Isolate a lens">
                      {LENS_BUTTONS.map((l) => (
                        <button key={l.id} type="button" className="lens" aria-pressed={lens === l.id} onClick={() => pickLens(l.id)}>
                          <span className="lens__n">{l.name}</span>
                          <span className="lens__f">{l.fov}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <BeatFacts beat={b} lens={lens} active={on} />
                </article>
              );
            })}
          </div>
          <div className="st__ctl">
            <button type="button" className="btn btn--icon" onClick={() => goTo(beat - 1)} disabled={beat === 0} aria-label="Previous">
              <Icon name="prev" />
            </button>
            <button type="button" className="btn btn--next" onClick={next}>
              <span>{nextName}</span>
              <Icon name="next" />
            </button>
            <button type="button" className="btn btn--icon" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause the tour" : "Play the tour"} aria-pressed={playing}>
              <Icon name={playing ? "pause" : "play"} />
            </button>
            <ol className="st__rail" aria-hidden="true">
              {BEATS.map((b, i) => (
                <li key={b.id} data-on={i === beat ? "" : undefined} data-past={i < beat ? "" : undefined} />
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
