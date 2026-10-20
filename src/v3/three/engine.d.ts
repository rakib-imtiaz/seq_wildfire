import type { Zone } from "../../lib/zone";

export type LensId = "all" | "wide" | "tele" | "thermal";

export interface LabelPoint {
  /** canvas CSS px */
  x: number;
  y: number;
  /** 0..1 visibility (beat window, on screen) */
  a: number;
}

/** the thermal inset: its rect in view CSS px, visibility, and the hotspot as the lens sees it (inset px) */
export interface InsetInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  a: number;
  hx: number;
  hy: number;
}

export interface FrameInfo {
  P: number;
  labels: Record<string, LabelPoint>;
  layout: "wide" | "tall";
  ir: InsetInfo;
}

export interface Still {
  url: string;
  labels: Record<string, LabelPoint>;
  w: number;
  h: number;
  ir: InsetInfo;
}

export interface Maquette {
  canvas: HTMLCanvasElement;
  beats: string[];
  setProgress(P: number): void;
  jump(P: number): void;
  setLens(id: LensId): void;
  /** the report card's share of the view height; the closing shot frames the model above it */
  setReserve(fraction: number): void;
  start(): void;
  stop(): void;
  onFrame(cb: (f: FrameInfo) => void): () => void;
  resize(): void;
  /** `full`: the closing shot without room kept for the report card (the static story sets it beside) */
  renderStill(P: number, w: number, h: number, o?: { lens?: LensId; layout?: "wide" | "tall"; full?: boolean }): Promise<Still>;
  stats(): Record<string, unknown>;
  debug: Record<string, unknown>;
  dispose(): void;
}

export interface MaquetteOptions {
  zone: Zone;
  quality?: "balanced" | "high";
  /** false: render on demand only (stills); true: a live loop with the continuous clock */
  live?: boolean;
  /** keep the drawing buffer (review captures) */
  preserve?: boolean;
  onLost?: () => void;
}

export function createMaquette(canvas: HTMLCanvasElement, opts: MaquetteOptions): Promise<Maquette>;
export function webglAvailable(): boolean;
