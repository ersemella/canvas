# Plan: Silk Road Run

Status: **Phase 1 built (2026-10-19); stats, keywords, track and kits reworked by the owner (2026-10-23).**
One fight against the AI plays end to end: the rules in
`packages/games/silk-road-run/src/rules/`, the page at `/play/silk-road-run`.
**Since 2026-10-25 the whole run plays in the browser** (the owner's
call, [../client-side-runs.md](../client-side-runs.md), replacing D3, D4
and D7): saved in `localStorage`, one tab at a time, its AI in a Web
Worker searching as deep as the device gets; the Worker's `RunRoom`,
`PlayerLedger` and `/runs` are gone. Routes named below (`POST /runs`)
are now the page's `localRuns` calls of the same names.
The page opens on a start menu (2026-10-21): the game in brief, which of
the heroes to take (one to three of the three; the camel always comes), and Start;
`POST /runs` takes the `party`. A run is three stages, each a fight (owner, 2026-10-24;
`STAGES` in `src/rules/config.ts`): the enemy brings the Mangudai Outrider
(`FIRST_ENEMY`) and two wolves, then the Outrider, one of the other two at
random and a wolf, then all three heroes.
Winning a stage offers Next stage (`POST /runs/:id/next`); the surviving
heroes and the camel go on at full health, the fallen are gone for the
run; winning the last stage wins the run. **Two regions** (2026-10-26):
the Steppe's three stages, then China's three on the Flaming Mountains
against fox spirits and the Youxia Swordsman first
([progression.md](progression.md), 19.5). Between stages the caravan
stops at a **caravanserai** (2026-10-25): after a region's stages 1 and 2 one
survivor takes a provision, +1 to one stat for the rest of the run
([progression.md](progression.md), 19.2); between the regions it offers
**three passives at random**, one taken by a survivor for the rest of the
run (2026-10-26; 19.3's passive slot alone).
**Maps per region** (2026-10-25): each stage names its map (`STAGES`,
`MAPS` in map.ts), every one so far the Steppe's; the **Gobi Crossing**
(`gobi`) is the same board in the desert's look, sand and sandstone ruins
and no mountains, built for the China region, kept for Arabia's until that region was cut (2026-10-26), and now proposed as the Steppe's last stage ([setting.md](setting.md), 15.3b, with every region's biome);
the **Flaming Mountains** (`flaming`, owner, 2026-10-26) are the China
region's: red earth, two clumps of burning mountains in the middle of every fight and one or two Han beacon towers, at most 8 spaces covered in all (2026-10-26), the mountains drawn as burning ridges, each clump one continuous landform (`board/ridges.ts`), and the towers with a tiled pavilion roof, so the board reads as China's
([art-direction.md](art-direction.md)), played from the test stage until
the China region's stages exist.
What the builder decided and where it departs from the brief is in
[phase-1-brief.md](phase-1-brief.md#11-as-built-2026-10-19). The engine
has hex geometry, a hex grid system, sprites and scaled pixel-art
rendering ([architecture.md](architecture.md),
[art-direction.md](art-direction.md)). The combat design defines the game;
the multiplayer design (ghosts as **rival caravans**, built last) is
settled. Built in this repository (D10). The folder name,
`roguelike-tactics`, predates the title.

**Reworked by the owner (2026-10-23): stats, keywords, the track and
the kits.**

- **Stats** are small whole numbers: health is (1 + defence) × 2, and
  every ability deals exactly its user's power
  ([heroes-and-gear.md](heroes-and-gear.md), 9.1–9.2). Bökh Champion speed
  2, defence 3, power 1; Mangudai Outrider 3, 1, 2; Yadachy Storm Caller
  2, 2, 0.
- **The track:** after any turn a unit's card goes 60 ÷ (speed + 5) slots
  on, rounded, Temee's included, so the faster act more often. A fight starts from
  slot 0, fastest first, equal speeds side by side and a free slot between
  speeds, and Temee last at slot 12 ([timeline.md](timeline.md), 3.2 and
  3.4). Per-action costs are gone.
- **The keywords** are a new, shorter list: Delay, Haste, Inevitable,
  Push, Pull, Move, Immobilized, Unstoppable, Stunned, Burn, Shield,
  Pierce, Empower, Weaken, Armour, Immortal ([keywords.md](keywords.md));
  Immobilized, Stunned, Move, Push, Pull, Empower, Weaken and Delay
  (Cleave's Delay 8, owner, 2026-10-26; 5 before) are built.
- **The kits** ([roster.md](roster.md)): the Bow, unchanged in shape; Hail,
  one space exactly 2 away (a ring; within 3 until 2026-10-24) until the
  Storm Caller's next turn, Immobilizing
  whoever is in it or enters it; Grapple (melee; reach 2, stepping in, until
  the owner's call of 2026-10-23), Stunning
  its target until the Champion takes damage, is Stunned or ends a turn
  no longer next to it, 1 more damage at each of the Champion's turns
  meanwhile, never on the unit it already grapples, and while it holds one,
  throwing it (part of Grapple since 2026-10-24, owner), Moving it to a
  space next to the Champion, or swapping places with it, so the grapple
  holds; Skirmish
  (owner, 2026-10-23, in place of Volley), a step of one space and then
  the Bow's shot from there, charged: the Outrider's card is pushed half
  its action cost on (4 slots), greyed; when it comes back the arrow flies
  down the lane it was aimed along, hitting the first unit in it then,
  with no turn for the Outrider, and the card goes its action cost on;
  Sunlight (owner, 2026-10-23), Empower 2 on a unit within 3, melting hail
  there. **Skirmish and Sunlight are upgrades** (owner, 2026-10-24), out
  of the starting kits: the Outrider starts with the Bow, the Storm Caller
  with Hail, each earning the other from a region's upgrade offer
  ([progression.md](progression.md), 19.3), not built yet. **Also
  upgrades** (owner, 2026-10-24, as measured in
  [balance.md](balance.md#second-abilities-measured-2026-10-24)): Shove
  (melee Push 2) and Haul (Pull 2) for the Champion, Volley (a space within
  3, charged) and Feigned Retreat (the Bow, then a walk of up to 2) for the
  Outrider, Gale (each unit next to a space hit and Pushed 1) for the Storm
  Caller.
- **Deleted with their code:** the Modao Vanguard's kit, ultimates and
  charged abilities, Leap, Shove, quicksand and the sandstorm,
  and every keyword not in the new list ([history.md](history.md)); Shove
  is back as an upgrade (2026-10-24). Hold Loose, Hip Toss, Squall Line,
  Tailwind and Overwatch were measured and removed on 2026-10-24.
- **The passives** (progression.md, 19.8) are built (2026-10-25): any
  unit can carry them on the test stage (`"passives"`), and since
  2026-10-26 the caravanserai between the Steppe and China offers three,
  one taken; the rest of the upgrade offer isn't built.
- **At most two abilities** a hero, besides moving and Hold (owner,
  2026-10-25; three from 2026-10-24; [roster.md](roster.md)): on the
  page, Move fills its own row over a hero's two abilities.
- Still pared back from 2026-10-22: the Modao Vanguard out of the
  roster; a move of at most 2 spaces (3 until 2026-10-24); Temee not player
  controlled, walking itself one space a turn from the board's top point
  to the only exit, its bottom point, around units in its way. The board
  is a hexagon of 61 flat-top hexes, 4 from the centre, the sides starting
  on its straight outer columns of 5 (owner, 2026-10-24; 64 pointy-top
  hexes in 9 rows before); about half of fights, and every fight of a
  run's first three stages (`MOUNTAIN_STAGES`), have a range of 3 to 5
  mountains along one of the four slanted edges (never the sides, nor
  Temee's middle column), which block movement and arrows. **No ruins**
  (owner, 2026-10-24; six a fight before): the board is the wide open
  steppe, with **two or three yurts** a fight within 2 hexes of the
  centre, no two side by side, blocking as ruins did (the `obstacle`
  tile, renamed for the player; `randomTiles` in map.ts).

**Next step:** the owner reviews the builder's readings of the rework and
the first measurements (Grapple decides fights, Throw goes unused) in
[owner-decisions.md](owner-decisions.md), with everything else waiting on
the owner. How a stalled fight ends is
decided (owner, 2026-10-21) and built in the fight: the caravan's
**camel**, a unit that can't attack, which wins the fight by reaching
the exit and loses the run by dying ([camel.md](camel.md)). Balance
measurements, the rework's first ones included, and the principles for
re-tuning are in [balance.md](balance.md). Then Phase 2
([phases.md](phases.md)). The
keywords and their rules are decided ([keywords.md](keywords.md)). The
combat design's other open questions are at the end of each topic file.
PvP is parked ([pvp.md](pvp.md)).

The plan is split by topic so a session loads only what its task needs.
Each file states current decisions and their reasons; abandoned approaches
are collected in [history.md](history.md).

## The game

A turn-based **tactical roguelike**: "Into the Breach with a Final Fantasy
Tactics timeline and a Darkest Dungeon roster", on a **fantasy Silk Road**
where rival caravans race along the road. A party of up to four heroes,
recruited during the run from a roster of twelve, and the caravan's
camel, which the enemy tries to kill ([camel.md](camel.md)), travel a **route map**
of the road (fights, caravanserais, bazaars, recruitment) and fights on
compact hex maps. Turn order is a track of slots: after each turn a
unit's card goes a cost set by its speed, so the faster act more often;
information is complete and randomness minimal;
every unit's stats are shown, enemies' included; only opponents' intent is hidden.
Heroes who die are gone for the run; a party wipe ends it.

Multiplayer is asynchronous: some fights, on their own maps, are against a
**rival caravan**, an AI-controlled copy of another player's party taken
at the same stage of their run. Each run's caravan is met at most once per
player, never more than one per fight. When a caravan wipes a party, its
owner earns recognition, scored by unique players slain; a beaten
caravan's hero may join your next recruitment offer. No live opponents and
no real-time turn timers.

It runs on the existing stack: one Durable Object per run, a pool of rival
caravans per stage, a ledger per player, an anonymous player key.

## What to read for a task

Always read this file first. Then:

| Task | Read |
|---|---|
| What's broken or waiting on the owner | [owner-decisions.md](owner-decisions.md) |
| Any design work | [goals.md](goals.md) (design goals, intended feel, types of fun) |
| Looking up a term | [glossary.md](glossary.md): look up, don't read through |
| AI lookahead, pruning, work caps and performance | [ai-search.md](ai-search.md) |
| Turn order, speed, what a turn can do | [timeline.md](timeline.md) |
| Maps, movement, line of fire, deployment | [map.md](map.md) |
| Visibility, previews, randomness | [information.md](information.md) |
| Stats (health, speed, defence, power), gear, party, heroes' systems, recruitment, upgrades | [heroes-and-gear.md](heroes-and-gear.md) |
| Keywords and effects: track and board effects, control, damage modifiers | [keywords.md](keywords.md) |
| Play-testing a line-up, stats or kits by hand: the test stage (`test-stage.json`) | `packages/games/silk-road-run/test-stage.md` |
| Tuning numbers, or balancing a new hero, ability, keyword or gear: what each ability and stat is worth, measured; the proposed tuning; principles for re-tuning | [balance.md](balance.md) |
| The heroes, three per region | [roster.md](roster.md) |
| Enemies, bosses, difficulty | [enemies.md](enemies.md) |
| Run progression: regions and stages, provisions (stat points), upgrade offers, the passives (offered between regions), the enemy line-up per stage, the final boss | [progression.md](progression.md) |
| The caravan's camel; how a fight is won and lost; ending stalled fights | [camel.md](camel.md) |
| Setting, cultures, folklore | [setting.md](setting.md) |
| Art style, sprites, palette, rendering scale | [art-direction.md](art-direction.md) |
| Rival caravans, the pool, rewards, the ledger | [ghosts.md](ghosts.md) |
| Server classes, routes, previews, platform constraints, Free-plan limits | [architecture.md](architecture.md) |
| Building Phase 1 | [phase-1-brief.md](phase-1-brief.md) and [phases.md](phases.md#phase-1-one-fight), then the topic files the brief cites |
| Building a phase | [phases.md](phases.md), plus the topic files that phase names; then `CLAUDE.md` and `.claude/skills/verify/SKILL.md`, and the parts of `ARCHITECTURE.md` it touches |
| Revisiting an abandoned approach | [history.md](history.md) |
| Other games: copies of players, live invasions | [prior-art.md](prior-art.md); games the combat design draws on, and gear and build lessons from Path of Exile and Hades: [references.md](references.md) |
| PvP (parked: only if the owner asks) | [pvp.md](pvp.md) |

## Combat design section to file

The combat design's rules cite each other by section number ("section
3.4", "(10.7)"). Its headings keep those numbers:

| Section | File |
|---|---|
| 1 Design goals | [goals.md](goals.md) |
| 2 Glossary | [glossary.md](glossary.md) |
| 3 Turn order, 4 Speed, 5 Action economy | [timeline.md](timeline.md) |
| 6 Map and movement | [map.md](map.md) |
| 7 Information, 8 Randomness | [information.md](information.md) |
| 9 Stats, gear, consumables; 10 Party and heroes | [heroes-and-gear.md](heroes-and-gear.md) |
| 11 Enemies | [enemies.md](enemies.md) |
| 12 PvP considerations | [pvp.md](pvp.md) |
| Decision log | at the end of each topic file |
| Open questions | at the end of each topic file, with their original numbers |
| 15.1 to 15.7 Setting | [setting.md](setting.md) |
| 15.8 Hero roster | [roster.md](roster.md) |
| 16 References | [references.md](references.md) |
| 17 Keywords and effects | [keywords.md](keywords.md) |
| 18 The caravan's camel | [camel.md](camel.md) |
| 19 Run progression | [progression.md](progression.md) |

## Decisions

**Combat and game design** decisions are in each topic file, marked
**Decided** or **Proposed**, with a decision log at the end of the file.
Run-level decisions: a run is a **route map with route choices** (as in
Slay the Spire or Monster Train; node types and layout are Phase 2's
design work), passing through four **regions** (six until 2026-10-26; how many stages each has is open), the last
ending in a boss that counters the player's build, in
a fixed order: Steppe, China, Persia, Byzantine
([setting.md](setting.md), 15.3a; [progression.md](progression.md), owner 2026-10-24 and 2026-10-26); the party grows by
**provisions** (stat points, 2 per region) and one **upgrade offer** per region; route maps, encounters and recruitment offers come from the
run's seed. **Multiplayer and architecture** decisions are numbered:

| | Decision | File |
|---|---|---|
| D1 | Ghosts only (rival caravans); no live opponents; no real-time turn timers | [ghosts.md](ghosts.md) |
| D2 | A rival caravan fight: PvP-style maps; a beaten caravan drops part of its gear and one of its heroes may join your next recruitment offer | [ghosts.md](ghosts.md) |
| D3 | One Durable Object per run; one active run per player key. **Replaced 2026-10-25:** the run plays in the browser, one a browser | [architecture.md](architecture.md), [../client-side-runs.md](../client-side-runs.md) |
| D4 | No accounts; an anonymous player key. **Replaced 2026-10-25:** no player key; the run is the browser's | [architecture.md](architecture.md), [../client-side-runs.md](../client-side-runs.md) |
| D7 | Runs get their own Durable Object class (`RunRoom`); plain HTTP. **Replaced 2026-10-25:** the engine's run host, in the page | [architecture.md](architecture.md), [../client-side-runs.md](../client-side-runs.md) |
| D8 | Rival caravans: at most one per fight; a player faces each run's caravan at most once; pool per stage | [ghosts.md](ghosts.md) |
| D9 | A caravan's kills reward its owner: a kill is a full party wipe; unique players slain; recognition unlocks | [ghosts.md](ghosts.md) |
| D10 | Built in this repository, for now | [architecture.md](architecture.md) |
| D11 | Complete information: every unit's stats shown, enemies' included; enemy ability options can be previewed; only intent is hidden | [architecture.md](architecture.md) |

D5 and D6 were withdrawn ([history.md](history.md)).

**Changing a decision:** edit its entry so it states the current decision
and its reason, move the replaced approach to [history.md](history.md),
and update this index.

## Out of scope

- Live opponents and real-time turn timers in the standard game (D1);
  opt-in PvP is a future mode ([pvp.md](pvp.md)), not part of these
  phases.
- Accounts, cross-device runs, moving a player key (D4, later).
- A global leaderboard (D9).
- More than one rival caravan in a fight (D8).
