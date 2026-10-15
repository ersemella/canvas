# Plan: roguelike tactics (working name)

Status: **designed, nothing built.** The **combat design** (draft v1.7,
imported 2026-10-15) defines the game. The multiplayer design — ghosts as
**rival caravans** — is settled (D1–D10, owner, 2026-10-13 to 10-15);
D11 is open. Built in this repository (D10).

**Next step: decide what Phase 1 needs** ([phases.md](phases.md#before-phase-1)):
the run structure (open question 34, below), previews versus hidden stats
(D11, [architecture.md](architecture.md)), and starting values for costs
and map size. The combat design's other open questions sit at the end of
each topic file. PvP is parked ([pvp.md](pvp.md)).

The plan is split by topic so a session loads only what its task needs.
History: the multiplayer plan was one file until 2026-10-15
(`docs/plans/roguelite-invasions.md`, then `docs/plans/roguelite/`); the
combat design was a single document from a separate Claude session. Git
history holds both.

## The game

A turn-based **tactical roguelike**: "Into the Breach with a Final Fantasy
Tactics timeline and a Darkest Dungeon roster", on a **fantasy Silk Road**
where rival caravans race along the road. A party of up to four heroes,
recruited during the run from a roster of twelve, fights a series of
battles on compact hex maps. Turn order is a shared clock every action is
priced on; information is complete, randomness minimal, stats hidden but
discoverable. Heroes who die are gone for the run.

Multiplayer is asynchronous: some fights are against a **rival caravan**
— an AI-controlled copy of another player's party, taken when they had
won the same number of fights — at most once per player per run, and
never more than one per fight. When a caravan kills, its owner earns
recognition and permanent unlocks, scored by unique players slain. No
live opponents and no real-time turn timers.

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
| D2 | A rival caravan fight: a beaten caravan drops part of its gear; heroes lost to it die as usual | [ghosts.md](ghosts.md) |
| D3 | One Durable Object per run; one active run per player key | [architecture.md](architecture.md) |
| D4 | No accounts; an anonymous player key | [architecture.md](architecture.md) |
| D5 | *Withdrawn:* signed character snapshots | [history.md](history.md) |
| D6 | *Withdrawn:* per-level rooms named by run and level | [history.md](history.md) |
| D7 | Runs get their own Durable Object class (`RunRoom`); plain HTTP | [architecture.md](architecture.md) |
| D8 | Rival caravans: at most one per fight; a player faces each run's caravan at most once; pool per stage | [ghosts.md](ghosts.md) |
| D9 | A caravan's kills reward its owner: unique players slain, recognition and unlocks (what counts as a kill: open) | [ghosts.md](ghosts.md) |
| D10 | Built in this repository, for now (a split was weighed and dropped) | [history.md](history.md) |
| D11 | Previews versus hidden stats (**open**) | [architecture.md](architecture.md) |

To change one, edit its entry in its topic file, keep the old reasoning in
a dated "Revised" note (and in [history.md](history.md) for a replaced
design), and update this index.

## Open questions that span the game

From the combat design's section 14 (original numbers):

19. ~~Whether to use saved player builds as opponents (asynchronous PvP or
    PvE).~~ **Decided 2026-10-15:** yes — rival caravans
    ([ghosts.md](ghosts.md)).
34. **Run structure:** whether a run is a pure sequence of fights (as in
    Slice & Dice) or has a map with route choices (as in Slay the Spire or
    Monster Train), and where recruitment, caravanserais, bazaars and
    optional risk appear in it. Also decides where rival caravan fights
    sit in a run (D8) and what "stage" means beyond "fights won". **Needed
    before Phase 2; shapes Phase 1's run state.**

## Out of scope

- Live opponents and real-time turn timers in the standard game (D1);
  opt-in PvP is a future mode ([pvp.md](pvp.md)), not part of these
  phases.
- Accounts, cross-device runs, moving a player key (D4, later).
- A global leaderboard (D9).
- More than one rival caravan in a fight (D8).
