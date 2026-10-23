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
(`packages/games/silk-road-run/src/rules/config.ts`) so play-testing
can change them without touching rules code. Section numbers ("3.4")
refer to the combat design (see the map in the README).

## 1. Scope

**In Phase 1:** one fight, from the opening to victory or defeat. The
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
gear of any kind (owner, 2026-10-20: heroes use their base stats; the fixed starter armour was removed), milestone upgrades, recruitment, the route map, recovery,
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
| 1. Costs and `C` | Typical action **100**, quick **60**, slow **150**; movement action **20 + 10 per hex**; starting cost **100**, a typical action (owner, 2026-10-19; was 50, which bunched all six cards into slots 3 to 8); `C` = **25** and `speedScale` = **5**: slots = cost × 5 ÷ (speed + 25) (owner, 2026-10-20, putting speed on the shared stat scale; was cost ÷ (speed + 6) with speeds 5 times smaller, the same placements). With speed 25, a typical turn lands 10 slots ahead (3.2). A card always moves at least 1 slot. |
| 2. Speed | Speed divides action and movement cost (3.2) and sets the starting slot (3.4). On the shared stat scale, Low 10 / Medium 25 / High 40 (owner, 2026-10-20; was 1 to 10). No gear in Phase 1, so nothing lowers it (4.2's armour trade-off waits for gear). |
| 4. Simultaneous placement | Higher speed first; equal speeds in a **random** order from the fight's seed (owner, 2026-10-21; was alternating sides starting with the **player's**, then party slot order) (3.3). |
| 6. Charged abilities | One in Phase 1, an ultimate: the Mangudai Outrider's Volley (arcing area). The Storm Caller's Freeze was charged too until 2026-10-20 (owner: now instant, section 4). |
| 39. Ultimate unlock | One value for every hero: usable after spending **300 action cost** in the fight, moves included, Holds without a move not (owner, 2026-10-20; was **3 completed turns**, which cheap moves met within a few slots of first contact) (10.10); once per fight. A run saved earlier converts each counted turn to 100. |
| 8. Movement action | Ordinary movement is a separate action: **20 + 10 per hex**, up to 4 hexes. No ability and ordinary movement in the same turn (owner, 2026-10-20). |
| 28. Movement cap | **4 hexes** per movement action (owner, 2026-10-20; restored from 3 with separate movement). |
| 9. Map | Offset rectangle, **8 columns × 9 rows** (owner, 2026-10-20; was 9 × 7, then briefly 7 × 7 and 8 × 8), pointy-top hexes, odd rows one hex wider. Drawn at hex size 42 on a 594 × 697 canvas beside the track panel. |
| 10. Passing through units | Allies and enemies block ordinary walking. Movement abilities keep their own traversal rules (owner, 2026-10-20). |
| 11. Flanking effect | A flanked unit is **Vulnerable 25%** while flanked: it takes 25% more damage from every source (6.3). Every Vulnerable in Phase 1, from a flank or an ability, combines by **max** (17.2), so Freeze and a flank don't stack (Pin and hail had Vulnerable too until 2026-10-20). |
| 12. Hazards and conceal | Hazard (quicksand): **40 damage** on entering (passing through included), then **4 damage** every slot spent on it (both doubled, to **80** and **8**, owner, 2026-10-20, once defence applied), whoever's turn it is (owner, 2026-10-19; was 40 on entering and at the start of each of the unit's own turns). Both go through Vulnerable and **defence** (owner, 2026-10-19; they ignored defence until then). Conceal (sandstorm): its occupant is **Obscured**, as in fog: ranged hits on it, and by it, deal **50% less** (owner, 2026-10-20; only hits on it before); the occupant's identity stays visible. Obstacles block movement and line of fire; conceal doesn't block line of fire. |
| 23. Defence | `defenceConstant` = **50** (owner, 2026-10-20, with defence on the shared stat scale; was 20 with every defence 2.5 times smaller, the same reductions); minimum **1** damage from any hit. |
| 29. Line of fire along a hex border | **Blocked if either** hex on the border is occupied. |
| 30. Arcing attacks | Priced as a charged ability, with a charge cost and a recovery cost (3.7). |
| 31. Ally exemption | Not in Phase 1 (no gear choices); every ability affects allies and enemies alike (6.7, 2026-10-19). |

**Worked example:** a speed 25 hero (speed + C = 50) moving 2 hexes and
making a typical attack: (100 + 2 × 10) × 5 ÷ 50 = 12 slots ahead. A speed 40
hero doing the same: 600 ÷ 65 = 9.23, so 9 slots.

**Health and damage are on a ×10 scale** (decided): hits of tens to about
a hundred, health in the hundreds, so percentage bonuses survive rounding.

**Damage and effect formulas** (Phase 1 order; whether the general model
uses damage buckets is open, [heroes-and-gear.md](heroes-and-gear.md)):
- `damage = roundDown(base × (1 + power / 50))`, then Vulnerable (a flank's or an
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
| **Immobilized** | No movement, and no ability that moves the unit (Leap; Lunge then strikes only a unit next to it). It still acts, and can still be displaced, staying Immobilized where it lands (17.5). |
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
| **Bow** | Fires an arrow along one of the six hex directions, with **no range limit** (owner, 2026-10-20; range 5 before); it stops at the **first unit** on that line, an obstacle or the map's edge. It **can't target a unit in, or past, an Obscured hex** (sandstorm, 17.6): the lane stops short of it (owner, 2026-10-21; from 2026-10-20 that halved it instead). An archer standing in a sandstorm **can't shoot out** of it (owner, 2026-10-21). That unit, **ally or enemy**, takes base damage **120** (owner, 2026-10-19: two hits kill a Mangudai, four a Yadachy) (6.7, 2026-10-19), so allies still block the shot. A straight hex line replaces free-angle line of fire (6.7) for this ability. Typical cost. |
| **Leap** (Dash until 2026-10-21, owner) | The Outrider jumps **exactly 2 hexes in a straight line**, over whatever is in the hex between: ruins, a unit of either side, quicksand or hail, none of which affect it. It must land on a free, walkable hex, which applies as usual. It is the turn’s action, so it cannot be combined with ordinary movement. Not usable while Immobilized. Cost 20 (owner, 2026-10-21). Dash moved up to 3 hexes in a line, stopped by ruins and enemies, at cost 40: too close to walking to have its own identity ([balance.md](balance.md)). |
| **Volley** (ultimate) | An **arcing, charged** area: targets a hex within range TBD, ignoring line of fire; when the charge triggers, every unit in the area (radius TBD) takes base damage **200** (owner, 2026-10-20; 135 before), allies included. Charge and recovery costs TBD (3.7). |

**Yadachy Storm Caller**

| Ability | Rule |
|---|---|
| **Sunlight** (Clear the Storm until 2026-10-19, owner) | Targets **one space** within range 4, empty or not (owner, 2026-10-21; a unit before). A unit on it, the caster or an **enemy** included (6.7, 2026-10-19), is **healed** (base heal 50, scaled by power: owner, 2026-10-20; 35 and 50 earlier that day) and **cleansed**, and **hail and fog are cleared from its hex** (that hex only, owner, 2026-10-21); aimed at a space, it **isn't stopped by a sandstorm** (owner, 2026-10-21; earlier that day it couldn't target a unit in, or past, one) (cleansed: owner, 2026-10-20; it was every unit within a radius of the caster, which under separate movement took a turn of positioning first). Cleansing an enemy removes the party's own control from it. Quick cost, 60 (owner, 2026-10-20; typical before). |
| **Hail** | Targets a hex within range TBD; it becomes a **hail hex for TBD slots**, a temporary board effect. A unit on it when it lands, entering it, or starting its turn on it takes **base damage 50** (owner, 2026-10-19; scaled by the caster's power when cast, then Vulnerable and defence as any hit), then is **Slowed** for TBD slots (no Vulnerable since 2026-10-20, owner; Freeze and flanking keep it). Hits any side. Any hex within its **maximum range** can be targeted, with **no line of fire** needed; not charged (owner's call, 2026-10-18; a departure from rule 30, that arcing attacks are charged, which hail's lack of damage justified; it now deals damage, so whether it stays uncharged is open). Typical cost. |
| ~~Fog~~ | **Removed (owner, 2026-10-21).** It replaced Gale on 2026-10-20: its hexes were Obscured for 20 slots. No version measured worth its turn, and fog that blocked sight made fights 15–35% longer ([balance.md](balance.md)). The Storm Caller's kit is Sunlight, Hail and Freeze. |
| **Freeze** (ultimate) | An area, **instant** at typical cost (owner, 2026-10-20; it was charged, with a casting time, from 2026-10-18, and its targets stepped out of it: [balance.md](balance.md)): targets any hex within maximum range TBD, no line of fire needed. Every unit in the area (radius TBD), allies included, takes base damage **120** (owner, 2026-10-22; 60 from 2026-10-20) and is then **Immobilized** and **Vulnerable 50%** for 20 slots (owner, 2026-10-20: ultimates buffed; no damage, 25% for 15 before). |

**Bökh Champion**

| Ability | Rule |
|---|---|
| **Throw** | Melee: **displaces** the target **to any other free hex adjacent to the Champion**. The target takes base damage TBD (owner's call, 2026-10-18); a hazard where it lands triggers too. Typical cost. |
| **Grapple** (Pin until 2026-10-22, owner) | **Melee** (owner, 2026-10-22; from 2026-10-21 it could step one hex first, to a free hex next to the target): the target is **Immobilized** for TBD slots (the Champion was too until 2026-10-20; owner: it stays free, and moving away releases the target, as a wrestler would), and the target is **Crushed** and **Taunted** by the Champion for the same (owner, 2026-10-19; it was also Vulnerable until 2026-10-20). Crushed: base **10** damage every slot (owner, 2026-10-22; 6 from 2026-10-20, 8 before), scaled by the Champion's power, through Vulnerable and defence like quicksand. Taunted (17.5): while it can affect the Champion from any hex it can reach, its action must target the Champion or include it in its area, or be a Hold (owner, 2026-10-20), and a damaging charge is drawn onto the Champion if in range; it ends if the Champion dies. Sunlight's cleanse of the target removes them all (breaking the grapple). Both still act. The grapple **breaks** if the target is cleansed or the two are no longer adjacent (either displaced away, or the Champion moving away), clearing **every status the Grapple gave either unit** (owner, 2026-10-20). Cleansing the Champion doesn't break it. Typical cost. |
| **Lunge** (ultimate) | Replaced **Rampage** (owner, 2026-10-22; a 3-hex charge in a straight line, base 160 to each unit in or beside its path and Displace 1). A unit within **3**: next to the Champion, struck where it stands; otherwise the Champion first **bounds** up to 2 hexes, along free walkable hexes, to a free hex beside it (the player picks it), entering only that hex. The target takes base **100**, then is **grappled** as by Grapple (Immobilized, Crushed and Taunted while the two stay adjacent; no Vulnerable). Immobilized, only a unit next to it. Allies too (6.7; owner confirmed, 2026-10-22). The bound is blocked by units and ruins as walking is (owner confirmed, 2026-10-22). Typical cost. |

**Interactions to know** (they follow from the keyword rules, not new
rules): an Immobilized unit can still be displaced (owner's call,
2026-10-19), so the Champion's flow is **Grapple, then Throw**: the target
lands where the Champion chooses, still Immobilized, and
can't walk back; it lands beside the Champion, so the grapple holds. Frozen units can likewise be thrown, blown back or
lunged at. A grappling Champion can Lunge at another unit, which releases the first if it bounds away; Lunge then Throw keeps the new grapple. Throw onto
quicksand (a held unit then stays in it), and Freeze on the area a Volley is charging at (frozen
units can't step out of it), are the obvious combinations. Freeze's Vulnerable doesn't stack with a
flank's (max, section 2).

**No gear in Phase 1** (owner, 2026-10-20): heroes fight with their base
stats only. Starter armour (medium on the Bökh Champion and Yadachy Storm
Caller, light on the Mangudai Outrider) was removed so the numbers on the
stat sheet are the hero's own; gear arrives with the route map (Phase 2).

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

- **Starting columns:** the leftmost hex of each row (player) and the
  rightmost (enemy), rows 1 to 9; the run's seed scatters each party
  along its column, with no deployment step (owner, 2026-10-20; the
  zones were the two outermost hexes of each row, chosen by the player). Odd rows have a ninth hex at
  column −1, so neither side edge is notched (owner, 2026-10-19). Four
  columns between them on even rows, five on odd rows (8 columns × 9
  rows since 2026-10-20, owner): contact in about one to two turns of movement (6.6).
- **Obstacles (ruins):** 4 hexes breaking the long sight lines: two in
  rows 1–4 and two in rows 6–9 (counting from 1), placed at random each
  fight and not mirrored (owner, 2026-10-20; they were fixed, mirrored, in
  rows 3 and 6).
- **Hazards (quicksand):** 2 hexes placed at random each fight, not
  mirrored (owner, 2026-10-20; they were either side of the centre hex of
  row 4). Random ruins and quicksand stay two columns clear of each edge
  and off the sandstorm; the run's seed decides them.
- **Conceal (sandstorm):** 3 hexes, mirrored, between the ruins: two in
  row 3 (an even row has no centre hex) and the centre hex of row 6.

Exact coordinates are the builder's choice within these rules; record them
in the map's data file.

## 8. Run state and API

All requests carry the player key in an `Authorization: Bearer <key>`
header (never the URL, D4). The server stores only its SHA-256 hash.

| Route | Purpose |
|---|---|
| `POST /runs` | Start a run (and its single fight); returns the run ID and the first view. One active run per key (D3): starting another abandons it. |
| `GET /runs/:id` | The current view (resume after a reload). |
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

- **Route:** `/play/silk-road-run`, its own page in `@canvas/web`
  like poker's (`packages/web/src/app/router.tsx`, before the generic
  `/play/:gameId`, which only runs browser-only games). Listed on the home
  page through `platform.games.json` like every game.
- **Title: Silk Road Run**, on the home page, the page heading and the
  package name (`@canvas/games-silk-road-run`, game ID
  `silk-road-run`).
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

The rest don't block Phase 1; all are config values:
- Cost values and `C` (open question 1): the defaults aim for a typical
  turn about 10 slots ahead.
- The default size of the visible track window (roughly 30 slots).
- The tie order for simultaneous placement (open question 4).
- Move and act order (open question 8).

## 11. As built (2026-10-19)

Phase 1 is built: `packages/games/silk-road-run` (rules in
`src/rules/`, `./server` exporting the `RunSystem`), `RunRoom`,
`PlayerLedger` and `/runs` in `@canvas/server`, and the page in
`@canvas/web` (`pages/tactics/`). The builder's choices, for the owner to
confirm or change:

- **Placeholder numbers.** Every hero stat and ability value marked TBD
  in section 4 has a placeholder in `src/rules/config.ts`, marked as such,
  from the roster's bands (health 300/420/540; the Outrider and the
  Storm Caller were both 360 from 2026-10-20 to 2026-10-21 (owner); speed, defence and
  power on one scale, Low 10 / Medium 25 / High 40, since 2026-10-20
  (owner; speed was 4 and 7, defence 5 and 10)) so a fight can be played. Tuned once against AI-vs-AI fights
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
  ending a move on quicksand counts its damage for every slot until its
  next turn against the option; ground-targeted abilities (hail, Volley, Freeze) are tried once
  per target hex, from the cheapest hex in range. A one-step lookahead
  (2026-10-20, `src/rules/threat.ts`): each enemy's best hit on every hex
  from anywhere it can reach, mapped once per AI turn; an option loses
  the damage the enemies acting within the unit's next turn (at least a
  typical turn, so a cheap Hold doesn't look safe) could deal where it
  ends, times the share of its health, times its hero's caution
  (`AI.caution`, 0 for the Bökh Champion, which otherwise Held on 44% of
  its turns). This heuristic now ranks candidates for a **selective
  alpha-beta search** (2026-10-20): four candidates per node, actual future
  timeline decisions, two decisions including the root then three if work
  remains. A request shares 220 work units, at most 110 per AI turn;
  exhaustion retains the last complete iteration or uses a legal Hold.
  Root screening tries up to 48 actions; reply screening up to eight.
  Charged previews are separate from faithful timeline states. Details,
  regression coverage and the local performance comparison are in
  [ai-search.md](ai-search.md). These deterministic work caps are locally
  calibrated, with production CPU errors still to be monitored.
- **Balance measurements** (2026-10-20) play each random deployment
  twice, once with each side first on speed ties: the side that moved
  first on a tie used to lose 60–67% of AI-vs-AI fights, which tilted
  every single-order measurement. Under the adopted rules the AI chooses
  movement or an ability; historical combined-action comparisons move first.
- **Leap** (Dash until 2026-10-21) jumps exactly 2 hexes, over one, at cost 20; Dash went up to 3 hexes at 40 (60 before 2026-10-20). **Grapple** and **Throw** target
  any adjacent unit, allies included (Grapple, then Pin, targeted enemies only until the
  2026-10-19 rule, 6.7).
- **Abilities don't know sides** (6.7, 2026-10-19): the bow and Lunge
  damage allies, and Sunlight can heal and cleanse an enemy. Sunlight's
  placeholder radius went from 2 to 1 with it, so stepping clear
  of enemies was possible; since 2026-10-20 it targets one unit within
  4 instead, and since 2026-10-21 one space. The AI counts healing or cleansing an enemy against an option.
- **The map's coordinates** are in `src/rules/map.ts`: 9 rows, even rows
  columns 0 to 7, odd rows −1 to 7 (2026-10-20; 7 rows of 0 to 8 and −1
  to 8, then briefly 1 to 7 and 0 to 7, before). Odd rows reaching one
  column further (owner, 2026-10-19) makes the board an exact left-right
  mirror, and every feature, the quicksand included, is mirrored. The enemy's placement is one of three layouts, chosen by the
  run's seed.
- **Line of fire** (rule 29) is implemented and tested, but no Phase 1
  ability needs it: the bow fires along hex lines.
- **The page** (owner, 2026-10-20): tapping or hovering inspects a hex.
  **Move** then a reachable hex selects one movement action. Selecting an
  ability replaces the move; selecting Move replaces the ability and its
  target. Selecting Move again undoes the move (since 2026-10-21, once a
  hex is picked, Move's button confirms it instead). There is no Swap order:
  each turn contains movement or an ability. The Move button shows its
  whole timeline delay at **20 + 10 per walked hex**; ability buttons show
  their own delays. Confirm shows the aimed and yielded next-turn slots.
- **The turn's controls** (owner, 2026-10-19, phones first, then desktop):
  the action section has no heading, hints, slot pill or summaries: the
  buttons, then the selected action (named only), then one button to commit. There is no Hold button: with no
  action or move picked the button reads **End turn** and sends Hold.
  A planned move instead uses **Confirm**. Tapping a chosen target again doesn't commit; only the
  button does. (Superseded 2026-10-21: the picked button confirms, the
  bottom one is Skip turn, and a second tap un-picks; see "The picked
  button confirms" below.) The board shows the preview's outcome. Tapping anywhere but
  the board or the action section stops inspecting: the details go back
  to the unit whose turn it is. An enemy's details leave out what it could
  do next turn. A unit's name in the details is a badge in its side's
  colour (blue yours, red the enemy's), with no "yours"/"enemy" label; the
  board's hover tooltip names the hero without "Your"/"Enemy", its colour
  giving the side. (Superseded 2026-10-21: on desktop, hovering a hex
  shows only its unit's health and statuses, with no tooltip; the side
  panel's details tell the rest.)
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
  A unit's details list each ability in its slots too ("Bow ·
  +7"): the action alone, before any move or yielding.
- **The top bar** shows Back and the page's title instead of the site
  name, for every game (owner, 2026-10-19).
- **Phones** (≤ 960px) change only the layout: the board runs edge to
  edge; under it the **detail section** (what's tapped) comes first, and
  the **action section** is pinned to the bottom of the screen, set off
  by a yellow rule.
- **Abilities aimed at a unit** (Throw, Grapple and the Bow;
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
- **The unit you're controlling** (2026-10-21): it wasn't always obvious
  which unit was taking the turn, since its border had become light lapis
  over your own deep lapis rug. The border is gold again, a step thicker,
  and a gold pixel arrow bobs over the unit, above its health bar and
  statuses (still with reduced motion). The arrow shows only on your
  units, and not while a turn plays back; the acting card on the track is
  outlined gold too.
- **Room over the top row** (2026-10-21): the board sits a little lower
  under the track, so every unit's health bar, statuses and turn arrow sit
  above it (the top row's used to drop below the unit, over the row
  beneath, and the turn arrow there was drawn over the unit itself). The
  track went under the board for a while the same day, and came back up
  (owner).
- **Why a target can or can't be picked** (2026-10-21): an ability aimed
  within a range (Sunlight, Hail, Volley, Freeze) outlines its reach
  with a dashed line; the bow draws its six lanes, an arrow along each to
  an enemy it can hit and a faint dashed line along the rest to where the
  arrow stops (an ally, a ruin, the edge), so the enemies it can't hit are
  explained. Targetable units' rings sit over ink, so they show on your
  own lapis rugs.
- **Throw's and Lunge's second pick** (2026-10-21; Pin's until
  2026-10-22): the hexes picked after the target, where Throw lands its
  target and where Lunge bounds to first, are dashed, so they don't read
  as more targets; a unit Lunge reaches only by bounding has a dashed
  ring. A dashed arc swings around the Champion from the unit thrown to
  where it lands, and Lunge's bound is drawn as a move's arrow over the
  units; on desktop, hovering a landing or a unit with one landing
  previews it.
- **Ability kinds** (2026-10-21): each ability's button, its name on a
  stat sheet and its explanation carry an icon for its kind, a pixel
  sword for an attack (Bow, Volley, Throw, Rampage, now Lunge), a cross
  for a heal (Sunlight), an arrow for movement (Move, Leap) and a chain's
  two links for control (Hail, Freeze, Pin, now Grapple); the explanation names
  the kind. (A boot and a padlock, first, were confusing: owner.)
  Each kind's icon takes its colour from what it does: damage's light
  madder, health's jade, ivory, the harmful statuses' gold.
  **Each ability its own icon** (owner, 2026-10-21): the kind icons gave
  way to one per ability, 12×12 art pixels in up to three shades, still
  coloured by kind unless the ability says otherwise: Bow a
  drawn bow, Leap a jump's arc, Volley three falling arrows, Sunlight a
  yellow sun, Hail a white cloud dropping sky-blue hail, Freeze a sky-blue
  snowflake, Throw an arrow over and down, Grapple two links locked together
  (Pin an arrow pressing onto a bar until 2026-10-22), Rampage a double
  chevron (Lunge, since 2026-10-22, a double chevron charging into a bar
  trailing speed lines: a thick diagonal stroke springing forward was
  unclear, owner, 2026-10-22), and Move a plain arrow. Figures (a
  thrown body, a pinned one, a runner) were too busy at this size; simple
  shapes read. Every new ability needs one (`AbilityIcon.tsx`).
- **The phone's tooltip** (owner, 2026-10-21): any tap outside it closes
  it, a turn button's or a hex to move to or target included; a tap on
  another hex or a track card opens that one's instead. A track card's tap
  used to leave a hex tapped before pinned, and once that hex emptied (its
  unit moved away or fell) the tooltip showed nothing: an empty black box.
  A hex left empty by a turn now stops being looked at, and the tooltip
  never shows for plain sand.
- **The picked button confirms; Skip turn** (owner, 2026-10-21): players
  tapped the ability again after aiming rather than the Confirm button
  below. So once Move's hex or an ability's target is picked, that button
  becomes its Confirm (bright lapis, "Confirm" and when the next turn
  comes, "+3 → +8" when the card yields); before then it asks for the hex
  or target, and tapping it puts it down. Tapping the chosen hex or target
  again un-picks it (it used to do nothing): a tap on the board never
  commits, since the board is where players look around. The button
  under the choices is an explicit Skip turn (Hold, whatever is picked),
  a quiet dusk tile saying when the next turn comes. Its first tap only arms it
  ("Tap again to skip", in gold), as Reset run's does, so a stray tap
  doesn't throw a turn away (owner, 2026-10-21); it disarms after 3
  seconds, on a tap anywhere else (owner, the same day; the tap still
  does what it does), or when the turn changes.
- **Desktop controls** (owner, 2026-10-21): picking an ability, clicking
  the board, then going back to the panel to confirm was cumbersome. As in
  XCOM, Into the Breach and Divinity: Original Sin 2, the turn stays on the
  board: with no ability picked, a click on a reachable hex plans a move
  (no Move first; hovering one shows its path and its slots in Move's
  button); a second click on the hex picked last (destination, target,
  Throw's landing or Lunge's landing) commits the turn, since hovering already
  does the looking on desktop; a Confirm under that hex does too. Esc or a
  right-click steps back one pick at a time. Keys: 1–9 press the turn's
  buttons in order (Move first, each showing its number), Enter or Space
  confirms, S presses Skip turn (twice, as with taps). Phones keep the
  board for looking and aiming only, as above. The side panel is as tall
  as the board, which fills the screen: the buttons level with the track,
  the details under them, and the picked ability's explanation and a
  one-line key hint at its foot.
- **Inspecting** (owner, 2026-10-19): hovering a hex, or tapping it in
  Inspect mode (for touch), shows its tile's rule, any hail, and the unit
  there: stats, every ability with its cost, where it could move this
  turn, and for an enemy what it could do. (2026-10-20: its moves are no
  longer outlined on the board, which was too cluttered; instead a melee
  ability, while picked, outlines the hexes next to the user.)
- **The bow shows its six lanes** to full range (owner, 2026-10-19),
  dashed where the arrow would miss and solid to a unit it would hit.
  Range is still the placeholder 5, and the deployment zones are 6 hexes
  apart, so the opening turn has no target without moving.
- **Deployed** to `main` with the owner's approval (2026-10-19): the
  `v2` migration in `wrangler.toml` adds `RunRoom` and `PlayerLedger`.


### Movement rule adopted, 2026-10-20

The owner adopted unit blocking for ordinary walking and separate movement
at base 20 plus 10 per hex. The ordinary walking cap is restored to 4 with separate movement. A move-only turn still counts
toward ultimate unlock; idle Hold does not. Leap and Lunge retain their
ability-specific movement but cannot combine with ordinary walking.
The headless runner retains explicit historical overrides for reproducing
comparisons; absent an override, the game uses the adopted rules.
