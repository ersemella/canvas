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
- **Hex size follows.** The 9 × 7 board (8 columns × 9 rows since 2026-10-20, drawn at hex size 42; [phase-1-brief.md](phase-1-brief.md),
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
- **Tile types** (obstacle, hazard, conceal; 6.4) each get a distinct
  shape, not only a distinct colour: quicksand and sandstorm must read
  apart on a sand board.

## Palette (Proposed)

- **One fixed palette** of about **24–32 colours** across every culture.
  Cultures ([setting.md](setting.md)) differ by shapes, costume and accent
  colours from the shared palette, so twelve cultures still look like one
  game.
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
- The palette itself, and the three team rim colours.
- Who makes the art: owner, commission or AI-assisted.
- Pixel font, or full-resolution text above the scene.
