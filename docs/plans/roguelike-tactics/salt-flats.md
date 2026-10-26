# Roguelike tactics: the Salt Flats, Persia's map

The Persia region's first map: a salt desert of white crust with large
salt domes standing out of it, its rules, its look, and the prompts for
making its art in ChatGPT.

> Part of the roguelike tactics plan. Start at [README.md](README.md).
> The region and its biome are in [setting.md](setting.md) (15.3a,
> 15.3b); how the other maps are drawn is in
> [art-direction.md](art-direction.md).

Everything here is **Proposed** (2026-10-26, from the owner's brief: "the
salt flats, but should feature large salt domes"). Nothing is built.

## The place

The Dasht-e Kavir, the Great Salt Desert of the Iranian plateau, which the
Khorasan road skirted ([setting.md](setting.md), 15.3b). Its crust
dries into polygons of raised salt ridges a hand to a metre across, white
to grey over brown mud. Through it rise **salt domes** (diapirs): salt
pushed up from below into round, hummocky hills, banded white, grey and
dusty pink with red clay, some with a crown collapsed into a crater or
salt flowing down a flank like a glacier. The Kavir's basin has dozens of
them. They give the board its landmark, as the burning ridges give the
Flaming Mountains theirs, and they read as Persia's because no other
region's ground is white.

In the game's text the place stays unnamed (owner, 2026-10-26: the setting
shows only in the art): the map is **The Salt Flats**, its tiles **Salt
flat**, **Salt dome** and **Windcatcher**.

## The board

The Steppe's board (`STEPPE` in map.ts), as every map so far:

| | The Salt Flats | Why |
|---|---|---|
| Open ground (`sand`) | **Salt flat** | No effect, as the Steppe's grass and China's red earth |
| Mountains (`mountain`) | **Salt domes**, in every fight (`mountains: 'always'`) | The brief's large salt domes; blocks movement and arrows as every mountain does |
| Where they stand | **Three or four domes standing alone**, in the middle, no two side by side (a new `mountainPlaces: 'scattered'`) | Each map gets its own shape: the Steppe a range on the edge, China three ridges across the middle, Persia single hills. Lone domes break lines of fire without walling a lane, so the board plays as open ground with cover, which suits a salt flat and gives the Horse Archer and the Bow something different from China |
| Obstacle (`obstacle`) | **One or two windcatchers** within 3 of the centre, not next to a dome | The roofline that reads as Persia at a glance, as the tiled pavilion roof reads as China: the slotted tower of a desert cistern (*ab anbar*) |
| Covered | At most 8 spaces (`MAX_COVERED`): four domes and two windcatchers cover 6 | As the Flaming Mountains |
| Hazard | None at first | The setting's hazard, a crust over mud that gives way, is a candidate only. China's fissures were tried and taken out (owner, 2026-10-26), so the map starts without one; see Later |

Domes stay off the starting columns, the camel's middle column and the
spaces next to each other, as the Flaming Mountains' pairs do; the board
must stay connected (`connectedWithout`).

**Large, one to a space.** The owner took out art spanning several spaces
in China (it was "the only thing on the board spanning spaces"), so a dome
is one sprite in one hex, made large by height: its base fills the hex's
lower half as the mountains' do, and its round top rises over the hex
behind, about 46 pixels tall against the Steppe peak's 43 and the ridge's
39. Drawn after the units, as mountains are, so it stands in front of a
unit behind it.

**Two domes, not one mirrored.** A mirrored sprite turns its light the
wrong way (the burning cone, 2026-10-26), so there are two drawings, each
dome picking one: a **round dome**, and a **broken dome** with a collapsed
crater crown and a tongue of salt flowing down its front.

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
- **Salt domes:** `tiles/salt-dome.png`, two frames side by side, 42 wide
  and about 46 tall, standing on the salt itself (no rock under them, as
  the ridges stand on red earth), in 6 colours taken from the salt's own
  shades plus a dusty pink and a clay red for the bands, lit from the
  upper left as the Steppe's peaks are, outlined in a dark grey-brown
  rather than ink, so it blends with the ground.
- **What moves:** a few **salt crystals glinting** on each dome, a single
  bright pixel growing to a small cross and fading, in 4 frames at 3 a
  second (the fire's pace, `FLAME_FPS`), each dome out of step, held on
  the first frame for reduced motion. Drawn in code, as the yurts' smoke
  is, so the sprites stay still.
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
  nearest-neighbour so the model sees the pixels.
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

### 2. Salt dome, round

```
Pixel art sprite of a single large salt dome for a hex-grid tactics game,
in the same style, size and viewpoint as the attached mountain sprite:
seen from a three-quarter view above, its base fitting the lower half of
a flat-topped hexagon (flat along the bottom, out to the hexagon's two
side corners), its rounded top rising well above the hexagon.

Subject: a salt diapir, a rounded hill of rock salt pushed up out of a
white salt flat. A broad, slightly lumpy dome, wider than it is tall, its
flanks wrinkled and gullied by rain, with soft horizontal and folded
bands of white, pale grey and dusty pink salt, a few streaks of red clay,
small sparkling crystal faces near the top. Not a volcano, not a snowy
mountain, not a sand dune: rounded and massive, like a pale melted-candle
hill.

Style: 42 x 46 pixel art on a transparent background, shown scaled up
with hard square pixels, no anti-aliasing or gradients. At most 6
colours: off-white, pale grey, mid grey, dusty pink, clay red, and a dark
grey-brown outline. Light from the upper left. Low saturation so it sits
on a white salt ground. Match the outline weight and level of detail of
the attached mountain.
```

### 3. Salt dome, broken

```
Same style, size, viewpoint, palette and lighting as the previous salt
dome, as its companion sprite (the two will stand on the same board).

Subject: a second salt dome, a different shape: its crown has collapsed
into a shallow crater with jagged white rims, and a tongue of salt flows
down its front flank toward the viewer like a small glacier, ending in a
lobe on the salt flat at its base. Folded bands of white, grey and dusty
pink salt show in the crater's walls. Lit from the upper left, like the
first; do not mirror it.

42 x 46 pixels, transparent background, at most 6 colours, hard pixels,
no anti-aliasing.
```

### 4. Windcatcher (obstacle)

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

### 5. Later: soft crust (hazard, not planned yet)

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

1. `SALT` in map.ts: `{...STEPPE, id: 'salt', name: 'The Salt Flats',
   mountains: 'always', mountainPlaces: 'scattered', obstacles: {counts:
   [1, 2], reach: 3}}`, added to `MAPS`.
2. `'scattered'` in `randomTiles`: three or four domes within the middle
   columns, off the starting columns and the middle column, no two next to
   each other, rolled after the windcatchers and within `MAX_COVERED`.
3. A `LOOKS` entry: the salt crust as the ground field, the two domes
   picked per hex, the windcatcher as the obstacle, the glints in code.
4. `MAP_TILE_INFO.salt` in info.ts: Salt flat, Salt dome, Windcatcher.
5. Shown on the test stage (`"map": "salt"`) until Persia's stages exist.

## Later

- **A hazard:** the soft crust (prompt 5), on entry Immobilizing or
  dealing 1, once a region's fights are played and the board wants one.
- **Oasis gardens** ([setting.md](setting.md), 15.3b) as Persia's second
  map, and the **Alborz** for its last or boss stage.

## Open questions

- Whether three or four lone domes, or pairs as China's, play better:
  play-test on the test stage, and measure if it matters
  ([balance.md](balance.md)).
- Whether the salt is bright enough to read as salt yet dim enough for the
  units, the ivory labels and hail.
- Whether the windcatcher's turquoise is the region's accent across its
  maps (setting.md's palette says turquoise tile).
