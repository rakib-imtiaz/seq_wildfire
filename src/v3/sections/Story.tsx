import { useCallback, useContext, useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { BEATS, LENS_BUTTONS, SAMPLE_NOTE } from "../data/copy";
import { createMaquette, type FrameInfo, type LensId, type Maquette } from "../three/engine.js";
import { loadZone } from "../../lib/zone";
import { afterPaint } from "../../lib/table3d";
import { LoopsHeld, QA, motionOn, quality } from "../lib/page";
import { Labels, type LabelLayer } from "../components/Labels";
import { Icon } from "../components/Icon";
import { BeatFacts } from "../components/BeatFacts";
import { ThermalFrame, type ThermalLayer } from "../components/ThermalFrame";
import { Scramble, SplitText } from "../components/TextMotion";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const N = BEATS.length;
/** chapter 01 is the video hero above (sections/DeskHero); the 3D story runs 02-07 (P = 1..6) */
const FIRST = 1;
const STEPS = N - 1 - FIRST;
/** the tour: each chapter holds this long (from the middle of its glide), and one step's glide */
const DWELL = 7000;
const GLIDE = 2.4;
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
 * `tour` (10-30, the desktop card page, sections/Model): the same stage in one screen, not pinned. A row of chapter
 * tabs, prev / next and the tour glide P instead of scrolling the page (the user: "manual control to switch the
 * scenarios", "smoothly show the full animation"). Each visit tours from 02 and loops; a tab or a step hands control
 * to the visitor until they press play; the engine sleeps out of view. The text crossfades (no scramble, no rising
 * words) so nothing reads half-drawn mid-glide.
 */
export function Story({ onFailed, tour = false }: { onFailed: () => void; tour?: boolean }) {
  const track = useRef<HTMLElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labels = useRef<LabelLayer>(null);
  const thermal = useRef<ThermalLayer>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const eng = useRef<Maquette | null>(null);
  const stRef = useRef<ScrollTrigger | null>(null);
  const start = QA.frame ?? QA.beat ?? FIRST;
  const Pref = useRef(start);
  const settled = useRef(Math.round(start));
  const beatRef = useRef(Math.round(start));
  const [beat, setBeat] = useState(Math.round(start));
  const [ready, setReady] = useState(false);
  const [lens, setLensState] = useState<LensId>(QA.lens ?? "all");
  const [playing, setPlaying] = useState(false);
  const [fade, setFade] = useState(false);
  const tw = useRef<gsap.core.Tween | null>(null);
  // the visitor paused or stepped: the tour doesn't restart itself until they press play
  const held = useRef(false);
  // the card page's pause (its hero button) holds the tour too
  const hold = useContext(LoopsHeld);

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

  /* ---- scroll → P, one beat per gesture ---- */
  useEffect(() => {
    const el = track.current;
    if (!el || QA.frame !== null || tour) return;
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => drive(FIRST + self.progress * STEPS),
      snap: {
        snapTo: (v: number) => {
          const raw = v * STEPS;
          const cur = settled.current - FIRST;
          let k: number;
          if (Math.abs(raw - cur) < 0.03) k = cur;
          else if (Math.abs(raw - cur) > 1.6) k = Math.round(raw);
          else k = clamp(cur + Math.sign(raw - cur), 0, STEPS);
          return k / STEPS;
        },
        duration: { min: 0.45, max: 0.9 },
        delay: 0.04,
        ease: "power2.inOut",
        inertia: false,
        onComplete: (self) => {
          settled.current = FIRST + Math.round(self.progress * STEPS);
        },
      },
      onLeave: () => (settled.current = N - 1),
      onLeaveBack: () => (settled.current = FIRST),
    });
    stRef.current = st;
    if (QA.beat !== null) {
      const b = Math.max(FIRST, QA.beat);
      const y = st.start + ((b - FIRST) / STEPS) * (st.end - st.start);
      window.scrollTo(0, y);
      settled.current = b;
      drive(b);
    } else {
      settled.current = FIRST + Math.round(st.progress * STEPS);
      drive(FIRST + st.progress * STEPS);
    }
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => {
      st.kill();
      stRef.current = null;
    };
  }, [drive, tour]);

  const goTo = useCallback((k: number) => {
    const n = clamp(k, FIRST, N - 1);
    if (tour) {
      // P glides there on its own; the page doesn't move
      settled.current = n;
      tw.current?.kill();
      if (!motionOn()) {
        eng.current?.jump(n);
        drive(n);
        return;
      }
      const o = { p: Pref.current };
      const d = Math.abs(n - o.p);
      tw.current = gsap.to(o, { p: n, duration: Math.min(3.6, GLIDE + 0.45 * (d - 1)), ease: "power2.inOut", onUpdate: () => drive(o.p) });
      return;
    }
    const st = stRef.current;
    if (!st) return;
    const y = st.start + ((n - FIRST) / STEPS) * (st.end - st.start);
    settled.current = n;
    gsap.to(window, { scrollTo: { y, autoKill: true }, duration: 0.95, ease: "power2.inOut" });
  }, [tour, drive]);

  /* the tour, from the last chapter back to the first: a dip, not a flight back through every beat */
  const restart = useCallback(() => {
    tw.current?.kill();
    setFade(true);
    window.setTimeout(() => {
      settled.current = FIRST;
      eng.current?.jump(FIRST);
      drive(FIRST);
      setFade(false);
    }, motionOn() ? 520 : 0);
  }, [drive]);

  const next = useCallback(() => {
    if (beatRef.current >= N - 1) {
      if (tour) restart();
      else document.getElementById("services")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    goTo(beatRef.current + 1);
  }, [goTo, tour, restart]);

  /* the tour hands control to the visitor on any step */
  const take = useCallback(() => {
    if (!tour) return;
    held.current = true;
    setPlaying(false);
  }, [tour]);

  /* ---- autoplay tour, paused by any input ---- */
  useEffect(() => {
    if (!playing || tour) return;
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
  }, [playing, goTo, tour]);

  /* ---- the tour: the next chapter after DWELL; after the last, a dip back to 02 ---- */
  useEffect(() => {
    if (!tour || !playing) return;
    const t = window.setTimeout(() => (beatRef.current >= N - 1 ? restart() : goTo(beatRef.current + 1)), DWELL);
    return () => window.clearTimeout(t);
  }, [tour, playing, beat, goTo, restart]);

  /* ---- the tour: plays from 02 while in view; out of view it resets and the engine sleeps ---- */
  useEffect(() => {
    const el = track.current;
    if (!tour || !ready || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= 0.5) {
          eng.current?.start();
          if (motionOn() && !held.current && !hold) setPlaying(true);
        } else if (e.intersectionRatio < 0.15) {
          setPlaying(false);
          held.current = false;
          tw.current?.kill();
          settled.current = FIRST;
          eng.current?.jump(FIRST);
          drive(FIRST);
          eng.current?.stop();
        }
      },
      { threshold: [0, 0.15, 0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [tour, ready, drive, hold]);

  /* ---- lens isolation (coverage beat) ---- */
  const pickLens = (id: LensId) => {
    take();
    const nextLens = lens === id ? "all" : id;
    setLensState(nextLens);
    eng.current?.setLens(nextLens);
  };

  const onKey = (e: RKeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      take();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      take();
      goTo(beatRef.current - 1);
    }
  };

  const nextName = beat < N - 1 ? BEATS[beat + 1].name : tour ? "Replay" : "Services";

  return (
    <section ref={track} id={tour ? undefined : "story"} className={tour ? "st st--tour" : "st"} aria-label={tour ? "The site in 3D" : "How the service works"} onKeyDown={onKey}>
      <div className="st__stage">
        <div className="st__view" ref={viewRef} data-ready={ready ? "" : undefined} data-fade={fade ? "" : undefined}>
          <canvas ref={canvasRef} className="st__canvas" aria-hidden="true" />
          <Labels ref={labels} />
          <ThermalFrame ref={thermal} />
          <div ref={tagRef} className="st__tag tag" style={{ opacity: 0 }}>
            {SAMPLE_NOTE}
          </div>
        </div>
        <div className="st__copy">
          <div className="st__beats">
            {BEATS.map((b, i) => {
              if (i < FIRST) return null;
              const on = i === beat;
              const H = i === 0 ? "h1" : "h2";
              return (
                <article key={b.id} className={`beat beat--${b.id}`} data-on={on ? "" : undefined} {...(on ? {} : INERT)}>
                  <p className="beat__k" aria-hidden="true">
                    <b>
                      <Scramble text={String(i + 1).padStart(2, "0")} active={on && !tour} />
                    </b>{" "}
                    / {String(N).padStart(2, "0")}
                  </p>
                  <H className={i === 0 ? "beat__h1" : "beat__h2"}>
                    {tour ? b.title : <SplitText text={b.title} />}
                    {b.title2 ? (
                      <span className="beat__h1b">
                        {tour ? b.title2 : <SplitText text={b.title2} offset={b.title.split(" ").length} />}
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
                  <BeatFacts beat={b} lens={lens} active={on && !tour} />
                </article>
              );
            })}
          </div>
          {/* the tour switches chapters with the tabs below */}
          {tour ? null : (
            <div className="st__ctl">
              <button
                type="button"
                className="btn btn--icon"
                onClick={() => {
                  take();
                  goTo(beat - 1);
                }}
                disabled={beat <= FIRST}
                aria-label="Previous"
              >
                <Icon name="prev" />
              </button>
              <button
                type="button"
                className="btn btn--next"
                onClick={() => {
                  take();
                  next();
                }}
              >
                <span>{nextName}</span>
                <Icon name="next" />
              </button>
              <button
                type="button"
                className="btn btn--icon"
                onClick={() => {
                  held.current = playing;
                  setPlaying((p) => !p);
                }}
                aria-label={playing ? "Pause the tour" : "Play the tour"}
                aria-pressed={playing}
              >
                <Icon name={playing ? "pause" : "play"} />
              </button>
              <ol className="st__rail" aria-hidden="true">
                {BEATS.slice(FIRST).map((b, k) => (
                  <li key={b.id} data-on={k + FIRST === beat ? "" : undefined} data-past={k + FIRST < beat ? "" : undefined} />
                ))}
              </ol>
            </div>
          )}
        </div>
        {tour ? (
          <nav className="st__tabs" aria-label="Chapters">
            <button
              type="button"
              className="st__play"
              onClick={() => {
                held.current = playing;
                setPlaying((p) => !p);
              }}
              aria-label={playing ? "Pause the tour" : "Play the tour"}
              aria-pressed={playing}
            >
              <Icon name={playing ? "pause" : "play"} />
            </button>
            {BEATS.map((b, i) =>
              i < FIRST ? null : (
                <button
                  key={b.id}
                  type="button"
                  className="st__tab"
                  aria-current={i === beat ? "step" : undefined}
                  data-run={i === beat && playing ? "" : undefined}
                  onClick={() => {
                    take();
                    goTo(i);
                  }}
                >
                  <span className="st__tabbar" aria-hidden="true">
                    <i key={`${beat}-${playing}`} style={{ animationDuration: `${DWELL}ms` }} />
                  </span>
                  <span className="st__tabn">{String(i + 1).padStart(2, "0")}</span>
                  <span className="st__tabl">{b.name}</span>
                </button>
              ),
            )}
          </nav>
        ) : null}
      </div>
    </section>
  );
}
