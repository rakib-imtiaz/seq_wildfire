# v3 "Maquette": the M3T's three lenses, projected onto a model of the land

> **2026-10-20:** superseded in part. The user rejected the mixed scales ("the physics, the object shape, nothing is matching"). Everything is now 1:250, including the drone. The land is a smooth milled surface with engraved contours, not stepped boards, and the forest is instanced model conifers. Each beat also carries a fact sheet. See `src/v3/README.md`.

Read `docs/versions-brief.md` first; every shared rule is there.

## The idea
An architect's **white model (maquette)** of a BC watch zone sits in a daylight studio. The real M3T hovers above it.

As you scroll, the site shows what the brief is actually selling, a guard with a drone that has **three cameras**:
- each lens projects its real field of view onto the model as a light cone;
- the thermal footprint is the only place where heat becomes visible;
- the model turns into the map;
- a SAMPLE report comes out of it.

**Why it informs:**
- The cones use the real optics from FACTS §3: wide 84° FOV, tele 15° FOV, thermal 61° DFOV. Their relative footprints are true.
- The stepped layers of the model are real contour intervals of the fictional zone.

**How it differs from v1:**
- v1 is a dark tabletop that changes through process states.
- v3 is a bright, physical scale model, and its subject is **the optics**: what each lens sees, and where heat shows.

## Skills to read and apply
- `C:\Users\USER\.claude\skills\make_3d_website\SKILL.md` (**primary**) plus its `references/` and `AUDIT.md`. Use its scroll choreography, review harness approach and bug catalog.
- `C:\Users\USER\.claude\skills\taste-skill-repo\skills\taste-skill\SKILL.md` (anti-slop).
- `C:\Users\USER\.claude\skills\impeccable\SKILL.md`: use it for a critique and polish pass at the end.
- `C:\Users\USER\.claude\skills\animate\SKILL.md` and `C:\Users\USER\.claude\skills\emil-design-eng\SKILL.md`: motion decisions and finish.

## The look
- **Theme:** light studio, locked.
- **Colours:**
  - Studio ground `#E2E3E0`; plaster model `#F3F3F1`.
  - Graphite ink `#1A1C1E`; muted `#5A5E62`.
  - **One accent, cobalt `#2447D6`**: FOV cones and footprints, active controls, and the CTA fill (white text on it is about 7:1).
  - Ironbow only for heat inside the thermal footprint.
- **Type:**
  - **Red Hat Display** (500/600/700) for headings and UI.
  - **Red Hat Mono** (400/500) for specs and SAMPLE tags only.
  - Headlines about `clamp(34px, 5vw, 76px)`; they must not scream.
- **Model look:**
  - Laser-cut, stepped contour layers in matte plaster with soft contact shadows and ambient occlusion: a real architectural model, NOT a toy or game.
  - Forest is a fine engraved or stipple texture on the layers, never toy trees.
  - Infrastructure is plain white massing. v1's `dam.js` / `power.js` / `lines.js` can be reused only if they take a plaster material cleanly.
  - The M3T is the real model from `/table/js/m3t.js` (the user loved it), in its true materials. It is the only non-white object besides the cobalt light.
- **Shapes:** 10 px corners on cards and frames; pill buttons.

## The 3D story
- **Mechanics:** a pinned canvas. One gesture plays one beat, with prev/next arrows. Text beats sit beside the canvas, never on it. At most 3 labels on screen at once.

| Beat | Camera and scene | Heading / one line |
|---|---|---|
| Hero | M3T hovering over the model in soft morning studio light; slow prop spin; gentle orbit | "Beyond traditional fire watch." / "Every fire watch guard will also be a certified drone pilot." + CTA |
| Lenses | Close on the gimbal; three short leader labels | "Three lenses." Labels: "Wide 48 MP", "Tele 12 MP", "Thermal 640 × 512" |
| Coverage | Pull back; three cobalt cones project to footprints on the model. W / T / IR buttons isolate one cone (this is the teach-by-doing moment) | "What each lens covers." / one line from FACTS |
| Heat | Only the thermal footprint shows ironbow heat; a SAMPLE hotspot glows; everything else stays plaster | "Thermal Detection" / brief step 3 line |
| Team | A graphite patrol route is drawn on the ground layer, with the drone's flight path above it | "Ground and sky. One team." / the integrated-team line |
| Map | The camera eases to top-down orthographic; the model becomes the map, with 3 geotagged SAMPLE observations | "Digital Mapping" / brief step 4 line |
| Report | A SAMPLE report card (HTML) slides in beside the map | "Reporting & Coordination" / brief step 5 line |

## After the 3D (HTML, light, varied layouts; no two alike)
- **Services:** 5, in an asymmetric composition with real photos.
- **Applications:** 5 visible/thermal pairs with a drag-compare. The SAMPLE tag goes in the caption.
- **Why:** the observes-vs-observe/detect/map/report line, plus the points.
- **Commitment:** one line.
- **CTA band** with the ridge photo, then the footer.

## Must
- Sharp, smooth and fast:
  - DPR cap and quality tiers;
  - idle-time loading;
  - a still or poster fallback for `?motion=0`, reduced motion and no WebGL, with every beat readable as a static stacked layout.
- One WebGL context.
- Phone framing: the model and drone fill 75 to 85% of the width, with the text beat below the canvas.
