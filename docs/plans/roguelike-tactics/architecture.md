# Roguelike tactics: architecture

How the game runs on the platform: one Durable Object per run, the player
key, the classes and routes it adds, platform constraints, and what it
costs on the Free plan. Decisions D3, D4, D7, D10, D11.

> **Replaced in part, 2026-10-25:** the run now plays in the browser
> ([../client-side-runs.md](../client-side-runs.md)). D3, D4 and D7 and
> the server-authoritative rules below describe the design as it was
> until then; *Long-lived storage and cost* no longer counts runs (they
> make no requests). They stay for rival caravans, which would need a
> server again.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which has the status, the next step and an index of every decision.
> Abandoned approaches are in [history.md](history.md).

## What already fits (don't rebuild it)

- **Server-authoritative rules, as poker does.** The run must live on the
  server even though nobody else is in your fight: rival caravans and
  rewards affect other players, so a client-run game could forge an
  overpowered party, seed the pool with it and farm kills, and permadeath
  couldn't be enforced. The rules are a module in the game package run by
  the Worker, like poker's `./server`. Combat is deterministic (no hit
  chance, no damage variance), so the server can replay and
  verify a fight from its seed and actions.
- **Hidden information.** No fog of war and no hidden stats: every fight
  starts with complete information, every unit's stats included
  ([information.md](information.md), 7.4; D11). What stays hidden is what
  the AI will choose and the run's seed (future encounters, offers and
  damage rolls), so the view never carries either.
- **Durable Object storage is long-lived:** kept until code deletes it
  (`GameRoom` rooms vanish because `GameRoom` deletes itself).
  SQLite-backed classes get up to 10 GB per object, on the Free plan too.
- **Rendering.** Canvas2D through the engine; hex support is new (see
  platform constraints).

### D3. One Durable Object per run

A run is one room, `idFromName('run:' + runId)`, for its whole life: the
party (heroes, gear, upgrades, health), the route map, the current fight,
what happens between fights (recovery, recruitment offers, milestone
upgrades, bazaars; sections 9 and 10), and the outcome. Everything is
generated once from the run's seed and stored, so reloading or restarting
can't reroll the map, an encounter or a recruitment offer (10.7).

**Why:** with nobody else in a fight, there's nothing a per-fight room or
client-held state would buy, and the run never leaves the server, so there
is nothing to forge or replay.

**Consequences:**
- **One active run per player key.** Starting a new run while one is
  active means abandoning it, which counts as a death. The ledger (D9)
  remembers the active run, so a returning player resumes it with only
  their player key.
- A finished run's room can delete its storage after a few days (its
  result is in the ledger). Idle runs cost only storage: a room with no
  request in flight isn't billed for duration.
- **A run saved in an older format is ended, not migrated** (owner,
  2026-10-22). The run's state carries `RUN_FORMAT` (`src/rules/run.ts`),
  bumped with any change to what a run saves that an older run can't play
  on. The room asks the rules (`RunSystem.outdated`) before anything else:
  an outdated run is refused with `410 expired`, and if it was still
  active it's marked `expired` and leaves the ledger's active slot, so the
  page starts a new one. The rules never handle an old shape. Re-tuned
  stats aren't a format change: a run in progress takes today's
  (`refreshStats`).

### D4. No accounts; an anonymous player key

Identity is a **player key**: a random secret the browser makes once and
keeps in `localStorage`. The server stores only its SHA-256 hash. It's
sent in a request header (`Authorization: Bearer <key>`), never in URLs.
No sign-in, email or recovery; per device: clearing site data loses the
key, the active run and the rewards. It owns a run and earns D9's rewards.

**Revisit if** losing keys becomes a real complaint, players want to move
between devices (a "move to another device" link, with the key in a URL
fragment as the async plan's rejoin link does, is the cheap step), or
farming (D9) needs a real identity to stop.

### D7. Runs get their own Durable Object class

A `RunRoom` class in `@canvas/server`, not an extension of `GameRoom`.

**Why:** a run has no lobby, host, seats or turn timer, and is owned by a
player key: nothing like a poker room. Keeping it separate leaves poker's
code path untouched.

**Consequences:**
- **Poker is untouched by construction:** no changes to `GameRoom`,
  `RoomPolicy` or `routes/rooms.ts`.
- **Its own rules contract**, `RunSystem` in `@canvas/engine/server`
  (exact shape settled while building): create a run (seed, unlocks),
  apply an action (the player's turn, then every card's turn up to the
  player's next one on the track), a public view (D11), the run's status (in a fight, between fights,
  over), the party copy offered as a rival caravan, placing a caravan in
  its deployment zone, and its events (killed a hero, wiped a party,
  defeated). The game package's `./server` exports it;
  `scripts/gen-game-registry.mjs` learns to tell it from a `ServerSystem`
  (for example a `kind` field) and generates a registry for each.
- **Plain HTTP, no WebSocket.** With one player and no timer, nothing
  needs pushing: each action is one request returning the new view (routes
  in [phase-1-brief.md](phase-1-brief.md), section 8). Simpler than the
  socket handling in `GameRoom`, and reloading is just a `GET`. Opt-in PvP
  (future) would add a WebSocket to the same room; to keep that cheap,
  every response carries the whole public view and a version number, so a
  socket can later push exactly the same message.

### D11. Complete information, previews in the browser

- **Every unit's stats are sent and shown,** enemies' included, on each
  unit's stat sheet. Gear and recruits you're offered show exact stats.
- **Previews are computed in the browser** from the view: your own
  actions, and each enemy's ability options (what it could reach and the
  effect of each ability, 7.2), never which one it will choose.
- **Hidden:** the AI's choice, which the server makes only when the
  enemy's card is reached, and the run's seed, which would reveal damage
  rolls (8.1), encounters and offers.

**Why:** hidden enemy stats were revealed by the first full-number preview
anyway, so they added a chore rather than uncertainty; this is a strategy
game, where the uncertainty is the opponent's choice. Sending stats also
keeps previews free and instant with no request per tap, and removes the
redaction that hidden stats needed.

**Consequences:**
- The view carries no secrets except what the server never computes
  ahead (the AI's choice) and the seed, so there is nothing to redact per
  viewer in a fight.
- **Rival caravans** (D8) are enemies: their stats are shown the same way.

### D10. Built in this repository, for now

The game is built here, in the `canvas` monorepo: the game package
`packages/games/silk-road-run`, with `RunRoom`, `GhostPool` and
`PlayerLedger` in `@canvas/server`.

**Why:** most of the game's server code (its Durable Objects and routes)
belongs to the platform's Worker, so a separate repository would make most
changes span two repos. A standalone repository was weighed and dropped;
what was learned is in [history.md](history.md).

## Platform changes (poker must not change)

- **`RunSystem` contract** in `@canvas/engine/server`, and registry support
  in `scripts/gen-game-registry.mjs` (D7).
- **`RunRoom` DO class** and its HTTP routes (`/runs…`) in their own route
  module (D3, D7).
- **`GhostPool` DO class**, one per stage (D8).
- **`PlayerLedger` DO class**, one per player key (D9).
- **Room-to-room calls** (offer, pick, credit) only through DO stubs, never
  public routes.
- `wrangler.toml`: bindings and `new_sqlite_classes` migrations for each
  class, added in the phase that needs it.
- **No changes to `GameRoom`, `RoomPolicy` or `routes/rooms.ts`.**

## Platform constraints

- **Hex grid in the engine (built 2026-10-19).** Hex geometry is
  `packages/engine/src/math/Hex.ts`, exported from `@canvas/engine` and,
  DOM-free, from `@canvas/engine/server` so the rules and the renderer
  share it: axial coordinates, distance, neighbours and opposite pairs
  (flanking, 6.3), straight hex lines, areas and rings, offset-rectangle
  maps, pixel conversion. `hexLineSides` returns both hexes where a line
  runs along a border, for rule 29. Drawing is the `hex` render type;
  `HexGridSystem` places `HexPosition` entities on a `HexGrid` and turns
  taps into `hexgrid:click`. The rules themselves (movement, line of fire,
  6.7) belong in the game package. Caravan picks its own taps
  and hover (`TacticsInputSystem`), since its board isn't a rectangle and
  its track cards are on the canvas.
- **No camera in the engine.** Games render to a fixed canvas (600×400 by
  default, `packages/web/src/pages/GamePage.tsx`); nothing scrolls. The
  compact maps (6.1) should fit one screen, so a camera may never be
  needed.
- **Touch play.** The arcade supports touch (Pointer Events, swipe keys);
  deployment, hex selection and previews must work on a phone (no hover:
  previews on first tap, commit on second).
- **The track** (3.1, 7.1) is the centrepiece of the UI and needs room
  on screen beside the map: a scrollable window of roughly the next 30
  slots, with cards that preview when tapped.

## Long-lived storage and cost

| What | Where | Kept |
|---|---|---|
| A run | `RunRoom` | while active; deleted a few days after it ends |
| Rival caravan pool, legends | `GhostPool` per stage | permanently; pool capped |
| Active run, lineages faced, victims, unlocks | `PlayerLedger` per key | permanently; a few KB |

**The owner's account is on Workers Free; stay on it until usage says
otherwise.** From Cloudflare's docs (checked 2026-10-13), Free allows, per
day, shared across the whole account (poker included):

| Limit (Free) | Per | What uses it here |
|---|---|---|
| 100,000 Worker requests | day | every action (previews are local, D11) |
| 100,000 Durable Object requests | day | every action, plus room-to-room calls |
| 100,000 SQLite rows written | day | saving the run after each action; credits |
| 5 million rows read | day | rarely the constraint |
| 13,000 GB-s DO duration | day | about 28 hours of active objects; idle ones are free |
| 5 GB stored | total | runs, pools, ledgers: far below |
| 10 ms CPU | request | enemy and rival caravan AI between the player's turns, encounter generation |

Going over a daily limit makes further operations **fail until 00:00
UTC**: the game (and poker) stop working for everyone, rather than
costing money. Rough capacity: one request and about one row written per
action, so about 100,000 actions a day. A fight with four heroes might
take 40 to 80 player actions (plus deployment), so on the order of 1,000
to 2,000 fights a day. Plenty for building, testing and a small audience.

To stretch Free:
- **One request per turn:** a unit's move and action (5.1) are sent
  together, and each AI turn is a request of its own (`continue`, owner,
  2026-10-24: each gets its own 10 ms), so a fight takes about twice the
  player's turns in requests; the clock never needs a request of its own.
- **Previews are local** (D11).
- **One row per save:** store the run's state as one value, written once
  per action; no alarms on `RunRoom` (each `setAlarm()` is a row written).
- **Cheap AI:** the AI may take several turns in one request, so keep each
  AI turn to a few ms: compact hex maps, bounded search over reachable
  hexes and targets; generate encounters within the same budget.

**Move to Workers Paid** ($5/month minimum; 30 s CPU by default, no daily
caps, pay beyond generous monthly allowances) when the dashboard shows
daily usage regularly past about 70% of a limit, or CPU errors (`1102`,
`exceededCpu`) appear. On Paid, add the budget alert from the async plan's
Phase 7.

What's missing is a **query across objects** (no global leaderboard or
analytics), already noted in `ARCHITECTURE.md`; a D1 database answers that
if it's ever wanted.
