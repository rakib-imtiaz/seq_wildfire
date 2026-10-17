import { useRef } from "react";
import { WHY } from "../data/copy";
import { SectionLabel } from "../components/Motifs";
import { useReveal } from "../lib/motion";
import "../styles/why.css";

export function Why() {
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  return (
    <section ref={ref} className="section why" aria-labelledby="why-title">
      <div className="wrap">
        <div className="why__grid">
          <div className="why__head">
            <SectionLabel idx="07">Why Sequoia</SectionLabel>
            <h2 id="why-title" className="h2" data-reveal>
              {WHY.title}
            </h2>
            <p className="lead" data-reveal style={{ ["--i" as string]: 1 }}>
              {WHY.intro}
            </p>
          </div>
          <ul className="why__list">
            {WHY.items.map((it, i) => (
              <li key={it} className="why__item" data-reveal style={{ ["--i" as string]: i }}>
                <span className="mono mono--s smoke">{String(i + 1).padStart(2, "0")}</span>
                <span className="why__text">{it}</span>
                <svg className="why__tick" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </li>
            ))}
          </ul>
        </div>

        <div className="why__key" data-reveal>
          <p className="mono mono--s why__key-label">
            <span className="label__idx">06</span>
            <span className="label__rule" aria-hidden="true" />
            <span className="smoke">The difference</span>
          </p>
          <p className="why__key-text display">{WHY.key}</p>
        </div>
      </div>
    </section>
  );
}
