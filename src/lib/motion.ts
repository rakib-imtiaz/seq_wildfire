import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Motion policy. `?motion=0` or prefers-reduced-motion puts the whole site into its final, static state
 * (html[data-motion="off"]). Screenshots use `?motion=0`.
 */
const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
const forcedOff = params.get("motion") === "0";
const mq = typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

export function motionOn(): boolean {
  return !forcedOff && !(mq?.matches ?? false);
}

export function initMotion(): void {
  const root = document.documentElement;
  root.classList.add("js");
  const apply = () => {
    root.dataset.motion = motionOn() ? "on" : "off";
  };
  apply();
  mq?.addEventListener?.("change", apply);
  watchReveals();
}

/**
 * Safety net: observe every [data-reveal] and .bloom on the page, including ones in sections that never call
 * useReveal (the hero copy once stayed at opacity 0 that way). Rescans after DOM changes, debounced.
 */
function watchReveals(): void {
  const io = getRevealIO();
  if (!io || typeof MutationObserver === "undefined") return;
  const scan = () => {
    document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-in]), .bloom:not([data-in])").forEach((n) => io.observe(n));
  };
  let tm = 0;
  new MutationObserver((muts) => {
    if (!muts.some((m) => Array.from(m.addedNodes).some((n) => n.nodeType === 1))) return;
    window.clearTimeout(tm);
    tm = window.setTimeout(scan, 60);
  }).observe(document.documentElement, { childList: true, subtree: true });
  scan();
}

/** Query flags used by QA: ?motion=0, ?q=lite, ?step=1..5 */
export const flags = {
  motion: !forcedOff,
  lite: params.get("q") === "lite",
  step: (() => {
    const s = Number(params.get("step"));
    return Number.isFinite(s) && s >= 1 && s <= 5 ? Math.round(s) : null;
  })(),
};

export function useMotion(): boolean {
  const [on, setOn] = useState(motionOn);
  useEffect(() => {
    if (!mq) return;
    const f = () => setOn(motionOn());
    mq.addEventListener?.("change", f);
    return () => mq.removeEventListener?.("change", f);
  }, []);
  return on;
}

/* ---------- one shared IntersectionObserver for reveals ---------- */

let revealIO: IntersectionObserver | null = null;

function getRevealIO(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null;
  if (!revealIO) {
    revealIO = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).setAttribute("data-in", "");
            revealIO?.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
  }
  return revealIO;
}

/** Observe every [data-reveal] and .bloom inside a root and mark them data-in when they enter. */
export function useReveal(root: RefObject<HTMLElement>, deps: unknown[] = []): void {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const nodes = el.querySelectorAll<HTMLElement>("[data-reveal], .bloom");
    const io = getRevealIO();
    if (!io || !motionOn()) {
      nodes.forEach((n) => n.setAttribute("data-in", ""));
      return;
    }
    nodes.forEach((n) => io.observe(n));
    return () => nodes.forEach((n) => io.unobserve(n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** True while the element is in (or near) the viewport. */
export function useInView<T extends HTMLElement>(margin = "0px", once = false): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
        if (e.isIntersecting && once) io.disconnect();
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin, once]);
  return [ref, inView];
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
