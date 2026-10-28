"""
Makes the Gobi's oasis sprite sheet (tiles/oasis.png) from the owner's art
(AI-assisted, 2026-10-28): four frames, side by side on a transparent
background, of a Han beacon tower by a spring pool with poplars, reeds and
rocks. Each frame is cut to the sprites' grid, 36 wide so the island stays
in its space, each art pixel the colour most of its block is in one
24-colour palette for all four (an average of the block blurred the roof
and the poplars). The frames were drawn apart, so their rocks and reeds
differ: all but the pennant and the water come from one frame, so only
those move. Then gaps of one pixel are filled and the shape outlined.

  python3 scripts/oasis-sheet.py art.png oasis.png

Needs Pillow, NumPy and SciPy.
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

WIDTH = 36
COLOURS = 24
BASE = 1
INK = np.array([52, 28, 18, 255], np.uint8)


def cut(src):
    """The four frames on the grid, bottom-aligned and centred, as arrays."""
    a = np.asarray(Image.open(src).convert('RGBA'))
    alpha = a[..., 3] > 128
    lab, n = ndimage.label(alpha)
    sizes = ndimage.sum(alpha, lab, range(1, n + 1))
    boxes = sorted(
        (ndimage.find_objects((lab == i + 1).astype(int))[0] for i, s in enumerate(sizes) if s > 5000),
        key=lambda sl: sl[1].start,
    )
    if len(boxes) != 4:
        sys.exit(f'Expected 4 frames, found {len(boxes)}.')
    opaque = Image.fromarray(a[..., :3][alpha].reshape(1, -1, 3), 'RGB')
    palette = opaque.quantize(colors=COLOURS, method=Image.Quantize.MEDIANCUT, kmeans=3)
    w0 = max(sl[1].stop - sl[1].start for sl in boxes)
    h0 = max(sl[0].stop - sl[0].start for sl in boxes)
    s = w0 / WIDTH
    height = round(h0 / s)
    frames = []
    for sl in boxes:
        left = (sl[1].start + sl[1].stop) / 2 - w0 / 2
        foot = sl[0].stop
        fr = np.zeros((height, WIDTH, 4), np.uint8)
        for y in range(height):
            for x in range(WIDTH):
                by0, by1 = int(foot - (height - y) * s), int(foot - (height - y - 1) * s)
                bx0, bx1 = int(left + x * s), int(left + (x + 1) * s)
                blk = a[max(by0, 0):by1, max(bx0, 0):bx1]
                if not blk.size:
                    continue
                solid = blk[..., 3] > 128
                if solid.mean() < 0.5:
                    continue
                px = Image.fromarray(blk[solid][:, :3].reshape(1, -1, 3), 'RGB')
                idx = np.bincount(np.asarray(px.quantize(palette=palette, dither=0)).ravel()).argmax()
                fr[y, x, :3] = palette.getpalette()[idx * 3:idx * 3 + 3]
                fr[y, x, 3] = 255
        frames.append(fr)
    return frames


def red(f):
    r, g, b = (f[..., i].astype(int) for i in range(3))
    return (f[..., 3] > 0) & (r > g + 50) & (r > b + 50)


def water(f):
    r, g, b = (f[..., i].astype(int) for i in range(3))
    return (f[..., 3] > 0) & (b > r + 25) & (g > r + 25)


def finish(frames):
    """One frame's art with each frame's pennant and water, outlined."""
    h, w = frames[0].shape[:2]
    top = np.zeros((h, w), bool)
    top[: h // 4, w // 2:] = True
    flag = np.zeros((h, w), bool)
    for f in frames:
        flag |= red(f) & top
    ys, xs = np.nonzero(flag)
    region = np.zeros((h, w), bool)
    region[max(ys.min() - 1, 0): ys.max() + 2, max(xs.min() - 1, 0):] = True
    base = frames[BASE]
    out = []
    for f in frames:
        o = base.copy()
        o[region] = f[region]
        wet = water(base) & water(f)
        o[wet] = f[wet]
        sil = o[..., 3] > 0
        gaps = ~sil & (ndimage.convolve(sil.astype(int), np.ones((3, 3), int), mode='constant') >= 6)
        o[gaps] = INK
        sil = o[..., 3] > 0
        ring = ndimage.binary_dilation(sil, np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]])) & ~sil
        o[ring] = INK
        out.append(o)
    return np.concatenate(out, axis=1)


Image.fromarray(finish(cut(sys.argv[1])), 'RGBA').save(sys.argv[2])
