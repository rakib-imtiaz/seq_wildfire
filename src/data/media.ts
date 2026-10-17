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

/** Converted photos live at `${dir}/${name}-${width}.webp` (from the user's PNGs in media/incoming/). */
const WIDTHS = [560, 840, 1120];
const webp = (dir: string, name: string, widths = WIDTHS, fallback = widths[widths.length - 1]): [string, string] => [
  `${dir}/${name}-${fallback}.webp`,
  widths.map((w) => `${dir}/${name}-${w}.webp ${w}w`).join(", "),
];

const W4 = [640, 960, 1280, 1920];
const WIDE = [960, 1440, 1920, 2560];
const photo = (expected: string, alt: string, widths: number[], fallback: number): MediaSlot =>
  slot(`${expected}.png`, alt, ...webp("/media/photos", expected, widths, fallback));

const pair = (base: string, alt: string, dir?: string): ThermalPairSlot => ({
  visible: slot(`${base}-visible.png`, alt, ...(dir ? webp(dir, `${base}-visible`) : [null])),
  thermal: slot(`${base}-thermal.png`, `${alt} Thermal view.`, ...(dir ? webp(dir, `${base}-thermal`) : [null])),
});

export const MEDIA = {
  statementGroundOnly: photo("statement-ground-only", "A fire watch guard on a ridge at dusk, scanning a forested valley with binoculars while smoke rises from a far ridge.", W4, 1280),
  statementGroundAndSky: photo("statement-ground-and-sky", "The same guard on the ridge flying a thermal drone out over the valley toward the smoke.", W4, 1280),
  pilotPortrait: photo("pilot-portrait", "A guard-pilot running a pre-flight check on a thermal drone on the tailgate of a pickup at golden hour.", [480, 720, 960, 1280], 960),
  svcPatrol: photo("svc-patrol", "A guard with a flashlight walking a gravel access road beside a transmission corridor at blue hour.", W4, 1280),
  svcLiveFeed: photo("svc-live-feed", "Drone camera view over a forested ridge at dusk, with a thin smoke column rising from the trees.", W4, 1280),
  // the zip's file was truncated after the top 40%: this is a 2:1 crop of the intact part until a full copy arrives
  standardsPreflight: photo("standards-preflight", "A drone pre-flight checklist and a folded drone on the hood of a truck at dusk.", [560, 840, 1112], 1112),
  ctaRidgeSmoke: photo("cta-ridge-smoke", "Layered forested ridges at last light, with a transmission line and a distant smoke column.", WIDE, 1920),
  proposalHero: photo("proposal-hero", "A night operations table with a topographic map, radio, tablet and drone case under a desk lamp.", WIDE, 1920),
} satisfies Record<string, MediaSlot>;

export const PAIRS = {
  svcCanopy: {
    visible: photo("svc-canopy-visible", "Straight-down drone view of a conifer canopy with a smouldering stump in a small clearing.", W4, 1280),
    thermal: photo("svc-canopy-thermal", "The same canopy in thermal view, with the stump as the hotspot.", W4, 1280),
  },
  hydro: pair("app-hydro", "A concrete hydroelectric dam and powerhouse in a forested canyon at golden hour.", "/media/apps"),
  transmission: pair("app-transmission", "A cleared transmission corridor with lattice towers leading to a substation.", "/media/apps"),
  "remote-utility": pair("app-remote-utility", "A remote site trailer, generator and excavator on a gravel pad surrounded by pine forest.", "/media/apps"),
  industrial: pair("app-industrial", "A sawmill yard with log decks bordering a forested hillside.", "/media/apps"),
  forestry: pair("app-forestry", "A managed forestry block with standing timber, a logging road and a log loader.", "/media/apps"),
} satisfies Record<string, ThermalPairSlot>;
