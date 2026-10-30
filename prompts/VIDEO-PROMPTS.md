# Sequoia Wildfire: hero video prompts

## The film (2026-10-24): 22 scenes × 10 s = 3:40

The user asked for:
- a film showing what we actually do;
- bright sun (never evening light), natural live footage ("should look natural"), and fades;
- the real-work scenes;
- CG interludes "in the middle of the footage ... kind of sci fi", like adverts.

**Regenerated 2026-10-27:** scenes 10 (16:9 and 9:16), 11, 12, 14 and 16 were redone from the fixed prompts below and are spliced into the web cut (`tools/film-cut.py`). The new 12 still brushes past a tower's legs at 6.6 s, so the cut uses its first 6 s. Scene 21 stays out.

Each CG scene starts from the last frame of the live shot before it, so the CG takes over that shot. The CG speaks the site's own language: the terrain model, the lens cones, the map pin and the routes.

In the edit I trim to about 3:00 and add the titles and end card. I also cut 60, 30 and 15 s versions.

**Every scene:**
- **Format:** 16:9, 1920×1080 or higher, 24 fps, 10 s. Sound off, or natural ambience only (no music, no voices).
- **Order:** generate in scene order, so each CG scene can start from the live clip before it.
- **Reference:** make scene 04 (the guard) first. Use your best still of the guard, the truck and the drone as reference images for every live scene, and reuse the seed if your tool offers it.
- **Negative prompts:** live scenes use the live negative prompt; CG scenes use the CG one (both at the bottom).
- **Fades:** in from white and out to white, 0.5 s. The film opens with a 1 s fade-in and closes with a 1.5 s fade-out under the end card. A live scene right before a CG scene doesn't fade out, because the CG starts from its last frame. If your tool makes the fades flicker, delete the **Fades** line and I'll add exact fades in the edit.
- **Length:** if your tool caps prompt length, cut **Look** or **Style** first, then **Light**.
- **Phone hero:** generate scenes 04, 10 and 14 again in 9:16. Change the first line to `Vertical 9:16 cinematic shot, ...` and add `Framing: keep the action in the middle 70% of the frame height.` Save them as `cine-04-patrol-v.mp4`, `cine-10-launch-v.mp4` and `cine-14-thermal-v.mp4`.
- **Files:** save as `media/incoming/cine-NN-<name>.mp4`, as listed under each scene.

| Scene | Film time | Type | Step | Shot |
|---|---|---|---|---|
| 01 | 0:00 | Live | The site | Slow aerial glide; the valley opens up |
| 02 | 0:10 | **CG** | The site | CG: the valley turns into a precise 3D model of the site |
| 03 | 0:20 | Live | Ground monitoring | Tripod pan with the patrol truck |
| 04 | 0:30 | Live | Ground monitoring | Steadicam behind the guard; binoculars over the valley (phone hero 1) |
| 05 | 0:40 | Live | Ground monitoring | The guard photographs dry grass on the substation fence |
| 06 | 0:50 | Live | Ground monitoring | Hot-work fire watch: grinding sparks, the guard on watch |
| 07 | 1:00 | Live | Aerial inspection | Pilot training: the guard flies, the instructor watches |
| 08 | 1:10 | Live | Aerial inspection | Wind check before the flight |
| 09 | 1:20 | Live | Aerial inspection | Close-up: unfold, battery, power on |
| 10 | 1:30 | Live | Aerial inspection | Low camera tilts up with the lift-off (gentle slow-mo) (phone hero 2) |
| 11 | 1:40 | **CG** | Aerial inspection | CG: three lens cones unfold from the drone onto the forest |
| 12 | 1:50 | Live | Aerial inspection | A camera drone follows the drone along the power line |
| 13 | 2:00 | Live | Aerial inspection | The drone passes over an active forestry block |
| 14 | 2:10 | Live | Thermal detection | The drone's view switches to thermal and finds the hotspot (phone hero 3) |
| 15 | 2:20 | Live | Thermal detection | The telephoto camera zooms in on the smouldering stump |
| 16 | 2:30 | Live | Live situational awareness | Over the shoulder: the hotspot on the controller, a tap, a radio call |
| 17 | 2:40 | **CG** | Digital mapping | CG: the thermal view lifts off the screen into a 3D map; pin, routes |
| 18 | 2:50 | Live | Thermal detection | The guard walks in to the stump and reports it |
| 19 | 3:00 | Live | Reporting and coordination | The guard shows the client the map, then points to the hill |
| 20 | 3:10 | **CG** | Reporting and coordination | CG: the report assembles from the tablet and goes out to the client |
| 21 | 3:20 | Live | Monitoring over time | Next day: the same thermal view, the stump now cold |
| 22 | 3:30 | Live | From the ground and the sky | The drone lands (gentle slow-mo), then a slow aerial pull-back |

Titles go on in the edit, not in the footage: the step names, then the end card "Protecting critical infrastructure from the ground and the sky", "Request a wildfire monitoring proposal" and a small "Proposed service. Illustrative footage."

### Scene 01 · `cine-01-site.mp4` (0:00): The site
```
16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style.

Scene: the dry hills of the British Columbia Interior near Kamloops: open ponderosa pine and Douglas-fir forest, golden bunchgrass and grey-green sagebrush, a river valley with a white concrete hydro dam holding a deep-blue reservoir, a fenced electrical substation on a gravel pad below the dam, and a transmission line of steel lattice towers crossing the hills.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.

Timeline:
0.0-4.0 s: treetops on the ridge pass slowly below the camera.
4.0-10.0 s: the ridge drops away and the valley opens up: the dam and its reservoir, the river running out below it, the substation, the gravel access road and the transmission line crossing the forested hills.
Fades: fade in from pure white over the first 1.0 s; no fade out (end on a clean frame: the next shot starts from it).

Camera: a camera drone 120 metres up glides slowly forward at about 4 m/s, horizon level, gently angled down, 24 mm lens, constant speed, no cuts.
Light: bright natural midday sun, deep-blue sky with a few small white cumulus clouds, crisp short shadows.
Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.
```

### Scene 02 · `cine-02-cg-twin.mp4` (0:10) · CG: The site
**How to make it:** use your tool's *Extend / Continue* on scene 01, or image-to-video with the **last frame of scene 01** as the start image. Use the CG negative prompt.
```
16:9 cinematic CG takeover shot, 10 seconds, 24 fps, one continuous take: a photorealistic sunlit world with clean CG elements.

Starts from the provided frame: a sunny British Columbia valley seen from a drone, with a hydro dam, reservoir, river, substation and a transmission line.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.

Timeline:
0.0-2.0 s: the real aerial footage continues, the camera still gliding slowly forward.
2.0-5.0 s: a thin line of light sweeps across the landscape from left to right. Behind it the photo becomes a precise digital terrain model: smooth matte white ground with fine engraved contour lines, the forest as thousands of small detailed model conifers, the dam, substation and lattice towers as clean white architectural models, the river and reservoir as smooth glassy blue.
5.0-8.0 s: the camera keeps gliding and slowly rises. The transmission line lights up as one thin cobalt-blue line from tower to tower, and a cobalt outline traces itself around the dam, the substation and the corridor.
8.0-10.0 s: the edges of the land fall away into a bright white void, revealing the whole valley as a floating terrain model with cut earth sides, lit softly like a product in a studio.
Fades: no fade in (it starts from the live frame); fade out to pure white over the last 0.5 s.

Camera: the same slow forward glide as the footage it starts from, easing into a gentle rise, no cuts.
Style: clean, bright, minimalist sci-fi in a sunlit world: white and pale grey surfaces, thin precise cobalt-blue lines, a single ember-orange accent for heat, soft light, crisp detail; a premium technology film. No text, numbers, labels, logos or interface. No laser beams.
```

### Scene 03 · `cine-03-arrival.mp4` (0:20): Ground monitoring
```
16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style.

Scene: a gravel access road along a transmission corridor of steel lattice towers in the dry hills of the British Columbia Interior; open ponderosa pine and Douglas-fir forest on both sides, golden grass along the verge.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.
Subject: an unbranded white pickup truck with an amber roof light bar, driving at about 40 km/h, amber light flashing slowly.

Timeline:
0.0-4.0 s: the truck comes round a bend in the distance and drives toward the camera, a light trail of dust behind it.
4.0-7.0 s: it passes the camera about 5 metres away, gravel crunching under the tyres.
7.0-10.0 s: it slows, pulls onto a gravel pullout at the foot of a lattice tower and stops; the dust drifts away on the breeze.
Fades: fade in from pure white over the first 0.5 s; fade out to pure white over the last 0.5 s. No other transitions.

Camera: tripod at the roadside at eye level, one smooth, slow pan following the truck, 50 mm lens, no cuts.
Light: bright natural midday sun, deep-blue sky with a few small white cumulus clouds, crisp short shadows.
Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.
```

### Scene 04 · `cine-04-patrol.mp4` (0:30): Ground monitoring · phone hero 1
```
16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style.

Scene: a gravel access road along a sunny ridge in the dry hills of the British Columbia Interior: a tall steel lattice transmission tower beside the road with its conductor lines sweeping across the valley, open ponderosa pine and Douglas-fir forest, golden bunchgrass; far below, a blue river, a white concrete dam and a fenced substation. The white pickup with its amber light bar is parked on a pullout behind.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.
Subject: a fire watch security guard in a white hard hat, dark safety glasses, charcoal long-sleeve work shirt, fluorescent orange high-visibility vest with silver reflective stripes, dark work trousers, tan leather gloves, brown leather boots and a radio on the vest shoulder (no lettering, logos or patches), binoculars in one hand.

Timeline:
0.0-4.0 s: the guard walks along the gravel road toward the tower at a normal pace, seen from behind.
4.0-7.0 s: the guard stops at the edge of the ridge and looks out over the valley.
7.0-10.0 s: the guard raises the binoculars and slowly scans the forested slopes below.
Fades: fade in from pure white over the first 0.5 s; fade out to pure white over the last 0.5 s. No other transitions.

Camera: steadicam following about 3 metres behind the guard at shoulder height, at walking pace, easing to a stop with the guard, 35 mm lens, no cuts.
Light: bright natural midday sun, deep-blue sky with a few small white cumulus clouds, crisp short shadows.
Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.
```

### Scene 05 · `cine-05-hazard.mp4` (0:40): Ground monitoring
```
16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style.

Scene: the outside of a substation's chain-link fence on a gravel pad in the dry hills of the British Columbia Interior; steel transformers and insulators behind the fence; tall dry golden grass growing up against the fence; forested hills and a lattice tower beyond.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.
Subject: a fire watch security guard in a white hard hat, dark safety glasses, charcoal long-sleeve work shirt, fluorescent orange high-visibility vest with silver reflective stripes, dark work trousers, tan leather gloves, brown leather boots and a radio on the vest shoulder (no lettering, logos or patches), carrying a rugged grey tablet.

Timeline:
0.0-4.0 s: the guard walks along the outside of the fence, checking the fence line and the grass.
4.0-7.0 s: the guard stops and crouches beside a patch of tall dry grass growing against the fence, pushing it aside with a gloved hand.
7.0-10.0 s: the guard holds up the tablet and takes a photo of it. The screen faces away from the camera.
Fades: fade in from pure white over the first 0.5 s; fade out to pure white over the last 0.5 s. No other transitions.

Camera: tripod, medium side shot at waist height, a very slow push-in as the guard crouches, 50 mm lens, no cuts.
Light: bright natural midday sun, deep-blue sky with a few small white cumulus clouds, crisp short shadows.
Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.
```

### Scene 06 · `cine-06-hotwork.mp4` (0:50): Ground monitoring
```
16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style.

Scene: a remote construction site in the dry hills of the British Columbia Interior: a cleared gravel pad beside a new steel lattice tower base, steel beams resting on timber blocks, the dry grass at the edge of the pad cut short, forest beyond.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.
Subjects: a contractor in a welding helmet, leather jacket and gloves (no lettering), grinding a steel beam; and a fire watch security guard in a white hard hat, dark safety glasses, charcoal long-sleeve work shirt, fluorescent orange high-visibility vest with silver reflective stripes, dark work trousers, tan leather gloves, brown leather boots and a radio on the vest shoulder (no lettering, logos or patches), standing about 5 metres away with a red fire extinguisher in hand.

Timeline:
0.0-4.0 s: the contractor grinds the end of a steel beam; a stream of orange sparks sprays onto the bare gravel.
4.0-7.0 s: the guard stands still and watches where the sparks land, extinguisher ready.
7.0-10.0 s: the grinding stops; the guard walks over and checks the gravel and the edge of the dry grass, crouching to look closely.
Fades: fade in from pure white over the first 0.5 s; fade out to pure white over the last 0.5 s. No other transitions.

Camera: tripod, wide-medium side shot at eye level, a slow pan following the guard, 35 mm lens, no cuts.
Light: bright natural midday sun, deep-blue sky with a few small white cumulus clouds, crisp short shadows.
Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.
```

### Scene 07 · `cine-07-training.mp4` (1:00): Aerial inspection
```
16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style.

Scene: an open gravel training area on a sunny day in the dry hills of the British Columbia Interior: a few orange traffic cones, a round grey-and-orange folding landing pad, forested hills beyond.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.
Subjects: a fire watch security guard in a white hard hat, dark safety glasses, charcoal long-sleeve work shirt, fluorescent orange high-visibility vest with silver reflective stripes, dark work trousers, tan leather gloves, brown leather boots and a radio on the vest shoulder (no lettering, logos or patches), holding a dark grey drone remote controller with two thumb sticks below a built-in 5.5-inch screen and two short antennas folded up at the top (not a tablet, not a handheld thermal camera); beside them, an instructor in a navy polo shirt, cap and sunglasses holding a clipboard (no lettering). In the air in front of them: a compact matte dark grey quadcopter about 35 cm across, the size of a laptop (no logos or lettering), with four slim folding arms, two-blade grey propellers, small green and red navigation lights and, under its nose, a gimbal camera with three lens windows: a large thermal lens, a wide camera and a small telephoto.

Timeline:
0.0-4.0 s: the drone hovers steadily about 10 metres in front of them, then flies a slow, smooth line between the cones.
4.0-7.0 s: the instructor watches the drone and says something; the guard nods, eyes on the drone.
7.0-10.0 s: the drone flies back and lands precisely on the pad; the instructor ticks a box on the clipboard.
Fades: fade in from pure white over the first 0.5 s; fade out to pure white over the last 0.5 s. No other transitions.

Camera: static medium-wide two-shot from behind and to one side, then a slow pan to the landing pad, 35 mm lens, no cuts.
Light: bright natural midday sun, deep-blue sky with a few small white cumulus clouds, crisp short shadows.
Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.
```

### Scene 08 · `cine-08-windcheck.mp4` (1:10): Aerial inspection
```
16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style.

Scene: a gravel pullout beside a steel lattice transmission tower on a sunny ridge in the dry hills of the British Columbia Interior; the white pickup parked with its tailgate down and a hard drone case on it; forest and valley beyond.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.
Subject: a fire watch security guard in a white hard hat, dark safety glasses, charcoal long-sleeve work shirt, fluorescent orange high-visibility vest with silver reflective stripes, dark work trousers, tan leather gloves, brown leather boots and a radio on the vest shoulder (no lettering, logos or patches), holding up a small handheld wind meter with a spinning vane (its small display shows nothing readable).

Timeline:
0.0-3.0 s: the guard holds the wind meter up at arm's length; its vane spins in the light breeze.
3.0-6.0 s: the guard checks it, then looks up at the sky and the treetops moving gently.
6.0-10.0 s: the guard gives a short nod, lowers the meter and walks to the tailgate.
Fades: fade in from pure white over the first 0.5 s; fade out to pure white over the last 0.5 s. No other transitions.

Camera: medium shot at eye level, gentle handheld, 50 mm lens, then a slow pan with the guard to the tailgate, no cuts.
Light: bright natural midday sun, deep-blue sky with a few small white cumulus clouds, crisp short shadows.
Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.
```

### Scene 09 · `cine-09-preflight.mp4` (1:20): Aerial inspection
```
16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style.

Scene: the open tailgate of a white pickup truck parked on gravel beside a lattice transmission tower; sunny dry hills and forest softly out of focus behind.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.
Subject: on the tailgate, the gloved hands and orange vest of a fire watch security guard in a white hard hat, dark safety glasses, charcoal long-sleeve work shirt, fluorescent orange high-visibility vest with silver reflective stripes, dark work trousers, tan leather gloves, brown leather boots and a radio on the vest shoulder (no lettering, logos or patches) prepare a compact matte dark grey quadcopter about 35 cm across, the size of a laptop (no logos or lettering), with four slim folding arms, two-blade grey propellers, small green and red navigation lights and, under its nose, a gimbal camera with three lens windows: a large thermal lens, a wide camera and a small telephoto. Beside it lie a dark grey drone remote controller with two thumb sticks below a built-in 5.5-inch screen and two short antennas folded up at the top (not a tablet, not a handheld thermal camera) and an open hard case.

Timeline:
0.0-3.0 s: the folded drone lies on the tailgate; the gloved hands pick it up.
3.0-6.0 s: the hands swing the front arms out sideways and the rear arms down and out until each locks in place, then unfold the propeller blades.
6.0-8.0 s: a battery slides into the back of the drone; a row of small status lights glows.
8.0-10.0 s: the hands set the drone down and pick up the controller; its screen lights up with a live camera image (no readable text).
Fades: fade in from pure white over the first 0.5 s; fade out to pure white over the last 0.5 s. No other transitions.

Camera: close-up from the side at tailgate height, nearly static with a slight natural handheld drift, 50 mm lens, no cuts.
Light: bright natural midday sun, deep-blue sky with a few small white cumulus clouds, crisp short shadows.
Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.
```

### Scene 10 · `cine-10-launch.mp4` (1:30): Aerial inspection · phone hero 2
```
16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style.

Scene: an open gravel pullout on a sunny ridge in the dry hills of the British Columbia Interior: pine and fir forest, a valley below with a blue river, a white concrete dam and a fenced substation. A steel lattice tower stands about 60 metres away, small in the background. The white pickup is parked behind.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.
Subjects: in the foreground, sitting on a round grey-and-orange folding landing pad in open ground, a compact matte dark grey quadcopter about 35 cm across, the size of a laptop (no logos or lettering), with four slim folding arms, two-blade grey propellers, small green and red navigation lights and, under its nose, a gimbal camera with three lens windows: a large thermal lens, a wide camera and a small telephoto. A few metres behind it, a fire watch security guard in a white hard hat, dark safety glasses, charcoal long-sleeve work shirt, fluorescent orange high-visibility vest with silver reflective stripes, dark work trousers, tan leather gloves, brown leather boots and a radio on the vest shoulder (no lettering, logos or patches), standing, holding a dark grey drone remote controller with two thumb sticks below a built-in 5.5-inch screen and two short antennas folded up at the top (not a tablet, not a handheld thermal camera).

Timeline:
0.0-3.0 s: the propellers spin up; dust and dry grass stir around the pad.
3.0-5.0 s: gentle slow motion as the drone lifts off the pad, level and steady.
5.0-10.0 s: real time: it climbs straight up at about 4 m/s into open blue sky, far from the tower and the power lines, and hovers while the guard watches it, controller in hand.
Safety: the drone never flies near, under or through the tower or the power lines.
Fades: fade in from pure white over the first 0.5 s; no fade out (end on a clean frame: the next shot starts from it).

Camera: low tripod at ground level behind the pad, tilting up slowly to follow the drone, 28 mm lens, no cuts.
Light: bright natural midday sun, deep-blue sky with a few small white cumulus clouds, crisp short shadows.
Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.
```

### Scene 11 · `cine-11-cg-lenses.mp4` (1:40) · CG: Aerial inspection
**How to make it:** use your tool's *Extend / Continue* on scene 10, or image-to-video with the **last frame of scene 10** as the start image. Use the CG negative prompt.
```
16:9 cinematic CG takeover shot, 10 seconds, 24 fps, one continuous take: a photorealistic sunlit world with clean CG elements.

Starts from the provided frame: a small dark grey drone hovering in a blue sky above a sunny forested slope.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.

Timeline:
0.0-2.0 s: the real footage continues; the camera starts to rise and swing to one side of the hovering drone.
2.0-4.0 s: the camera settles high and to the side, looking down past the drone at the forest below; the drone stays in the upper part of the frame the whole time.
4.0-8.0 s: three translucent cones of light grow downward from the drone's gimbal camera, one after another, all starting from the same point on the camera: the widest (84 degrees) in soft white for the wide camera, a medium cone (61 degrees) in warm orange for the thermal camera, and a very narrow cone (15 degrees) in cobalt blue for the telephoto. Each cone is a four-sided pyramid; where it meets the forest it draws its rectangular footprint as a thin glowing outline: the white rectangle largest, the orange one inside it, the small blue one in the centre.
8.0-10.0 s: the camera holds on the drone, its three nested cones and their footprints on the sunlit slope.
Fades: no fade in (it starts from the live frame); fade out to pure white over the last 0.5 s.

Camera: one continuous rise and swing to the side, then a steady hold, no cuts.
Style: clean, bright, minimalist sci-fi in a sunlit world: white and pale grey surfaces, thin precise cobalt-blue lines, a single ember-orange accent for heat, soft light, crisp detail; a premium technology film. No text, numbers, labels, logos or interface. No laser beams.
```

### Scene 12 · `cine-12-corridor.mp4` (1:50): Aerial inspection
```
16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style.

Scene: a transmission corridor through the dry hills of the British Columbia Interior: a cleared strip of golden grass and low shrubs under three conductor lines strung between steel lattice towers, ponderosa pine and Douglas-fir forest on both sides, a gravel road along the strip, a blue river in the valley.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.
Subject: flying parallel to the power line, 40 metres up and 30 metres to the side of the towers, a compact matte dark grey quadcopter about 35 cm across, the size of a laptop (no logos or lettering), with four slim folding arms, two-blade grey propellers, small green and red navigation lights and, under its nose, a gimbal camera with three lens windows: a large thermal lens, a wide camera and a small telephoto.

Timeline:
0.0-5.0 s: the drone flies steadily away from the camera at about 8 m/s, keeping its distance from the line; its small shadow moves across the grass below.
5.0-10.0 s: a lattice tower passes well clear on the drone's left as it carries on beside the line toward the next one, following the gentle curve of the corridor.
Safety: the drone never flies between tower legs, through the tower lattice or under the conductor lines.
Fades: fade in from pure white over the first 0.5 s; fade out to pure white over the last 0.5 s. No other transitions.

Camera: a camera drone follows 20 metres behind and slightly above, matching its speed, steady and level, 35 mm lens, no cuts.
Light: bright natural midday sun, deep-blue sky with a few small white cumulus clouds, crisp short shadows.
Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.
```

### Scene 13 · `cine-13-forestry.mp4` (2:00): Aerial inspection
```
16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style.

Scene: an active forestry block in the dry hills of the British Columbia Interior: a gravel log landing with long stacked log decks, a parked yellow log loader and a feller buncher (no logos), skid trails, slash piles and standing ponderosa pine and Douglas-fir forest around the cut block.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.
Subject: small in the frame, a compact matte dark grey quadcopter about 35 cm across, the size of a laptop (no logos or lettering), with four slim folding arms, two-blade grey propellers, small green and red navigation lights and, under its nose, a gimbal camera with three lens windows: a large thermal lens, a wide camera and a small telephoto, flying 60 metres up.

Timeline:
0.0-5.0 s: the drone passes slowly over the log decks at about 5 m/s; its shadow crosses the logs.
5.0-10.0 s: it turns gently and heads along the edge of the cut block toward the standing forest.
Fades: fade in from pure white over the first 0.5 s; fade out to pure white over the last 0.5 s. No other transitions.

Camera: a camera drone high and to the side, a slow parallel tracking shot, angled down, 35 mm lens, no cuts.
Light: bright natural midday sun, deep-blue sky with a few small white cumulus clouds, crisp short shadows.
Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.
```

### Scene 14 · `cine-14-thermal.mp4` (2:10): Thermal detection · phone hero 3
```
16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style.

Scene: the dry hills of the British Columbia Interior seen from 100 metres above the forest: open ponderosa pine and Douglas-fir, golden grassy openings, a gravel access road, a transmission line on steel lattice towers, and a logged clearing with stumps and young regrowth.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.

Timeline:
0.0-4.0 s: natural colour, the drone's own camera view, moving slowly forward at about 5 m/s, angled 45 degrees down. The logged clearing comes into view; at its edge, one blackened stump gives off a faint thread of pale smoke. No flames.
4.0 s: the view switches instantly from the normal camera to the thermal camera, the way it does on the real drone; position and motion carry on unchanged.
4.0-10.0 s: thermal infrared in the Iron Red palette: shaded canopy deep indigo and violet, sun-warmed gravel road and rock magenta and red, conductor lines faint thin strokes, and the stump a single small, round white-yellow hotspot on the ground with an orange glow fading outward: no column, no plume, no rising flame. The drone slows to a hover and the camera tilts gently until the hotspot sits in the centre.
Fades: fade in from pure white over the first 0.5 s; fade out to pure white over the last 0.5 s. No other transitions.

Camera: stabilised drone gimbal, smooth and steady, 24 mm equivalent, no zoom.
Thermal look: authentic uncooled 640 x 512 thermal sensor: slightly soft detail, faint sensor noise, smooth temperature gradients. No text, numbers, crosshairs or interface.
Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.
```

### Scene 15 · `cine-15-tele.mp4` (2:20): Thermal detection
```
16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style.

Scene: a logged clearing at the edge of ponderosa pine and Douglas-fir forest in the dry hills of the British Columbia Interior, seen from the air at a steep angle: stumps, scattered dry branches, young regrowth, golden grass.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.
Subject: one blackened stump at the edge of the clearing, smouldering: a thin thread of pale smoke, a little grey ash around its base, slight heat shimmer above it. No flames.

Timeline:
0.0-5.0 s: from a hover about 100 metres away, the drone's telephoto camera zooms in steadily from a wide view of the clearing to a close view of the stump.
5.0-10.0 s: it holds on the stump; the thread of smoke drifts in the breeze.
Fades: fade in from pure white over the first 0.5 s; fade out to pure white over the last 0.5 s. No other transitions.

Camera: the drone's stabilised telephoto camera, steady hover, a smooth constant-speed zoom, long-lens compression, no cuts.
Light: bright natural midday sun, deep-blue sky with a few small white cumulus clouds, crisp short shadows.
Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.
```

### Scene 16 · `cine-16-mark.mp4` (2:30): Live situational awareness
```
16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style.

Scene: a gravel pullout on a sunny ridge in the dry hills of the British Columbia Interior; the white pickup and a lattice tower softly out of focus behind; across the valley, a forested hillside.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.
Subject: a fire watch security guard in a white hard hat, dark safety glasses, charcoal long-sleeve work shirt, fluorescent orange high-visibility vest with silver reflective stripes, dark work trousers, tan leather gloves, brown leather boots and a radio on the vest shoulder (no lettering, logos or patches), seen over the right shoulder, holding a dark grey drone remote controller with two thumb sticks below a built-in 5.5-inch screen and two short antennas folded up at the top (not a tablet, not a handheld thermal camera) in both hands. Its screen shows a live thermal image in the Iron Red palette: deep indigo and violet forest and one small white-yellow hotspot in the centre with an orange glow. No readable text.

Timeline:
0.0-4.0 s: the guard studies the thermal image on the screen.
4.0-6.0 s: the guard taps the screen once beside the hotspot.
6.0-10.0 s: the guard lifts the shoulder radio and speaks briefly, the controller still held up in view.
Fades: fade in from pure white over the first 0.5 s; no fade out (end on a clean frame: the next shot starts from it).

Camera: over-the-shoulder close-up, steady handheld, 50 mm lens, focus on the screen, no cuts.
Light: bright natural midday sun, deep-blue sky with a few small white cumulus clouds, crisp short shadows.
Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.
```

### Scene 17 · `cine-17-cg-map.mp4` (2:40) · CG: Digital mapping
**How to make it:** use your tool's *Extend / Continue* on scene 16, or image-to-video with the **last frame of scene 16** as the start image. Use the CG negative prompt.
```
16:9 cinematic CG takeover shot, 10 seconds, 24 fps, one continuous take: a photorealistic sunlit world with clean CG elements.

Starts from the provided frame: over the shoulder of a fire watch guard holding a drone controller whose screen shows a thermal image with a small hotspot.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.

Timeline:
0.0-2.0 s: the real footage continues; the guard holds the controller steady.
2.0-5.0 s: the hotspot on the screen pulses once. The image lifts off the screen as a thin floating layer of light and unfolds outward, growing into a translucent 3D terrain map of the whole valley floating in the air above the controller.
5.0-8.0 s: the camera pushes past the guard's shoulder into the floating map until it fills the frame: fine contour lines, the river, the dam, the substation and the transmission line in clean white and cobalt. A small ember-orange pin drops onto the hotspot and a soft pulse ring spreads from it.
8.0-10.0 s: lines draw themselves across the map: a solid cobalt line for the ground patrol route along the road, a dashed cobalt line for the drone's flight path, and small white dots at each observation point. The camera settles into a calm top-down view.
Fades: no fade in (it starts from the live frame); fade out to pure white over the last 0.5 s.

Camera: one continuous push-in from over the shoulder into the floating map, then a smooth tilt to top-down, no cuts.
Style: clean, bright, minimalist sci-fi in a sunlit world: white and pale grey surfaces, thin precise cobalt-blue lines, a single ember-orange accent for heat, soft light, crisp detail; a premium technology film. No text, numbers, labels, logos or interface. No laser beams.
```

### Scene 18 · `cine-18-groundcheck.mp4` (2:50): Thermal detection
```
16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style.

Scene: a logged clearing at the edge of ponderosa pine and Douglas-fir forest in the dry hills of the British Columbia Interior: stumps, scattered dry branches, young regrowth, golden grass. At the edge of the clearing, one blackened stump smoulders with a thin thread of pale smoke. No flames.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.
Subject: a fire watch security guard in a white hard hat, dark safety glasses, charcoal long-sleeve work shirt, fluorescent orange high-visibility vest with silver reflective stripes, dark work trousers, tan leather gloves, brown leather boots and a radio on the vest shoulder (no lettering, logos or patches), carrying a rugged grey tablet.

Timeline:
0.0-4.0 s: the guard walks carefully across the clearing toward the stump.
4.0-7.0 s: the guard stops a few metres away, keeping a safe distance, and photographs it with the tablet. The screen faces away from the camera.
7.0-10.0 s: the guard lifts the shoulder radio and reports, eyes on the stump.
Fades: fade in from pure white over the first 0.5 s; fade out to pure white over the last 0.5 s. No other transitions.

Camera: steadicam following behind the guard at walking pace, then holding at a three-quarter angle as the guard stops, 35 mm lens, no cuts.
Light: bright natural midday sun, deep-blue sky with a few small white cumulus clouds, crisp short shadows.
Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.
```

### Scene 19 · `cine-19-report.mp4` (3:00): Reporting and coordination
```
16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style.

Scene: the gravel entrance of a fenced electrical substation below a white concrete dam in the dry hills of the British Columbia Interior; steel equipment behind the fence; the white pickup with its amber light bar parked to one side.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.
Subjects: a fire watch security guard in a white hard hat, dark safety glasses, charcoal long-sleeve work shirt, fluorescent orange high-visibility vest with silver reflective stripes, dark work trousers, tan leather gloves, brown leather boots and a radio on the vest shoulder (no lettering, logos or patches), and a utility client representative in a white hard hat, light blue work shirt, yellow high-visibility vest and sunglasses (no lettering). Both in three-quarter view, faces shaded by their hard hats.

Timeline:
0.0-4.0 s: the guard holds a rugged grey tablet so the client representative can see it: a top-down aerial map of the forest with a few small coloured markers (no readable text); the guard points to one marker.
4.0-7.0 s: the guard turns and points up at the forested hillside.
7.0-10.0 s: the client representative looks up at the hill and nods; the guard holds the tablet out between them.
Fades: fade in from pure white over the first 0.5 s; no fade out (end on a clean frame: the next shot starts from it).

Camera: static medium two-shot at eye level on a tripod, 40 mm lens, no cuts.
Light: bright natural midday sun, deep-blue sky with a few small white cumulus clouds, crisp short shadows.
Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.
```

### Scene 20 · `cine-20-cg-share.mp4` (3:10) · CG: Reporting and coordination
**How to make it:** use your tool's *Extend / Continue* on scene 19, or image-to-video with the **last frame of scene 19** as the start image. Use the CG negative prompt.
```
16:9 cinematic CG takeover shot, 10 seconds, 24 fps, one continuous take: a photorealistic sunlit world with clean CG elements.

Starts from the provided frame: a fire watch guard and a utility client representative in hard hats at a sunny substation gate, the guard holding a tablet.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.

Timeline:
0.0-2.0 s: the real footage continues; the two stand with the tablet between them.
2.0-5.0 s: the tablet glows softly. Five thin floating panels of light rise from it: a thermal image, an aerial photo, a small map, a flight-track line and a time strip (nothing readable). They settle into a neat stack in the air between the two people: the report.
5.0-8.0 s: the camera rises above them. The stack folds into one bright card, which splits into two; the copies fly off along thin cobalt arcs across the sunny valley, one to an operations building beside the dam, one far over the hills.
8.0-10.0 s: high above the site, the camera holds as the two arcs fade softly into the landscape.
Fades: no fade in (it starts from the live frame); fade out to pure white over the last 0.5 s.

Camera: starts at eye level, then one smooth continuous rise to a high view over the site, no cuts.
Style: clean, bright, minimalist sci-fi in a sunlit world: white and pale grey surfaces, thin precise cobalt-blue lines, a single ember-orange accent for heat, soft light, crisp detail; a premium technology film. No text, numbers, labels, logos or interface. No laser beams.
```

### Scene 21 · `cine-21-followup.mp4` (3:20): Monitoring over time
```
16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style.

Scene: the dry hills of the British Columbia Interior seen from 100 metres above the forest, the next day: the same logged clearing with stumps and young regrowth at the edge of ponderosa pine and Douglas-fir forest.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.

Timeline:
0.0-3.0 s: natural colour, the drone's own camera view, hovering above the clearing: the blackened stump is still and dark, a little grey ash around it, no smoke.
3.0 s: the view switches instantly to the thermal camera, the way it does on the real drone.
3.0-10.0 s: thermal infrared in the Iron Red palette: the clearing and canopy in cool indigo and violet, sun-warmed gravel magenta, and where the hotspot was, the stump is now as cool as the ground around it. The camera centres slowly on it and holds.
Fades: fade in from pure white over the first 0.5 s; fade out to pure white over the last 0.5 s. No other transitions.

Camera: stabilised drone gimbal, steady hover, 24 mm equivalent, a very slow tilt, no zoom, no cuts.
Thermal look: authentic uncooled 640 x 512 thermal sensor: slightly soft detail, faint sensor noise, smooth temperature gradients. No text, numbers, crosshairs or interface.
Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.
```

### Scene 22 · `cine-22-closing.mp4` (3:30): From the ground and the sky
```
16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style.

Scene: the gravel pullout beside a steel lattice transmission tower on a sunny ridge in the dry hills of the British Columbia Interior, the white pickup parked there; beyond, the valley with the white concrete dam, the deep-blue reservoir, the river and the fenced substation.
Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.
Subjects: a fire watch security guard in a white hard hat, dark safety glasses, charcoal long-sleeve work shirt, fluorescent orange high-visibility vest with silver reflective stripes, dark work trousers, tan leather gloves, brown leather boots and a radio on the vest shoulder (no lettering, logos or patches), standing beside a round grey-and-orange folding landing pad and holding a dark grey drone remote controller with two thumb sticks below a built-in 5.5-inch screen and two short antennas folded up at the top (not a tablet, not a handheld thermal camera). Descending from the sky: a compact matte dark grey quadcopter about 35 cm across, the size of a laptop (no logos or lettering), with four slim folding arms, two-blade grey propellers, small green and red navigation lights and, under its nose, a gimbal camera with three lens windows: a large thermal lens, a wide camera and a small telephoto.

Timeline:
0.0-4.0 s: the drone descends and lands gently on the pad; gentle slow motion as it touches down and the dust stirs.
4.0-6.0 s: real time: the propellers slow and stop; the guard lowers the controller.
6.0-10.0 s: the camera slowly rises and pulls back: the guard, truck and tower grow small as the valley, dam, reservoir and substation come into view, with open blue sky across the upper third.
Fades: fade in from pure white over the first 0.5 s; fade out to pure white over the last 1.5 s. No other transitions.

Camera: a camera drone 15 metres away and 5 metres up holds steady through the landing, then rises and pulls back slowly and steadily, 24 mm lens, no cuts.
Light: bright natural midday sun, deep-blue sky with a few small white cumulus clouds, crisp short shadows.
Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.
```

### Negative prompt: live scenes
```
text, letters, numbers, logos, brand names, watermark, subtitles, on-screen interface, writing on clothing, sunset, sunrise, golden hour, dusk, evening, night, overcast, haze, smoke-filled sky, heavy colour grading, teal and orange, lens flare, speed ramp, whip pan, FPV, fisheye, dutch angle, shaky cam, dramatic camera moves, over-stylised, glossy commercial look, posing, flames, large fire, thick smoke plume, explosion, firefighters, helicopter, water bomber, emergency vehicles, red laser beam, close-up faces, distorted hands, extra fingers, warped or bent tower, drone touching power lines, oversized drone, morphing, flicker, cartoon, CGI, video game look, oversaturated colour
```

### Negative prompt: CG scenes
```
text, letters, numbers, labels, logos, watermark, subtitles, interface panels with writing, dark background, night, neon, cyberpunk, heavy glow, bloom, lens flare, glitch, scan-line distortion, hologram flicker, laser beams, red dots, explosions, flames, smoke-filled sky, cartoon, low-poly, video game look, toy-like models, melting or morphing landscape, warped towers, oversaturated colour
```

---

## Desktop hero variants (2026-10-19, none chosen yet)

The three hero variants (`/?hero=1`, `/?hero=2`, `/?hero=3`) currently run on **stand-in clips** that I made from your photos with slow camera moves. Once you pick a variant, generate only the clips for that variant and drop them into `seq_wildfire/media/incoming/`. I'll compress them and swap them in.

**For every clip:**
- 16:9, 1920×1080 or larger, 24–30 fps, no audio needed.
- No text, logos or watermark.
- A slow, steady camera only: no fast moves, no cuts inside a clip.
- If your tool supports it, ask for a **seamless loop** for the loop clips: the last frame matches the first.

---

## Variant 1: aerial footage replaces the 3D

### `hero-aerial.mp4` (loop, 10–15 s)
```
Cinematic aerial drone footage at dusk, flying slowly forward at about 120 metres over forested British Columbia ridges. In the exact centre of the frame, a thin column of grey smoke rises from a small spot in the trees and drifts gently to the right. Layered ridges fade into blue haze behind, a gravel access road winds through the lower third, and a transmission line with steel lattice towers crosses the far slope. Warm last light on the ridge tops, cool charcoal shadows in the valleys, thin smoke haze. Very slow, smooth forward glide toward the smoke, perfectly stable, no rotation. Photorealistic, natural colour, restrained saturation, fine grain. No text, no interface, no flames.
```

### Optional: `hero-aerial-thermal.mp4` (the same clip in thermal)
Make this only if your tool can restyle a video while keeping every frame aligned (video-to-video). Use `hero-aerial.mp4` as the input. Without it, the lens uses a thermal effect I simulate from the normal clip.
```
Convert this exact video into thermal camera footage in the Iron Red (ironbow) palette. Sky and shaded forest are deep indigo and purple, sun-warmed rock and the gravel road are magenta to red, and the base of the smoke column is a bright white-yellow hotspot with a soft orange falloff. Identical framing and motion in every frame, slight sensor noise, the softness of a 640×512 thermal sensor, no text or numbers.
```

---

## Variant 2: "Watch the film" button

A 30–45 s film cut from short shots. Generate each shot as its own 4–6 s clip and I'll edit them together. Each shot keeps the same look: BC Interior in wildfire season, dusk light, thin smoke haze, a fire-watch guard in a charcoal jacket, fluorescent-orange hi-vis vest with silver tape and a white hard hat, no lettering anywhere.

| File | Shot |
|---|---|
| `film-01-ridge.mp4` | Wide: a lone guard on a rocky ridge at dusk scans a forested valley with binoculars; a faint smoke column on a far ridge. Slow push-in from behind. |
| `film-02-launch.mp4` | A DJI Mavic 3 Thermal drone lifts off a landing pad on a pickup tailgate and climbs out of frame; the guard-pilot holds the controller. Low angle, golden hour. |
| `film-03-patrol.mp4` | Blue hour: the guard walks a gravel access road under a lattice transmission tower with a flashlight; a dark pickup with an amber roof beacon behind. Slow tracking shot. |
| `film-04-aerial.mp4` | Aerial: the drone's view gliding over forested ridges toward a thin smoke column at dusk. |
| `film-05-thermal.mp4` | Straight-down aerial over a conifer canopy with a smouldering stump in a clearing, slowly descending. (If possible, also make the same shot in ironbow thermal colours as `film-05-thermal-ir.mp4`.) |
| `film-06-coordination.mp4` | Inside a parked pickup at dusk, the guard checks a rugged tablet (screen dark, nothing readable) and talks on a radio; ridge and smoke visible through the windshield. |
| `film-07-closing.mp4` | Wide last-light landscape: layered ridges, a transmission line, a distant smoke column catching the sun, and a tiny amber beacon on a ridge road. Very slow pan. |

---

## Variant 3: ambient video behind the 3D

### `hero-ambient.mp4` (loop, 15–20 s)
This plays dimmed behind the 3D table, so it should be calm and simple.
```
Slow cinematic footage of layered forested British Columbia ridges at last light, fading into blue haze. Just right of centre, a distant column of smoke rises from a far ridge and drifts slowly sideways, catching the last orange sun. The dark silhouette of a transmission line crosses the mid-ground. Almost static camera with a very slow lateral drift. Calm, quiet and vast, not a disaster scene. Warm ember highlights, cool charcoal shadows, restrained saturation, fine grain. No text, no flames.
```
