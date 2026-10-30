"""Frame-by-frame scan of a video: per-frame luma, motion (mean abs diff vs previous frame), colour-histogram
similarity (cuts), then contact sheets at a fixed sample rate with timestamps. Usage: vqa_scan.py <video> <outdir> <tag> <sheet_fps>"""
import sys, os, csv
import cv2
import numpy as np

src, out, tag, sfps = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
os.makedirs(out, exist_ok=True)
cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS)
W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
rows, thumbs = [], []
prev_g, prev_h = None, None
i = 0
step = max(1, int(round(fps / sfps)))
tw = 320 if W > H else 150
th = int(round(tw * H / W))
while True:
    ok, f = cap.read()
    if not ok:
        break
    small = cv2.resize(f, (160, int(160 * H / W)), interpolation=cv2.INTER_AREA)
    g = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).astype(np.float32)
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    h = cv2.calcHist([hsv], [0, 1], None, [24, 16], [0, 180, 0, 256])
    cv2.normalize(h, h)
    luma = float(g.mean())
    diff = float(np.abs(g - prev_g).mean()) if prev_g is not None else 0.0
    corr = float(cv2.compareHist(prev_h, h, cv2.HISTCMP_CORREL)) if prev_h is not None else 1.0
    rows.append((i, i / fps, luma, diff, corr))
    if i % step == 0:
        t = cv2.resize(f, (tw, th), interpolation=cv2.INTER_AREA)
        lab = f"{int(i / fps) // 60}:{(i / fps) % 60:05.2f}"
        cv2.rectangle(t, (0, 0), (len(lab) * 9 + 6, 16), (0, 0, 0), -1)
        cv2.putText(t, lab, (3, 12), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1, cv2.LINE_AA)
        thumbs.append(t)
    prev_g, prev_h = g, h
    i += 1
cap.release()

with open(os.path.join(out, f"{tag}-frames.csv"), "w", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["frame", "t", "luma", "diff", "corr"])
    w.writerows(rows)

cols = 6 if W > H else 10
per = cols * (6 if W > H else 3)
for k in range(0, len(thumbs), per):
    chunk = thumbs[k:k + per]
    while len(chunk) % cols:
        chunk.append(np.zeros_like(thumbs[0]))
    grid = np.vstack([np.hstack(chunk[r * cols:(r + 1) * cols]) for r in range(len(chunk) // cols)])
    cv2.imwrite(os.path.join(out, f"{tag}-sheet-{k // per:02d}.jpg"), grid, [cv2.IMWRITE_JPEG_QUALITY, 82])

# summary
a = np.array([(r[2], r[3], r[4]) for r in rows])
luma, diff, corr = a[:, 0], a[:, 1], a[:, 2]
print(f"{tag}: {len(rows)} frames @ {fps} fps, {W}x{H}, sheets of {per} at {sfps} fps")
cuts = [r for r in rows if r[4] < 0.55 or r[3] > 22]
print("hard cuts / big jumps:", [(r[0], round(r[1], 2), round(r[3], 1), round(r[4], 2)) for r in cuts])
white = [r[0] for r in rows if r[2] > 240]
black = [r[0] for r in rows if r[2] < 12]
print("near-white frames:", len(white), "near-black frames:", len(black))
# white runs (fades)
def runs(idx):
    out, s = [], None
    for j, x in enumerate(idx):
        if s is None:
            s = x
        if j + 1 == len(idx) or idx[j + 1] != x + 1:
            out.append((s, x)); s = None
    return out
print("white runs (frame ranges):", [(s, e, round(s / fps, 2)) for s, e in runs(white)])
# frozen runs: diff < 0.05 for 12+ frames
frozen = [r[0] for r in rows[1:] if r[3] < 0.05]
print("frozen runs >= 12 frames:", [(s, e, round(s / fps, 2)) for s, e in runs(frozen) if e - s >= 11])
# glitch spikes: diff > 4x rolling median (window 25) and > 6, not at a cut
med = np.array([np.median(diff[max(0, j - 12):j + 13]) for j in range(len(diff))])
spk = [(j, round(j / fps, 2), round(diff[j], 1), round(med[j], 1)) for j in range(1, len(diff)) if diff[j] > 6 and diff[j] > 4 * med[j] and corr[j] > 0.55]
print("motion spikes inside shots:", spk[:60], "..." if len(spk) > 60 else "")
