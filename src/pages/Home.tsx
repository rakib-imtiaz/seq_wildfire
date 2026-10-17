import { useSearchParams } from "react-router-dom";
import { META } from "../data/copy";
import { useMeta } from "../lib/meta";
import { Applications } from "../sections/Applications";
import { Hero } from "../sections/Hero";
import { Overview } from "../sections/Overview";
import { HeroAmbient } from "../sections/hero-variants/HeroAmbient";
import { HeroFilm } from "../sections/hero-variants/HeroFilm";
import { HeroSwitch } from "../sections/hero-variants/HeroSwitch";
import { HeroVideo } from "../sections/hero-variants/HeroVideo";
import { MapSection } from "../sections/MapSection";
import { Pilot } from "../sections/Pilot";
import { Services } from "../sections/Services";
import { CtaBand, Standards } from "../sections/Standards";
import { Steps } from "../sections/Steps";
import { Why } from "../sections/Why";

export default function Home() {
  useMeta(META.home.title, META.home.description);
  // the 3D command-table hero, then section 01 (the user's comp). Review variants of the hero:
  // ?hero=1 video replaces the 3D, ?hero=2 film button, ?hero=3 video behind the 3D
  const [params] = useSearchParams();
  const pick = params.get("hero");
  const HeroPick = pick === "1" ? HeroVideo : pick === "2" ? HeroFilm : pick === "3" ? HeroAmbient : Hero;
  return (
    <>
      <HeroPick key={pick ?? "0"} />
      {pick !== null && <HeroSwitch hero={pick} />}
      <Overview />
      <Steps />
      <Pilot />
      <Services />
      <MapSection />
      <Applications />
      <Why />
      <Standards />
      <CtaBand />
    </>
  );
}
