import { useState } from "react";
import { CAREERS } from "../data/copy";
import { Scramble, SplitText } from "../components/TextMotion";

/**
 * Careers as a job listing (the client's recruiting post, FACTS §6): the section head with the open-role count, then
 * the role as a row that opens to its brief (the role, requirements, what we provide), the path from applying to
 * working as a line a position dot travels, and how to apply (the address, a copy button, the email button).
 */
export function Careers() {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CAREERS.apply.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* no clipboard (insecure context): the address is right beside the button */
    }
  };
  return (
    <section id="careers" className="car" aria-labelledby="car-h">
      <div className="wrap">
        <header className="car__head" data-rv>
          <div>
            <p className="sec__k">
              <Scramble text={CAREERS.label} />
            </p>
            <h2 id="car-h" className="h2">
              <SplitText text={CAREERS.title} />
            </h2>
            <p className="car__lead">{CAREERS.lead}</p>
          </div>
          <p className="car__count">
            <span>01</span> {CAREERS.openLabel}
          </p>
        </header>

        <article className="car__role" data-open={open ? "" : undefined} data-rv>
          <button type="button" className="car__row" aria-expanded={open} aria-controls="car-brief" onClick={() => setOpen((o) => !o)}>
            <span className="car__row-k">
              <span className="car__live" aria-hidden="true" />
              {CAREERS.kicker}
            </span>
            <span className="car__row-t">{CAREERS.role}</span>
            <span className="car__row-m">{CAREERS.terms.join("  ·  ")}</span>
            <span className="car__row-i" aria-hidden="true" />
          </button>

          <div id="car-brief" className="car__brief">
            <div className="car__brief-in">
              <div className="car__cols">
                {CAREERS.cols.map((c) => (
                  <div key={c.k} className="car__col">
                    <h3 className="car__k">{c.k}</h3>
                    <ul>
                      {c.items.map((it) => (
                        <li key={it}>{it}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <ol className="car__path" aria-label="From applying to working">
                <span className="car__line" aria-hidden="true">
                  <span className="car__dot" />
                </span>
                {CAREERS.steps.map((s, k) => (
                  <li key={s.t}>
                    <span className="car__n">{String(k + 1).padStart(2, "0")}</span>
                    <span className="car__t">{s.t}</span>
                    <span className="car__d">{s.d}</span>
                  </li>
                ))}
              </ol>

              <div className="car__apply">
                <div>
                  <p className="car__k">{CAREERS.apply.k}</p>
                  <p className="car__how">{CAREERS.apply.how}</p>
                  <p className="car__mail">
                    <a href={CAREERS.apply.href}>{CAREERS.apply.email}</a>
                    <button type="button" className="car__copy" onClick={copy} aria-live="polite">
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </p>
                </div>
                <div className="car__act">
                  <a className="btn btn--cta" href={CAREERS.apply.href}>
                    {CAREERS.apply.label}
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
