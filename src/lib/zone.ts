import { useEffect, useState } from "react";

/**
 * Typed loader for the shared fictional watch zone (public/table/js/zone.js, owned by the 3D side, read-only here).
 * It has no imports, so a plain dynamic import works in dev and in production.
 */
export type Pt = [number, number];

export interface Zone {
  size: Pt;
  name: string;
  origin: { e: number; n: number };
  river: Pt[];
  reservoir: Pt[];
  dam: { x: number; z: number; rot: number; crest: number; height: number; spillwayGates: number };
  powerhouse: { x: number; z: number; rot: number; w: number; d: number; h: number };
  switchyard: { x: number; z: number; w: number; d: number };
  towers: Pt[];
  substation: { x: number; z: number; w: number; d: number; rot: number };
  road: Pt[];
  roadBranch: Pt[];
  truckStart: { x: number; z: number; heading: number };
  patrol: Pt[];
  checkpoints: { i: number; t: string }[];
  hotspot: { x: number; z: number; peakC: number };
  perimeters: { t: string; pts: Pt[] }[];
  escalation: Pt[];
  observations: Pt[];
  flight: Pt[];
}

export interface ZoneModule {
  ZONE: Zone;
  IRONBOW: string[];
}

/**
 * Absolute URL on purpose: Vite's dev server rewrites root-relative dynamic imports with `?import`, which routes
 * public files through its transform pipeline and fails. A full URL is fetched as-is in dev and in production.
 */
const publicUrl = (path: string) => new URL(path, window.location.origin).href;
const ZONE_URL = publicUrl("/table/js/zone.js");
let pending: Promise<ZoneModule | null> | null = null;
let cached: ZoneModule | null = null;

export function loadZone(): Promise<ZoneModule | null> {
  if (!pending) {
    pending = import(/* @vite-ignore */ ZONE_URL)
      .then((m: Partial<ZoneModule>) => {
        if (!m || !m.ZONE) return null;
        cached = { ZONE: m.ZONE, IRONBOW: m.IRONBOW ?? IRONBOW_FALLBACK };
        return cached;
      })
      .catch(() => null);
  }
  return pending;
}

export function useZone(): Zone | null {
  const [z, setZ] = useState<Zone | null>(cached?.ZONE ?? null);
  useEffect(() => {
    if (cached) {
      setZ(cached.ZONE);
      return;
    }
    let live = true;
    loadZone().then((m) => {
      if (live && m) setZ(m.ZONE);
    });
    return () => {
      live = false;
    };
  }, []);
  return z;
}

/** Same values as zone.js IRONBOW; used only before/if the module is unavailable. */
export const IRONBOW_FALLBACK = ["#14002e", "#4a0c6a", "#a2195b", "#e8452c", "#ff9e1b", "#ffe6a0", "#ffffff"];

/** Local grid readout (fictional, metres from the zone origin). North is -z. */
export function gridLabel(x: number, z: number): { e: string; n: string } {
  const e = Math.round(x);
  const n = Math.round(-z);
  const f = (v: number) => (v < 0 ? "−" : "+") + String(Math.abs(v)).padStart(4, "0");
  return { e: f(e), n: f(n) };
}
