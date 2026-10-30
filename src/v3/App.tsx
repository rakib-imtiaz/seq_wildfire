import { lazy, Suspense } from "react";
import { Header } from "./sections/Chrome";
import { MobilePage } from "./sections/MobilePage";
import { QA, useMedia } from "./lib/page";

// the earlier desktop layout (the 3D story and the long sections), for review at ?layout=3d only
const Classic = lazy(() => import("./sections/Classic").then((m) => ({ default: m.Classic })));

export function App() {
  // every width gets the card page: phones since 10-27, desktop since 10-30 (the user: the desktop layout "doesnt look
  // professional at all.. the mobile one is good"); from 900 px it runs full width with 1080p footage
  const phone = useMedia("(max-width: 899px)");
  return (
    <>
      <Header />
      {QA.classic && !phone ? (
        <Suspense fallback={null}>
          <Classic />
        </Suspense>
      ) : (
        <MobilePage desk={!phone} />
      )}
    </>
  );
}
