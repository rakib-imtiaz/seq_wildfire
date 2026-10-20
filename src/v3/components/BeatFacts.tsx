import type { Beat } from "../data/copy";
import { Scramble } from "./TextMotion";

/**
 * A beat's fact sheet under its line: hairline rows (a name, then a value; specs in the mono face), an optional
 * legend swatch matching the route's line on the 3D and a list of report contents. `lens` lights the coverage row
 * of the isolated lens. (No CTA here: the header's "Request a proposal" is always on screen.)
 */
export function BeatFacts({ beat, lens, active }: { beat: Beat; lens?: string; active?: boolean }) {
  return (
    <>
      {beat.facts ? (
        <dl className="facts">
          {beat.facts.map((f) => (
            <div key={f.k} className="facts__row" data-on={f.lens && f.lens === lens ? "" : undefined}>
              <dt>
                {f.swatch ? <span className={`facts__sw facts__sw--${f.swatch}`} aria-hidden="true" /> : null}
                <Scramble text={f.k} active={active} />
              </dt>
              <dd className={f.spec ? "facts__spec" : undefined}>
                {f.sample ? <span className="tag tag--sm facts__tag">SAMPLE</span> : null}
                {f.v}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {beat.chips ? (
        <div className="facts__chips">
          <p className="facts__k">
            <Scramble text={beat.chips.label} active={active} />
          </p>
          <ul>
            {beat.chips.items.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {beat.note ? <p className="facts__note">{beat.note}</p> : null}
    </>
  );
}
