import { createContext, useEffect, useState } from "react";
import { motionOn } from "../../lib/motion";

/**
 * v3 page policy.
 *   motion   off under ?motion=0 or prefers-reduced-motion: the story becomes a static stacked article with stills
 *            rendered from the same 3D scene, and nothing is ever hidden waiting for an animation.
 *   quality  ?q=lite (no WebGL: photo figures), ?q=balanced | high; auto = balanced (the target machines are
 *            integrated GPUs; high is for discrete GPUs and review captures)
 *   review   ?beat=0..6 jumps to a beat; ?frame=<P> renders a synchronous still at any P with the scroll driver
 *            off; ?lens=wide|tele|thermal isolates a lens
 */
const params = new URLSearchParams(window.location.search);

const num = (k: string, lo: number, hi: number): number | null => {
  const v = params.get(k);
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
};

export const QA = {
  beat: num("beat", 0, 6),
  frame: num("frame", 0, 6),
  lens: (["wide", "tele", "thermal"] as const).find((l) => l === params.get("lens")) ?? null,
  // ?layout=3d: the earlier desktop layout (sections/Classic), kept for review
  classic: params.get("layout") === "3d",
};

export type Quality = "lite" | "balanced" | "high";
export function quality(): Quality {
  const q = params.get("q");
  if (q === "lite" || q === "balanced" || q === "high") return q;
  return "balanced";
}

export { motionOn };

/**
 * The visitor's pause for everything on the card page that moves on its own: the hero loop, the card loops and the 3D
 * tour (WCAG 2.2.2; the 10-30 audit). Set by the hero's pause button, remembered on this device.
 */
export const LoopsHeld = createContext(false);
const HOLD = "seq-footage-paused";
export function readHold(): boolean {
  try {
    return localStorage.getItem(HOLD) === "1";
  } catch {
    return false;
  }
}
export function writeHold(v: boolean) {
  try {
    localStorage.setItem(HOLD, v ? "1" : "0");
  } catch {
    /* private mode: the pause still holds for this visit */
  }
}

export function useMotion(): boolean {
  const [on, setOn] = useState(motionOn);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const f = () => setOn(motionOn());
    mq.addEventListener?.("change", f);
    return () => mq.removeEventListener?.("change", f);
  }, []);
  return on;
}

export function useMedia(q: string): boolean {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setM(mq.matches);
    mq.addEventListener("change", f);
    f();
    return () => mq.removeEventListener("change", f);
  }, [q]);
  return m;
}

/**
 * Reveals: `[data-rv]` blocks fade their CHILDREN in when the block enters the viewport (the observed element is
 * never transformed or clipped, so IntersectionObserver always sees it). Safety net: a MutationObserver rescans
 * new nodes, and anything already above the fold's bottom after 2.5 s is marked in, so nothing can stay hidden.
 */
export function initPage(): void {
  const root = document.documentElement;
  root.dataset.motion = motionOn() ? "on" : "off";
  if (!motionOn() || typeof IntersectionObserver === "undefined") return;
  const io = new IntersectionObserver(
    (es) => {
      for (const e of es) {
        if (e.isIntersecting) {
          (e.target as HTMLElement).setAttribute("data-in", "");
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.06 },
  );
  const scan = () => document.querySelectorAll<HTMLElement>("[data-rv]:not([data-in])").forEach((n) => io.observe(n));
  let tm = 0;
  new MutationObserver(() => {
    window.clearTimeout(tm);
    tm = window.setTimeout(scan, 60);
  }).observe(document.body, { childList: true, subtree: true });
  scan();
  const sweep = () =>
    document.querySelectorAll<HTMLElement>("[data-rv]:not([data-in])").forEach((n) => {
      if (n.getBoundingClientRect().top < window.innerHeight) n.setAttribute("data-in", "");
    });
  window.setTimeout(sweep, 2500);
  window.addEventListener("scrollend", sweep, { passive: true });
}
