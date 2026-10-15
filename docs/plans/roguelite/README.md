# Plan: a roguelite where other players' ghosts invade your level

Status: **proposed — feasibility checked, nothing built.** Ghost-only (no
live invasions), built in this repository (D10). Decisions D1–D10 are
confirmed by the owner (2026-10-13 to 10-15); what's left open is tuning
(chances, caps, N) and the `RunSystem` contract's exact shape, settled
while building.

**Next step: answer the base game's open questions**
([base-game.md](base-game.md)), then level design. PvP is parked
([pvp.md](pvp.md)).

The plan is split by topic so a session loads only what its task needs.
Until 2026-10-15 it was one file, `docs/plans/roguelite-invasions.md`;
its git history holds every earlier revision.

## What to read for a task

Always read this file first. Then:

| Task | Read |
|---|---|
| Answering the open questions, level design | [base-game.md](base-game.md) |
| Ghosts, the ghost pool, rewards, the ledger | [ghosts.md](ghosts.md) |
| Server classes, routes, storage, Free-plan limits | [architecture.md](architecture.md) |
| Building a phase | [phases.md](phases.md), plus the topic files that phase names; then `CLAUDE.md` and `.claude/skills/verify/SKILL.md`, and the parts of `ARCHITECTURE.md` it touches |
| Revisiting a past or withdrawn decision | [history.md](history.md) |
| Comparing with other games | [prior-art.md](prior-art.md) |
| PvP (parked — only if the owner asks) | [pvp.md](pvp.md) |

## The game

A turn-based RPG roguelite with permadeath. A player works through
randomly generated levels against enemy AI; reaching the level's door
takes them to the next level. Between levels the player manages gear and
levels up. **Turns are untimed**: the game is meant to be strategic.

Multiplayer is asynchronous: a level may be invaded by a **ghost** — an
AI-controlled copy of another player's character, taken when that player
had cleared the **same number of levels** as you. At most **one ghost per
level**. When a ghost kills someone, the player it was copied from earns
recognition and permanent unlocks.

## Verdict

Feasible on the current stack (Worker + Durable Objects), and much smaller
than the live-invasion designs:

- **One Durable Object per run** holds the character, the current level and
  the run's outcome. All game rules run there; the browser only displays
  state and sends actions.
- **No live multiplayer:** no turn timers, no players joining a running
  level, no hand-off between rooms.
- **A ghost pool per depth** supplies ghosts; a **ledger per player**
  records ghost kills and unlocks.
- **Identity is an anonymous player key** kept in the browser (no
  accounts).

## Decisions

Same format as the async plan: to change one, edit its entry in its
topic file, keep the old reasoning (in a dated "Revised" note, and in
[history.md](history.md) for a replaced design), and update this index.

| | Decision | File |
|---|---|---|
| D1 | Ghosts only; no live invasions; untimed turns | [ghosts.md](ghosts.md) |
| D2 | A ghost encounter: a beaten ghost drops part of its gear; dying to one is an ordinary death | [ghosts.md](ghosts.md) |
| D3 | One Durable Object per run; one active run per player key | [architecture.md](architecture.md) |
| D4 | No accounts; an anonymous player key | [architecture.md](architecture.md) |
| D5 | *Withdrawn:* signed character snapshots | [history.md](history.md) |
| D6 | *Withdrawn:* per-level rooms named by run and level | [history.md](history.md) |
| D7 | Runs get their own Durable Object class (`RunRoom`); plain HTTP | [architecture.md](architecture.md) |
| D8 | One ghost per level; a player faces each run's ghost at most once; pool per depth | [ghosts.md](ghosts.md) |
| D9 | A ghost's kills reward its owner: unique players slain, recognition and unlocks | [ghosts.md](ghosts.md) |
| D10 | Built in this repository, for now (a split was weighed and dropped) | [history.md](history.md) |

## Out of scope

- Live invasions and turn timers in the standard game (D1); opt-in PvP is
  a future mode ([pvp.md](pvp.md)), not part of these phases.
- Accounts, cross-device runs, moving a player key (D4, later).
- A global leaderboard (D9).
- More than one ghost in a level (D8).
