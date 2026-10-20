import { useCallback, useState } from "react";
import { Header, Footer } from "./sections/Chrome";
import { Story } from "./sections/Story";
import { StoryStatic } from "./sections/StoryStatic";
import { Services } from "./sections/Services";
import { Applications } from "./sections/Applications";
import { Why, Commitment, CtaBand } from "./sections/Closing";
import { Careers } from "./sections/Careers";
import { QA, quality, useMotion } from "./lib/page";
import { webglAvailable } from "./three/engine.js";

export function App() {
  const motion = useMotion();
  const [gl] = useState(() => quality() !== "lite" && webglAvailable());
  const [failed, setFailed] = useState(false);
  const onFailed = useCallback(() => setFailed(true), []);
  // the pinned story needs motion and WebGL; ?frame= review stills use the pinned layout too
  const pinned = gl && !failed && (motion || QA.frame !== null);
  return (
    <>
      <Header />
      <main id="main">
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
