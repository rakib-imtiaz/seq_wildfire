"""Web stills from the generated images (media/incoming/gen). Run with python -I.

2026-10-30: the user on the hero's still ("should be something sharp 2k") and "u can use codex to generate the
necessary images". Codex's built-in image tool (no size control here) made both at 1672x941 from the film's frames as
composition references; at 2560 wide they hold 2.6x (hero) and 9x (careers) the detail of the film frames, which are
720p underneath. Each is pulled most of the way to its film frame's colour (a Lab mean / spread match), so the hero's
still dissolves into the loop without a colour jump, and the careers still sits with the footage.
tools/film-cut.py leaves these files alone while the generated images exist.
"""
import os
import cv2
import numpy as np

ROOT = r"C:\Rhidoys_workspace\seq_wildfire"
GEN = os.path.join(ROOT, "media", "incoming", "gen")
K2 = os.path.join(ROOT, "media", "incoming", "2k", "sequoia-2k-scene-{:02d}.mp4")
OUT = os.path.join(ROOT, "public", "media", "video")


def frame(n, t):
    cap = cv2.VideoCapture(K2.format(n))
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, img = cap.read()
    cap.release()
    return img


def match(img, ref, amount):
    """move img's Lab mean and spread toward ref's by `amount` (0..1)"""
    a = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    r = cv2.cvtColor(ref, cv2.COLOR_BGR2LAB).astype(np.float32)
    am, asd = a.reshape(-1, 3).mean(0), a.reshape(-1, 3).std(0)
    rm, rsd = r.reshape(-1, 3).mean(0), r.reshape(-1, 3).std(0)
    t = (a - am) / (asd + 1e-6) * rsd + rm
    return cv2.cvtColor(np.clip(a + (t - a) * amount, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)


def wide(img):
    """crop to 16:9 about the centre"""
    h, w = img.shape[:2]
    th = round(w * 9 / 16)
    y = max(0, (h - th) // 2)
    return img[y:y + th]


def save(img, dst, width, crop=None, sharpen=0.0, q=90):
    if crop:
        h, w = img.shape[:2]
        img = img[int(crop[1] * h):int(crop[3] * h), int(crop[0] * w):int(crop[2] * w)]
    h, w = img.shape[:2]
    size = (width, width * 9 // 16) if crop is None else (width, round(h * width / w))
    img = cv2.resize(img, size, interpolation=cv2.INTER_LANCZOS4 if width > w else cv2.INTER_AREA)
    if sharpen:
        img = cv2.addWeighted(img, 1 + sharpen, cv2.GaussianBlur(img, (0, 0), 1.2), -sharpen, 0)
    cv2.imwrite(dst, img, [cv2.IMWRITE_WEBP_QUALITY, q])
    print(os.path.basename(dst), img.shape[1], "x", img.shape[0], round(os.path.getsize(dst) / 1e3), "KB")


if __name__ == "__main__":
    # the desktop hero: over the loop until it plays (scene 01 at 7.52 s is the loop's own sharpest frame)
    hero = wide(match(cv2.imread(os.path.join(GEN, "hero-still.png")), frame(1, 7.52), 0.7))
    save(hero, os.path.join(OUT, "d-hero-2k.webp"), 2560, sharpen=0.25)
    save(hero, os.path.join(OUT, "d-hero.webp"), 1920, sharpen=0.15)
    # careers: the guard with binoculars (scene 04 at 6.0 s); desktop uncropped, phones the middle 60%
    car = wide(match(cv2.imread(os.path.join(GEN, "careers-still.png")), frame(4, 6.0), 0.6))
    save(car, os.path.join(OUT, "st-ground-hd.webp"), 1672)
    save(car, os.path.join(OUT, "st-ground.webp"), 720, crop=(0.12, 0, 0.72, 1))
