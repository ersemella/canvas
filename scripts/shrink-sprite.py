"""
Turns a ChatGPT "pixel art" image into a true N×N sprite for the board.

ChatGPT paints a large image (about 1024 px) whose pixels only look like
pixels: uneven blocks, hundreds of colours, soft edges. Ask it for the
figure on a solid magenta (#FF00FF) background with a flat dark grey
(#444444) oval shadow under the feet, then run:

  python3 scripts/shrink-sprite.py chatgpt.png out.png [size]   # size defaults to 32

For a ground texture that fills the square (sand, quicksand), `--texture`
keeps every pixel: no background, outline or shadow. For an overlay whose
shapes should stay soft (fog), `--no-outline` removes the magenta but adds
no outline:

  python3 scripts/shrink-sprite.py sand.png sand-out.png 42 --texture
  python3 scripts/shrink-sprite.py fog.png fog-out.png 42 --no-outline

For a portrait, crop to the head first and keep the thin dark lines that
draw the eyes and brows (a block turns dark from that share of line):

  python3 scripts/shrink-sprite.py chatgpt.png out.png --crop 180,40,1180,1040 --lines 0.3

Each output pixel takes the most common shade in its block of the source.
ChatGPT's thin outlines and rim light don't vote; a clean 1-pixel outline is
drawn around the silhouette instead, outside it so thin limbs keep their
width (the figure fills size - 2 pixels). The grey shadow becomes see-through
black, and the colours are reduced to a small palette. Needs Pillow.
"""
import sys
from collections import Counter

from PIL import Image

args = sys.argv[1:]
crop = lines = None
if '--crop' in args:
    i = args.index('--crop')
    crop = tuple(int(v) for v in args.pop(i + 1).split(','))
    args.pop(i)
if '--lines' in args:
    i = args.index('--lines')
    lines = float(args.pop(i + 1))
    args.pop(i)
texture = '--texture' in args
outline = not texture and '--no-outline' not in args
args = [a for a in args if a not in ('--texture', '--no-outline')]
src, out = args[0], args[1]
N = int(args[2]) if len(args) > 2 else 32
M = 1 if outline else 0  # the outline goes in a 1-pixel margin
FIT = N - 2 * M  # the figure's size
COLOURS = 24
FIG_MIN = 0.3  # a block counts as figure from this share of figure pixels
STEP = 20  # channels round to this, so near-identical shades vote together
OUTLINE = (34, 24, 22, 255)
SHADOW = (0, 0, 0, 90)

im = Image.open(src).convert('RGB')
if crop:
    im = im.crop(crop)
W, H = im.size
px = im.load()


def background(p):
    # Magenta, and the pink-purple fringe where edges were blended into it.
    r, g, b = p
    return ((r > 170 and b > 170 and g < 130) or (b > 90 and r > 90 and g < 0.6 * min(r, b))
            or (b > 40 and r > 40 and g < 0.2 * min(r, b)))  # the darkest fringe, against outlines


def grey(p):
    r, g, b = p
    return abs(r - g) < 14 and abs(g - b) < 14 and 45 < r < 115


# The shadow's own grey: the commonest grey along the bottom rows. Matching
# only that keeps dark grey legs or boots just above it from turning to shadow.
bottom = Counter(px[x, y] for y in range(int(H * 0.95), H) for x in range(W) if grey(px[x, y]))
SHADE = bottom.most_common(1)[0][0] if bottom else None


def shadow(p, y):
    return (SHADE is not None and y > H * 0.86
            and max(abs(a - b) for a, b in zip(p, SHADE)) <= 12)


def line(p):
    # Dark outlines, and the pale yellow rim light, which at this size only
    # makes a jagged stripe. The rim is a saturated yellow; cream (a white hat,
    # a robe's trim) is paler, with less gap between red and blue, and stays.
    r, g, b = p
    return sum(p) < 120 or (r > 220 and g > 200 and r - b > 95)


kind = {}
shade = {}
for y in range(H):
    for x in range(W):
        p = px[x, y]
        k = ('fig' if texture else 'bg' if background(p) else 'sh' if shadow(p, y)
             else 'line' if line(p) else 'fig')
        kind[x, y] = k
        if k == 'fig':
            shade[x, y] = tuple(min(255, round(c / STEP) * STEP) for c in p)

sprite = Image.new('RGBA', (N, N), (0, 0, 0, 0))
sp = sprite.load()
cw, ch = W / FIT, H / FIT
for j in range(FIT):
    for i in range(FIT):
        x0, x1, y0, y1 = int(i * cw), int((i + 1) * cw), int(j * ch), int((j + 1) * ch)
        kinds, shades = Counter(), Counter()
        for y in range(y0, y1):
            for x in range(x0, x1):
                kinds[kind[x, y]] += 1
                if kind[x, y] == 'fig':
                    shades[shade[x, y]] += 1
        total = sum(kinds.values())
        if kinds['fig'] + kinds['line'] >= FIG_MIN * total:
            dark = (kinds['line'] >= lines * total if lines is not None
                    else kinds['line'] > kinds['fig'] * 1.5)
            if dark or not shades:
                sp[i + M, j + M] = OUTLINE  # a block that is mostly line stays dark
            else:
                # The average of the winning shade's source pixels, for a true colour.
                win = shades.most_common(1)[0][0]
                ps = [px[x, y] for y in range(y0, y1) for x in range(x0, x1)
                      if kind[x, y] == 'fig' and shade[x, y] == win]
                sp[i + M, j + M] = tuple(sum(c) // len(ps) for c in zip(*ps)) + (255,)
        elif kinds['sh'] >= kinds['bg']:
            sp[i + M, j + M] = SHADOW


def solid(i, j):
    return 0 <= i < N and 0 <= j < N and sp[i, j][3] == 255


ring = [(i, j) for j in range(N) for i in range(N) if not solid(i, j)
        and any(solid(i + di, j + dj) for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
for i, j in ring if outline else []:
    sp[i, j] = OUTLINE

# A small palette, chosen from the sprite itself; the shadow stays see-through.
alpha = sprite.getchannel('A')
sprite = sprite.convert('RGB').quantize(colors=COLOURS, method=Image.Quantize.MAXCOVERAGE)
sprite = sprite.convert('RGBA')
sprite.putalpha(alpha)
sp = sprite.load()
for j in range(N):
    for i in range(N):
        if alpha.getpixel((i, j)) == SHADOW[3]:
            sp[i, j] = SHADOW
sprite.save(out)
