# Sequoia Wildfire: photos still needed

Updated 2026-10-16. This file lists only what's still missing.
- The 5 application pairs are already in.
- The 3D, stills, map and report are rendered from our own scene.
- Model reference sheets and look-dev frames are no longer needed.

**Where they go:** drop the files into `seq_wildfire/media/incoming/` under these exact names. I convert them to webp.

**How to use these prompts:**
- Every prompt below is complete, so copy and paste it as it is.
- Make each image at least the size listed.
- The two `statement-` photos should match each other. Make the first, then use it as the reference image for the second.
- The canopy pair works the same way: make `-visible` first, then run the thermal prompt on it in image-edit / reference mode.

---

### 1. `statement-ground-only.png` (3:2, 2400×1600)

```
Photorealistic documentary photograph, British Columbia Interior in wildfire season. A lone fire-watch security guard stands on a rocky ridge at dusk, seen from behind at a three-quarter angle, small in the right third of the frame, scanning a wide forested valley with binoculars. The guard wears a charcoal work jacket and pants, a fluorescent-orange high-visibility vest with silver reflective tape, a white hard hat, leather gloves and a radio clipped to the vest. Dry ponderosa pine and Douglas-fir slopes, sagebrush on the rocks, a thin blue-grey smoke haze in the valley. A faint smoke column rises from a far ridge on the right. Lots of evening sky. Warm ember light on the ridge, cool charcoal shadows, restrained saturation, fine film grain, full-frame camera, natural perspective. No text, no logos, no lettering on clothing, no watermark, no police or fire-department insignia, no flames.
```

### 2. `statement-ground-and-sky.png` (3:2, 2400×1600). Use image 1 as the reference.

```
The exact same scene, ridge, light and guard as the reference image, same camera position. Now a DJI Mavic 3 Thermal drone (compact dark-grey folding quadcopter, four slim arms unfolded, a three-lens camera gimbal at the front) hovers about 10 metres above and ahead of the guard, out over the valley toward the distant smoke column, in the upper middle of the frame. The guard has lowered the binoculars and holds a drone controller whose screen glows softly. Photorealistic documentary photograph, dusk, thin smoke haze, fine film grain. No text, no logos, no lettering, no watermark.
```

### 3. `pilot-portrait.png` (4:5, 1600×2000)

```
Photorealistic documentary photograph, British Columbia Interior at golden hour, dry pine forest behind. A fire-watch guard-pilot runs a pre-flight check on the open tailgate of a dark charcoal, unbranded full-size pickup truck with an amber LED beacon bar on the roof. On the tailgate: a DJI Mavic 3 Thermal drone unfolded on a small landing pad, an open black hard case with foam cut-outs beside it, and a drone controller. The pilot wears a charcoal work jacket, a fluorescent-orange high-visibility vest with silver reflective tape, a white hard hat, safety glasses and leather gloves. Framed waist-up from a three-quarter angle, the focus on the hands and the drone. Warm low sun, cool shadows, thin smoke haze, restrained saturation, fine film grain. No text, no logos, no lettering on clothing or the truck, no watermark.
```

### 4. `svc-patrol.png` (4:3, 2000×1500)

```
Photorealistic documentary photograph, British Columbia Interior at blue hour. A fire-watch security guard walks a gravel access road beside a cleared transmission-line corridor, holding a flashlight that throws a warm beam on the gravel. A tall steel lattice transmission tower rises above, its wires crossing the deep blue sky. Behind the guard, a dark unbranded pickup truck is parked with its amber roof beacon glowing. The guard wears a charcoal work jacket, a fluorescent-orange high-visibility vest with silver reflective tape, a white hard hat and leather gloves. Dry pine forest on both sides, thin smoke haze. Cool blue light with warm amber accents, restrained saturation, fine film grain. No text, no logos, no lettering, no watermark.
```

### 5a. `svc-canopy-visible.png` (4:3, 2000×1500)

```
Photorealistic aerial photograph taken straight down from a drone at about 60 metres over a dense British Columbia conifer forest, late afternoon. Lodgepole and ponderosa pine crowns fill the frame. Just right of centre and slightly above it there is a small clearing with a blackened, smouldering burned stump and a thin wisp of grey smoke drifting off it. Long soft shadows from the trees, warm light, restrained saturation, fine detail, fine film grain. No text, no logos, no watermark, no open flames.
```

### 5b. `svc-canopy-thermal.png` (4:3, 2000×1500). Image edit, with 5a as the input.

```
Convert this exact image into a thermal camera image in the Iron Red (ironbow) palette. The tree crowns are deep indigo and purple, the sunlit gaps between them are magenta, the clearing's bare ground is red, and the smouldering stump is a bright white-yellow hotspot with a soft orange falloff. The smoke wisp is barely visible. Identical composition and framing, slight sensor noise, the softness of a 640×512 thermal sensor, no text, no temperature numbers, no overlays.
```

### 6. `svc-live-feed.png` (16:9, 2400×1350)

The site draws a drone-camera interface over this one (a reticle in the centre plus "Live feed", "Alt 120 m" and mode labels), so this is now **the drone's own view**, not a person holding a tablet.

```
Photorealistic aerial photograph taken from a drone camera at about 120 metres, looking forward and down over a forested British Columbia ridge at dusk. In the exact centre of the frame, a thin column of grey smoke rises from a small spot in the trees. A gravel access road winds through the lower third, and a transmission line with lattice towers crosses the far slope. Thin smoke haze over the valley, warm last light on the ridge tops, cool charcoal shadows in the valleys, restrained saturation, slight camera-sensor grain. No text, no interface, no overlays, no logos, no watermark, no open flames.
```

### 7. `standards-preflight.png` (3:2, 2000×1333)

```
Photorealistic overhead flat-lay photograph on the dark charcoal hood of a pickup truck at dusk. Neatly arranged: a clipboard holding a drone pre-flight checklist (the text small and unreadable), a folded DJI Mavic 3 Thermal drone (compact dark-grey quadcopter with its arms folded), a printed topographic site map sheet, a handheld two-way radio and a pair of leather work gloves. Natural warm dusk light from one side, soft shadows, a fine layer of dust on the hood, restrained saturation, fine film grain. No readable text, no logos, no watermark.
```

### 8. `cta-ridge-smoke.png` (21:9, 3000×1286)

The site's closing line sits over the **lower left** of this photo, and phones show only the **middle** of it. Keep the lower left quiet and put the smoke just right of centre.

```
Photorealistic wide landscape photograph, British Columbia Interior at last light. Layered forested ridges fade into blue haze, one behind the other. Just right of centre, a distant column of smoke rises from a far ridge and catches the last orange sun. The dark silhouette of a transmission line with lattice towers crosses the mid-ground. A tiny amber truck beacon glows on a ridge road. The lower left of the frame is dark, quiet forest in shadow. Quiet, vast and calm, not a disaster scene. Warm ember highlights, cool charcoal shadows, restrained saturation, fine film grain. No text, no logos, no watermark, no flames.
```

### 9. `proposal-hero.png` (21:9, 3000×1286)

This one sits behind the title on the proposal page, with the text in the **lower left** and the photo darkened. Keep the lit objects in the **middle and right**.

```
Photorealistic photograph of a night operations table in a dark room. In the middle and right of the frame, lit by one warm desk lamp: a printed topographic map spread out, a rugged tablet with a dark screen, a handheld two-way radio and a black drone hard case. Everything else falls away into deep shadow, and the left side of the frame is almost black. Moody, calm and professional. Warm lamplight against charcoal darkness, shallow depth of field, fine film grain. No readable text on the map or tablet, no logos, no watermark.
```
