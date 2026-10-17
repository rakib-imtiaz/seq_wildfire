import { useRef } from "react";
import { APPLICATIONS } from "../data/copy";
import { PAIRS } from "../data/media";
import { SectionLabel } from "../components/Motifs";
import { ThermalPair } from "../components/Photo";
import { useReveal } from "../lib/motion";
import "../styles/applications.css";

/** Where each tile's lens rests (over the hottest subject in its thermal photo) on touch devices and when static. */
const REST: Record<string, [number, number]> = {
  hydro: [0.62, 0.56], // powerhouse
  transmission: [0.8, 0.48], // substation
  "remote-utility": [0.62, 0.55], // generator
  industrial: [0.78, 0.49], // mill building
  forestry: [0.64, 0.49], // log loader
};

export function Applications() {
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  return (
    <section ref={ref} id="applications" className="section apps" aria-labelledby="apps-title">
      <div className="wrap apps__grid">
        <div className="apps__head">
          <SectionLabel idx="06">Applications</SectionLabel>
          <h2 id="apps-title" className="h2" data-reveal>
            {APPLICATIONS.title}
          </h2>
          <p className="lead" data-reveal style={{ ["--i" as string]: 1 }}>
            {APPLICATIONS.intro}
          </p>
          <p className="apps__hint mono mono--s smoke" data-reveal style={{ ["--i" as string]: 2 }}>
            <span className="hint-fine">Hover a site to see it in thermal</span>
            <span className="hint-touch">Drag across a site to see it in thermal</span>
          </p>
        </div>

        <ol className="apps__tiles">
          {APPLICATIONS.items.map((a, i) => (
            <li key={a.id} className="app" data-reveal style={{ ["--i" as string]: i % 2 }}>
              <ThermalPair pair={PAIRS[a.id]} kind={a.id} ratio={[4, 5]} seed={30 + i * 7} rest={REST[a.id]} />
              <div className="app__cap">
                <p className="mono mono--s smoke">App {String(i + 1).padStart(2, "0")}</p>
                <h3 className="h3 app__title">{a.title}</h3>
                <p className="app__text">{a.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
