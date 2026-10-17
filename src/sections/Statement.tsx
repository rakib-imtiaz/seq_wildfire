import { useRef } from "react";
import { STATEMENT } from "../data/copy";
import { MEDIA } from "../data/media";
import { SectionLabel } from "../components/Motifs";
import { PhotoSlot } from "../components/Photo";
import { useReveal } from "../lib/motion";
import "../styles/statement.css";

const VERB_NOTES = ["Ground patrols", "Aerial thermal imaging", "Geospatial mapping", "Structured reports"];

export function Statement() {
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  return (
    <section ref={ref} className="section stmt" aria-labelledby="stmt-title">
      <div className="wrap">
        <SectionLabel idx="01">Beyond ground-level observation</SectionLabel>

        <h2 id="stmt-title" className="stmt__title display">
          <span className="stmt__a" data-reveal>
            {STATEMENT.a}
          </span>
          <span className="stmt__b" data-reveal style={{ ["--i" as string]: 1 }}>
            Sequoia Security is designed to <em>observe</em>, <em>detect</em>, <em>map</em>, and <em>report</em>.
          </span>
        </h2>

        <ol className="stmt__verbs" aria-label="What the service is designed to do">
          {STATEMENT.verbs.map((v, i) => (
            <li key={v} data-reveal style={{ ["--i" as string]: i }}>
              <span className="mono mono--s smoke">{String(i + 1).padStart(2, "0")}</span>
              <span className="stmt__verb">{v}</span>
              <span className="mono mono--s stmt__note">{VERB_NOTES[i]}</span>
            </li>
          ))}
        </ol>

        <div className="stmt__pair">
          <figure className="stmt__fig stmt__fig--a">
            <PhotoSlot media={MEDIA.statementGroundOnly} kind="ridge-guard" ratio={[3, 2]} seed={5} origin={["78%", "52%"]} />
            <figcaption className="stmt__cap">
              <span className="stmt__tag mono mono--s">A &middot; {STATEMENT.pair[0].tag}</span>
              <span className="mono mono--s smoke">{STATEMENT.pair[0].note}</span>
            </figcaption>
            <p className="body stmt__text" data-reveal>
              {STATEMENT.traditional}
            </p>
          </figure>

          <figure className="stmt__fig stmt__fig--b">
            <PhotoSlot media={MEDIA.statementGroundAndSky} kind="ridge-drone" ratio={[3, 2]} seed={5} origin={["62%", "36%"]} />
            <figcaption className="stmt__cap">
              <span className="stmt__tag stmt__tag--on mono mono--s">B &middot; {STATEMENT.pair[1].tag}</span>
              <span className="mono mono--s smoke">{STATEMENT.pair[1].note}</span>
            </figcaption>
            <div className="stmt__text" data-reveal>
              <p className="stmt__approach">{STATEMENT.approach}</p>
              <p className="body">{STATEMENT.objective}</p>
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}
