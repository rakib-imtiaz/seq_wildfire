# Design versions v3, v4, v5: shared brief

> **2026-10-20:** the user rejected v2, v4 and v5 ("the worst") and they were deleted. Only v3 "Maquette" remains; the rules below still apply to it.

The user asked for "3 more versions … use [my web skills] … make them worth it". Each version is a complete, standalone take on the Sequoia Wildfire site. It has its own concept, look and signature interaction, and every one must be unmistakably different from the other versions and from v1 and v2.

| Version | URL | Concept | Plan |
|---|---|---|---|
| v1 | `/` | Dark night ops, ember, 3D command table | (existing, don't touch) |
| v2 | `/v2/` | "Ground & Sky": split screen, brand teal, Archivo, light | `docs/v2-plan.md` (another agent; don't touch) |
| v3 | `/v3/` | **"Maquette"**: architectural-model 3D, the M3T's three lenses projected onto a plaster model of the land | `docs/v3-plan.md` |
| v4 | `/v4/` | **"Protocol"**: Swiss industrial print, giant type, real numbers as typography | `docs/v4-plan.md` |
| v5 | `/v5/` | **"Viewfinder"**: the site as a calm camera app, switching lenses with real optics | `docs/v5-plan.md` |

## Read before designing (mandatory)
1. **`FACTS.md`, the ONLY source of copy.**
   - Use proposal verbs ("will", "designed to", "aims to", "where authorized").
   - No invented stats, clients, testimonials, licences or response times.
   - Every map, readout, temperature, timestamp and report is labelled **SAMPLE**.
   - The M3T has no laser rangefinder. Don't claim RTK.
   - Never name a wildfire authority as a partner.
   - No DJI or Transport Canada logos.
   - Zero em or en dashes in visible text.
2. **`CLAUDE.md`:** hard rules and how this user works.
3. **`PROJECT_CONTEXT.md` §3: the user's taste.** Read every line.
   - They hate:
     - generic or templated work;
     - cartoon, toy or video-game looks;
     - HUDs, grids, scan bars or coordinates over photos;
     - text-heavy pages;
     - empty bands;
     - tiny mobile subjects;
     - stutter;
     - dev artifacts in the product.
   - They love:
     - real, accurate 3D that informs;
     - interaction that teaches by doing;
     - one gesture per beat;
     - prev/next arrows;
     - autoplay with pause;
     - living pages;
     - image-led rounded cards (when it fits the style);
     - brisk pacing.
4. **PROJECT_CONTEXT.md §7 and §8:** bugs never to repeat, and environment quirks.
5. **Your version's plan file,** then **the skills it lists.**
   - Skills are SKILL.md files. Read them by path (`C:\Users\USER\.claude\skills\...`), including any `references/` they point to, and apply them.
   - **Always** read and apply the anti-slop skill: `C:\Users\USER\.claude\skills\taste-skill-repo\skills\taste-skill\SKILL.md`.
     - Write its one-line "Design Read" at the top of your `src/vN/README.md`.
     - Run its §14 pre-flight before you report.
     - Where your plan deliberately overrides a rule (for example, v4's giant numerals), the plan says so. Everything else in the skill applies.

## Content every version must carry (from FACTS.md)
- **Tagline:** "Beyond Traditional Fire Watch. Intelligence From Above."
- **The model:** every designated fire watch guard will also be a Transport Canada Advanced Operations drone pilot, equipped with a DJI Mavic 3 Thermal.
- **Steps:** the 5 steps, Ground Monitoring → Aerial Inspection → Thermal Detection → Digital Mapping → Reporting & Coordination.
- **Services:** the 5 core services.
- **Applications:** the 5 applications.
- **Why:** "Traditional fire watch observes. Sequoia Security is designed to observe, detect, map, and report." plus the 6 "aims to deliver" points. The key one is "One integrated field team instead of separately contracted security and drone monitoring personnel."
- **Commitment:** the compliance line.
- **Sign-off:** "Protecting Critical Infrastructure From the Ground and the Sky."
- **CTA:** one label everywhere, "Request a proposal", linking to `/proposal` (the existing v1 form page).
- **Contact:** phone `tel:+12508796055` (250-879-6055); 293 Arrowstone Drive, Kamloops, BC V2C 1P8. Guarding services link out to sequoiasecurity.ca.
- **M3T specs:** FACTS §3 only.

**Text economy:** a heading plus one short line per section or beat. Cut, cut, cut. Don't use every line FACTS offers; choose.

## Banned (anti-slop, plus what's already used)
- **Fonts:**
  - LLM defaults: Instrument Serif, Fraunces, Inter, Inter Tight, Space Grotesk, DM Sans, Plus Jakarta Sans, Manrope, Sora, Syne, Outfit, Bricolage Grotesque, Poppins, Montserrat.
  - Already used: Barlow / Barlow Condensed and JetBrains Mono (v1), Archivo (v2), IBM Plex Mono.
  - Use ONLY the fonts your plan assigns, from Google Fonts.
- **Palettes:**
  - ash + ember orange (v1);
  - teal (v2);
  - bone/cream/beige "paper" + brass/clay/oxblood;
  - AI purple/blue glow gradients;
  - pine + crew yellow.
- **Patterns:**
  - eyebrows over every section;
  - "01/02" section numbering;
  - "Step 1" labels;
  - pills or labels on photos (the small required SAMPLE tag is the exception);
  - scroll cues;
  - decorative dots;
  - middle-dot chains;
  - three equal cards in a row;
  - div-built fake screenshots;
  - gradient text;
  - glows;
  - custom cursors;
  - duplicate CTA wording.

## Architecture (strict, because 4 agents are building at once)
- **Entry:** `vN/index.html` (at the project root) loads `src/vN/main.tsx`. **All your code lives in `src/vN/`.**
  - Root `vite.config.ts` already lists `v3/index.html`, `v4/index.html` and `v5/index.html` as build inputs.
  - Do NOT edit `vite.config.ts`, `package.json`, `index.html`, anything in `src/` outside `src/vN/`, anything in `public/`, or any other version's files.
- **Don't** import v1's CSS (`src/styles/*`) or v1's components.
  - You MAY import v1 TS modules that have no CSS imports (check each one): `src/data/media.ts`, `src/lib/zone.ts`, `src/lib/terrain.ts`, `src/lib/table3d.ts`, `src/lib/motion.ts`.
  - You may import v1's 3D ES modules read-only from `/table/js/*.js`, e.g. the M3T model builder. Read `public/table/M3T_LOG.md` and `TABLE_LOG.md` first.
- **Dependencies:** react, react-dom, react-router-dom, **gsap** (3.15, ScrollTrigger included) and **motion** (12, `motion/react`) are installed. Install nothing else.
  - **three:** copy the import map from root `index.html` into your html (the `hoistImportMap` plugin handles every page). Then `import * as THREE from "three"` will NOT type-check from TS, so load it the way `src/lib/table3d.ts` does (dynamic import of the vendored module), or keep the 3D in a plain `.js` module under `src/vN/`.
- **Fonts:** load them with a Google Fonts `<link>` in your html, as v1 does.
- **Motion off:** `?motion=0` and `prefers-reduced-motion` must give a static, fully visible page. Add a safety net so nothing can stay hidden: `watchReveals` style, clipping children, never the observed target.
- **Responsive:** phones first. QA widths are 360/390/430, 768, 1024 landscape, 1440, ~2000 and 1280×1250.

## Images
- **Use only files that already exist** in `public/media/`:
  - `photos/`: patrol, pilot portrait, canopy visible/thermal, live feed, statement ground-only and ground-and-sky, ridge smoke, proposal hero, landing observe/map/report;
  - `apps/`: 5 applications, each with visible + thermal at 560/840/1120;
  - `table/`: stills of v1's 3D;
  - `video/`: posters.
- **Look at every photo** (Read the webp) before assigning it.
- **Don't use:**
  - `standards-preflight-*` (truncated);
  - `landing-detect-*` (tiny);
  - the hero videos (procedural stand-ins).
- **If your concept truly needs a shot that doesn't exist,** use the closest one now. In your report, give the exact filename, size and a complete copy-paste generation prompt. The user generates images themselves; never generate them with any tool.

## QA (shared machine: be a good neighbour)
- **The dev server is already running** at `http://127.0.0.1:5210/`. Your page is `http://127.0.0.1:5210/vN/`.
  - Never start, stop or restart it.
  - If it's down, report that; don't fight over it.
- **Type-check:** `npx tsc --noEmit -p tsconfig.app.json`. Fix errors in YOUR folder only; other versions are mid-build and may show transient errors.
  - **Don't run `npm run build`.** dist is shared, and the lead runs one build at the end.
- **Chrome checks: claude-in-chrome tools only. Never Playwright or Puppeteer.**
  - **Tools:** load what you need in one ToolSearch call.
  - **Your own tab:** create exactly ONE tab of your own with `tabs_create_mcp`, and close it when you're done.
  - **Sizing:** NEVER call `resize_window`, because the window is shared with other agents. Size things through the harness instead: `http://127.0.0.1:5210/review/shell.html?w=390,1440&h=900&path=/vN/&z=0.5&ys=0,900,1800`. It loads same-origin iframes at exact widths. Add `%3Fmotion=0` to the path for the static pass.
  - **Contention:** other agents share Chrome. If a screenshot shows another page, re-select your tab and retry.
- **Frozen animation:** the automation tab is hidden, so rAF and timers can be throttled. If an animation looks frozen, verify the states by forcing scroll positions or a debug query param. Don't "fix" working code.
- **WebGL:** one WebGL context per page; never several WebGL iframes at once.
- **Fix what's wrong.** Don't just list it.
- **Never trigger alert/confirm dialogs.**
- **No git commands, no commits, no deploys.**

## Report back (concise, plain language)
1. **What it is:** the concept in 2 lines, and the signature moment.
2. **Skills:** which you used and what each changed.
3. **Type and colour,** with the reasoning.
4. **Files.**
5. **What you checked in Chrome:** sizes, motion on and off, every beat. Also what you could NOT verify, such as real-time smoothness and touch.
6. **Copy you adapted,** with the FACTS line it traces to.
7. **Image prompts,** if any.
8. **Known issues.**
