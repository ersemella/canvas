"""
Makes a 2-frame idle sprite sheet from a single sprite: frame 1 is the
sprite, frame 2 has everything above a row moved down one pixel (a breath),
with the rest planted. The sheet is the frames side by side, each the
sprite's size, which the board plays as an animation.

  python3 scripts/idle-sheet.py sprite.png sheet.png --split 18

`--split` is the first row that stays put (the waist, or a rider's saddle).
On a beast whose head hangs as low as its legs' tops (the wolf), or to make
the legs bend, put it in the legs instead, where they run straight down
(the knees): the body and head sink as one and the legs shorten a row. A
split through the head flattens the face.
Run it on a single frame: a sheet's first frame is the original sprite, so
`--from-sheet` takes that frame back out of an existing sheet first. Needs
Pillow.
"""
import sys

from PIL import Image

args = sys.argv[1:]
split = int(args.pop(args.index('--split') + 1))
args.remove('--split')
from_sheet = '--from-sheet' in args
if from_sheet:
    args.remove('--from-sheet')
src, out = args

frame = Image.open(src).convert('RGBA')
if from_sheet:
    frame = frame.crop((0, 0, frame.height, frame.height))
W, H = frame.size
fp = frame.load()

second = frame.copy()
sp = second.load()
for x in range(W):
    for y in range(split):
        sp[x, y] = (0, 0, 0, 0)
    for y in range(split - 1, -1, -1):
        p = fp[x, y]
        if y + 1 < split:
            sp[x, y + 1] = p
        elif p[3] == 255:
            # The first planted row: the moved body overlaps it only where opaque.
            sp[x, y + 1] = p

sheet = Image.new('RGBA', (W * 2, H), (0, 0, 0, 0))
sheet.paste(frame, (0, 0))
sheet.paste(second, (W, 0))
sheet.save(out)
