/**
 * All site copy. Every line traces to FACTS.md (section in brackets). Brief em dashes become colons or commas.
 * Demo numbers come from public/table/js/zone.js and are always shown with a SAMPLE label.
 */

export const BUSINESS = {
  name: "Sequoia Security", // §2
  street: "293 Arrowstone Drive", // §2
  city: "Kamloops, BC V2C 1P8", // §2
  phone: "250-879-6055", // §2
  phoneHref: "tel:+12508796055", // §2
  mainSite: "sequoiasecurity.ca", // §2
  mainSiteHref: "https://sequoiasecurity.ca",
  // email: [TK] until the client confirms (§2). Never shown.
} as const;

export const TAGLINE = "Beyond traditional fire watch. Intelligence from above."; // §1 tagline
export const SIGNOFF = "Protecting critical infrastructure from the ground and the sky."; // §1 sign-off
export const CTA_LONG = "Request a Wildfire Monitoring Proposal"; // §1 call to action
export const CTA_SHORT = "Request a proposal";
export const SERVICE_NAME = "Drone-Enhanced Wildfire Monitoring & Fire Watch Services"; // §1 title
export const DESCRIPTOR = "Wildfire monitoring & fire watch";

export const HERO = {
  eyebrow: SERVICE_NAME,
  title: ["Beyond traditional", "fire watch.", "Intelligence", "from above."],
  // §1 Service Overview, para 1
  lead:
    "Sequoia Security is developing a wildfire monitoring and fire watch service designed for utility companies, hydroelectric facilities, energy infrastructure, forestry operations, and remote industrial sites throughout British Columbia.",
};

export const STATEMENT = {
  // §1 Why Sequoia Security, bold line
  a: "Traditional fire watch observes.",
  b: "Sequoia Security is designed to observe, detect, map, and report.",
  verbs: ["Observe", "Detect", "Map", "Report"],
  // §1 Service Overview, paras 2 to 4
  traditional:
    "Traditional fire watch services rely primarily on security personnel conducting ground-level patrols, visually identifying smoke or fire, and reporting potential hazards.",
  approach: "Our approach takes fire watch operations beyond ground-level observation.",
  objective:
    "The objective is to transform conventional fire watch services into a technology-enabled wildfire intelligence operation.",
  pair: [
    { tag: "Ground only", note: "Ground-level patrols and visual identification" },
    { tag: "Ground + sky", note: "Ground patrols combined with aerial thermal imaging" },
  ],
};

export const HOW = {
  title: "How our service works", // §1 heading
  // §1 Service Overview, para 4
  intro:
    "Combining ground patrols with aerial thermal imaging, our personnel will be able to inspect designated monitoring areas, identify potential heat anomalies, document fire-related hazards, and provide geographically referenced information to incident coordinators.",
  steps: [
    {
      n: 1,
      title: "Ground monitoring",
      text: "Security personnel conduct routine patrols and assess potential fire hazards across designated facilities and surrounding areas.",
      stamp: ["T+00:00:00", "Patrol start", "CP-01 19:42"],
    },
    {
      n: 2,
      title: "Aerial inspection",
      text: "Where legally permitted and operationally safe, certified drone pilots deploy thermal-equipped aircraft to inspect areas of concern.",
      stamp: ["T+00:09:12", "M3T launch", "5 obs points"],
    },
    {
      n: 3,
      title: "Thermal detection",
      text: "Drone cameras capture visible-light and thermal imagery to identify potential heat signatures and document observable fire-related conditions.",
      stamp: ["T+00:14:32", "Max 312 °C", "Thermal 640×512"],
    },
    {
      n: 4,
      title: "Digital mapping",
      text: "Observations are geotagged and incorporated into a centralized geographic monitoring dashboard.",
      stamp: ["T+00:25:00", "6 map layers", "Geotagged"],
    },
    {
      n: 5,
      title: "Reporting & coordination",
      text: "Verified information is shared with authorized client representatives and relevant emergency authorities through established procedures.",
      stamp: ["T+00:50:00", "Report compiled", "Shared"],
    },
  ],
};

export const PILOT = {
  title: "Every fire watch guard is also a pilot",
  // §1 Service Overview, para 3
  text: "Under our proposed deployment model, every designated fire watch security guard will also be trained and certified as a Transport Canada Advanced Operations drone pilot and equipped with a DJI Mavic 3 Thermal (M3T) enterprise drone.",
  cert: "Transport Canada Advanced Operations", // §4, plain text, no logo
  aircraft: "DJI Mavic 3 Thermal (M3T)", // §3, plain text, no logo
  specSource: "Manufacturer specifications", // §3 source: DJI spec page
  // §3 only
  specs: [
    { k: "Thermal", v: "640 × 512" },
    { k: "Pixel pitch", v: "12 μm" },
    { k: "Thermal lens", v: "40 mm eq." },
    { k: "DFOV", v: "61°" },
    { k: "High gain", v: "−20 to 150 °C" },
    { k: "Low gain", v: "0 to 500 °C" },
    { k: "Wide", v: "48 MP" },
    { k: "Tele", v: "12 MP, 162 mm eq." },
    { k: "Hybrid zoom", v: "Up to 56×" },
    { k: "Flight time", v: "Up to 45 min" },
    { k: "Weight", v: "920 g" },
  ],
  // §3 dimensions, used on the schematic
  dims: { unfolded: "347.5 × 283 × 107.7 mm", folded: "221 × 96.3 × 90.3 mm" },
};

export const SERVICES = {
  title: "Our core services", // §1 heading
  items: [
    {
      n: "01",
      title: "Advanced Fire Watch & Ground Security",
      text: "Trained security personnel conduct scheduled patrols, observe potential ignition sources, monitor high-risk areas, and document site conditions. Personnel follow established reporting and emergency escalation procedures.",
    },
    {
      n: "02",
      title: "Thermal Drone Surveillance",
      text: "Using DJI Mavic 3 Thermal drones, authorized operators conduct aerial monitoring of designated areas. Thermal imaging supports identification of potential hotspots, abnormal heat signatures, and areas requiring closer inspection.",
    },
    {
      n: "03",
      title: "Interactive Wildfire Mapping",
      text: "Captured drone imagery and georeferenced field observations are integrated into a digital mapping platform.",
      more: "Maps are updated as new verified observations and processed imagery become available, providing near-real-time situational awareness where operational connectivity permits.",
    },
    {
      n: "04",
      title: "Live Aerial Situational Awareness",
      text: "Where authorized and technically supported, drone operators can transmit live camera footage to designated monitoring personnel. This provides an additional aerial perspective to assist with field coordination, risk assessment, and operational decision-making.",
    },
    {
      n: "05",
      title: "Emergency Documentation & Reporting",
      text: "Each monitoring operation can generate structured reports containing flight records, thermal observations, geotagged imagery, incident locations, timestamps, and follow-up recommendations. These records support communication, incident review, risk assessment, and seasonal wildfire monitoring documentation.",
    },
  ],
};

export const MAPPING = {
  title: "Interactive wildfire mapping",
  intro: "Captured drone imagery and georeferenced field observations are integrated into a digital mapping platform. The platform is intended to visualize:",
  note: "Maps are updated as new verified observations and processed imagery become available, providing near-real-time situational awareness where operational connectivity permits.",
  stamp: "Sample data · fictional watch zone",
  // §1 Core Services 3, the six bullets (short label + the brief's line)
  layers: [
    { id: "hotspots", label: "Hotspots", brief: "Potential fire hotspots and detected thermal anomalies." },
    { id: "affected", label: "Affected area", brief: "Observed or estimated fire-affected areas." },
    { id: "infra", label: "Infrastructure", brief: "Locations of critical infrastructure and assets." },
    { id: "patrol", label: "Patrol & drone", brief: "Security patrol and drone observation locations." },
    { id: "change", label: "Change over time", brief: "Changes in observed fire conditions over time." },
    { id: "escalation", label: "Escalation", brief: "Areas requiring additional monitoring or immediate escalation." },
  ] as const,
};

export type LayerId = (typeof MAPPING.layers)[number]["id"];

export const APPLICATIONS = {
  title: "Designed for critical infrastructure", // §1 heading
  intro:
    "Our proposed service is particularly suited for organizations operating infrastructure in remote, forested, or wildfire-prone environments.",
  items: [
    { id: "hydro", title: "Hydroelectric", text: "Hydroelectric dams, generating stations, and associated infrastructure." },
    { id: "transmission", title: "Transmission & substations", text: "Transmission corridors and electrical substations." },
    { id: "remote-utility", title: "Remote utility & construction", text: "Remote utility facilities and construction projects." },
    { id: "industrial", title: "Industrial near forest", text: "Industrial operations near forested areas." },
    { id: "forestry", title: "Forestry", text: "Forestry assets and other high-risk properties." },
  ] as const,
};

export type AppId = (typeof APPLICATIONS.items)[number]["id"];

export const WHY = {
  title: "Why Sequoia Security?", // §1 heading
  intro:
    "By combining physical security, aerial thermal inspection, and geospatial intelligence, our proposed service aims to deliver:",
  items: [
    "Expanded visibility of designated monitoring areas.",
    "Faster investigation of potential fire hazards.",
    "Better documentation of thermal anomalies.",
    "Location-specific mapping and incident reporting.",
    "Enhanced situational awareness for infrastructure operators.",
  ],
  key: "One integrated field team instead of separately contracted security and drone monitoring personnel.",
};

export const STANDARDS = {
  title: "Our commitment", // §1 heading
  text: "Sequoia Security aims to provide utility and industrial clients with a practical, scalable wildfire monitoring solution that combines human judgment, professional security operations, advanced aerial technology, and geospatial data.",
  rule: "All drone operations will be subject to:",
  items: [
    "Transport Canada requirements",
    "Applicable airspace restrictions",
    "Site permissions",
    "Coordination with the appropriate wildfire authorities",
  ],
};

export const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#services", label: "Services" },
  { href: "#applications", label: "Applications" },
  { href: "#standards", label: "Standards" },
] as const;

export const META = {
  home: {
    title: "Sequoia Security | Drone-Enhanced Wildfire Monitoring & Fire Watch",
    description:
      "Beyond traditional fire watch. Ground patrols combined with aerial thermal imaging for utilities, hydroelectric facilities, energy infrastructure, forestry and remote industrial sites in British Columbia.",
  },
  proposal: {
    title: "Request a Wildfire Monitoring Proposal | Sequoia Security",
    description:
      "Request a wildfire monitoring and fire watch proposal from Sequoia Security, Kamloops, BC. Tell us about the site, the assets and the monitoring season.",
  },
  notFound: {
    title: "Page not found | Sequoia Security",
    description: "This page could not be found.",
  },
};
