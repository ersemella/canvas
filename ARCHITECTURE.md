# Canvas — Architecture Design Doc

Canvas is a browser game arcade: a small ECS engine renders games to a 2D
canvas, and one game — poker — is played over a live, server-authoritative
connection. Everything else is a static, declarative manifest.

## Overview

```
Browser (@canvas/web)                    Cloudflare Worker (@canvas/server)
  React + react-router                      routes: /rooms, /manifests
  @canvas/engine ECS + Canvas2D  <——HTTP/WS——>
                                                     │ DO stub
                                                     ▼
                                   GameRoom (Durable Object) × 1 per room
                                     idFromName(roomId) · WebSocket
                                     Hibernation · SQLite storage · TTL alarm

                                   ManifestRegistry (Durable Object) · singleton
                                     idFromName('global') · game.json store + index
```

Static assets (the `@canvas/web` build output) ship separately via Cloudflare
Pages — see [Deployment topology](#deployment-topology).

Four of five games (`snake`, `blackjack`, `solitaire`, `sudoku`) are pure
client-side manifests: a `game.json` describing a scene and a list of
built-in engine systems, fetched and rendered entirely in the browser. Only
`poker` runs against the server, using a `GameRoom` Durable Object as the
authoritative game state and WebSocket hub.

## Package layout

| Package | Role | Notes |
|---|---|---|
| `@canvas/engine` | ECS core, built-in components/systems, manifest loader | Ships `World`, `Scene`, `Entity`, a `SystemRegistry`, and every system a manifest can reference — including a self-contained single-player poker simulation. |
| `@canvas/web` | React shell, routing, canvas host, poker lobby UI | Loads manifests from the Worker, instantiates a `World` per game, and is the only package with a UI framework. |
| `@canvas/server` | Cloudflare Worker: routing, CORS, DO orchestration | Thin — most logic lives in the two Durable Object classes it hosts. |
| `games/poker` | Server-authoritative Texas Hold'em logic | Exports a `ServerSystem` consumed by `GameRoom`; has its own deck, hand evaluator, and public-state redaction. |
| `games/{snake,blackjack,solitaire,sudoku}` | Manifest generators | `game.json` plus a build-time `generate.mjs` script; no runtime code — all behavior is declared. |
| `configs` | Shared tsconfig / eslint base | — |

## Key decisions

### Entity-component-system engine shared by every game
One `World` loop, one set of components (`Transform`, `Renderable`,
`Draggable`, …), and a fixed library of systems (drag-drop, grid movement,
physics, card piles) cover snake, card games, and puzzles from the same
runtime.

**Tradeoff** — systems are built for the union of every game's needs, so
components like `PokerConfigComponent` or `GridPuzzleConfigComponent` are
fairly game-specific despite living in the generic engine. The line between
"engine primitive" and "one game's config schema" has already blurred.

### Games are declared as JSON manifests, not code
`game.json` lists entities, components, and a `systems: SystemName[]` array
checked against `SystemRegistry` at load time (`validateManifestSystems`,
`GameLoader.ts`). Adding a game means writing data, not shipping new client
code — and the Worker can serve new games without a web redeploy.

**Tradeoff** — any behavior a manifest can't express has to be built into
the engine as a new generic system first. The escape hatch for genuinely
custom logic (`STATIC_GAMES` in `web/src/registry/games.ts`) exists but is
currently empty — every shipped game fits the manifest model, so that path
is unexercised.

### One Durable Object per room, addressed by `idFromName`
`GameRoom` instances are deterministically keyed by room ID, so any Worker
request for a given room lands on the same object with no coordination
layer. The WebSocket Hibernation API (`state.acceptWebSocket`) lets an idle
room evict from memory while sockets stay open at the edge — cheap for the
"friends waiting in a lobby" access pattern.

**Tradeoff** — room creation retries on a colliding `idFromName` up to 5
times rather than using a globally unique ID from the start
(`rooms.ts:createRoom`) — pragmatic given an 8-char, 33-symbol alphabet, but
it's a retry loop standing in for a uniqueness guarantee.

### Single global ManifestRegistry DO, fronted by the edge cache
One singleton DO (`idFromName('global')`) stores every `game.json` and a
generated index; GET routes wrap it in `caches.default` with a 60s TTL, and
`POST /manifests/upload` is gated by a bearer token compared against a
Worker secret.

**Tradeoff** — every manifest read in production, worldwide, funnels through
one DO instance (mitigated almost entirely by the cache) and one write path
with no versioning — an upload replaces the index outright.

### Multiplayer is server-authoritative for exactly one game
Only poker has a `ServerSystem` (`createInitialState` / `handleAction` /
`getPublicState`) registered in `serverSystemRegistry`. `GameRoom` validates
turn order server-side and sends each viewer a redacted `getPublicState` so
opponents' hole cards never reach the client.

**Tradeoff** — the engine also ships a fully separate, single-player poker
implementation (`PokerSystem.ts`) for the non-multiplayer path. Two
independent rule implementations now exist for the same game — see
[Drawbacks](#drawbacks--inefficiencies).

### Migrated off AWS Lambda/S3 onto Workers + Durable Objects
Git history (`19275b0`, `fda4905`) shows a full teardown of
`packages/infra` and `packages/handlers` in favor of a Worker + two DO
classes. This collapses "API server," "game-room state store," and
"manifest CDN" into one deploy target with no separate database or
object-storage service to provision.

**Tradeoff** — all room and manifest state now lives in Durable Object
storage rather than a general-purpose datastore — fine at current scale,
but there's no analytics/query surface over past rooms, and the whole
backend is coupled to Cloudflare's DO model.

## Room lifecycle: a poker hand end-to-end

1. **Host creates a room** — `POST /rooms` with `{hostName, serverSystem: 'PokerServerSystem', maxPlayers}`. The Worker generates an 8-char room ID and calls `/init` on the corresponding `GameRoom` stub, retrying on a 409 (deterministic-ID collision).
2. **Players join** — `POST /rooms/:id/join` validates capacity and hand-in-progress state, then hands back a `wsUrl` the Worker builds from the request's own host.
3. **WebSocket upgrade** — `GET /rooms/:id/ws` reaches `GameRoom.handleWsUpgrade`, which seats a new player or reclaims an existing seat by name (reconnect), then accepts the socket via `state.acceptWebSocket` and serializes `{connectionId, playerName}` onto it so identity survives hibernation.
4. **Host starts the hand** — a `startGame` action calls `pokerServerSystem.createInitialState`; the resulting state is persisted and a per-viewer `getPublicState` is broadcast so each socket sees only its own hole cards.
5. **Players act** — each `playerAction` is checked against `actingConnectionId(state)` before `handleAction` runs — the server rejects out-of-turn moves rather than trusting the client.
6. **State fans out** — `broadcastPerViewer` re-derives a redacted view for every connected socket and pushes a `stateUpdate` after each action.
7. **Room expires or empties** — a 24h alarm set at room creation clears storage if no sockets remain when it fires; if the last player disconnects earlier, `removePlayer` deletes all storage immediately instead of waiting for the alarm.

## Drawbacks & inefficiencies

Findings from reading the current implementation, ranked by how much they'd
cost to leave alone.

**Notable — Poker rules are implemented twice.** The single-player path
(`PokerSystem.ts`, 651 lines, bot AI included) and the multiplayer path
(`games/poker/src/serverLogic.ts`) are independent implementations of Texas
Hold'em, each with its *own* hand evaluator (`engine/util/handEvaluator.ts`
vs. `games/poker/src/handEvaluator.ts`). A rules fix — a side-pot edge case,
a hand-ranking bug — has to be found and re-applied twice, and the two modes
can silently drift apart.
`packages/engine/src/systems/PokerSystem.ts` · `packages/games/poker/src/serverLogic.ts`

**Notable — No automated tests anywhere in the repo.** No test runner is
configured in any `package.json`, and no `*.test.ts` / `*.spec.ts` file
exists. That leaves hand evaluation, ECS math, manifest validation, and the
Durable Object room logic — including turn-order enforcement and
reconnect-by-name — with zero regression coverage.

**Moderate — `ServerSystem` is duplicated by hand across a workspace
boundary.** The `ServerSystem` interface is defined once in
`@canvas/server/src/types.ts` and re-declared, verbatim, inline inside
`games/poker/src/server.ts` — the comment there explains it's to dodge a
circular workspace dependency. It works via structural typing, but nothing
enforces the two copies stay in sync if either changes.
`packages/server/src/types.ts` · `packages/games/poker/src/server.ts`

**Moderate — Manifest cache invalidation is partial.** `POST
/manifests/upload` only purges the cached `index.json` entry; individual
`/manifests/<id>/game.json` cache entries are left to expire on their own
60s TTL (the code comment acknowledges this: "we don't know the per-game
ids without re-parsing"). A deploy can serve a stale per-game manifest for
up to a minute.
`packages/server/src/routes/manifests.ts`

**Moderate — No rate limiting on room creation or connections.** `POST
/rooms` and the WebSocket upgrade path have no throttling. Since each room
is its own Durable Object, a scripted client could cheaply spin up many
rooms — a low-cost nuisance today, but there's no guard in place before it
becomes one.
`packages/server/src/routes/rooms.ts`

**Minor — Wildcard CORS on a bearer-token-gated write endpoint.**
`Access-Control-Allow-Origin: *` applies uniformly, including to `POST
/manifests/upload`. CORS isn't the real defense here — the bearer token is
— but the wildcard means the browser-side origin check contributes nothing
on the one route where a same-origin restriction would otherwise add a
layer.
`packages/server/src/cors.ts`

**Minor — Room TTL cleanup is alarm-dependent with no re-arm.** The 24h
expiry alarm only clears storage if `getWebSockets().length === 0` when it
fires; if sockets are still open at that instant, the room is never
rescheduled for a later check. Storage cost is negligible per room, but
long-lived rooms with intermittently-connected players won't reliably clean
up.
`packages/server/src/durableObjects/GameRoom.ts` (alarm)

**Minor — The custom-game escape hatch is unused.** `STATIC_GAMES` in the
web registry exists specifically for games that "cannot be expressed as
pure manifests," but the array is empty — every shipped game currently fits
the declarative model. That's a sign the abstraction hasn't been
stress-tested against a real non-manifest game yet.
`packages/web/src/registry/games.ts`

## Deployment topology

GitHub Actions, triggered on push to `main` for any of `web/`, `engine/`,
`games/`, or `server/`.

| Stage | Target | Notes |
|---|---|---|
| `deploy-server` | Cloudflare Worker (`canvas-server`) | `wrangler deploy`, then `upload-manifests.mjs` pushes every game's `game.json` into the `ManifestRegistry` DO. |
| `deploy-pages` | Cloudflare Pages (static `@canvas/web` build) | Runs after `deploy-server` via `needs:`, and bakes `VITE_API_URL` into the build at compile time — the API origin can't change without a rebuild. |

Secrets (`MANIFEST_ADMIN_TOKEN`) are deliberately kept out of
`wrangler.toml` `[vars]` — a comment in the file explains that anything
there also lands in the production deploy — and are instead set via
`wrangler secret put` in CI and read from a gitignored `.dev.vars` locally.

## Open questions

- Should the two poker implementations converge on one rules engine, with
  the single-player mode running the server logic locally instead of
  reimplementing it?
- What's the minimum test surface worth adding first — the hand evaluator
  and DO turn-order checks are the highest-value, lowest-effort targets.
- Does the manifest model need a real non-manifest game to validate the
  `STATIC_GAMES` escape hatch before the next game is built?
- At what room-creation rate does the lack of throttling become worth
  addressing?
