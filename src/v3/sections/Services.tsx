import { SERVICES } from "../data/copy";
import { photo } from "../data/media";
import { Scramble, SplitText } from "../components/TextMotion";

/**
 * The five core services as a capabilities index: a header row (label, heading, count), then one row per service:
 * its number, its title in condensed caps, its line, and a small photo. Hover lifts the row (number to cobalt,
 * photo to full colour).
 */
const SIZES = "(min-width: 900px) 260px, 100vw";

export function Services() {
  const order = ["thermal", "patrol", "live", "mapping", "reporting"] as const;
  return (
    <section id="services" className="svc" aria-labelledby="svc-h">
      <div className="wrap">
        <header className="svc__head" data-rv>
          <div>
            <p className="sec__k">
              <Scramble text="Services" />
            </p>
            <h2 id="svc-h" className="h2">
              <SplitText text="Five core services" />
            </h2>
          </div>
          <p className="svc__count" aria-hidden="true">
            05
          </p>
        </header>
        <ol className="svc__list">
          {order.map((id, n) => {
            const s = SERVICES.find((x) => x.id === id)!;
            const p = photo(s.img);
            return (
              <li key={s.id} className={`svc__row svc__row--${s.id}`} data-rv>
                <span className="svc__n" aria-hidden="true">
                  <Scramble text={String(n + 1).padStart(2, "0")} />
                </span>
                <h3 className="svc__t">
                  <SplitText text={s.title} />
                </h3>
                <p className="svc__d">{s.line}</p>
                <div className="svc__img">
                  <img src={p.src} srcSet={p.srcSet} sizes={SIZES} alt={s.alt} loading="lazy" decoding="async" />
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
