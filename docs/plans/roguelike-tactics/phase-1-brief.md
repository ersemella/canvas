# Roguelike tactics: Phase 1 brief

Everything a fresh session needs to build Phase 1 (one fight, see
[phases.md](phases.md)) without inventing its own answers: defaults for
every open rule Phase 1 touches, prototype content, the AI, the map, the
page and the API.

> Part of the roguelike tactics plan — start at [README.md](README.md),
> which has the status, the next step and an index of every decision.

**Status: confirmed by the owner, 2026-10-15** (answers in section 10),
including how speed works (section 2, revised 2026-10-15). Items marked **[owner]** were reviewed by the owner; everything else is a default the
builder may use as written. All numbers are **tuning placeholders**: put
them in one config module (`packages/games/silk-road-tactics/src/rules/config.ts`)
so play-testing can change them without touching rules code. Section
numbers ("3.4") refer to the combat design (see the map in the README).

## 1. Scope

**In Phase 1:** one fight, from deployment to victory or defeat. The
shared clock, speed, action economy; a hex map with obstacle, hazard and
conceal tiles; flanking, line of fire, area abilities with friendly fire,
one arcing delayed action; physical pushes and timeline delays with a
lock limit; the
defence formula; previews; your stat sheet; enemy derived numbers (D11);
four prototype heroes; one enemy band and its AI; the timeline UI.

**Not in Phase 1 [owner: confirm the deferrals]:** ultimates (10.10),
consumables (9.6), gear rarity and gear choices (fixed starter gear only),
damage variance (8.1 — every value fixed), milestone upgrades,
recruitment, the route map, recovery, reinforcements and summons (3.8),
elite affixes, rival caravans. Each is a later phase's work.

A Phase 1 "run" is a single fight: starting a run starts the fight; the
fight's end ends the run.

## 2. Rule defaults (open questions from section 14)

| Open question | Default for Phase 1 |
|---|---|
| 1. Costs | Typical action **10**, quick **6**, slow **15** ticks; movement **1 per hex**; minimum turn cost **3** (a turn doing nothing costs 3). All whole numbers (3.3). Scale set by the owner, 2026-10-15 (the design's example was 100/60/150/7, 3.3). Moving 5 hexes now costs half a typical action (was about a third). |
| 2. Speed **[owner]** | Decided 2026-10-15: speed sets starting order and is the first tie-breaker (3.4, 4.1); it does **not** reduce action cost (4.3). Turn cost is `max(minimumTurnCost, hexesMoved × moveCostPerHex + actionCost)`. Speed stat 0 to 10, used only for ordering. Armour lowers speed (4.5): see gear, below. |
| 3. Starting order | All units start at **tick 0** and the tie rules decide the opening order (speed first), as 4.1 proposes; collisions spread them over ticks 0, 1, 2 and so on. Method not final: a small whole-tick offset per speed tier is the alternative, so keep it a config switch. |
| 4. Fixed tie order | After speed and first-scheduled: alternate sides starting with the **player's** side, then party slot order. **Collisions resolve to separate ticks** (owner, 2026-10-15): the winner keeps the tick, each loser moves to the next free tick in tie order (3.4). Delayed actions keep sharing a tick and resolve first (3.7) until open question 6 is settled. |
| 5. Knockback lock limit | Applies to **Delay** (the timeline effect, section 3): a unit can be delayed at most **10 ticks in total** between two of its own turns; further delays are reduced to fit (the preview shows the reduced amount). |
| 6. Delayed actions | One in Phase 1 (Volley, below). **[owner]** Cancelled if the caster dies before it resolves; units can step out of its area; otherwise it can't be interrupted. |
| 8. Move and act order | Move then act, or act then move — not split around the action. |
| 28. Movement cap | **5 hexes** per turn. |
| 9. Map | Offset rectangle, **9 columns × 7 rows**, pointy-top hexes. Fits a 600-pixel-wide board beside the timeline panel. |
| 10. Passing through allies | Allowed (can't end on an occupied hex). Enemies block. |
| 11. Flanking effect | Attacks against a flanked target deal **+25%** damage (before defence). |
| 12. Hazards and conceal | Hazard (quicksand): **4 damage** on entering and at the start of each turn spent on it. Conceal (sandstorm): ranged attacks against its occupant deal **−50%**; the occupant's identity stays visible. Obstacles block movement and line of fire; conceal doesn't block line of fire. |
| 13. Variance cap | 20% of the base value (unused in Phase 1: no variance). |
| 23. Defence | `defenceConstant` = **20**; minimum **1** damage from any hit. |
| 29. Line of fire along a hex border | **Blocked if either** hex on the border is occupied (the cautious reading). |
| 30. Arcing attacks | Priced by both a slow cost and delayed resolution (Volley). |
| 31. Ally exemption | Not in Phase 1 (no gear choices); area abilities hit allies. |

**Damage and effect formulas** (power and influence have no formula in
the design yet):
- `rawDamage = roundDown(base × (1 + power / 50))`, then +25% if flanked,
  −50% if a ranged attack on a concealed target, then the defence formula
  (9.1), minimum 1.
- `effect = roundDown(base × (1 + influence / 50))` for delay ticks, burn
  damage and guard strength. Push distance is fixed per ability (whole
  hexes), not scaled.

## 3. Keywords for Phase 1

The combat design says the keyword vocabulary comes before heroes (10.8).
Confirmed by the owner 2026-10-15, with two changes from the first draft:
**Push** now means physical displacement (the timeline effect is renamed
**Delay**), and burn and guard last half as long.

| Keyword | Meaning |
|---|---|
| **Push N** | Moves the target N hexes directly away from the attacker (along the hex direction from attacker to target; for an area centred on a hex, away from that centre). Stops early at an obstacle, another unit or the map edge: the pushed unit takes **2 damage**, and a unit it hits also takes 2 (ignoring defence). Entering a hazard triggers it. Costs the pushed unit no ticks. |
| **Delay N** | Moves the target's next turn later by N ticks (3.5, formerly "push"), subject to the lock limit (3.6). |
| **Burn N** | The target takes N damage every **3 ticks** for **12 ticks** (4 times), ignoring defence. |
| **Guard N%** | The target takes N% less damage for **10 ticks** (stacks with defence; doesn't stack with itself). |
| **On-flank** | An extra effect when the target is flanked (6.3). |

**What a tick is:** a whole-number unit of time on the shared clock
(3.1, 3.3). Each unit has one next-turn tick; the clock jumps to the
lowest and that unit acts, so any tick *can* be a turn but many are
skipped. 10 is the cost of a typical action, not the length of a turn: a
unit taking one returns 10 ticks later, and everyone due in between acts
first. Ticks are coarse so the timeline can show one pip per tick (section
9). Collisions are common at this scale; they resolve to separate ticks
in tie order (3.4), deterministically, and the timeline shows the result. A 10-tick
duration lasts roughly until the affected unit's next turn after a
typical action. All durations are in the config module.

## 4. Prototype heroes [owner]

Four heroes from the roster, one per niche Phase 1 needs to test: a front
line, fast melee with flanking, ranged with line of fire and a delayed
arcing area, and timeline control. Stats turn the roster's relative
profiles (15.8) into numbers:

| Profile | Health | Speed | Defence | Power | Influence |
|---|---|---|---|---|---|
| Very low | — | 1 | — | — | — |
| Low | 24 | 2 | 5 | 5 | 5 |
| Medium | 32 | 4 | 10 | 10 | 10 |
| High | 44 | 7 | 20 | 15 | 15 |

**Batyr** (Tank; health High 44, speed Medium 4, defence High 20, power
Medium 10, influence Low 5; sabre)
- *Sabre Cut* — melee, adjacent; 10 damage. Typical (10).
- *Hold the Line* — Guard 25% on self and every adjacent ally. Typical
  (10).
- *Shove the Line* — melee, adjacent; 4 damage; Push 1. Quick (6).

**Kalari Duelist** (Damage; health Medium 32, speed High 7, defence Low
5, power High 15, influence Low 5; urumi)
- *Quick Cut* — melee, adjacent; 6 damage; on-flank: Push 1 (out of the
  flank). Quick (6).
- *Whirling Urumi* — area: all six adjacent hexes, allies included;
  7 damage each. Typical (10).

**Horse Archer** (Damage; health Low 24, speed High 7, defence Low 5,
power High 15, influence Low 5; composite bow; mounted, reflected only in
stats)
- *Aimed Shot* — direct ranged, range 5, needs line of fire; 9 damage.
  Typical (10).
- *Volley* — **arcing, delayed:** targets a hex in range 6, ignoring line
  of fire; resolves **12 ticks later** on that hex and its six
  neighbours, allies included; 7 damage each. Slow (15).

**Djinn-Binder** (Support/control; health Low 24, speed Medium 4, defence
Low 5, power Low 5, influence High 15; sealed brass vessel)
- *Bound Gust* — direct ranged, range 4, needs line of fire; 3 damage;
  Delay 4. Typical (10).
- *Ifrit's Breath* — direct ranged, range 3, needs line of fire; Burn 2.
  Typical (10).
- *The Djinn Stirs* — area: a hex in range 3 and its neighbours, allies
  included; Push 1 outward from the centre and Delay 2 each. Slow (15).

Every hero can also **Wait** (no action; minimum turn cost applies).

**Starter gear** (fixed in Phase 1; the four-slot model of 9.3 exists in
code, but only armour is filled): Batyr and Djinn-Binder wear medium
armour (+5 defence, −1 speed); the Kalari Duelist and Horse Archer wear
light armour (+2 defence, no speed cost). Table values above already
exclude armour.

## 5. The enemy band

A **rival band** built from the same heroes and gear (11.1): Batyr, Kalari
Duelist and Horse Archer — **three against your four** **[owner]**, so a
simple AI is a fair first opponent. Duplicates across sides are allowed
(10.4).

## 6. Enemy AI

On each enemy unit's turn, deterministically:
1. Enumerate every reachable hex (within the movement cap) — including
   staying put — and, from each, every legal ability and target (line of
   fire respected), plus Wait.
2. Score each option with the same rules as previews: damage dealt +
   **30** if it kills + **10** if the target is flanked; burn counts its
   total damage; delay counts its ticks × 2; push counts its collision and
   hazard damage, + 5 if it breaks a flank on an ally; minus damage to the AI's own
   allies × 1.5 (friendly fire only when clearly worth it); minus
   (turn cost in ticks), so cheap good turns win ties.
3. For Volley, score assuming targets don't move.
4. Take the highest score; break ties by the lowest unit slot, then
   target slot, then hex index. No randomness.

About (30 hexes × ~3 abilities × ~4 targets) ≈ 400 evaluations per unit
— well within the Free plan's 10 ms (see
[architecture.md](architecture.md)).

## 7. The map

One hand-made map, **"The Salt Flats Crossing"** (map generation is out of
scope), mirrored left to right like the PvP-style maps (6.6):

- **Deployment zones:** the two leftmost columns (player) and the two
  rightmost columns (enemy), rows 1–7. Five columns between them — contact
  in about one to two turns of movement (6.6).
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
| `POST /runs/:id/turn` | One turn of the acting unit: `{move?: hex[], action?: {ability, target}}`, or Wait. The response contains every AI turn up to your next one (D7, architecture). |

**The view** (versioned, sent whole each time): the map; every unit's
position, health, statuses and abilities; **your units' full stats**;
**enemy derived numbers** for previews (D11) — per your unit × ability ×
enemy: damage after defence, delay ticks, burn damage (push distances are
fixed and computed locally from the map); the timeline
(upcoming turns in resolved order, delayed actions, each unit's remaining
delay budget); the fight's status; the log of what the AI did since your last
turn.

Previews of moves and actions are computed in the browser from the view.
The server re-validates every turn, so a bad preview can't cause an
illegal move.

## 9. The page

- **Route:** `/play/silk-road-tactics`, its own page in `@canvas/web`
  like poker's (`packages/web/src/app/router.tsx`, before the generic
  `/play/:gameId`, which only runs browser-only games). Listed on the home
  page through `platform.games.json` like every game.
- **Layout:** the hex board drawn with the engine on the canvas (hex
  geometry and picking are new: the engine's grids are square); the
  **timeline**, your selected hero's **stat sheet**, and the **preview**
  as a side panel.
- **The timeline is drawn as pips, one per tick** (owner, 2026-10-15),
  over a window of roughly the next 30 ticks, and **scrolls** to later
  ticks. Unit portraits, delayed actions and reinforcements sit on their
  pips; units never share a pip (collisions resolve to separate ticks,
  row 4), so players can count costs directly (7.1). **Tapping an entry
  previews it** (owner, 2026-10-15): a unit's turn (who acts and when;
  your own units' stats and options too) or the effect that will occur (a
  delayed action's area and outcome, a reinforcement's arrival and spawn
  hex), only as far as the player can know it: enemy intent stays hidden
  (7.1). Default window size is open (open question 1). This replaces an
  earlier idea of showing the next 16 turns as cards. Phone: board on top, timeline below; tap a hex or
  target to preview, tap again to commit (no hover).
- **Visuals:** plain shapes and text — coloured hexes for tile types,
  circles with a letter for heroes, outline colour for side. The design
  language (open question 15) comes later.
- **Title: Silk Road Tactics** (owner, 2026-10-15) — on the home page,
  the page heading and the package name (`@canvas/games-silk-road-tactics`,
  game ID `silk-road-tactics`). Other candidates considered: *Silk Road
  Caravans*, *Caravans of the Silk Road*, *Silk Road: Rival Caravans*,
  *The Silk Road Charter*, *Silk Road: The Closing Road*, *Last Caravan on
  the Silk Road*, *Silk Road Gambit*.

## 10. Owner's answers (2026-10-15)

1. **Deferrals:** confirmed.
2. **Keywords:** confirmed with changes — Push is physical displacement,
   the timeline effect is Delay; burn and guard shortened (section 3).
3. **Heroes:** confirmed "for now"; abilities updated for the new Push and
   Delay.
4. **Delayed actions:** confirmed.
5. **Three against four:** confirmed.
6. **Title:** must include "Silk Road"; candidates in section 9.

**Later answers (2026-10-15):** **Delay stays** as a core mechanic
alongside physical Push. The **Elephant Rider resists Push as a passive**
(roster; not in Phase 1). The timeline showing the next 16 turns as
cards was later replaced by pips, one per tick (section 9).

**Later still (2026-10-15):** title **Silk Road Tactics**; tick scale
**10** for a typical action (section 2).

**Later (2026-10-15):** ticks are coarse whole numbers drawn as pips on
the timeline; speed sets starting order and breaks ties and no longer
reduces cost (section 2, rows 1 to 3; timeline.md 3.3 and 4).

**Later still (2026-10-15):** burn every 3 ticks for 12 and guard for 10
confirmed; the timeline scrolls and previews an entry when tapped;
collisions resolve to separate ticks (section 2, row 4; section 9).

**Still open** (none blocks Phase 1; all are config values):
- The exact typical action cost, 10 or 12 (12 makes movement relatively
  cheaper).
- The default size of the visible timeline window (roughly 30 ticks; it
  scrolls).
- Whether a delayed action takes its own tick when it collides with a unit
  (open question 6).
- The starting order method: all units at tick 0, or a per-tier offset.
