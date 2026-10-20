import { LENSES, STANDOFF, footprint } from "../three/optics.js";

/**
 * Every visible string on the main page (v3). Each one traces to FACTS.md (the brief §1, business details §2, M3T specs §3).
 * Proposal verbs only ("will", "designed to", "aims to", "where authorized"). Every readout, map, timestamp and
 * report is labelled SAMPLE. No em or en dashes.
 */

export const CTA = { label: "Request a proposal", href: "/proposal" } as const;

export const CONTACT = {
  phone: "250-879-6055",
  tel: "tel:+12508796055",
  address: ["293 Arrowstone Drive", "Kamloops, BC V2C 1P8"],
  guarding: { label: "Guarding services at sequoiasecurity.ca", href: "https://sequoiasecurity.ca" },
} as const;

/** the header's links to the page's sections */
export const NAV = [
  { href: "#story", id: "story", label: "How it works" },
  { href: "#services", id: "services", label: "Services" },
  { href: "#applications", id: "applications", label: "Applications" },
  { href: "#why", id: "why", label: "Why Sequoia" },
  { href: "#careers", id: "careers", label: "Careers" },
] as const;

export type BeatId = "hero" | "lenses" | "coverage" | "team" | "heat" | "map" | "report";

/** one row of a beat's fact sheet: a name and a value (mono for specs), a legend swatch, or a lens it belongs to */
export interface Fact {
  k: string;
  v: string;
  /** set the value in the spec face (numbers) */
  spec?: boolean;
  /** legend: the route's line style on the 3D */
  swatch?: "solid" | "dashed";
  /** coverage rows light up with their lens */
  lens?: "wide" | "tele" | "thermal";
  sample?: boolean;
}

export interface Beat {
  id: BeatId;
  /** short name for the next control */
  name: string;
  title: string;
  /** hero only: the second line of the tagline */
  title2?: string;
  line: string;
  /** the fact sheet under the line */
  facts?: Fact[];
  /** a short caption under the facts */
  note?: string;
  /** a list of items (report contents) */
  chips?: { label: string; items: string[] };
}

/** the three footprints at the SAMPLE hover, square to the slope (optics.js: FACTS §3 FOVs, STANDOFF) */
const fp = (i: number) => footprint(LENSES[i], STANDOFF).map((v) => Math.round(v)).join(" × ") + " m";

// The text-economy pass (2026-10-21, the user: "reduce the text all over the website, dont make it text heavy"):
// one short line per beat, at most three spec rows, no notes. Every claim still traces to FACTS.md.
export const BEATS: Beat[] = [
  {
    id: "hero",
    name: "Overview",
    // brief: "Tagline: Beyond Traditional Fire Watch. Intelligence From Above."
    title: "Beyond traditional fire watch",
    title2: "Intelligence from above",
    // brief: every fire watch guard will also be trained and certified as a TC Advanced Operations drone pilot
    line: "Every fire watch guard, also a certified drone pilot.",
    facts: [
      { k: "Where", v: "British Columbia" },
      { k: "Status", v: "Proposed service" },
    ],
  },
  {
    id: "lenses",
    name: "Three lenses",
    title: "Three lenses",
    line: "Wide, tele and thermal in one gimbal.",
    // FACTS §3
    facts: [
      { k: "Wide", v: "48 MP · 84°", spec: true },
      { k: "Tele", v: "12 MP · 56× hybrid zoom", spec: true },
      { k: "Thermal", v: "640 × 512 · 61°", spec: true },
    ],
  },
  {
    id: "coverage",
    name: "Coverage",
    title: "What each lens covers",
    line: "Drawn to scale. Pick a lens.",
    // the footprints at the SAMPLE hover (optics.js)
    facts: [
      { k: "Wide", v: fp(0), spec: true, lens: "wide" },
      { k: "Tele", v: fp(1), spec: true, lens: "tele" },
      { k: "Thermal", v: fp(2), spec: true, lens: "thermal" },
    ],
  },
  {
    id: "team",
    name: "One team",
    title: "Ground and sky, one team",
    // brief, Why: one integrated field team
    line: "One field team, on the ground and in the air.",
    // brief steps 1 and 2
    facts: [
      { k: "Ground monitoring", v: "Routine site patrols", swatch: "solid" },
      { k: "Aerial inspection", v: "Certified pilots, where permitted", swatch: "dashed" },
    ],
  },
  {
    id: "heat",
    name: "Thermal detection",
    title: "Thermal detection",
    // brief step 3
    line: "Visible and thermal imagery to spot heat signatures.",
    // FACTS §3; the reading is the SAMPLE hotspot
    facts: [
      { k: "Sensor", v: "640 × 512 thermal", spec: true },
      { k: "Hotspot", v: "312 °C", spec: true, sample: true },
    ],
  },
  {
    id: "map",
    name: "Digital mapping",
    title: "Digital mapping",
    // brief step 4
    line: "Every observation, geotagged on one map.",
    facts: [{ k: "Layers", v: "Hotspots, patrols, drone observations, assets" }],
  },
  {
    id: "report",
    name: "Reporting",
    title: "Reporting and coordination",
    // brief step 5
    line: "Verified reports for authorized client representatives and emergency authorities.",
    chips: {
      label: "Each report can include",
      items: ["Flight records", "Thermal observations", "Geotagged imagery", "Timestamps"],
    },
  },
];

/** FACTS §3 */
export const LENS_LABELS = {
  wide: "Wide 48 MP",
  tele: "Tele 12 MP",
  thermal: "Thermal 640 × 512",
} as const;

export const LENS_BUTTONS = [
  { id: "wide", name: "Wide", fov: "84°" },
  { id: "tele", name: "Tele", fov: "15°" },
  { id: "thermal", name: "Thermal", fov: "61°" },
] as const;

/** On-canvas labels. The two step names come from the brief's "How Our Service Works". */
export const CANVAS_LABELS = {
  fpWide: "Wide",
  fpTele: "Tele",
  fpThermal: "Thermal",
  // the SAMPLE hover: three/optics.js STANDOFF, 77 m out from the ~37° slope along its normal; the engine's stats().agl
  craft: "M3T",
  craftSub: "100 m above ground",
  patrol: "Ground monitoring",
  flight: "Aerial inspection",
  hotspot: "SAMPLE 312 °C",
  launch: "Launch",
} as const;

/** the fictional site's assets, named on the 3D in the overviews */
export const ASSET_LABELS = {
  aDam: "Dam",
  aReservoir: "Reservoir",
  aPowerhouse: "Powerhouse",
  aRoad: "Access road",
  aLine: "Transmission line",
  aSubstation: "Substation",
} as const;

/** the thermal inset's readouts (FACTS §3: Iron Red palette, low gain 0 to 500 °C; the scale is the inset's own
 *  SAMPLE gain, plaster.js mqGain) */
export const THERMAL_VIEW = {
  lens: "Thermal",
  palette: "Iron Red",
  gain: "Low gain",
  spot: "312 °C",
  scale: ["6", "60", "300 °C"],
} as const;

/** SAMPLE observations on the fictional local grid (zone.js observations 0, 2, 4; e = x, n = −z) */
export const OBSERVATIONS = [
  { id: "obs0", time: "20:16", grid: "E 320 N 232" },
  { id: "obs1", time: "20:19", grid: "E 468 N 296" },
  { id: "obs2", time: "20:23", grid: "E 405 N 178" },
] as const;

export const SAMPLE_NOTE = "SAMPLE data, fictional watch zone";

/** brief, Service 5: "flight records, thermal observations, geotagged imagery, incident locations, timestamps, and
 * follow-up recommendations"; step 5's two audiences. All values are SAMPLE. */
export const REPORT = {
  title: "Incident report",
  zone: "Watch zone 07, fictional",
  rows: [
    { k: "Flight", v: "M3T, 20:11 to 20:26" },
    { k: "Thermal", v: "312 °C spot reading" },
    { k: "Location", v: "E 395 N 250" },
  ],
} as const;

/** brief, Our Core Services (titles verbatim, one line each, cut) */
export const SERVICES = [
  {
    id: "patrol",
    title: "Advanced fire watch and ground security",
    line: "Scheduled patrols that watch ignition sources and document site conditions.",
    img: "svc-patrol",
    alt: "A guard with a flashlight walking a gravel access road beside a transmission corridor at blue hour.",
  },
  {
    id: "thermal",
    title: "Thermal drone surveillance",
    line: "Authorized operators will monitor designated areas from the air, in thermal.",
    img: "pilot-portrait",
    alt: "A guard-pilot running a pre-flight check on a thermal drone on the tailgate of a pickup at golden hour.",
  },
  {
    id: "mapping",
    title: "Interactive wildfire mapping",
    line: "Drone imagery and georeferenced observations on one digital map.",
    img: "svc-canopy-thermal",
    alt: "A conifer canopy seen straight down in thermal view, a smouldering stump as the hotspot.",
  },
  {
    id: "live",
    title: "Live aerial situational awareness",
    line: "Where authorized and supported, live drone footage for monitoring personnel.",
    img: "svc-live-feed",
    alt: "Drone camera view over a forested ridge at dusk, with a thin smoke column rising from the trees.",
  },
  {
    id: "reporting",
    title: "Emergency documentation and reporting",
    line: "Flight records, thermal observations, geotagged images and timestamps.",
    img: "landing-report",
    alt: "A rugged tablet and a radio on a topographic map under a work lamp.",
  },
] as const;

/** brief, Designed for Critical Infrastructure */
export const APPLICATIONS = [
  { id: "hydro", title: "Hydroelectric dams and generating stations", alt: "A concrete hydroelectric dam and powerhouse in a forested canyon at golden hour." },
  { id: "transmission", title: "Transmission corridors and substations", alt: "A cleared transmission corridor with lattice towers leading to a substation." },
  { id: "remote-utility", title: "Remote utility facilities and construction", alt: "A remote site trailer, generator and excavator on a gravel pad in pine forest." },
  { id: "industrial", title: "Industrial operations near forest", alt: "A sawmill yard with log decks bordering a forested hillside." },
  { id: "forestry", title: "Forestry assets and high-risk properties", alt: "A managed forestry block with standing timber, a logging road and a log loader." },
] as const;

export const WHY = {
  // brief: "Traditional fire watch observes. Sequoia Security is designed to observe, detect, map, and report."
  a: "Traditional fire watch observes.",
  b: "Sequoia Security is designed to observe, detect, map, and report.",
  lead: "The proposed service aims to deliver",
  key: "One integrated field team instead of separately contracted security and drone monitoring personnel.",
  points: [
    "Expanded visibility of monitoring areas.",
    "Faster investigation of potential fire hazards.",
    "Location-specific mapping and reporting.",
  ],
} as const;

/** brief, Our Commitment */
export const COMMITMENT =
  "All drone operations will follow Transport Canada requirements, airspace restrictions and site permissions, coordinated with the appropriate wildfire authorities.";

/** brief sign-off */
export const SIGNOFF = "Protecting critical infrastructure from the ground and the sky";

/** brief: "Sequoia Security is developing a next-generation wildfire monitoring and fire watch service" */
export const FOOTNOTE =
  "A proposed service in development. All maps and readings shown are SAMPLE data.";

/** Careers: the client's recruiting post (FACTS §6) as a job listing; apply by email (the user's address) */
export const CAREERS = {
  label: "Careers",
  title: "We're recruiting",
  lead: "No drone experience needed. We train you.",
  openLabel: "open role",
  kicker: "Now hiring",
  role: "Security guard + drone pilot",
  terms: ["British Columbia", "Seasonal / project-based", "Drone training provided"],
  cols: [
    { k: "The role", items: ["Fire watch and security patrols.", "Thermal drone work, once certified."] },
    { k: "Requirements", items: ["Valid BC Security Worker Licence.", "Comfortable at remote outdoor sites."] },
    { k: "We provide", items: ["Transport Canada Advanced drone training.", "Enterprise thermal drones."] },
  ],
  steps: [
    { t: "Apply", d: "Resume and a short intro." },
    { t: "Train", d: "Drone certification." },
    { t: "Deploy", d: "Fire watch on site." },
  ],
  apply: {
    k: "How to apply",
    how: "Email your resume and a short intro.",
    label: "Apply by email",
    email: "career@sequoiaservices.ca",
    href: "mailto:career@sequoiaservices.ca?subject=Application%3A%20Security%20guard%20%2B%20drone%20pilot",
  },
} as const;
