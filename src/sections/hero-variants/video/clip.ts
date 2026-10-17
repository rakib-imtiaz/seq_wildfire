import { STAND_IN_PATH, type AerialPath } from "./aerialPath";

/**
 * The hero aerial clip (variant 1, ?hero=1). Files live in public/media/video/.
 *
 * SWAP IN THE REAL CLIP (one line): drop the generated files in as
 *   hero-aerial-real-1080.mp4, hero-aerial-real-720.mp4, hero-aerial-real-poster.webp (its first frame)
 * and change the last line of this file to `export const AERIAL: AerialClip = REAL;`
 * If the smoke base in the real clip does not sit at about (0.575, 0.55) of the frame, adjust REAL.hotspot.
 *
 * ADD A REAL THERMAL CLIP (one line): put the frame-matched thermal render next to it, e.g.
 *   hero-aerial-thermal-1080.mp4 / hero-aerial-thermal-720.mp4 (same framing, length and frame rate),
 * and set `thermal: THERMAL` in REAL (or STAND_IN). The lens then shows that clip instead of the synthetic heat.
 */
export interface AerialClip {
  hd: string;
  sd: string;
  poster: string;
  /** optional half-size poster for narrow screens */
  posterSmall: string | null;
  /** optional real thermal clip, frame-matched to the visible one */
  thermal: { hd: string; sd: string; mode: "color" | "gray" } | null;
  /** the stand-in's camera move (the hotspot tracks it), or null for a real clip: hotspot pinned at `hotspot` */
  path: AerialPath | null;
  /** smoke base in frame fractions, for a clip without a path */
  hotspot: { x: number; y: number };
  /** frame width / height */
  aspect: number;
  /** what the footage shows, for the stage's aria-label */
  label: string;
}

const DIR = "/media/video";
const LABEL =
  "Sample aerial footage: a drone glides over forested British Columbia ridges at dusk toward a thin column of smoke, inspected through a thermal lens.";

/** Frame-matched thermal render, when it exists. mode "color": already in a palette; "gray": white-hot. */
export const THERMAL: NonNullable<AerialClip["thermal"]> = {
  hd: `${DIR}/hero-aerial-thermal-1080.mp4`,
  sd: `${DIR}/hero-aerial-thermal-720.mp4`,
  mode: "color",
};

/** Stand-in: a slow push-in on the user's still (svc-live-feed), rendered by render-standin.py. */
export const STAND_IN: AerialClip = {
  hd: `${DIR}/hero-aerial-1080.mp4`,
  sd: `${DIR}/hero-aerial-720.mp4`,
  poster: `${DIR}/hero-aerial-poster.webp`,
  posterSmall: `${DIR}/hero-aerial-poster-960.webp`,
  thermal: null,
  path: STAND_IN_PATH,
  hotspot: { x: STAND_IN_PATH.frame.x, y: STAND_IN_PATH.frame.y },
  aspect: STAND_IN_PATH.out.w / STAND_IN_PATH.out.h,
  label: LABEL,
};

/** The real AI clip, once generated (see the note above). */
export const REAL: AerialClip = {
  hd: `${DIR}/hero-aerial-real-1080.mp4`,
  sd: `${DIR}/hero-aerial-real-720.mp4`,
  poster: `${DIR}/hero-aerial-real-poster.webp`,
  posterSmall: null,
  thermal: null,
  path: null,
  hotspot: { x: 0.575, y: 0.55 },
  aspect: 16 / 9,
  label: LABEL,
};

export const AERIAL: AerialClip = STAND_IN;
