import { useEffect, useRef, useState } from "react";
import { useMotion } from "../../lib/motion";
import { Hero } from "../Hero";
import "./hero-ambient.css";

/**
 * The ambient clip behind the hero (?hero=3). To swap in the real clip, overwrite these three files with the same
 * names (or point CLIP at new ones): a silent, seamless loop, H.264 yuv420p +faststart, 16:9.
 *   hi: 1920x1080 (desktop) · lo: 1280x720 (under 900 px wide, or Save-Data) · poster: the clip's first frame.
 * Framing the stage mask and the grade expect: sky and smoke in the top third, the smoke column left of centre (it
 * rises above the copy, clear of the table on the right), darker ground low. Motion slow; the loop seamless.
 */
const CLIP = {
  hi: "/media/video/hero-ambient-1080.mp4",
  lo: "/media/video/hero-ambient-720.mp4",
  poster: "/media/video/hero-ambient-poster.webp",
};

type NavConn = Navigator & { connection?: { saveData?: boolean } };

/** 720p under ~900 px wide or with Save-Data on; chosen once per mount (a resize never reloads the clip). */
function pickSrc(): string {
  if (typeof window === "undefined") return CLIP.hi;
  const small = window.matchMedia("(max-width: 899px)").matches;
  const saveData = !!(navigator as NavConn).connection?.saveData;
  return small || saveData ? CLIP.lo : CLIP.hi;
}

/**
 * Decorative backdrop: the poster always, the looping clip on top only with motion on. The clip plays only while
 * the hero is on screen and the tab is visible, and shows only once it really plays (a blocked autoplay keeps the
 * poster, never a play glyph).
 */
function AmbientVideo() {
  const motion = useMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src] = useState(pickSrc);
  const [shown, setShown] = useState(false);
  const [playing, setPlaying] = useState(false);

  // the poster may already be cached and decoded before React listens
  useEffect(() => {
    if (imgRef.current?.complete) setShown(true);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    const root = rootRef.current;
    if (!motion || !v || !root) return;
    v.muted = true;
    v.defaultMuted = true;
    let inView = true;
    const sync = () => {
      if (inView && !document.hidden) v.play()?.catch(() => {});
      else v.pause();
    };
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([e]) => {
            inView = e.isIntersecting;
            sync();
          })
        : null;
    io?.observe(root);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", sync);
      v.pause();
    };
  }, [motion]);

  return (
    <div ref={rootRef} className="amb" aria-hidden="true" data-shown={shown ? "" : undefined}>
      <div className="amb__media">
        <img ref={imgRef} className="amb__poster" src={CLIP.poster} alt="" decoding="async" onLoad={() => setShown(true)} />
        {motion && (
          <video
            ref={videoRef}
            className="amb__video"
            src={src}
            poster={CLIP.poster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            disablePictureInPicture
            disableRemotePlayback
            tabIndex={-1}
            data-playing={playing ? "" : undefined}
            onPlaying={() => {
              setPlaying(true);
              setShown(true);
            }}
          />
        )}
      </div>
      <div className="amb__grade" />
    </div>
  );
}

/** Variant 3 (?hero=3): the 3D command-table hero as is, with a dim, slow ambient clip behind the whole hero. */
export function HeroAmbient() {
  return <Hero className="hero--ambient" backdrop={<AmbientVideo />} />;
}
