import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { quality } from "../lib/page";
import { webglAvailable } from "../three/util.js";

const Story = lazy(() => import("./Story").then((m) => ({ default: m.Story })));

/** the model can run here (the desktop footer lists it only then) */
export const modelOK = () => quality() !== "lite" && webglAvailable();

/**
 * The 3D model on the desktop card page (10-30, the user: "add that animation somewhere in desktop version maybe a
 * section in the header"): the maquette's chapters 02-07 as a one-screen tour (sections/Story, `tour`) after card 06,
 * linked from the header as "3D Model". It loads as it comes near, and never without WebGL or on ?q=lite.
 */
export function Model() {
  const box = useRef<HTMLDivElement>(null);
  const [ok] = useState(modelOK);
  const [near, setNear] = useState(false);
  const [failed, setFailed] = useState(false);
  const onFailed = useCallback(() => setFailed(true), []);

  useEffect(() => {
    const el = box.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") return setNear(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "150% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  if (!ok || failed) return null;
  return (
    <div ref={box} id="model" className="mmodel">
      {near ? (
        <Suspense fallback={null}>
          <Story tour onFailed={onFailed} />
        </Suspense>
      ) : null}
    </div>
  );
}
