# Plan: Silk Road Run

Status: **Phase 1 built (2026-10-19), with placeholder hero numbers.**
One fight against the AI plays end to end: the rules in
`packages/games/silk-road-run/src/rules/`, `RunRoom` and
`PlayerLedger` in `@canvas/server`, the page at `/play/silk-road-run`.
The page opens on a start menu (2026-10-21): the game in brief, which of
the heroes to take (one to three of four; the camel always comes), and Start;
`POST /runs` takes the `party`. A run is three stages, each a fight (owner, 2026-10-21;
`STAGES` in `src/rules/config.ts`): the enemy brings one random hero and
two wolves, then two random heroes and a wolf, then all three heroes.
Winning a stage offers Next stage (`POST /runs/:id/next`); the surviving
heroes and the camel go on at full health, the fallen are gone for the
run; winning the third stage wins the run.
What the builder decided and where it departs from the brief is in
[phase-1-brief.md](phase-1-brief.md#11-as-built-2026-10-19). The engine
has hex geometry, a hex grid system, sprites and scaled pixel-art
rendering ([architecture.md](architecture.md),
[art-direction.md](art-direction.md)). The combat design defines the game;
the multiplayer design (ghosts as **rival caravans**, built last) is
settled. Built in this repository (D10). The folder name,
`roguelike-tactics`, predates the title.

The fourth hero, the **Modao Vanguard** (2026-10-22), is built for
playtesting with track Push and a new Barrier rule, and revised after
the owner's first playtest (Hold the Line, the first built passive; Reap
a cone; Advance a charge; Barrier 40)
([roster.md](roster.md), [keywords.md](keywords.md), measurements in
[balance.md](balance.md#the-modao-vanguard-2026-10-22)); the enemy draws
its stage heroes from all four.

The Storm Caller and the Bökh Champion have new kits for playtesting
(2026-10-22), aimed at a counter loop among the three prototype heroes:
hail Pushes in an area, Sunlight no longer cleanses, the Champion is
Inevitable, Grapple Pins, and Throw needs a grapple
([roster.md](roster.md)).

**Next step:** the owner sets the three prototype heroes' stat numbers and
ability values (replacing the placeholders in `src/rules/config.ts`);
everything waiting on the owner is in
[owner-decisions.md](owner-decisions.md). How a stalled fight ends is
decided (owner, 2026-10-21) and built in the fight: the caravan's
**camel**, a unit that can't attack, which wins the fight by reaching
the exit and loses the run by dying ([camel.md](camel.md)). A measured balance review
(2026-10-20) proposes numbers and the principles for re-tuning:
[balance.md](balance.md). Then Phase 2
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
compact hex maps. Turn order is a track of slots: each action's cost,
divided by the unit's speed, sets how far its card moves; information is complete and randomness minimal;
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
| Stats, gear, party, heroes' systems, recruitment, upgrades | [heroes-and-gear.md](heroes-and-gear.md) |
| Keywords and effects: statuses, track and board effects, damage, healing, stat changes | [keywords.md](keywords.md) |
| Tuning numbers, or balancing a new hero, ability, keyword or gear: what each ability and stat is worth, measured; the proposed tuning; principles for re-tuning | [balance.md](balance.md) |
| The twelve heroes | [roster.md](roster.md) |
| Enemies, bosses, difficulty | [enemies.md](enemies.md) |
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

## Decisions

**Combat and game design** decisions are in each topic file, marked
**Decided** or **Proposed**, with a decision log at the end of the file.
Run-level decisions: a run is a **route map with route choices** (as in
Slay the Spire or Monster Train; node types and layout are Phase 2's
design work), passing through six **regions** of several levels each, in
a fixed order: Steppe, China, India, Persia, Arabia, Byzantine
([setting.md](setting.md), 15.3a); route maps, encounters and recruitment offers come from the
run's seed. **Multiplayer and architecture** decisions are numbered:

| | Decision | File |
|---|---|---|
| D1 | Ghosts only (rival caravans); no live opponents; no real-time turn timers | [ghosts.md](ghosts.md) |
| D2 | A rival caravan fight: PvP-style maps; a beaten caravan drops part of its gear and one of its heroes may join your next recruitment offer | [ghosts.md](ghosts.md) |
| D3 | One Durable Object per run; one active run per player key | [architecture.md](architecture.md) |
| D4 | No accounts; an anonymous player key | [architecture.md](architecture.md) |
| D7 | Runs get their own Durable Object class (`RunRoom`); plain HTTP | [architecture.md](architecture.md) |
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
