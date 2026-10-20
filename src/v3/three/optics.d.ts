export interface Lens {
  id: "wide" | "tele" | "thermal";
  dfov: number;
  aspect: number;
  /** tan of the horizontal and vertical half-angles */
  th: number;
  tv: number;
  vfov: number;
}
export const LENSES: Lens[];
export const LENS_INDEX: Record<Lens["id"], number>;
export const STANDOFF: number;
export function footprint(L: Lens, d: number): [number, number];
