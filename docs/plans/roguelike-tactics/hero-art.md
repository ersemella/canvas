# Roguelike tactics: the heroes' full-screen art

Prompts for a large, detailed picture of each of the twelve heroes, for
the start menu's full-screen hero view on a phone (`HeroView` in
`packages/web/src/pages/tactics/StartMenu.tsx`), which shows the board
sprite scaled up until this art exists.

> Part of the roguelike tactics plan. Start at [README.md](README.md).
> The board sprites' and portraits' prompts, and the style they follow,
> are in [art-direction.md](art-direction.md).

**Built (2026-10-28) for all twelve heroes.** The owner's first five tries (the Grappler,
the Vanguard, a swordsman, the Storm Caller, the Barbarian) came out in
five styles: a pixel grid from about 40 to about 250 art pixels across,
outlines thick on one and missing on another, rim light on some, one on
white rather than magenta, one with a purple shadow. The Grappler's is
the closest to the game. What follows keeps them alike.

## How to keep them consistent

1. **One style block, word for word.** Every prompt is the style block
   below plus one hero's subject. Change only the subject.
2. **A style anchor.** Make the Grappler first (prompt 1; attach the
   owner's Grappler try as a start). Once one comes back that you like,
   it is the **anchor**: attach it to every later prompt as the style to
   copy. When two or three more are done and alike, attach those too.
3. **The hero's own sprite and portrait**, scaled up 8× with
   nearest-neighbour, attached with each prompt, so the costume, colours
   and weapon match what the player sees on the board:
   ```
   python3 -c "from PIL import Image; import sys; i=Image.open(sys.argv[1]); f=i.height; i.crop((0,0,f,f)).resize((f*8,f*8),Image.NEAREST).save(sys.argv[2])" packages/games/silk-road-run/src/client/sprites/bokh.png bokh-ref.png
   ```
   (the sprite sheet's first frame; for the portrait, the same without
   the crop).
4. **A new chat for each hero**, with the anchor attached. A long chat
   drifts, each picture a little further from the first, and earlier
   heroes' costumes bleed into later ones. Fixes to one hero ("If it
   comes back wrong", below) stay in that hero's chat.
5. **The same grid afterwards.** ChatGPT's pixels only look like pixels.
   Run every result through `scripts/shrink-sprite.py` at the same size,
   which snaps it to a true grid, a clean 1-pixel outline and a small
   palette, so even two tries at slightly different densities end up
   alike:
   ```
   python3 scripts/shrink-sprite.py chatgpt.png bokh-art.png 128
   ```

## The style block

Already in every hero's prompt below, unchanged; here on its own for
reference:

```
Style: detailed pixel art on a 128 x 128 grid, shown scaled up with every
art pixel a hard, even square block (8 x 8 on a 1024 x 1024 image): no
anti-aliasing, no gradients, no blur, no dithering, no rim light or glow.
A 1-pixel dark brown-black outline all the way round the silhouette, and
dark lines inside it only where forms overlap. Light from the upper left,
two or three flat shades per colour, at most 32 colours in all. Warm,
saturated colours as in the attached references; no light blue except
where the subject says so. The same chunky, readable look as the attached
style reference: a 16-bit console game's character art, not a painting.

Framing: one full-length figure, facing right, in a three-quarter view
from slightly above, as the attached sprite. The figure fills the square,
its height about 85% of the frame, its feet on the same line near the
bottom with about 6% of the frame free below them, centred left to right.
Under the feet a flat dark grey (#444444) oval shadow, with no other
colour in it. Flat magenta (#FF00FF) background filling the frame, with no
other magenta anywhere in the picture. One figure only: no text, no
border, no ground, no scenery, no second pose.
```

## The heroes

Each prompt is complete, the style block already in it: paste the whole
block into a new chat. Attach the anchor (once you have it) and that
hero's sprite and portrait. Every
hero is in an action pose with its signature weapon or gift, the one its
ability uses, and matches its board sprite's costume and colours.

### 1. The Grappler (`bokh`)

```
Detailed pixel art character illustration for a tactics game, matching
the attached sprite and portrait. Subject: a champion steppe wrestler of
the festival games, a broad, heavy, powerful man. Bare chest and belly.
A short open-fronted red jacket with long sleeves, covering only the arms
and shoulders, its sleeves patterned in pale salmon bands. Small blue
wrestling briefs. Tall black boots with upturned toes and red stitched
bands. Black hair, short on top, the sides shaved. A wrestler's crouch,
knees bent wide, both arms reaching forward with open hands to seize an
opponent, eyes fixed ahead.

Style: detailed pixel art on a 128 x 128 grid, shown scaled up with every
art pixel a hard, even square block (8 x 8 on a 1024 x 1024 image): no
anti-aliasing, no gradients, no blur, no dithering, no rim light or glow.
A 1-pixel dark brown-black outline all the way round the silhouette, and
dark lines inside it only where forms overlap. Light from the upper left,
two or three flat shades per colour, at most 32 colours in all. Warm,
saturated colours as in the attached references; no light blue except
where the subject says so. The same chunky, readable look as the attached
style reference: a 16-bit console game's character art, not a painting.

Framing: one full-length figure, facing right, in a three-quarter view
from slightly above, as the attached sprite. The figure fills the square,
its height about 85% of the frame, its feet on the same line near the
bottom with about 6% of the frame free below them, centred left to right.
Under the feet a flat dark grey (#444444) oval shadow, with no other
colour in it. Flat magenta (#FF00FF) background filling the frame, with no
other magenta anywhere in the picture. One figure only: no text, no
border, no ground, no scenery, no second pose.
```

### 2. The Outrider (`mangudai`)

```
Detailed pixel art character illustration for a tactics game, matching
the attached sprite and portrait. Subject: a steppe horse archer at full
gallop on a small, stocky brown pony with a dark mane. The rider wears a
dark green padded coat with brown fur trim, and a pointed grey cap with a
cream fur brim; dark beard, dark eyes. Twisting in the saddle, he draws a
short dark recurved composite bow to the right, an arrow nocked; a quiver
at the hip. The horse and rider together fill the frame, the horse's legs
mid-stride.

Style: detailed pixel art on a 128 x 128 grid, shown scaled up with every
art pixel a hard, even square block (8 x 8 on a 1024 x 1024 image): no
anti-aliasing, no gradients, no blur, no dithering, no rim light or glow.
A 1-pixel dark brown-black outline all the way round the silhouette, and
dark lines inside it only where forms overlap. Light from the upper left,
two or three flat shades per colour, at most 32 colours in all. Warm,
saturated colours as in the attached references; no light blue except
where the subject says so. The same chunky, readable look as the attached
style reference: a 16-bit console game's character art, not a painting.

Framing: one full-length figure, facing right, in a three-quarter view
from slightly above, as the attached sprite. The figure fills the square,
its height about 85% of the frame, its feet on the same line near the
bottom with about 6% of the frame free below them, centred left to right.
Under the feet a flat dark grey (#444444) oval shadow, with no other
colour in it. Flat magenta (#FF00FF) background filling the frame, with no
other magenta anywhere in the picture. One figure only: no text, no
border, no ground, no scenery, no second pose.
```

### 3. The Storm Caller (`storm`)

```
Detailed pixel art character illustration for a tactics game, matching
the attached sprite and portrait. Subject: a steppe weather worker who
commands storms, a bearded man in a long teal robe with wide cream lapels
and cream cuffs, a brown sash, brown boots, and a tall white felt hat
with a dark brown upturned brim. His right arm is raised high, holding a
smooth white rain stone, with white and very pale blue wind swirling
round it and round his arm; his left hand points down and forward at the
ground, as if bringing down hail. Stern, intent face.

Style: detailed pixel art on a 128 x 128 grid, shown scaled up with every
art pixel a hard, even square block (8 x 8 on a 1024 x 1024 image): no
anti-aliasing, no gradients, no blur, no dithering, no rim light or glow.
A 1-pixel dark brown-black outline all the way round the silhouette, and
dark lines inside it only where forms overlap. Light from the upper left,
two or three flat shades per colour, at most 32 colours in all. Warm,
saturated colours as in the attached references; no light blue except
where the subject says so. The same chunky, readable look as the attached
style reference: a 16-bit console game's character art, not a painting.

Framing: one full-length figure, facing right, in a three-quarter view
from slightly above, as the attached sprite. The figure fills the square,
its height about 85% of the frame, its feet on the same line near the
bottom with about 6% of the frame free below them, centred left to right.
Under the feet a flat dark grey (#444444) oval shadow, with no other
colour in it. Flat magenta (#FF00FF) background filling the frame, with no
other magenta anywhere in the picture. One figure only: no text, no
border, no ground, no scenery, no second pose.
```

### 4. The Vanguard (`modao`)

```
Detailed pixel art character illustration for a tactics game, matching
the attached sprite and portrait. Subject: an armoured spearhead
infantryman of an imperial Chinese army (Tang dynasty). Dark iron
lamellar armour trimmed in gold, two round gold discs on the chest, gold
shoulder guards, a red sash and red cloth showing below the armour skirt,
armoured boots. A rounded iron helmet with a gold rim and a red plume.
Short dark beard. Feet planted wide, he holds a long two-handed blade on a
pole (a modao) diagonally up and forward to the right, ready to cut
through the line.

Style: detailed pixel art on a 128 x 128 grid, shown scaled up with every
art pixel a hard, even square block (8 x 8 on a 1024 x 1024 image): no
anti-aliasing, no gradients, no blur, no dithering, no rim light or glow.
A 1-pixel dark brown-black outline all the way round the silhouette, and
dark lines inside it only where forms overlap. Light from the upper left,
two or three flat shades per colour, at most 32 colours in all. Warm,
saturated colours as in the attached references; no light blue except
where the subject says so. The same chunky, readable look as the attached
style reference: a 16-bit console game's character art, not a painting.

Framing: one full-length figure, facing right, in a three-quarter view
from slightly above, as the attached sprite. The figure fills the square,
its height about 85% of the frame, its feet on the same line near the
bottom with about 6% of the frame free below them, centred left to right.
Under the feet a flat dark grey (#444444) oval shadow, with no other
colour in it. Flat magenta (#FF00FF) background filling the frame, with no
other magenta anywhere in the picture. One figure only: no text, no
border, no ground, no scenery, no second pose.
```

### 5. The Duelist (`youxia`)

```
Detailed pixel art character illustration for a tactics game, matching
the attached sprite and portrait. Subject: a wandering Chinese
knight-errant, lean and quick. A wide, shallow conical straw hat shading
the eyes. A loose slate-blue robe crossed at the chest, belted with a
brown sash, over pale trousers bound into dark wrapped boots. In the right
hand a straight double-edged sword (a jian) held low and level across the
body, the empty scabbard in the left hand behind. A low, balanced fencing
stance, weight forward, about to strike.

Style: detailed pixel art on a 128 x 128 grid, shown scaled up with every
art pixel a hard, even square block (8 x 8 on a 1024 x 1024 image): no
anti-aliasing, no gradients, no blur, no dithering, no rim light or glow.
A 1-pixel dark brown-black outline all the way round the silhouette, and
dark lines inside it only where forms overlap. Light from the upper left,
two or three flat shades per colour, at most 32 colours in all. Warm,
saturated colours as in the attached references; no light blue except
where the subject says so. The same chunky, readable look as the attached
style reference: a 16-bit console game's character art, not a painting.

Framing: one full-length figure, facing right, in a three-quarter view
from slightly above, as the attached sprite. The figure fills the square,
its height about 85% of the frame, its feet on the same line near the
bottom with about 6% of the frame free below them, centred left to right.
Under the feet a flat dark grey (#444444) oval shadow, with no other
colour in it. Flat magenta (#FF00FF) background filling the frame, with no
other magenta anywhere in the picture. One figure only: no text, no
border, no ground, no scenery, no second pose.
```

### 6. The Alchemist (`alchemist`)

```
Detailed pixel art character illustration for a tactics game, matching
the attached sprite and portrait. Subject: a Chinese master of elixirs, a
thin, upright man with long black hair in a topknot under a small dark
cap, a long thin moustache and goatee. A long ochre and tan robe to the
ankles, with red accents at the collar and a red sash. In his raised right
hand a small round gourd flask of elixir, its stopper out, a wisp of
amber vapour rising; more small flasks hang from his sash. Calm, knowing
expression, about to throw.

Style: detailed pixel art on a 128 x 128 grid, shown scaled up with every
art pixel a hard, even square block (8 x 8 on a 1024 x 1024 image): no
anti-aliasing, no gradients, no blur, no dithering, no rim light or glow.
A 1-pixel dark brown-black outline all the way round the silhouette, and
dark lines inside it only where forms overlap. Light from the upper left,
two or three flat shades per colour, at most 32 colours in all. Warm,
saturated colours as in the attached references; no light blue except
where the subject says so. The same chunky, readable look as the attached
style reference: a 16-bit console game's character art, not a painting.

Framing: one full-length figure, facing right, in a three-quarter view
from slightly above, as the attached sprite. The figure fills the square,
its height about 85% of the frame, its feet on the same line near the
bottom with about 6% of the frame free below them, centred left to right.
Under the feet a flat dark grey (#444444) oval shadow, with no other
colour in it. Flat magenta (#FF00FF) background filling the frame, with no
other magenta anywhere in the picture. One figure only: no text, no
border, no ground, no scenery, no second pose.
```

### 7. The Juggernaut (`mahout`)

```
Detailed pixel art character illustration for a tactics game, matching
the attached sprite and portrait. Subject: a war elephant and its driver.
A huge grey Indian elephant with small tusks, a teal caparison with gold
borders and gold ornaments on its head and back. The driver sits on its
neck behind the ears: a bearded man in a saffron turban and a teal tunic,
holding a gold-tipped goad. The elephant faces right, mid-stomp, one
foreleg raised high to crash down, trunk curled. The elephant fills the
frame from side to side, the driver near the top.

Style: detailed pixel art on a 128 x 128 grid, shown scaled up with every
art pixel a hard, even square block (8 x 8 on a 1024 x 1024 image): no
anti-aliasing, no gradients, no blur, no dithering, no rim light or glow.
A 1-pixel dark brown-black outline all the way round the silhouette, and
dark lines inside it only where forms overlap. Light from the upper left,
two or three flat shades per colour, at most 32 colours in all. Warm,
saturated colours as in the attached references; no light blue except
where the subject says so. The same chunky, readable look as the attached
style reference: a 16-bit console game's character art, not a painting.

Framing: one full-length figure, facing right, in a three-quarter view
from slightly above, as the attached sprite. The figure fills the square,
its height about 85% of the frame, its feet on the same line near the
bottom with about 6% of the frame free below them, centred left to right.
Under the feet a flat dark grey (#444444) oval shadow, with no other
colour in it. Flat magenta (#FF00FF) background filling the frame, with no
other magenta anywhere in the picture. One figure only: no text, no
border, no ground, no scenery, no second pose.
```

### 8. The Ranger (`archer`)

```
Detailed pixel art character illustration for a tactics game, matching
the attached sprite and portrait. Subject: a Persian foot archer of late
antiquity (Sasanian era), lean and young, a short dark beard and narrow
moustache. A knee-length crimson tunic belted at the waist, loose ochre
trousers tucked into soft brown boots, and a soft rounded indigo cap with
a red ribbon trailing behind. A quiver at the hip. Drawing a large dark
recurved composite bow to full stretch, the arrow pointing right, feet
apart, weight back, aiming a long shot.

Style: detailed pixel art on a 128 x 128 grid, shown scaled up with every
art pixel a hard, even square block (8 x 8 on a 1024 x 1024 image): no
anti-aliasing, no gradients, no blur, no dithering, no rim light or glow.
A 1-pixel dark brown-black outline all the way round the silhouette, and
dark lines inside it only where forms overlap. Light from the upper left,
two or three flat shades per colour, at most 32 colours in all. Warm,
saturated colours as in the attached references; no light blue except
where the subject says so. The same chunky, readable look as the attached
style reference: a 16-bit console game's character art, not a painting.

Framing: one full-length figure, facing right, in a three-quarter view
from slightly above, as the attached sprite. The figure fills the square,
its height about 85% of the frame, its feet on the same line near the
bottom with about 6% of the frame free below them, centred left to right.
Under the feet a flat dark grey (#444444) oval shadow, with no other
colour in it. Flat magenta (#FF00FF) background filling the frame, with no
other magenta anywhere in the picture. One figure only: no text, no
border, no ground, no scenery, no second pose.
```

### 9. The Magus (`magus`)

```
Detailed pixel art character illustration for a tactics game, matching
the attached sprite and portrait. Subject: a Persian court astrologer, an
old, dignified man with a long dark beard touched with grey, a large
cream turban. A long blue robe over a dark indigo under-robe to the
ground. In his raised hands a round gold astrolabe, held up as if reading
the stars through it, a few small pale stars glinting round it. Upright,
still, absorbed.

Style: detailed pixel art on a 128 x 128 grid, shown scaled up with every
art pixel a hard, even square block (8 x 8 on a 1024 x 1024 image): no
anti-aliasing, no gradients, no blur, no dithering, no rim light or glow.
A 1-pixel dark brown-black outline all the way round the silhouette, and
dark lines inside it only where forms overlap. Light from the upper left,
two or three flat shades per colour, at most 32 colours in all. Warm,
saturated colours as in the attached references; no light blue except
where the subject says so. The same chunky, readable look as the attached
style reference: a 16-bit console game's character art, not a painting.

Framing: one full-length figure, facing right, in a three-quarter view
from slightly above, as the attached sprite. The figure fills the square,
its height about 85% of the frame, its feet on the same line near the
bottom with about 6% of the frame free below them, centred left to right.
Under the feet a flat dark grey (#444444) oval shadow, with no other
colour in it. Flat magenta (#FF00FF) background filling the frame, with no
other magenta anywhere in the picture. One figure only: no text, no
border, no ground, no scenery, no second pose.
```

### 10. The Cataphract (`cataphract`)

```
Detailed pixel art character illustration for a tactics game, matching
the attached sprite and portrait. Subject: a Byzantine heavy cavalryman,
rider and horse alike in armour. The horse is draped to the knees in
steel scale armour edged with gold, a steel plate on its face; the rider
wears steel and gilded scale armour, a rounded steel helmet with a gold
band and a mail veil hiding the face below the eyes. Charging at full
gallop to the right, a long lance couched level and pointing forward.
Horse and rider together fill the frame.

Style: detailed pixel art on a 128 x 128 grid, shown scaled up with every
art pixel a hard, even square block (8 x 8 on a 1024 x 1024 image): no
anti-aliasing, no gradients, no blur, no dithering, no rim light or glow.
A 1-pixel dark brown-black outline all the way round the silhouette, and
dark lines inside it only where forms overlap. Light from the upper left,
two or three flat shades per colour, at most 32 colours in all. Warm,
saturated colours as in the attached references; no light blue except
where the subject says so. The same chunky, readable look as the attached
style reference: a 16-bit console game's character art, not a painting.

Framing: one full-length figure, facing right, in a three-quarter view
from slightly above, as the attached sprite. The figure fills the square,
its height about 85% of the frame, its feet on the same line near the
bottom with about 6% of the frame free below them, centred left to right.
Under the feet a flat dark grey (#444444) oval shadow, with no other
colour in it. Flat magenta (#FF00FF) background filling the frame, with no
other magenta anywhere in the picture. One figure only: no text, no
border, no ground, no scenery, no second pose.
```

### 11. The Barbarian (`varangian`)

```
Detailed pixel art character illustration for a tactics game, matching
the attached sprite and portrait. Subject: a guardsman from the far
north, sworn to the emperor: a big man with a braided blond beard and
moustache, a conical steel helmet with a nose guard, a steel mail shirt
to the thighs, a dark green cloak, brown trousers with leg wrappings and
brown boots. He swings a huge long-handled axe with a broad crescent
blade in both hands, back and across the body, about to sweep it through
everything beside him. Fierce, wide stance.

Style: detailed pixel art on a 128 x 128 grid, shown scaled up with every
art pixel a hard, even square block (8 x 8 on a 1024 x 1024 image): no
anti-aliasing, no gradients, no blur, no dithering, no rim light or glow.
A 1-pixel dark brown-black outline all the way round the silhouette, and
dark lines inside it only where forms overlap. Light from the upper left,
two or three flat shades per colour, at most 32 colours in all. Warm,
saturated colours as in the attached references; no light blue except
where the subject says so. The same chunky, readable look as the attached
style reference: a 16-bit console game's character art, not a painting.

Framing: one full-length figure, facing right, in a three-quarter view
from slightly above, as the attached sprite. The figure fills the square,
its height about 85% of the frame, its feet on the same line near the
bottom with about 6% of the frame free below them, centred left to right.
Under the feet a flat dark grey (#444444) oval shadow, with no other
colour in it. Flat magenta (#FF00FF) background filling the frame, with no
other magenta anywhere in the picture. One figure only: no text, no
border, no ground, no scenery, no second pose.
```

### 12. The Priest (`priest`)

```
Detailed pixel art character illustration for a tactics game, matching
the attached sprite and portrait. Subject: a Byzantine army priest who
walks with the soldiers to tend the wounded, a sturdy middle-aged man
with a full dark beard. A long dark brown cassock to the ankles under a
wide cream outer robe with a broad gold border, a tall dark brown
cylindrical brimless cap. In his right hand a small gold censer on a dark
chain, a thin puff of pale smoke rising; his left hand raised, palm
forward, in a blessing. No halo, icon or large cross. Calm, steady.

Style: detailed pixel art on a 128 x 128 grid, shown scaled up with every
art pixel a hard, even square block (8 x 8 on a 1024 x 1024 image): no
anti-aliasing, no gradients, no blur, no dithering, no rim light or glow.
A 1-pixel dark brown-black outline all the way round the silhouette, and
dark lines inside it only where forms overlap. Light from the upper left,
two or three flat shades per colour, at most 32 colours in all. Warm,
saturated colours as in the attached references; no light blue except
where the subject says so. The same chunky, readable look as the attached
style reference: a 16-bit console game's character art, not a painting.

Framing: one full-length figure, facing right, in a three-quarter view
from slightly above, as the attached sprite. The figure fills the square,
its height about 85% of the frame, its feet on the same line near the
bottom with about 6% of the frame free below them, centred left to right.
Under the feet a flat dark grey (#444444) oval shadow, with no other
colour in it. Flat magenta (#FF00FF) background filling the frame, with no
other magenta anywhere in the picture. One figure only: no text, no
border, no ground, no scenery, no second pose.
```

## If it comes back wrong

- **Too fine or painterly:** "Use bigger, chunkier pixels on a 128 x 128
  grid, fewer colours, flatter shading, no soft light."
- **Too coarse:** "Keep the pixel grid at 128 x 128; this is coarser than
  the reference."
- **Wrong background or shadow:** "Flat magenta (#FF00FF) background and a
  flat #444444 grey shadow, nothing else in either." `shrink-sprite.py`
  reads a purple shadow as background (the Priest's, art-direction.md).
- **Off the reference's costume:** "Match the attached sprite's costume
  and colours exactly; only add detail."
- **Facing left:** "Facing right." The view flips every hero to face left,
  as the party does in a fight.
- **Cropped:** "Show the whole figure, feet and weapon inside the frame."

## Built

**The Grappler, the Outrider and the Storm Caller (2026-10-28)**, from
the owner's art: each run through `shrink-sprite.py` at 128 as it came
(the Outrider's thin bowstring lost at size), saved as
`src/client/sprites/<hero>-art.png` (128 × 128, facing right) and listed
in `HERO_ART` beside `HERO_SPRITE` in `src/client/board/units.ts`.
`HeroView` shows it, flipped to face left, in place of the scaled-up
sprite; a hero not in `HERO_ART` still shows its sprite.

**The Vanguard, the Duelist and the Alchemist (2026-10-28)**, the same
way.

**The Juggernaut, the Ranger and the Magus (2026-10-28)**, the same way,
the Magus's astrolabe with four pixels of magenta left in its openwork
given their neighbours' colour.

**The Cataphract, the Barbarian and the Priest (2026-10-28)**, the same
way: all twelve heroes have their art. A hero added later gets its own
from the prompts above, the same way.
