"""
Render the stand-in hero aerial clip from the user's still (media/incoming/svc-live-feed.png).

A slow drone push-in anchored on the smoke base, with a periodic lateral drift and a hint of roll, then a
crossfade of the tail into the head so the loop has no seam. The camera numbers live in aerial-path.json, which
aerialPath.ts reads too, so the thermal lens hotspot tracks the clip exactly.

Frames are sub-pixel affine resamples (bicubic, continuous coordinates: no integer crop steps, so no jitter),
piped raw to ffmpeg as a near-lossless intermediate. The web encodes are made from that intermediate.

Usage (from the project root; run Python with -I):
  python -I src/sections/hero-variants/video/render-standin.py --ffmpeg <ffmpeg.exe> --out <intermediate.mp4>
  python -I src/sections/hero-variants/video/render-standin.py --poster public/media/video/hero-aerial-poster
  python -I src/sections/hero-variants/video/render-standin.py --preview <dir>     (a few PNG frames only)

Web encodes from the intermediate (two-pass; one GOP per loop with mbtree off, so the slow zoom never
"sticks" and snaps at a keyframe; -threads 2 for low-RAM machines):
  X="keyint=420:min-keyint=420:scenecut=0:mbtree=0:aq-mode=3:rc-lookahead=40:colorprim=bt709:transfer=bt709:colormatrix=bt709"
  1080: -c:v libx264 -preset slower -profile:v high -level:v 4.0 -b:v 1900k -maxrate 2850k -bufsize 5700k
        -x264-params $X -vf format=yuv420p -color_range tv -an   (pass 1 to null, pass 2 with -movflags +faststart)
  720:  same with -level:v 3.1 -b:v 800k -maxrate 1200k -bufsize 2400k -vf scale=1280:720:flags=lanczos,format=yuv420p
"""

import argparse
import json
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
P = json.load(open(os.path.join(HERE, "aerial-path.json"), encoding="utf-8"))

SW, SH = P["src"]["w"], P["src"]["h"]
OW, OH, FPS = P["out"]["w"], P["out"]["h"], P["out"]["fps"]
L, F = float(P["loop"]), float(P["fade"])
AX, AY = P["anchor"]["x"] * SW, P["anchor"]["y"] * SH
FX, FY = P["frame"]["x"], P["frame"]["y"]
DX, DY, DPY = P["drift"]["x"], P["drift"]["y"], P["drift"]["phaseY"]
RD, RP = P["roll"]["deg"], P["roll"]["phase"]
Z0, Z1 = P["zoom"]["from"], P["zoom"]["to"]


def cam(u):
    """Camera state at render time u (0 .. L+F seconds). Mirrors camAt() in aerialPath.ts."""
    z = Z0 * (Z1 / Z0) ** (u / (L + F))
    ph = 2 * math.pi * u / L
    fx = FX + DX * math.sin(ph)
    fy = FY + DY * math.sin(ph + DPY)
    th = math.radians(RD) * math.sin(ph + RP)
    return z, fx, fy, th


def affine(u):
    """Pillow AFFINE coefficients: output px (continuous) -> source px (continuous)."""
    z, fx, fy, th = cam(u)
    s = SW / (z * OW)  # source px per output px (same aspect, so the same vertically)
    c, sn = math.cos(th), math.sin(th)
    a, b = s * c, -s * sn
    d, e = s * sn, s * c
    ox, oy = fx * OW, fy * OH
    return (a, b, AX - a * ox - b * oy, d, e, AY - d * ox - e * oy)


def check_bounds(u, margin=3.0):
    a, b, c, d, e, f = affine(u)
    for x, y in ((0, 0), (OW, 0), (0, OH), (OW, OH)):
        sx, sy = a * x + b * y + c, d * x + e * y + f
        if not (margin <= sx <= SW - margin and margin <= sy <= SH - margin):
            raise SystemExit(f"black edge at u={u:.3f}: corner ({x},{y}) -> ({sx:.1f},{sy:.1f})")


def render(src, u):
    return np.asarray(src.transform((OW, OH), Image.AFFINE, affine(u), resample=Image.BICUBIC), dtype=np.float32)


def smoothstep(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def frame(src, i):
    """Final loop frame i: the tail of the move crossfades into its head over the first F seconds."""
    t = i / FPS
    if t >= F:
        return render(src, t)
    w = smoothstep(t / F)
    return render(src, t + L) * (1 - w) + render(src, t) * w


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=os.path.join(ROOT, "media", "incoming", "svc-live-feed.png"))
    ap.add_argument("--ffmpeg")
    ap.add_argument("--out")
    ap.add_argument("--preview")
    ap.add_argument("--poster", help="path stem, e.g. public/media/video/hero-aerial-poster")
    args = ap.parse_args()

    n = int(round(L * FPS))
    for k in range(0, int((L + F) * FPS) + 1):
        check_bounds(k / FPS)

    src = Image.open(args.src).convert("RGB")
    assert src.size == (SW, SH), src.size

    if args.poster:
        # the loop's first frame, as the poster (1920) plus a 960 for phones
        first = Image.fromarray(np.clip(frame(src, 0) + 0.5, 0, 255).astype(np.uint8))
        first.save(args.poster + ".webp", quality=74, method=6)
        first.resize((OW // 2, OH // 2), Image.LANCZOS).save(args.poster + "-960.webp", quality=74, method=6)
        print("poster:", args.poster + ".webp", args.poster + "-960.webp")
        return

    if args.preview:
        os.makedirs(args.preview, exist_ok=True)
        picks = {"f000-first": 0, "f052-midfade": int(F * FPS / 2), "f210-mid": n // 2, "f419-last": n - 1}
        for name, i in picks.items():
            Image.fromarray(np.clip(frame(src, i) + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(args.preview, name + ".png"))
        print("preview frames:", ", ".join(picks))
        return

    cmd = [
        args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-",
        "-threads", "2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "6",
        "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
        args.out,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(n):
        proc.stdin.write(np.clip(frame(src, i) + 0.5, 0, 255).astype(np.uint8).tobytes())
        if i % 60 == 0:
            print(f"frame {i}/{n}", file=sys.stderr, flush=True)
    proc.stdin.close()
    sys.exit(proc.wait())


if __name__ == "__main__":
    main()
