# Roguelike tactics: art direction

The visual style: Into the Breach's readable pixel art applied to the
Silk Road, what the engine needs to draw it, and the art budget.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. This file has no combat-design section number.

## Style target (Proposed)

- **Into the Breach's look, Silk Road subject matter.** Small sprites, a
  limited palette, strong silhouettes, and a code-drawn overlay that
  explains the board. The style is simple because it is disciplined, not
  because it is cheap: a strict style guide is what holds it together.
- **Readability comes first** ([goals.md](goals.md)). Every unit must be
  identifiable by silhouette alone, and its state (health, statuses,
  flanked) must be readable without tapping it.

## Rendering (Proposed)

- **Low internal resolution, whole-number scale.** The scene is drawn at
  **300×200** and scaled **2×** to the 600×400 canvas
  (`packages/web/src/pages/GamePage.tsx`), with
  `imageSmoothingEnabled = false` and CSS `image-rendering: pixelated`.
  Non-integer scales make pixels uneven, so the art size is fixed by this
  choice: settle it before drawing anything.
- **Hex size follows.** Since 2026-10-24 the board is a hexagon of flat-top hexes, nine columns of size 42 across, 73 pixels tall each ([phase-1-brief.md](phase-1-brief.md), question 9). Before it: the 9 × 7 board (8 columns × 9 rows since 2026-10-20, drawn at hex size 42; [phase-1-brief.md](phase-1-brief.md),
  question 9) gives hexes about **32 art pixels** wide, roughly Into the
  Breach's tile size.
- **Phones.** When the canvas shrinks below 600 pixels, either use the
  largest whole-number scale that fits and add margins, or accept slight
  blur. TBD; test on a real phone.
- **Text** uses a pixel font drawn at the same scale, or is drawn at full
  resolution above the scaled scene if small pixel text proves unreadable.

## Board and units (Proposed)

- **Flat hexes, three-quarter units.** Into the Breach uses an isometric
  square grid; isometric hexes are awkward to draw and hard to read.
  Hexes are seen from directly above, with a thin darker lower edge for
  depth. Units are drawn in a three-quarter view, standing on their hex.
- **No elevation** ([map.md](map.md), 6.4), so tiles need no height
  variants.
- **The Steppe's ground** (owner, 2026-10-24): the board was sand and
  sandstone ruins, a desert, while every stage built is in the Steppe
  region ([setting.md](setting.md), 15.3a). The ground is now steppe
  grass (`tiles/grass-soft.png`: the owner's `tiles/grass.png` with its
  blotches pulled 40% towards the base olive and a touch greener, since
  at full contrast it read as mud on a phone, and a flat field with
  sparse tufts felt too plain; owner, 2026-10-24). Yurts (gers) replaced the ruins (owner,
  2026-10-24): `tiles/yurt.png`, 32 × 24 art pixels, redrawn on the
  sprites' grid from the owner's art (AI-assisted, about twice that
  size), in its colours: felt walls and roof, a blue eave band, ropes, an
  orange door; its outline soft (owner, 2026-10-24), each edge pixel a
  darker shade of the colour inside it, darkest along the foot. Smoke rises
  from its crown in code (`drawYurtSmoke`): square puffs that grow, drift
  and fade, stepped at 8 frames a second, each yurt out of step, held
  still for reduced motion. The ruins' art, a crumbling
  mudbrick wall (`tiles/ruins.png`) and a tower stump
  (`tiles/ruins-tower.png`), stays for a later region; mountains (`tiles/mountain-peak.png` and `mountain-twin.png`, the
  owner's, drawn for the flat-top hex: 42 wide, the base filling the hex's
  lower half; each mountain hex picks one; cut to 6 colours with an outline
  so they keep the other sprites' level of detail) stand on
  rocky ground of their own (`tiles/rock.png`, the owner's, a seamless
  103-pixel tile laid across the board like the grass), drawn
  at 2× like every sprite: their base inside the hex, their peaks free to
  rise over the hexes beyond, in front of a unit standing there (drawn
  after the units, before health and statuses) (rules in `randomTiles`, map.ts); boulders and gers were tried and felt out of place (gers came back as the yurts, 2026-10-24).
  Both are the owner's (AI-assisted, 2026-10-24). The grass is a 64×64
  seamless tile laid across the board as one field (a pattern from the
  board's origin), not stamped per hex. The `sand`
  tile keeps its name in the rules (it is open ground, shown as Grass);
  `tiles/sand.png` stays for a desert region's ground.
- **A look per map** (2026-10-25): each map (`MAPS` in map.ts) draws in
  a look of its own (`LOOKS` in `ground.ts`): its ground, what its
  `obstacle` tile is, and whether that smokes; mountains stand on rock
  everywhere. **The Gobi Crossing** (`gobi`), the China region's way in
  from the steppe ([setting.md](setting.md), 15.3a), brings back the
  desert board's art: `tiles/sand.png` stamped centred on each hex and
  mirrored on alternate hexes, as it was before the grass, hex borders in
  `sandDark`, and in place of the yurts the desert board's own ruin, a
  crumbling sandstone wall (`tiles/ruins-sandstone.png`, the `ruins.png`
  of 2026-10-22, before the mudbrick one; the owner's call, 2026-10-25:
  the mudbrick wall and tower stump, drawn on the grass, read as the
  Steppe's), with no smoke. There are no mountains (`MapData.mountains`;
  the owner's call, 2026-10-25), even on a stage that always has them, so
  more ruins break up the board: four or five a fight, within 3 hexes of
  the centre (`MapData.obstacles`; owner, 2026-10-25), where the Steppe
  has two or three yurts within 2. The page calls them Ruins, and the open ground
  Gravel (`tileInfo` in info.ts). The Gobi's desert was kept for the
  Arabia region (owner, 2026-10-26) until that region was cut the same
  day. **The Gobi is China's map again** (owner, 2026-10-28), renamed the
  Gobi Desert, in place of the Flaming Mountains: the same sand, no
  mountains and two or three obstacles (owner, 2026-10-28; four or five before), which are now **oases** in place
  of the ruins, combined with the Flaming Mountains' beacon tower (owner,
  2026-10-28): from the owner's art (AI-assisted, from the prompt below),
  a beacon tower on the bank of a spring pool with poplars, reeds and
  rocks round it, as at Dunhuang's oases, in 4 frames, its pennant
  flying and its water glinting. It is cut to the grid
  (`tiles/oasis.png`, 36 × 49 a frame, `scripts/oasis-sheet.py`), 36 wide
  so the island stays in its space: each art pixel the colour most of its
  block is, in one 24-colour palette for all four frames (an average
  blurred the roof and the poplars), with a dark outline. The frames were
  drawn apart, so their rocks and reeds differ; all but the pennant and
  the water come from one frame, so only those move, at `FLAME_FPS`.
  Blended into the map (owner, 2026-10-28): its colours taken 15% of the
  way to the Gobi's sand at the top and 35% at the island's foot, the
  near-blacks lifted, and the outline fading from ink to the hex borders'
  colour (`sandDark`) down the island, so it sits in the ground. It
  rises over the space behind, as the tower did. Its roof is only a few
  pixels at this size; the owner kept it so (2026-10-28) over a sprite
  composed by hand from the beacon tower's own pixels on an island, which
  kept a crisp roof. The page calls it Oasis, blocking as any obstacle, and the open
  ground Sand. Two date palms over a pool, drawn in code, stood there for
  a few hours first. The prompt: a pixel-art Han beacon tower (banded
  rammed earth, a grey tiled pavilion roof with upswept corners, red
  posts and pennant) on the bank of a small spring pool with poplars or
  tamarisk and reeds, a transparent background, 608 × 736. **The Flaming Mountains**
  (`flaming`, owner, 2026-10-26) were the China region's map until then,
  kept for saved runs and the test stage: the red
  sandstone ridges near Turpan, set alight as in *Journey to the West*.
  All the art is the owner's (AI-assisted), cut to the sprites' grid: a
  cracked red earth (`tiles/red-earth.png`, 128 pixels, 5 colours, laid
  as one field like the grass); under the mountains, the Steppe's rock
  (`tiles/rock-red.png`) recoloured in the burning mountain's own five
  browns by its shades, as on the red earth the corners of a mountain's
  hex beside its peak looked left unfilled (owner, 2026-10-26); and, until
  the ridges below replaced it the same day, the owner's
  burning mountain (`tiles/mountain-burning.png`, 42 × 48, every mountain
  the same way round: mirrored on some hexes, a clump's peaks and light
  leaned both ways, which looked off; owner, 2026-10-26): red rock cliffs
  with the fire running up the ridges, drawn as one image, its rock cut to
  5 colours with an ink outline and its fire to 4, each pixel taken as
  rock or fire by what most of it was; its rock then taken halfway to the
  red earth's browns, the orange it takes from the fire kept, and the
  outline's lower half dark earth rather than ink, as at first, redder and
  outlined, it didn't blend with the ground (owner, 2026-10-26). Its
  base, drawn as a diamond, is warped to the hex's lower half, flat along
  the bottom and out to the side corners, as the diamond didn't fit the
  hex. Its fire burns in 8 frames at 8 a second (`mountainFrames`,
  `FLAME_FPS`), each mountain out of step, held on the first for reduced
  motion: only the flames above the base change, a brightness rising up
  them, their tips flickering and three embers rising from the peak; the
  rock and the glowing cracks low on it never change (owner, 2026-10-26).
  It replaced gullied sandstone
  ridges with flames added on their crests: a separate flame per crest
  read as a lid on the peak, then animated frames made the mountains look
  as if they shook (owner, 2026-10-26). **Redesigned (owner,
  2026-10-28)**, the same day, to **no mountains at all**: four or five
  small patches of scorched ground, one or two spaces each, spread over
  the board (`scorchedPatches` in map.ts, a `scorched` tile), off the
  starting columns and Temee's road, with one beacon tower. The ridge
  art below stays as the look's mountains but no fight has any. Before
  that, from the owner's photo of the real Flaming Mountains, a
  long gullied red escarpment over a flat plain, the mountains stood in
  the middle in **one or two side-by-side pairs** (`MIDDLE_CLUMP.count`:
  2; three before; for a few hours the same day they stood as ridges
  along the board's rim instead, then went back to the middle, owner),
  with **one beacon tower** (`obstacles.counts`: `[1]`), and the open
  spaces beside them are **scorched ground** (`scorched` in map.ts,
  `RULES.scorch`), burning 1 on a unit Moved onto it or ending its turn
  there, not on one walking across, and Temee steps round it where a step
  as near is. It is the owner's scorched earth (AI-assisted, from the
  prompt below; `tiles/scorched-earth.png`, `Look.scorchedGround`),
  charred plates with glowing cracks, cut to 128 pixels (box-averaged
  from the picture) and 6 colours, its soot and plates lifted towards the
  red earth's own browns and its ash warmed, so it reads as the same
  ground burnt (owner, 2026-10-28), laid as one field like the red earth
  on the scorched spaces only. It replaced char and embers drawn in code
  over the red earth, which didn't read as scorched at a glance (owner,
  2026-10-28). With it, the ridges in the red earth's browns looked out of
  place (owner, 2026-10-28), so the ridge was recoloured in the scorched
  earth's own colours, its gullies glowing like its cracks, its flat base
  cut away below the rubble at its foot, and the ground under the
  mountains (`mountainGround`) made the scorched earth too, so each ridge
  rises out of the scorched ground. The ridge art
  (`tiles/mountain-ridge.png`, 42 × 39 a frame, 8 frames) was redrawn
  after the photo on the Steppe mountains' base: a flat, toothed crest in
  dark red, its face cut by gullies fanning down from it, each rib lit on
  its left and shadowed on its right, pale talus mounds at its foot; set
  alight as in the myth (owner, 2026-10-28), the tops of its gullies glow
  and fire burns along the whole crest, flames 1 to 5 pixels in waves with
  tongues and embers, the rock never changing. What follows is the design
  before. The mountains stood not along an
  edge, as the Steppe's, but in **three pairs**, each side by side in neighbouring columns,
  never one above the other, so each reads as one ridge running across
  the board (owner, 2026-10-26; two clumps of 2 to 4 before, which
  stacked ridges one above another, and two or three clumps at first;
  with the mountains kept to the two columns either side of the middle, a
  pair is the most that fits side by side), in the middle
  of the board (`MapData.mountainPlaces`: `'middle'`, `middleClumps` in
  map.ts; owner, 2026-10-26), off the starting columns and Temee's road,
  in every fight (`MapData.mountains`: `'always'`), with one or two Han
  **beacon towers** (owner, 2026-10-26) as the map's obstacle: the
  rammed-earth watchtowers of the Hexi Corridor, as at Yumen Pass, so the
  board reads as China's rather than as a volcanic desert. They stand
  within 3 of the centre, not next to a mountain or each other, and the
  mountains and towers together cover **at most 8 spaces** (`MAX_COVERED`
  in map.ts: the towers are rolled first and leave the mountains room: three pairs
  and two towers cover 8). The
  tower (`tiles/beacon-tower.png`, 38 × 46 a frame, its base 24 wide so it
  stays inside its space (28 before, which reached past it; owner,
  2026-10-26), two rows clear above the finial and three columns either
  side, so the pennant isn't cut off
  at the sprite's edge; its pennant flies in 4 frames at the fire's pace,
  `Look.obstacleFrames`). Obstacles are drawn after the units, as the mountains are, so a
  tower stands in front of a unit in the space behind it (drawn before
  them, the tower's top sat under that unit; owner, 2026-10-26); damage
  numbers are drawn after both is the owner's (AI-assisted),
  redrawn by hand on the sprites' grid, as shrinking it left the roof a
  dark blob: rammed earth in reed-layered bands under a watch pavilion
  with a grey tiled roof whose corners sweep up, red posts and a red
  pennant, the roofline being what reads as China at a glance (a plain
  rammed-earth tower read as any desert's). Its earth is in the red
  earth's own browns, a little lighter, chipped at the edges, with rubble
  at its foot and a dark-earth outline below the roof, as pale and
  ink-outlined it didn't blend in (owner, 2026-10-26). No smoke, which
  would rise from the roof. **The mountains are burning ridges** (owner,
  2026-10-26), as the real Flaming Mountains are long, low, gullied
  ridges and the burning cone read as a volcano. The ridge
  (`tiles/mountain-ridge.png`, 42 × 39 a frame) is made from the
  Steppe's twin peak, so it is drawn as the other mountains are and fits
  its hex the same way: its base, the hex's lower half, unchanged, its
  peaks lowered to 0.65 of their height into two low humps, its six
  shades the red earth's own colours and its hex border's, so it blends
  with the ground (redder, then in browns near the ground's, it stood
  out; owner, 2026-10-26), standing on the red earth itself. Only its
  fire moves, in 8 frames at 3 a second (`FLAME_FPS`; 8 a second at
  first, quicker than the units' idles; owner, 2026-10-26): flames 1 to 5
  pixels tall along the crest in waves, a tongue flaring every few
  pixels, embers rising. Tried first the same day and replaced (owner):
  the owner's ridge (AI-assisted), wider than its hex, which looked out
  of place where neighbouring ridges didn't join and whose 1 to 2 pixel
  flames looked still; then ridges drawn in code, one continuous
  landform per clump, which were too detailed and the only thing on the
  board spanning spaces. The cone (`mountain-burning.png`) and the Steppe's rock in
  red browns (`rock-red.png`) are no longer used. Tried before
  and taken out, as they didn't look good (owner, 2026-10-26): two or
  three mudbrick ruins (`tiles/ruins.png`, as the ruins of Gaochang, now
  unused) and one or two fissures, a hazard burning 1 on each entry. The flames are only drawn: the mountains block as any do; the
  fire hazard waited for the region's boss ([setting.md](setting.md), the
  Bull Demon King's fire mountain), and came with it (2026-10-28;
  [enemies.md](enemies.md), 11.3b): on `fireMountain`, the same red earth
  with nothing on it (owner, 2026-10-28; `ridges` before, two or three
  burning ridges she set the spaces next to alight), Princess Iron Fan
  sets a space within 3 and those next to it alight,
  drawn in code as the ground glowing orange under flickering tongues of
  flame (`drawFire` in ground.ts), and the fan she drops as an open iron
  folding fan, grey pleats under a gilt rim (`drawFan`; a small green
  leaf on a handle until her fan's redesign, owner, 2026-10-28). The page calls the tiles Red earth,
  Beacon tower and Flaming Mountains. Every stage of a run is still the
  Steppe's (`STAGES` in config.ts); the test stage's `"map"` showed the
  Flaming Mountains until the Salt Flats (below).
- **The Cyclops's cave** (`cave`, owner, 2026-10-28), the Steppe's boss
  fight: the Steppe's board on a cave's stone floor, nothing on it. The
  floor is the owner's art (AI-assisted, ChatGPT, 2026-10-28, from the
  prompt below): flat stone slabs with soft cracks, gravel between them,
  darker damp earth and two small bones, cut to a seamless 128-pixel tile
  in 6 colours (`scripts/cave-floor.py`: five of its warm grey-browns by
  k-means, the bones' pale colour kept apart; each art pixel its block's
  most common colour), the hex borders `#3a3029`. Before it, the same day,
  a floor drawn in code, worn plates whose seams, as dark as the borders
  at first, hid the grid. The page calls it Cave floor.
- **The Salt Flats** (`salt`, owner, 2026-10-26), Persia's map: the
  owner's salt crust (156 pixels, 5 colours, its cracks softened so the
  hex borders show) and one large salt dome (100 × 108, within its spaces, its colours taken most of the way to
  the crust's so it blends in) drawn once over
  the middle seven spaces, the only art on the board spanning spaces; a
  sandstone ruin stands in for its windcatcher until that art is in. The
  test stage's `"map"` shows it. Its look, how the art was cut and the
  prompts for it are in [salt-flats.md](salt-flats.md).
- **The Fairy Chimneys** (`tuff`, owner, 2026-10-28), the Byzantine's
  map: the owner's tuff (128 pixels, 7 colours, laid as one field) and
  seven or eight fairy chimneys out to the edge (three at first; 30 × 55, cones of tuff under grey-brown basalt
  caps), no mountains. The test stage's `"map"` shows it. Its look, how
  the art was cut and the prompts for it are in
  [cappadocia.md](cappadocia.md).
- **Tile types** (obstacle, hazard, conceal; 6.4) each get a distinct
  shape, not only a distinct colour: quicksand and sandstorm must read
  apart on a sand board.

## Prompts for scorched ground (2026-10-28)

The Flaming Mountains' scorched ground, which should
read as burnt at a glance (prompt 1 made `tiles/scorched-earth.png`). Like
the red earth (`tiles/red-earth.png`, 128 × 128, 5 colours, laid across
the board as one field), it is a **seamless texture**, laid the same way
on the scorched spaces only, so it must sit beside the red earth without
a seam in colour. Attach `tiles/red-earth.png` and
`tiles/mountain-ridge.png` (its first 42 × 39 frame), scaled up 8× with
nearest-neighbour, with each prompt. Cut the result to 128 × 128 and at
most 6 colours, keeping the red earth's own browns for the unburnt bits.

### 1. Scorched earth (seamless)

```
Pixel art terrain texture, top-down view, seamlessly tileable on all four
edges, for a hex-grid tactics game in the style of Into the Breach. It
sits next to the attached red earth texture and must look like the same
ground, burnt.

Subject: the red earth at the foot of a burning mountain, scorched black.
The same cracked red-brown earth as the attached texture, but most of it
charred to a dark sooty brown-black, the cracks between the plates
glowing: thin lines of hot orange, with a few brighter yellow-orange
points where the glow is strongest, as if embers are still alive in
them. A few small patches of grey ash. No flames standing up, no smoke,
no rocks, no plants.

Style: 128 x 128 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering noise. At most 6 colours: a
near-black charcoal brown, a dark burnt brown, one of the attached red
earth's mid browns, an ash grey, a glowing orange and one hot
yellow-orange for the brightest points. Charred plates about 10 to 20
pixels across, the glowing cracks 1 pixel wide, so the glow reads as a
web of lines rather than a fill. Match the pixel density and restraint
of the attached references.
```

If it comes back too busy, ask it to "halve the number of glowing cracks
and keep them 1 pixel wide"; if it reads as lava, "the ground is solid
burnt earth, only the cracks glow".

### 2. Optional: the glowing edge

If one texture on every scorched space looks too uniform, a second, a
hex-sized stamp drawn over it on the side facing the ridge, can make the
fire's side hotter:

```
Pixel art overlay on a transparent background, 42 x 36 pixels: one
flat-topped hexagon seen from above, filled only along its top edge with
glowing embers and orange-hot cracks fading out by its middle, as if the
burning mountain just beyond that edge is heating the ground. The rest
of the hexagon fully transparent. Same palette and pixel style as the
scorched earth texture. Hard square pixels, no anti-aliasing.
```

## Prompts for the Archer (2026-10-27)

**Built from the owner's art (2026-10-27):** the sprite shrunk to
32 × 32, the whole bow inside the frame (the body filling it at first,
then a little smaller, owner), the bow traced back in from the art where
shrinking broke it, the face (cap, eye, beard) redrawn by hand, and a
2-frame idle split at the knees (`--split 25`) so the bow moves with the
body; the portrait cropped to the face with the bow behind, cut to 14
colours, the cap's felt smoothed into a few tones and the eye put back by
hand. **Its cap indigo** (owner, 2026-10-28), on the sprite and the
portrait, since in cream the three Persians' portraits read alike (the
Elephant Rider's turban went saffron for the same reason). A second
portrait and sprite head in a tall pointed crimson cap with a brown band
and a moustache were tried the day before and dropped for this (owner).
The prompts it came from:

The Archer (roster.md) played as a lettered disc (`archer` in
`HERO_COLOR`) until then. Like the other heroes' art, it
starts as the owner's AI-assisted picture, cut down by hand to the
sprites' grid and palette: a **32 × 32** board sprite facing right, split
into the 2-frame idle by `scripts/idle-sheet.py` (64 × 32 in all, as
`magus.png` and `youxia.png`), and a **32 × 32** portrait for the track
(`archer.png` and `archer-portrait.png` in `src/client/sprites/`).

- **Attach the references** with each prompt, scaled up 8× with
  nearest-neighbour: `youxia.png` and `magus.png` (a hero on foot) for the
  sprite; `magus-portrait.png` and `youxia-portrait.png` for the portrait.
- **One asset per image**, large, on a flat magenta background (#FF00FF),
  so it cuts out cleanly.
- If it comes back too detailed, ask it to "halve the detail and use
  fewer, larger pixel clusters"; if the bow is lost at size, "make the bow
  bigger and darker, a thick dark curve against the body".

### 1. Board sprite

```
Pixel art sprite of a single character for a hex-grid tactics game, in the
exact style, size, viewpoint and dark outline of the attached sprites.

Subject: a Persian foot archer of late antiquity (Sasanian era). A lean
standing figure in a knee-length crimson tunic belted at the waist, loose
ochre trousers tucked into soft boots, and a rounded off-white felt cap with
two short ribbons fluttering behind the head. A quiver of arrows hangs at
the hip. In both hands, held forward and ready, a large dark recurved
composite bow, an arrow nocked, pointing right. Calm, confident stance, feet
apart, weight back, as if about to loose a long shot.

Framing: full body, facing right, three-quarter view from slightly above,
as the attached sprites. The figure fills a 32 x 32 pixel frame with about
2 pixels free on each side; the bow must stay readable at that size.

Style: 32 x 32 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering. A dark brown-black outline all
round, chunky clusters, at most 12 colours. Saturated costume colours
(crimson, ochre, off-white, dark wood) so it stands out on pale ground; no
light blue, which the game keeps for its targeting overlay. A small soft
grey oval shadow under the feet. Flat magenta (#FF00FF) background. One
sprite only, no text, no frame, no extra poses.
```

### 2. Track portrait

```
Pixel art portrait for a tactics game's turn-order track, in the exact
style, size and dark outline of the attached portraits.

Subject: the same Persian foot archer: a lean young face with a short dark
beard and a narrow moustache, dark eyes looking right along an arrow, a
rounded off-white felt cap with a ribbon trailing behind, a crimson tunic
at the shoulders. The upper limb of a dark recurved bow and the fletching
of a drawn arrow show at the right edge.

Framing: head and shoulders, facing right in three-quarter view, the face
in the middle of the frame and large, the cap touching the top edge, cropped
at the shoulders, as the attached portraits.

Style: 32 x 32 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering, a dark outline, at most 14
colours, warm skin tones as in the references. Flat magenta (#FF00FF)
background. One portrait only, no text, no border.
```

## Prompts for the One-Eyed Giant (2026-10-28)

**Built from the owner's art (2026-10-28):** the sprite shrunk to
44 × 44 with `shrink-sprite.py`, its eye redrawn by hand (3 × 2, the
pupil looking right) since shrinking lost it, and a 2-frame idle split at
row 33; the portrait cropped to the face (`--crop 380,120,1254,994
--lines 0.5`). The prompts it came from:

The Steppe's boss (enemies.md, 11.3a), a lettered disc (`giant` in
`HERO_COLOR`) until its art came. A **44 × 44** board sprite facing right,
the Juggernaut's frame, so it outsizes the heroes and rises above its hex,
split into the 2-frame idle by `scripts/idle-sheet.py` (88 × 44 in all);
and a **32 × 32** track portrait (`giant.png` and `giant-portrait.png` in
`src/client/sprites/`). The board draws its facing as an eye on its hex's
edge, so the sprite's own eye only needs to read as one big eye.

- **Attach the references**, scaled up 8× with nearest-neighbour:
  `mahout.png` (the 44 × 44 frame) and `bokh.png` (a Steppe figure on
  foot) for the sprite; `bokh-portrait.png` and `mahout-portrait.png`
  for the portrait.
- One asset per image, on flat magenta (#FF00FF), as the Archer's.
- If the eye is lost at size: "make the single eye much bigger, white
  with a black pupil, the brightest thing on the sprite".

### 1. Board sprite

```
Pixel art sprite of a single creature for a hex-grid tactics game, in the
exact style, viewpoint and dark outline of the attached sprites.

Subject: a hulking one-eyed giant from the folk tales of the Central Asian
steppe. Huge stooped shoulders and long thick arms, a big belly, short
bowed legs. A single large round eye in the middle of the forehead, white
with a black pupil, under one heavy brow; a wide mouth with tusk-like
teeth, wild black hair and a ragged beard. Weathered grey-olive skin.
Dressed in crudely stitched sheepskins with the fleece showing, a rope
belt, bare forearms and bare feet. In its right hand a huge knotted wooden
club resting on its shoulder; in its left hand a rough grey boulder held
low, ready to throw. Menacing, heavy stance.

Framing: full body, facing right, three-quarter view from slightly above,
as the attached sprites. The figure fills a 44 x 44 pixel frame with about
2 pixels free on each side, clearly bigger and bulkier than a human hero.

Style: 44 x 44 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering. A dark brown-black outline all
round, chunky clusters, at most 14 colours. Earthy colours (grey-olive
skin, cream and brown fleece, dark wood, stone grey) so it stands out on
grass and sand; no red, which the game keeps for the enemy's rug, and no
light blue, kept for targeting. A small soft grey oval shadow under the
feet. Flat magenta (#FF00FF) background. One sprite only, no text, no
frame, no extra poses.
```

### 2. Track portrait

```
Pixel art portrait for a tactics game's turn-order track, in the exact
style, size and dark outline of the attached portraits.

Subject: the same one-eyed giant: a huge brutish face with a single large
round eye in the middle of the forehead, white with a black pupil, glaring
right; one heavy brow, a broad flat nose, a wide mouth with tusk-like
teeth, wild black hair and a ragged beard, weathered grey-olive skin;
shaggy sheepskin at the shoulders, the knotted club's head showing behind
one shoulder.

Framing: head and shoulders, facing right in three-quarter view, the face
filling most of the frame, the hair touching the top edge, cropped at the
shoulders, as the attached portraits.

Style: 32 x 32 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering, a dark outline, at most 14
colours. Flat magenta (#FF00FF) background. One portrait only, no text,
no border.
```

## Prompts for the Priest (2026-10-28)

**Built from the owner's art (2026-10-28):** ChatGPT's shadow came back
purple, which `shrink-sprite.py` reads as background, so it was made
grey (#444444) first; the sprite shrunk to 32 × 32, the censer (lost at
size) and an eye put back by hand, the smoke taken out, and a 2-frame
idle split at row 23, the robe's hem; the portrait cropped to the face
(`--crop 130,0,1180,1050 --lines 0.3`), its censer smoke taken out. The
prompts it came from:

The Priest (roster.md), Byzantium's support, played as a lettered disc
(`priest` in `HERO_COLOR`) until then. As the Archer's: a
**32 × 32** board sprite facing right, split into the 2-frame idle by
`scripts/idle-sheet.py` (64 × 32 in all), and a **32 × 32** track portrait
(`priest.png` and `priest-portrait.png` in `src/client/sprites/`).
Keep him a role, not a saint (roster.md, 15.5): no halo of his own (the
Blessing's halo is the playback's), no icon, relic or holy figure, and no
cross large enough to be the first thing read.

- **Attach the references**, scaled up 8× with nearest-neighbour:
  `magus.png` and `alchemist.png` (robed heroes on foot) for the sprite;
  `magus-portrait.png` and `alchemist-portrait.png` for the portrait.
- One asset per image, on flat magenta (#FF00FF), as the Archer's.
- His colours: cream and gold over dark brown, apart from the Magus's
  plum and the Alchemist's teal; no red (the enemy's) and no light blue
  (targeting, and the Shield marker).
- If it comes back too detailed: "halve the detail and use fewer, larger
  pixel clusters"; if the censer is lost at size: "make the censer bigger,
  a bright gold ball on a dark chain, with a small puff of pale smoke".

### 1. Board sprite

```
Pixel art sprite of a single character for a hex-grid tactics game, in the
exact style, size, viewpoint and dark outline of the attached sprites.

Subject: a Byzantine army priest of late antiquity, a healer who walks
with the soldiers. A sturdy middle-aged man with a full dark beard, in a
long dark brown cassock to the ankles, under a wide cream outer robe with
a broad gold border at the hem and the edges, falling to the knees. A
tall dark brown cylindrical brimless cap. In his right hand, held out in
front, a small gold censer on a dark chain, a thin puff of pale smoke
rising from it; his left hand raised, palm forward, in a blessing.
Calm, steady stance, feet together.

Framing: full body, facing right, three-quarter view from slightly above,
as the attached sprites. The figure fills a 32 x 32 pixel frame with about
2 pixels free on each side; the censer must stay readable at that size.

Style: 32 x 32 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering. A dark brown-black outline all
round, chunky clusters, at most 12 colours. Cream, gold and dark brown,
with warm skin; no red and no light blue, which the game keeps for its
own markings. A small soft grey oval shadow under the feet. Flat magenta
(#FF00FF) background. One sprite only, no text, no frame, no extra poses.
```

### 2. Track portrait

```
Pixel art portrait for a tactics game's turn-order track, in the exact
style, size and dark outline of the attached portraits.

Subject: the same Byzantine army priest: a kindly, weathered face with a
full dark beard touched with grey, dark eyes looking right, a tall dark
brown cylindrical brimless cap, the cream outer robe with its broad gold
border at the shoulders. A little pale censer smoke drifting up at the
right edge.

Framing: head and shoulders, facing right in three-quarter view, the face
in the middle of the frame and large, the cap touching the top edge,
cropped at the shoulders, as the attached portraits.

Style: 32 x 32 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering, a dark outline, at most 14
colours, warm skin tones as in the references. Flat magenta (#FF00FF)
background. One portrait only, no text, no border.
```

## Prompts for the Barbarian (2026-10-28)

**Built from the owner's art (2026-10-28):** the sprite's purple shadow
painted the script's flat grey, the figure cropped square to its feet and
shrunk to 32 × 32 with `shrink-sprite.py`, its eye put back by hand (a
white pixel and a dark one under the helmet's rim), and a 2-frame idle
split at the knees (`--split 25`); the portrait cropped to the face
(`--crop 300,120,1180,1000 --lines 0.4`), two pixels of magenta fringe
inked. The prompts it came from:

The Barbarian (roster.md), Byzantium's damage hero, a Varangian guardsman,
played as a lettered disc (`varangian` in `HERO_COLOR`) until his art
came. As the Archer's: a **32 × 32** board sprite facing right, split
into the 2-frame idle by `scripts/idle-sheet.py` (64 × 32 in all), and a
**32 × 32** track portrait (`varangian.png` and `varangian-portrait.png`
in `src/client/sprites/`). Reave swipes and throws his axe, so the axe is
what must read at size; the board draws a thrown axe on its own
(`drawThrownAxes`), so the sprite always holds it.

- **Attach the references**, scaled up 8× with nearest-neighbour:
  `bokh.png` and `youxia.png` (heroes on foot) for the sprite;
  `bokh-portrait.png` and `archer-portrait.png` for the portrait.
- One asset per image, on flat magenta (#FF00FF), as the Archer's.
- His colours: steel-grey mail, a dark forest-green cloak, straw-blond
  hair and beard, dark wood and bright steel for the axe, apart from the
  Priest's cream and gold; no red (the enemy's) and no light blue
  (targeting). Gold only as a small trim: the emperor's pay.
- If it comes back too detailed: "halve the detail and use fewer, larger
  pixel clusters"; if the axe is lost at size: "make the axe head bigger,
  a broad bright steel crescent with a dark outline, on a long dark haft".

### 1. Board sprite

```
Pixel art sprite of a single character for a hex-grid tactics game, in the
exact style, size, viewpoint and dark outline of the attached sprites.

Subject: a Varangian guardsman of the Byzantine emperor, a Norse warrior
far from home. A big, broad-shouldered man with a long straw-blond beard
and braided hair, in a knee-length steel-grey mail shirt over a dark
forest-green tunic, a dark green cloak pinned at one shoulder with a small
gold brooch, a wide leather belt, dark trousers wrapped at the shins and
leather boots. A conical steel helmet with a nose guard. In both hands a
great two-handed axe: a long dark wooden haft and a broad bright steel
crescent blade, held across the body, blade up and forward, ready to
swing. Heavy, grounded stance, feet wide.

Framing: full body, facing right, three-quarter view from slightly above,
as the attached sprites. The figure fills a 32 x 32 pixel frame with about
2 pixels free on each side; the whole axe stays inside the frame and must
stay readable at that size.

Style: 32 x 32 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering. A dark brown-black outline all
round, chunky clusters, at most 12 colours. Steel grey, dark forest green,
straw blond, dark wood and warm skin; no red and no light blue, which the
game keeps for its own markings. A small soft grey oval shadow under the
feet. Flat magenta (#FF00FF) background. One sprite only, no text, no
frame, no extra poses.
```

### 2. Track portrait

```
Pixel art portrait for a tactics game's turn-order track, in the exact
style, size and dark outline of the attached portraits.

Subject: the same Varangian guardsman: a weathered, fierce face with pale
eyes looking right, a long straw-blond beard in a braid, a conical steel
helmet with a nose guard, steel-grey mail at the shoulders under a dark
green cloak with a small gold brooch. The broad steel crescent of his axe
head rises behind one shoulder at the right edge.

Framing: head and shoulders, facing right in three-quarter view, the face
in the middle of the frame and large, the helmet's point touching the top
edge, cropped at the shoulders, as the attached portraits.

Style: 32 x 32 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering, a dark outline, at most 14
colours, warm skin tones as in the references. Flat magenta (#FF00FF)
background. One portrait only, no text, no border.
```

## Prompts for the Ox King and the Fan Lady (2026-10-28)

**Built from the owner's art (2026-10-28):** both shadows came back
purple, so they were painted grey (#444444) first, only near the feet as
the Fan Lady's robes are plum; the Ox King shrunk to 44 × 44 and the Fan
Lady to 32 × 32 with `shrink-sprite.py` (a mode filter first, to calm the
Ox King's scale armour, left stray red pixels, so neither has one), an eye
put back by hand on each (his gold, between dark pixels; hers dark), and
2-frame idles split at row 34 and row 24; the portraits cropped to the
head (his `--crop 250,60,1210,1020 --lines 0.4`, hers `--crop
350,150,1150,950` with no `--lines`, which buried her face in her hair),
two strands of her hair over the face painted skin. The prompts they came
from:

China's boss (enemies.md, 11.3b), two lettered discs (`oxKing` and
`fanLady` in `HERO_COLOR`) until their art came. The **Ox King** is a
boss and takes the giant's frame: a **44 × 44** board sprite facing right,
rising above its hex, split into the 2-frame idle by
`scripts/idle-sheet.py` (88 × 44 in all). The **Fan Lady** is the heroes'
size: a **32 × 32** board sprite facing right (64 × 32 with its idle). Each
has a **32 × 32** track portrait (`oxKing.png`, `oxKing-portrait.png`,
`fanLady.png` and `fanLady-portrait.png` in `src/client/sprites/`). The
two should read as a pair: the same black and gold trim on both.

- **Attach the references**, scaled up 8× with nearest-neighbour:
  `giant.png` (the 44 × 44 boss frame) and `modao.png` (China's armour)
  for the Ox King's sprite; `alchemist.png` and `youxia.png` (China's
  figures on foot, the 32 × 32 frame) for the Fan Lady's; `giant-portrait.png`,
  `modao-portrait.png` and `alchemist-portrait.png` for both portraits.
- One asset per image, on flat magenta (#FF00FF), as the others.
- No red: the game keeps it for the enemy's rug, so the Ox King's armour
  and the Fan Lady's robes are gold, black, bronze, jade and plum.
- If the fan is lost at size: "make the fan much bigger, a broad green
  leaf shape as wide as her body, the brightest green on the sprite".
- If the Ox King reads as a man in a helmet: "make the head a bull's head,
  with a broad muzzle and big curved horns, not a helmet".

### 1. The Ox King's board sprite

```
Pixel art sprite of a single creature for a hex-grid tactics game, in the
exact style, viewpoint and dark outline of the attached sprites.

Subject: a mighty demon king with the head of a bull, from Chinese myth.
A huge bull's head with a broad dark muzzle, flaring nostrils with a brass
nose ring, small fierce eyes and two great curved horns sweeping forward
and up. A massive muscular body standing upright on two legs, dark
brown-black hide. He wears ornate Chinese warlord armour: gilded scale
armour over the chest and belly, round gold shoulder guards shaped like
beast faces, a broad belt with a gold buckle, armoured skirt panels and
heavy boots, a short black cape. In both hands a long iron staff held
low across the body, ready to charge. Head lowered, horns forward, a
charging stance.

Framing: full body, facing right, three-quarter view from slightly above,
as the attached sprites. The figure fills a 44 x 44 pixel frame with about
2 pixels free on each side, clearly bigger and bulkier than a human hero,
the horns near the top edge.

Style: 44 x 44 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering. A dark brown-black outline all
round, chunky clusters, at most 14 colours. Dark hide, gold and bronze
armour, black cloth, iron grey; no red, which the game keeps for the
enemy's rug, and no light blue, kept for targeting. A small soft grey oval
shadow under the feet. Flat magenta (#FF00FF) background. One sprite
only, no text, no frame, no extra poses.
```

### 2. The Ox King's track portrait

```
Pixel art portrait for a tactics game's turn-order track, in the exact
style, size and dark outline of the attached portraits.

Subject: the same bull-headed demon king: a huge bull's head facing
right, a broad dark muzzle with a brass nose ring, small fierce eyes
glaring, two great curved horns sweeping forward and up, dark
brown-black hide; gilded armour with a gold beast-face shoulder guard at
the shoulders.

Framing: head and shoulders, facing right in three-quarter view, the head
filling most of the frame, the horns touching the top edge, cropped at
the shoulders, as the attached portraits.

Style: 32 x 32 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering, a dark outline, at most 14
colours. No red, no light blue. Flat magenta (#FF00FF) background. One
portrait only, no text, no border.
```

### 3. The Fan Lady's board sprite

```
Pixel art sprite of a single character for a hex-grid tactics game, in
the exact style, viewpoint and dark outline of the attached sprites.

Subject: a proud demon princess from Chinese myth, wife of the bull demon
king. A tall slender woman in flowing Tang-dynasty court robes of plum
purple and black with gold trim, long wide sleeves, a gold sash; black
hair piled high in an elaborate bun held with gold hairpins. In her right
hand an enormous magic fan made from a single broad green banana leaf on
a short handle, as big as her body, swept back over her shoulder ready to
blow a great gust. Her left hand raised, a small orange flame flickering
above the palm. Haughty, poised stance.

Framing: full body, facing right, three-quarter view from slightly above,
as the attached sprites. The figure fills a 32 x 32 pixel frame with about
1 pixel free on each side, the fan reaching near the top edge.

Style: 32 x 32 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering. A dark brown-black outline all
round, chunky clusters, at most 14 colours. Plum, black and gold robes, a
bright leaf-green fan, a touch of orange in the flame; no red, which the
game keeps for the enemy's rug, and no light blue, kept for targeting. A
small soft grey oval shadow under the feet. Flat magenta (#FF00FF)
background. One sprite only, no text, no frame, no extra poses.
```

### 4. The Fan Lady's track portrait

```
Pixel art portrait for a tactics game's turn-order track, in the exact
style, size and dark outline of the attached portraits.

Subject: the same demon princess: a proud, beautiful face facing right,
sharp dark eyes, pale skin, black hair piled high in a bun with gold
hairpins; plum and black robes with gold trim at the shoulders; the edge
of the great green banana-leaf fan rising behind one shoulder.

Framing: head and shoulders, facing right in three-quarter view, the face
filling most of the frame, the hair touching the top edge, cropped at the
shoulders, as the attached portraits.

Style: 32 x 32 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering, a dark outline, at most 14
colours. No red, no light blue. Flat magenta (#FF00FF) background. One
portrait only, no text, no border.
```

## Prompts for the cave floor (2026-10-28)

**Built from the owner's art (2026-10-28):** `tiles/cave-floor.png`, cut
by `scripts/cave-floor.py` from ChatGPT's 1254-pixel picture of this
prompt, which came back seamless. The prompt it came from:

The Cyclops's cave (`cave`), the Steppe's boss fight, has only its floor:
no mountains, no yurts. Like the red
earth and the tuff it is a **seamless texture** laid across the board as
one field, with the hex borders drawn over it, so its lines must stay
soft. Written for ChatGPT's image generation; optionally attach
`tiles/rock.png` and `tiles/red-earth.png`, scaled up 8× with
nearest-neighbour, as style references. Cut the result to 128 × 128 and at most 6 colours
(`scripts/cave-floor.py`).

```
Create a single square pixel-art texture tile of a cave floor, seen
straight from above, for a top-down hex-grid tactics game (style like
Into the Breach). It must tile seamlessly: its left edge continues into
its right edge and its top edge into its bottom edge, with no visible
seam, border or frame.

Subject: the floor of a one-eyed giant's cave in the hills of the Central
Asian steppe. Worn, flat bedrock and packed earth in cool grey-browns,
broken into a few large flat stone slabs with shallow cracks between
them, a scatter of small pebbles and gravel, one or two small pale bones
half buried in the dirt, and a few slightly darker damp patches. Soft
light from the top left. Completely flat ground only: no walls, no
stalagmites, no rocks standing up, no fire, no plants, no shadows of
objects, no characters, no text.

Style: true pixel art at 128 x 128 pixels, shown scaled up with hard
square pixels: no anti-aliasing, no gradients, no blur, no dithering
noise. At most 6 colours, all muted grey-browns close in value (from
about #5C554F to #8A8075). The cracks only a little darker than the
stone, never black, because a dark hex grid will be drawn on top and
must stay readable. Stone slabs about 20 to 40 pixels across. Calm and
low in contrast, so game pieces stand out on it.

Output: one square image, the texture filling the whole canvas edge to
edge.
```

If the grid gets lost in it: "halve the contrast of the cracks; they must
be lighter than a dark grid line drawn over the texture". If it comes
back as a scene with walls or depth: "flat ground only, seen from
directly above, like a floor texture in a game".

## Prompts for Princess Iron Fan's iron fan (2026-10-28)

Her fan redesigned (owner, 2026-10-28): an **iron folding fan**, as her
name says, in place of the green banana leaf she holds in `fanLady.png`
and `fanLady-portrait.png`. The fan she drops is drawn in code already,
open, grey iron pleats under a gilt rim on dark sticks and a gold rivet
(`drawFan` in ground.ts); match it. The rest of her stays as it is.
Attach her current sprite and portrait (`fanLady.png`'s first 32 × 32
frame, `fanLady-portrait.png`), scaled up 8× with nearest-neighbour,
and ask for the same figure with only the fan changed. Then split the
idle at row 24 as before (`scripts/idle-sheet.py`) and paint the shadow
grey (#444444).

- One asset per image, on flat magenta (#FF00FF).
- No red, no light blue: the iron is warm grey, its rim gold.
- If the fan is lost at size: "make the fan bigger, as wide as her
  body, with clear light and dark pleats and a bright gold rim".

### 1. Her board sprite

```
Pixel art sprite of a single character for a hex-grid tactics game. Redraw
the attached sprite exactly, same pose, robes, colours, outline and size,
changing only the fan.

The fan: a large iron war fan from Chinese myth, a folding fan opened
wide into a half circle, held in her right hand and swept back over her
shoulder ready to blow a great gust, as big as her upper body. Its leaf
is made of thin iron plates in pleats, alternating light warm grey and
dark grey, with a polished gold rim along the curved edge, dark iron
sticks meeting at a gold rivet at her hand. No green, no leaf.

Framing and style: as the attached sprite, 32 x 32 pixel art, full body,
facing right, about 1 pixel free on each side, the fan reaching near the
top edge. Hard square pixels, no anti-aliasing, no gradients, no
dithering, a dark brown-black outline, at most 14 colours. No red, no
light blue. A small soft grey oval shadow under the feet. Flat magenta
(#FF00FF) background. One sprite only, no text.
```

### 2. Her track portrait

```
Pixel art portrait for a tactics game's turn-order track. Redraw the
attached portrait exactly, same face, hair, robes, colours and size,
changing only the fan behind her shoulder: in place of the green leaf,
the edge of a great iron folding fan rising behind one shoulder, light
and dark grey iron pleats under a polished gold rim. No green.

Style: 32 x 32 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering, a dark outline, at most 14
colours. No red, no light blue. Flat magenta (#FF00FF) background. One
portrait only, no text, no border.
```

## Prompts for the Cataphract (2026-10-28)

**Built from the owner's art (2026-10-28):** the shadow came back flat
grey as asked, so no repainting; the sprite shrunk to 44 × 44 with
`shrink-sprite.py`, the Juggernaut's frame (first to a mounted 36 × 36,
as the Outrider's, where its long lance left it smaller than the Outrider;
owner: a bit bigger), and a 2-frame idle split at the saddle
(`--split 27`); the portrait cropped to the
face (`--crop 260,0,1214,954 --lines 0.6`: at 0.3 the mail's dark lines
between its scales turned the aventail black), `faceX` 17. The prompts
it came from:

The Cataphract (roster.md), Byzantium's tank, armoured heavy cavalry,
played as a lettered disc (`cataphract` in `HERO_COLOR`) until its art
comes. Mounted, as the Outrider: a **36 × 36** board sprite facing right,
split into the 2-frame idle by `scripts/idle-sheet.py` (72 × 36 in all),
and a **32 × 32** track portrait (`cataphract.png` and
`cataphract-portrait.png` in `src/client/sprites/`). It never walks, only
charges, so the couched lance and the armoured horse are what must read
at size: heavier and darker than the Outrider's light horse.

- **Attach the references**, scaled up 8× with nearest-neighbour:
  `mangudai.png` (the mounted frame) and `varangian.png` (Byzantium's
  look) for the sprite; `mangudai-portrait.png` and
  `varangian-portrait.png` for the portrait.
- One asset per image, on flat magenta (#FF00FF), as the Archer's.
- Its colours: dark iron lamellar with bronze edging, an ochre-gold
  surcoat and pennant, a dark bay horse in iron-grey scale barding, apart
  from the Barbarian's steel and green and the Priest's cream and gold;
  no red (the enemy's) and no light blue (targeting). No cross or
  religious emblem on the pennant or shield: a plain pennant.
- Ask for the shadow in flat grey (#444444): ChatGPT's purple shadows
  read as background to `shrink-sprite.py` (the Priest's, the Barbarian's).
- If it comes back too detailed: "halve the detail and use fewer, larger
  pixel clusters"; if the lance is lost at size: "make the lance a single
  bold dark line with a bright steel tip and a small ochre pennant, held
  level and pointing right"; if the horse reads as unarmoured: "cover the
  horse's chest, neck and flanks in grey scale armour down to the knees".

### 1. Board sprite

```
Pixel art sprite of a single mounted character for a hex-grid tactics
game, in the exact style, size, viewpoint and dark outline of the attached
sprites.

Subject: a Byzantine cataphract, an armoured heavy cavalryman, charging.
The rider wears a dark iron lamellar coat edged in bronze over an
ochre-gold surcoat, iron arm guards, and a rounded iron helmet with a mail
aventail hiding the neck and lower face, only the eyes showing. He holds a
long lance couched under his right arm, level and pointing straight ahead,
with a bright steel tip and a small plain ochre pennant behind it; a small
round dark shield on his left arm. The horse is a heavy dark bay
warhorse, its head, neck, chest and flanks covered in iron-grey scale
barding down to the knees, a bronze-trimmed chamfron on its face, legs and
dark hooves showing below, mid-stride in a heavy canter.

Framing: full body of horse and rider, facing right, three-quarter view
from slightly above, as the attached mounted sprite. Horse and rider fill
a 36 x 36 pixel frame with about 1 pixel free on each side; the lance tip
reaches the right edge and stays inside the frame, and must stay readable
at that size.

Style: 36 x 36 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering. A dark brown-black outline all
round, chunky clusters, at most 14 colours. Dark iron, iron grey, bronze,
ochre gold, dark bay brown and warm skin; no red and no light blue, which
the game keeps for its own markings. A small flat grey (#444444) oval
shadow under the hooves. Flat magenta (#FF00FF) background. One sprite
only, no text, no frame, no extra poses.
```

### 2. Track portrait

```
Pixel art portrait for a tactics game's turn-order track, in the exact
style, size and dark outline of the attached portraits.

Subject: the same Byzantine cataphract: a stern face with dark eyes
looking right, a short dark beard just visible, a rounded iron helmet with
a bronze rim and a mail aventail hanging at the cheeks and neck, dark
iron lamellar edged in bronze at the shoulders over an ochre-gold
surcoat. The steel tip of his lance and its small ochre pennant rise
behind one shoulder at the right edge.

Framing: head and shoulders, facing right in three-quarter view, the face
in the middle of the frame and large, the helmet's top touching the top
edge, cropped at the shoulders, as the attached portraits.

Style: 32 x 32 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering, a dark outline, at most 14
colours, warm skin tones as in the references. Flat magenta (#FF00FF)
background. One portrait only, no text, no border.
```

## Prompts for Zahhak and his serpents (2026-10-29)

Persia's boss (enemies.md, 11.3c), three lettered discs (`zahhak` and
`serpent` in `HERO_COLOR`) until their art comes. **Zahhak** is a boss
and takes the giant's frame: a **44 × 44** board sprite facing right,
rising above its hex, split into the 2-frame idle by
`scripts/idle-sheet.py` (88 × 44 in all). **The serpent** is the wolf's
size: a **36 × 36** board sprite facing right (72 × 36 with its idle);
both serpents use it. Each has a **32 × 32** track portrait
(`zahhak.png`, `zahhak-portrait.png`, `serpent.png` and
`serpent-portrait.png` in `src/client/sprites/`). The serpents on the
board are the ones on his shoulders: the same scales, so the three read
as one boss.

- **Attach the references**, scaled up 8× with nearest-neighbour:
  `giant.png` (the 44 × 44 boss frame) and `magus.png` (Persia's robes)
  for Zahhak's sprite; `wolf.png` (the 36 × 36 creature frame) for the
  serpent's; `giant-portrait.png`, `magus-portrait.png` and
  `wolf-portrait.png` for the portraits.
- One asset per image, on flat magenta (#FF00FF), as the others.
- No red (the enemy's rug) and no light blue (targeting): Zahhak in
  black, deep purple and gold; the serpents dark olive and bronze with
  pale yellow bellies. Keep his serpents' green the same as the board
  serpent's.
- If his serpents are lost at size: "make the two serpents on his
  shoulders bigger and brighter, thick green necks rising above his
  head, each with an open mouth".
- If he reads as a plain king: "the two serpents must grow out of his
  shoulders themselves, not be held or worn".
- If the serpent reads as a worm or an eel: "a thick-bodied serpent with
  a broad flat head, raised in an S-curve to strike, its mouth open".
- To shrink them: `shrink-sprite.py` to 44 and 36, paint the shadow grey
  (#444444) if it comes back purple, then split each idle with
  `idle-sheet.py`; crop the portraits to the face.

### 1. Zahhak's board sprite

```
Pixel art sprite of a single character for a hex-grid tactics game, in
the exact style, viewpoint and dark outline of the attached sprites.

Subject: Zahhak, the serpent-shouldered tyrant king of the Persian
Book of Kings (Shahnameh). A tall, gaunt king with a cruel face, a long
black beard curled in ringlets, and a tall gold crown of ancient Persia.
Two great serpents grow out of his shoulders, one from each: thick dark
olive-green scaly necks with pale yellow bellies rising above his head
and curving forward, their flat heads with open fanged mouths and forked
tongues. He wears long royal robes of black and deep purple with gold
borders, a broad gold belt, a gold collar, and a short dark cape. In one
hand a gold sceptre topped with a serpent's head; the other hand
reaching forward, clawed fingers open. Menacing, upright stance.

Framing: full body, facing right, three-quarter view from slightly
above, as the attached sprites. The figure fills a 44 x 44 pixel frame
with about 2 pixels free on each side, clearly taller than a human hero,
the serpents' heads near the top edge.

Style: 44 x 44 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering. A dark brown-black outline all
round, chunky clusters, at most 14 colours. Black, deep purple, gold,
dark olive green, pale yellow, warm skin; no red, which the game keeps
for the enemy's rug, and no light blue, kept for targeting. A small soft
grey oval shadow under the feet. Flat magenta (#FF00FF) background. One
sprite only, no text, no frame, no extra poses.
```

### 2. Zahhak's track portrait

```
Pixel art portrait for a tactics game's turn-order track, in the exact
style, size and dark outline of the attached portraits.

Subject: the same serpent-shouldered tyrant king: a gaunt, cruel face
with narrow eyes looking right, a long black beard curled in ringlets,
a tall gold crown of ancient Persia; at each shoulder a thick dark
olive-green serpent rising, pale yellow bellied, its open fanged mouth
level with his face, one either side of him; black and gold robes at the
shoulders.

Framing: head and shoulders, facing right in three-quarter view, the
face in the middle of the frame and large, the crown touching the top
edge, the two serpents' heads framing it, cropped at the shoulders, as
the attached portraits.

Style: 32 x 32 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering, a dark outline, at most 14
colours. No red, no light blue. Flat magenta (#FF00FF) background. One
portrait only, no text, no border.
```

### 3. The serpent's board sprite

```
Pixel art sprite of a single creature for a hex-grid tactics game, in
the exact style, viewpoint and dark outline of the attached sprite.

Subject: one of the two great serpents that grew from the shoulders of
Zahhak, the tyrant king of the Persian Book of Kings. A thick-bodied
serpent coiled on the ground, the front of its body raised high in an
S-curve, ready to strike. Dark olive-green scales with a darker bronze
diamond pattern down its back, a pale yellow belly, a broad flat head
with small fierce gold eyes, its mouth open to show two white fangs and
a forked dark tongue.

Framing: the whole serpent, facing right, three-quarter view from
slightly above, as the attached sprite. It fills a 36 x 36 pixel frame
with about 2 pixels free on each side, the raised head near the top
edge, the coils wide at the bottom.

Style: 36 x 36 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering. A dark brown-black outline all
round, chunky clusters, at most 10 colours. Dark olive green, bronze,
pale yellow, gold, white; no red and no light blue, which the game keeps
for its own markings. A small soft grey oval shadow under the coils.
Flat magenta (#FF00FF) background. One sprite only, no text, no frame,
no extra poses.
```

### 4. The serpent's track portrait

```
Pixel art portrait for a tactics game's turn-order track, in the exact
style, size and dark outline of the attached portraits.

Subject: the same great serpent: its broad flat head facing right, small
fierce gold eyes, mouth open to show two white fangs and a forked dark
tongue, dark olive-green scales with a bronze diamond pattern, a pale
yellow throat, its neck rising from the bottom of the frame.

Framing: the head and neck, facing right in three-quarter view, the head
filling most of the frame, cropped at the neck, as the attached
portraits.

Style: 32 x 32 pixel art shown scaled up with hard square pixels, no
anti-aliasing, no gradients, no dithering, a dark outline, at most 12
colours. No red, no light blue. Flat magenta (#FF00FF) background. One
portrait only, no text, no border.
```

## Prompts for Zahhak's palace floor (2026-10-29)

Zahhak's palace (`palace`), Persia's boss fight, has only its floor: no
dome, no mountains, no obstacles. It shows the Salt Flats' crust until
this art comes (`LOOKS.palace` in ground.ts). Like the cave floor it is
a **seamless texture** laid across the board as one field, with the hex
borders drawn over it, so its lines must stay soft, and its pattern must
not be a strong square grid, which would fight the hexes. Written for
ChatGPT's image generation; optionally attach `tiles/cave-floor.png` and
`tiles/salt-crust.png`, scaled up 8× with nearest-neighbour, as style
references. Cut the result to 128 × 128 and at most 7 colours, as
`scripts/cave-floor.py` cuts the cave's (the stone's colours by k-means,
the tiles' teal and cobalt kept apart in place of the bones' pale).

```
Create a single square pixel-art texture tile of a palace courtyard
floor, seen straight from above, for a top-down hex-grid tactics game
(style like Into the Breach). It must tile seamlessly: its left edge
continues into its right edge and its top edge into its bottom edge,
with no visible seam, border or frame.

Subject: the worn floor of an ancient Persian tyrant king's palace
courtyard. Large, irregular cream and pale ochre limestone flagstones,
old and cracked, with fragments of faded glazed tiles set between some
of them: small eight-pointed stars and crosses in dusty deep teal and
dark cobalt, many chipped or missing. A few fine grey cracks, a scatter
of grit, and two or three faint darker stains on the stone. Soft light
from the top left. Completely flat ground only: no walls, no columns, no
fountains, no plants, no rugs, no shadows of objects, no characters, no
text.

Style: true pixel art at 128 x 128 pixels, shown scaled up with hard
square pixels: no anti-aliasing, no gradients, no blur, no dithering
noise. At most 7 colours: warm creams and ochres close in value (from
about #C9B79A to #E8DCC4), with the tile fragments in muted deep teal
(about #2F5E5B) and dark cobalt (about #2E3F6B), never bright or light
blue. The cracks only a little darker than the stone, never black,
because a dark hex grid will be drawn on top and must stay readable.
Flagstones of uneven sizes, about 20 to 45 pixels across, laid in no
regular grid. Calm and low in contrast, so game pieces stand out on it.

Output: one square image, the texture filling the whole canvas edge to
edge.
```

If the grid gets lost in it: "halve the contrast of the cracks and the
tiles; they must be lighter than a dark grid line drawn over the
texture". If it comes back as a regular square tiling: "irregular
flagstones of different sizes, like an old worn floor, with no straight
lines running across the whole image". If it comes back as a scene with
walls or depth: "flat ground only, seen from directly above, like a
floor texture in a game".

## Palette (Proposed)

- **One fixed palette** of about **24–32 colours** across every culture.
  Cultures ([setting.md](setting.md)) differ by shapes, costume and accent
  colours from the shared palette, so twelve cultures still look like one
  game.
- **Each region has its own terrain colours** ([setting.md](setting.md), 15.3b): steppe grass, then sand and red earth, Persia's white salt and turquoise, and the Byzantine's tuff, sea blue and olive, all from the shared palette.
- **Units stand out from terrain.** Desert tones (sand, ochre, dust) blend
  easily, so terrain is low in saturation and narrow in brightness; units
  are saturated, with a **dark outline** and a **team-coloured rim**
  (player, enemy, rival caravan).
- Status and overlay colours are reserved: no sprite uses them.

## The overlay (Proposed)

Most of the readability is code, not art, and cheap in Canvas2D:

- hex highlights for movement range, deployment zones and line of fire
  ([map.md](map.md), 6.7);
- damage numbers and pushes previewed before an action is committed
  ([information.md](information.md));
- health pips and status icons on every unit;
- markers on hexes an area ability will hit, allies included.

Into the Breach shows enemy targets in advance; this game hides intent
(D11), so the track ([timeline.md](timeline.md)) carries that load. Its
cards use each unit's **portrait**.

## The UI's pixel look (built 2026-10-21)

The page's HTML (the action section, stat sheets, tooltips, the result,
the menu) and the canvas's overlay are drawn as the pixel art is, so the
game reads as one thing. Layout, labels and states are unchanged.

- **One palette** (`src/client/palette.ts`, `PALETTE`), 27 colours in
  ramps: dusk (the night panels and the track), sand (the board), lapis
  (everything yours: deep for your units' rugs and cards, light for your
  actions, i.e. targeting, the path, Confirm, and your names; blue is the sand's opposite, so it reads on the board, and the
  light shade still shows over your own deep hexes), madder (everything
  the enemy's: its units, charge areas, names), gold (warnings: harmful
  statuses and control abilities' icons; the acting unit's border, card
  and turn arrow), jade (health, healing), plum (ultimates,
  charging), sky (ice, hail), plus ink, the sprites' outline, and ivory
  for text. The board's overlay, the track and the page all take their
  colours from it; the page gets it as `--c-*` CSS variables. Only the
  terrain and effect art keep their own shades.
- **A pixel font**, Jersey 20, on the page and the canvas: drawn on a
  fine enough pixel grid to keep detail (accents, descenders, a distinct
  5, B and C) and solid enough to sit beside the sprites. Tiny5 was too
  coarse and Pixelify Sans's 5 read as S. It is narrow and small for its
  size, so the page's text sizes are a step up and the canvas scales its
  sizes by 1.25 (`pixelFont`). It has one weight: synthesized bold is off
  on the page, and on the canvas "bold" labels get an ink outline instead.
- **Boxes and buttons built from whole pixels** (`--px`, one art pixel,
  2px): an ink outline, square-step corners, a hard bevel (light top and
  left, shade bottom and right) and flat fills; no gradients, rounded
  corners or soft shadows. Move and the abilities, the acting unit's, are
  raised tiles in your side's deep lapis; the picked one is outlined and
  lettered in light lapis; an ultimate is plum; what can't be used now is
  a flat dusk tile. Confirm, a step brighter, is solid lapis (the blue of
  your units' hexes and cards). The stat sheet's abilities are not tiles
  but text with a dotted underline, as keywords are, so nothing but the
  action section looks like a choice of move (the phone's tooltip leaves
  out their "Abilities" label, to stay narrow). A tooltip shows a card
  each for the unit (first), the tile (unless plain sand, which says
  nothing) and any hail or fog; a keyword or ability tapped in a card is
  explained inside that card. Sunken boxes (the stats) have the shade on
  top. The track's cards and the canvas tooltips use the same cut corners
  and hard drop shadows.
- **The sides:** each unit stands on a rug filling its hex (its side's
  colour, a stitched ivory border); track portraits sit on two flat bands
  of their side's colour.

## Engine work (built 2026-10-19)

- **Sprites.** A `sprite` render type: a sprite-sheet image, frame size,
  a frame or a looping animation (`frames`, `fps`), a pivot (`{x: 0.5,
y: 1}` stands a unit on its hex), `flipX`; loaded on first use through
  `assetLoader`. Positions round to whole pixels.
- **Scaled rendering.** The manifest's `canvas: {width: 300, height: 200,
scale: 2, pixelArt: true}` draws the scene at 300×200 and scales the
  context 2× onto a 600×400 canvas, with smoothing off and CSS
  `image-rendering: pixelated`. Positions, sizes and pointer coordinates
  stay in scene pixels. The game doesn't use it yet: Phase 1 is
  code-drawn shapes, and small text at 2× is the open question below.
- Hex rendering and picking: see [architecture.md](architecture.md),
  platform constraints.

## Art budget (Proposed)

Per unit, for twelve heroes ([roster.md](roster.md)) and the enemies
([enemies.md](enemies.md)):

- a sprite of about **24×32** pixels;
- a **2-frame idle**, plus attack and hit frames;
- a **portrait** for the track.

Plus terrain sets, tile types, effects and UI icons. Options: drawn by
the owner (Aseprite is the usual tool), commissioned, or started from AI
output. AI output usually breaks the pixel grid and the palette, so it
needs cleanup by hand.

## Order of work (Proposed)

1. **Phase 1** ([phases.md](phases.md#phase-1-one-fight)) uses
   code-drawn shapes and the full overlay; no sprites.
2. Add the sprite system and scaled rendering early, before final art.
3. Write the style guide (palette, sprite sizes, outline and rim rules)
   before drawing the first hero.

## Open questions

- Internal resolution and scale (300×200 at 2× proposed), and how phones
  handle non-integer fits.
- The palette is set for the UI (above); whether sprites keep to it, and
  the rival caravan's colour, are open.
- Who makes the art: owner, commission or AI-assisted.
- Pixel font, or full-resolution text above the scene.
