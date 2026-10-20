"""
Makes quicksand's sprite sheet: frames of a spiral in a few tones of
sand, each frame's bands a step further in to the centre, so played in
turn the sand seems to flow in (colour cycling: no pixel moves, only its
tone changes). The sheet is the frames side by side, 42×42 each like the
other ground textures; the spiral's edge dithers into the sand image so
it sits on the board.

  python3 scripts/quicksand-sheet.py sand.png quicksand.png

Needs Pillow.
"""
import math
import random
import sys

from PIL import Image

sand_path, out = sys.argv[1:]
sand = Image.open(sand_path).convert('RGBA')

SIZE = 42
FRAMES = 8
# Dark to light: the quicksand's tones.
TONES = [(127, 97, 65), (157, 122, 84), (181, 146, 102), (187, 154, 113)]
GRAIN = (110, 82, 54)
# Spiral arms, and how far an arm winds from the centre to the edge.
ARMS = 3
TWIST = 3.3
# Where the spiral starts to dither into the sand, as a fraction of its radius.
EDGE = 0.72
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

rng = random.Random(4)
centre = SIZE / 2
grains = {
    (x, y)
    for x in range(SIZE)
    for y in range(SIZE)
    if math.hypot(x + 0.5 - centre, y + 0.5 - centre) < centre * 0.65 and rng.random() < 0.035
}


def frame(f):
    img = Image.new('RGBA', (SIZE, SIZE))
    px = img.load()
    for y in range(SIZE):
        for x in range(SIZE):
            dx = x + 0.5 - centre
            dy = y + 0.5 - centre
            r = math.hypot(dx, dy) / centre
            turn = math.atan2(dy, dx) / (2 * math.pi)
            # Adding f moves each band to a smaller radius: the flow inward.
            band = int(((ARMS * turn + TWIST * r + f / FRAMES) % 1) * 4)
            # Darker towards the middle, where it sinks.
            tone = band - (r < 0.35) - (r < 0.15)
            color = TONES[max(0, min(3, tone))]
            if (x, y) in grains:
                color = GRAIN
            fade = (r - EDGE) / (1 - EDGE)
            if fade > 0 and fade * 16 > BAYER[y % 4][x % 4]:
                color = sand.getpixel((x, y))[:3]
            px[x, y] = (*color, 255)
    return img


sheet = Image.new('RGBA', (SIZE * FRAMES, SIZE))
for f in range(FRAMES):
    sheet.paste(frame(f), (f * SIZE, 0))
sheet.save(out)
