# Sequoia Wildfire: hero video prompts

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
