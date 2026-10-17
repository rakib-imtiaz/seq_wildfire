import { META } from "../data/copy";
import { useMeta } from "../lib/meta";
import { Applications } from "../sections/Applications";
import { Hero } from "../sections/Hero";
import { MapSection } from "../sections/MapSection";
import { Pilot } from "../sections/Pilot";
import { Services } from "../sections/Services";
import { CtaBand, Standards } from "../sections/Standards";
import { Statement } from "../sections/Statement";
import { Steps } from "../sections/Steps";
import { Why } from "../sections/Why";

export default function Home() {
  useMeta(META.home.title, META.home.description);
  return (
    <>
      <Hero />
      <Statement />
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
