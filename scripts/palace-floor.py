"""Zahhak's palace floor (tiles/palace-floor.png) from the owner's picture
(AI-assisted, ChatGPT, 2026-10-29; the prompt is in
docs/plans/roguelike-tactics/art-direction.md, "Prompts for Zahhak's palace
floor"): a seamless tile cut to 128 pixels in 7 colours, as cave-floor.py
cuts the cave's: five of the stone's creams and ochres found by k-means
over it, and the glazed tiles' teal and cobalt kept apart, as so few pixels
would be merged into the stone. Each art pixel is the colour most of its
block is. Then calmed (owner, 2026-10-29: it stood out too much): every
colour pulled `CALM` of the way to the stone's mean, and its saturation cut
to `SATURATION`, so the units and the grid stand out on it.

  python3 scripts/palace-floor.py picture.png packages/games/silk-road-run/src/client/tiles/palace-floor.png

Needs Pillow and NumPy.
"""
import sys

import numpy as np
from PIL import Image

SIZE = 128
STONES = 5
TEAL = (47, 104, 96)
COBALT = (46, 66, 120)
CALM = 0.45
SATURATION = 0.6


def kmeans(px: np.ndarray, k: int) -> np.ndarray:
    """`k` colours of `px` by k-means, started from its brightness percentiles."""
    lum = px.sum(1)
    centres = np.array([px[np.abs(lum - np.percentile(lum, p)).argmin()] for p in np.linspace(3, 97, k)])
    for _ in range(30):
        nearest = ((px[:, None] - centres[None]) ** 2).sum(2).argmin(1)
        centres = np.array([px[nearest == i].mean(0) if (nearest == i).any() else centres[i] for i in range(k)])
    return centres.round().astype(int)


src = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)
flat = src.reshape(-1, 3)
# The stone is warm: red well above blue. The tiles are not.
stone = flat[flat[:, 0] > flat[:, 2] + 30]
palette = [tuple(int(v) for v in c) for c in kmeans(stone[::5], STONES)] + [TEAL, COBALT]
pal = Image.new('P', (1, 1))
pal.putpalette([v for c in palette for v in c])
step = src.shape[0] / SIZE
out = np.zeros((SIZE, SIZE, 3), np.uint8)
for y in range(SIZE):
    for x in range(SIZE):
        blk = src[round(y * step) : round((y + 1) * step), round(x * step) : round((x + 1) * step)]
        img = Image.fromarray(blk.astype(np.uint8), 'RGB').quantize(palette=pal, dither=0)
        out[y, x] = palette[np.bincount(np.asarray(img).ravel()).argmax()]
mean = np.array(palette[:STONES]).mean(0)
calm = []
for c in palette:
    v = np.array(c) + (mean - np.array(c)) * CALM
    grey = v.mean()
    calm.append(tuple(int(round(x)) for x in grey + (v - grey) * SATURATION))
for old, new in zip(palette, calm):
    out[(out == old).all(2)] = new
palette = calm
Image.fromarray(out, 'RGB').save(sys.argv[2])
print('palette', palette)
