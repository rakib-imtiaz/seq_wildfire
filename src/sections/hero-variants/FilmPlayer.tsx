import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, type RefObject } from "react";
import { FrameCorners, SampleTag } from "../../components/Motifs";
import { motionOn } from "../../lib/motion";
import "./hero-film.css";

/**
 * The hero film (?hero=2). To swap in the real film: drop it in as public/media/video/hero-film-1080.mp4
 * (H.264, yuv420p, +faststart) with a matching hero-film-poster.webp, then set `seconds` to its length.
 * The stand-in is a silent 30 s montage of the site photos, so the player starts muted and promises no sound.
 */
export const FILM = {
  src: "/media/video/hero-film-1080.mp4",
  poster: "/media/video/hero-film-poster.webp",
  seconds: 30,
  title: "Sequoia Security · Drone-enhanced fire watch",
  tag: "Sample footage",
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const spoken = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return [m && `${m} minute${m > 1 ? "s" : ""}`, r && `${r} seconds`].filter(Boolean).join(" ");
};

/** "Watch the film" ghost CTA: a play glyph, the label and the running time in mono. */
export const FilmButton = forwardRef<HTMLButtonElement, { onPrime: () => void; onOpen: () => void }>(function FilmButton(
  { onPrime, onOpen },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className="btn btn--ghost btn--lg film-btn"
      aria-haspopup="dialog"
      onPointerEnter={onPrime}
      onFocus={onPrime}
      onClick={onOpen}
    >
      <svg className="film-btn__play" viewBox="0 0 12 14" aria-hidden="true" focusable="false">
        <path d="M1 1.2 L11 7 L1 12.8 Z" fill="currentColor" />
      </svg>
      <span>Watch the film</span>
      <span className="film-btn__dur" aria-hidden="true">
        {clock(FILM.seconds)}
      </span>
      <span className="vh">, {spoken(FILM.seconds)}</span>
    </button>
  );
});

export type FilmPlayerHandle = {
  /** Set the poster and source (still preload="none": nothing streams until play). */
  prime: () => void;
  /** Open the modal player; plays at once when motion is on (the click is the user gesture). */
  open: () => void;
};

/** Lock page scroll while the player is open, keeping the scrollbar's gutter so nothing shifts. */
function lockScroll(): () => void {
  const root = document.documentElement;
  const prevOverflow = root.style.overflow;
  const prevGutter = root.style.scrollbarGutter;
  if (window.innerWidth - root.clientWidth > 0) root.style.scrollbarGutter = "stable";
  root.style.overflow = "hidden";
  return () => {
    root.style.overflow = prevOverflow;
    root.style.scrollbarGutter = prevGutter;
  };
}

/** Full-screen film player: a native modal <dialog> (Esc, backdrop click and × close it). */
export const FilmPlayer = forwardRef<FilmPlayerHandle, { returnFocus?: RefObject<HTMLElement> }>(function FilmPlayer(
  { returnFocus },
  ref,
) {
  const titleId = useId();
  const dlg = useRef<HTMLDialogElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const unlock = useRef<(() => void) | null>(null);
  const downOnBackdrop = useRef(false);

  const prime = useCallback(() => {
    const v = vid.current;
    if (!v || v.dataset.primed !== undefined) return;
    v.dataset.primed = "";
    v.muted = true;
    v.poster = FILM.poster;
    v.src = FILM.src;
  }, []);

  const open = useCallback(() => {
    const d = dlg.current;
    const v = vid.current;
    if (!d || !v || d.open) return;
    prime();
    unlock.current?.();
    unlock.current = lockScroll();
    if (typeof d.showModal === "function") d.showModal();
    else d.setAttribute("open", "");
    if (motionOn()) v.play()?.catch(() => {});
  }, [prime]);

  const close = useCallback(() => {
    const d = dlg.current;
    if (!d?.open) return;
    if (typeof d.close === "function") d.close();
    else {
      d.removeAttribute("open");
      d.dispatchEvent(new Event("close"));
    }
  }, []);

  useImperativeHandle(ref, () => ({ prime, open }), [prime, open]);

  useEffect(() => {
    const d = dlg.current;
    const v = vid.current;
    if (!d || !v) return;
    // closed (×, Esc, backdrop): stop, rewind to the poster, release the page, focus back on the button
    const onClose = () => {
      v.pause();
      if (v.dataset.primed !== undefined) v.load();
      unlock.current?.();
      unlock.current = null;
      returnFocus?.current?.focus({ preventScroll: true });
    };
    // at the end, show the poster again (ready to replay) rather than the last, faded-out frame
    const onEnded = () => v.load();
    d.addEventListener("close", onClose);
    v.addEventListener("ended", onEnded);
    return () => {
      d.removeEventListener("close", onClose);
      v.removeEventListener("ended", onEnded);
      unlock.current?.();
      unlock.current = null;
    };
  }, [returnFocus]);

  return (
    <dialog
      ref={dlg}
      className="film"
      aria-labelledby={titleId}
      // a backdrop click closes; a drag that starts on the video (scrubbing) and ends outside does not
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) close();
        downOnBackdrop.current = false;
      }}
    >
      <div className="film__frame">
        <div className="film__bar">
          <p className="film__meta">
            <span id={titleId} className="film__title mono">
              {FILM.title}
            </span>
            <SampleTag>{FILM.tag}</SampleTag>
          </p>
          <button type="button" className="film__close" aria-label="Close film" onClick={close}>
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M3 3 L13 13 M13 3 L3 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
            </svg>
          </button>
        </div>
        <div className="film__screen">
          <video ref={vid} className="film__video" controls playsInline muted preload="none" />
          <FrameCorners className="film__corners" />
        </div>
      </div>
    </dialog>
  );
});
