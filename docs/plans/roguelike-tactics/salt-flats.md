# Roguelike tactics: the Salt Flats, Persia's map

The Persia region's first map: a salt desert of white crust with one
large salt dome in the middle of the board, its rules, its look, and the
prompts for making its art in ChatGPT.

> Part of the roguelike tactics plan. Start at [README.md](README.md).
> The region and its biome are in [setting.md](setting.md) (15.3a,
> 15.3b); how the other maps are drawn is in
> [art-direction.md](art-direction.md).

Everything here is **Proposed** (2026-10-26, from the owner's brief: "the
salt flats, but should feature large salt domes"; then "1 large salt dome
directly in the middle", owner, 2026-10-26). Nothing is built.

## The place

The Dasht-e Kavir, the Great Salt Desert of the Iranian plateau, which the
Khorasan road skirted ([setting.md](setting.md), 15.3b). Its crust
dries into polygons of raised salt ridges a hand to a metre across, white
to grey over brown mud. Through it rise **salt domes** (diapirs): salt
pushed up from below into round, hummocky hills, banded white, grey and
dusty pink with red clay, some with a crown collapsed into a crater or
salt flowing down a flank like a glacier. The Kavir's basin has dozens of
them. One gives the board its landmark, as the burning ridges give the
Flaming Mountains theirs, and it reads as Persia's because no other
region's ground is white.

In the game's text the place stays unnamed (owner, 2026-10-26: the setting
shows only in the art): the map is **The Salt Flats**, its tiles **Salt
flat**, **Salt dome** and **Windcatcher**.

## The board

The Steppe's board (`STEPPE` in map.ts), as every map so far:

| | The Salt Flats | Why |
|---|---|---|
| Open ground (`sand`) | **Salt flat** | No effect, as the Steppe's grass and China's red earth |
| Mountains (`mountain`) | **One large salt dome** on the centre space and the six around it, in every fight, always in the same place (a fixed tile set, not rolled by `randomTiles`) | The owner's call: one large dome directly in the middle. Seven spaces, a hexagon in the middle of the hexagon board, is large and keeps the board symmetrical; it blocks movement and arrows as every mountain does |
| Obstacle (`obstacle`) | **One windcatcher**, rolled each fight on a space 3 from the centre, off the starting columns and not next to the camel's start or the exit | The roofline that reads as Persia at a glance, as the tiled pavilion roof reads as China: the slotted tower of a desert cistern (*ab anbar*). Ten spaces 3 from the centre are off the starting columns; two of them are next to the camel's start or the exit, so eight are left |
| Covered | 8 spaces, the cap (`MAX_COVERED`): the dome's 7 and the windcatcher | As the Flaming Mountains |
| Hazard | None at first | The setting's hazard, a crust over mud that gives way, is a candidate only. China's fissures were tried and taken out (owner, 2026-10-26), so the map starts without one; see Later |

**How it plays.** The dome splits the board into two flanks: nothing can
walk or shoot across the middle, so a fight is two fights around its
sides until one side wins its flank and comes round. The windcatcher, on
one flank or the other, makes the two flanks different each fight. The
camel's road runs into the dome: its shortest walk from the top point to
the exit goes round it, **10 steps instead of 8**, by either side
(the camel already walks the shortest way around what blocks it,
[camel.md](camel.md)), so the flank it takes is the one to hold. Units
start on the side columns, 3 or 4 from the centre, so the dome doesn't
touch the starting spaces.

**Spanning several spaces.** In China the owner took out the ridges drawn
in code because they were "the only thing on the board spanning spaces".
Here that is the point: the dome is the one thing on the board that spans
spaces, so it reads as the landmark. It is **one sprite** over its seven
spaces, not seven pieces, drawn as mountains are, after the units in its
row and before those in front of it, so its crown stands in front of a
unit just behind it.

**Low, not tall.** A salt dome is wider than it is tall, and a tall one
would hide the units in the spaces behind it. Its body fills its seven
spaces and its crown rises only about a third of a hex above the back
of them.

## The look

A `LOOKS` entry for `salt`, built as the Flaming Mountains' was:

- **Ground:** `tiles/salt-crust.png`, a seamless tile of about 128 pixels
  laid as one field, in 5 colours: off-white to pale grey salt, the
  ridges a step lighter, the cracks between them a cool grey, a little
  brown mud showing. Its polygons are irregular, 5 to 7 sided and
  **smaller than a hex** (8 to 16 pixels across), so the ground never
  reads as a second hex grid.
- **Brightness:** the palette wants terrain narrow in brightness
  ([art-direction.md](art-direction.md), Palette), and pure white would
  outshine the units. The salt is kept a **warm off-white a step below
  the page's ivory text**, so the ivory labels and the units' ink outlines
  still read on it. Hex borders a soft grey.
- **Hail on salt:** hail is drawn in the palette's pale sky
  (`skyLight`, `#cfe8f2`), which is close to the salt. It needs checking
  on the board; if it is lost, the hail's outline goes to the deeper sky
  (`#6fb6d8`) on this map.
- **The salt dome:** `tiles/salt-dome.png`, about **106 × 124**: its
  seven spaces' outline is 105 wide and 109 tall (three hexes of 42 by
  36 in the middle column, a column either side), and the crown rises
  about 12 above that. A broad, lumpy dome with a collapsed crater on its
  crown and a tongue of salt flowing down its front, banded white, grey
  and dusty pink with red clay, in about 7 colours taken from the salt's
  own shades plus the pink and the clay, lit from the upper left as the
  Steppe's peaks are, outlined in a dark grey-brown rather than ink, so
  it blends with the ground. It stands on the salt itself, its foot
  spreading a little onto the salt around it, inside its outer spaces.
- **What moves:** a few **salt crystals glinting** on the dome, a single
  bright pixel growing to a small cross and fading, in 4 frames at 3 a
  second (the fire's pace, `FLAME_FPS`), out of step with each other, held
  on the first frame for reduced motion. Drawn in code, as the yurts'
  smoke is, so the sprite stays still.
- **Windcatcher:** `tiles/windcatcher.png`, about 34 × 46, its base 24
  wide so it stays inside its space, as the beacon tower's: a square
  mudbrick tower with tall vent slots at the top and a band of turquoise
  tile under them, rising from the low dome of the cistern it cools. Its
  brick in ochre browns a little darker than the salt, outlined in dark
  earth below and ink above. No animation at first; salt dust blowing from
  its vents in code is an option if the board feels still.

## Prompts for ChatGPT

The other maps' art is the owner's, AI-assisted and then redrawn on the
sprites' grid (art-direction.md): the image models don't keep a pixel
grid or a palette, so each picture is a starting point to cut down to
size by hand. To keep the style:

- **Attach the references** with each prompt:
  `tiles/mountain-twin.png` (a mountain on its hex) and
  `tiles/beacon-tower.png` (an obstacle), from
  `packages/games/silk-road-run/src/client/tiles/`, scaled up 8× with
  nearest-neighbour so the model sees the pixels. For the dome, also a
  picture of its seven spaces' outline (a hexagon of seven flat-top
  hexes), so it fills the right shape.
- **Ask for one asset per image**, large and on a flat background, then
  scale it down to the sizes above and fix the grid, the palette and the
  outline in Aseprite.
- If a result comes back too detailed, ask it to "halve the detail and
  use fewer, larger pixel clusters"; too saturated, "desaturate the
  terrain toward grey".

### 1. Salt crust ground (seamless)

```
Pixel art terrain texture, top-down view, seamlessly tileable on all four
edges, for a hex-grid tactics game in the style of Into the Breach.

Subject: the crust of a vast salt desert. Dry white salt dried into
irregular polygons (5 to 7 sides, uneven sizes) outlined by low raised
salt ridges, with thin cool-grey cracks between them and, in a few places,
a little light brown mud showing through. Flat and calm: no rocks, no
plants, no footprints, no shadows from objects.

Style: 128 x 128 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering noise. At most 5 colours, all
low in saturation and close in brightness: warm off-white (not pure
white), pale grey, a light ridge highlight, a cool grey crack colour, one
pale brown. The polygons should be small relative to the tile (about 8 to
16 pixels across), so the texture does not look like a grid of hexagons
or tiles. Match the pixel density and restraint of the attached
references.
```

### 2. The large salt dome

```
Pixel art sprite of one large salt dome, the centrepiece of a hex-grid
tactics map, in the same style, viewpoint and outline as the attached
mountain sprite, which fills one hexagon; this dome fills seven.

Footprint: it sits on a cluster of seven flat-topped hexagons, one in the
centre and six around it (the attached outline), seen from a three-quarter
view above. Its foot follows the cluster's outer edge, and its body covers
the whole cluster. It is low and wide: much wider than it is tall, its
crown rising only a little above the cluster's back edge, so units
standing behind it stay visible.

Subject: a salt diapir, a huge rounded hill of rock salt pushed up out of
a flat white salt desert. A broad, lumpy dome whose flanks are wrinkled
and gullied by rain, with soft folded bands of white, pale grey and dusty
pink salt and a few streaks of red clay. Its crown has collapsed into a
shallow crater with jagged white rims, and a tongue of salt flows down its
front toward the viewer like a small glacier, ending in a lobe at its
foot. Small sparkling crystal faces near the top. Not a volcano, not a
snowy mountain, not a sand dune: rounded and massive, like a pale
melted-candle hill.

Style: 106 x 124 pixel art on a transparent background, shown scaled up
with hard square pixels, no anti-aliasing or gradients. At most 7
colours: off-white, pale grey, mid grey, a cool grey shadow, dusty pink,
clay red, and a dark grey-brown outline. Light from the upper left. Low
saturation so it sits on a white salt ground. Keep the detail as coarse
as the attached mountain's: large clusters of pixels, not fine texture.
```

### 3. Windcatcher (obstacle)

```
Pixel art sprite of a desert windcatcher for a hex-grid tactics game, in
the same style, size and viewpoint as the attached watchtower sprite: a
tall, narrow building standing inside one flat-topped hexagon, seen from a
three-quarter view above, its base no wider than about 24 of its 34
pixels.

Subject: the windcatcher tower of an old Persian desert water cistern. A
square tower of sun-dried mudbrick, taller than it is wide, with tall
narrow vent slots in its upper part (dark openings separated by brick
fins) and a flat top with a small parapet. Under the vents, one band of
turquoise glazed tile with a simple geometric pattern. At the tower's
foot, the low rounded mudbrick dome of the cistern, and a little rubble.
The silhouette, a tall slotted tower beside a low dome, should read at a
glance. No people, no flags, no plants.

Style: 34 x 46 pixel art on a transparent background, shown scaled up
with hard square pixels, no anti-aliasing or gradients. At most 7
colours: three ochre mudbrick browns, a dark vent shadow, turquoise and a
darker teal for the tile, and a dark earth outline. Light from the upper
left. Match the outline and level of detail of the attached watchtower.
```

### 4. Later: soft crust (hazard, not planned yet)

Only if the owner wants a hazard here; kept for when one is wanted.

```
Pixel art terrain overlay for one flat-topped hexagon of a salt-flat map,
top-down, same style and palette as the salt crust texture: a patch where
the white salt crust has cracked open and sagged into dark, wet grey-brown
mud, with broken plates of crust tilted at its edges and a sheen of brine
in the middle. Readable as "unsafe ground" by shape, not only colour.
42 x 36 pixels, transparent outside the hexagon, at most 5 colours, hard
pixels.
```

## Building it

When the art is in, as the Flaming Mountains were built:

1. `SALT` in map.ts: `{...STEPPE, id: 'salt', name: 'The Salt Flats'}`,
   its `tiles` the centre and its six neighbours as `mountain` in place of
   the Steppe's yurt places, `mountains: 'never'` (none rolled: the dome
   is fixed), `obstacles: {counts: [1], reach: 3}`, added to `MAPS`.
2. The windcatcher's roll in `randomTiles`: exactly 3 from the centre
   (not within it, as the yurts are), off the starting columns and the
   spaces next to the camel's start and the exit.
3. A `LOOKS` entry: the salt crust as the ground field, the dome drawn
   once for its seven spaces (a new case: every mountain so far is a
   sprite per hex), in the units' draw order by its front row, the
   windcatcher as the obstacle, the glints in code.
4. `MAP_TILE_INFO.salt` in info.ts: Salt flat, Salt dome, Windcatcher.
5. Shown on the test stage (`"map": "salt"`) until Persia's stages exist.
6. Watch the camel's walk round the dome in a few fights (the AI already
   scores the camel by its walk, `roadDistance`, not a straight line).

## Later

- **A hazard:** the soft crust (prompt 4), on entry Immobilizing or
  dealing 1, once a region's fights are played and the board wants one.
- **Oasis gardens** ([setting.md](setting.md), 15.3b) as Persia's second
  map, and the **Alborz** for its last or boss stage.

## Open questions

- Whether a split board plays well: ranged heroes lose the middle, and a
  flank can stall. Play-test on the test stage, and measure if it matters
  ([balance.md](balance.md)).
- One windcatcher or one on each flank (9 spaces covered, over the cap),
  if a flank without one feels empty.
- Whether the salt is bright enough to read as salt yet dim enough for the
  units, the ivory labels and hail.
- Whether the windcatcher's turquoise is the region's accent across its
  maps (setting.md's palette says turquoise tile).
