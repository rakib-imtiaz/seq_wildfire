import { useEffect, useRef, useState, type MouseEvent as RMouseEvent } from "react";
import { gsap } from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { CONTACT, CTA, FOOTNOTE, NAV } from "../data/copy";
import { Icon } from "../components/Icon";
import { Wordmark } from "../../components/Logo";
import { BrandMark } from "../components/BrandMark";
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

export function Footer() {
  return (
    <footer className="ftr">
      <div className="ftr__in">
        <div className="ftr__top">
          <div className="ftr__brand">
            <Wordmark className="ftr__mark" />
            <p className="ftr__desc">Wildfire monitoring &amp; fire watch</p>
          </div>
          <a className="ftr__cta" href={CTA.href}>
            {CTA.label}
            <Icon name="next" size={22} />
          </a>
        </div>
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
            <address>
              {CONTACT.address.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </address>
            <a href={CONTACT.tel}>{CONTACT.phone}</a>
          </div>
          <div className="ftr__col">
            <p className="ftr__k">Sequoia Security</p>
            <a href={CONTACT.guarding.href} rel="noopener">
              Guarding services
              <Icon name="out" size={15} />
            </a>
          </div>
        </div>
        <div className="ftr__base">
          <p>{FOOTNOTE}</p>
          <p>© {new Date().getFullYear()} Sequoia Security</p>
        </div>
      </div>
    </footer>
  );
}
