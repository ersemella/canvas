"""The Cyclops's cave floor (2026-10-28): a seamless 128-pixel tile in 6
colours, drawn in code until the owner's art comes (prompt in
docs/plans/roguelike-tactics/art-direction.md, "Prompts for the cave
floor"). Worn stone plates (a Voronoi on the torus, so it wraps), their
seams dark, a lit rim on each plate's top-left edge, scattered gravel and
some plates darker, as if damp.

    python3 scripts/cave-floor.py packages/games/silk-road-run/src/client/tiles/cave-floor.png
"""
import random
import sys

from PIL import Image

SIZE = 128
PLATES = 20
SEED = 7

# Darkest to lightest: seam, shadow, damp stone, stone, stone lit, gravel.
SEAM = (82, 75, 70)
SHADOW = (92, 85, 79)
DAMP = (101, 94, 88)
STONE = (110, 102, 94)
LIT = (121, 112, 103)
GRAVEL = (138, 128, 117)

rng = random.Random(SEED)


def wrap(d: float) -> float:
    d = abs(d) % SIZE
    return min(d, SIZE - d)


points: list[tuple[float, float]] = []
while len(points) < PLATES:
    p = (rng.uniform(0, SIZE), rng.uniform(0, SIZE))
    # Spread out, so no two plates meet in a sliver.
    if all(wrap(p[0] - q[0]) ** 2 + wrap(p[1] - q[1]) ** 2 > 17**2 for q in points):
        points.append(p)
# Some plates a shade darker, as if damp.
damp = {i for i in range(PLATES) if rng.random() < 0.35}


def nearest(x: float, y: float) -> tuple[int, float]:
    """The nearest plate's index and how much nearer it is than the second nearest."""
    ds = sorted((wrap(x - px) ** 2 + wrap(y - py) ** 2, i) for i, (px, py) in enumerate(points))
    (d1, i1), (d2, _) = ds[0], ds[1]
    return i1, d2**0.5 - d1**0.5


img = Image.new('RGB', (SIZE, SIZE))
px = img.load()
for y in range(SIZE):
    for x in range(SIZE):
        i, gap = nearest(x + 0.5, y + 0.5)
        px[x, y] = SEAM if gap < 1.0 else DAMP if i in damp else STONE

# A lit rim along each plate's top-left seam, a shade along its bottom-right.
for y in range(SIZE):
    for x in range(SIZE):
        if px[x, y] == SEAM:
            continue
        up, left = px[x, (y - 1) % SIZE], px[(x - 1) % SIZE, y]
        down, right = px[x, (y + 1) % SIZE], px[(x + 1) % SIZE, y]
        if up == SEAM or left == SEAM:
            px[x, y] = LIT
        elif down == SEAM or right == SEAM:
            px[x, y] = SHADOW

# Gravel: single stones, a lit pixel over its shadow, and a few of two.
for _ in range(70):
    x, y = rng.randrange(SIZE), rng.randrange(SIZE)
    if px[x, y] not in (STONE, DAMP) or px[x, (y + 1) % SIZE] == SEAM:
        continue
    px[x, y] = GRAVEL
    px[x, (y + 1) % SIZE] = SHADOW
    if rng.random() < 0.3 and px[(x + 1) % SIZE, y] in (STONE, DAMP):
        px[(x + 1) % SIZE, y] = GRAVEL
        px[(x + 1) % SIZE, (y + 1) % SIZE] = SHADOW

img.save(sys.argv[1])
