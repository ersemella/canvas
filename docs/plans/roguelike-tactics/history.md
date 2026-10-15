# Roguelike tactics: how the design got here

Earlier designs, withdrawn decisions (D5, D6) and the repository decision
(D10). Read when revisiting a past choice; not needed for day-to-day work.

> Part of the roguelike tactics plan — start at [README.md](README.md),
> which has the status, the next step and an index of every decision.

### D5. Withdrawn: signed character snapshots

Needed only while the character left the server between levels (when
breaks ran in the browser). With the whole run in one room (D3), the
character never leaves the server. See [history.md](history.md).

### D6. Withdrawn: per-level rooms named by run and level

Their purpose was to stop a client replaying an old signed snapshot to
undo a death. No snapshots, nothing to replay. See [history.md](history.md).

### D10. Built in this repository, for now

**Decision (owner, 2026-10-15):** the game is built here, in the `canvas`
monorepo, as the plan's phases describe (`packages/games/roguelite` — since 2026-10-15 `packages/games/roguelike-tactics` — with
`RunRoom`, `GhostPool` and `PlayerLedger` in `@canvas/server`). A
separate repository was chosen and then dropped the same day.

**What was learned, for if it's revisited:**
- Three shapes were weighed: stay here; a game repo built into the arcade
  (needs a published engine and `gen-game-registry.mjs` taking external
  packages, and most of this game's code — its Durable Objects and routes
  — would still live here, so most changes span two repos); or a
  **standalone game** with its own Worker, Durable Objects, page and
  deploy, using a published engine. The standalone shape was the one
  chosen, with the engine as a git dependency (`canvas` is public, so no
  token).
- **A plain git dependency on the engine doesn't work:** it installs an
  empty package, because the engine ships only its built `dist/`, which
  isn't committed, and nothing builds it on install. What works (tested
  locally): a tag holding only the built package — `package.json` without
  workspace-only fields, plus `dist/` — consumed as
  `github:ersemella/canvas#engine-v<version>`; it installs, typechecks and
  bundles. A script and a manual *Release engine* workflow that publish
  such tags were added in `782cd97` and reverted when the split was
  dropped; restore them from there.
- The built engine uses extensionless relative imports, so it only loads
  through a bundler (Vite, esbuild, Wrangler), not plain Node.
- GitHub repositories can't be created from a Claude Code cloud session's
  GitHub integration (403); the owner creates them.
- Open then: the same Cloudflare account as `canvas` shares the Free
  plan's daily limits with poker; a separate account would not.

## How the design got here

All on 2026-10-13. Full texts are in git history
(`docs/plans/roguelite-invasions.md`, commits `79b2a9a` to `3bba7a1`).

1. **Live invasions with mutual opt-in at the door** (`79b2a9a`). A player
   at the door after level N chose *Continue alone*, *Open to invasion* or
   *Invade*; the matchmaker paired an *Open* with an *Invade* arriving
   within ~45 s. One room per run; the invader's character was copied into
   the host's room and the outcome copied back with a two-phase
   prepare/commit. Dropped because few matches would happen (two players
   at the same door within seconds) and it needed a door UI, waiting
   window and cancel flow.
2. **Always-on live invasions, timed levels, breaks** (`5e0a2f6` to
   `3bba7a1`). Levels timed turn by turn; untimed breaks between levels as
   the invader's safe point. Breaks ran in the browser, so the character
   crossed them as an HMAC-signed snapshot with break actions replayed on
   the server (D5); each level was its own room named `run:R:n`, whose
   tombstone stopped replaying old snapshots (D6); an invader joined the
   host's level room with a single-use ticket, reserved through their own
   next-level room. Ghosts were added as a fallback when no live invader
   came (D8), then rewards for ghost kills (D9). Owner decisions then:
   always-on, timed solo play kept, invaders at fixed spawn points, level
   rooms as their own class. A review then found that holding breaks on
   the server would remove D5 and most of D6.
3. **Ghost-only** (this version). Removing live invasions removed the need
   for timers, safe points, signed snapshots, per-level rooms, tickets and
   live matchmaking at once, and makes the game strategic and workable at
   any player count. The cost: no live human opponent (D1).
5. **The combat design defines the game** (2026-10-15, owner). A combat
   design document (draft v1.7, written in a separate Claude session) was
   imported and split into this folder (goals, glossary, timeline, map,
   information, heroes-and-gear, enemies, setting, roster, references).
   It makes the game a party of up to four heroes fighting a series of
   battles on compact hex maps, with a shared-clock timeline, complete
   information and hidden stats — replacing the dungeon-crawl
   assumptions (one character, levels with doors, fog of war). Ghosts
   became **rival caravans** (D8): copies of other players' parties met
   as a fight; spawn points became deployment zones; depth became stage.
   The folder was renamed from `docs/plans/roguelite/` to
   `docs/plans/roguelike-tactics/`.

## Superseded: the dungeon-crawl base game questions

Written 2026-10-13 as `base-game.md`, before the combat design existed:
twelve questions to answer before level design, each with a suggested
default. None was answered; the combat design answers or retires them.
Full text in git history.

| # | Question (suggested default) | Now |
|---|---|---|
| 1 | Run length and win condition (fixed depth, final boss) | Open: run structure, combat design open question 34 |
| 2 | What stops resting forever (no regeneration from waiting) | Retired: fights are separate; partial recovery between fights (10.11) |
| 3 | Map size and the screen (one screen, ~30×20 tiles) | Compact hex maps (6.1), size open (open question 9) |
| 4 | Map structure (rooms and corridors) | Hex encounter maps with obstacle, hazard and conceal tiles (6.4) |
| 5 | Movement and turns (8 directions, one action per turn) | Hex movement priced on the shared clock (3–5) |
| 6 | Vision (line of sight, remembered tiles) | No fog of war; complete information (7.4) |
| 7 | The exit door | Retired: no doors; fights, and the run structure (34) |
| 8 | Ghost spawn points (2–3 points, appear after N turns, warn, hunt) | Deployment zones (6.6); rival caravans (D8) |
| 9 | Combat (melee only or ranged and spells) | Line of fire, area and arcing attacks (6.7) |
| 10 | What a level contains | Encounters and enemies (11) |
| 11 | Between levels | Recovery, recruitment, milestone upgrades, bazaars (9–10, 15.3) |
| 12 | Ghost strength (scale to depth, or as built) | Difficulty through enemy builds (11.4); rival caravans come from the same stage; revisit in play |
