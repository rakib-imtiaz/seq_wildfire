import { useEffect, useRef, useState, type MouseEvent as RMouseEvent } from "react";
import { gsap } from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { CONTACT, CTA, FOOTNOTE, NAV } from "../data/copy";
import { Icon } from "../components/Icon";
import { Wordmark } from "../../components/Logo";
import { BrandMark } from "../components/BrandMark";
import { FooterTopo } from "../components/FooterTopo";
import { motionOn } from "../lib/page";

gsap.registerPlugin(ScrollToPlugin);

/** glide to a section (the header's height kept clear; the story starts at its own top, under its sticky stage) */
export function glide(e: RMouseEvent<HTMLAnchorElement>, href: string) {
  if (!document.querySelector(href)) return;
  e.preventDefault();
  scrollToSection(href);
}

function scrollToSection(href: string) {
  const el = document.querySelector<HTMLElement>(href);
  if (!el) return;
  const hdr = document.querySelector<HTMLElement>(".hdr")?.offsetHeight ?? 64;
  const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - (href === "#story" ? 0 : hdr));
  history.replaceState(null, "", href);
  if (!motionOn()) {
    window.scrollTo(0, y);
    return;
  }
  const d = Math.abs(y - window.scrollY);
  gsap.to(window, { scrollTo: { y, autoKill: true }, duration: Math.min(1.6, Math.max(0.7, d / 2600)), ease: "power3.inOut" });
}

/**
 * The header: the animated wordmark, the page's sections (the one in view underlined in cobalt) and the proposal
 * button. Phones and tablets: the wordmark and a Menu button that opens a full-screen sheet with the sections, the
 * button and the phone (scroll locked, Escape or a link closes it, focus returns to the button).
 */
export function Header() {
  const [open, setOpen] = useState(false);
  const [here, setHere] = useState<string | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  // the section in view
  useEffect(() => {
    const els = NAV.map((n) => document.getElementById(n.id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) if (e.isIntersecting) setHere(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  // the sheet: scroll lock, Escape, focus in and back
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    sheet.current?.focus({ preventScroll: true });
    const b = btn.current;
    return () => {
      root.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      b?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <header className="hdr" data-open={open ? "" : undefined}>
      <a className="hdr__brand" href="/" aria-label="Sequoia Security, wildfire monitoring and fire watch">
        <BrandMark />
      </a>
      <nav className="hdr__nav" aria-label="Sections">
        {NAV.map((n) => (
          <a key={n.id} href={n.href} className="hdr__link" aria-current={here === n.id ? "true" : undefined} onClick={(e) => glide(e, n.href)}>
            {n.label}
          </a>
        ))}
      </nav>
      <a className="btn btn--cta btn--sm hdr__cta" href={CTA.href}>
        {CTA.label}
      </a>
      <button ref={btn} type="button" className="btn hdr__menu" aria-expanded={open} aria-controls="hdr-sheet" onClick={() => setOpen((o) => !o)}>
        <span>{open ? "Close" : "Menu"}</span>
        <Icon name={open ? "close" : "menu"} size={18} />
      </button>
      <div ref={sheet} id="hdr-sheet" className="sheet" hidden={!open} tabIndex={-1}>
        <nav aria-label="Sections">
          <ol className="sheet__list">
            {NAV.map((n, i) => (
              <li key={n.id}>
                <a
                  href={n.href}
                  onClick={(e) => {
                    e.preventDefault();
                    setOpen(false);
                    // after the sheet closes and the page can scroll again
                    requestAnimationFrame(() => requestAnimationFrame(() => scrollToSection(n.href)));
                  }}
                >
                  <span className="sheet__n" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {n.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="sheet__foot">
          <a className="btn btn--cta" href={CTA.href} onClick={() => setOpen(false)}>
            {CTA.label}
          </a>
          <a className="sheet__tel" href={CONTACT.tel}>
            {CONTACT.phone}
          </a>
        </div>
      </div>
    </header>
  );
}

/** the user's footer comp (10-21): ember accents on near-black, three ruled columns, a live topographic corner */
export function Footer() {
  return (
    <footer className="ftr">
      <FooterTopo />
      <div className="ftr__in">
        <div className="ftr__top">
          <div className="ftr__brand">
            <Wordmark className="ftr__mark" />
            <p className="ftr__desc">Wildfire monitoring &amp; fire watch</p>
          </div>
          <a className="ftr__cta" href={CTA.href}>
            <span>{CTA.label}</span>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </a>
        </div>
        <div className="ftr__rule" aria-hidden="true" />
        <div className="ftr__cols">
          <nav className="ftr__col" aria-label="Footer">
            <p className="ftr__k">Site</p>
            {NAV.map((n) => (
              <a key={n.id} href={n.href} onClick={(e) => glide(e, n.href)}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ftr__col">
            <p className="ftr__k">Contact</p>
            <address className="ftr__line">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="ftr__ic">
                <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
                <circle cx="12" cy="10" r="2.4" />
              </svg>
              <span>
                {CONTACT.address.map((l) => (
                  <span key={l} className="ftr__addr-l">
                    {l}
                  </span>
                ))}
              </span>
            </address>
            <a className="ftr__line" href={CONTACT.tel}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="ftr__ic">
                <path d="M5 4h3.2l1.6 4-2.1 1.3a11 11 0 0 0 5 5l1.3-2.1 4 1.6V17a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />
              </svg>
              <span>{CONTACT.phone}</span>
            </a>
          </div>
          <div className="ftr__col">
            <p className="ftr__k">Sequoia Security</p>
            <a href={CONTACT.guarding.href} rel="noopener">
              Guarding services
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="ftr__out">
                <path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </a>
          </div>
        </div>
        <div className="ftr__base">
          <p>{FOOTNOTE}</p>
          <p className="ftr__copy">© {new Date().getFullYear()} Sequoia Security</p>
        </div>
      </div>
    </footer>
  );
}
