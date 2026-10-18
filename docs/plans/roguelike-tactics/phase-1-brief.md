# Roguelike tactics: Phase 1 brief

Everything a fresh session needs to build Phase 1 (one fight, see
[phases.md](phases.md)) without inventing its own answers: defaults for
every open rule Phase 1 touches, prototype content, the AI, the map, the
page and the API.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which has the status, the next step and an index of every decision.
> Abandoned approaches are in [history.md](history.md).

**Status: confirmed by the owner, except the prototype heroes (section
4),** whose abilities and stat numbers are still to be designed. Everything
else is usable as written; the other open items are listed in section 10
and are config values. All
numbers are **tuning placeholders**: put them in one config module
(`packages/games/silk-road-tactics/src/rules/config.ts`) so play-testing
can change them without touching rules code. Section numbers ("3.4")
refer to the combat design (see the map in the README).

## 1. Scope

**In Phase 1:** one fight, from deployment to victory or defeat. The
track and action economy; a hex map with obstacle, hazard and
conceal tiles; flanking, line of fire, area abilities with friendly fire,
one charged arcing ability (the Mangudai Outrider's, to be designed); displacement and track pushes with the
push limit; the defence formula; previews; stat sheets for every unit; previews
of enemy ability options (D11); four prototype heroes; one enemy band and its AI; the
track UI.

**Not in Phase 1:** ultimates (10.10), consumables (9.6), gear rarity and
gear choices (fixed starter gear only), milestone upgrades, recruitment, the route map, recovery,
reinforcements, summons and other track entities (3.7, 3.8), pulls
(3.5), the other keywords ([keywords.md](keywords.md)), passives, elite affixes,
rival caravans. Each is a later phase's work.

A Phase 1 "run" is a single fight: starting a run starts the fight; the
fight's end ends the run.

## 2. Rule defaults

| Open question | Default for Phase 1 |
|---|---|
| 1. Costs and `C` | Typical action **100**, quick **60**, slow **150**; movement **10 per hex**; starting cost **50**; `C` = **6**. With speed 4, a typical turn lands 10 slots ahead (3.2). A card always moves at least 1 slot. |
| 2. Speed | Speed divides action and movement cost (3.2) and sets the starting slot (3.4). Speed stat 1 to 10. Armour lowers speed (4.2): see gear, below. |
| 4. Simultaneous placement | Higher speed first, then alternate sides starting with the **player's** side, then party slot order (3.3). |
| 5. Push limit | A card can be pushed by at most **10 slots in total** between two of its own turns, counting yielding after a push (3.6). Further pushes are reduced to fit; the preview shows the reduced amount. |
| 6. Charged abilities | One in Phase 1: the Mangudai Outrider's arcing area ability (section 4). |
| 8. Move and act order | Move then act, or act then move; not split around the action. Every turn must include an action (5.1). |
| 28. Movement cap | **4 hexes** per turn. |
| 9. Map | Offset rectangle, **9 columns × 7 rows**, pointy-top hexes. Fits a 600-pixel-wide board beside the track panel. |
| 10. Passing through allies | Allowed (can't end on an occupied hex). Enemies block. |
| 11. Flanking effect | A flanked unit is **Vulnerable 25%** while flanked: it takes 25% more damage from every source (6.3). Vulnerable from abilities is not in Phase 1. |
| 12. Hazards and conceal | Hazard (quicksand): **40 damage** on entering and at the start of each turn spent on it. Conceal (sandstorm): ranged attacks against its occupant deal **50% less**; the occupant's identity stays visible. Obstacles block movement and line of fire; conceal doesn't block line of fire. |
| 23. Defence | `defenceConstant` = **20**; minimum **1** damage from any hit. |
| 29. Line of fire along a hex border | **Blocked if either** hex on the border is occupied. |
| 30. Arcing attacks | Priced as a charged ability, with a charge cost and a recovery cost (3.7). |
| 31. Ally exemption | Not in Phase 1 (no gear choices); area abilities hit allies. |

**Worked example:** a speed 4 hero (speed + C = 10) moving 2 hexes and
making a typical attack: (100 + 2 × 10) ÷ 10 = 12 slots ahead. A speed 7
hero doing the same: 120 ÷ 13 = 9.23, so 9 slots.

**Health and damage are on a ×10 scale** (decided): hits of tens to about
a hundred, health in the hundreds, so percentage bonuses survive rounding.

**Damage and effect formulas** (Phase 1 order; whether the general model
uses damage buckets is open, [heroes-and-gear.md](heroes-and-gear.md)):
- `damage = roundDown(base × (1 + power / 50))`, then 50% less if a
  ranged attack on a concealed target, then +25% if flanked (Vulnerable), then the defence
  formula (9.1); minimum 1; then Barrier absorbs. Each step rounds down.
- Burn, hazard and collision damage skip the defence formula but still
  take +25% if the unit is flanked (Vulnerable applies to every source),
  then Barrier.
- Several units displaced by one ability move one at a time, farthest
  from the centre first ([keywords.md](keywords.md), 17.4).
- Push slots, Burn damage, Barrier strength and Displace distance are
  fixed per ability, not scaled by any stat (power scales only an
  ability's base damage and base healing; influence was folded into
  power, [heroes-and-gear.md](heroes-and-gear.md), 9.2).

## 3. Keywords for Phase 1

The keyword vocabulary comes before heroes (10.8); the full list is in
[keywords.md](keywords.md). **Displace** moves a unit across hexes;
**Push** moves a card later on the track.

| Keyword | Meaning |
|---|---|
| **Displace N** | Moves the target N hexes directly away from the attacker (along the hex direction from attacker to target; for an area centred on a hex, away from that centre). Stops early at an obstacle, another unit or the map edge: the displaced unit takes **20 damage**, and a unit it hits also takes 20 (ignoring defence). Entering a hazard triggers it. Doesn't move the displaced unit's card. |
| **Push N** | Moves the target's card N slots later (3.5); it yields if that slot is taken; subject to the push limit (3.6). |
| **Burn N** | The target takes N damage at the beginning of every **3rd slot** for **12 slots** (4 times), ignoring defence (3.9). |
| **Barrier N** | Absorbs the next N damage the target would take, after every other step, for **10 slots** or until used up. How a second Barrier combines is set by its source ([keywords.md](keywords.md), 17.2); Phase 1 uses max. |
| **On-flank** | An extra effect when the target is flanked (6.3). |

**How the track works, in one paragraph:** cards sit in numbered slots;
the track advances slot by slot and each card acts when reached. After an
action, the card moves ahead by the action's cost (plus movement) divided
by speed + C, rounded down (3.2). A card landing on a taken slot moves to
the next free one; cards already placed never move because of it (3.3).
Effects over time act at the beginning of a slot, before that slot's card
(3.9).

## 4. Prototype heroes

**Not yet designed (2026-10-18):** the heroes' abilities and stat numbers
are for the owner to design before Phase 1 is built. Earlier drafts were
removed; don't fill the gap with invented abilities. Only the four niches,
the heroes and their stat bands stand.

Four heroes from the roster, one per niche Phase 1 needs to test: a front
line, fast melee with flanking, ranged with line of fire and a delayed
arcing area, and track control. Stat bands come from the roster's relative
profiles (15.8); numbers for each band are set when the abilities are.

| Hero | Niche | Health | Speed | Defence | Power | Signature weapon |
|---|---|---|---|---|---|---|
| **Bökh Champion** | Front line (tank) | High | Medium | High | Medium | Bare hands |
| **Kalari Duelist** | Fast melee with flanking | Medium | High | Low | High | Urumi |
| **Mangudai Outrider** | Ranged, line of fire, a delayed arcing area | Low | High | Low | High | Composite bow (mounted, reflected only in stats) |
| **Jinn Binder** | Track control | Low | Medium | Low | Low | Sealed brass vessel |

Every hero also has **Hold** (decided): a quick action (60) with no
effect, so a unit can always end its turn (an action is required, 5.1).

**Starter gear** (fixed in Phase 1; the four-slot model of 9.3 exists in
code, but only armour is filled): the Bökh Champion and Jinn Binder wear
medium armour (more defence, some speed cost); the Kalari Duelist and
Mangudai Outrider wear light armour (a little defence, no speed cost).
Values are set with the stat numbers.

## 5. The enemy band

A band built from the same heroes and gear (11.1): Bökh Champion, Kalari Duelist
and Mangudai Outrider, **three against your four**, so a simple AI is a fair
first opponent. Duplicates across sides are allowed (10.4).

## 6. Enemy AI

On each enemy unit's turn, deterministically:
1. Enumerate every reachable hex (within the movement cap), including
   staying put, and from each every legal ability and target (line of
   fire respected), including Hold.
2. Score each option with the same rules as previews: damage dealt,
   **+300** if it kills, **+100** if the target is flanked; burn counts its
   total damage; push counts its slots × 20; displace counts its collision and
   hazard damage, **+50** if it breaks a flank on an ally; minus damage to
   the AI's own allies × 1.5 (friendly fire only when clearly worth it);
   minus the slots the turn moves the card × 10, so cheap good turns win
   ties.
3. For charged abilities, score assuming targets don't move.
4. Take the highest score; break ties by the lowest unit slot, then
   target slot, then hex index. No randomness.

About 30 hexes × 3 abilities × 4 targets, roughly 400 evaluations per
unit: well within the Free plan's 10 ms
([architecture.md](architecture.md)).

## 7. The map

One hand-made map, **"The Salt Flats Crossing"** (map generation is out of
scope), mirrored left to right like the PvP-style maps (6.6):

- **Deployment zones:** the two leftmost columns (player) and the two
  rightmost columns (enemy), rows 1 to 7. Five columns between them:
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
slot, charging abilities and their targets, each card's remaining push
budget); the fight's status;
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
  charging card shows what it will trigger. Statuses (burn, barrier) show
  only as a small marker on a unit's card; their exact slots appear in the
  tap preview. **Tapping a card previews it:** a unit's turn (who acts and
  when, with the unit's stats and ability options, enemies included), a charged ability (its
  target and outcome), or a reinforcement (arrival and spawn hex), only as
  far as the player can know it: enemy intent stays hidden (7.1).
- **Visuals:** plain shapes and text: coloured hexes for tile types,
  circles with a letter for heroes, outline colour for side. The design
  language (open question 15) comes later.

## 10. Open for Phase 1

**Blocks Phase 1:** the prototype heroes' abilities and stat numbers
(section 4), for the owner to design.

The rest don't block Phase 1; all are config values:
- Cost values and `C` (open question 1): the defaults aim for a typical
  turn about 10 slots ahead.
- The default size of the visible track window (roughly 30 slots).
- The fixed order for simultaneous placement (open question 4).
- Move and act order (open question 8).
