# Plan: a roguelite where other players can invade your level

Status: **proposed — feasibility checked, nothing built.** Written
2026-10-13; revised the same day (D1, D3 replaced; D5, D6 added — see
*Decisions*). Read this whole file, then `ARCHITECTURE.md` (especially
*Multiplayer is server-authoritative* and *Room timing is a per-game
policy*), `docs/plans/async-games.md`, `CLAUDE.md`, and
`.claude/skills/verify/SKILL.md`, before changing anything.

## The game

A turn-based RPG roguelite with permadeath. A player works through
randomly generated levels against enemy AI; reaching the level's door
takes them to a new level. Multiplayer twist: a player who has cleared the
**same number of levels** as you can enter your level and play against you
as an enemy.

Between levels there is a **break**: no time limit, where the player
manages gear, levels up, and so on. Levels are timed turn by turn, solo or
not. Invasions are part of the rules, not something a player opts into:
everyone knows any level can be invaded.

## Verdict

Feasible on the current stack (Worker + Durable Objects). The shape this
plan settles on:

- **Breaks run entirely in the browser.** No server and no Durable Object
  while a player is between levels.
- **Each level is one Durable Object**, named by run and level number. It
  is created when a level starts and kept only as a small record once the
  level ends.
- **An invasion reuses the host's level object.** The invader joins it like
  a second player; no third room, no copy of the host's level.
- **The character crosses breaks as a server-signed snapshot**, so a client
  can't forge stats or replay an old save to undo a death.

## What already fits (don't rebuild it)

- **Server-authoritative rules.** Levels run on the server: a client can't
  fake combat or an invasion, and permadeath survives a reload. A
  `ServerSystem` (`packages/engine/src/server.ts`) does this: `handleAction`
  applies a move and then runs the enemy AI's turns inside the same call.
  Grid AI and turn-based rules are well within Worker CPU limits.
- **Turn order.** `actingConnectionId(state)` names one actor at a time —
  player → invader → AI. `GameRoom` already rejects out-of-turn actions.
- **Timers.** Levels are always timed, so a fixed `RoomPolicy` is enough —
  no timer that changes with game state. `GameRoom` already sets no
  deadline when nobody is acting.
- **Hidden information.** `getPublicState(state, viewer)` sends each socket
  its own view — fog of war.
- **Shared rules code.** A game package already ships code to both the
  browser and the Worker (poker does), so the break's rules can run on both
  sides (see D5).
- **Rendering.** Engine grid systems, Canvas2D, and `NetworkSystem` (event
  bus ↔ WebSocket) cover a tile-based client.
- **Sealing secrets.** WebCrypto is available in Workers; secrets go in
  `wrangler secret put` (the async plan already expects one for VAPID).

## What's missing

1. **Signed character snapshots** (D5): a format, an HMAC signing key, and
   checks on the server when a snapshot is used.
2. **Level rooms addressed by run and level** (D6): today rooms get random
   IDs from `POST /rooms`, start from a lobby, and delete everything on
   expiry. A level room is named `run:<runId>:<n>`, starts at once from a
   snapshot, and leaves a small permanent record behind.
3. **Matchmaking.** Rooms are found only by link or code; the async plan
   puts matchmaking out of scope (its D1). This game needs a matchmaker
   that knows which levels are running at which depth. Scoped to this game.
4. **Joining a running game.** `handleJoin` and `handleWsUpgrade` refuse
   newcomers once `status === 'in_progress'`, and `createInitialState` is
   the only way players enter the game state. The invader needs a
   ticket-gated join and a hook to add (and later remove) a player.
5. **Client pages.** The web's multiplayer UI is poker-only. Needs the
   game's own page: a break screen (client-only) and a level screen
   (WebSocket).
6. **Smaller items.** `RoomPlayer.chips` is poker residue — ignore it or
   generalise it. Seat reconnects rewrite `connectionId` inside
   `gameState.players[]`, so the game state must keep that shape. Keep
   level state compact: storage values have size limits and every move
   re-sends the public state.

## Decisions

Proposed, not yet confirmed by the owner. Same format as the async plan:
to change one, edit its entry, keep the old reasoning, add a dated
"Revised" note.

### D1. Invasions are always on; breaks are the safe point

**Proposal:** no opt-in. Levels are timed turn by turn, solo or not. The
break between levels has no time limit. Matching works like this:

- When player A leaves a break and starts level N+1, A's level is listed as
  **invadable** while it's under way (or for its first stretch of turns —
  tune with real numbers).
- When player B, who has also cleared N levels, leaves a break, the
  matchmaker may send B into A's level as the invader instead of B's own
  level N+1.
- When the invasion ends, B goes back to a break (heal, re-gear), then on
  to B's own level N+1.

At most one invader per level. The matchmaker picks; B doesn't choose to
invade.

**Why:**

| Problem | How this answers it |
|---|---|
| Consent | It's a rule of the game; everyone knows it |
| Host offline or stalling | The host is mid-level with a turn timer: playing, or being timed out |
| Invader's own run at risk | The invader always comes from a break, where nothing can happen to them |
| "Same depth" rule | B has cleared N levels; A is playing level N+1 having cleared N — exact |
| Matching pool | A's whole level is a window, not a few seconds at a door |
| Timers that change mid-level | Never needed: levels are always timed |

**Consequences (owner to decide):**
- **Timed solo play with permadeath.** A phone call or a closed tab
  mid-level means the character keeps taking timeout actions while enemies
  attack, and may die. Use a generous solo timer and a timeout action that
  defends or holds position rather than skipping — or keep the pressure as
  part of the game.
- **No way to avoid invaders** except by depth, which is the only balance.
  Decide whether there's an offline mode, or a limit such as one invasion
  per level.
- **B may expect their own level and land in someone else's.** Fine if the
  rules make it clear; the break screen can say "you may be sent to invade".
  Optionally let B choose to invade.
- **Where the invader appears.** The host may be anywhere, including
  mid-fight. The game needs a spawn rule (e.g. the level entrance, or out
  of the host's sight).

**Revised 2026-10-13.** Replaces the first proposal: *mutual opt-in at the
door* — on reaching the door after level N, each player chose *Continue
alone*, *Open to invasion* or *Invade*, and the matchmaker paired an *Open*
with an *Invade* who arrived within a short window (~45 s), else each went
on alone. It made consent explicit and guaranteed both players were online,
but needed both at the same door within seconds of each other, so few
matches would happen; it also needed a door UI, a waiting window and a
cancel flow. The always-on version keeps its benefits (connected host, safe
invader, exact depth) with a far larger matching window.

### D2. Consequences of an invasion (owner to decide)

Open questions; the defaults are a starting point:

- **Invader dies:** permadeath for their real character? (Default: yes —
  it's the stake that makes invading meaningful.)
- **Host dies:** run over, as with any death. (Default: yes.)
- **Rewards:** what each side gains from winning (loot, XP, a
  levels-cleared bonus).
- **Ending:** when does an invasion end besides a death — the host reaching
  the door, a turn cap, or the invader leaving through the door?
- **Disconnect mid-invasion:** the turn timer already applies; after a
  grace period the AI could play the character instead. (Default: timeout
  actions, as in solo play.)

### D3. One Durable Object per level; an invasion reuses the host's

**Proposal:** each level is its own room, `run:<runId>:<n>` (D6). The
invader joins the host's level room as a second player; the room signs the
invader a new snapshot when they leave (D5).

**Why:** a break needs no server, so nothing runs while a player sits in
one, however long. The host's level already exists when an invader arrives,
so reusing it means no third room and no copying the host's level out and
back.

**Revised 2026-10-13.** Replaces *one room per run, for its whole life*,
where the invader's character was copied from their run's room into the
host's and the outcome copied back, with a two-phase prepare/commit between
the rooms. With breaks in the browser and snapshots signed (D5), the
invader's side holds no live room, so there's nothing to prepare or lock
there — only the replay guard in D6.

### D4. No accounts (inherited)

Same as the async plan's D1: identity is what the browser holds — here the
run ID and the latest signed snapshot. Clearing site data loses the run,
which fits permadeath. No cross-device history or leaderboard. Revisit with
that plan if leaderboards are wanted.

### D5. The character crosses breaks as a signed snapshot

**Proposal:** when a level ends (or an invasion does), the level room
returns a **snapshot**: the character (stats, gear, inventory, XP), the run
ID, levels cleared, a generation number, a key ID, and an HMAC-SHA256
signature over all of it. The browser keeps it in `localStorage` and plays
the break from it. To start the next level (or invade), the client sends
the snapshot **plus the list of break actions** taken (equip, spend points,
buy, …). The level room checks the signature, then **replays the actions**
with the game's own break rules and starts from the result.

**Why:** the break can't be trusted to the client — it could hand itself
any stats. Replaying the actions on the server keeps the break offline and
instant in the browser while the server still decides the outcome. The
rules are one module in the game package, run on both sides.

**Consequences:**
- **Break rules must be deterministic.** No `Math.random` in the break; any
  roll (a level-up choice, a shop's stock) is drawn from a seed inside the
  snapshot, so the server's replay gets the same result.
- **An illegal action fails the whole replay**, with an error sent back;
  the client keeps its snapshot and can fix the plan.
- **First Worker secret:** `RUN_SIGNING_KEY` via `wrangler secret put` and
  `.dev.vars`. The key ID in the snapshot allows rotation (keep the old key
  for verification for as long as a break may last).
- **Whoever holds the snapshot holds the run**, like a seat token. It never
  goes in a URL — only in request bodies or a first WebSocket message.
- A signature alone doesn't stop **replaying an old snapshot** (save
  scumming after a death) — that's D6.

### D6. Level rooms are named by run and level, and never forget

**Proposal:** the room for run R's level n is
`idFromName('run:' + R + ':' + n)`, so a given snapshot can only ever open
**one** room: the one for the level after it. That room is the replay
guard:

- It accepts only the **latest generation** of snapshot for its level and
  records which it used. Sending an older snapshot, or the same one again,
  resumes the existing level (or reports the death) instead of starting a
  new one.
- When its level ends it **keeps a tombstone** — a few bytes: finished or
  dead, and the generation it issued — instead of deleting all storage as
  `GameRoom` does today. Otherwise an old snapshot could be replayed once
  the room had expired.
- **Invading also goes through the invader's own next-level room** (R:n+1
  for an invader who has cleared n). That room records "invasion I in
  progress" before the matchmaker hands out a ticket, refuses to start the
  level meanwhile, and on the outcome bumps the generation, so the
  pre-invasion snapshot is dead. If the outcome never arrives, it asks the
  host's room, which keeps the result: pull, not push, so a lost message
  can't strand the invader.

**Why:** with breaks in the browser, nothing on the server knows where a
run is between levels. Naming rooms by run and level makes the next room
itself the authority, with no separate run database. (Workers KV was
considered: it's eventually consistent, so it can't stop a quick replay.)

**Consequences:** one small record per level ever played stays in storage.
Revisit if that ever matters; a snapshot expiry (e.g. 90 days) would let
tombstones go too, at the cost of a time limit on breaks.

## Design: an invasion

```
 Host A (browser)            Level room A:n+1          Matchmaker (depth n)       Invader B (browser)     B's room B:n+1
 leaves break ─snapshot+actions─► verify, replay
                                  start level, timers on
                                  register ──────────────► A:n+1 invadable
                                                                    ◄── B leaves break: "next level" (snapshot+actions)
                                                          pick A:n+1 for B
                                                          reserve(invasion I) ──────────────────────────► verify, replay,
                                                                                                          lock: "I in progress"
                                                          ◄──────────────────────────────────────────── ok
                                  ◄── ticket for I ────────┤
                                                          send B to A:n+1 with ticket ──► B
                                  ◄──────────── B joins with ticket + snapshot ──────────
                                  addPlayer(B); turns: A → B → AI
                                  ... invasion plays out ...
                                  outcome(I): B's new snapshot or death
                                  ─────────────────────────────────────────────────────────────────────► record, bump generation
                                  ─── B: new signed snapshot ──────────────────────────► B back to a break
```

- **Matchmaker:** one DO per depth (`idFromName('depth:' + n)`), so no
  single object takes all traffic. Level rooms register when they start and
  deregister when invaded, finished, or past their invadable window; an
  alarm drops stale entries. If no level is invadable, B just starts B's
  own level — the request is the same "next level" call either way.
- **Idempotent by invasion ID.** Reserve, ticket, join and outcome are each
  safe to repeat; every room records which invasion IDs it has applied.
- **Tickets are single-use** and the only way into a running room, for this
  game only.
- **Who to trust.** Only rooms talk to the matchmaker and to each other;
  the client never reports an outcome or a depth, only signed snapshots and
  break actions the server replays.

## Platform changes (opt-in per game; poker must not change)

- **Level rooms.** Either extend `GameRoom` or give the game its own DO
  class; decide in Phase 1. Extending `GameRoom` keeps hibernation, timers
  and per-viewer state, and needs:
  - a route that addresses a room by name (`run:<runId>:<n>`) instead of
    `POST /rooms`' random ID, and starts it at once from a body
    (snapshot + break actions) with no lobby or host `startGame`;
  - start data passed to `createInitialState` (e.g. an optional
    `start(data)` hook, or a third argument);
  - a policy option to leave a tombstone instead of `deleteAll()`.
- **Joining a running game:** `ServerSystem` hooks
  `addPlayer(state, player, data)` / `removePlayer(state, connectionId)`
  and a ticket-gated join in `GameRoom`.
- **Room-to-room routes** (`/invasion/reserve`, `/outcome`, …) reachable
  only through the DO stub, never through `routes/rooms.ts`.
- **A `Matchmaker` DO class:** new `wrangler.toml` binding and migration.
- **Signing:** HMAC sign/verify with WebCrypto in one small server module
  with no game knowledge, plus the `RUN_SIGNING_KEY` secret.
- Game logic — what a snapshot holds, the break rules, how an outcome is
  applied — stays in the game package behind those hooks; the platform
  moves opaque data and checks signatures.

No timer hook is needed: levels are always timed, and the break is never
on the server.

## Phases

Same workflow as the other plans: one phase per merge to `main` (no PR
unless asked), each verified with `pnpm check:boundaries`,
`pnpm games:check`, `pnpm -r --if-present typecheck`, `pnpm test`,
`pnpm e2e` (look at the screenshots), then a green deploy including
`smoke-prod`.

### Phase 1 — Solo roguelite: breaks in the browser, levels on the server

New `packages/games/roguelite`: seeded level generation, movement, combat,
enemy AI, doors, permadeath (server); the break and its deterministic rules
(shared); the break and level screens (client). Platform: level rooms by
name with start data and tombstones, snapshot signing, the secret.

Acceptance: unit tests for generation (seeded), combat, AI, and break
replay (same result in browser and server; illegal actions refused); e2e
plays a level, a break, and the next level; dies, and neither a reload nor
re-sending an old snapshot undoes the death; a tampered snapshot is
refused.

### Phase 2 — Joining a running game

The `addPlayer`/`removePlayer` hooks and the ticket-gated join, proven
first with the e2e test game (`packages/server/test/`), then used by the
roguelite with a manually issued ticket (no matchmaker yet).

Acceptance: e2e — a second browser joins a running level with a ticket and
is refused without one or with a used one; turn order includes the
invader; poker suites unchanged.

### Phase 3 — Matchmaker and invasions

The `Matchmaker` DO, registration of invadable levels, the reserve/ticket/
outcome flow through the invader's next-level room, the invasion outcome
(D2), and the break screen's "you may be sent to invade" notice.

Acceptance: e2e with three browser contexts — B (depth n) is sent into A's
level n+1; C at another depth isn't; after the invasion B's pre-invasion
snapshot no longer works and the new one does; killing a room mid-flow and
retrying neither duplicates nor loses B's character.

### Phase 4 — Hardening

Disconnects during an invasion (D2), rate limits on "next level" calls and
matchmaker registration, abuse cases (deliberately idling as an invader),
key rotation, and the async plan's Phase 7 guards where they apply.

## Out of scope

- Opt-in invasions (see D1's revision note).
- Accounts, leaderboards, cross-device runs (D4).
- More than one invader at a time.
- Matchmaking for any other game.

## When done

Update this file's status and record deviations per phase; update
`ARCHITECTURE.md` (level rooms by name, signed snapshots, the matchmaker,
joining running games) and the `verify` skill (new suites).
