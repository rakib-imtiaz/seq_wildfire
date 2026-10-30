import os
os.chdir(r"C:\Rhidoys_workspace\seq_wildfire")

# 2026-10-24: the film, v3. Live scenes stay natural (the user: "should look natural"); the user then asked for the
# real-work scenes plus CG interludes "in the middle of the footage ... kind of sci fi", like adverts. Each CG scene
# starts from the last frame of the live scene before it (extend / image-to-video), so the CG takes over the shot.
V = {
 "WEATHER": "Weather: clear, sunny summer day in late July, 11 a.m., 29 °C, dry air, light westerly breeze around 10 km/h, no smoke or haze, visibility over 30 km.",
 "LIGHT": "Light: bright natural midday sun, deep-blue sky with a few small white cumulus clouds, crisp short shadows.",
 "LOOK": "Look: natural documentary cinematography, as if a professional crew filmed an ordinary workday: true-to-life colour, natural contrast, real textures, no stylised grade, no effects. Calm, competent, unposed.",
 "CGSTYLE": "Style: clean, bright, minimalist sci-fi in a sunlit world: white and pale grey surfaces, thin precise cobalt-blue lines, a single ember-orange accent for heat, soft light, crisp detail; a premium technology film. No text, numbers, labels, logos or interface. No laser beams.",
 "GUARD": "a fire watch security guard in a white hard hat, dark safety glasses, charcoal long-sleeve work shirt, fluorescent orange high-visibility vest with silver reflective stripes, dark work trousers, tan leather gloves, brown leather boots and a radio on the vest shoulder (no lettering, logos or patches)",
 "TRUCK": "an unbranded white pickup truck with an amber roof light bar",
 "DRONE": "a compact matte dark grey quadcopter about 35 cm across, the size of a laptop (no logos or lettering), with four slim folding arms, two-blade grey propellers, small green and red navigation lights and, under its nose, a gimbal camera with three lens windows: a large thermal lens, a wide camera and a small telephoto",
 "CTRL": "a dark grey drone remote controller with two thumb sticks below a built-in 5.5-inch screen and two short antennas folded up at the top (not a tablet, not a handheld thermal camera)",
 "SITE": "the dry hills of the British Columbia Interior near Kamloops: open ponderosa pine and Douglas-fir forest, golden bunchgrass and grey-green sagebrush, a river valley with a white concrete hydro dam holding a deep-blue reservoir, a fenced electrical substation on a gravel pad below the dam, and a transmission line of steel lattice towers crossing the hills",
}
LIVE = "16:9 cinematic shot, 10 seconds, 24 fps, one continuous take, photorealistic, natural documentary style."
CG = "16:9 cinematic CG takeover shot, 10 seconds, 24 fps, one continuous take: a photorealistic sunlit world with clean CG elements."

# (slug, kind, act, shot summary, body)
S = [
("site", "live", "The site", "Slow aerial glide; the valley opens up", """Scene: {SITE}.
{WEATHER}

Timeline:
0.0-4.0 s: treetops on the ridge pass slowly below the camera.
4.0-10.0 s: the ridge drops away and the valley opens up: the dam and its reservoir, the river running out below it, the substation, the gravel access road and the transmission line crossing the forested hills.

Camera: a camera drone 120 metres up glides slowly forward at about 4 m/s, horizon level, gently angled down, 24 mm lens, constant speed, no cuts.
{LIGHT}
{LOOK}"""),
("cg-twin", "cg", "The site", "CG: the valley turns into a precise 3D model of the site", """Starts from the provided frame: a sunny British Columbia valley seen from a drone, with a hydro dam, reservoir, river, substation and a transmission line.
{WEATHER}

Timeline:
0.0-2.0 s: the real aerial footage continues, the camera still gliding slowly forward.
2.0-5.0 s: a thin line of light sweeps across the landscape from left to right. Behind it the photo becomes a precise digital terrain model: smooth matte white ground with fine engraved contour lines, the forest as thousands of small detailed model conifers, the dam, substation and lattice towers as clean white architectural models, the river and reservoir as smooth glassy blue.
5.0-8.0 s: the camera keeps gliding and slowly rises. The transmission line lights up as one thin cobalt-blue line from tower to tower, and a cobalt outline traces itself around the dam, the substation and the corridor.
8.0-10.0 s: the edges of the land fall away into a bright white void, revealing the whole valley as a floating terrain model with cut earth sides, lit softly like a product in a studio.

Camera: the same slow forward glide as the footage it starts from, easing into a gentle rise, no cuts.
{CGSTYLE}"""),
("arrival", "live", "Ground monitoring", "Tripod pan with the patrol truck", """Scene: a gravel access road along a transmission corridor of steel lattice towers in the dry hills of the British Columbia Interior; open ponderosa pine and Douglas-fir forest on both sides, golden grass along the verge.
{WEATHER}
Subject: {TRUCK}, driving at about 40 km/h, amber light flashing slowly.

Timeline:
0.0-4.0 s: the truck comes round a bend in the distance and drives toward the camera, a light trail of dust behind it.
4.0-7.0 s: it passes the camera about 5 metres away, gravel crunching under the tyres.
7.0-10.0 s: it slows, pulls onto a gravel pullout at the foot of a lattice tower and stops; the dust drifts away on the breeze.

Camera: tripod at the roadside at eye level, one smooth, slow pan following the truck, 50 mm lens, no cuts.
{LIGHT}
{LOOK}"""),
("patrol", "live", "Ground monitoring", "Steadicam behind the guard; binoculars over the valley", """Scene: a gravel access road along a sunny ridge in the dry hills of the British Columbia Interior: a tall steel lattice transmission tower beside the road with its conductor lines sweeping across the valley, open ponderosa pine and Douglas-fir forest, golden bunchgrass; far below, a blue river, a white concrete dam and a fenced substation. The white pickup with its amber light bar is parked on a pullout behind.
{WEATHER}
Subject: {GUARD}, binoculars in one hand.

Timeline:
0.0-4.0 s: the guard walks along the gravel road toward the tower at a normal pace, seen from behind.
4.0-7.0 s: the guard stops at the edge of the ridge and looks out over the valley.
7.0-10.0 s: the guard raises the binoculars and slowly scans the forested slopes below.

Camera: steadicam following about 3 metres behind the guard at shoulder height, at walking pace, easing to a stop with the guard, 35 mm lens, no cuts.
{LIGHT}
{LOOK}"""),
("hazard", "live", "Ground monitoring", "The guard photographs dry grass on the substation fence", """Scene: the outside of a substation's chain-link fence on a gravel pad in the dry hills of the British Columbia Interior; steel transformers and insulators behind the fence; tall dry golden grass growing up against the fence; forested hills and a lattice tower beyond.
{WEATHER}
Subject: {GUARD}, carrying a rugged grey tablet.

Timeline:
0.0-4.0 s: the guard walks along the outside of the fence, checking the fence line and the grass.
4.0-7.0 s: the guard stops and crouches beside a patch of tall dry grass growing against the fence, pushing it aside with a gloved hand.
7.0-10.0 s: the guard holds up the tablet and takes a photo of it. The screen faces away from the camera.

Camera: tripod, medium side shot at waist height, a very slow push-in as the guard crouches, 50 mm lens, no cuts.
{LIGHT}
{LOOK}"""),
("hotwork", "live", "Ground monitoring", "Hot-work fire watch: grinding sparks, the guard on watch", """Scene: a remote construction site in the dry hills of the British Columbia Interior: a cleared gravel pad beside a new steel lattice tower base, steel beams resting on timber blocks, the dry grass at the edge of the pad cut short, forest beyond.
{WEATHER}
Subjects: a contractor in a welding helmet, leather jacket and gloves (no lettering), grinding a steel beam; and {GUARD}, standing about 5 metres away with a red fire extinguisher in hand.

Timeline:
0.0-4.0 s: the contractor grinds the end of a steel beam; a stream of orange sparks sprays onto the bare gravel.
4.0-7.0 s: the guard stands still and watches where the sparks land, extinguisher ready.
7.0-10.0 s: the grinding stops; the guard walks over and checks the gravel and the edge of the dry grass, crouching to look closely.

Camera: tripod, wide-medium side shot at eye level, a slow pan following the guard, 35 mm lens, no cuts.
{LIGHT}
{LOOK}"""),
("training", "live", "Aerial inspection", "Pilot training: the guard flies, the instructor watches", """Scene: an open gravel training area on a sunny day in the dry hills of the British Columbia Interior: a few orange traffic cones, a round grey-and-orange folding landing pad, forested hills beyond.
{WEATHER}
Subjects: {GUARD}, holding {CTRL}; beside them, an instructor in a navy polo shirt, cap and sunglasses holding a clipboard (no lettering). In the air in front of them: {DRONE}.

Timeline:
0.0-4.0 s: the drone hovers steadily about 10 metres in front of them, then flies a slow, smooth line between the cones.
4.0-7.0 s: the instructor watches the drone and says something; the guard nods, eyes on the drone.
7.0-10.0 s: the drone flies back and lands precisely on the pad; the instructor ticks a box on the clipboard.

Camera: static medium-wide two-shot from behind and to one side, then a slow pan to the landing pad, 35 mm lens, no cuts.
{LIGHT}
{LOOK}"""),
("windcheck", "live", "Aerial inspection", "Wind check before the flight", """Scene: a gravel pullout beside a steel lattice transmission tower on a sunny ridge in the dry hills of the British Columbia Interior; the white pickup parked with its tailgate down and a hard drone case on it; forest and valley beyond.
{WEATHER}
Subject: {GUARD}, holding up a small handheld wind meter with a spinning vane (its small display shows nothing readable).

Timeline:
0.0-3.0 s: the guard holds the wind meter up at arm's length; its vane spins in the light breeze.
3.0-6.0 s: the guard checks it, then looks up at the sky and the treetops moving gently.
6.0-10.0 s: the guard gives a short nod, lowers the meter and walks to the tailgate.

Camera: medium shot at eye level, gentle handheld, 50 mm lens, then a slow pan with the guard to the tailgate, no cuts.
{LIGHT}
{LOOK}"""),
("preflight", "live", "Aerial inspection", "Close-up: unfold, battery, power on", """Scene: the open tailgate of a white pickup truck parked on gravel beside a lattice transmission tower; sunny dry hills and forest softly out of focus behind.
{WEATHER}
Subject: on the tailgate, the gloved hands and orange vest of {GUARD} prepare {DRONE}. Beside it lie {CTRL} and an open hard case.

Timeline:
0.0-3.0 s: the folded drone lies on the tailgate; the gloved hands pick it up.
3.0-6.0 s: the hands swing the front arms out sideways and the rear arms down and out until each locks in place, then unfold the propeller blades.
6.0-8.0 s: a battery slides into the back of the drone; a row of small status lights glows.
8.0-10.0 s: the hands set the drone down and pick up the controller; its screen lights up with a live camera image (no readable text).

Camera: close-up from the side at tailgate height, nearly static with a slight natural handheld drift, 50 mm lens, no cuts.
{LIGHT}
{LOOK}"""),
("launch", "live", "Aerial inspection", "Low camera tilts up with the lift-off (gentle slow-mo)", """Scene: an open gravel pullout on a sunny ridge in the dry hills of the British Columbia Interior: pine and fir forest, a valley below with a blue river, a white concrete dam and a fenced substation. A steel lattice tower stands about 60 metres away, small in the background. The white pickup is parked behind.
{WEATHER}
Subjects: in the foreground, sitting on a round grey-and-orange folding landing pad in open ground, {DRONE}. A few metres behind it, {GUARD}, standing, holding {CTRL}.

Timeline:
0.0-3.0 s: the propellers spin up; dust and dry grass stir around the pad.
3.0-5.0 s: gentle slow motion as the drone lifts off the pad, level and steady.
5.0-10.0 s: real time: it climbs straight up at about 4 m/s into open blue sky, far from the tower and the power lines, and hovers while the guard watches it, controller in hand.
Safety: the drone never flies near, under or through the tower or the power lines.

Camera: low tripod at ground level behind the pad, tilting up slowly to follow the drone, 28 mm lens, no cuts.
{LIGHT}
{LOOK}"""),
("cg-lenses", "cg", "Aerial inspection", "CG: three lens cones unfold from the drone onto the forest", """Starts from the provided frame: a small dark grey drone hovering in a blue sky above a sunny forested slope.
{WEATHER}

Timeline:
0.0-2.0 s: the real footage continues; the camera starts to rise and swing to one side of the hovering drone.
2.0-4.0 s: the camera settles high and to the side, looking down past the drone at the forest below; the drone stays in the upper part of the frame the whole time.
4.0-8.0 s: three translucent cones of light grow downward from the drone's gimbal camera, one after another, all starting from the same point on the camera: the widest (84 degrees) in soft white for the wide camera, a medium cone (61 degrees) in warm orange for the thermal camera, and a very narrow cone (15 degrees) in cobalt blue for the telephoto. Each cone is a four-sided pyramid; where it meets the forest it draws its rectangular footprint as a thin glowing outline: the white rectangle largest, the orange one inside it, the small blue one in the centre.
8.0-10.0 s: the camera holds on the drone, its three nested cones and their footprints on the sunlit slope.

Camera: one continuous rise and swing to the side, then a steady hold, no cuts.
{CGSTYLE}"""),
("corridor", "live", "Aerial inspection", "A camera drone follows the drone along the power line", """Scene: a transmission corridor through the dry hills of the British Columbia Interior: a cleared strip of golden grass and low shrubs under three conductor lines strung between steel lattice towers, ponderosa pine and Douglas-fir forest on both sides, a gravel road along the strip, a blue river in the valley.
{WEATHER}
Subject: flying parallel to the power line, 40 metres up and 30 metres to the side of the towers, {DRONE}.

Timeline:
0.0-5.0 s: the drone flies steadily away from the camera at about 8 m/s, keeping its distance from the line; its small shadow moves across the grass below.
5.0-10.0 s: a lattice tower passes well clear on the drone's left as it carries on beside the line toward the next one, following the gentle curve of the corridor.
Safety: the drone never flies between tower legs, through the tower lattice or under the conductor lines.

Camera: a camera drone follows 20 metres behind and slightly above, matching its speed, steady and level, 35 mm lens, no cuts.
{LIGHT}
{LOOK}"""),
("forestry", "live", "Aerial inspection", "The drone passes over an active forestry block", """Scene: an active forestry block in the dry hills of the British Columbia Interior: a gravel log landing with long stacked log decks, a parked yellow log loader and a feller buncher (no logos), skid trails, slash piles and standing ponderosa pine and Douglas-fir forest around the cut block.
{WEATHER}
Subject: small in the frame, {DRONE}, flying 60 metres up.

Timeline:
0.0-5.0 s: the drone passes slowly over the log decks at about 5 m/s; its shadow crosses the logs.
5.0-10.0 s: it turns gently and heads along the edge of the cut block toward the standing forest.

Camera: a camera drone high and to the side, a slow parallel tracking shot, angled down, 35 mm lens, no cuts.
{LIGHT}
{LOOK}"""),
("thermal", "live", "Thermal detection", "The drone's view switches to thermal and finds the hotspot", """Scene: the dry hills of the British Columbia Interior seen from 100 metres above the forest: open ponderosa pine and Douglas-fir, golden grassy openings, a gravel access road, a transmission line on steel lattice towers, and a logged clearing with stumps and young regrowth.
{WEATHER}

Timeline:
0.0-4.0 s: natural colour, the drone's own camera view, moving slowly forward at about 5 m/s, angled 45 degrees down. The logged clearing comes into view; at its edge, one blackened stump gives off a faint thread of pale smoke. No flames.
4.0 s: the view switches instantly from the normal camera to the thermal camera, the way it does on the real drone; position and motion carry on unchanged.
4.0-10.0 s: thermal infrared in the Iron Red palette: shaded canopy deep indigo and violet, sun-warmed gravel road and rock magenta and red, conductor lines faint thin strokes, and the stump a single small, round white-yellow hotspot on the ground with an orange glow fading outward: no column, no plume, no rising flame. The drone slows to a hover and the camera tilts gently until the hotspot sits in the centre.

Camera: stabilised drone gimbal, smooth and steady, 24 mm equivalent, no zoom.
Thermal look: authentic uncooled 640 x 512 thermal sensor: slightly soft detail, faint sensor noise, smooth temperature gradients. No text, numbers, crosshairs or interface.
{LOOK}"""),
("tele", "live", "Thermal detection", "The telephoto camera zooms in on the smouldering stump", """Scene: a logged clearing at the edge of ponderosa pine and Douglas-fir forest in the dry hills of the British Columbia Interior, seen from the air at a steep angle: stumps, scattered dry branches, young regrowth, golden grass.
{WEATHER}
Subject: one blackened stump at the edge of the clearing, smouldering: a thin thread of pale smoke, a little grey ash around its base, slight heat shimmer above it. No flames.

Timeline:
0.0-5.0 s: from a hover about 100 metres away, the drone's telephoto camera zooms in steadily from a wide view of the clearing to a close view of the stump.
5.0-10.0 s: it holds on the stump; the thread of smoke drifts in the breeze.

Camera: the drone's stabilised telephoto camera, steady hover, a smooth constant-speed zoom, long-lens compression, no cuts.
{LIGHT}
{LOOK}"""),
("mark", "live", "Live situational awareness", "Over the shoulder: the hotspot on the controller, a tap, a radio call", """Scene: a gravel pullout on a sunny ridge in the dry hills of the British Columbia Interior; the white pickup and a lattice tower softly out of focus behind; across the valley, a forested hillside.
{WEATHER}
Subject: {GUARD}, seen over the right shoulder, holding {CTRL} in both hands. Its screen shows a live thermal image in the Iron Red palette: deep indigo and violet forest and one small white-yellow hotspot in the centre with an orange glow. No readable text.

Timeline:
0.0-4.0 s: the guard studies the thermal image on the screen.
4.0-6.0 s: the guard taps the screen once beside the hotspot.
6.0-10.0 s: the guard lifts the shoulder radio and speaks briefly, the controller still held up in view.

Camera: over-the-shoulder close-up, steady handheld, 50 mm lens, focus on the screen, no cuts.
{LIGHT}
{LOOK}"""),
("cg-map", "cg", "Digital mapping", "CG: the thermal view lifts off the screen into a 3D map; pin, routes", """Starts from the provided frame: over the shoulder of a fire watch guard holding a drone controller whose screen shows a thermal image with a small hotspot.
{WEATHER}

Timeline:
0.0-2.0 s: the real footage continues; the guard holds the controller steady.
2.0-5.0 s: the hotspot on the screen pulses once. The image lifts off the screen as a thin floating layer of light and unfolds outward, growing into a translucent 3D terrain map of the whole valley floating in the air above the controller.
5.0-8.0 s: the camera pushes past the guard's shoulder into the floating map until it fills the frame: fine contour lines, the river, the dam, the substation and the transmission line in clean white and cobalt. A small ember-orange pin drops onto the hotspot and a soft pulse ring spreads from it.
8.0-10.0 s: lines draw themselves across the map: a solid cobalt line for the ground patrol route along the road, a dashed cobalt line for the drone's flight path, and small white dots at each observation point. The camera settles into a calm top-down view.

Camera: one continuous push-in from over the shoulder into the floating map, then a smooth tilt to top-down, no cuts.
{CGSTYLE}"""),
("groundcheck", "live", "Thermal detection", "The guard walks in to the stump and reports it", """Scene: a logged clearing at the edge of ponderosa pine and Douglas-fir forest in the dry hills of the British Columbia Interior: stumps, scattered dry branches, young regrowth, golden grass. At the edge of the clearing, one blackened stump smoulders with a thin thread of pale smoke. No flames.
{WEATHER}
Subject: {GUARD}, carrying a rugged grey tablet.

Timeline:
0.0-4.0 s: the guard walks carefully across the clearing toward the stump.
4.0-7.0 s: the guard stops a few metres away, keeping a safe distance, and photographs it with the tablet. The screen faces away from the camera.
7.0-10.0 s: the guard lifts the shoulder radio and reports, eyes on the stump.

Camera: steadicam following behind the guard at walking pace, then holding at a three-quarter angle as the guard stops, 35 mm lens, no cuts.
{LIGHT}
{LOOK}"""),
("report", "live", "Reporting and coordination", "The guard shows the client the map, then points to the hill", """Scene: the gravel entrance of a fenced electrical substation below a white concrete dam in the dry hills of the British Columbia Interior; steel equipment behind the fence; the white pickup with its amber light bar parked to one side.
{WEATHER}
Subjects: {GUARD}, and a utility client representative in a white hard hat, light blue work shirt, yellow high-visibility vest and sunglasses (no lettering). Both in three-quarter view, faces shaded by their hard hats.

Timeline:
0.0-4.0 s: the guard holds a rugged grey tablet so the client representative can see it: a top-down aerial map of the forest with a few small coloured markers (no readable text); the guard points to one marker.
4.0-7.0 s: the guard turns and points up at the forested hillside.
7.0-10.0 s: the client representative looks up at the hill and nods; the guard holds the tablet out between them.

Camera: static medium two-shot at eye level on a tripod, 40 mm lens, no cuts.
{LIGHT}
{LOOK}"""),
("cg-share", "cg", "Reporting and coordination", "CG: the report assembles from the tablet and goes out to the client", """Starts from the provided frame: a fire watch guard and a utility client representative in hard hats at a sunny substation gate, the guard holding a tablet.
{WEATHER}

Timeline:
0.0-2.0 s: the real footage continues; the two stand with the tablet between them.
2.0-5.0 s: the tablet glows softly. Five thin floating panels of light rise from it: a thermal image, an aerial photo, a small map, a flight-track line and a time strip (nothing readable). They settle into a neat stack in the air between the two people: the report.
5.0-8.0 s: the camera rises above them. The stack folds into one bright card, which splits into two; the copies fly off along thin cobalt arcs across the sunny valley, one to an operations building beside the dam, one far over the hills.
8.0-10.0 s: high above the site, the camera holds as the two arcs fade softly into the landscape.

Camera: starts at eye level, then one smooth continuous rise to a high view over the site, no cuts.
{CGSTYLE}"""),
("followup", "live", "Monitoring over time", "Next day: the same thermal view, the stump now cold", """Scene: the dry hills of the British Columbia Interior seen from 100 metres above the forest, the next day: the same logged clearing with stumps and young regrowth at the edge of ponderosa pine and Douglas-fir forest.
{WEATHER}

Timeline:
0.0-3.0 s: natural colour, the drone's own camera view, hovering above the clearing: the blackened stump is still and dark, a little grey ash around it, no smoke.
3.0 s: the view switches instantly to the thermal camera, the way it does on the real drone.
3.0-10.0 s: thermal infrared in the Iron Red palette: the clearing and canopy in cool indigo and violet, sun-warmed gravel magenta, and where the hotspot was, the stump is now as cool as the ground around it. The camera centres slowly on it and holds.

Camera: stabilised drone gimbal, steady hover, 24 mm equivalent, a very slow tilt, no zoom, no cuts.
Thermal look: authentic uncooled 640 x 512 thermal sensor: slightly soft detail, faint sensor noise, smooth temperature gradients. No text, numbers, crosshairs or interface.
{LOOK}"""),
("closing", "live", "From the ground and the sky", "The drone lands (gentle slow-mo), then a slow aerial pull-back", """Scene: the gravel pullout beside a steel lattice transmission tower on a sunny ridge in the dry hills of the British Columbia Interior, the white pickup parked there; beyond, the valley with the white concrete dam, the deep-blue reservoir, the river and the fenced substation.
{WEATHER}
Subjects: {GUARD}, standing beside a round grey-and-orange folding landing pad and holding {CTRL}. Descending from the sky: {DRONE}.

Timeline:
0.0-4.0 s: the drone descends and lands gently on the pad; gentle slow motion as it touches down and the dust stirs.
4.0-6.0 s: real time: the propellers slow and stop; the guard lowers the controller.
6.0-10.0 s: the camera slowly rises and pulls back: the guard, truck and tower grow small as the valley, dam, reservoir and substation come into view, with open blue sky across the upper third.

Camera: a camera drone 15 metres away and 5 metres up holds steady through the landing, then rises and pulls back slowly and steadily, 24 mm lens, no cuts.
{LIGHT}
{LOOK}"""),
]

NEG_LIVE = "text, letters, numbers, logos, brand names, watermark, subtitles, on-screen interface, writing on clothing, sunset, sunrise, golden hour, dusk, evening, night, overcast, haze, smoke-filled sky, heavy colour grading, teal and orange, lens flare, speed ramp, whip pan, FPV, fisheye, dutch angle, shaky cam, dramatic camera moves, over-stylised, glossy commercial look, posing, flames, large fire, thick smoke plume, explosion, firefighters, helicopter, water bomber, emergency vehicles, red laser beam, close-up faces, distorted hands, extra fingers, warped or bent tower, drone touching power lines, oversized drone, morphing, flicker, cartoon, CGI, video game look, oversaturated colour"
NEG_CG = "text, letters, numbers, labels, logos, watermark, subtitles, interface panels with writing, dark background, night, neon, cyberpunk, heavy glow, bloom, lens flare, glitch, scan-line distortion, hologram flicker, laser beams, red dots, explosions, flames, smoke-filled sky, cartoon, low-poly, video game look, toy-like models, melting or morphing landscape, warped towers, oversaturated colour"

HERO = {"patrol": 1, "launch": 2, "thermal": 3}
n = len(S)
rows, blocks, lens = [], [], []
for i, (slug, kind, act, shot, body) in enumerate(S):
    num = f"{i + 1:02d}"
    t = f"{(i * 10) // 60}:{(i * 10) % 60:02d}"
    nxt = S[i + 1][1] if i + 1 < n else None
    fin = "1.0" if i == 0 else "0.5"
    fout = "1.5" if i == n - 1 else "0.5"
    if kind == "cg":
        fade = f"Fades: no fade in (it starts from the live frame); fade out to pure white over the last {fout} s."
    elif nxt == "cg":
        fade = f"Fades: fade in from pure white over the first {fin} s; no fade out (end on a clean frame: the next shot starts from it)."
    else:
        fade = f"Fades: fade in from pure white over the first {fin} s; fade out to pure white over the last {fout} s. No other transitions."
    assert "\n\nCamera:" in body
    body = body.replace("\n\nCamera:", "\n" + fade + "\n\nCamera:", 1)
    p = (CG if kind == "cg" else LIVE) + "\n\n" + body.format(**V)
    assert "\u2014" not in p
    lens.append((num, len(p)))
    hero = f" · phone hero {HERO[slug]}" if slug in HERO else ""
    how = ""
    if kind == "cg":
        how = f"**How to make it:** use your tool's *Extend / Continue* on scene {i:02d}, or image-to-video with the **last frame of scene {i:02d}** as the start image. Use the CG negative prompt.\n"
    blocks.append(f"### Scene {num} · `cine-{num}-{slug}.mp4` ({t}){' · CG' if kind == 'cg' else ''}: {act}{hero}\n{how}```\n{p}\n```\n")
    rows.append(f"| {num} | {t} | {'**CG**' if kind == 'cg' else 'Live'} | {act} | {shot}{' (phone hero ' + str(HERO[slug]) + ')' if slug in HERO else ''} |")

total = n * 10
section = f"""## The film (2026-10-24): {n} scenes × 10 s = {total // 60}:{total % 60:02d}

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
""" + "\n".join(rows) + """

Titles go on in the edit, not in the footage: the step names, then the end card "Protecting critical infrastructure from the ground and the sky", "Request a wildfire monitoring proposal" and a small "Proposed service. Illustrative footage."

""" + "\n".join(blocks) + f"""
### Negative prompt: live scenes
```
{NEG_LIVE}
```

### Negative prompt: CG scenes
```
{NEG_CG}
```
"""

f = 'prompts/VIDEO-PROMPTS.md'
s = open(f, encoding='utf-8').read()
a = s.index('## The film')
b = s.index('---\n\n## Desktop hero variants')
s = s[:a] + section + "\n" + s[b:]
open(f, 'w', encoding='utf-8', newline='\n').write(s)
print(lens, max(l for _, l in lens))
