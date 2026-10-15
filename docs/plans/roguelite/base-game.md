# Roguelite: base game design

> Part of the roguelite plan — start at [README.md](README.md), which has
> the status, the next step and an index of every decision.

## Base game design: open questions (answer before level design)

The multiplayer design above is settled; the base game's design isn't.
These questions came up on 2026-10-13 before any level design started.
Each has a suggested default, not yet confirmed by the owner. Record
answers here (replace "Suggested" with "Decided (owner, date)"), then move
on to level design. 1–3 matter most; they shape the rest.

Constraints to keep in mind while answering:
- **No camera in the engine.** Games render to a fixed canvas (600×400 by
  default, `packages/web/src/pages/GamePage.tsx`); nothing in
  `packages/engine/src` scrolls or follows a player. A level larger than
  the screen needs a camera system built first.
- **Touch play.** The arcade supports touch (Pointer Events, swipe keys);
  levels and controls must work on a phone.
- **Free plan budget** (see [architecture.md](architecture.md#long-lived-storage-and-cost)): ~10 ms CPU per
  action for enemy and ghost AI, level generation within a similar
  budget, and ~100,000 actions a day across all players.
- **Untimed turns** (D1), **one ghost per level, fixed spawn points**
  (D8), **seeded generation stored with the run** (D3).

### Must answer before designing levels

1. **Run length and win condition.** A final depth (e.g. 15 levels and a
   boss) or endless? Sets the difficulty curve, the number of ghost pools,
   and what a good run means. *Suggested: a fixed depth with a final boss
   — every run has a goal, and a winning run's ghost is a natural legend.*
2. **What stops a player resting forever.** With untimed turns a player
   could wait to full health before every fight, or camp a ghost spawn
   point. Roguelikes use an in-game clock (hunger, limited healing,
   enemies that keep arriving). *Suggested: no health regeneration from
   waiting; healing comes from items and the between-levels screen.*
3. **Map size and the screen.** One screen per level, or larger with a
   camera (engine work)? *Suggested: one screen per level, about 30×20
   tiles; add a camera only if levels feel cramped.*
4. **Map structure.** Rooms and corridors, caves, hand-made room pieces
   stitched together, or a mix by depth? Decides where spawn points and the
   door can go. *Suggested: rooms and corridors first; themes later.*
5. **Movement and turns.** Four or eight directions? One action per turn
   for everyone, or speed (faster creatures act more often)? *Suggested:
   eight directions, one action per turn; speed later if combat needs it.*
6. **Vision.** How far the player sees, whether explored tiles stay
   visible, whether the ghost can be seen before it sees you. *Suggested:
   line-of-sight with a radius; remembered tiles shown greyed.*
7. **The exit door.** Always reachable? Visible from the start or found by
   exploring? Can it be locked (key, cleared room)? Can a player rush past
   everything? *Suggested: always reachable, found by exploring; rushing is
   allowed but forgoes loot.*
8. **Ghost spawn points** (fixed points are decided, D8). How many per
   level and how far from the start and the door; whether the ghost
   appears at once, after some turns, or when a region is entered; whether
   the player is warned; what happens if the player stands on the chosen
   point; whether the ghost hunts or guards. *Suggested: 2–3 points, away
   from the start; the ghost appears after a set number of turns at the
   point furthest from the player, with a warning ("a ghost stirs…"), then
   hunts.*

### Shape a level's content; can be roughed in

9. **Combat.** Melee only, or ranged and spells? Ranged needs a
   line-of-sight model and changes how corridors and rooms play.
10. **What a level contains.** Enemy counts by depth, items, traps, secret
    areas.
11. **Between levels.** Healing only, a shop, level-up choices? Decides how
    much healing and loot a level must provide.
12. **Ghost strength.** A depth-n ghost comes from a run that cleared n but
    may be unusually strong or weak. Scale ghosts towards a target for the
    depth, or use them exactly as built? Affects the ghost AI and balance.
    Prior art: the snapshot-battle roguelites (Super Auto Pets, Backpack
    Battles, The Bazaar) match on rank or record as well as round, so new
    players don't meet veteran builds; Nioh scales revenants to the level
    they're found at. Options here: scale towards a depth target, or pick
    candidates closer to the player's own strength (needs a strength
    score per ghost), or both.

### Can wait

Tuning: ghost chance per level, legend threshold N, pool sizes, the exact
`RunSystem` shape. Cosmetics and the unlock list, provided unlocks stay
options rather than power (D9).
