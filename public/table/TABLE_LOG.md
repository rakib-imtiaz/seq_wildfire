# Command Table: build log

Wave 1 (2026-10-16): the world, the cameras, the module API. Wave 2 (2026-10-16): behaviours (patrol, drone, thermal lens, smoke, map layers, report), one shared engine for hero + steps, the site integration and the rendered stills. Wave 2 notes are at the end.

## Files

| File | What |
|---|---|
| `table.html` | Sandbox. Flags: `?step=0..5`, `?frame=0..1` (synchronous still, frozen clock), `?q=lite\|balanced\|high`, `?mode=hero`, `?lens=x,y,r`, `?still=1`, `?dpr=`, `?debug=1` (`window.__table`, `shot()` POSTs to the vite dev-only `/__still`) |
| `review.html` | Review harness: loads `table.html` in a same-origin iframe at an exact size; `review.px()` measures sRGB patches; `review.site(w, h)` loads the whole site and checks the hero + five steps (live, readout, labels inside the view, not under the header, not over the caption card or skip, no overlaps, no horizontal scroll, errors) |
| `stills.html` | Dev tool: renders the site's stills from the live scene into `public/media/table/` (`?run=1\|hero\|steps&q=high`, vite dev only) |
| `js/table.js` | Shared engine + one view per mount. `mountTable(el, { mode, onReady, onStep, onLens, motion, q, still, debug, dpr })` → `{ setProgress, setStep(n, {instant}), setLens({x,y,r,active}) → {maxC,e,n}, getHotspot → {x,y,visible,mpp}, setInsets, resize, dispose, renderFrame, view, capture, stats }` (matches `src/lib/table3d.ts`) |
| `js/story.js` | The five steps as pure functions of (step, progress): patrol ribbon + checkpoints, truck drive, drone unfold/lift/flight/hover, scan cone, footprint, pulses, smoke amount, thermal mask, map mode, S4 layer geometry, label anchors, report data |
| `js/overlay.js` | Module-owned DOM over the canvas: label plates + leaders with collision avoidance, S4 SVG layers + legend, S5 report card + recipient tokens; `paintTo()` for stills |
| `js/thermal.js` | Thermal field pass (°C per material kind from `userData.thermal`, hotspot core + halo, truck engine), ironbow composite inside the lens or full frame, max-filtered readback grid, report thumbnails |
| `js/smoke.js` | Billboard smoke puffs drifting NE with the wind |
| `js/lines.js` | Constant-pixel ribbons (draw progress, dashes), point marks, min-pixel glows |
| `js/drone.js` | Flight path (25..120 m above the ground), wrapper over the M3T build's API, proxy stand-in, strobe glow |
| `js/pip.js` | Picture-in-picture chase view of the M3T (only while the drone is the subject) |
| `assets.json` | Optional assets: `m3t` (the M3T build's module, now listed), `smoke` sprites (none) |
| `js/world.js` | Assembles everything; lights, painted room environment, LOOKS (dusk / blue / night), table, plinth, bridge; `surfaceAt`, `groundAt` |
| `js/layout.js` | Derived layout: slab box, levels, smoothed river/roads, projections, dam frame (arch geometry helpers) |
| `js/terrain.js` | Heightfield (valley profile + spurs/gullies + road benches, pads, reservoir shore, river channel), exact `groundAt`, ground masks canvas, ground shader, strata walls |
| `js/sunmask.js` | GPU-baked terrain cast shadows (shadow-height texture) used by every slab material on every tier |
| `js/shading.js` | Shared shader patch: sun mask, valley haze, world position |
| `js/water.js` | Reservoir + river: dusk-sky Fresnel reflection, reflected ridges (height-grid march), shallow bed, glint |
| `js/forest.js` | 4 instanced conifers, star-sectioned tiers, per-instance tint, stand-scale colour patches |
| `js/dam.js` | Curved gravity dam (true arch, radial sections), spillway, 5 piers, 4 radial gates, bridge deck, basin, intake tower, penstocks, powerhouse |
| `js/power.js` | Lattice towers (leg extensions on slopes), catenary wires, gantries, switchyard, substation |
| `js/truck.js` | Charcoal pickup, amber beacon (+ screen-size glow point), `bedTop` anchor |
| `js/cameras.js` | Six poses, distance solved per aspect from framing points, portrait variants, easing with holds |
| `js/kit.js` | Merge-by-material builder, catenary |

## ZONE nudges (documented in zone.js too)

The original layout put the powerhouse and road in the river, the dam crest along the river, the reservoir's dam edge off the dam, the patrol's end in the reservoir, the switchyard inside the powerhouse yard and tower 0 inside the switchyard. Fixed by moving: reservoir vertices 4–5 (onto the crest ends), powerhouse (north bank toe), switchyard (bench at crest level), towers[0], road points 4–6 (south bank, climbing to the south crest end), patrol points 13–17 (follow the road, cross the crest). Names, array lengths and checkpoint indices unchanged. The 2D map should re-read zone.js.

## Decisions

- Units are terrain metres; the table is just a much larger surface. No sky dome: dark room, clear colour ~0.004.
- Key light = dusk sun from azimuth 255°, elevation 12.5° (front-left of the hero camera): rim-lit ridges, long shadows toward the camera, the reservoir faces the glow, the near cut faces sit in shade. Its direction never changes (shadows baked once); LOOKS only change colours/intensities/exposure.
- Terrain shadows on all tiers come from the baked mask (no shadow map). High adds a 4096² shadow map for trees, dam, props (trees cast, but do not receive: −22 ms on the iGPU).
- The water reflects a virtual dusk sky (orange horizon toward the sun) by Fresnel, plus the real ridges via a short height-grid march. A dark room would physically reflect black; the look-dev prompt asks for the orange sky.
- Wires are 1 px lines at 55 % opacity: at table scale a wire is sub-pixel; tubes would shimmer or vanish.
- The beacon has a min-3 px glow point so the "tiny amber point" never drops between pixel centres.
- Cut faces and plinth do not take the sun mask (their rays always leave the slab; edge filtering leaked land shadow heights onto them).
- Two tables can be mounted at once: shared shader values are re-bound per instance at each render.

## Site contract and hero framing (from the shell, src/lib/table3d.ts)

- `motion: false` → static: render on demand, no clock (same as `still`).
- `getHotspot()` projects ZONE.hotspot; `visible` = on screen and the first surface under that pixel is within 40 m of it.
- `setLens({x,y,active})` returns `{ maxC, e, n }`: e/n = the surface point under the lens centre on the fictional grid (e = x, n = −z); maxC = SAMPLE peak (312) when the hotspot is inside the lens (radius taken as 12.5 % of the width, the DOM ring), else a plausible dusk surface value. No ring is drawn in WebGL (the DOM draws it). The heat view inside the lens is wave 2.
- Pose classes by container aspect: portrait < 0.7, compact 0.7–1.2, wide ≥ 1.2 (the site's phone hero canvas is 345–415 × 439, aspect 0.79–0.95: one class, so 360 frames like 390/430).
- Hero at ≥ 1024 px wide: lens shift −0.2 and fit range NDC x ∈ [−0.16, 1]: the slab and hotspot sit in the right ~56 %, the copy column stays dark (measured mean 2–3/255 under it). Hero pose: yaw 78°, pitch 18° from the downstream end.
- Table light pool tightened (radii 960 × 650 m) so the room stays dark behind the copy.
- Checked in the live site at 1440×900: copy clear, lens parked on the hotspot, readout MAX 312.0 °C. Phone sizes 345/375/415 × 439: hotspot at x 0.80, y 0.50, inside the canvas (which starts below the header).

## Checked (claude-in-chrome, review.html iframes, `?frame=` stills, measured with `review.px`)

- 1280×720 all six states, 1440×810 hero, 390×844 all six states; mid-transitions u = 0.1/0.3/0.5/0.7/0.9 (camera always well above `surfaceAt`).
- Close-ups: dam/spillway/intake/powerhouse, substation, tower on slope, switchyard gantries, bridge, truck. Structures sit on footings/pads; no floating parts found.
- Determinism: the same `?frame=` rendered twice in a session and after a reload: 0 of 921,600 values differ.
- Mount → setProgress/setStep/setLens/resize → dispose ×3: no errors, canvas removed. Two tables mounted at once: no GL errors.
- Console clean on load (balanced).

## Performance (this machine: AMD Radeon integrated (Ryzen APU), 16 threads, 8 GB; auto tier = balanced)

Synchronous render cost per frame at 1280×720, DPR 1 (`renderFrame` + `readPixels` sync, averaged over 6–8 frames):

| Tier | Trees | World build | ms/frame (S0…S5) |
|---|---|---|---|
| lite | 9,000 | ~400 ms | 5–6 |
| balanced | 24,000 | ~700 ms | 6.6–10.5 |
| high | 38,000 | ~1,000 ms | 21–34 (high is meant for discrete GPUs) |

Live rAF fps could not be measured: the automation tab's rAF does not run.

## Wave 2 (2026-10-16)

### Behaviours (story.js; pure functions of step + progress, so scrolling back replays exactly)

- S1 patrol: the amber ribbon draws along the road/crest-snapped patrol, the truck drives it, checkpoint marks reveal with SAMPLE times; no smoke.
- S2 drone: the truck parks at the pull-out, the M3T unfolds on the bed, lifts 28 m and flies the dotted route to a hover over the hotspot slope. Altitude held at 25..120 m above the ground (the Canadian ceiling is 122 m). The inset (pip.js) shows the real model from a chase camera 1.3 m behind, only while the nearest framed ground is more than 150 m away (the trees are not built for close-ups).
- S3 thermal: scan cone + footprint ring, hotspot pulse, ember glow, smoke thickening; the lens reads the thermal field (raster readback plus an analytic hotspot term, so the readout is 312.0 on the hotspot at every lens size).
- S4 map: the camera goes top-down, the terrain becomes a dark hillshade with 20/100 m contours, trees shrink away, the overlay draws the layers in order (infrastructure, patrol, observations, hotspot, affected area stepping through 3 perimeters, escalation hatch) with a legend (hidden under 640 px).
- S5 report: pulled-back slab; the report card (SAMPLE, accessible text, visible + thermal thumbnails rendered from the scene) and two recipient tokens ("Authorized client representatives", "Relevant emergency authorities") with leaders. Phones stack the tokens under the slab and the card below, compacting when short.

### Decisions

- One engine (renderer, world, thermal, story, inset) for the whole page; each mount is a view. The canvas moves to the most visible view and the view it leaves keeps a 2D snapshot, so the hero and the steps never hold two WebGL contexts.
- Steps: k = floor(u * 5) + 1; the camera holds on each step and glides to the next over p 0.74..1. `setStep` is ignored once the page drives `setProgress`.
- Thermal renders into a HalfFloat target (R = °C, G = distance to the mask centre), full res on high, half otherwise; the composite adds 640x512-like softness and noise. Every temperature is SAMPLE.
- The real M3T (the M3T build) loads through assets.json with its semantics: setFold 0 folded..1 unfolded, setGimbalPitch(rad), setProps(angle, blur). The table keeps a strobe glow so the aircraft never drops below a pixel.
- The phone step 5 pose no longer inherits the wide pose's card-side shiftX: the slab sits centred above the tokens.
- No reference sheets will arrive (dam, tower, substation, truck, M3T): detail passes were built from engineering knowledge and the cameras stay at table scale.

### Site integration (src/)

- `Hero.tsx`: rendered stills poster (desk 1600x1000, tab 1000x600, phone 375x439 @2x), CSS-masked thermal still under the lens, lite readout from the JSON grid, passes `r` to setLens; the 3D fades in over the still.
- `StepsStage.tsx`: per-step stills crossfading (overlay labels painted in), static report card on step 5. `Steps.tsx` pushes insets (top below the progress bar; phones: bottom = caption card + skip).
- `vite.config.ts`: dev-only (`apply: 'serve'`) `POST /__still` for stills.html and `shot()`.
- Stills in `public/media/table/` (19 files, ~1.2 MB): hero visible/thermal + JSON per size, step1..5 desk/phone. Steps regenerated with the real M3T and the step 5 phone fix.

### Checked (claude-in-chrome, `review.site`)

- 360x780, 390x844, 430x932, 768x1024, 1024x768, 1440x900, 2000x1125: hero live with readout 312.0 °C; all five steps live; labels inside the view, none under the header, over the caption card or skip, no overlaps; no horizontal scroll; no errors. 360/390/430 rechecked after the step 5 phone pose change.
- `?q=lite`: no canvas, stills + readout only. Shared engine: one WebGL canvas, JS heap ~130-143 MB.
- Determinism: 0 differing values for u = 0.1/0.3/0.42/0.5/0.7/0.9, same session and after a reload.
- `npx tsc -b` and `npm run build` pass. Console: only React Router future-flag warnings (not the table's).

### Performance (same iGPU, 1280x720, balanced, ms/frame)

S1 11.5, S2 with inset 15.1, S3 thermal 14.1, S3 to S4 flip 13.2, S4 9.4, S5 8.1; lite 5.5-10; `setLens` ~0.8 ms.

## Beauty pass (2026-10-16, after the wave 2 review)

### Hero framing (cameras.js solveHero, table.js, Hero.tsx; superseded by round 3 below)

- The hero is solved per stage, not posed: a bearing from just north of east (88..112 deg; the slab's long axis runs into the picture), pitch 22..42 deg, lens shift. A search (coarse grid, then a local pattern search from up to 4 starts when there is a copy block) keeps the largest slab area that stays inside the frame and under the header (only the near cut face may leave the bottom), stays clear of the copy block (the hull of the slab's projected outline must not touch it) and leaves the hotspot room for the lens. Lower pitches win near-ties. ~150-230 ms per size change on the iGPU machine, cached per size + insets.
- The hotspot is 115 m from the north cut edge, so the lens rests off-centre: getHotspot() returns rest (up to 0.5 of the radius from the hotspot, away from the nearest cut edge, at least lens + 20 px from it) and inward (the slab's interior direction). Measured lens void at rest: 0 % at every size checked.
- Hero.tsx tells the 3D its layout: setInsets({ top: header, avoid: copy block (eyebrow, title, lead, the buttons), lens }) on mount, resize and copy reflow. Desktop decisions follow the 1024 px media query, not the stage width (a scrollbar made the 1024 x 1366 stage 1009 px wide and dropped it to the phone path). The lens radius is clamp(0.066 w, 76, 150) on desktop, clamp(0.14 w, 52, 100) below.
- restPoint ignores a 3D hotspot that is null, NaN, off stage or hidden (falls back to the still's rest point, then a default), and the lens re-parks after onReady at 2 frames, 450 ms and 1400 ms. getHotspot() re-measures the container and returns null below 40 px. The idle sweep (motion on) drifts from the rest point into the slab and along it, never out over a cut edge.
- Hero stills per layout: desk (aspect >= 1.3), sq (0.85..1.3), tall (< 0.85) on desktop, tab and phone below; each with its JSON (hotspot, rest, inward, readout grid). stills.html frames them with the site's copy block at that size.

### Light and grade

- Sun moved to azimuth 215, elevation 13 (from 255 / 12.5): from the hero camera it is ahead and to the left, grazing the ridges and rimming the crests; the sun-warmed slopes in the thermal field follow it (the hotspot's north slope now faces it).
- Dusk look: key 10 (warmer), cool blue-hour fill 1.7, exposure 2.0, haze bluer and lighter (density 0.00065/m, scale height 80 m, the warm lobe only near the sun's bearing).
- finish.js (a copy of lib/post.js, which stays untouched) adds a display-space S-curve about 0.13 with a split tone (cool shadows, warm highlights) and a per-call bloom threshold (4.5: the beacon and the hottest glows only). The grade fades out in step 4's map mode.
- Table: no sun on the tabletop; the room light is a soft pool hugging the plinth (falls off over ~110 m), so nothing glows behind the hero copy.

### Materials

- Water (water.js rewritten): near-black body, Fresnel sky gradient (deep blue overhead, a low band warm across the sun's half), wavelets stretched across the line of sight (bigger with distance so they stay a few pixels long), calm and breezy patches, glow streaks and sparse glints, glow dimmed where the water lies in the valley's shadow, the bed showing through the shallows, alpha fading out at the waterline. The river carries a sky sheen so it reads in the shaded valley.
- River (terrain.js riverShape): width 8..17 m, a channel offset north of the valley line (away from the road on the south bank), an irregular waterline, a gentle north bank and a steeper south one, two low gravel bars on the north side. Fixed at the dam toe and the bridge. Forest, walls and the water ribbon follow it.
- Banks: the ground darkens and turns glossy in a soft band above the waterline (narrower on the bars); the bed under the shallows is dark silt; gravel bars are pale cobbles.
- Cut faces: seven rock types in beds that dip, wave and pinch, with laminae, partings, joints, run-off streaks, till cobbles, soil and the grass mat; the room light lights every face; the sun reaches a face at 0.55 (warm, not blazing); the foot of the cut is occluded.
- Trees: crowns shade dark at the base and bright at the top, almost no specular (the sparkle on every tip against the low sun), fuller crowns in closed stands; the canopy shades the forest floor (no bright gaps).
- Hero thermal: the lens maps 6..56 C (the camera's gain on a dusk view), so sun-warmed slopes, the road and the dam show magenta to red over the cold forest and the dark river; the hottest source gets a soft sensor bloom.

### Checked

- review.site (motion off) at 360x780, 390x844, 430x932, 768x1024, 1024x768, 1440x900, 2000x1125, 1280x1250, 1920x1200, 1024x1366: hero live with MAX 312.0; all five steps live; no label issues; no horizontal scroll; no errors.
- Motion on at 1280x1250, 1024x1366, 1920x1200: lens on the slab with a reading, slab clear of the copy and under the header. Console: only React Router future-flag warnings.
- Perf (1280x720 balanced, ms/frame): hero 9.5 (lens 10.0), S1 13.1, S2 + inset 19.1, S3 16.2, flip 10.2, S4 10.2, S5 8.4; setLens 0.9 ms.

## Hero round 3 (2026-10-16): the story moved, the look-dev frame back

- zone.js: the hotspot moved from (395, -385), 115 m from the north cut edge, to (395, -250): in the forest just downslope (south) of the line between towers 3 and 4 (the line is at z -299 there), about 250 m from every slab edge. The perimeters grow upslope toward the line with the NE wind without crossing it; their east-most points sit low so the 2D map's time label clears the substation label. The escalation band runs between the T+00:50 perimeter and the line and on west along the line (its 4th point anchors the 2D map's label clear of the hotspot's). Observations ring the hotspot; the flight ends 60 m south of it. Names, lengths and peakC kept. Checked in the 2D sample map (no overlapping labels) and step 4.
- The hero is the frame-00 look again: a low oblique from the downstream end (bearing 60..86 deg from the ESE, pitch 12..20 deg), the whole slab on the table with its cut faces, uncropped, 40 px clear of every edge (18 px on phone stages, 32 on tablets), under the header, in the right 56 % from 1024 px (Hero passes margin and leftLimit 0.44 with the copy block). solveHero searches bearing, pitch and lens shift for the largest such slab; the lens rests centred on the hotspot (rest offset 0) and the frame is checked for room round it. getHotspot's visibility test scales with metres per pixel (a grazing view at a small scale landed outside the old fixed 40 m).
- Desktop lens radius clamp(0.062 w, 62, 140); phones clamp(0.12 w, 42, 88).
- Water at the low angle: the sky gradient mirrored (deep blue high, a pale twilight band low, warm only across the sun's half), wind lanes along the NE wind, dark bank reflections along every shore, sparse warm glints (two noises, denser in the shallows along a shore and at grazing angles). The ripple frame follows the camera's heading (a per-pixel line of sight fanned the pattern into stripes) and the noise tiles are tens of metres long along the line of sight (finer ones were averaged away by the texture's mips).
- All stills regenerated (step 2 with the M3T prop fix: the inset shows the drone with its arms and rotors over the forest, the dam behind).

## Known issues / next

- The real M3T's blade-blur discs show a strong orange rim in the inset under the dusk key (the M3T build's material, not the table's).
- The terrain build still runs on the main thread (~0.7-1 s). The poster still paints first, so first paint is not blocked; a worker is not done.
- Dev tools (`review.html`, `stills.html`, `table.html`) ship in `dist` (noindex); exclude them from the production copy if wanted.
- Trees and the truck look toy-like closer than ~150 m; no pose and not the inset go that close.
- The tailrace channel from the powerhouse to the river is not modelled.
- No depth of field (avoided the tilt-shift look).
- Look-dev frames never arrived; the grade and poses are tuned to the written prompts only.
- With the right-56 % rule and the whole slab in frame, tall desktop stages (1280 x 1250, 1024 x 1366) leave dark room below the slab.
