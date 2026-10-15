# Roguelite: architecture

How the game runs on the platform: one Durable Object per run, the player
key, the classes and routes it adds, and what it costs on the Free plan.
Decisions D3, D4, D7.

> Part of the roguelite plan — start at [README.md](README.md), which has
> the status, the next step and an index of every decision.

## What already fits (don't rebuild it)

- **Server-authoritative rules, as poker does.** The run must live on the
  server even though nobody else is in your level: ghosts and rewards
  affect other players, so a client-run game could forge an overpowered
  character, seed the ghost pool with it and farm kills — and permadeath
  couldn't be enforced. The rules are a module in the game package run by
  the Worker, like poker's `./server`.
- **Hidden information.** The server sends the client only what the
  character can see (fog of war), as `getPublicState` does for poker.
- **Durable Object storage is long-lived** — kept until code deletes it
  (`GameRoom` rooms vanish because `GameRoom` deletes itself). SQLite-backed
  classes get up to 10 GB per object, on the Free plan too.
- **Rendering.** Engine grid systems and Canvas2D cover a tile-based
  client.

### D3. One Durable Object per run

**Decision (owner, 2026-10-13):** a run is one room, `idFromName('run:' + runId)`, for its
whole life: character, current level (generated once, from a seed, and
stored — reloading can't re-roll it), the between-levels screen, and the
outcome. The between-levels screen is just a state of the run (gear,
levelling up), on the server like everything else.

**Why:** with nobody else in a level, there's nothing a per-level room or
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

**Revised 2026-10-13:** replaces *one room per level, an invasion reuses
the host's* (which itself replaced the first *one room per run*). Back to
one room per run, now without any invader in it.

### D4. No accounts; an anonymous player key

Identity is a **player key**: a random secret the browser makes once and
keeps in `localStorage`. The server stores only its SHA-256 hash. It's sent
in request bodies, never in URLs. No sign-in, email or recovery; per
device — clearing site data loses the key, the active run and the rewards.

**Revisit if** losing keys becomes a real complaint, players want to move
between devices (a "move to another device" link — the key in a URL
fragment, as the async plan's rejoin link — is the cheap step), or farming
(D9) needs a real identity to stop.

**Revised 2026-10-13:** started as "no accounts, identity is per run"; the
player key was added for D9's rewards and is now also what owns a run.

### D7. Runs get their own Durable Object class

**Decision (owner, 2026-10-13, for level rooms; carried to runs):** a new
`RunRoom` class in `@canvas/server`, not an extension of `GameRoom`.

**Why:** a run has no lobby, host, seats or turn timer, and is owned by a
player key — nothing like a poker room. Keeping it separate leaves poker's
code path untouched.

**Consequences:**
- **Poker is untouched by construction:** no changes to `GameRoom`,
  `RoomPolicy` or `routes/rooms.ts`.
- **Its own rules contract**, `RunSystem` in `@canvas/engine/server`
  (proposal): create a run (seed, unlocks), apply an action (the player's
  move, then the enemies' and ghost's turns), a public view, the run's
  status (in a level / between levels / dead), the character copy offered
  as a ghost, placing a ghost at a spawn point, and the ghost events
  (ghost killed the player / ghost defeated). The game package's
  `./server` exports it; `scripts/gen-game-registry.mjs` learns to tell it
  from a `ServerSystem` (e.g. a `kind` field) and generates a registry for
  each.
- **Plain HTTP, no WebSocket** (confirmed). With one player and no timer,
  nothing needs pushing: each action is one request returning the new
  view. Routes like `POST /runs` (start), `GET /runs/:id` (view),
  `POST /runs/:id/actions`; the player key in the body proves ownership.
  Simpler than the socket handling in `GameRoom`, and reloading is just a
  `GET`.

Plain HTTP is fine for the standard mode; opt-in PvP (future) would add a
WebSocket to the same room for pushing the other player's moves. Keep that
cheap: every response carries the whole public view and a version number,
so a socket can later push exactly the same message.

**Revised 2026-10-13:** decided for per-level rooms (`LevelRoom`); with
D3 it's a per-run room instead.

## Platform changes (poker must not change)

- **`RunSystem` contract** in `@canvas/engine/server`, and registry support
  in `scripts/gen-game-registry.mjs` (D7).
- **`RunRoom` DO class** and its HTTP routes (`/runs…`) in their own route
  module (D3, D7).
- **`GhostPool` DO class**, one per depth (D8).
- **`PlayerLedger` DO class**, one per player key (D9).
- **Room-to-room calls** (offer, pick, credit) only through DO stubs, never
  public routes.
- `wrangler.toml`: bindings and `new_sqlite_classes` migrations for each
  class, added in the phase that needs it.
- **No changes to `GameRoom`, `RoomPolicy` or `routes/rooms.ts`.**

## Long-lived storage and cost

| What | Where | Kept |
|---|---|---|
| A run | `RunRoom` | while active; deleted a few days after it ends |
| Ghost pool, legends | `GhostPool` per depth | permanently; pool capped |
| Active run, lineages faced, victims, unlocks | `PlayerLedger` per key | permanently; a few KB |

**The owner's account is on Workers Free (2026-10-13); stay on it until
usage says otherwise.** From Cloudflare's docs (checked 2026-10-13), Free
allows, per day, shared across the whole account (poker included):

| Limit (Free) | Per | What uses it here |
|---|---|---|
| 100,000 Worker requests | day | every action |
| 100,000 Durable Object requests | day | every action, plus room-to-room calls |
| 100,000 SQLite rows written | day | saving the run after each action; credits |
| 5 million rows read | day | rarely the constraint |
| 13,000 GB-s DO duration | day | ~28 hours of active objects; idle ones are free |
| 5 GB stored | total | runs, pools, ledgers — far below |
| 10 ms CPU | request | enemy and ghost AI, level generation |

Going over a daily limit makes further operations **fail until 00:00
UTC** — the game (and poker) stop working for everyone, rather than
costing money. Rough capacity: one request and about one row written per
action, so ~100,000 actions a day — at ~200 actions a level, about 500
levels a day (e.g. 50 daily players clearing 10 levels each). Plenty for
building, testing and a small audience.

To stretch Free:
- **Multi-step actions.** A roguelike "travel to" / "explore" command that
  moves several tiles in one request, stopping when an enemy or ghost comes
  into view. One of the biggest savings, and good for play anyway.
- **One row per save:** store the run's state as one value, written once
  per action; no alarms on `RunRoom` (each `setAlarm()` is a row written).
- **Cheap AI:** keep each action well under 10 ms (small grids, BFS/A*
  bounded to the visible area, few enemies acting per turn); generate
  levels within the same budget, or across a couple of requests.

**Move to Workers Paid** ($5/month minimum; 30 s CPU by default, no daily
caps, pay beyond generous monthly allowances) when the dashboard shows
daily usage regularly past ~70% of a limit, or CPU errors (`1102`,
`exceededCpu`) appear. On Paid, add the budget alert from the async plan's
Phase 7.

What's missing is a **query across objects** (no global leaderboard or
analytics), already noted in `ARCHITECTURE.md`; a D1 database answers that
if it's ever wanted.
