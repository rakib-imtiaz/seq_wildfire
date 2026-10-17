# M3T sculpt: build log

DJI Mavic 3 Thermal (M3T) for the Pilot section (`.m3t` slot) and, in wave 2, the command table.
Wave 1, 2026-10-16.

## Files

| File | What |
|---|---|
| `js/m3t.js` | `mountM3T(el, { onReady, motion, dev })` is the Pilot-section stage. It returns `{ dispose, resize, renderAt(t), pose(p), stats(), timeline, model, renderer, scene, camera }`. |
| `js/m3t/model.js` | `buildM3T({ detail: 'hero' \| 'table', texSize })` builds the model. It returns `{ group, setFold, setPropOpen, setGimbalPitch, setProps, anchors, parts, materials, state, triangles(), measure(fold), dispose(), detail }`. It also exports `M3T_SPECS`. |
| `js/m3t/materials.js` | Procedural PBR materials and `DataTexture`s, with no image files and no canvas, so the model also builds in Node. |
| `js/m3t/room-environment.js` | three r170 `RoomEnvironment` (MIT), copied here because `/table/vendor` has no `environments/` folder. |
| `js/m3t/m3t-sculpt-spec.json` | The threejs-object-sculptor `ObjectSculptSpec` for this build, about 400 KB. Nothing loads it at runtime; it is documentation. Local paths are replaced with `<session-scratchpad>`. It can be deleted before a deploy if the extra file in `public/` is unwanted. |
| `m3t.html` | The sandbox. Its flags are listed below. |

### Model API (`buildM3T`)

**Coordinates**
- Units are metres, Y is up and the nose points to +Z.
- +X is the aircraft's **left** side.
- The origin is the centre of the unfolded footprint, with y = 0 at the feet.

**Methods**
- `setFold(t)`: 0 is folded and 1 is unfolded. Pass a *linear* t. The front arms move over t 0..0.7 and the rear arms over 0.3..1, and each arm is eased with smootherstep, so there is no bounce.
- `setPropOpen(u)`: 0 folds the blades along the arms and 1 opens them. Until it is first called, the blades follow the fold and open over its last 14 %. After that the caller controls them, which is how the mount times the "flick".
- `setGimbalPitch(rad)`: 0 is level and negative tilts down. It is clamped to DJI's controllable range of −90° to +35°.
- `setProps(angle, blur)`:
  - Each rotor turns its own way: FR and RL are CCW, FL and RR are CW.
  - `blur` runs from 0 (crisp blades, orange tips) to 1, fading the blades to 6 % and bringing in a grey blur disc. The disc keeps only a faint warm hint where the tips sweep; a strong orange ring read as a halo in the command table's picture-in-picture.
  - The disc only shows when the props are open.
- `anchors.thermal / .wide / .tele`: an `Object3D` 0.4 mm in front of each lens. They are children of the pitch node, so they follow the tilt.
- `measure(fold)`: bounds without propellers, in the model's own frame and vertex-precise, measured with the gimbal level.

**Runtime map**
- `group.userData.sculptRuntime` holds `{ nodes, meshes, sockets, colliders, destructionGroups: { battery }, hinges }`.
  - `colliders` has 15 entries: a body box, a battery box, a camera-head box, and for each arm a capsule, a motor cylinder and a rotor-disc trigger.
  - The `battery` group carries its own details (release buttons, level LEDs, power button, rear slots, rear vision sensors, beacon), so a detach takes them along.

**Named parts**
- Body: `body`, `body_shell`, `battery` (`battery_shell`), `battery_seam`, `top_port`, `beacon`.
- Vision sensors: `vision_front_L/R`, `vision_rear_L/R` (in the battery group), `vision_down_L/R`.
- Gimbal: `gimbal`, `gimbal_mount`, `gimbal_yaw`, `gimbal_roll`, `gimbal_bracket`, `gimbal_tilt_motor`, `gimbal_pitch`, `camera_head`, `camera_face`, `lens_thermal`, `lens_wide`, `lens_tele`.
- Hinges, fixed to the body: `hinge_FL/FR/RL/RR_*` (housing bosses above and below the knuckle, split-line rings, the front pivot-pin caps).
- Arms: `arm_FL/FR/RL/RR` (the hinge pivots) with `arm_*_knuckle`, `arm_*_beam` and `arm_*_cover` (the raised top-cover strip), then `motor_*`, `rotor_*`, `prop_*`, `blade_*_0/1`, `prop_*_blur`, `leg_FL/FR`, `foot_*`, `led_*`.

### Mount (`mountM3T`)

**Rendering**
- It has its own `WebGLRenderer` with a transparent canvas, so the slot's ash gradient shows through.
- Tone mapping is ACES with exposure 1.15.
- DPR is capped by the tier (`detectQuality().dprCap`). Texture size comes from the tier knob: 512 on lite and balanced, 1024 on high.
- The canvas is inserted under the slot's `.corners`, so the frame corners stay on top.

**Lighting**
- A warm-bone key (`#F3E8D8`, 3.4) sits up and to the left of the camera and follows the framing.
- A hemisphere fill provides 0.45.
- Two low ember rims (`#FF6A1F`, 0.5 and 0.28) come from behind.
- The `RoomEnvironment` is PMREM'd at environmentIntensity 0.75 for the glass and metal reflections.
- There is no floor. A soft radial contact shadow and four foot blobs ground the aircraft; the blobs fade as it lifts.

**Timeline** (its own IntersectionObserver; it starts once the slot is at least 30 % visible)
- 0–0.35 s: holds folded, resting on its belly and gimbal.
- 0.35–1.95 s: the arms unfold, front pair leading. The aircraft rises onto its legs as they swing down.
- Props flick open over 0.3 s.
- They spin up over 0.9 s while the blur fades in.
- It lifts off 32 mm over 1.5 s.
- The gimbal tilts to −30° over 1.3 s.
- The labels fade in at about 3.7 s, once the tilt settles. The idle starts at about 4.3 s.
- Idle: a ±3.4 mm hover bob (3.4 s period), a ±15° turntable sway (20 s period) and a 0.5° roll wobble.

**Static mode (`motion === false`)**
- Shows the final pose: unfolded, hovering, crisp blades and the gimbal at −30°.
- It is rendered once, and again on resize. There is no loop.

**Pausing and input**
- Rendering stops when the slot leaves the viewport or the tab is hidden. The clock is accumulated, so it resumes where it stopped.
- Drag-to-orbit is horizontal only (±28°) and springs back. The wrapper has `touch-action: pan-y`, so vertical swipes still scroll the page.

**Lifecycle**
- `onReady()` is called right after the first `renderer.render`, which happens synchronously at mount.
- `dispose()` frees geometries, materials, textures, the PMREM target and the renderer, forces a context loss, and removes the canvas, labels and injected `<style>`. This was checked in Chrome: only `.corners` is left in the slot.

**Labels**
- These are DOM plates (JetBrains Mono, `#ECE7E0` on `rgba(15,14,13,.9)`, square corners) with SVG leaders and anchor rings.
- Text (verified figures only):
  - "Thermal · 640×512 · 40 mm eq"
  - "Wide · 48 MP · 24 mm eq"
  - "Tele · 12 MP · 162 mm eq"
- Below 560 px they shorten to "Thermal · 640×512", "Wide · 48 MP" and "Tele · 12 MP".
- Layout: the plates always sit in a band along the bottom edge. The aircraft is wider than it is tall, so that band is the free space in both the 16:10 desktop slot and the 1:1 phone slot (`pilot.css`, below 600 px).
  - The camera is solved so the aircraft fills everything above the band, including the rotor discs over the whole ±15° sway.
  - One row with full text if it fits. Otherwise one row with short text. Otherwise short text stacked in three rows, which happens for slots under about 340 px wide, i.e. viewports under about 380 px.
  - Plate order, and the stack's side, are picked so that no leader crosses another at any point of the sway, with the shortest leaders as the tie-break. Checked: 0 crossings from 300 to 1440 px, static and animated.
  - The plates are clamped inside the slot margins, which clear the frame corners. They never overlap each other and never cover the aircraft. The leader lines do cross the aircraft.

### Sandbox flags (`/table/m3t.html`)

- `?view=front|back|left|right|top|bottom|34|folded`:
  - `34` is the site's hero camera, static.
  - The others are near-orthographic review cameras with fov 14° and no labels.
- `?fold=0..1`, `?pitch=deg`, `?yaw=deg`, `?prop=deg` (rotor angle), `?blur=0..1`
- `?detail=table`
- `?motion=0`: the site's static pose.
- `?frame=<s>`: a deterministic still at timeline time s, using the animated framing.
- `?labels=0`
- `?wire=1`, `?sil=1`, `?bg=light|white`
- `?q=lite|balanced|high`
- `?focus=<node>`: frames one part, e.g. `gimbal`, `gimbal_pitch`, `motor_FL`, `body`.
- `?grid=360,390,430,768&z=0.6`: same-origin iframes at those slot widths. Other flags pass through.
- `window.__m3t` is the handle, so you can call `renderAt(t)`, `pose({...})`, `stats()` or `dispose()`.

## Dimensions: built model vs DJI

All values are in mm and exclude propellers. They come from `measure()`, run in Node against the vendored three r170.

| | DJI (FACTS §3) | hero | table |
|---|---|---|---|
| Unfolded span (across front motors) | 347.5 | **347.5** | 346.2 |
| Unfolded nose-to-tail (gimbal lens rims to rear motor backs) | 283 | **283.3** | 283.3 |
| Unfolded height (feet to top-port cover) | 107.7 | **107.7** | 106.2 |
| Folded length (lens rims to tail) | 221 | **222.1** | 222.7 |
| Folded width (folded motor housings) | 96.3 | **96.5** | 96.5 |
| Folded height (gimbal bottom to top port) | 90.3 | **90.2** | 88.7 |
| Diagonal, motor to motor in plan | 380.1 | **381.1** (383.6 in 3D) | same |
| Prop diameter (9453F) | ≈239 | 239 | 239 |

- DJI writes 347.5 × 283 × 107.7 as L × W × H, but the 347.5 is the side-to-side span.
- Proof:
  - On DJI's top-view photo, the ratio of span to nose-to-tail is 1.22, and 347.5 / 283 = 1.23.
  - The diagonal only works this way round.
- Layout derived from that:
  - Front motor axes at (±160.25, 66, 120.1) mm, with 27 mm housings: 2 × 160.25 + 27 = 347.5.
  - Rear motor axes at (±129, 22, −128) mm.
  - Gimbal lens rims at z +141.8 and rear motor backs at −141.5.
- Front and rear prop discs are 11 mm apart. Rotor-to-body clearance is 1.9 mm at the front and 3.3 mm at the rear.
- The diagonal is 1 mm over DJI's 380.1. That is the price of keeping the rear blades clear of my battery tail. The real tail is shaped a little differently, but the tail taper was matched to DJI's top view as closely as the clearance allowed.
- Front motors sit higher than the rear motors (hub tops at 86.5 and 42.5 mm), as in DJI and Mavic 3 side views.

**Fold kinematics**
- Each arm turns about a single hinge axis. The axis is computed as the one closest to vertical that carries the unfolded motor point onto a chosen folded point.
- Front arms:
  - Hinge at (±37.5, 92, 70.5), high on the shoulder.
  - The axis is tilted 5.4° and the arm swings 113.4° back.
  - The folded motor sits at (±34.7, 87.2, −64) along the upper flank, and the front legs end up above the gimbal's bottom.
- Rear arms:
  - Hinge at (±31, 36, −40), low under the tail.
  - The axis is tilted 4.5° and the arm swings 130.5° forward.
  - The folded motor stands upright beside the gimbal at (±34.7, 41, 95), as in DJI's folded M3T photo.
- Fold angles are smootherstep-eased and the arms are staggered.

**Hinges** (rebuilt after the user's review, 16 Oct)
- **Body side (fixed):**
  - A housing boss above and below each knuckle, on the pivot axis, with split-line rings.
  - The front upper boss forms a shoulder bump with a pivot-pin cap. These caps are the two round marks DJI's top view shows at the front shoulders, which I had first guessed were upward vision windows.
  - The rear upper boss grows up into the tail, so the rear knuckle reads as part of the body and not as a peg.
  - A dark rounded pocket is painted into the shell's own albedo and occlusion maps at the hinge's surface UV, so it follows the curved flank exactly. It is stretched toward the side the root sweeps when folding.
- **Arm side (rotating):**
  - A knuckle barrel on the axis: radius 9.5 mm (front) / 9.2 mm (rear), height 18 / 16 mm.
  - A root block that flows out of the knuckle: 16.8 × 16 mm at the front (w × h) and 16.8 × 15.2 mm at the rear.
  - The beam's flattened section (top roundness 4.2, bottom 3.0) tapers about 2.1× to the motor: 8 × 7.2 mm at the front tip, 7.6 × 6.8 mm at the rear tip.
  - A raised top-cover strip (0.8 mm) runs along the top, as on DJI's arms. These details come from DJI arm photos.
  - The beam bows 4.6 mm (front) and 6.6 mm (rear) toward the side that faces outboard when folded, so a folded arm lies outside the shell.
- **The front legs are now broad fins** (15 → 9.6 mm fore-aft), as in DJI's arm photos.
- **Penetration of each arm into the shell and battery**, measured with ray-parity inside tests on every second vertex:
  - Measured for fold = 1, 0.75, 0.5, 0.25 and 0.
  - The root within 12 mm of the pivot is excluded; it seats in the pocket.
  - fold 1: clear. fold 0.75: clear. fold 0.5: clear.
  - fold 0.25: rear arm 1.1 mm at one vertex.
  - fold 0: the front root sits up to 3.9 mm in, within the painted pocket. The front motor housing's lower rim is 1.5 mm into the battery's top corner (10 of 539 vertices). The rear arm is at most 1.1 mm.
- **Close-ups:** before and after stills of all four hinges, from the hero 3/4 camera and from above, are in `<session-scratchpad>/hinges/`. Use `?focus=hinge_FL` etc. in the sandbox; for the right-hand hinges add `&yaw=68`.

## Evidence: what was confirmed, what was guessed

The user can't supply `ref-m3t-*` images, so DJI's official pages and DJI product renders were the only references. They were viewed in Chrome and not downloaded; session screenshots only. Sources:
- **enterprise.dji.com/mavic-3-enterprise:**
  - The "Three Models" section shows close-ups of the folded M3E, M3T and M3TA.
  - The "Focus and Find" close-up shows the M3E's rectangular wide window marked 24 mm-equivalent, f/2.8.
  - The "Compact and Portable" frame shows an unfolded M3E.
- **enterprise.dji.com/mavic-3-enterprise/specs:**
  - Diagonal 380.1 mm; propeller "9453F Propellers for Enterprise"; motor model 2008.
  - M3T tilt −135° to 45° mechanical, −90° to 35° controllable.
  - "Omnidirectional binocular vision system, supplemented with an infrared sensor at the bottom of the aircraft".
  - "Beacon: built into the aircraft".
- **DJI's own product renders, found via image search on reseller pages:**
  - top view of the M3T, rear view, side-front 3/4 of the M3T, and a Mavic 3 Pro side view (same airframe).
  - Two DJI patent drawings of the Mavic 3 airframe, used for the arm layout only.

**Confirmed from DJI photos and specs:**
- Gimbal lens layout, seen from the front:
  - Top right: a rounded-rectangle window. This is the **wide** camera, by direct correspondence with the M3E, where DJI prints "24 mm f/2.8" next to the same window.
  - Bottom right: the larger round window. This is the **thermal** camera; it has the biggest aperture (40 mm-equivalent at f/1.0, about 9 mm clear aperture) and the dark germanium look.
  - Bottom left: a smaller round lens with a bright metal ring. This is the **tele** camera, the same module and ring as the M3E's tele.
  - The DJI logo spot at top left is left blank.
- A large round tilt motor on the gimbal's aircraft-left side, a row of vent slots along the head's top front edge, and a damped mount under the nose.
- Arm fold: the front arms swing back along the upper flanks. The rear arms swing forward, and the folded rear motor stands upright beside the gimbal with its status-light window and lower cooling grooves.
- Landing gear: long slender legs under the front motors (with built-in antennas, per DJI) and short feet under the rear motors.
- Front vision sensors are large round windows at the two front corners of the nose. The rear pair sits at the tail's top corners. Downward sensors and the infrared sensor are on the belly.
- Air intake: a long stadium slot with fins across the top of the nose.
- Top accessory port: a raised rounded cover on the deck centre line. The M3E photo shows the RTK module mounted on top.
- Rear face: two vision sensors, a beacon bump at top centre, the battery's four level LEDs plus power button, and a vent strip at the bottom.
- Props: two-blade folding 9453F, dark with orange tips (orange-tipped in every M3E/M3T photo). Front motors sit higher than the rear.
- Colour: dark enterprise grey, matte to satin.

**Inferred or guessed:**
- **Rear-arm fold direction.** The brief says the rear arms "rotate down and forward under the body". DJI's figures (folded height 90.3 against 107.7 unfolded) and the folded photo (rear motor upright, its foot level with the gimbal bottom) instead require the folded rear motor to end up about 19 mm *higher* than its unfolded height. So it swings forward along the lower flank about a near-vertical axis. If a better reference shows otherwise, change `ARMS.*.fold` in `model.js`; the hinge axis is derived from it.
- **The exact hood and nose surface.** It is a superellipse loft tuned to the photos. DJI's hood has a slightly sharper brow above the sensors than mine.
- **The battery seam.** I model it as a transverse gap plus a low flank panel line. I couldn't see the true split line on the M3T.
- **Lateral sensing.** DJI lists lateral sensing, but I couldn't see dedicated side windows, so I didn't add any. The front and rear corner sensors are wide-angle and probably cover the flanks.
- **Upward sensing:** DJI lists it, but I couldn't identify its windows. The two dots on DJI's top view turned out to sit where the front hinge pins are, so they are modelled as pin caps.
- **The beacon:** a small amber lens at the top rear centre, from the bump in the rear view and the dot in the top view.
- **Front LEDs** are red and face forward on the front motor housings. **Status lights** are green windows on the rear motor housings. I couldn't confirm the colours and exact positions.
- **The gimbal's internal stack** (yaw → roll → pitch arms behind the head) is simplified to match the visible silhouette.
- **Blade planform and twist** are generic 9.4 × 5.3 in values. The orange tip band is about 11 % of the span.
- **Belly details** (sensor spacing, auxiliary light shape) are approximate.

## Triangles

- **Hero:** 93.1k triangles (after the hinge rebuild) in about 140 draws.
- **Table:** 5.8k triangles in about 75 draws.
- Hero breakdown (before the hinge rebuild): the body, battery, sensors and details were 38.5k; the gimbal 9.0k; about 9–10k per arm unit. The hinges added about 1.9k per arm.
- Table breakdown: body 1.1k, gimbal 1.0k, about 0.7k per arm unit.

## Checks done

All checks used claude-in-chrome on port 5210 with one tab.
- **Widths:** 360, 390, 430, 768, 1024, 1440 and 2000 in the static pose. After the phone slot became 1:1: 360, 390, 430 and 600 on the real page through the coordinator's shell harness, plus slot widths 300–1440 measured in the sandbox (0 leader crossings, all plates inside, no overlap). 390 and 1024 were also checked in the animated framing (`?frame=9`).
  - The aircraft fills the slot at every width.
  - The labels sit in the bottom row (short text below 560 px) and never overlap or clip.
- **Views:** front, back, left, right, top and bottom; `folded`; the hero 3/4.
- **Close-ups:** body, gimbal and the camera face.
- **Fold sweep:** top views at fold 0, 0.4 and 0.7. No arm passes through another or through the body.
- **Timeline stills** at 0, 1.0, 2.15, 3.2, 6 and 9 s.
- **Comparison sheets:** reference against render for folded 3/4, top, back and side, made with `make_visual_comparison_sheet.py`.
- **Real page:** `/?motion=0#pilot`.
  - The 758 × 474 slot mounts and the placeholder fades.
  - The canvas sits under the frame corners and the labels show in a row.
- **Console:** no errors.
- **Dispose:** leaves only `.corners`.
- **Node:** builds headlessly in about 0.5 s; all the measurements above come from there.

## Known gaps

- The hood's top edge is softer than DJI's crisp brow, and the gimbal head is a slightly simpler rounded box than DJI's wrap-around front bezel.
- The arms are plain tapered tubes. DJI's arms have a flatter top face and printed lettering, which is deliberately omitted.
- **Folded state:**
  - Folded, the front root and motor still touch the shell by a few millimetres (measured above). The pocket is painted, not a cut recess.
  - The two folded blades of each prop touch along part of their twisted roots.
  - The folded rear blades' inner edges brush the lower flank.
  - All of this is only visible during the first 0.35 s of the animation and in `?view=folded`.
- The drag-to-orbit and the live rAF loop could only be exercised in a hidden tab, through `?frame=` and `renderAt()`. On a real device, test pause and resume on scroll and on a tab switch, plus the drag on a phone.
- Building textures blocks the main thread for about 0.3–0.6 s at mount (512 px tier); 1024 px on the high tier takes about double. The site loads the module at idle, near the viewport.
- No governor is attached yet. If wave 2 needs it, `startGovernor` from `lib/quality.js` can drive the DPR.
- **Sculptor skill:**
  - The formal pass-by-pass review gates (8 locked passes with `append_sculpt_review`) were condensed. I reviewed each concern with Chrome close-ups and comparison sheets rather than eight separate gated renders. The spec JSON documents the build after the fact, and its `reviewHistory` is left empty instead of claiming passes.
  - The spec predates the hinge rebuild: it still lists `vision_up_*` and the old thin arms. Regenerate or patch it if it's kept.
  - `validate_sculpt_spec.py` gives **PASS**. With `--strict-quality` it **FAILS** on one honest item: the battery material has no referencePbr. The best battery crop in the reference screenshots scored 0.662, below the 0.7 bar. The shell scored 0.761, the plastic 0.80 and the blades 0.86, so those passed.
  - Closing the battery gap needs a close, neutral-lit photo of the M3T battery.
- Panel seams are drawn in albedo and as an AO map in loft space, so they darken the environment light. They are not true geometric grooves; only the battery seam is a real gap.

## Wave 2 notes (command table)

- `buildM3T({ detail: 'table' })` is about 4.9k triangles with plain materials (no textures except the blade and disc atlases). It has the same API, anchors and fold.
- Scale it into table units yourself, because the model is in real metres.
- `setFold`, `setProps(angle, blur)` and `setPropOpen` drive the lift-off from the truck bed.
- The origin is at the feet, so resting it on a surface means placing y = 0 there. When folded, the aircraft's lowest point is 17.5 mm above y = 0; the mount compensates using `measure()`-style sampling.
