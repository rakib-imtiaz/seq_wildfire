import { COMMITMENT, CONTACT, CTA, SIGNOFF, WHY } from "../data/copy";
import { photo } from "../data/media";
import { Scramble, SplitText } from "../components/TextMotion";

/** Why: the brief's own contrast line, then the key point beside the five aims as a numbered list. */
export function Why() {
  return (
    <section id="why" className="why" aria-labelledby="why-h">
      <div className="wrap">
        <p className="sec__k" data-rv>
          <Scramble text="Why Sequoia" />
        </p>
        <h2 id="why-h" className="why__h" data-rv>
          <span className="why__a">
            <SplitText text={WHY.a} />
          </span>{" "}
          <span className="why__b">
            <SplitText text={WHY.b} offset={WHY.a.split(" ").length} />
          </span>
        </h2>
        <div className="why__grid">
          <div className="why__key" data-rv>
            <p className="why__lead">
              <Scramble text={WHY.lead} />
            </p>
            <p className="why__keyp">{WHY.key}</p>
          </div>
          <ol className="why__list" data-rv>
            {WHY.points.map((p, n) => (
              <li key={p}>
                <span className="why__n" aria-hidden="true">
                  <Scramble text={String(n + 1).padStart(2, "0")} />
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/** Our Commitment: one labelled row under the aims */
export function Commitment() {
  return (
    <section className="cmt" aria-label="Our commitment">
      <div className="wrap">
        <div className="cmt__row" data-rv>
          <p className="cmt__k">
            <Scramble text="Our commitment" />
          </p>
          <p className="cmt__p">{COMMITMENT}</p>
        </div>
      </div>
    </section>
  );
}

/** The sign-off on the ridge photo, the one CTA label, the phone */
export function CtaBand() {
  const p = photo("cta-ridge-smoke", 1920);
  return (
    <section className="cta" aria-labelledby="cta-h">
      <div className="wrap">
        <div className="cta__band" data-rv>
          <img src={p.src} srcSet={p.srcSet} sizes="(min-width: 1400px) 1360px, 100vw" alt="Layered forested ridges at last light, a transmission line crossing them and a distant smoke column." loading="lazy" decoding="async" />
          <div className="cta__txt">
            <h2 id="cta-h" className="cta__h">
              <SplitText text={SIGNOFF} />
            </h2>
            <div className="cta__row">
              <a className="btn btn--cta" href={CTA.href}>
                {CTA.label}
              </a>
              <a className="cta__tel" href={CONTACT.tel}>
                {CONTACT.phone}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
