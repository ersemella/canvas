# Roguelike tactics: Phase 1 brief

Everything a fresh session needs to build Phase 1 (one fight, see
[phases.md](phases.md)) without inventing its own answers: defaults for
every open rule Phase 1 touches, prototype content, the AI, the map, the
page and the API.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which has the status, the next step and an index of every decision.
> Abandoned approaches are in [history.md](history.md).

**Status: confirmed by the owner, except the prototype heroes' numbers
(section 4).** The three heroes and their abilities are the owner's
(2026-10-18); their stat numbers and ability values (damage, ranges,
areas, durations, costs) are still to be set, and a few ability details
are open (section 10). Everything else is usable as written. All
numbers are **tuning placeholders**: put them in one config module
(`packages/games/silk-road-tactics/src/rules/config.ts`) so play-testing
can change them without touching rules code. Section numbers ("3.4")
refer to the combat design (see the map in the README).

## 1. Scope

**In Phase 1:** one fight, from deployment to victory or defeat. The
track and action economy; a hex map with obstacle, hazard and
conceal tiles; flanking, line of fire, area abilities with friendly fire,
two charged abilities (the Mangudai Outrider's arcing Volley and the
Storm Caller's Freeze);
displacement; a temporary board effect (the Storm Caller's hail); the
keywords of section 3; **ultimates** (10.10, brought in 2026-10-18); the
defence formula; previews; stat sheets for every unit; previews
of enemy ability options (D11); three prototype heroes; one enemy band and its AI; the
track UI.

**Not in Phase 1:** consumables (9.6), gear rarity and
gear choices (fixed starter gear only), milestone upgrades, recruitment, the route map, recovery,
reinforcements, summons and other track entities (3.7, 3.8), Push and
the push limit, pulls (3.5), the other keywords ([keywords.md](keywords.md)), passives, elite affixes,
rival caravans. Each is a later phase's work. No Phase 1 hero pushes
cards on the track, so track control is tested later, with the Jinn
Binder.

A Phase 1 "run" is a single fight: starting a run starts the fight; the
fight's end ends the run.

## 2. Rule defaults

| Open question | Default for Phase 1 |
|---|---|
| 1. Costs and `C` | Typical action **100**, quick **60**, slow **150**; movement **10 per hex**; starting cost **100**, a typical action (owner, 2026-10-19; was 50, which bunched all six cards into slots 3 to 8); `C` = **6**. With speed 4, a typical turn lands 10 slots ahead (3.2). A card always moves at least 1 slot. |
| 2. Speed | Speed divides action and movement cost (3.2) and sets the starting slot (3.4). Speed stat 1 to 10. Armour lowers speed (4.2): see gear, below. |
| 4. Simultaneous placement | Higher speed first, then alternate sides starting with the **player's** side, then party slot order (3.3). |
| 6. Charged abilities | Two in Phase 1, both ultimates: the Mangudai Outrider's Volley (arcing area) and the Storm Caller's Freeze (section 4). |
| 39. Ultimate unlock | One value for every hero: usable after **3 completed turns** in the fight (10.10); once per fight. |
| 8. Move and act order | Move then act, or act then move; not split around the action. Every turn must include an action (5.1). |
| 28. Movement cap | **4 hexes** per turn. |
| 9. Map | Offset rectangle, **9 columns × 7 rows**, pointy-top hexes. Fits a 600-pixel-wide board beside the track panel. |
| 10. Passing through allies | Allowed (can't end on an occupied hex). Enemies block. |
| 11. Flanking effect | A flanked unit is **Vulnerable 25%** while flanked: it takes 25% more damage from every source (6.3). Every Vulnerable in Phase 1, from a flank or an ability, combines by **max** (17.2), so pin, hail and a flank don't stack. |
| 12. Hazards and conceal | Hazard (quicksand): **40 damage** on entering and at the start of each turn spent on it. Conceal (sandstorm): ranged attacks against its occupant deal **50% less**; the occupant's identity stays visible. Obstacles block movement and line of fire; conceal doesn't block line of fire. |
| 23. Defence | `defenceConstant` = **20**; minimum **1** damage from any hit. |
| 29. Line of fire along a hex border | **Blocked if either** hex on the border is occupied. |
| 30. Arcing attacks | Priced as a charged ability, with a charge cost and a recovery cost (3.7). |
| 31. Ally exemption | Not in Phase 1 (no gear choices); every ability affects allies and enemies alike (6.7, 2026-10-19). |

**Worked example:** a speed 4 hero (speed + C = 10) moving 2 hexes and
making a typical attack: (100 + 2 × 10) ÷ 10 = 12 slots ahead. A speed 7
hero doing the same: 120 ÷ 13 = 9.23, so 9 slots.

**Health and damage are on a ×10 scale** (decided): hits of tens to about
a hundred, health in the hundreds, so percentage bonuses survive rounding.

**Damage and effect formulas** (Phase 1 order; whether the general model
uses damage buckets is open, [heroes-and-gear.md](heroes-and-gear.md)):
- `damage = roundDown(base × (1 + power / 50))`, then 50% less if a
  ranged attack on a concealed target, then Vulnerable (a flank's or an
  ability's, by max), then the defence formula (9.1); minimum 1. Each step
  rounds down.
- Hazard and collision damage skip the defence formula but still take
  Vulnerable (it applies to every source).
- Several units displaced by one ability move one at a time, farthest
  from the centre first ([keywords.md](keywords.md), 17.4).
- Displace distances, Slowed, Vulnerable and every duration are fixed
  per ability, not scaled by any stat (power scales only an ability's
  base damage and base healing, so Sunlight's heal scales;
  influence was folded into power,
  [heroes-and-gear.md](heroes-and-gear.md), 9.2).

## 3. Keywords for Phase 1

The keyword vocabulary comes before heroes (10.8); the full list is in
[keywords.md](keywords.md). **Displace** moves a unit across hexes
(Push, which moves a card on the track, isn't in Phase 1).

| Keyword | Meaning |
|---|---|
| **Displace N** | Moves the target N hexes directly away from the attacker (along the hex direction from attacker to target; for an area centred on a hex, away from that centre). Stops early at an obstacle, another unit or the map edge: the displaced unit takes **20 damage**, and a unit it hits also takes 20 (ignoring defence). Entering a hazard triggers it. Doesn't move the displaced unit's card. |
| **Displace to a hex** | The Bökh Champion's Throw: the target is set down on a chosen free hex the ability names. No collision, since the hex is free; a hazard there triggers. |
| **Immobilized** | No movement, and no ability that moves the unit (Dash, Rampage). It still acts, and can still be displaced, staying Immobilized where it lands (17.5). |
| **Slowed N** | Movement cap lowered by N, to at least 1 hex (17.5). Combines by max. |
| **Vulnerable N%** | Takes N% more damage from every source (17.6). Combines by max, flanks included (section 2). |
| **Heal N** | Restores N health, up to max health; scaled by power when the ability states it (17.7). |
| **Cleanse** | Removes every harmful status applied by an ability: Immobilized, Slowed, Vulnerable (not a flank's). Already-applied displacement stays (17.8). |

Burn, Barrier, Push and On-flank are no longer in Phase 1: no Phase 1
ability uses them.

**How the track works, in one paragraph:** cards sit in numbered slots;
the track advances slot by slot and each card acts when reached. After an
action, the card moves ahead by the action's cost (plus movement) divided
by speed + C, rounded down (3.2). A card landing on a taken slot moves to
the next free one; cards already placed never move because of it (3.3).
Effects over time act at the beginning of a slot, before that slot's card
(3.9).

## 4. Prototype heroes

**Abilities: the owner's (2026-10-18).** Three heroes from the roster:
a front line, ranged with a delayed arcing area, and a support that
controls space and heals. The Kalari Duelist and Jinn Binder wait for a
later phase. Flanking is still tested, by every hero. Stat bands come
from the roster's relative profiles (15.8); their numbers, and the
values marked TBD below, are still to be set, in the config module.

| Hero | Niche | Health | Speed | Defence | Power | Signature weapon |
|---|---|---|---|---|---|---|
| **Bökh Champion** | Front line (tank): grabs, pins, throws | High | Medium | Medium | Low | Bare hands |
| **Mangudai Outrider** | Ranged in straight lines, mobility, a delayed arcing area | Low | High | Low | High | Composite bow (mounted, reflected only in stats) |
| **Yadachy Storm Caller** | Support: slows and moves enemies, heals and cleanses whoever stands near it | Medium | Medium | Medium | Medium | Rain stone and water |

"Melee" means an adjacent hex. Every hero also has **Hold** (decided): a
**30-cost** action with no effect (owner, 2026-10-19; was a quick action,
60), so a unit can always end its turn (an action is required, 5.1). A
turn that only Holds, without moving, doesn't count toward the ultimate
(10.10); a cheap Hold would otherwise unlock it in a few slots. Rules marked *(proposed)* are this brief's
reading of the owner's one-line descriptions; the owner can change them
(section 10).

**Mangudai Outrider**

| Ability | Rule |
|---|---|
| **Composite Bow** | Fires an arrow along one of the six hex directions, up to range TBD; it stops at the **first unit** on that line or at an obstacle. That unit, **ally or enemy**, takes base damage **120** (owner, 2026-10-19: two hits kill a Mangudai, four a Yadachy) (6.7, 2026-10-19), so allies still block the shot. A straight hex line replaces free-angle line of fire (6.7) for this ability. Typical cost. |
| **Dash** | Moves the Outrider **3 hexes in a straight line** along one hex direction. Hexes passed have no effect on it (quicksand doesn't trigger); the hex it ends on applies as usual. It can't pass obstacles or enemies, passes allies, must end on a free hex, and is the turn's action, so normal movement can come before or after it (confirmed 2026-10-18). Not usable while Immobilized. Quick cost. |
| **Volley** (ultimate) | An **arcing, charged** area: targets a hex within range TBD, ignoring line of fire; when the charge triggers, every unit in the area (radius TBD) takes base damage **135** (owner, 2026-10-19), allies included. Charge and recovery costs TBD (3.7). |

**Yadachy Storm Caller**

| Ability | Rule |
|---|---|
| **Sunlight** (Clear the Storm until 2026-10-19, owner) | Every **unit** within radius TBD of the caster, the caster and **enemies included** (6.7, 2026-10-19), is **healed** (base heal TBD, scaled by power) and **cleansed**. Cleansing an enemy removes the party's own control from it, so the Storm Caller steps clear of enemies first. Typical cost. |
| **Hail** | Targets a hex within range TBD; it becomes a **hail hex for TBD slots**, a temporary board effect. A unit on it when it lands, entering it, or starting its turn on it takes **base damage 50** (owner, 2026-10-19; scaled by the caster's power when cast, then Vulnerable and defence as any hit), then is **Slowed TBD** and **Vulnerable TBD%** for TBD slots. Hits any side. Any hex within its **maximum range** can be targeted, with **no line of fire** needed; not charged (owner's call, 2026-10-18; a departure from rule 30, that arcing attacks are charged, which hail's lack of damage justified; it now deals damage, so whether it stays uncharged is open). Typical cost. |
| **Gale** | Melee: **Displace 1** away and **Slowed TBD** for TBD slots. An Immobilized target is slowed but not moved. Typical cost. |
| **Freeze** (ultimate) | A **charged** area with a **casting time** (owner's call, 2026-10-18): targets any hex within maximum range TBD, no line of fire needed. When the charge triggers, every unit in the area (radius TBD), allies included, is **Immobilized** and **Vulnerable TBD%** for TBD slots. Charge and recovery costs TBD (3.7); like any charge, it shows on the track and can be answered by stepping out, pushing, killing or dazing the caster. |

**Bökh Champion**

| Ability | Rule |
|---|---|
| **Throw** | Melee: **displaces** the target **to any other free hex adjacent to the Champion**. The target takes base damage TBD (owner's call, 2026-10-18); a hazard where it lands triggers too. Typical cost. |
| **Pin** | Melee: the Champion **and** the target are **Immobilized** for TBD slots, and the target is **Vulnerable TBD%** for the same. Both still act. Typical cost. |
| **Rampage** (ultimate) | Charges **3 hexes in a straight line** along one hex direction and **completes the line**: only an **obstacle** or an **Unstoppable** unit in its path stops it early (owner's call, 2026-10-18), and the map edge ends it. Step by step, every unit in the path or adjacent to a hex the Champion enters is hit **once**: it takes base damage TBD and is **Displaced 1** away from the Champion's hex at that moment (several at once: farthest first, 17.4); collisions deal their usual damage. Allies take the damage too (6.7, 2026-10-19). *(Proposed:* a unit in the path that couldn't be displaced (a collision), or was displaced ahead, is passed through; if the last hex is occupied, the Champion ends on the last free hex it passed.) Not usable while Immobilized. Cost TBD. |

**Interactions to know** (they follow from the keyword rules, not new
rules): an Immobilized unit can still be displaced (owner's call,
2026-10-19), so the Champion's flow is **Pin, then Throw**: the target
lands where the Champion chooses, still Immobilized and Vulnerable, and
can't walk back. Frozen units can likewise be thrown, blown back or
rampaged through. A pinning Champion can't Rampage. Throw and
Gale onto quicksand (a held unit then stays in it), and Freeze triggering before Volley lands (frozen
units can't step out of the area), are the obvious combinations; the
two charges' timing on the track is what makes the second one work. Hail's and Pin's Vulnerable don't stack with each other or
a flank (max, section 2).

**Starter gear** (fixed in Phase 1; the four-slot model of 9.3 exists in
code, but only armour is filled): the Bökh Champion and Yadachy Storm
Caller wear medium armour (more defence, some speed cost); the Mangudai
Outrider wears light armour (a little defence, no speed cost). Values are
set with the stat numbers.

## 5. The enemy band

A band built from the same heroes and gear (11.1): Bökh Champion,
Mangudai Outrider and Yadachy Storm Caller, **three against your three**
(owner's call, 2026-10-18; the AI is weaker than a player, so even
numbers are still a fair first opponent). Duplicates across sides are
allowed (10.4).

## 6. Enemy AI

On each enemy unit's turn, deterministically:
1. Enumerate every reachable hex (within the movement cap), including
   staying put, and from each every legal ability and target (line of
   fire respected), including Hold.
2. Score each option with the same rules as previews: damage dealt,
   **+300** if it kills, **+100** if the target is flanked; displace counts its collision and
   hazard damage, **+50** if it breaks a flank on an ally; healing counts
   as damage; each status applied to an enemy (or removed from an ally)
   counts **+40** per point of Slowed, **+2** per slot of Immobilized and
   **+2** per Vulnerable % (tuning placeholders); the same applied to
   its own allies counts against it; minus damage to
   the AI's own allies × 1.5 (friendly fire only when clearly worth it);
   minus the slots the turn moves the card × 10, so cheap good turns win
   ties.
3. For charged abilities, score assuming targets don't move. Use an
   ultimate as soon as its option scores highest; no saving it.
4. Take the highest score; break ties by the lowest unit slot, then
   target slot, then hex index. No randomness.

About 30 hexes × 3 abilities × 4 targets, roughly 400 evaluations per
unit: well within the Free plan's 10 ms
([architecture.md](architecture.md)).

## 7. The map

One hand-made map, **"The Salt Flats Crossing"** (map generation is out of
scope), mirrored left to right like the PvP-style maps (6.6):

- **Deployment zones:** the two leftmost hexes of each row (player) and
  the two rightmost (enemy), rows 1 to 7. Odd rows have a tenth hex at
  column −1, so neither side edge is notched (owner, 2026-10-19). Five columns between them:
  contact in about one to two turns of movement (6.6).
- **Obstacles (ruins):** 4 hexes, two on each half, mirrored, breaking the
  long sight lines down the middle row.
- **Hazards (quicksand):** 2 hexes, mirrored, near the centre.
- **Conceal (sandstorm):** 2 hexes, mirrored, between the obstacles.

Exact coordinates are the builder's choice within these rules; record them
in the map's data file.

## 8. Run state and API

All requests carry the player key in an `Authorization: Bearer <key>`
header (never the URL, D4). The server stores only its SHA-256 hash.

| Route | Purpose |
|---|---|
| `POST /runs` | Start a run (and its single fight); returns the run ID and the first view. One active run per key (D3): starting another abandons it. |
| `GET /runs/:id` | The current view (resume after a reload). |
| `POST /runs/:id/deploy` | Place the party in the deployment zone; starts the clock. |
| `POST /runs/:id/turn` | One turn of the acting unit: `{move?: hex[], action: {ability, target}}`. The response contains every AI turn up to your next one (D7). |

**The view** (versioned, sent whole each time): the map; every unit's
position, health, statuses and abilities; **every unit's full stats**, enemies'
included (D11); the track (every card's
slot, charging abilities and their targets); every unit's ultimate
progress (10.10); temporary board effects (hail) and their remaining
slots; the fight's status;
the log of what the AI did since your last turn.

Previews of moves and actions are computed in the browser from the view,
including where the acting card will land after yielding, and so are
previews of each enemy's ability options (7.2). The view never carries
the run's seed or the AI's choice. The server re-validates every
turn, so a bad preview can't cause an illegal move.

## 9. The page

- **Route:** `/play/silk-road-tactics`, its own page in `@canvas/web`
  like poker's (`packages/web/src/app/router.tsx`, before the generic
  `/play/:gameId`, which only runs browser-only games). Listed on the home
  page through `platform.games.json` like every game.
- **Title: Silk Road Tactics**, on the home page, the page heading and the
  package name (`@canvas/games-silk-road-tactics`, game ID
  `silk-road-tactics`).
- **Layout:** the hex board drawn with the engine on the canvas (hex
  geometry and picking are new: the engine's grids are square); the
  **track**, the selected unit's **stat sheet**, and the **preview**
  as a side panel. Phone: board on top, track below; tap a hex or
  target to preview, tap again to commit (no hover).
- **The track is drawn as slots,** a window of roughly the next 30, and
  **scrolls** to later slots. Unit and entity cards sit in their slots
  (never two in one), so players can count placement directly (7.1). A
  charging card shows what it will trigger. Statuses (Slowed, Vulnerable, Immobilized) and ultimate progress show
  only as a small marker on a unit's card; their exact slots appear in the
  tap preview. **Tapping a card previews it:** a unit's turn (who acts and
  when, with the unit's stats and ability options, enemies included), a charged ability (its
  target and outcome), or a reinforcement (arrival and spawn hex), only as
  far as the player can know it: enemy intent stays hidden (7.1).
- **Visuals:** plain shapes and text: coloured hexes for tile types,
  circles with a letter for heroes, outline colour for side. The design
  language (open question 15) comes later.

## 10. Open for Phase 1

**Blocks Phase 1:** the prototype heroes' stat numbers and the ability
values marked TBD (section 4), for the owner to set.

**Ability details to confirm** (section 4 uses the proposed reading
until the owner says otherwise): Rampage's handling of units it passes
through and of an occupied last hex.

The rest don't block Phase 1; all are config values:
- Cost values and `C` (open question 1): the defaults aim for a typical
  turn about 10 slots ahead.
- The default size of the visible track window (roughly 30 slots).
- The fixed order for simultaneous placement (open question 4).
- Move and act order (open question 8).

## 11. As built (2026-10-19)

Phase 1 is built: `packages/games/silk-road-tactics` (rules in
`src/rules/`, `./server` exporting the `RunSystem`), `RunRoom`,
`PlayerLedger` and `/runs` in `@canvas/server`, and the page in
`@canvas/web` (`pages/tactics/`). The builder's choices, for the owner to
confirm or change:

- **Placeholder numbers.** Every hero stat and ability value marked TBD
  in section 4 has a placeholder in `src/rules/config.ts`, marked as such,
  from the roster's bands (health 300/420/540, speed 4 and 7, power
  10/25/40) so a fight can be played. Tuned once against AI-vs-AI fights
  that stalled: damage up (Bökh Champions pinned each other forever,
  since the AI's status weights outscored their small damage) and Clear
  the Storm's heal down (a Storm Caller out-healed a Champion).
- **A fight could stall** while the Storm Caller had no damaging ability:
  about 1 in 20 AI-vs-AI fights from random deployments went on forever.
  Hail now deals damage (owner, 2026-10-19), and none of 1,000 such fights
  stalled (58 before). Nothing guarantees an end. The page's **Abandon
  run** button was removed (owner, 2026-10-19), with the fight log; the
  server still keeps the log and `/runs/:id/abandon` (counts as a defeat,
  D3).
- **AI additions** (section 6): a small pull toward the nearest enemy
  (`AI.perHexFromEnemy`), or an AI with nothing in reach holds forever;
  a Hold's time is scored as if it cost 60 (`AI.holdScoringCost`), since
  at its real 30 the AI Held on 54% of its turns and 9 in 300 AI-vs-AI
  fights stalled (12% and none with it, as before the change);
  ending a move on quicksand counts its next-turn damage against the
  option; ground-targeted abilities (hail, Volley, Freeze) are tried once
  per target hex, from the cheapest hex in range. The search is capped
  in simulated options (150 per AI turn, 300 per request, at least 40
  each; owner's call), a count rather than a time so fights stay
  deterministic: over ~3,800 AI-vs-AI requests, median 1.3 ms, 99th
  percentile 5.7 ms, none above 10 ms. The AI always moves before
  acting.
- **Gale on an Immobilized target displaces it,** following the
  2026-10-19 rule (Immobilized units can be displaced) over section 4's
  older line ("slowed but not moved").
- **Dash** goes exactly 3 hexes. **Pin**, **Throw** and **Gale** target
  any adjacent unit, allies included (Pin targeted enemies only until the
  2026-10-19 rule, 6.7).
- **Abilities don't know sides** (6.7, 2026-10-19): the bow and Rampage
  damage allies, and Sunlight heals and cleanses enemies. Sunlight's
  placeholder radius went from 2 to 1 with it, so stepping clear
  of enemies is possible; the AI counts healing or cleansing an enemy
  against an option.
- **The map's coordinates** are in `src/rules/map.ts`. Odd rows reach
  column −1 (owner, 2026-10-19), which makes the board an exact
  left-right mirror; only the quicksand, placed before that, is off it by
  a hex. The enemy's placement is one of three layouts, chosen by the
  run's seed.
- **Line of fire** (rule 29) is implemented and tested, but no Phase 1
  ability needs it: the bow fires along hex lines.
- **The page** (owner, 2026-10-19): tapping or hovering a hex only shows
  what's there; a **Move** button plans the move. Pressing Move before
  choosing an action (or before its target) moves first; pressing it after
  acts first, then moves from where the action left the unit (the server's
  `actFirst`). Move stays highlighted while a move is planned, alongside
  the action; tapping it again undoes the move. The turn panel numbers the
  steps in the order they resolve, the board marks each step's hex with
  the same number, and **Swap order** flips them when the turn is legal
  either way. Order matters (owner kept it, 2026-10-19): it decides where
  the action is taken from, and the action can open, block or end the
  move (a kill, a displacement, Pin, Dash, a cleansed Slowed). One move
  per turn, not split around the action (section 2).
  The Confirm button shows the turn's total cost and the slot the card
  lands on.
- **The turn's controls** (owner, 2026-10-19, phones first, then desktop):
  the action section has no heading, hints, slot pill or summaries: the
  buttons, then the numbered steps (named only: "1 Composite Bow, 2
  Move") with Swap order, then one button to commit. There is no Hold button: with no
  action picked the button reads **End turn** and sends Hold (after the
  move, if any). Tapping a chosen target again doesn't commit; only the
  button does. The board shows the preview's outcome. Tapping anywhere but
  the board or the action section stops inspecting: the details go back
  to the unit whose turn it is. An enemy's details leave out what it could
  do next turn. A unit's name in the details is a badge in its side's
  colour (blue yours, red the enemy's), with no "yours"/"enemy" label; the
  board's hover tooltip names the hero without "Your"/"Enemy", its colour
  giving the side.
- **Timing is shown in slots from now**, never costs or absolute slot
  numbers (owner, 2026-10-19). The track, on the canvas above the board,
  is a fanned deck as in Mana Khemia (rather than section 9's window of
  slots in the side panel): a card for every slot from now on, empty ones
  blank, the current one in front at the left and each later one tucked
  behind, with no numbers; the planned turn's landing card is dashed, and
  tapping a card shows its unit's sheet. Each ability button shows how
  many slots later the next turn would come (yielding included), a
  planned move shows what it adds in the Move button ("Move +2", with the
  chosen action or Hold), and the button reads "Confirm · next turn +8".
  A unit's details list each ability in its slots too ("Composite Bow ·
  +7"): the action alone, before any move or yielding.
- **The top bar** shows Back and the page's title instead of the site
  name, for every game (owner, 2026-10-19).
- **Phones** (≤ 960px) change only the layout: the board runs edge to
  edge; under it the **detail section** (what's tapped) comes first, and
  the **action section** is pinned to the bottom of the screen, set off
  by a yellow rule.
- **Abilities aimed at a unit** (Throw, Pin, Gale and the Composite Bow;
  owner, 2026-10-19) are disabled when there's no unit to aim at from the
  hex the action would be taken from (after the planned move, or where the
  unit stands when acting first): no one adjacent, or no one in any of the
  bow's lanes. An already chosen one stays enabled so it can be put down.
  Ground-targeted abilities (hail, Volley, Freeze) stay enabled: an empty
  hex is a legitimate target for them.
- **Units on the board** (owner, 2026-10-19): a unit's whole hex is
  tinted with its side's colour (blue yours, red the enemy's) inside a
  hex border of that colour, instead of a coloured ring round its circle;
  the border is yellow on the unit whose turn it is and white on the one
  selected. The tint sits under move and target highlights.
- **Inspecting** (owner, 2026-10-19): hovering a hex, or tapping it in
  Inspect mode (for touch), shows its tile's rule, any hail, and the unit
  there: stats, every ability with its cost, where it could move this
  turn (outlined on the board), and for an enemy what it could do.
- **The bow shows its six lanes** to full range (owner, 2026-10-19),
  dashed where the arrow would miss and solid to a unit it would hit.
  Range is still the placeholder 5, and the deployment zones are 6 hexes
  apart, so the opening turn has no target without moving.
- **Deployed** to `main` with the owner's approval (2026-10-19): the
  `v2` migration in `wrangler.toml` adds `RunRoom` and `PlayerLedger`.

