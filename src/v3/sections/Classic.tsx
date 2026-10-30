import { useCallback, useState } from "react";
import { Footer } from "./Chrome";
import { Story } from "./Story";
import { StoryStatic } from "./StoryStatic";
import { DeskHero } from "./DeskHero";
import { Services } from "./Services";
import { Applications } from "./Applications";
import { Why, Commitment, CtaBand } from "./Closing";
import { Careers } from "./Careers";
import { QA, quality, useMotion } from "../lib/page";
import { webglAvailable } from "../three/engine.js";

/**
 * The earlier desktop layout (10-27 to 10-30): the video hero, the 3D story from chapter 02, then the long sections.
 * The user on 10-30: it "doesnt look professional at all.. the mobile one is good", so every width now gets the card
 * page (sections/MobilePage). This one stays for review at ?layout=3d and loads only there.
 */
export function Classic() {
  const motion = useMotion();
  const [gl] = useState(() => quality() !== "lite" && webglAvailable());
  const [failed, setFailed] = useState(false);
  const onFailed = useCallback(() => setFailed(true), []);
  // the pinned story needs motion and WebGL; ?frame= review stills use the pinned layout too
  const pinned = gl && !failed && (motion || QA.frame !== null);
  return (
    <>
      <main id="main">
        <DeskHero />
        {pinned ? <Story onFailed={onFailed} /> : <StoryStatic webgl={gl && !failed} />}
        <Services />
        <Applications />
        <Why />
        <Commitment />
        <CtaBand />
        <Careers />
      </main>
      <Footer />
    </>
  );
}
