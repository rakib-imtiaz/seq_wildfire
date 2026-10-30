import { useCallback, useEffect, useRef, useState } from "react";
import { BEATS, CAREERS, CONTACT, CTA, FILM, FOOTNOTE, MOBILE, NAV, SIGNOFF } from "../data/copy";
import { motionOn } from "../lib/page";
import { BeatFacts } from "../components/BeatFacts";
import { FilmModal } from "../components/FilmModal";
import { Wordmark } from "../../components/Logo";
import { glide } from "./Chrome";
import { Model, modelOK } from "./Model";

/**
 * Phones (the user's second comp, 2026-10-27): seven tall edge-to-edge cards, no 3D. The user on the first build:
 * cards "too small", the text and buttons "took all the" picture, an "unnecessary icon", and a card showing nothing.
 * So each card is mostly footage with a number, a title, one line and an arrow; every clip has its first frame as a
 * poster (a phone that blocks autoplay, or one still loading, shows the picture) and starts from that frame. The
 * arrow opens a sheet with the chapter's spec rows and "Watch this part" (the film, muted, from that point).
 * Desktop too since 10-30 (the user: the desktop layout "doesnt look professional at all.. the mobile one is good"):
 * from 900 px (`desk`) the cards run full width on the 16:9 hero and 1080p loops, and the sheet is a side panel.
 */
const V = "/media/video";
const live = () => motionOn() && !(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
const n2 = (k: number) => String(k).padStart(2, "0");

const PATHS = {
  arrow: "M4 12h15M13 6l6 6-6 6",
  play: "M9 6.5v11l9-5.5z",
  close: "M6 6l12 12M18 6L6 18",
  out: "M7 17L17 7M9 7h8v8",
  pin: "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 7.6a2.4 2.4 0 1 0 0 4.8a2.4 2.4 0 1 0 0-4.8",
  phone: "M5 4h3.2l1.6 4-2.1 1.3a11 11 0 0 0 5 5l1.3-2.1 4 1.6V17a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z",
  mail: "M3.5 6.5h17v11h-17zM4 7l8 6 8-6",
};
function MI({ n, s = 22 }: { n: keyof typeof PATHS; s?: number }) {
  return (
    <svg className="mi" width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[n]} fill={n === "play" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A looping clip under its still (10-30, the user: "do same for all sections initial images"): the still, a sharp
 * generated picture of the same shot, shows at once and dissolves once the clip is playing; the clip plays only while
 * on screen, and never with motion off (then the still is all there is).
 */
function Clip({ src, poster, className = "", start = 0.4 }: { src: string; poster: string; className?: string; start?: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [on] = useState(live);
  const [rolling, setRolling] = useState(false);
  useEffect(() => {
    const v = ref.current;
    setRolling(false);
    if (!v || !on || typeof IntersectionObserver === "undefined") return;
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    const io = new IntersectionObserver(([e]) => (e.intersectionRatio >= 0.3 ? v.play().catch(() => undefined) : v.pause()), { threshold: [0, 0.3] });
    io.observe(v);
    return () => io.disconnect();
  }, [on, src]);
  return (
    <div className={`mclipw ${className}`}>
      <video
        ref={ref}
        className="mclip"
        src={on ? `${src}#t=${start}` : undefined}
        muted
        playsInline
        loop
        preload="none"
        disablePictureInPicture
        aria-hidden="true"
        tabIndex={-1}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (!rolling && !v.paused && v.currentTime > start + 0.25) setRolling(true);
        }}
      />
      <img className="mclip__still" src={poster} alt="" aria-hidden="true" loading="lazy" decoding="async" data-off={rolling ? "" : undefined} />
    </div>
  );
}
/** a card's loop: phones 720p, desktop 1080p ("-hd"), 2K screens 1440p ("-2k") for the full-width ones */
const card = (id: string, sfx: string) => ({ src: `${V}/c-${id}${sfx}.mp4`, poster: `${V}/c-${id}${sfx}.webp` });
// 2K screens (10-30, the user on a 2K monitor: the video "looks very under resolution"): more than 1920 device px wide
const wide = () => window.innerWidth * (window.devicePixelRatio || 1) > 1920;

interface SheetData {
  k: string;
  title: string;
  line: string;
  beat?: string | null;
  t?: number;
  role?: boolean;
}
/** the arrow: the chapter's spec rows (or the open role) and a way into the film at that point */
function Sheet({ d, onClose, onWatch }: { d: SheetData; onClose: () => void; onWatch: (t: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const beat = d.beat ? BEATS.find((b) => b.id === d.beat) : undefined;
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    box.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div className="msheet" role="dialog" aria-modal="true" aria-label={d.title} onClick={onClose}>
      <div ref={box} className="msheet__box" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <span className="msheet__grip" aria-hidden="true" />
        <p className="mk">{d.k}</p>
        <h3 className="msheet__t">{d.title}</h3>
        <p className="msheet__l">{d.line}</p>
        {beat ? <BeatFacts beat={beat} /> : null}
        {d.role ? (
          <div className="mrole">
            <p className="mrole__t">{CAREERS.role}</p>
            <p className="mrole__m">{CAREERS.terms.join("  ·  ")}</p>
            {CAREERS.cols.map((c) => (
              <div key={c.k}>
                <p className="mk">{c.k}</p>
                <ul>
                  {c.items.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="mrole__mail">{CAREERS.apply.email}</p>
          </div>
        ) : null}
        <div className="msheet__act">
          {d.role ? (
            <a className="mbtn mbtn--fill" href={CAREERS.apply.href}>
              {CAREERS.apply.label}
            </a>
          ) : d.t !== undefined ? (
            <button type="button" className="mbtn mbtn--fill" onClick={() => onWatch(d.t!)}>
              <MI n="play" s={14} />
              {MOBILE.watchPart}
            </button>
          ) : null}
          <button type="button" className="mbtn mbtn--line" onClick={onClose}>
            {MOBILE.close_}
          </button>
        </div>
      </div>
    </div>
  );
}

function K({ n }: { n: number }) {
  return (
    <p className="mk" aria-hidden="true">
      {n2(n)} / 07
    </p>
  );
}
function Arrow({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="marrow" onClick={onClick} aria-label={`${MOBILE.more}: ${label}`}>
      <span className="marrow__i">
        <MI n="arrow" s={24} />
      </span>
      <span className="marrow__l">{MOBILE.more}</span>
    </button>
  );
}

/**
 * The desktop footer (10-30, the user: "make the footer look good"): the sign-off large with the proposal button, the
 * sections and the contact in two short columns, then the wordmark across the full width and the note under it.
 */
function DeskFoot({ onWatch }: { onWatch: () => void }) {
  const [model] = useState(modelOK);
  return (
    <footer className="dfoot">
      <div className="dfoot__top">
        <div className="dfoot__lead">
          <p className="dfoot__sign">{SIGNOFF}.</p>
          <a className="mbtn mbtn--fill dfoot__cta" href={CTA.href}>
            {CTA.label}
            <MI n="arrow" s={18} />
          </a>
        </div>
        <nav className="dfoot__col" aria-label="Footer">
          <p className="dfoot__k">{MOBILE.foot.explore}</p>
          {NAV.filter((n) => n.id !== "model" || model).map((n) => (
            <a key={n.id} href={n.href} onClick={(e) => glide(e, n.href)}>
              {n.label}
            </a>
          ))}
          <button type="button" onClick={onWatch}>
            {MOBILE.watch}
            <MI n="play" s={12} />
          </button>
        </nav>
        <div className="dfoot__col">
          <p className="dfoot__k">{MOBILE.foot.contact}</p>
          <a href={CONTACT.tel}>{CONTACT.phone}</a>
          <address>
            {CONTACT.address.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </address>
          <a href={CONTACT.guarding.href} rel="noopener">
            {MOBILE.guarding}
            <MI n="out" s={16} />
          </a>
        </div>
      </div>
      <Wordmark className="dfoot__mark" />
      <div className="dfoot__base">
        <p>{FOOTNOTE}</p>
        <p>© {new Date().getFullYear()} Sequoia Security</p>
      </div>
    </footer>
  );
}

export function MobilePage({ desk = false }: { desk?: boolean }) {
  const heroV = useRef<HTMLVideoElement>(null);
  const edge = useRef<HTMLSpanElement>(null);
  const [on] = useState(live);
  // the hero's still stays over the loop until it is playing past its fade-in (the user: a loop still loading showed
  // a soft early frame; the still "should be something sharp")
  const [rolling, setRolling] = useState(false);
  const [k2] = useState(wide);
  // the light cards fill 62% of the width, so 1080p covers them on any screen
  const res = (full: boolean) => (!desk ? "" : full && k2 ? "-2k" : "-hd");
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [film, setFilm] = useState<number | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const closeFilm = useCallback(() => setFilm(null), []);

  // the hero plays while on screen; the header is see-through over it
  useEffect(() => {
    const v = heroV.current, s = edge.current;
    const html = document.documentElement;
    html.dataset.mp = "";
    if (!v || !s || typeof IntersectionObserver === "undefined") return () => delete html.dataset.mp;
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    const a = new IntersectionObserver(([e]) => {
      if (!on) return;
      if (e.intersectionRatio >= 0.3) v.play().catch(() => undefined);
      else v.pause();
    }, { threshold: [0, 0.3] });
    const b = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) html.dataset.hdr = "over";
      else delete html.dataset.hdr;
    });
    a.observe(v);
    b.observe(s);
    return () => {
      a.disconnect();
      b.disconnect();
      delete html.dataset.hdr;
      delete html.dataset.mp;
    };
  }, [on, desk]);

  // the film has the screen to itself: the page's loops pause under it and the visible ones resume after
  useEffect(() => {
    const vids = [...document.querySelectorAll<HTMLVideoElement>(".mp .mh__v, .mp .mclip")];
    if (film !== null) {
      vids.forEach((v) => v.pause());
      return;
    }
    if (!on) return;
    vids.forEach((v) => {
      const r = v.getBoundingClientRect();
      const seen = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / (r.height || 1);
      if (seen >= 0.3 && v.readyState > 0) v.play().catch(() => undefined);
    });
  }, [film, on]);

  const C = MOBILE.cards;
  const plain = (k: number) => {
    const c = C[k];
    return "title2" in c ? `${c.title} ${c.title2}` : c.title;
  };
  const open = (k: number) => () => {
    const c = C[k];
    setSheet({ k: `${n2(k + 2)} / 07`, title: plain(k), line: c.line, beat: c.beat, t: c.t });
  };
  const title = (k: number) => {
    const c = C[k];
    return (
      <h2 className="mc__t">
        {c.title}
        {"title2" in c ? (
          <>
            <br />
            {c.title2}
          </>
        ) : null}
      </h2>
    );
  };

  return (
    <div className="mp">
      <section id="story" className="mstory" aria-label="How the service works">
        {/* 01 */}
        <header className="mh">
          <video
            key={desk ? "d" : "s"}
            ref={heroV}
            className="mh__v"
            src={on ? (desk ? `${V}/d-hero${k2 ? "-2k" : ""}.mp4` : `${V}/s-hero.mp4#t=0.45`) : undefined}
            poster={desk ? `${V}/d-hero${k2 ? "-2k" : ""}.webp` : `${V}/s-hero.webp`}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (!rolling && !v.paused && v.currentTime > 0.6) setRolling(true);
            }}
            muted
            playsInline
            loop
            preload={on ? "auto" : "none"}
            disablePictureInPicture
            aria-hidden="true"
            tabIndex={-1}
          />
          <img
            className="mh__still"
            src={desk ? `${V}/d-hero${k2 ? "-2k" : ""}.webp` : `${V}/s-hero.webp`}
            alt=""
            aria-hidden="true"
            decoding="async"
            data-off={rolling ? "" : undefined}
          />
          <div className="mh__txt">
            <K n={1} />
            <h1 className="mh__t">{BEATS[0].title.replace(/\b\w/g, (m) => m.toUpperCase())}</h1>
            <p className="mh__l">{BEATS[0].line}</p>
            <button type="button" className="mh__watch" onClick={() => setFilm(0)}>
              <span className="mh__play">
                <MI n="play" s={14} />
              </span>
              {MOBILE.watch}
            </button>
          </div>
          <span className="mh__tag">{FILM.note}</span>
          <span ref={edge} className="mh__edge" aria-hidden="true" />
        </header>

        {/* 02: light, the camera on the right */}
        <article id={C[0].nav ?? undefined} className="mc mc--light">
          <div className="mc__media">
            <Clip {...card("lenses", res(false))} start={0} />
          </div>
          <div className="mc__txt">
            <K n={2} />
            {title(0)}
            <p className="mc__l">{C[0].line}</p>
            <Arrow onClick={open(0)} label={plain(0)} />
          </div>
        </article>

        {/* 03: footage, a glass panel on the right */}
        <article className="mc mc--photo mc--glass">
          <Clip {...card("heat", res(true))} className="mc__bg" />
          <div className="mc__panel">
            <K n={3} />
            {title(1)}
            <p className="mc__l">{C[1].line}</p>
            <Arrow onClick={open(1)} label={plain(1)} />
          </div>
        </article>

        {/* 04: footage, text on the left */}
        <article className="mc mc--photo mc--left">
          <Clip {...card("team", res(true))} className="mc__bg" />
          <div className="mc__txt">
            <K n={4} />
            {title(2)}
            <p className="mc__l">{C[2].line}</p>
            <Arrow onClick={open(2)} label={plain(2)} />
          </div>
        </article>

        {/* 05: light, the map on the right */}
        <article id={C[3].nav ?? undefined} className="mc mc--light">
          <div className="mc__media">
            <Clip {...card("map", res(false))} />
          </div>
          <div className="mc__txt">
            <K n={5} />
            {title(3)}
            <p className="mc__l">{C[3].line}</p>
            <Arrow onClick={open(3)} label={plain(3)} />
          </div>
        </article>

        {/* 06: footage, a glass panel on the right */}
        <article id={C[4].nav ?? undefined} className="mc mc--photo mc--glass">
          <Clip {...card("site", res(true))} className="mc__bg" />
          <div className="mc__panel">
            <K n={6} />
            {title(4)}
            <p className="mc__l">{C[4].line}</p>
            <Arrow onClick={open(4)} label={plain(4)} />
          </div>
        </article>

        {/* desktop: the 3D model, as a tour */}
        {desk ? <Model /> : null}

        {/* 07: the proposal */}
        <article className="mc mc--photo mc--close">
          <Clip {...card("truck", res(true))} className="mc__bg" />
          <div className="mc__txt">
            <K n={7} />
            <h2 className="mc__t">{MOBILE.close.title}</h2>
            <p className="mc__l">{MOBILE.close.line}</p>
          </div>
          <a className="mc__go" href={CTA.href} aria-label={CTA.label}>
            <MI n="arrow" s={28} />
          </a>
        </article>
      </section>

      {/* careers: what the job is, and one obvious way to apply (the user: "not sure where to click to apply") */}
      <section id="careers" className="mcar" aria-labelledby="m-car">
        <div className="mcar__media">
          <img className="mimg" src={`${V}/st-ground${desk ? "-hd" : ""}.webp`} alt="A fire watch guard scanning the valley with binoculars." loading="lazy" decoding="async" />
          <span className="mcar__live">{CAREERS.kicker}</span>
        </div>
        <div className="mcar__body">
          <p className="mk">{CAREERS.label}</p>
          <h2 id="m-car" className="mcar__t">
            {MOBILE.careers.title}
          </h2>
          <p className="mcar__role">{CAREERS.role}</p>
          <ul className="mcar__terms">
            {CAREERS.terms.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="mcar__l">{CAREERS.lead}</p>
          <a className="mbtn mbtn--fill mcar__apply" href={CAREERS.apply.href}>
            {CAREERS.apply.label}
            <MI n="arrow" s={18} />
          </a>
          <p className="mcar__mail">
            {CAREERS.apply.how} <a href={CAREERS.apply.href}>{CAREERS.apply.email}</a>
          </p>
          <button type="button" className="mcar__more" onClick={() => setSheet({ k: CAREERS.label, title: CAREERS.role, line: CAREERS.lead, role: true })}>
            {MOBILE.careers.details}
            <MI n="arrow" s={16} />
          </button>
        </div>
      </section>

      {desk ? (
        <DeskFoot onWatch={() => setFilm(0)} />
      ) : (
        <footer className="mfoot">
          <Wordmark className="mfoot__mark" />
          <p className="mfoot__sign">{SIGNOFF}.</p>
          <nav className="mfoot__nav" aria-label="Footer">
            {MOBILE.footer.map((l) => (
              <a key={l.href} href={l.href} onClick={(e) => glide(e, l.href)}>
                {l.label}
                <MI n="arrow" s={18} />
              </a>
            ))}
            <button type="button" onClick={() => setFilm(0)}>
              {MOBILE.watch}
              <MI n="play" s={14} />
            </button>
            <a href={CONTACT.guarding.href} rel="noopener">
              {MOBILE.guarding}
              <MI n="out" s={18} />
            </a>
          </nav>
          <div className="mfoot__contact">
            <a href={CONTACT.tel}>
              <MI n="phone" s={18} />
              {CONTACT.phone}
            </a>
            <address>
              <MI n="pin" s={18} />
              <span>{CONTACT.address.join(", ")}</span>
            </address>
          </div>
          <p className="mfoot__note">{FOOTNOTE}</p>
          <p className="mfoot__copy">© {new Date().getFullYear()} Sequoia Security</p>
        </footer>
      )}

      {sheet ? (
        <Sheet
          d={sheet}
          onClose={closeSheet}
          onWatch={(t) => {
            setSheet(null);
            setFilm(t);
          }}
        />
      ) : null}
      {film !== null ? <FilmModal t={film} onClose={closeFilm} /> : null}
    </div>
  );
}
