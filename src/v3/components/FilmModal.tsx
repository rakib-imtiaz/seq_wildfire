import { useEffect, useRef } from "react";
import { FILM } from "../data/copy";

/** a looping clip may autoplay: motion on and no Data Saver */
export const autoplayOK = () => {
  const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lite = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  return document.documentElement.dataset.motion !== "off" && !reduce && !lite;
};

/**
 * The film, full screen over the page, from a given point. Muted by default (the user, 10-27: "the drone sound is
 * too much"); the player's controls unmute it. Escape or the close button ends it; the page can't scroll under it.
 */
export function FilmModal({ t, onClose }: { t: number; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const v = ref.current;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    btn.current?.focus({ preventScroll: true });
    if (v) {
      v.muted = true;
      v.defaultMuted = true;
    }
    const start = () => {
      if (v && t > 0) v.currentTime = t;
      v?.play().catch(() => undefined);
    };
    if (v) {
      if (v.readyState >= 1) start();
      else v.addEventListener("loadedmetadata", start, { once: true });
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      v?.pause();
    };
  }, [t, onClose]);
  return (
    <div className="mfilm" role="dialog" aria-modal="true" aria-label={FILM.title}>
      <button ref={btn} type="button" className="mfilm__x" onClick={onClose} aria-label="Close">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
      </button>
      <video ref={ref} className="mfilm__v" src={FILM.src} poster={FILM.poster} controls muted playsInline preload="auto" />
      <span className="mfilm__tag">{FILM.note}</span>
    </div>
  );
}
