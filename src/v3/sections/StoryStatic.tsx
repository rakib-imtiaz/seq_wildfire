import { useEffect, useRef, useState } from "react";
import { BEATS, LENS_BUTTONS, SAMPLE_NOTE } from "../data/copy";
import { createMaquette, type LensId, type Maquette, type Still } from "../three/engine.js";
import { loadZone } from "../../lib/zone";
import { afterPaint } from "../../lib/table3d";
import { QA } from "../lib/page";
import { StaticLabels } from "../components/Labels";
import { ReportCard } from "../components/ReportCard";
import { BeatFacts } from "../components/BeatFacts";
import { StaticThermalFrame } from "../components/ThermalFrame";

/**
 * ?motion=0, reduced motion, ?q=lite and no WebGL: the story as a stacked article, every beat fully visible.
 * With WebGL, each figure is a still rendered once from the same 3D scene (one offscreen context, disposed after),
 * with the same labels laid over it. Without WebGL the figures are the closest real photos.
 */
const FALLBACK: Record<string, { src: string; alt: string }> = {
  hero: { src: "/media/photos/statement-ground-and-sky-1280.webp", alt: "A fire watch guard on a ridge flying a thermal drone out over a forested valley." },
  lenses: { src: "/media/photos/pilot-portrait-960.webp", alt: "A guard-pilot checking a thermal drone on the tailgate of a pickup." },
  coverage: { src: "/media/photos/svc-live-feed-1280.webp", alt: "A drone camera view over a forested ridge at dusk." },
  team: { src: "/media/photos/svc-patrol-1280.webp", alt: "A guard walking an access road beside a transmission corridor." },
  heat: { src: "/media/photos/svc-canopy-thermal-1280.webp", alt: "A canopy in thermal view with a hotspot." },
  map: { src: "/media/photos/svc-canopy-visible-1280.webp", alt: "A canopy seen straight down from a drone." },
  report: { src: "/media/photos/landing-report-1200.webp", alt: "A tablet and radio on a topographic map." },
};

const LABELS_FOR: Record<string, string[]> = {
  lenses: ["wide", "tele", "thermal"],
  coverage: ["fpWide", "fpTele", "fpThermal", "craft"],
  team: ["patrol", "flight", "launch", "aDam", "aReservoir", "aPowerhouse", "aRoad", "aLine", "aSubstation"],
  heat: [],
  map: ["obs0", "obs1", "obs2", "hotspot", "aLine", "aSubstation"],
  report: ["hotspot", "aDam", "aReservoir", "aLine", "aSubstation"],
};

export function StoryStatic({ webgl }: { webgl: boolean }) {
  const figRef = useRef<HTMLDivElement>(null);
  const eng = useRef<Maquette | null>(null);
  const urls = useRef<string[]>([]);
  const size = useRef<{ w: number; h: number; layout: "wide" | "tall" }>({ w: 800, h: 520, layout: "wide" });
  const [stills, setStills] = useState<(Still | null)[]>(() => BEATS.map(() => null));
  const [lens, setLens] = useState<LensId>(QA.lens ?? "all");
  const [failed, setFailed] = useState(!webgl);

  useEffect(() => {
    if (!webgl) return;
    let dead = false;
    (async () => {
      await afterPaint();
      const zm = await loadZone();
      if (dead) return; // a discarded mount (StrictMode) is not a failure
      if (!zm) return setFailed(true);
      const cv = document.createElement("canvas");
      let m: Maquette;
      try {
        m = await createMaquette(cv, { zone: zm.ZONE, quality: "balanced", live: false });
      } catch {
        if (!dead) setFailed(true);
        return;
      }
      if (dead) return m.dispose();
      eng.current = m;
      const fw = Math.round(figRef.current?.clientWidth || 800);
      const wide = fw >= 560;
      const w = Math.min(1100, fw), h = Math.round(w * (wide ? 0.62 : 0.92));
      size.current = { w, h, layout: wide ? "wide" : "tall" };
      for (let k = 0; k < BEATS.length; k++) {
        const s = await m.renderStill(k, w, h, { lens: k === 2 ? lens : "all", layout: size.current.layout, full: true });
        if (dead) return;
        urls.current.push(s.url);
        setStills((prev) => {
          const n = prev.slice();
          n[k] = s;
          return n;
        });
      }
    })();
    return () => {
      dead = true;
      eng.current?.dispose();
      eng.current = null;
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current = [];
    };
    // the lens is applied below without re-booting the engine
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webgl]);

  const pick = async (id: LensId) => {
    const l = lens === id ? "all" : id;
    setLens(l);
    const m = eng.current;
    if (!m) return;
    const { w, h, layout } = size.current;
    const s = await m.renderStill(2, w, h, { lens: l, layout });
    urls.current.push(s.url);
    setStills((prev) => {
      const n = prev.slice();
      n[2] = s;
      return n;
    });
  };

  return (
    <section id="story" className="ss" aria-label="How the service works">
      {BEATS.map((b, i) => {
        const s = stills[i];
        const fb = FALLBACK[b.id];
        const H = i === 0 ? "h1" : "h2";
        return (
          <article key={b.id} className={`ss__beat ss__beat--${b.id}`}>
            <div className="ss__txt">
              <p className="beat__k" aria-hidden="true">
                <b>{String(i + 1).padStart(2, "0")}</b> / {String(BEATS.length).padStart(2, "0")}
              </p>
              <H className={i === 0 ? "beat__h1" : "beat__h2"}>
                {b.title}
                {b.title2 ? <span className="beat__h1b">{b.title2}</span> : null}
              </H>
              <p className="beat__line">{b.line}</p>
              {b.id === "coverage" && !failed ? (
                <div className="lenses" role="group" aria-label="Isolate a lens">
                  {LENS_BUTTONS.map((l) => (
                    <button key={l.id} type="button" className="lens" aria-pressed={lens === l.id} onClick={() => pick(l.id)}>
                      <span className="lens__n">{l.name}</span>
                      <span className="lens__f">{l.fov}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <BeatFacts beat={b} lens={lens} />
            </div>
            <div className="ss__fig" ref={i === 0 ? figRef : undefined}>
              <figure className="ss__frame" style={{ aspectRatio: failed ? undefined : `${size.current.w} / ${size.current.h}` }}>
                {failed ? (
                  <img src={fb.src} alt={fb.alt} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
                ) : s ? (
                  <>
                    <img src={s.url} alt="" />
                    <StaticLabels labels={s.labels} w={s.w} h={s.h} layout={size.current.layout} only={LABELS_FOR[b.id] ?? []} />
                    {b.id === "heat" ? <StaticThermalFrame ir={s.ir} labels={s.labels} w={s.w} h={s.h} /> : null}
                    {i >= 4 ? <span className="tag ss__tag">{SAMPLE_NOTE}</span> : null}
                  </>
                ) : (
                  <span className="ss__wait" />
                )}
              </figure>
              {b.id === "report" ? <ReportCard className="ss__card" /> : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}
