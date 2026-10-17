import { useCallback, useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { HOW } from "../data/copy";
import { FrameCorners, SectionLabel, Stamp } from "../components/Motifs";
import { clamp, flags, motionOn, useReveal } from "../lib/motion";
import { mountTableInto, safe, type TableHandle } from "../lib/table3d";
import { useZone } from "../lib/zone";
import { StepsStage } from "./StepsStage";
import "../styles/steps.css";

const N = HOW.steps.length;

function usePhone(): boolean {
  const q = "(max-width: 999px)";
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setM(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return m;
}

export function Steps() {
  const zone = useZone();
  const phone = usePhone();
  const introRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const slot3dRef = useRef<HTMLDivElement>(null);
  const handle = useRef<TableHandle | null>(null);
  const stepRef = useRef(1);
  const [step, setStep] = useState(1);
  const [live, setLive] = useState(false);
  const [near, setNear] = useState(false);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  useReveal(introRef);

  /** Scroll position of the page for a given progress u through the pinned track. */
  const scrollForU = useCallback((u: number) => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !stage) return null;
    const r = track.getBoundingClientRect();
    const stickyTop = parseFloat(getComputedStyle(stage).top) || 0;
    const total = Math.max(1, r.height - stage.offsetHeight);
    return r.top + window.scrollY - stickyTop + u * total;
  }, []);

  const goTo = useCallback(
    (n: number, instant = false) => {
      const k = clamp(n, 1, N);
      const y = scrollForU((k - 1 + 0.5) / N);
      if (y === null) return;
      window.scrollTo({ top: y, behavior: instant || !motionOn() ? "auto" : "smooth" });
    },
    [scrollForU],
  );

  // scroll -> progress u (0..1) -> step (1..5)
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const track = trackRef.current;
      const stage = stageRef.current;
      if (!track || !stage) return;
      const r = track.getBoundingClientRect();
      const top = parseFloat(getComputedStyle(stage).top) || 0;
      const total = Math.max(1, r.height - stage.offsetHeight);
      const u = clamp((top - r.top) / total);
      stage.style.setProperty("--u", u.toFixed(4));
      const n = 1 + Math.min(N - 1, Math.floor(u * N));
      const h = handle.current;
      if (h) safe(() => h.setProgress?.(u));
      if (n !== stepRef.current) {
        stepRef.current = n;
        setStep(n);
        if (h) safe(() => h.setStep?.(n));
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
      // hidden tabs never fire rAF; keep state correct anyway
      window.setTimeout(() => raf && (cancelAnimationFrame(raf), update()), 120);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // ?step=N jumps straight to a step (QA / screenshots)
  useEffect(() => {
    if (!flags.step) return;
    const t = window.setTimeout(() => goTo(flags.step as number, true), 250);
    return () => window.clearTimeout(t);
  }, [goTo]);

  // mount the 3D only once the section is near
  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setNear(true), io.disconnect()), { rootMargin: "100% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /** Tell the 3D's own labels what to keep clear of: the badge and progress bar; on phones the caption card. */
  const pushInsets = useCallback(() => {
    const h = handle.current;
    const view = viewRef.current;
    if (!h || !view) return;
    const vr = view.getBoundingClientRect();
    const bar = view.querySelector(".steps__progress")?.getBoundingClientRect();
    const top = bar ? Math.round(bar.bottom - vr.top + 14) : 64;
    let bottom = 16;
    if (phone) {
      const side = stageRef.current?.querySelector(".steps__side")?.getBoundingClientRect();
      // the caption card plus the Skip link above it
      if (side) bottom = Math.max(16, Math.round(vr.bottom - side.top + 56));
    }
    safe(() => h.setInsets?.({ top, bottom, left: 10, right: 10 }));
  }, [phone]);
  const pushRef = useRef(pushInsets);
  pushRef.current = pushInsets;

  useEffect(() => {
    const el = slot3dRef.current;
    if (!near || !el) return;
    return mountTableInto(
      el,
      {
        mode: "steps",
        onReady: () => setLive(true),
        onStep: (n) => {
          if (n >= 1 && n <= N && n !== stepRef.current) goTo(n);
        },
      },
      (h) => {
        handle.current = h;
        safe(() => h.setStep?.(stepRef.current, { instant: true }));
        pushRef.current();
      },
    );
  }, [near, goTo]);

  useEffect(() => {
    pushInsets();
    const view = viewRef.current;
    const side = stageRef.current?.querySelector(".steps__side");
    if (!view || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => pushInsets());
    ro.observe(view);
    if (side) ro.observe(side);
    return () => ro.disconnect();
  }, [pushInsets, live]);

  const onDown = (e: RPointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onUp = (e: RPointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) goTo(stepRef.current + (dx < 0 ? 1 : -1));
  };
  const onKey = (e: RKeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(stepRef.current + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(stepRef.current - 1);
    }
  };

  const cur = HOW.steps[step - 1];

  return (
    <section id="how" className="steps" aria-labelledby="how-title">
      <div ref={introRef} className="wrap steps__intro">
        <SectionLabel idx="02">Five steps, one field team</SectionLabel>
        <div className="steps__intro-grid">
          <h2 id="how-title" className="h2" data-reveal>
            {HOW.title}
          </h2>
          <p className="lead" data-reveal style={{ ["--i" as string]: 1 }}>
            {HOW.intro}
          </p>
        </div>
        <ol className="vh">
          {HOW.steps.map((s) => (
            <li key={s.n}>
              Step {s.n}, {s.title}: {s.text}
            </li>
          ))}
        </ol>
      </div>

      <div ref={trackRef} className="steps__track" style={{ ["--steps" as string]: N }}>
        <div ref={stageRef} className="steps__stage" data-step={step}>
          <div className="steps__grid wrap">
            <div ref={viewRef} className="steps__view" data-slot="table-steps" data-live={live ? "" : undefined}>
              <div className="steps__ph" aria-hidden="true">
                <StepsStage zone={zone} step={step} phone={phone} />
              </div>
              <div ref={slot3dRef} className="steps__3d" />
              <FrameCorners />
              <p className="steps__badge mono mono--s" aria-hidden="true">
                <span>
                  Step {String(step).padStart(2, "0")} / {String(N).padStart(2, "0")}
                </span>
                <span className="steps__badge-sep" />
                <span className="smoke">Sample watch zone</span>
              </p>
              <div className="steps__progress" aria-hidden="true">
                <i />
                {HOW.steps.map((s) => (
                  <b key={s.n} data-on={s.n <= step ? "" : undefined} />
                ))}
              </div>
            </div>

            <div className="steps__side">
              <ol className="steps__rail" aria-label="Steps">
                {HOW.steps.map((s) => (
                  <li key={s.n}>
                    <button
                      type="button"
                      className="steps__rail-btn"
                      aria-current={s.n === step ? "step" : undefined}
                      onClick={() => goTo(s.n)}
                    >
                      <span className="mono mono--s">{String(s.n).padStart(2, "0")}</span>
                      <span className="steps__rail-title">{s.title}</span>
                    </button>
                  </li>
                ))}
              </ol>

              <div
                className="steps__card"
                onPointerDown={onDown}
                onPointerUp={onUp}
                onPointerCancel={() => (swipe.current = null)}
                onKeyDown={onKey}
              >
                <span className="steps__swipe mono mono--s smoke" aria-hidden="true">
                  &lsaquo; swipe &rsaquo;
                </span>
                <div className="steps__card-body">
                  {HOW.steps.map((s) => (
                    <article
                      key={s.n}
                      className="steps__cap"
                      data-on={s.n === step ? "" : undefined}
                      aria-hidden={s.n !== step}
                    >
                      <p className="mono mono--s smoke steps__cap-n">
                        Step {String(s.n).padStart(2, "0")}
                      </p>
                      <h3 className="h3 steps__cap-title">{s.title}</h3>
                      <p className="steps__cap-text">{s.text}</p>
                      <Stamp items={s.stamp} className="steps__cap-stamp" />
                    </article>
                  ))}
                </div>
                <div className="steps__nav">
                  <button type="button" className="steps__arrow" onClick={() => goTo(step - 1)} disabled={step === 1} aria-label="Previous step">
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </button>
                  <div className="steps__dots" role="group" aria-label="Choose a step">
                    {HOW.steps.map((s) => (
                      <button
                        key={s.n}
                        type="button"
                        className="steps__dot"
                        aria-label={`Step ${s.n}: ${s.title}`}
                        aria-current={s.n === step ? "step" : undefined}
                        onClick={() => goTo(s.n)}
                      >
                        <i />
                      </button>
                    ))}
                  </div>
                  <button type="button" className="steps__arrow" onClick={() => goTo(step + 1)} disabled={step === N} aria-label="Next step">
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M6 3 L11 8 L6 13" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </button>
                </div>
              </div>

              <a className="steps__skip mono mono--s" href="#pilot">
                Skip the steps
              </a>
            </div>
          </div>
          <span className="vh" aria-live="polite">
            {`Step ${step}: ${cur.title}`}
          </span>
        </div>
      </div>
    </section>
  );
}
