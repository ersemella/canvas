"""
Makes the Gobi's oasis sprite sheet (tiles/oasis.png) after the owner's art
(AI-assisted, 2026-10-28): the Flaming Mountains' beacon tower, its body
narrowed and shortened, right of the middle on a sandy island, with a
spring pool in front, rocks, reeds and two poplars on its left. Shrinking
the art itself left the roof a blob and lost the poplars, so it is drawn on
the sprites' grid, reusing the tower's hand-drawn pixels. 46 x 53 a frame,
4 frames: the tower's pennant flying, a glint crossing the water.

  python3 scripts/oasis-sheet.py beacon-tower.png oasis.png

Needs Pillow.
"""
import math, sys
from PIL import Image

W, H, FRAMES = 46, 53, 4
# Everything but the tower drawn this far right; the tower right of the middle, as in the art.
OX = 2
TOWER_DX = 8
BODY = 25  # the body's rows, from the beacon's 33
C = {
  'ink': (52, 30, 18), 'sandL': (222, 192, 136), 'sand': (200, 164, 108), 'sandD': (166, 128, 82),
  'wD': (24, 104, 110), 'wM': (38, 146, 144), 'wL': (108, 200, 186), 'glint': (214, 244, 228),
  'bank': (120, 92, 58),
  'rockL': (214, 200, 170), 'rock': (172, 156, 128), 'rockD': (122, 106, 86),
  'rD': (70, 88, 30), 'rM': (112, 130, 44), 'rL': (160, 168, 70),
  'pD': (70, 86, 30), 'pM': (116, 132, 46), 'pL': (168, 170, 74), 'trunk': (190, 180, 160),
}
beacon = Image.open(sys.argv[1]).convert('RGBA')

def narrowed_tower(f):
  """The beacon's frame f, its body (rows 13 on) cut to BODY rows, tapering 17 to 19 wide."""
  src = beacon.crop((f * 38, 0, f * 38 + 38, 46))
  out = Image.new('RGBA', (38, 13 + BODY), (0, 0, 0, 0))
  sp, op = src.load(), out.load()
  for y in range(13 + BODY):
    sy = y if y < 13 else 13 + round((y - 13) * 32 / (BODY - 1))
    xs = [x for x in range(38) if sp[x, sy][3]]
    if not xs: continue
    if y < 13:
      for x in xs: op[x, y] = sp[x, y]
      continue
    l, r = xs[0], xs[-1]
    w = round(17 + 2 * (y - 13) / (BODY - 1))
    l2 = 18 - w // 2
    for i in range(w):
      sx = l + round(i * (r - l) / (w - 1))
      op[l2 + i, y] = sp[sx, sy]
  return out

def frame(f):
  im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
  px = im.load()
  def put(x, y, c):
    x += OX
    if 0 <= x < W and 0 <= y < H: px[x, y] = C[c] + (255,)
  def outline(mask_fn):
    pts = [(x - OX, y) for y in range(H) for x in range(W)
           if not px[x, y][3] and any(0 <= x + dx < W and 0 <= y + dy < H and mask_fn(x + dx, y + dy)
                                       for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)])]
    for x, y in pts: put(x, y, 'ink')

  # The island: sand, lit at the back, shaded at the front.
  cx, cy, rx, ry = 20.5, 45.5, 16, 7
  for y in range(H):
    for x in range(W):
      d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
      if d <= 1:
        put(x, y, 'sandL' if y < cy - 3 else 'sandD' if y > cy + 4 else 'sand')
  outline(lambda x, y: px[x, y][3] > 0)
  # Two poplars behind the tower's left side: tall, narrow, lit on the left.
  def poplar(tx, base, top, half):
    for y in range(top, base - 2):
      t = (y - top) / (base - 2 - top)
      hw = half * math.sin(math.pi * min(1, t * 1.15)) ** 0.6
      hw += 0.6 if (y // 2) % 2 else 0
      for x in range(math.floor(tx - hw), math.ceil(tx + hw) + 1):
        if abs(x - tx) > hw + .3: continue
        c = 'pL' if x < tx - hw / 3 else 'pD' if x > tx + hw / 3 else 'pM'
        if (x * 3 + y * 5) % 7 == 0 and c == 'pM': c = 'pD'
        put(x, y, c)
    for y in range(base - 3, base + 1): put(int(tx), y, 'trunk')
    outline(lambda x, y: px[x, y][3] > 0 and px[x, y][:3] not in (C['sandL'], C['sand'], C['sandD']))
  poplar(13, 41, 9, 3.2)
  poplar(7, 43, 19, 2.8)
  # The beacon tower on the island's back.
  im.alpha_composite(narrowed_tower(f), (TOWER_DX, 41 - 12 - BODY))
  # Rubble at its foot.
  for x, y, c in [(28, 41, 'rock'), (29, 41, 'rockL'), (30, 42, 'rockD'), (27, 42, 'rock'), (31, 41, 'rock'),
                  (32, 42, 'rockD'), (33, 41, 'rockL'), (34, 42, 'rock'), (14, 42, 'rockL'), (15, 42, 'rock')]:
    put(x, y, c)
  # The spring pool, front left, with a dark bank on its far side.
  pcx, pcy, prx, pry = 16, 47.5, 10.5, 3.6
  for y in range(H):
    for x in range(W):
      d = ((x + .5 - pcx) / prx) ** 2 + ((y + .5 - pcy) / pry) ** 2
      if d <= 1:
        put(x, y, 'bank' if y < pcy - 2 else 'wD' if y < pcy - 1 else 'wM')
  for x0, y0, l in [(10, 48, 3), (16, 49, 4), (20, 47, 2)]:
    for i in range(l): put(x0 + i, y0, 'wL')
  gx = [9, 12, 15, 18][f]
  put(gx, 46, 'glint'); put(gx + 1, 46, 'glint')
  # Rocks round the pool.
  for x, y in [(4, 46), (25, 49), (27, 45), (7, 50), (34, 46)]:
    put(x, y, 'rockL'); put(x + 1, y, 'rock'); put(x + 1, y + 1, 'rockD'); put(x, y + 1, 'rock')
  # Reed tufts.
  for x0, y0, h in [(9, 43, 3), (23, 44, 3), (29, 48, 4), (32, 45, 3), (36, 44, 2), (12, 52, 2), (21, 52, 3), (3, 49, 2)]:
    for i in range(h): put(x0, y0 - i, 'rM' if i else 'rD')
    put(x0 - 1, y0 - 1, 'rD'); put(x0 + 1, y0 - 1, 'rL')
    if h > 2: put(x0 + 1, y0 - h + 1, 'rL')
  outline(lambda x, y: px[x, y][3] > 0 and px[x, y][:3] != C['ink'])
  return im

sheet = Image.new('RGBA', (W * FRAMES, H), (0, 0, 0, 0))
for f in range(FRAMES): sheet.paste(frame(f), (f * W, 0))
sheet.save(sys.argv[2])
