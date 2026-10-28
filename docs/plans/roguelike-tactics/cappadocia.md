# Roguelike tactics: the Fairy Chimneys, the Byzantine's map

The Byzantine region's first map: a valley of Cappadocia's pale volcanic
tuff, its open ground scattered with fairy chimneys and walled along the
top by a tuff cliff cut with a rock church; its rules, its look, and the
prompts for making its art in ChatGPT.

> Part of the roguelike tactics plan. Start at [README.md](README.md).
> The region and its biome are in [setting.md](setting.md) (15.3a,
> 15.3b); how the other maps are drawn is in
> [art-direction.md](art-direction.md); the last map designed this way is
> [salt-flats.md](salt-flats.md).

Everything here is **Proposed** (2026-10-28, from the owner's brief: "start
designing the map for Byzantine"), from setting.md's Byzantine biome:
"Cappadocia's volcanic tuff: fairy chimneys as obstacles, rock-cut
churches, underground cities such as Derinkuyu". **Built** the same day
from the owner's art (see Built), **with the chimneys only** (owner,
2026-10-28: "let's just stick with the chimneys for now"): the tuff and
three fairy chimneys, no cliff, shown on the test stage.

## The place

Cappadocia, on the Anatolian plateau, which the road crossed on its way
from Persia to Constantinople. Old eruptions of Erciyes and Hasan buried
it in ash that set into soft **tuff**, pale cream, apricot and rose, under
harder caps of basalt. Rain and wind cut the tuff into valleys whose
walls are fluted and banded, and left standing what the caps protected:
the **fairy chimneys** (*peribacaları*), cones of tuff up to tens of
metres tall, each crowned with a dark stone hat, alone or in clusters of
two or three. In the Byzantine centuries people carved into all of it:
houses, dovecotes and **rock-cut churches** in the cliffs, their doorways
and arcades cut like built façades and painted inside, and below ground
**underground cities** such as Derinkuyu, sealed with rolling stone doors.
Between the rocks, vines, apricot trees and dusty scrub.

It reads as the Byzantine's because no other region's ground is pink and
cream, and no other map's obstacles are tall natural cones: the
silhouette of the chimney is what says Cappadocia at a glance, as the
pavilion roof says China and the dome says the Salt Flats.

In the game's text the place stays unnamed, as Persia's (the setting
shows only in the art): the map is **The Fairy Chimneys**, its tiles
**Tuff** (open ground), **Fairy chimney** (obstacle) and **Tuff cliff**
(mountains).

## The board

The Steppe's board (`STEPPE` in map.ts), as every map so far: the party
on the right, the enemy on the left, Humphrey walking corner to corner
through the centre (`ROUTES`).

| | The Fairy Chimneys | Why |
|---|---|---|
| Open ground (`sand`) | **Tuff** | No effect, as every map's open ground |
| Mountains (`mountain`) | **One tuff cliff along the top edge**, in every fight (`mountains: 'always'`, `mountainPlaces: 'edge'`), **3 or 4 spaces** in one range (the Steppe rolls one or two ranges of 3 to 5) | The valley wall the chimneys stand in front of, and the place for the region's rock-cut church: one space of each cliff shows a church façade, the rest plain fluted tuff. One range, not two, so the board stays open for the chimneys |
| Obstacle (`obstacle`) | **Three fairy chimneys** (`obstacles.counts` `[3]`), within 3 of the centre, off the starting columns, Humphrey's start and the exit | The map's landmark. Three, not the Gobi's two or three oases, because they are small in their space and the map's point; the Steppe's rule already keeps them off the sides |
| Covered | At most 7: the cliff's 3 or 4 and three chimneys | No more than the Salt Flats' dome; the board stays as open as the Steppe's |
| Hazard | None at first | The region's candidate is an **underground city**, a pair of shafts joined below (see Later); China's fissures and Persia's soft crust both waited, so this map starts without one too |

**How it plays.** Close to the Steppe's: the cliff along the top pushes
the fight down the board, and the three chimneys are pillars to stand
behind, each blocking a line of fire on its own space. Being one space
each, scattered, they break lines without splitting the board as the dome
does, so the region plays as the open finale after Persia's split board.

**Tall but slim.** A chimney is taller than any obstacle so far (about
a hex and a half above its space), but no wider than the beacon tower's
base, so it hides only the top of a unit in the space behind it, and it
is drawn after the units in its row, as the obstacles are
(art-direction.md), so the cap stands in front of a unit just behind it.

## The look

A `LOOKS` entry for `tuff`, built as the Salt Flats' was:

- **Ground:** `tiles/tuff.png`, a seamless tile of 128 pixels laid as one
  field, in **5 colours**: pale cream tuff, a step warmer apricot, a rose
  pink in soft bands, a warm grey for the shallow runnels and pits, and
  one dusty olive for a few clumps of scrub. Shallow wind-ripples and
  small pits rather than cracks, so it doesn't read as the salt's
  polygons, and its features **smaller than a hex** (8 to 16 pixels), so
  the ground never reads as a second grid. Hex borders a warm grey-brown,
  darker than the runnels.
- **Brightness:** between the Gobi's sand and the salt: lighter than the
  sand, warmer and a step darker than the salt, so the ivory labels and
  the units' ink outlines read on it. The rose is kept faint: madder is
  the enemy's colour, and a pink ground must not look like the enemy's
  hexes.
- **Fairy chimney:** `tiles/fairy-chimney.png`, about **34 × 56**, its
  base 24 wide so it stays inside its space, as the beacon tower's: a
  tall tapering cone of cream tuff, banded faintly in apricot and rose,
  fluted by rain, under a **dark basalt cap** a little wider than its top,
  with a small carved doorway and one or two windows, and a little rubble
  at its foot. **Two variants** in one sheet (a single cone; a twin, two
  cones sharing a base, the second shorter), mirrored on alternate
  spaces, so three on a board never look stamped. About 7 colours: three
  tuff shades, the rose, two basalt greys and a dark opening; outlined in
  ink at the cap and a dark warm brown down the cone, fading to the hex
  borders' colour at the foot, as the oasis is, so it rises out of the
  ground.
- **Tuff cliff:** `tiles/tuff-cliff.png`, two frames of **42 × ~44**, each
  drawn as the Steppe's mountains are (42 wide, the base filling the hex's
  lower half, the top free to rise over the hex behind): a plain cliff of
  fluted, banded tuff with a hard cap along its crest; and the same cliff
  with a **rock-cut church façade**, an arched doorway between two blind
  arches and a row of small windows, its inside a deep shadow with a
  touch of fresco red. One space of each range shows the church, the rest
  the plain cliff. The cliff stands on the tuff itself (no rock ground
  under it, as the salt dome stands on the salt), in the ground's own
  colours plus a cooler shadow, so it is the ground standing up.
- **What moves:** **pigeons** (Cappadocia's dovecotes), drawn in code as
  the yurts' smoke is: now and then a pigeon of 2 or 3 pixels flies out of
  a chimney's window, circles and returns, 4 wing frames at `FLAME_FPS`,
  each chimney out of step, none for reduced motion. Optional: if it
  distracts from the units, the map is still.
- **No hot-air balloons** and nothing modern: the balloons are today's
  Cappadocia, not the road's.

## Prompts for ChatGPT

The other maps' art is the owner's, AI-assisted and then cut down on the
sprites' grid (art-direction.md, salt-flats.md): the image models don't
keep a pixel grid or a palette, so each picture is a starting point to
shrink and fix by hand. To keep the style:

- **Attach the references** with each prompt, from
  `packages/games/silk-road-run/src/client/tiles/`, scaled up 8× with
  nearest-neighbour so the model sees the pixels:
  `salt-crust.png` and `sand.png` for the ground;
  `beacon-tower.png` (its first 38 × 46 frame) and `oasis.png` (its first
  36 × 49 frame) for the chimney; `mountain-twin.png` and
  `mountain-peak.png` for the cliff.
- **Ask for one asset per image**, large and on a flat magenta
  background (#FF00FF) so it cuts out cleanly (a texture fills its
  square), then scale it down to the sizes above and fix the grid, the
  palette and the outline in Aseprite.
- If a result comes back too detailed, ask it to "halve the detail and
  use fewer, larger pixel clusters"; too saturated, "desaturate the
  terrain toward grey"; too pink, "make the rose a faint band in cream
  stone, not a pink ground".

### 1. Tuff ground (seamless)

```
Pixel art terrain texture, top-down view, seamlessly tileable on all four
edges, for a hex-grid tactics game in the style of Into the Breach.

Subject: the floor of a valley in Cappadocia, soft pale volcanic tuff
worn smooth by wind and rain. Cream stone dust with faint soft bands of
apricot and rose, shallow wind ripples, a few small pits and runnels in
warm grey, a scattering of tiny dark basalt pebbles, and three or four
small clumps of dusty olive scrub. Flat and calm: no cracks in polygons,
no rocks larger than a pebble, no paths, no footprints, no shadows from
objects.

Style: 128 x 128 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering noise. At most 5 colours, all
low in saturation and close in brightness: pale cream, warm apricot, a
faint rose, a warm grey, a dusty olive. Features small relative to the
tile (about 8 to 16 pixels across), so the texture does not look like a
grid of hexagons or tiles. Match the pixel density and restraint of the
attached references.
```

### 2. Fairy chimney (obstacle)

```
Pixel art sprite of a fairy chimney for a hex-grid tactics game, in the
same style, viewpoint and outline as the attached watchtower and oasis
sprites: a tall, slim rock standing inside one flat-topped hexagon, seen
from a three-quarter view above, its base no wider than about 24 of its
34 pixels.

Subject: a fairy chimney of Cappadocia. A tall tapering cone of soft
cream volcanic tuff, about twice as tall as it is wide, its sides fluted
by rain and faintly banded in apricot and rose, crowned by a cap of dark
grey basalt a little wider than the cone's top, like a mushroom's hat
tilted slightly. Carved into the cone, a small arched doorway near the
foot and one or two small square windows higher up, dark inside, as the
Byzantine hermits' cells were. A little fallen rubble at its foot. The
silhouette, a pale cone under a dark hat, should read at a glance. No
people, no balloons, no plants on it, nothing modern.

Style: 34 x 56 pixel art on a flat magenta (#FF00FF) background, shown
scaled up with hard square pixels, no anti-aliasing or gradients. At most
7 colours: three cream and apricot tuff shades, a faint rose, two basalt
greys, and a dark shadow for the openings. Light from the upper left. A
dark outline around the cap, a dark warm brown outline down the cone.
Match the outline and level of detail of the attached sprites.
```

Then, for the second variant, in the same conversation:

```
The same fairy chimney in the same size, style and colours, but as a
pair: two cones rising from one shared base, the left one as tall as
before, the right one about two-thirds its height and leaning slightly
away, each with its own dark basalt cap. Only the taller one has the
carved doorway. The shared base still no wider than 24 of the 34 pixels.
```

### 3. Tuff cliff (mountains)

```
Pixel art sprite of a cliff section for a hex-grid tactics map, in the
same style, size, viewpoint and outline as the attached mountain sprite,
which fills one flat-topped hexagon: 42 pixels wide, its base filling the
lower half of the hexagon, its top rising above it.

Subject: a piece of a Cappadocian valley wall. A steep cliff of soft
cream volcanic tuff, its face cut into vertical rain-flutes and rounded
ribs, banded faintly in apricot and rose, under a thin harder cap along
its crest that overhangs a little. Its foot spreads into pale talus.
Neighbouring sprites of the same cliff stand side by side, so its left
and right edges should be similar in height and could join a neighbour.
No people, no plants, nothing modern.

Style: 42 x 44 pixel art on a flat magenta (#FF00FF) background, shown
scaled up with hard square pixels, no anti-aliasing or gradients. At most
6 colours: three tuff shades, a faint rose, a cool shadow, and a dark warm
brown outline. Light from the upper left. Keep the detail as coarse as
the attached mountain's: large clusters of pixels, not fine texture.
```

Then, in the same conversation:

```
The same cliff section, same size, colours and edges, with a Byzantine
rock-cut church carved into its face: an arched doorway in the middle
between two shallow blind arches, a row of three small arched windows
above, all cut straight into the tuff like a built façade, their insides
in deep shadow with a small touch of faded red fresco visible through the
doorway. Everything else unchanged.
```

### 4. Later: underground city (hazard, not planned yet)

Only if the owner wants a hazard here; kept for when one is wanted.

```
Pixel art terrain overlay for one flat-topped hexagon of a Cappadocian
tuff map, seen from a three-quarter view above, same style and palette
as the tuff texture: the entrance to an underground city cut down into
the soft cream rock, a dark square shaft with worn steps going down
inside it, and beside it a great round stone door like a millstone, half
rolled aside in its groove. Readable as "a way down" by shape, not only
colour. 42 x 36 pixels, magenta (#FF00FF) outside the hexagon, at most 6
colours, hard pixels.
```

## Built (2026-10-28)

From the owner's tuff and fairy chimney (AI-assisted, from prompts 1 and
2), cut by `scripts/cappadocia-art.py`:

- **Rules** (map.ts): `TUFF`, the Steppe's board with no mountains
  (`mountains: 'never'`) and **three fairy chimneys** a fight
  (`obstacles.counts` `[3]`), within 3 of the centre, as the Steppe's
  yurts are placed. The page names the tiles Tuff and Fairy chimney
  (info.ts). No stage is fought there yet: the Byzantine has no stages.
- **The tuff** (`tiles/tuff.png`): the picture was drawn on a grid of
  about 128, so it is cut to 128, seamless, in **7 colours** picked from
  it (cream, apricot, rose, the runnels' warm grey, the basalt pebbles
  and the scrub's two olives): a palette worked out from the picture
  merged the few scrub pixels into the pebbles' grey. Hex borders
  `#967868`.
- **The fairy chimney** (`tiles/fairy-chimney.png`, **30 × 55**): cut out
  of its magenta, 28 wide, each pixel the colour most of its block is in
  9 of its own colours (k-means; a median cut turned the cap's greys
  brown), the picture's own outline replaced by one in dark warm brown
  fading to the hex borders' colour at its foot. Its cap is the
  picture's grey-brown. One variant, unmirrored; the twin waits.
- **The test stage** (`test-stage.json`) is on the Fairy Chimneys, its
  units unchanged (the One-Eyed Giant and two wolves).

Still to do: the twin chimney, the pigeons if wanted, and the cliff if
the owner brings it back.

## Later

- **The underground city** (prompt 4): two shafts on the board, joined
  below; a unit entering one comes up at the other at the start of its
  next turn, unseen in between, as Derinkuyu's tunnels ran between
  villages. A new rule, so only once the region's fights are played and
  the board wants one.
- **The Taurus passes** (the Cilician Gates) as the region's second map,
  and **Constantinople** (the Theodosian Walls or the Golden Horn's
  shore, cypress and olive, the sea's blue) for the final boss
  ([setting.md](setting.md), 15.3b).

## Open questions

- The map's name: **The Fairy Chimneys** (proposed), or **The Tuff
  Valley**, or a name for the place as in Persia's.
- ~~Whether the cliff belongs on this map~~: the chimneys alone for now
  (owner, 2026-10-28); the cliff's prompts are kept above.
- Whether three chimneys is enough to read as Cappadocia, or a cluster
  (two or three in neighbouring spaces) reads better than three apart.
- Whether the rose in the tuff reads too close to the enemy's madder on
  the board.
- Whether the pigeons help or distract.
