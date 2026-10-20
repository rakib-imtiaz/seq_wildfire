import { useCallback, useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { APPLICATIONS } from "../data/copy";
import { app } from "../data/media";
import { motionOn } from "../lib/page";
import { Icon } from "../components/Icon";
import { Scramble, SplitText } from "../components/TextMotion";

/**
 * Five applications, each a visible / thermal pair with a drag-compare. Autoplay walks through them: each site
 * fades in in visible light, then the divider sweeps across to reveal the thermal side. Pause at any time; a drag,
 * a key or a click on a site pauses it. The outgoing site fades for 0.6 s under the incoming one.
 */
const DWELL = 5600;
const OPEN = 0.36;

export function Applications() {
  const live = motionOn();
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState<{ i: number; split: number } | null>(null);
  const [playing, setPlaying] = useState(live);
  const [split, setSplit] = useState(live ? 1 : 0.5);
  const [anim, setAnim] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  const inView = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);
  const splitRef = useRef(split);
  splitRef.current = split;
  const iRef = useRef(i);
  iRef.current = i;

  const go = useCallback((n: number, nextSplit: number) => {
    const cur = iRef.current;
    const k = (n + APPLICATIONS.length) % APPLICATIONS.length;
    if (k !== cur) setPrev({ i: cur, split: splitRef.current });
    setI(k);
    setAnim(false);
    setSplit(nextSplit);
  }, []);

  useEffect(() => {
    if (!prev) return;
    const t = window.setTimeout(() => setPrev(null), 650);
    return () => window.clearTimeout(t);
  }, [prev]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => (inView.current = e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // autoplay: on each site, sweep the divider open, then move on (only while the section is on screen)
  useEffect(() => {
    if (!playing) return;
    const sweep = window.setTimeout(() => {
      setAnim(true);
      setSplit(OPEN);
    }, 700);
    const next = window.setTimeout(() => {
      if (inView.current) go(i + 1, 1);
    }, DWELL);
    return () => {
      window.clearTimeout(sweep);
      window.clearTimeout(next);
    };
  }, [playing, i, go]);

  const setFromX = (clientX: number) => {
    const r = frame.current?.getBoundingClientRect();
    if (!r) return;
    setSplit(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  };
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (drag.current !== null) return;
    drag.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setPlaying(false);
    setAnim(false);
    setFromX(e.clientX);
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (drag.current === e.pointerId) setFromX(e.clientX);
  };
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (drag.current === e.pointerId) drag.current = null;
  };
  const onKey = (e: RKeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setPlaying(false);
      setAnim(false);
      setSplit((s) => Math.min(1, Math.max(0, s + (e.key === "ArrowRight" ? 0.05 : -0.05))));
    }
  };
  const pickSite = (k: number) => {
    setPlaying(false);
    go(k, 0.5);
  };

  const a = APPLICATIONS[i];
  const layer = (k: number, s: number, cls: string) => {
    const x = APPLICATIONS[k];
    const vis = app(x.id, "visible"), th = app(x.id, "thermal");
    return (
      <div key={`${cls}-${x.id}`} className={`cmp__layer ${cls}`} style={{ ["--split" as string]: `${(s * 100).toFixed(2)}%` }}>
        <img className="cmp__img" src={vis.src} srcSet={vis.srcSet} sizes="(min-width: 1024px) 42vw, 100vw" alt={x.alt} decoding="async" draggable={false} />
        <div className="cmp__th">
          <img className="cmp__img" src={th.src} srcSet={th.srcSet} sizes="(min-width: 1024px) 42vw, 100vw" alt="" decoding="async" draggable={false} />
        </div>
      </div>
    );
  };

  return (
    <section ref={sectionRef} id="applications" className="apps" aria-labelledby="apps-h">
      <div className="wrap apps__in">
        <div className="apps__side" data-rv>
          <p className="sec__k">
            <Scramble text="Applications" />
          </p>
          <h2 id="apps-h" className="h2">
            <SplitText text="Designed for critical infrastructure" />
          </h2>
          <ol className="apps__list">
            {APPLICATIONS.map((x, k) => (
              <li key={x.id}>
                <button type="button" className="apps__item" aria-current={k === i ? "true" : undefined} onClick={() => pickSite(k)}>
                  <span className="apps__n" aria-hidden="true">
                    {String(k + 1).padStart(2, "0")}
                  </span>
                  {x.title}
                </button>
              </li>
            ))}
          </ol>
          <div className="apps__ctl">
            <button type="button" className="btn btn--icon" aria-label="Previous site" onClick={() => pickSite(i - 1)}>
              <Icon name="prev" />
            </button>
            <button type="button" className="btn btn--icon" aria-label="Next site" onClick={() => pickSite(i + 1)}>
              <Icon name="next" />
            </button>
            <button type="button" className="btn btn--icon" aria-label={playing ? "Pause" : "Play"} aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>
              <Icon name={playing ? "pause" : "play"} />
            </button>
          </div>
        </div>
        <figure className="apps__fig" data-rv>
          <div
            ref={frame}
            className="cmp"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            data-anim={anim ? "" : undefined}
            style={{ ["--split" as string]: `${(split * 100).toFixed(2)}%` }}
          >
            {prev ? layer(prev.i, prev.split, "cmp__layer--out") : null}
            {layer(i, split, "cmp__layer--in")}
            <div
              className="cmp__bar"
              role="slider"
              tabIndex={0}
              aria-label="Compare visible and thermal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(split * 100)}
              aria-valuetext={`${Math.round((1 - split) * 100)}% thermal`}
              onKeyDown={onKey}
            >
              <span className="cmp__knob">
                <Icon name="prev" size={14} />
                <Icon name="next" size={14} />
              </span>
            </div>
          </div>
          <figcaption className="apps__cap">
            <span className="apps__cap-t">{a.title}</span>
            <span className="apps__cap-n">
              Visible and thermal, drag to compare. <span className="tag tag--sm">SAMPLE</span>
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
