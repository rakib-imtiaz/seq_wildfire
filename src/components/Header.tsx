import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BUSINESS, CTA_SHORT, NAV } from "../data/copy";
import { Logo } from "./Logo";
import { Arrow } from "./Motifs";

export function Header() {
  const { pathname } = useLocation();
  // this app serves the earlier design at /v1/ and the proposal form; the main page (/) is v3
  const isHome = pathname === "/v1" || pathname === "/v1/";
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setSolid(window.scrollY > 12));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // close the sheet on route change
  useEffect(() => setOpen(false), [pathname]);

  // sheet: scroll lock, Escape, focus in / focus back
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const first = sheetRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && sheetRef.current) {
        const f = Array.from(sheetRef.current.querySelectorAll<HTMLElement>("a, button"));
        const all = btnRef.current ? [btnRef.current, ...f] : f;
        const i = all.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          all[all.length - 1]?.focus();
        } else if (!e.shiftKey && i === all.length - 1) {
          e.preventDefault();
          all[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const btn = btnRef.current;
    return () => {
      root.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      btn?.focus({ preventScroll: true });
    };
  }, [open]);

  // off its own home, the nav points at the main page's sections
  const MAIN: Record<string, string> = { "#how": "/#story", "#services": "/#services", "#applications": "/#applications", "#standards": "/#why" };
  const navHref = (h: string) => (isHome ? h : MAIN[h] ?? "/");

  return (
    <>
      <header className="hdr" data-solid={solid || open || !isHome ? "" : undefined} data-open={open ? "" : undefined}>
        <div className="hdr__in wrap">
          <a href="/" className="hdr__logo" aria-label="Sequoia Security wildfire monitoring, home">
            <Logo />
          </a>

          <nav className="hdr__nav" aria-label="Primary">
            <ul>
              {NAV.map((n) => (
                <li key={n.href}>
                  <a href={navHref(n.href)} className="hdr__link">
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hdr__actions">
            <Link to="/proposal" className="btn btn--ember hdr__cta">
              {CTA_SHORT}
              <Arrow />
            </Link>
            <button
              ref={btnRef}
              type="button"
              className="hdr__menu"
              aria-expanded={open}
              aria-controls="site-sheet"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
            >
              <span className="hdr__burger" aria-hidden="true">
                <i />
                <i />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* outside <header>: its backdrop-filter would otherwise become the containing block of this fixed sheet */}
      <div id="site-sheet" ref={sheetRef} className="sheet" hidden={!open}>
          <nav className="sheet__nav wrap" aria-label="Menu">
            <ol>
              {NAV.map((n, i) => (
                <li key={n.href}>
                  <a href={navHref(n.href)} onClick={() => setOpen(false)}>
                    <span className="mono mono--s smoke">{String(i + 1).padStart(2, "0")}</span>
                    <span className="sheet__label">{n.label}</span>
                  </a>
                </li>
              ))}
            </ol>
            <div className="sheet__foot">
              <Link to="/proposal" className="btn btn--ember btn--lg sheet__cta" onClick={() => setOpen(false)}>
                {CTA_SHORT}
                <Arrow />
              </Link>
              <a className="sheet__phone mono" href={BUSINESS.phoneHref}>
                {BUSINESS.phone}
              </a>
              <p className="mono mono--s smoke">
                {BUSINESS.street}, {BUSINESS.city}
              </p>
            </div>
          </nav>
        </div>
    </>
  );
}
