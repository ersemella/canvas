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
  day; it has no region now. **The Flaming Mountains**
  (`flaming`, owner, 2026-10-26) are the China region's map: the red
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
  as if they shook (owner, 2026-10-26). The mountains stand not along an
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
  unused) and one or two fissures, a hazard burning 1 on each entry. The flames are only drawn: the mountains block as any do; a
  fire hazard waits for the region's boss ([setting.md](setting.md), the
  Bull Demon King's fire mountain). The page calls the tiles Red earth,
  Beacon tower and Flaming Mountains. Every stage of a run is still the
  Steppe's (`STAGES` in config.ts); the test stage's `"map"` shows the
  Flaming Mountains.
- **The Salt Flats** (`salt`, proposed 2026-10-26, not built), Persia's
  map: a salt crust, large salt domes standing alone as its mountains and
  windcatchers as its obstacle; its look and the prompts for its art are
  in [salt-flats.md](salt-flats.md).
- **Tile types** (obstacle, hazard, conceal; 6.4) each get a distinct
  shape, not only a distinct colour: quicksand and sandstorm must read
  apart on a sand board.

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
