import { flags, motionOn } from "./motion";

/**
 * Mount contract for the WebGL command table (public/table/js/table.js).
 *
 *   mountTable(container, { mode: 'hero' | 'steps', onReady?, onStep?, onLens?, motion? }) => TableHandle
 *
 *   setProgress(u)        steps: u in 0..1 across the pinned "How it works" track (step k is the k-th fifth;
 *                         each step's action completes by its centre; the camera glides on in its last quarter)
 *   setStep(n, {instant}) 0 = the hero state, 1..5 = the five steps (ignored once the page drives u by scroll)
 *   setLens({x, y, r, active})  hero only. x, y 0..1 of the container (origin top-left); r = the ring's radius as
 *                         a fraction of the container width. Returns { maxC, e, n }: maxC from the 3D thermal field
 *                         under the lens (SAMPLE), e / n on the fictional local grid.
 *   getHotspot()          hero: { x, y, visible, rest, inward } (0..1 of the container): where the hidden hotspot is
 *                         on screen, where the lens should rest (centred on it; the framing leaves it room) and the
 *                         slab's interior direction from there (for an idle sweep that stays on the land). null
 *                         until the container has a real size.
 *   setInsets({top, bottom, left, right})  steps: px the 3D's own DOM labels keep clear of (badge, caption card)
 *   setInsets({top, avoid, lens, margin, leftLimit})  hero: the fixed header's height, the copy block [x0, y0, x1,
 *                         y1] (px of the container) the slab must stay clear of, the lens radius (px), the slab's
 *                         clearance from the stage edges (px) and its left limit (fraction of the width: 0.44 keeps
 *                         it in the right 56 %); the hero framing (a low oblique, the whole slab) is solved from these
 *   resize()              when the container size changes (the module also watches it)
 *   dispose()             on unmount
 *
 * One WebGL engine serves both mounts: the canvas lives in whichever section is most on screen; the other keeps a
 * still of its last frame. Loading happens after first paint at idle; any failure is swallowed and the rendered
 * stills (TABLE_STILLS) simply stay. `?q=lite` and no-WebGL never load the 3D.
 */
export interface LensReadout {
  maxC?: number;
  /** fictional local grid, metres east / north of the zone origin */
  e?: number;
  n?: number;
}

export interface Insets {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  /** hero: the copy block, px of the container: [x0, y0, x1, y1] (null: none) */
  avoid?: [number, number, number, number] | null;
  /** hero: the lens ring's radius, px */
  lens?: number;
  /** hero: px the whole slab keeps clear of the stage's edges */
  margin?: number;
  /** hero: the slab's left limit as a fraction of the stage width (0.44: the right 56 %) */
  leftLimit?: number;
}

export interface HotspotInfo {
  x: number;
  y: number;
  visible?: boolean;
  /** hero: where the lens rests (0..1 of the container) */
  rest?: { x: number; y: number };
  /** hero: unit direction (screen) from the rest point into the slab */
  inward?: { x: number; y: number };
}

export interface TableHandle {
  setProgress?(u: number): void;
  setStep?(n: number, o?: { instant?: boolean }): void;
  setLens?(l: { x: number; y: number; r?: number; active: boolean }): LensReadout | void;
  getHotspot?(): HotspotInfo | null | undefined;
  setInsets?(i: Insets): void;
  resize?(): void;
  dispose?(): void;
}

export interface MountOptions {
  mode: "hero" | "steps";
  onReady?: () => void;
  onStep?: (n: number) => void;
  onLens?: (r: LensReadout) => void;
  /** false under ?motion=0 / reduced motion: render the final, static state */
  motion?: boolean;
}

/**
 * Stills rendered from the 3D scene itself (public/media/table, made with public/table/stills.html), so the poster,
 * the lite tier and the no-WebGL path always match the live table.
 *   hero-{desk|sq|tall|tab|phone}-{visible|thermal}.webp, hero-{...}.json (hotspot + a coarse SAMPLE readout grid)
 *   (desk, sq, tall: the desktop layout, copy bottom-left, at aspect >= 1.3, 0.85..1.3, < 0.85)
 *   step{1..5}-{desk|phone}.webp
 */
export type HeroVariant = "desk" | "sq" | "tall" | "tab" | "phone";

export const TABLE_STILLS = {
  hero: (v: HeroVariant, kind: "visible" | "thermal") => `/media/table/hero-${v}-${kind}.webp`,
  heroData: (v: HeroVariant) => `/media/table/hero-${v}.json`,
  step: (n: number, v: "desk" | "phone") => `/media/table/step${n}-${v}.webp`,
};

/** The hero still's readout data: the hotspot (0..1 of the image) and a grid of SAMPLE maxima / grid positions. */
export interface HeroStillData {
  w: number;
  h: number;
  hotspot: { x: number; y: number };
  /** where the lens rests (0..1 of the image) */
  rest?: { x: number; y: number };
  inward?: { x: number; y: number };
  grid: { cols: number; rows: number; maxC: number[]; e: (number | null)[]; n: (number | null)[] };
}

type TableModule = { mountTable: (el: HTMLElement, o: MountOptions) => TableHandle };
type M3TModule = { mountM3T: (el: HTMLElement, o: { onReady?: () => void; motion?: boolean }) => TableHandle };

// absolute URLs: see the note in zone.ts about Vite's `?import` rewrite of root-relative dynamic imports
const TABLE_URL = new URL("/table/js/table.js", window.location.origin).href;
const M3T_URL = new URL("/table/js/m3t.js", window.location.origin).href;

let tablePromise: Promise<TableModule | null> | null = null;
let m3tPromise: Promise<M3TModule | null> | null = null;

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Resolve after first paint, at idle. */
export function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    const idle = (cb: () => void) => {
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 2500 });
      else window.setTimeout(cb, 400);
    };
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      idle(resolve);
    };
    requestAnimationFrame(() => requestAnimationFrame(go));
    window.setTimeout(go, 600); // background tabs never fire rAF
  });
}

export function loadTableModule(): Promise<TableModule | null> {
  if (flags.lite) return Promise.resolve(null);
  if (!tablePromise) {
    tablePromise = afterPaint()
      .then(() => (hasWebGL() ? import(/* @vite-ignore */ TABLE_URL) : null))
      .then((m: Partial<TableModule> | null) => (m && typeof m.mountTable === "function" ? (m as TableModule) : null))
      .catch(() => null);
  }
  return tablePromise;
}

export function loadM3TModule(): Promise<M3TModule | null> {
  if (flags.lite) return Promise.resolve(null);
  if (!m3tPromise) {
    m3tPromise = afterPaint()
      .then(() => (hasWebGL() ? import(/* @vite-ignore */ M3T_URL) : null))
      .then((m: Partial<M3TModule> | null) => (m && typeof m.mountM3T === "function" ? (m as M3TModule) : null))
      .catch(() => null);
  }
  return m3tPromise;
}

/**
 * Mount the table into `el`. Returns a disposer. `onHandle` receives the live handle once mounted; it is never
 * called if the module is missing or throws.
 */
export function mountTableInto(
  el: HTMLElement,
  opts: Omit<MountOptions, "motion">,
  onHandle: (h: TableHandle) => void,
): () => void {
  let disposed = false;
  let handle: TableHandle | null = null;
  let ro: ResizeObserver | null = null;
  loadTableModule().then((mod) => {
    if (!mod || disposed) return;
    try {
      handle = mod.mountTable(el, { ...opts, motion: motionOn() }) ?? null;
    } catch (err) {
      handle = null;
      if (import.meta.env.DEV) console.info("[table] mount failed, keeping the placeholder", err);
      return;
    }
    if (!handle) return;
    onHandle(handle);
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        try {
          handle?.resize?.();
        } catch {
          /* keep going */
        }
      });
      ro.observe(el);
    }
  });
  return () => {
    disposed = true;
    ro?.disconnect();
    try {
      handle?.dispose?.();
    } catch {
      /* ignore */
    }
    handle = null;
  };
}

/** Call a handle method without letting a 3D error break the page. */
export function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
