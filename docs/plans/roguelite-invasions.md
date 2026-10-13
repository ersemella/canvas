# Plan: a roguelite where other players can invade your level

Status: **proposed — feasibility checked, nothing built.** Written
2026-10-13. Read this whole file, then `ARCHITECTURE.md` (especially
*Multiplayer is server-authoritative* and *Room timing is a per-game
policy*), `docs/plans/async-games.md`, `CLAUDE.md`, and
`.claude/skills/verify/SKILL.md`, before changing anything.

## The game

A turn-based RPG roguelite with permadeath. A player works through
randomly generated levels against enemy AI; reaching the level's door
takes them to a new level. Multiplayer twist: a player who has cleared the
**same number of levels** as you can enter your level and play against you
as an enemy.

## Verdict

Feasible on the current stack (Worker + one `GameRoom` Durable Object per
room). The **solo roguelite fits the platform as it is.** Invasions need
new platform work: matchmaking, joining a running game, and moving a
character between two runs. All of it is buildable on Durable Objects; none
needs a different backend.

Opt-in at the door (D1 below) is the recommended shape for invasions: it
turns several hard problems into easy ones.

## What already fits (don't rebuild it)

- **Server-authoritative rules.** The run must live on the server, not just
  the multiplayer parts: an invader can't trust a client's account of the
  level, and permadeath must survive a page reload. A `ServerSystem`
  (`packages/engine/src/server.ts`) does this: one room is one run,
  `handleAction` applies a move and then runs the enemy AI's turns inside
  the same call. Grid AI and turn-based rules are well within Worker CPU
  limits.
- **Turn order.** `actingConnectionId(state)` names one actor at a time,
  which matches a strict cycle (player → invader → AI). `GameRoom` already
  rejects out-of-turn actions.
- **Hidden information.** `getPublicState(state, viewer)` sends each socket
  its own view, as poker does for hole cards — that is fog of war.
- **Levels.** Generated and stored server-side in DO storage. Moving to the
  next level can be internal to the game's state, or reuse the round
  boundary (`isHandOver` / `nextHand`). Death ends the run for good.
- **Rendering.** Engine grid systems, Canvas2D, and `NetworkSystem` (event
  bus ↔ WebSocket) cover a tile-based client.
- **Seats.** `seatIdentity: 'token'` already stops someone reclaiming your
  run by typing your name.

## What's missing

1. **Matchmaking.** Rooms are found only by link or code; the async plan
   puts matchmaking out of scope (its D1). This game needs a matchmaker
   Durable Object that pairs runs by levels cleared. Scoped to this game;
   it doesn't change the async plan's decisions for other games.
2. **Joining a running game.** `handleJoin` and `handleWsUpgrade` refuse
   newcomers once `status === 'in_progress'`, and `createInitialState` is
   the only way players enter the game state. Needs an opt-in invade path
   and `ServerSystem` hooks to add and remove a player mid-game.
3. **Moving a character between runs.** The invader has a character in
   their own run. Invading copies it into the host's room and writes the
   outcome back. DOs can call each other but share no transactions, so the
   hand-off needs an invasion ID and must be safe to retry, or a crash
   mid-way duplicates or loses the character.
4. **State-dependent turn timers.** `RoomPolicy` is fixed per game. Solo
   play should have no timer (you're playing AI); during an invasion
   someone must time out, or either player can stall the other.
5. **Client pages.** The web's multiplayer UI is poker-only. Needs the
   generic room pages (async plan, Phase 1) or the game's own page.
6. **Smaller items.** `RoomPlayer.chips` is poker residue — ignore it or
   generalise it. Seat reconnects rewrite `connectionId` inside
   `gameState.players[]`, so the game state must keep that shape. Keep
   level state compact: storage values have size limits and every move
   re-sends the public state.

## Decisions

Proposed, not yet confirmed by the owner. Same format as the async plan:
to change one, edit its entry, keep the old reasoning, add a dated
"Revised" note.

### D1. Invasions are mutual opt-in, at the door (recommended)

**Proposal:** invasions happen only **between levels**, and only when
**both** players have opted in. When a player steps on the door after
clearing level N, they choose:

- **Continue alone** — straight to level N+1, no matchmaking.
- **Open to invasion** — wait (up to a short window, e.g. 45 s) for an
  invader; their level N+1 is generated and an invader may enter it.
- **Invade** — wait for a player at the same depth who chose *Open*; enter
  their level N+1 as the enemy.

The matchmaker pairs one *Open* with one *Invade* at the same depth. If the
window expires with no match, the player is told so and continues alone —
opting in never blocks progress. A player can cancel while waiting.

A simpler symmetric alternative: one checkbox, "Allow invasions"; two
opted-in players at the same depth are paired and the matchmaker picks
who hosts. Fewer choices, but players don't pick their role. Choose
between the two before Phase 3.

**Why this shape:** the door is a natural consent point and a clean
boundary, and it removes most of the hard cases in *What's missing*:

| Problem | Without opt-in | With opt-in at the door |
|---|---|---|
| Consent | Invaded with no say | Both players agreed seconds ago |
| Host offline | Invader may wait for days | Both are connected, by construction |
| Invader's own run | Paused mid-level, at risk? | Paused on the door: no level state, nothing in danger |
| "Same depth" rule | Matchmaker must track live depth | Both just cleared level N — exact |
| Hand-off | Snapshot a character mid-fight | Snapshot at a safe checkpoint |
| Turn timers | Must switch on mid-level | Invasion room starts with timers on |
| Griefing | Repeatedly invaded | Off unless you choose it each level |

**Consequences:**
- A smaller matching pool: two players must reach the door at the same
  depth within the window. Show "N players waiting at depth N" while
  waiting, and accept that at low player counts most invasions won't
  happen. Revisit the window length with real numbers.
- Consent is per level: opting in at one door says nothing about the next.
- The invasion is an event at the **start** of level N+1. The host still
  plays the rest of level N+1 afterwards; the invader returns to their own
  door and then goes on to their own level N+1.

**Revisit if:** players want invasions mid-level (then the host's level must
stay open while they play, with the timer and hand-off problems above), or
the pool is too small for matches to happen.

### D2. Consequences of an invasion (owner to decide)

Open questions; the defaults below are a starting point:

- **Invader dies:** permadeath for their real character? (Default: yes —
  it's the stake that makes opting in meaningful.)
- **Host dies:** run over, as with any death. (Default: yes.)
- **Rewards:** what each side gains from winning (loot, XP, a
  levels-cleared bonus).
- **Ending:** when does an invasion end besides a death — the host reaching
  the door, a turn cap, or the invader leaving through the door?
- **Disconnect mid-invasion:** auto-pass, the AI plays the character, or
  forfeit. (Default: AI plays it after a short grace period.)

### D3. One room per run; an invasion is a visit to the host's room

**Proposal:** each run is one `GameRoom` for its whole life. The invader's
character is copied into the host's room for the invasion and the result
copied back. Alternatives considered: one room per level (more rooms, a
hand-off at every door, nothing gained), or a third room for the
invasion (the host's level would have to be copied out and back too).

### D4. No accounts (inherited)

Same as the async plan's D1: identity is the seat token in the browser.
Permadeath is therefore per device; there's no cross-device history or
leaderboard. Revisit with that plan if leaderboards are wanted.

## Design: matching at the door

```
 Host run (GameRoom A)          Matchmaker (DO per depth)        Invader run (GameRoom B)
 clears level N, picks Open ──► offer(A, depth N, role=host)
                                                    ◄── offer(B, depth N, role=invader) ◄── clears N, picks Invade
                                 pair → invasionId
 prepare(invasionId) ◄──────────┤──────────────────► prepare(invasionId)
   generates N+1, holds door      │                     snapshots character, locks run
 ack ───────────────────────────►│◄──────────────────── ack (+ character snapshot)
                                 commit
 admit invader ◄─────────────────┤──────────────────► hand client the room A ticket
   ... invasion plays out in A ...
 outcome(invasionId) ──────────────────────────────────► apply outcome (once per invasionId)
                                                          back on the door → level N+1
```

- **Matchmaker:** one DO per depth (`idFromName('depth:' + N)`), so no single
  object takes all traffic. Holds waiting offers in memory/storage with an
  expiry; an alarm drops stale ones. A run has at most one live offer.
- **Two-phase pairing.** The matchmaker asks both rooms to *prepare*; only
  when both acknowledge does it *commit*. Either side cancelling or timing
  out releases both, and they're told "no match" and may wait again or
  continue alone.
- **Idempotent by `invasionId`.** Prepare, commit, admit and outcome are
  each safe to repeat; a room records which invasion IDs it has applied.
  The invader's run is locked (can't act, can't open another offer) from
  prepare until the outcome lands, so the character can't be duplicated.
- **Admitting the invader.** Room A gets a single-use *invasion ticket*;
  the invader's client joins A with it over a normal WebSocket. This is
  the only way into a running room, and only for this game.
- **Returning.** On the outcome, room A calls room B (`outcome`), and the
  invader's client goes back to room B with their own seat token.
- **Who to trust.** Only rooms talk to the matchmaker and to each other;
  the client never reports an outcome or a depth.

## Platform changes (opt-in per game; poker must not change)

- `ServerSystem` gains optional hooks, unused by poker:
  - `addPlayer(state, player, data)` / `removePlayer(state, connectionId)`
    for an invader joining and leaving a running game.
  - `turnTimeoutMs(state)` (or similar) so a game can have no timer solo
    and a timer during an invasion. `roomPolicy.ts` stays the pure place
    where timer maths lives; unit-test it as today.
- `GameRoom`: a ticket-gated join for running games; internal routes for
  the matchmaker and the other room (`/invasion/prepare`, `/commit`,
  `/admit`, `/outcome`), reachable only through the DO stub, never through
  `routes/rooms.ts`.
- A `Matchmaker` DO class: new `wrangler.toml` binding and migration.
- Game-specific logic (what a character snapshot is, how an outcome is
  applied) stays in the game package, behind those hooks — the platform
  moves opaque data.

## Phases

Same workflow as the other plans: one phase per merge to `main` (no PR
unless asked), each verified with `pnpm check:boundaries`,
`pnpm games:check`, `pnpm -r --if-present typecheck`, `pnpm test`,
`pnpm e2e` (look at the screenshots), then a green deploy including
`smoke-prod`.

### Phase 1 — Solo roguelite, server-authoritative

New `packages/games/roguelite` with a `./server` `ServerSystem`: seeded
level generation, movement, combat, enemy AI, doors, permadeath. Room
policy: token seats, no turn timer, a long TTL extended on activity. A page
for it (the async plan's generic pages, or its own). No platform changes.

Acceptance: unit tests for generation (seeded), combat and AI; e2e plays
through a door and dies, and a reload can't undo the death.

### Phase 2 — Joining a running game, state-dependent timers

The `ServerSystem` hooks and the ticket-gated join, proven first with the
e2e test game (`packages/server/test/`), then used by the roguelite with a
manually issued ticket (no matchmaker yet).

Acceptance: e2e — a second browser joins a running test-game room with a
ticket and is refused without one; timers apply only while the game says
so; poker suites unchanged.

### Phase 3 — Matchmaker and the door choice

The `Matchmaker` DO, two-phase pairing, the run-to-run hand-off and
outcome, and the door UI (*Continue alone* / *Open* / *Invade*, waiting
count, cancel, "no match").

Acceptance: e2e with three browser contexts — two at the same depth pair,
one at another depth doesn't; a match, a timeout and a cancel all leave
both runs consistent; killing a room mid-hand-off and retrying neither
duplicates nor loses the invader's character.

### Phase 4 — Hardening

Disconnects during an invasion (D2), rate limits on offers, abuse cases
(opening and cancelling in a loop), and the async plan's Phase 7 guards
where they apply.

## Out of scope

- Mid-level invasions (see D1's "Revisit if").
- Accounts, leaderboards, cross-device runs (D4).
- More than one invader at a time.
- Matchmaking for any other game.

## When done

Update this file's status and record deviations per phase; update
`ARCHITECTURE.md` (the matchmaker, joining running games, the hand-off)
and the `verify` skill (new suites).
