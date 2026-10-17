import { Link } from "react-router-dom";
import { BUSINESS, CTA_SHORT, NAV, SIGNOFF } from "../data/copy";
import { Wordmark } from "./Logo";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="ftr">
      <div className="wrap">
        <div className="ftr__top">
          <div className="ftr__brand">
            <Wordmark className="ftr__mark" />
            <p className="mono smoke ftr__desc">Wildfire monitoring &amp; fire watch</p>
            <p className="ftr__sign">{SIGNOFF}</p>
          </div>

          <nav className="ftr__col" aria-label="Footer">
            <p className="mono mono--s smoke">Site</p>
            <ul>
              {NAV.map((n) => (
                <li key={n.href}>
                  <a href={`/${n.href}`}>{n.label}</a>
                </li>
              ))}
              <li>
                <Link to="/proposal">{CTA_SHORT}</Link>
              </li>
            </ul>
          </nav>

          <div className="ftr__col">
            <p className="mono mono--s smoke">Contact</p>
            <address>
              <span>{BUSINESS.name}</span>
              <span>{BUSINESS.street}</span>
              <span>{BUSINESS.city}</span>
            </address>
            <a className="ftr__phone" href={BUSINESS.phoneHref}>
              {BUSINESS.phone}
            </a>
          </div>

          <div className="ftr__col">
            <p className="mono mono--s smoke">Guarding &amp; security services</p>
            <a className="ftr__out" href={BUSINESS.mainSiteHref} target="_blank" rel="noopener noreferrer">
              <span>{BUSINESS.mainSite}</span>
              <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                <path d="M3 9 L9 3 M4 3 H9 V8" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
              <span className="vh">(opens in a new tab)</span>
            </a>
          </div>
        </div>

        <div className="ftr__base mono mono--s smoke">
          <span>
            &copy; {year} {BUSINESS.name}
          </span>
          <span>Maps, readouts and reports on this site are sample data from a fictional watch zone.</span>
        </div>
      </div>
    </footer>
  );
}
