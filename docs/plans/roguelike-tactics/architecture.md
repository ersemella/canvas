# Roguelike tactics: architecture

How the game runs on the platform: one Durable Object per run, the player
key, the classes and routes it adds, platform constraints, and what it
costs on the Free plan. Decisions D3, D4, D7, D11.


> Part of the roguelike tactics plan — start at [README.md](README.md),
> which has the status, the next step and an index of every decision.

**Revised 2026-10-15 for the combat design:** the game is a party fighting
a series of battles on compact hex maps, with complete information but
hidden stats, not one character exploring levels under fog of war.
"Level" is now "fight" and "character" is now "party" throughout.

## What already fits (don't rebuild it)

- **Server-authoritative rules, as poker does.** The run must live on the
  server even though nobody else is in your fight: rival caravans and
  rewards affect other players, so a client-run game could forge an
  overpowered party, seed the pool with it and farm kills — and permadeath
  couldn't be enforced. The rules are a module in the game package run by
  the Worker, like poker's `./server`. The combat design is deterministic
  (no hit chance, capped damage variance from gear), so the server can
  replay and verify a fight from its seed and actions.
- **Hidden information.** No fog of war — every fight starts with complete
  information ([information.md](information.md), 7.4) — but **enemy stats
  are hidden** and learned through previews (7.1, 7.2); your own units'
  stats are shown (D11). The server sends a per-viewer view with enemy
  stats replaced by derived numbers, as `getPublicState` redacts for
  poker.
- **Durable Object storage is long-lived** — kept until code deletes it
  (`GameRoom` rooms vanish because `GameRoom` deletes itself). SQLite-backed
  classes get up to 10 GB per object, on the Free plan too.
- **Rendering.** Engine grid systems and Canvas2D cover a tile-based
  client.

### D3. One Durable Object per run

**Decision (owner, 2026-10-13):** a run is one room, `idFromName('run:' + runId)`, for its
whole life: the party (heroes, gear, upgrades, health), the current fight
(its encounter generated once, from a seed, and stored — reloading can't
re-roll it), what happens between fights (recovery, recruitment offers,
milestone upgrades, bazaars — combat design sections 9–10 and the run
structure, open question 34), and the outcome. Between fights is just a
state of the run, on the server like everything else; recruitment offers
are seeded too (10.7 asks for that), so restarting can't reroll them.

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
  action, then every unit's turn up to the player's next one on the
  shared clock), a public view (with derived numbers for enemies, D11),
  the run's status (in a
  fight / between fights / over), the character copy offered
  as a ghost — since 2026-10-15 the party copy offered as a rival
  caravan, placing it in its deployment zone, and its events (killed a
  hero / defeated). The game package's
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
D3 it's a per-run room instead. **Revised 2026-10-15:** actions, preview
and status for the combat design.

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

### D11. Previews and hidden stats

**Decision (owner, 2026-10-15):**
- **Your own units: stats fully viewable.** The browser gets your heroes'
  full stats and shows them (a stat sheet), and computes previews of your
  own actions' effects on your own units locally.
- **Enemy units: derived numbers only** (was option 3 below). The browser
  never receives an enemy's raw stats (speed, defence, power, influence).
  It gets what previews need, for this fight's current state: for each of
  your units' abilities against each enemy, the final damage (min–max,
  8.1) after that enemy's defence, and the effect magnitudes (push
  distance, status strength) that land on it; each enemy's current health;
  and the timeline (7.1), which already shows when each enemy acts. The
  server sends these with every new state, so previews are local and
  instant, with no request per hover. Careful players can still work
  enemy stats out — the design intends that (7.2).

- **Everything else: full information** (owner, 2026-10-15): gear and
  recruits you're offered show exact stats. Only enemies' stats are
  hidden.

**This changes the combat design's 7.1** (stats hidden for every unit) to
hidden for **enemies** only; see the revision notes in
[information.md](information.md) and [goals.md](goals.md).

**Options weighed (2026-10-15):** (1) every preview a server request —
truly hidden, but a request per hover against the Free plan's 100,000 a
day, with latency; (2) all stats sent to the browser and hidden in the UI
only — free and instant, but anyone reading the network traffic sees them;
(3) derived numbers — chosen for enemies.

**Consequences:**
- The derived numbers must be recomputed and sent after every change that
  affects them (a buff, a gear effect, a push, a death) — part of each
  action's response, so no extra requests.
- **Rival caravans** (D8) are enemies: their stats are hidden the same way,
  though their owner saw them in their own run.

## Platform constraints

- **No hex grid in the engine.** The engine's grid systems are square
  (`GridMovementSystem`, `GridCursorSystem`); hex coordinates, distance,
  neighbours, line of fire across hexes (6.7) and hex rendering/picking
  are new work — rules in the game package, rendering possibly as a new
  engine system.
- **No camera in the engine.** Games render to a fixed canvas (600×400 by
  default, `packages/web/src/pages/GamePage.tsx`); nothing scrolls. The
  combat design's compact maps (6.1) should fit one screen, so a camera
  may never be needed.
- **Touch play.** The arcade supports touch (Pointer Events, swipe keys);
  deployment, hex selection and previews must work on a phone (no hover:
  previews on first tap, commit on second).
- **The timeline** (3.1, 7.1) is the centrepiece of the UI and needs room
  on screen beside the map.

## Long-lived storage and cost

| What | Where | Kept |
|---|---|---|
| A run | `RunRoom` | while active; deleted a few days after it ends |
| Rival caravan pool, legends | `GhostPool` per stage | permanently; pool capped |
| Active run, lineages faced, victims, unlocks | `PlayerLedger` per key | permanently; a few KB |

**The owner's account is on Workers Free (2026-10-13); stay on it until
usage says otherwise.** From Cloudflare's docs (checked 2026-10-13), Free
allows, per day, shared across the whole account (poker included):

| Limit (Free) | Per | What uses it here |
|---|---|---|
| 100,000 Worker requests | day | every action (previews are local, D11) |
| 100,000 Durable Object requests | day | every action, plus room-to-room calls |
| 100,000 SQLite rows written | day | saving the run after each action; credits |
| 5 million rows read | day | rarely the constraint |
| 13,000 GB-s DO duration | day | ~28 hours of active objects; idle ones are free |
| 5 GB stored | total | runs, pools, ledgers — far below |
| 10 ms CPU | request | enemy and rival caravan AI between the player's turns, encounter generation |

Going over a daily limit makes further operations **fail until 00:00
UTC** — the game (and poker) stop working for everyone, rather than
costing money. Rough capacity: one request and about one row written per
action, so ~100,000 actions a day. A fight with four heroes might take
~40–80 player actions (plus deployment), so on the order of 1,000–2,000
fights a day. Plenty for building,
testing and a small audience.

To stretch Free:
- **One request per turn:** a unit's move and action (5.1) are sent
  together, and the response includes every AI turn up to the player's
  next turn, so the clock never needs a request of its own.
- **Previews are local** (D11): own units from their stats, enemies from
  derived numbers sent with each state.
- **One row per save:** store the run's state as one value, written once
  per action; no alarms on `RunRoom` (each `setAlarm()` is a row written).
- **Cheap AI:** the AI may take several turns in one request (until the
  player's next turn on the clock), so keep each AI turn to a few ms:
  compact hex maps, bounded search over reachable hexes and targets;
  generate encounters within the same budget.

**Move to Workers Paid** ($5/month minimum; 30 s CPU by default, no daily
caps, pay beyond generous monthly allowances) when the dashboard shows
daily usage regularly past ~70% of a limit, or CPU errors (`1102`,
`exceededCpu`) appear. On Paid, add the budget alert from the async plan's
Phase 7.

What's missing is a **query across objects** (no global leaderboard or
analytics), already noted in `ARCHITECTURE.md`; a D1 database answers that
if it's ever wanted.
