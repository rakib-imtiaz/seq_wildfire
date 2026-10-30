import { useCallback, useEffect, useRef, useState } from "react";
import { BEATS, DESK_HERO, FILM } from "../data/copy";
import { autoplayOK, FilmModal } from "../components/FilmModal";

const titleCase = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase());

/**
 * Desktop and tablet-landscape hero (2026-10-27; the user asked if a video hero suits the desktop, then "go").
 * Chapter 01 of the story: a full-bleed loop from the film (the valley reveal over the dam, the guard on patrol, the
 * drone climbing) under a see-through header, the headline and "Watch the film" (full screen, muted); the 3D model
 * below carries on from 02. Styling borrows from the user's desktop comp: title case, the round play button, the
 * chapter mark. (Its glass "See It in 3D" card was removed on 10-30 at the user's request.) The loop plays only while on screen.
 */
export function DeskHero() {
  const vid = useRef<HTMLVideoElement>(null);
  const edge = useRef<HTMLSpanElement>(null);
  const [on] = useState(autoplayOK);
  const [film, setFilm] = useState<number | null>(null);
  const closeFilm = useCallback(() => setFilm(null), []);

  // the loop plays while on screen and the film is closed; the header is see-through while over the hero
  useEffect(() => {
    const v = vid.current, s = edge.current;
    const html = document.documentElement;
    if (!v || !s || typeof IntersectionObserver === "undefined") return;
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    let seen = true;
    const sync = () => (on && seen && film === null && !document.hidden ? v.play().catch(() => undefined) : v.pause());
    const a = new IntersectionObserver(([e]) => {
      seen = e.intersectionRatio >= 0.25;
      sync();
    }, { threshold: [0, 0.25] });
    const b = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) html.dataset.hdr = "over";
      else delete html.dataset.hdr;
    });
    a.observe(v);
    b.observe(s);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      a.disconnect();
      b.disconnect();
      document.removeEventListener("visibilitychange", sync);
      delete html.dataset.hdr;
    };
  }, [on, film]);

  const hero = BEATS[0];
  return (
    <section id="top" className="dh" aria-labelledby="dh-h">
      <video
        ref={vid}
        className="dh__v"
        src={on ? DESK_HERO.src : undefined}
        poster={DESK_HERO.poster}
        muted
        playsInline
        loop
        preload={on ? "auto" : "none"}
        disablePictureInPicture
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className="dh__in">
        <div className="dh__txt">
          <p className="dh__k">{DESK_HERO.kicker}</p>
          <h1 id="dh-h" className="dh__t">
            {titleCase(hero.title)}
          </h1>
          <p className="dh__l">{hero.line}</p>
          <button type="button" className="dh__watch" onClick={() => setFilm(0)}>
            <span className="dh__play">
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 6.5v11l9-5.5z" fill="currentColor" />
              </svg>
            </span>
            {DESK_HERO.watch}
          </button>
          <p className="dh__n" aria-hidden="true">
            <b>01</b> / {String(BEATS.length).padStart(2, "0")}
          </p>
        </div>

      </div>
      <span className="dh__tag">{FILM.note}</span>
      <span ref={edge} className="dh__edge" aria-hidden="true" />
      {film !== null ? <FilmModal t={film} onClose={closeFilm} /> : null}
    </section>
  );
}
