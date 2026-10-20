/** The existing converted photos in public/media (widths as converted; nothing new is generated for v3). */
const W: Record<string, number[]> = {
  "svc-patrol": [640, 960, 1280, 1920],
  "pilot-portrait": [480, 720, 960, 1280],
  "svc-canopy-thermal": [640, 960, 1280, 1920],
  "svc-canopy-visible": [640, 960, 1280, 1920],
  "svc-live-feed": [640, 960, 1280, 1920],
  "landing-report": [480, 800, 1200],
  "cta-ridge-smoke": [960, 1440, 1920, 2560],
  "statement-ground-and-sky": [640, 960, 1280, 1920],
};

export function photo(name: string, fallbackW?: number): { src: string; srcSet: string } {
  const ws = W[name] ?? [1280];
  const f = fallbackW ?? ws[Math.min(ws.length - 1, 2)];
  return {
    src: `/media/photos/${name}-${f}.webp`,
    srcSet: ws.map((w) => `/media/photos/${name}-${w}.webp ${w}w`).join(", "),
  };
}

const APP_W = [560, 840, 1120];
export function app(id: string, kind: "visible" | "thermal"): { src: string; srcSet: string } {
  return {
    src: `/media/apps/app-${id}-${kind}-840.webp`,
    srcSet: APP_W.map((w) => `/media/apps/app-${id}-${kind}-${w}.webp ${w}w`).join(", "),
  };
}
