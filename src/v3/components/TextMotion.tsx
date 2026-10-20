import { Fragment, useEffect, useRef, type CSSProperties } from "react";
import { motionOn } from "../lib/page";

/**
 * The page's two text animations (motion on only; with motion off the text is simply there).
 *
 *   SplitText  a heading's words rise out of a mask one after another. CSS runs it (styles/base.css): when the
 *              nearest [data-rv] block comes into view ([data-in]), when a story beat becomes active
 *              (.beat[data-on]), or when a parent carries .st-play.
 *   Scramble   a mono label decodes: each character cycles through code glyphs and settles left to right. It runs
 *              once when it scrolls into view, or each time `active` turns true, or when `replay` changes.
 */
export function SplitText({ text, offset = 0 }: { text: string; offset?: number }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className="st-w">
            <span className="st-wi" style={{ ["--wi" as string]: i + offset } as CSSProperties}>
              {w}
            </span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#·-+";

export function Scramble({ text, active, replay = 0, delay = 0, className }: { text: string; active?: boolean; replay?: number; delay?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !motionOn()) return;
    let raf = 0, t0 = 0, timer = 0;
    const n = text.length;
    const dur = Math.min(900, 380 + n * 22);
    const settle = Array.from({ length: n }, (_, i) => (i / Math.max(1, n)) * 0.7 + Math.random() * 0.25);
    const frame = (now: number) => {
      if (!t0) t0 = now;
      const t = (now - t0) / dur;
      let out = "";
      for (let i = 0; i < n; i++) {
        const c = text[i];
        out += c === " " || t >= settle[i] ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (t < 1.05) raf = requestAnimationFrame(frame);
      else el.textContent = text;
    };
    const run = () => {
      cancelAnimationFrame(raf);
      t0 = 0;
      timer = window.setTimeout(() => (raf = requestAnimationFrame(frame)), delay);
    };
    let io: IntersectionObserver | null = null;
    if (active === undefined) {
      io = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) {
            run();
            io?.disconnect();
          }
        },
        { threshold: 0.6 },
      );
      io.observe(el);
    } else if (active) run();
    return () => {
      io?.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      el.textContent = text;
    };
  }, [text, active, replay, delay]);
  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
