"""Web cuts of the user's AI film. Run with python -I; pass "film", "desk", "phone", "hd" or "2k" to rebuild just that part.

Sources (2026-10-30): the user's 2K re-export of all 22 scenes (media/incoming/2k/sequoia-2k-scene-NN.mp4, 2560x1440
at 48 fps with part-repeated frames, the regenerated 10/11/12/14/16 included), taken back to 24 fps. The phone hero
stays on the native 9:16 clips (the 2K set is 16:9 only).

Film (film-1080.mp4), re-cut after a frame-by-frame check:
  - every join is a clean dip to white (the clips carry hard white flashes and jumps on their first frames, so each
    starts at 2/48 s and the cut adds its own fades);
  - 12 corridor stops at 6.1 s (after that it brushes past a tower's legs), 13 forestry before it darkens, 17 CG map
    starts at 3 s as the map lifts off the screen, 21 follow-up is dropped (purple-tinted, not a cold stump);
  - audio normalised to -16 LUFS (the clips peak at 0 dBFS); the page plays it muted by default.
Desktop hero (d-hero.mp4): scenes 01, 04 and 10, crossfaded. Phones: the 9:16 hero, the card loops and one still.
Desktop cards (hd): the same loops at 1080p. 2K screens (2k): the hero and the full-width cards at 1440p.
"""
import json, os, subprocess, sys
import cv2

FF = r"C:\Users\USER\AppData\Local\Programs\Python\Python312\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
ROOT = r"C:\Rhidoys_workspace\seq_wildfire"
INC = os.path.join(ROOT, "media", "incoming")
K2 = os.path.join(INC, "2k")
PHONE = os.path.join(INC, "sequoia-phone-heroes-stitched.mp4")
OUT = os.path.join(ROOT, "public", "media", "video")
S0 = 2 / 48  # each 2K clip's first frame can be a stray frame or a hard white flash
# generated stills (10-30): while media/incoming/gen/<name>.png exists, tools/stills.py owns that poster
GEN = os.path.join(INC, "gen")


def generated(name):
    return os.path.exists(os.path.join(GEN, name + ".png"))


def scene(n):
    return os.path.join(K2, f"sequoia-2k-scene-{n:02d}.mp4")


# (scene, start s, end s, fade in, fade out, chapter that starts here)
SEGS = [
    (1, S0, 10, 0, 0.4, None),          # site
    (2, S0, 10, 0.4, 0, None),          # CG: the valley becomes the model (ends on its own white)
    (3, S0, 10, 0, 0.5, "ground"),      # arrival
    (4, S0, 10, 0, 0.5, None),          # patrol
    (5, S0, 10, 0, 0, None),            # hazard
    (6, S0, 10, 0, 0, None),            # hot-work watch
    (7, S0, 10, 0, 0, "air"),           # training
    (8, S0, 10, 0, 0.5, None),          # wind check
    (9, S0, 10, 0, 0, None),            # pre-flight
    (10, S0, 10, 0, 0.4, None),         # launch
    (11, S0, 10, 0.4, 0, None),         # CG: the three lens cones (ends on its own white)
    (12, S0, 6.1, 0, 0.5, None),        # corridor, before the tower
    (13, S0, 8.7, 0, 0.5, None),        # forestry, before the darkening
    (14, S0, 10, 0, 0, "thermal"),      # switch to thermal, the hotspot
    (15, S0, 10, 0, 0, None),           # the stump
    (16, S0, 10, 0, 0.4, None),         # mark it, radio it
    (17, 3.0, 10, 0.4, 0, "map"),       # CG: the map lifts off the screen
    (18, S0, 10, 0, 0, None),           # ground check
    (19, S0, 10, 0, 0.4, "report"),     # the client
    (20, S0, 10, 0.4, 0, None),         # CG: the report goes out
    (22, S0, 10, 0, 1.5, None),         # landing, the whole site
]


def run(args):
    print(" ".join(a if " " not in a else f'"{a}"' for a in args[:8]), "...")
    r = subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", *args])
    if r.returncode:
        sys.exit(r.returncode)


def frame(src, t):
    cap = cv2.VideoCapture(src)
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, img = cap.read()
    cap.release()
    return img


def poster(src, t, dst, width, crop=None, q=80, sharpen=0.0):
    img = frame(src, t)
    if crop:
        h, w = img.shape[:2]
        img = img[int(crop[1] * h):int(crop[3] * h), int(crop[0] * w):int(crop[2] * w)]
    h, w = img.shape[:2]
    img = cv2.resize(img, (width, round(h * width / w)), interpolation=cv2.INTER_AREA)
    if sharpen:
        img = cv2.addWeighted(img, 1 + sharpen, cv2.GaussianBlur(img, (0, 0), 1.2), -sharpen, 0)
    cv2.imwrite(dst, img, [cv2.IMWRITE_WEBP_QUALITY, q])


def film():
    vf, af, starts, t = [], [], {}, 0.0
    for k, (n, a, b, fi, fo, ch) in enumerate(SEGS):
        d = b - a
        starts[n] = round(t, 2)
        v = f"[{k}:v]trim=start={a}:end={b},setpts=PTS-STARTPTS,fps=24,scale=1920:1080:flags=lanczos,setsar=1,format=yuv420p"
        if fi:
            v += f",fade=t=in:st=0:d={fi}:color=white"
        if fo:
            v += f",fade=t=out:st={d - fo:.3f}:d={fo}:color=white"
        vf.append(v + f"[v{k}]")
        fa, fb = max(fi, 0.04), max(fo, 0.04)
        af.append(f"[{k}:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,aformat=sample_rates=24000:channel_layouts=mono,"
                  f"afade=t=in:st=0:d={fa},afade=t=out:st={d - fb:.3f}:d={fb}[a{k}]")
        t += d
    n = len(SEGS)
    cat = "".join(f"[v{k}][a{k}]" for k in range(n)) + f"concat=n={n}:v=1:a=1[vc][ac]"
    graph = ";".join(vf + af + [cat, "[ac]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[ao]"])
    dst = os.path.join(OUT, "film-1080.mp4")
    ins = [x for s in SEGS for x in ("-i", scene(s[0]))]
    # kept under GitHub's 50 MB warning: about 1.8 Mbps at 1080p
    run([*ins, "-filter_complex", graph, "-map", "[vc]", "-map", "[ao]",
         "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-maxrate", "1800k", "-bufsize", "3600k", "-profile:v", "high", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "96k", "-ac", "1", "-movflags", "+faststart", dst])
    if not generated("film-poster"):
        poster(scene(4), 7.6, os.path.join(OUT, "film-poster.webp"), 1280)
    return dst, round(t, 2), starts


# Desktop hero (10-27, the user: "go"): the valley reveal over the dam, the guard on patrol, the drone climbing.
DESK = [(scene(1), 3.5, 9.8), (scene(4), 0.5, 8.8), (scene(10), 4.2, 9.8)]


def desk_hero(width=1920, sfx=""):
    X = 0.7
    ins, parts = [], []
    for k, (src, a, b) in enumerate(DESK):
        ins += ["-i", src]
        parts.append(f"[{k}:v]trim=start={a}:end={b},setpts=PTS-STARTPTS,fps=24,scale={width}:{width * 9 // 16}:flags=lanczos,setsar=1,format=yuv420p[p{k}]")
    d0, d1 = DESK[0][2] - DESK[0][1], DESK[1][2] - DESK[1][1]
    total = d0 + d1 + (DESK[2][2] - DESK[2][1]) - 2 * X
    g = "color=0x0E1012"
    graph = ";".join(parts + [
        f"[p0][p1]xfade=transition=fade:duration={X}:offset={d0 - X:.3f}[x1]",
        f"[x1][p2]xfade=transition=fade:duration={X}:offset={d0 + d1 - 2 * X:.3f},fade=t=in:st=0:d=0.5:{g},fade=t=out:st={total - 0.5:.3f}:d=0.5:{g}[v]",
    ])
    crf, rate = ("23", 3600) if width <= 1920 else ("20", 10000)
    dst = os.path.join(OUT, f"d-hero{sfx}.mp4")
    run([*ins, "-filter_complex", graph, "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", crf, "-maxrate", f"{rate}k",
         "-bufsize", f"{2 * rate}k", "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", dst])
    # the hero's still (10-30, the user: "should be something sharp"): 01 at 7.52 s, the sharpest, stillest frame of
    # the three shots by a frame scan, at a higher quality with a light sharpen; it stays over the loop until it plays
    hero_still(width, sfx)
    return [dst]


def hero_still(width, sfx=""):
    if generated("hero-still"):
        return
    poster(DESK[0][0], 7.52, os.path.join(OUT, f"d-hero{sfx}.webp"), width, q=90, sharpen=0.35)


# Phones (the user's second comp, 10-27): tall cards over footage. The hero is native 9:16: the patrol (stitch clip 1,
# its baked fades cut off) then the launch from 5.4 s, once the drone is clear of the pilot ("wtf is this").
def hero():
    g = "color=0x0E1012"
    launch = os.path.join(INC, "cine-10-launch-v.mp4")
    graph = (f"[0:v]trim=start_frame=25:end_frame=213,setpts=PTS-STARTPTS,scale=720:1280,fade=t=in:st=0:d=0.4:{g},fade=t=out:st=7.43:d=0.4:{g}[a];"
             f"[1:v]trim=start_frame=130:end_frame=240,setpts=PTS-STARTPTS,scale=720:1280,fade=t=in:st=0:d=0.4:{g},fade=t=out:st=4.18:d=0.4:{g}[b];"
             "[a][b]concat=n=2:v=1:a=0[v]")
    dst = os.path.join(OUT, "s-hero.mp4")
    run(["-i", PHONE, "-i", launch, "-filter_complex", graph, "-map", "[v]", "-an",
         "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-maxrate", "1600k", "-bufsize", "3200k", "-profile:v", "high",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", dst])
    if not generated("phone-hero"):
        poster(PHONE, 1.49, os.path.join(OUT, "s-hero.webp"), 720)
    return [dst]


# card loops from the 2K scenes at 1280x720: (id, scene, start s, end s, the card colour the loop fades through)
CARD_CLIPS = [
    ("heat", 14, 3.8, 8.8, "0x0E1012"),
    ("team", 7, 0.4, 7.0, "0x0E1012"),
    ("map", 17, 3.5, 8.4, "0xE9EBEE"),
    ("truck", 3, 1.0, 8.4, "0x0E1012"),
]
# slow motion (the user, 10-27: the repeating drone shot "doesnt look good, make it slow mo"): half speed with motion-
# interpolated frames. A boomerang plays forward then back, so the loop never visibly restarts.
SLOW = [
    ("lenses", 11, 0.9, 2.9, True),     # the drone and its gimbal, close
    ("site", 22, 7.0, 9.6, False),      # the pull-back over the dam
]
STILLS = [("ground", 4, 6.0, (0.2, 0, 0.8, 1), 720)]
# desktop (10-30, the user: the desktop "doesnt look professional", "the mobile one is good"): the same cards full width,
# so the same loops at 1920x1080 (c-<id>-hd) and the careers still uncropped
STILLS_HD = [("ground", 4, 6.0, None, 1600)]
# 2K screens (10-30, the user on a 2K monitor: the video "looks very under resolution"): the hero and the full-width
# cards at the sources' own 2560x1440 (c-<id>-2k); the light cards fill 62% of the width, so 1080p covers them
FULL = ("heat", "team", "site", "truck")


def cards(width=1280, sfx="", ids=None):
    out = []
    base = f"fps=24,scale={width}:{width * 9 // 16}:flags=lanczos,setsar=1,format=yuv420p"
    crf, rate = ("26", 1600) if width <= 1280 else ("25", 3400) if width <= 1920 else ("21", 9000)
    enc = ["-an", "-c:v", "libx264", "-preset", "slow", "-crf", crf, "-maxrate", f"{rate}k", "-bufsize", f"{2 * rate}k",
           "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
    for cid, n, a, b, col in CARD_CLIPS:
        if ids and cid not in ids:
            continue
        d = b - a
        vf = f"trim=start={a}:end={b},setpts=PTS-STARTPTS,{base},fade=t=in:st=0:d=0.35:color={col},fade=t=out:st={d - 0.35:.3f}:d=0.35:color={col}"
        dst = os.path.join(OUT, f"c-{cid}{sfx}.mp4")
        run(["-i", scene(n), "-vf", vf, *enc, dst])
        if not generated(f"card-{cid}"):
            poster(scene(n), a + 0.4, os.path.join(OUT, f"c-{cid}{sfx}.webp"), width)
        out.append(dst)
    for cid, n, a, b, boom in SLOW:
        if ids and cid not in ids:
            continue
        slow = f"trim=start={a}:end={b},setpts=PTS-STARTPTS,{base},setpts=2*PTS,minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:vsbmc=1"
        if boom:
            graph = f"[0:v]{slow},split[f][r];[r]reverse[b];[f][b]concat=n=2:v=1:a=0[v]"
        else:
            d = (b - a) * 2
            graph = f"[0:v]{slow},fade=t=in:st=0:d=0.4:color=0x0E1012,fade=t=out:st={d - 0.4:.3f}:d=0.4:color=0x0E1012[v]"
        dst = os.path.join(OUT, f"c-{cid}{sfx}.mp4")
        run(["-i", scene(n), "-filter_complex", graph, "-map", "[v]", *enc, dst])
        if not generated(f"card-{cid}"):
            poster(scene(n), a if boom else a + 0.2, os.path.join(OUT, f"c-{cid}{sfx}.webp"), width)
        out.append(dst)
    for sid, n, t, crop, w in {"": STILLS, "-hd": STILLS_HD}.get(sfx, []):
        if generated("careers-still"):
            break
        dst = os.path.join(OUT, f"st-{sid}{sfx}.webp")
        poster(scene(n), t, dst, w, crop)
        out.append(dst)
    return out


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1:]
    made = []
    if not only or "film" in only:
        f, dur, starts = film()
        made.append(f)
        print(json.dumps({"duration": dur, "scene_starts": starts}))
    if not only or "desk" in only:
        made += desk_hero()
    if not only or "phone" in only:
        made += hero() + cards()
    if not only or "hd" in only:
        made += cards(1920, "-hd")
    if "stills" in only:
        hero_still(1920)
        hero_still(2560, "-2k")
        made += [os.path.join(OUT, "d-hero.webp"), os.path.join(OUT, "d-hero-2k.webp")]
    if not only or "2k" in only:
        made += desk_hero(2560, "-2k") + cards(2560, "-2k", FULL)
    for x in made:
        print(os.path.basename(x), round(os.path.getsize(x) / 1e6, 2), "MB")
