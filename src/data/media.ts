/**
 * Photo slots. `expected` is the filename from prompts/IMAGE-PROMPTS.md (dropped into media/incoming/).
 * Until a photo exists, `src` stays null and the slot renders a dark generated placeholder.
 * To swap one in, set `src` (one line each), e.g. src: "/media/statement-ground-only.webp".
 */
export interface MediaSlot {
  expected: string;
  src: string | null;
  /** responsive webp set, when the photo has been converted at several widths */
  srcset?: string;
  alt: string;
}

export interface ThermalPairSlot {
  visible: MediaSlot;
  thermal: MediaSlot;
}

const slot = (expected: string, alt: string, src: string | null = null, srcset?: string): MediaSlot => ({ expected, src, srcset, alt });

/** Converted photos live at `${dir}/${name}-{560,840,1120}.webp` (from the user's PNGs in media/incoming/). */
const WIDTHS = [560, 840, 1120];
const webp = (dir: string, name: string): [string, string] => [
  `${dir}/${name}-1120.webp`,
  WIDTHS.map((w) => `${dir}/${name}-${w}.webp ${w}w`).join(", "),
];

const pair = (base: string, alt: string, dir?: string): ThermalPairSlot => ({
  visible: slot(`${base}-visible.png`, alt, ...(dir ? webp(dir, `${base}-visible`) : [null])),
  thermal: slot(`${base}-thermal.png`, `${alt} Thermal view.`, ...(dir ? webp(dir, `${base}-thermal`) : [null])),
});

export const MEDIA = {
  statementGroundOnly: slot("statement-ground-only.png", "A fire watch guard on a ridge at dusk scanning a forested valley."),
  statementGroundAndSky: slot("statement-ground-and-sky.png", "The same guard on the ridge with a thermal drone hovering ahead."),
  pilotPortrait: slot("pilot-portrait.png", "A guard-pilot running a pre-flight check on the tailgate of a pickup."),
  pilotController: slot("pilot-controller.png", "Gloved hands holding a drone controller at dusk."),
  svcPatrol: slot("svc-patrol.png", "A guard walking a gravel access road beside a transmission corridor at blue hour."),
  svcLiveFeed: slot("svc-live-feed.png", "Drone camera view over a forested ridge at dusk, with a thin smoke column rising from the trees."),
  standardsPreflight: slot("standards-preflight.png", "A drone pre-flight checklist, site map and radio laid out on a truck hood."),
  ctaRidgeSmoke: slot("cta-ridge-smoke.png", "Layered forested ridges at last light with a distant smoke column."),
  proposalHero: slot("proposal-hero.png", "A night operations table with a topographic map, radio and drone case."),
} satisfies Record<string, MediaSlot>;

export const PAIRS = {
  svcCanopy: {
    visible: slot("svc-canopy-visible.png", "Straight-down drone view of a conifer canopy with a small clearing."),
    thermal: slot("svc-canopy-thermal.png", "The same canopy in thermal view, with one hotspot."),
  },
  hydro: pair("app-hydro", "A concrete hydroelectric dam and powerhouse in a forested canyon at golden hour.", "/media/apps"),
  transmission: pair("app-transmission", "A cleared transmission corridor with lattice towers leading to a substation.", "/media/apps"),
  "remote-utility": pair("app-remote-utility", "A remote site trailer, generator and excavator on a gravel pad surrounded by pine forest.", "/media/apps"),
  industrial: pair("app-industrial", "A sawmill yard with log decks bordering a forested hillside.", "/media/apps"),
  forestry: pair("app-forestry", "A managed forestry block with standing timber, a logging road and a log loader.", "/media/apps"),
} satisfies Record<string, ThermalPairSlot>;
