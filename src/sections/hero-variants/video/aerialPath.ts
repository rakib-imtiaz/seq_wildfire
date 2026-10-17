import PATH from "./aerial-path.json";

/**
 * The stand-in clip's camera, as a function of time. render-standin.py renders the clip with the same numbers
 * (aerial-path.json) and the same formulas, so the thermal hotspot can follow the footage frame by frame.
 *
 * Coordinates: "frame" = fractions of the video frame (0..1, y down); "source" = fractions of the still the clip
 * was rendered from. The camera zooms and rolls about the anchor (the smoke base), which sits at (fx, fy) in frame.
 */
export type AerialPath = typeof PATH;

export interface Cam {
  /** zoom (source width / visible width) */
  z: number;
  /** where the anchor sits in the frame */
  fx: number;
  fy: number;
  /** roll, radians */
  th: number;
  /** the anchor in source fractions */
  ax: number;
  ay: number;
}

export const STAND_IN_PATH: AerialPath = PATH;

/** Camera at render time u (0 .. loop + fade). Mirrors cam() in render-standin.py. */
function camAt(p: AerialPath, u: number): Cam {
  const L = p.loop;
  const z = p.zoom.from * Math.pow(p.zoom.to / p.zoom.from, u / (L + p.fade));
  const ph = (2 * Math.PI * u) / L;
  return {
    z,
    fx: p.frame.x + p.drift.x * Math.sin(ph),
    fy: p.frame.y + p.drift.y * Math.sin(ph + p.drift.phaseY),
    th: ((p.roll.deg * Math.PI) / 180) * Math.sin(ph + p.roll.phase),
    ax: p.anchor.x,
    ay: p.anchor.y,
  };
}

const smooth01 = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/**
 * The camera the viewer sees at clip time t (video.currentTime). Over the first `fade` seconds the clip is a
 * crossfade of the move's tail (t + loop) into its head (t); drift and roll are periodic, so only the zoom differs
 * and the anchor stays put. The zoom is blended geometrically by the same weight.
 */
export function camForTime(p: AerialPath, t: number): Cam {
  const L = p.loop;
  const tt = ((t % L) + L) % L;
  const head = camAt(p, tt);
  if (tt >= p.fade) return head;
  const tail = camAt(p, tt + L);
  const w = smooth01(tt / p.fade);
  return { ...head, z: tail.z * Math.pow(head.z / tail.z, w) };
}

/** A fixed camera for a real clip with no known move: frame = source, hotspot pinned at (x, y). */
export function fixedCam(x: number, y: number): Cam {
  return { z: 1, fx: x, fy: y, th: 0, ax: x, ay: y };
}

/** Frame fractions -> source fractions. `aspect` is width / height of the frame (and of the source). */
export function frameToSource(c: Cam, u: number, v: number, aspect: number): [number, number] {
  const dx = (u - c.fx) * aspect;
  const dy = v - c.fy;
  const cs = Math.cos(c.th);
  const sn = Math.sin(c.th);
  return [c.ax + (cs * dx - sn * dy) / (c.z * aspect), c.ay + (sn * dx + cs * dy) / c.z];
}

/** Source fractions -> frame fractions (inverse of frameToSource). */
export function sourceToFrame(c: Cam, sx: number, sy: number, aspect: number): [number, number] {
  const qx = (sx - c.ax) * aspect * c.z;
  const qy = (sy - c.ay) * c.z;
  const cs = Math.cos(c.th);
  const sn = Math.sin(c.th);
  return [c.fx + (cs * qx + sn * qy) / aspect, c.fy + (-sn * qx + cs * qy)];
}
