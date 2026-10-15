# Plan: roguelike tactics (working name)

Status: **designed, nothing built.** The **combat design** (draft v1.7,
imported 2026-10-15) defines the game. The multiplayer design — ghosts as
**rival caravans**, built **last** — is settled (D1–D11, owner,
2026-10-13 to 10-15). Built in this repository (D10).

**Next step:** answer the questions from the consistency review (below),
then pick starting values for costs and map size
([phases.md](phases.md#before-phase-1)) and start Phase 1. The combat
design's other open questions sit at the end of each topic file. PvP is
parked ([pvp.md](pvp.md)).

The plan is split by topic so a session loads only what its task needs.
History: the multiplayer plan was one file until 2026-10-15
(`docs/plans/roguelite-invasions.md`, then `docs/plans/roguelite/`); the
combat design was a single document from a separate Claude session. Git
history holds both.

## The game

A turn-based **tactical roguelike**: "Into the Breach with a Final Fantasy
Tactics timeline and a Darkest Dungeon roster", on a **fantasy Silk Road**
where rival caravans race along the road. A party of up to four heroes,
recruited during the run from a roster of twelve, travels a **route map**
of the road — fights, caravanserais, bazaars, recruitment — and fights on
compact hex maps. Turn order is a shared clock every action is priced on;
information is complete and randomness minimal; your own heroes' stats are
shown, enemies' are hidden but discoverable. Heroes who die are gone for
the run; a party wipe ends it.

Multiplayer is asynchronous: some fights, on their own maps, are against
a **rival caravan** — an AI-controlled copy of another player's party,
taken at the same stage of their run — each run's caravan met at most once
per player, never more than one per fight. When a caravan wipes a party,
its owner earns recognition and permanent unlocks, scored by unique
players slain; a beaten caravan's hero may join your next recruitment
offer. No live opponents and no real-time turn timers.

It runs on the existing stack: one Durable Object per run, a pool of
rival caravans per stage, a ledger per player, an anonymous player key.

## What to read for a task

Always read this file first. Then:

| Task | Read |
|---|---|
| Any design work | [goals.md](goals.md) (design goals, intended feel, types of fun) |
| Looking up a term | [glossary.md](glossary.md) — look up, don't read through |
| Turn order, speed, what a turn can do | [timeline.md](timeline.md) |
| Maps, movement, line of fire, deployment | [map.md](map.md) |
| Visibility, previews, randomness | [information.md](information.md) |
| Stats, gear, party, heroes' systems, recruitment, upgrades | [heroes-and-gear.md](heroes-and-gear.md) |
| The twelve heroes | [roster.md](roster.md) |
| Enemies, bosses, difficulty | [enemies.md](enemies.md) |
| Setting, cultures, folklore | [setting.md](setting.md) |
| Rival caravans, the pool, rewards, the ledger | [ghosts.md](ghosts.md) |
| Server classes, routes, previews vs hidden stats, platform constraints, Free-plan limits | [architecture.md](architecture.md) |
| Building a phase | [phases.md](phases.md), plus the topic files that phase names; then `CLAUDE.md` and `.claude/skills/verify/SKILL.md`, and the parts of `ARCHITECTURE.md` it touches |
| Revisiting a past or withdrawn decision | [history.md](history.md) |
| Other games: copies of players, live invasions | [prior-art.md](prior-art.md); games the combat design draws on: [references.md](references.md) |
| PvP (parked — only if the owner asks) | [pvp.md](pvp.md) |

## Combat design section → file

The combat design's rules cite each other by section number ("section
3.4", "(10.7)"). Its headings keep those numbers:

| Section | File |
|---|---|
| 1 Design goals | [goals.md](goals.md) |
| 2 Glossary | [glossary.md](glossary.md) |
| 3 Turn order · 4 Speed · 5 Action economy | [timeline.md](timeline.md) |
| 6 Map and movement | [map.md](map.md) |
| 7 Information · 8 Randomness | [information.md](information.md) |
| 9 Stats, gear, consumables · 10 Party and heroes | [heroes-and-gear.md](heroes-and-gear.md) |
| 11 Enemies | [enemies.md](enemies.md) |
| 12 PvP considerations | [pvp.md](pvp.md) |
| 13 Decision log | split: each row is at the end of its topic's file |
| 14 Open questions | split: each is at the end of its topic's file; 19 and 34 are below |
| 15.1–15.7 Setting | [setting.md](setting.md) |
| 15.8 Hero roster | [roster.md](roster.md) |
| 16 References | [references.md](references.md) |

## Decisions

**Combat and game design** decisions are in each topic file, marked
**Decided** or **Proposed**, with the decision log rows at the end of the
file. **Multiplayer and architecture** decisions are numbered:

| | Decision | File |
|---|---|---|
| D1 | Ghosts only (rival caravans); no live opponents; no real-time turn timers | [ghosts.md](ghosts.md) |
| D2 | A rival caravan fight: its own maps; a beaten caravan drops part of its gear and one of its heroes may join your next recruitment offer | [ghosts.md](ghosts.md) |
| D3 | One Durable Object per run; one active run per player key | [architecture.md](architecture.md) |
| D4 | No accounts; an anonymous player key | [architecture.md](architecture.md) |
| D5 | *Withdrawn:* signed character snapshots | [history.md](history.md) |
| D6 | *Withdrawn:* per-level rooms named by run and level | [history.md](history.md) |
| D7 | Runs get their own Durable Object class (`RunRoom`); plain HTTP | [architecture.md](architecture.md) |
| D8 | Rival caravans: at most one per fight; a player faces each run's caravan at most once; pool per stage | [ghosts.md](ghosts.md) |
| D9 | A caravan's kills reward its owner: a kill is a full party wipe; unique players slain, recognition and unlocks | [ghosts.md](ghosts.md) |
| D10 | Built in this repository, for now (a split was weighed and dropped) | [history.md](history.md) |
| D11 | Own units' stats fully viewable; enemies send the browser derived numbers only | [architecture.md](architecture.md) |

To change one, edit its entry in its topic file, keep the old reasoning in
a dated "Revised" note (and in [history.md](history.md) for a replaced
design), and update this index.

## Open questions that span the game

From the combat design's section 14 (original numbers):

19. ~~Whether to use saved player builds as opponents (asynchronous PvP or
    PvE).~~ **Decided 2026-10-15:** yes — rival caravans
    ([ghosts.md](ghosts.md)).
34. ~~Run structure: a pure sequence of fights or a map with route
    choices.~~ **Decided 2026-10-15: a route map with route choices** (as
    in Slay the Spire or Monster Train). Node types and layout are Phase
    2's design work ([phases.md](phases.md)).

## Questions from the consistency review (2026-10-15)

Places where two parts of the plan disagree or leave a gap. Each has a
suggestion; none is decided.

1. **What "stage" means on a route map.** Rival caravans are matched by
   stage (D8), defined as fights won. On a route map two players at the
   same point can have won different numbers of fights (one took rests and
   bazaars). *Suggested:* stage = position along the road (the route
   map's row or step), which is also what difficulty scales with.
2. **Are recruitment offers seeded?** The combat design leaves it open
   (10.7); the architecture assumed yes (D3). *Suggested:* yes — the whole
   route map, encounters and offers come from the run's seed, so restarting
   can't reroll them.
3. **Where unlocks come from.** D9 earns them from your caravans' kills;
   the combat design suggests unlocks from fights won (10.7). *Suggested:*
   both — unlocks from fights won (everyone progresses), and separate
   recognition-flavoured unlocks (cosmetics, titles) from caravan kills, so
   power never depends on other players dying.
4. **Stats of gear and recruits you're offered.** D11 shows your own
   units' stats; it doesn't say whether gear in a bazaar or a recruit in
   an offer shows exact stats before you take it. Rarity (9.4–9.5) was
   designed as the shortcut for hidden stats. *Suggested:* show exact stats
   for anything you could own (consistent with own units), and keep rarity
   as the quick read for enemies.
5. **A caravan's hero joining you:** with its gear and upgrades, or bare
   like any recruit (10.9)? And can it duplicate a hero you already have
   (duplicates in one party are open, 10.4)? *Suggested:* bare, like any
   recruit, and only offered if it isn't already in your party.
6. **Rival caravan maps and deployment.** D2 gives caravan fights their
   own maps; the combat design's PvP maps are symmetric or mirrored with
   opposite deployment zones (6.6, 12). *Suggested:* use PvP-style maps for
   caravan fights — a fair mirror match against another player's build,
   and the same maps a future arena (pvp.md) would need.

## Out of scope

- Live opponents and real-time turn timers in the standard game (D1);
  opt-in PvP is a future mode ([pvp.md](pvp.md)), not part of these
  phases.
- Accounts, cross-device runs, moving a player key (D4, later).
- A global leaderboard (D9).
- More than one rival caravan in a fight (D8).
