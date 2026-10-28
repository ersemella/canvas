"""
Makes the Fairy Chimneys' art (cappadocia.md) from the owner's pictures
(AI-assisted, 2026-10-28): the tuff ground (tiles/tuff.png), a seamless
tile cut to 128 pixels, and the fairy chimney (tiles/fairy-chimney.png),
cut out of its magenta background to the sprites' grid, 28 wide so its
rubble stays in its space. Each art pixel is the colour most of its block
is, in a small palette of the picture's own colours (an average of the
block blurs the edges between colours). The chimney is then outlined in
dark warm brown, fading to the hex borders' colour at its foot, so it
rises out of the ground as the oasis does.

  python3 scripts/cappadocia-art.py ground.png chimney.png tiles/

Needs Pillow, NumPy and SciPy.
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.cluster.vq import kmeans2

GROUND_SIZE = 128
# The ground's colours, picked from the picture: a palette worked out from
# it merges the scrub's olive into the pebbles' grey, they are so few.
GROUND_PALETTE = [
    (242, 219, 194),  # cream tuff
    (243, 205, 173),  # apricot
    (234, 194, 173),  # rose
    (212, 191, 170),  # warm grey runnels
    (154, 142, 135),  # basalt pebbles
    (132, 128, 94),  # scrub
    (104, 104, 74),  # scrub's shade
]
CHIMNEY_WIDTH = 28
CHIMNEY_COLOURS = 9
OUTLINE = np.array([74, 48, 36], float)
# The hex borders' colour on this map (ground.ts, `tuff`).
BORDER = np.array([150, 120, 104], float)


def modal(a, palette, x0, x1, y0, y1, mask=None):
    """The palette colour most of a block is, or None if under half of it is solid."""
    blk = a[y0:y1, x0:x1, :3]
    if mask is not None:
        solid = mask[y0:y1, x0:x1]
        if solid.mean() < 0.5:
            return None
        blk = blk[solid]
    px = Image.fromarray(blk.reshape(1, -1, 3).astype(np.uint8), 'RGB')
    idx = np.bincount(np.asarray(px.quantize(palette=palette, dither=0)).ravel()).argmax()
    return palette.getpalette()[idx * 3:idx * 3 + 3]


def ground(src):
    a = np.asarray(Image.open(src).convert('RGB'))
    palette = Image.new('P', (1, 1))
    palette.putpalette([v for c in GROUND_PALETTE for v in c])
    s = a.shape[1] / GROUND_SIZE
    out = np.zeros((GROUND_SIZE, GROUND_SIZE, 3), np.uint8)
    for y in range(GROUND_SIZE):
        for x in range(GROUND_SIZE):
            out[y, x] = modal(a, palette, int(x * s), int((x + 1) * s), int(y * s), int((y + 1) * s))
    return Image.fromarray(out, 'RGB')


def chimney(src):
    a = np.asarray(Image.open(src).convert('RGB')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    magenta = (r > 180) & (b > 180) & (g < 120)
    solid = ndimage.binary_opening(~magenta, iterations=2)
    ys, xs = np.nonzero(solid)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    inner = ndimage.binary_erosion(solid, iterations=6)
    # k-means over the picture's colours: a median cut merges the cap's
    # few greys into the tuff's browns.
    centres, _ = kmeans2(a[inner].astype(float), CHIMNEY_COLOURS, seed=1, minit='++')
    palette = Image.new('P', (1, 1))
    palette.putpalette([int(v) for c in centres for v in c])
    s = (x1 - x0) / CHIMNEY_WIDTH
    height = round((y1 - y0) / s)
    o = np.zeros((height, CHIMNEY_WIDTH, 4), np.uint8)
    for y in range(height):
        for x in range(CHIMNEY_WIDTH):
            bx0, bx1 = int(x0 + x * s), int(x0 + (x + 1) * s)
            by0, by1 = int(y1 - (height - y) * s), int(y1 - (height - y - 1) * s)
            c = modal(a, palette, bx0, bx1, max(by0, 0), by1, inner)
            if c is not None:
                o[y, x, :3] = c
                o[y, x, 3] = 255
    # The picture's own dark outline is cut with it; the new one replaces
    # it, so its outermost dark pixels go first.
    sil = o[..., 3] > 0
    dark = o[..., :3].astype(int).sum(2) < 200
    o[dark & sil & ~ndimage.binary_erosion(sil)] = 0
    # A row above and a column either side, so the outline fits.
    o = np.pad(o, ((1, 0), (1, 1), (0, 0)))
    sil = ndimage.binary_fill_holes(o[..., 3] > 0)
    ring = ndimage.binary_dilation(sil, np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]])) & ~sil
    h = o.shape[0]
    for y, x in zip(*np.nonzero(ring)):
        t = max(0.0, (y / h - 0.75) / 0.25)
        o[y, x, :3] = np.round(OUTLINE * (1 - t) + BORDER * t).astype(np.uint8)
        o[y, x, 3] = 255
    return Image.fromarray(o, 'RGBA')


if __name__ == '__main__':
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    ground_src, chimney_src, out = sys.argv[1:]
    ground(ground_src).save(f'{out}/tuff.png')
    chimney(chimney_src).save(f'{out}/fairy-chimney.png')
