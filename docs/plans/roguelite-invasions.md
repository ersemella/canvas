# Plan: a roguelite where other players' ghosts invade your level

Status: **proposed — feasibility checked, nothing built.** Written
2026-10-13 and revised several times that day; this version is
**ghost-only** (no live invasions). The earlier designs and why they were
dropped are under [How the design got here](#how-the-design-got-here).
All decisions D1–D9 are confirmed by the owner (2026-10-13); what's left
open is tuning (chances, caps, N) and the `RunSystem` contract's exact
shape, settled while building. Read this whole
file, then `ARCHITECTURE.md`, `CLAUDE.md`, and
`.claude/skills/verify/SKILL.md`, before changing anything.

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

## Decisions

Same format as the async plan: to change one, edit its entry, keep the old
reasoning (here, in *How the design got here*), add a dated "Revised"
note.

### D1. Ghosts only; no live invasions; untimed turns

**Decision (owner, 2026-10-13):** other players appear only as ghosts. No
live player ever enters your level, so there are **no turn timers** and no
timeout actions; closing the tab mid-level is safe and the run waits.

**Why:** almost everything hard in the earlier designs existed only
because two humans could share a level (timers so one can't stall the
other, safe points, hand-offs, live matchmaking). Ghosts give the
multiplayer feel at any player count — live invasions needed two players
at the same depth at the same moment, which a small game rarely has — and
untimed turns make the game strategic and permadeath fair.

**Consequences:**
- The **ghost AI is the multiplayer experience.** A ghost has its owner's
  build but plays like our AI. It deserves real design effort; later,
  ghosts could copy simple habits from their owner (favourite abilities,
  aggression), as Forza's Drivatars and Killer Instinct's Shadows do.
- **Bad runs are inconsequential; good runs are memorable.** A run that
  dies early leaves ghosts only in shallow pools, where kill-weighted picks
  rarely choose them; a strong run leaves a ghost that keeps killing,
  becomes a legend, and earns its owner unlocks (D8, D9).
- **Live invasions only as a separate, opt-in mode** (see *Future: opt-in
  PvP*). Adding them to the standard game would bring timers back and make
  a strategic game timed — a change to its identity. As a mode a player
  chooses per run, the standard game stays untimed.

**Revised 2026-10-13** (twice): replaces *mutual opt-in at the door*, then
*always-on live invasions with timed levels*. See *How the design got
here*.

### D2. What a ghost encounter means

Settled with D8 and D9:

- **Rewards for the player who beats a ghost** (confirmed): part of the
  ghost's gear drops, so fighting is worth more than avoiding — no more
  than an ordinary level's best loot. (NetHack's bones levels work this
  way: the dead character's gear is the reward for facing its ghost.)
- **Dying to a ghost** is an ordinary death: the run ends (permadeath), and
  the ghost's owner is credited (D9).

**Revised 2026-10-13:** the invader-death, disconnect and invasion-ending
questions belonged to live invasions and are gone.

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

### D5. Withdrawn: signed character snapshots

Needed only while the character left the server between levels (when
breaks ran in the browser). With the whole run in one room (D3), the
character never leaves the server. See *How the design got here*.

### D6. Withdrawn: per-level rooms named by run and level

Their purpose was to stop a client replaying an old signed snapshot to
undo a death. No snapshots, nothing to replay. See *How the design got
here*.

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

### D8. Ghosts: one per level, from a pool per depth

**Decisions (owner, 2026-10-13):**
- **At most one ghost per level.** Never a second, even after the first is
  beaten.
- **A player faces a ghost from a given run at most once, ever.** A run
  leaves a ghost at every depth it clears; once a player has faced any of
  them, no ghost from that run is picked for that player again, at any
  depth, in any of their runs. This keeps runs from going stale (the same
  build, a bit stronger, level after level) and stops a player getting
  stuck behind one hard — possibly just lucky — build.
- **The measure of a ghost is unique players killed** (D9). With the rule
  above, every kill by a run's ghosts is a different player.

**How (confirmed proposals):**
- **Ghost identity is its source run.** Each ghost carries a **lineage
  ID**, an opaque hash of the source run's ID; the pool for a depth holds
  at most one ghost per lineage. "Faced" means the ghost was placed in your
  level, whether or not you fought it.
- **Where ghosts come from.** When a run clears level n and moves on, its
  room offers a copy of the character (stats and gear; the owner's
  player-key hash; the lineage ID) to the **ghost pool for depth n** — a DO,
  `idFromName('ghosts:' + n)`, holding a capped pool in SQLite (e.g. the
  latest few hundred, plus legends). Optionally also the character at the
  moment of death (closer to NetHack; a stronger pool where runs end).
- **Whether a level gets a ghost** is decided when the level is generated,
  with a tunable chance (perhaps rising with depth), and stored with the
  level, so a reload can't re-roll it. The ghost enters at one of the
  level's **fixed spawn points** (details with the level design), at the
  start or after some turns.
- **Which ghost.** A player who has cleared n, playing level n+1, gets a
  ghost from pool n:
  - **Never their own** (same player-key hash) — also removes the easiest
    way to farm kills.
  - **Never a lineage they've faced.** The player's ledger (D9) keeps the
    lineage IDs they've faced. The run's room asks the pool for a short
    list of candidates (say 20), asks the ledger which are new, takes the
    first, and records it as faced in the same step.
  - **Weighted by unique kills**, so a deadly run becomes a known threat
    ("Ghost of Mira — 7 players slain"), while each player meets it at
    most once; ghosts with no kills are picked at random from the large
    pool.
  - **A ceiling:** cap how often one lineage is picked, and retire it as a
    **legend** after N unique kills — it stays on the legends lists but
    stops invading — so one strong build can't own a depth.
  - **If every candidate is used up** (a veteran player at a quiet depth),
    the level simply has no ghost. Ghosts get rarer for players who've
    met everyone; a larger player base fixes that.
- **Who plays it.** The game's AI, driving a player-shaped character
  (gear, abilities), inside the run's room. Nothing happens to the player
  it was copied from, except credit for kills (D9).
- **A ghost is a player-shaped actor with an AI controller.** Model turn
  order as a list of actors, each with a controller (the player's actions,
  the enemy AI, the ghost AI), rather than hard-coding "player, then
  enemies, then ghost". It costs nothing now and is the main thing that
  makes opt-in PvP (future) possible: a live invader is the same actor
  with a human controller.

**Consequences:** the ghost AI is a significant piece of game work (D1).
Showing "Ghost of <name>" displays a player-chosen name to strangers:
needs a length limit and a basic filter.

**Revised 2026-10-13:** first a fallback when no live invader came, with
repeats treated as a problem; repeats then became a feature (killers stay
in the pool, a **nemesis** rule preferring the ghost that killed you,
legends); then ghosts became the only invaders. Finally the owner made
each run's ghost a once-per-player encounter: the nemesis rule is dropped
(it would make you face the same run again), and the goal is unique
players killed rather than total kills.

### D9. A ghost's kills reward its owner: recognition and unlocks

**Decision (owner, 2026-10-13):** when a ghost kills a player, its owner
earns **recognition** (unique players slain, "your ghost has slain N players",
legend status) and **permanent unlocks** carried across runs (e.g.
starting classes, items offered between levels, cosmetics). Not resources
in a current run: easy to farm, and they snowball.

**The score is unique players killed** (owner, 2026-10-13), per run and
per player:
- **Per run** — what a ghost lineage is known for and what makes it a
  legend. Automatically unique, since each player faces a run once (D8).
- **Per player, lifetime** — distinct victims across all of the owner's
  runs (a victim killed by two of your runs counts once here). Unlocks are
  earned from this number.

**How (confirmed proposals):**
- **A ledger per player:** a DO, `idFromName('player:' + keyHash)`,
  holding the active run (D3), best depth reached, the lineages this
  player has faced (D8), the set of victims' key hashes and the counts
  derived from it, legends, and unlocks. When a ghost kills a player, the
  run's room credits the owner's ledger with the victim's key hash, keyed
  by victim and lineage, so a retry can't count it twice.
- **Reading it.** The home and between-levels screens show the tally and
  new unlocks. Unlocks chosen for a new run are checked against the ledger
  by the run's room when it creates the run.
- **Legends list per depth** comes free from the ghost pool. A global
  leaderboard doesn't (it needs a query across all ledgers — a D1
  database); out of scope.
- **Notification** of a kill could reuse the async plan's Web Push work
  once it exists; until then the tally shows on the next visit.

**Consequences:**
- **Farming is much harder:** an alt key adds at most one kill per run,
  and one to the lifetime count ever. Farming means many keys (new browser
  profiles), each playing a run to the right depth to be killed — slow,
  and with no accounts not reliably detectable, so keep unlocks about
  options, not power. A daily cap on credited kills is likely unneeded;
  add one only if farming shows up.
- **Storage per ledger grows** with lineages faced and victims (one short
  hash each): a few kilobytes for a heavy player. Fine.
- **Lost key, lost rewards** (D4).

## Design: a ghost encounter

```
 Player (browser)        RunRoom run:R               Ghost pool (depth n)        Ledger (victim)   Ledger (ghost owner)
 clears level n ──────► offer character copy ─────► add to pool n
 next level ──────────► generate level n+1;
                        ghost this level? (seeded)
                        if yes: candidates ────────► weighted by unique kills,
                                                     never the player's own
                        ◄──────── candidates ───────┘
                        which are new? ────────────────────────────────► (victim ledger)
                        ◄──── first new: G; marked faced ───────────────┘
 moves ───────────────► player turn, enemies, G
   ... G kills the player ...
                        run over ─────────────────► G's lineage: unique kills += 1 ─► (legend after N)
                                        ─────────────────────────────────────────────► credit victim hash (idempotent)
```

- **Every step is safe to repeat:** offers are keyed by lineage and
  depth, "faced" by player and lineage, credits by victim and lineage.
- **Who to trust:** only rooms talk to pools and ledgers. The browser sends
  its player key and actions, never a depth, outcome or character.

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

## Phases

Same workflow as the other plans: one phase per merge to `main` (no PR
unless asked), each verified with `pnpm check:boundaries`,
`pnpm games:check`, `pnpm -r --if-present typecheck`, `pnpm test`,
`pnpm e2e` (look at the screenshots), then a green deploy including
`smoke-prod`.

### Phase 1 — Solo roguelite

New `packages/games/roguelite`: seeded level generation (placing ghost
spawn points from the start, unused until Phase 2), movement, combat,
enemy AI, doors, the between-levels screen, permadeath (server); the level
and between-levels screens (client). A multi-step "travel/explore" action,
one row per save, and AI within the Free plan's 10 ms (see *Long-lived
storage and cost*). Turn order as actors with
controllers, a `mode` field on runs, and versioned full views in responses
(the PvP seams). Platform: the player key, the
`RunSystem` contract and registry support, `RunRoom`, its routes, and a
minimal `PlayerLedger` (active run, best depth).

Acceptance: unit tests for generation (seeded), combat and AI; e2e plays a
level, the between-levels screen and the next level; a reload resumes the
run and the same level; dying ends the run and a reload can't undo it;
another player key can't act on the run.

### Phase 2 — Ghosts

`GhostPool`, offering characters at each cleared level (one per lineage
per depth), the seeded ghost-per-level roll, picking (never your own,
never a lineage you've faced, weighted by unique kills, pick cap,
legends), recording "faced" in the ledger, the ghost AI, spawning at a
fixed point, and the one-ghost rule.

Acceptance: unit tests for the pool (cap, one per lineage, weighting,
own-ghost exclusion, legend retirement) and the ghost AI; e2e — two player
keys: A clears levels n and n+1; B gets A's ghost on level n+1 at a spawn
point, and never again on level n+2 or in a later run; never a second
ghost in a level; a reload doesn't re-roll the ghost; with every
candidate faced, the level has no ghost.

### Phase 3 — Rewards

Crediting kills to the owner's ledger by victim (idempotent), unique
players slain per run and per player, unlocks from the lifetime count,
the tally and unlocks on screen, unlocks checked at run start, the
legends lists, ghost names with a length limit and filter.

Acceptance: unit tests for the ledger (a repeated credit counts once; a
victim killed by two of A's runs counts once for A's lifetime and once for
each run); e2e — A's ghost kills B; A sees the kill and its unlock and can
start a run with it.

### Phase 4 — Hardening

Rate limits on starting runs and on actions, abuse cases (run churn to
seed the pool, farming with many keys), watching daily usage against the
Free limits, and moving to Workers Paid (with a budget alert) if usage or
CPU errors call for it.

## Future: opt-in PvP

Not planned for building yet; recorded so the standard game's design
leaves room for it. Owner's direction (2026-10-13): a future PvP version
that players opt into.

**Owner's preference (2026-10-13): an arena first.** Live invasions
remain the more unique idea and stay recorded as a possible later mode.

**Shape:**
- **Arena (first).** Opted-in characters at the same depth meet in a
  separate duel room, outside levels, from the between-levels screen.
  Smaller: no joining a running level, and a two-player timed turn-based
  room is close to what `GameRoom` and a `ServerSystem` already do; the
  characters are copied in from their `RunRoom`s server to server, so no
  signed snapshots are needed. Open: whether losing a duel ends the run
  (permadeath) or only costs something.
- **Live invasions (possibly later).** A player chooses a PvP run when starting it (say,
  *Hunted*). Only PvP runs can invade or be invaded by live players, and
  only PvP runs are timed, so standard runs stay untimed and strategic.
  Live invaders still come at most one per level (D8's rule); with no live
  match, a ghost invades as in the standard game, so PvP runs aren't
  empty at low player counts.
- PvP runs would likely keep their own ghost pools and rewards, so the
  standard game's balance doesn't depend on them.

**What live invasions would add** (most was designed in revision 2 — see *How the
design got here* and its commits): live matchmaking per depth, a turn
timer and timeout action for PvP runs (the pure timer maths in
`packages/server/src/roomPolicy.ts` is reusable), a WebSocket on
`RunRoom`, a ticket-gated join for the invader, and moving the invader's
character between rooms with an idempotent outcome. Because runs live
entirely on the server (D3), the hand-off is between two rooms only — no
client-held snapshot, so D5 and D6 stay withdrawn.

**Seams to keep now** (cheap, in Phases 1–2):
- Turn order as actors with controllers (D8).
- A `mode` field on every run (`'standard'` for now), stored with the run
  and with its ghost and ledger records.
- Responses carry the whole public view and a version number (D7), so a
  socket can push the same message later.
- No timer logic in the standard rules; timers, if they come, belong to
  the PvP mode's room settings.

**Main risk, for both shapes:** live matches need two opted-in
players at the same depth at the same time. When that doesn't happen, a
ghost stands in — an arena duel against a ghost, or a ghost invasion in a
PvP run — so the mode stays playable at low player counts.

## Out of scope

- Live invasions and turn timers in the standard game (D1); opt-in PvP is
  a future mode (above), not part of these phases.
- Accounts, cross-device runs, moving a player key (D4, later).
- A global leaderboard (D9).
- More than one ghost in a level (D8).

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
