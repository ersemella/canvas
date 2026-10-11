# Canvas — Architecture Design Doc

Canvas is a browser game arcade: a small ECS engine renders games to a 2D
canvas, and one game — poker — is played over a live, server-authoritative
connection. Everything else is a static, declarative manifest.

## Overview

```
Browser (@canvas/web)                    Cloudflare Worker (@canvas/server)
  React + react-router                      routes: /rooms
  @canvas/engine ECS + Canvas2D  <——HTTP/WS——>
                                                     │ DO stub
                                                     ▼
                                   GameRoom (Durable Object) × 1 per room
                                     idFromName(roomId) · WebSocket
                                     Hibernation · SQLite storage · alarm timers
```

Static assets (the `@canvas/web` build output) ship separately via Cloudflare
Pages — see [Deployment topology](#deployment-topology).

Four of five games (`snake`, `blackjack`, `solitaire`, `sudoku`) are pure
client-side manifests: a `game.json` describing a scene and a list of
engine systems, bundled into the web build and rendered entirely in the browser. Only
`poker` runs against the server, using a `GameRoom` Durable Object as the
authoritative game state and WebSocket hub.

## Package layout

| Package | Role | Notes |
|---|---|---|
| `@canvas/engine` | ECS core, generic components/systems, manifest loader, plugin API | Built with `tsc -b` to `dist/` (ESM + `.d.ts`), which its `exports` point at; inside the repo every consumer resolves it to `src/` through tsconfig `paths`, so nothing needs a build first. Ships `World`, `Scene`, `Entity`, a `SystemRegistry`, and game-agnostic systems (grid, physics, drag/drop, click, card piles, grid puzzles, side panel, network). No game-specific code: games add their own through `register()`. `@canvas/engine/server` is a DOM-free entry with the `ServerSystem` contract. Input is keyboard plus Pointer Events (mouse, touch and pen drive the same click/drag state; touch swipes become `Swipe*` virtual keys). |
| `@canvas/web` | React shell, routing, canvas host, poker lobby UI | Builds in the games listed in `src/platform.games.ts`, instantiates a `World` per game, and is the only package with a UI framework. |
| `@canvas/server` | Cloudflare Worker: routing, CORS, DO orchestration | Thin — most logic lives in the `GameRoom` Durable Object. Multiplayer games' server rules are listed in `src/games/registry.ts`. |
| `games/poker` | Poker client systems + server-authoritative Texas Hold'em logic | `.` exports the game definition, whose `register()` adds the table systems in `src/client/` (`PokerSystem`, `PokerRendererSystem`, bot AI, a hand evaluator); `./server` (DOM-free) exports a `ServerSystem` consumed by `GameRoom`, with its own deck, hand evaluator, and public-state redaction. |
| `games/{snake,blackjack,solitaire,sudoku}` | Game definitions | `game.json` (some from a build-time `generate.mjs`) and `src/index.ts` exporting the `GameDefinition`. Blackjack registers `BlackjackSystem`, Sudoku its puzzle generator, Solitaire the Klondike deal; Snake is manifest-only. |
| `configs` | Shared tsconfig / eslint base | — |

Every game package depends on the engine as a `peerDependency`, imports
only `@canvas/engine` / `@canvas/engine/server`, and has a standalone dev
page (`pnpm dev` in the package: `dev/index.html` runs the game through the
engine's `runGame()` with no web shell or Worker).

### Package boundaries

```
@canvas/engine  ←  @canvas/games-*  ←  platform (@canvas/web, @canvas/server)
```

`scripts/check-boundaries.mjs` (`pnpm check:boundaries`, run first in the
deploy workflow) fails if the engine imports any workspace package, or a
game imports anything but the engine's two public entries and its own
files. Moving a package into its own repository is file-moving plus
publishing the engine; nothing reaches across these lines.

## Key decisions

### Entity-component-system engine shared by every game
One `World` loop, one set of components (`Transform`, `Renderable`,
`Draggable`, …), and a library of generic systems (drag-drop, grid movement,
physics, card piles, grid puzzles) cover snake, card games, and puzzles from
the same runtime. Anything only one game needs (Blackjack's rules, poker's
table, Sudoku's generator, the Klondike deal) lives in that game's package
and is registered through the plugin API.

**Tradeoff** — the generic systems are still shaped by the games that drove
them: `GridPuzzleConfig` and `CardPileConfig` are rich, data-driven rule
schemas that only Sudoku and Solitaire use today.

### Games are declared as JSON manifests, not code
`game.json` lists entities, components, and a `systems: SystemName[]` array
checked against `SystemRegistry` at load time (`validateManifestSystems`,
`GameLoader.ts`). A game package can also register its own systems,
components, puzzle generators and deal patterns in its `register()` (the
engine's plugin API, listed in `engine/src/index.ts`), which runs before
its systems are created.

**Tradeoff** — the more a game registers, the less of it is plain data.

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

### Side panel and network systems stay in the engine
`SidePanelSystem` (DOM-free button/text panel driven by events) and
`NetworkSystem` (bridges the world's event bus to a WebSocket) are only used
by poker today, but neither knows anything about poker, so they stay in the
engine as generic building blocks for the next panel-based or networked game.

**Tradeoff** — the engine carries two systems no other game exercises yet.

### Manifests are bundled into the web build
Each game package exports a `GameDefinition` (its `game.json` plus an
optional `register()`), and `packages/web/src/platform.games.ts` lists the
games the platform builds in — the one place that names them. The web shell
builds its game list from it; nothing is fetched at runtime.

**Tradeoff** — adding or changing a game means a web redeploy. This replaced
a singleton `ManifestRegistry` Durable Object that the deploy uploaded every
`game.json` into (bearer-token gated, index replaced on every upload). That
class is retired and unreachable, but still bound in `wrangler.toml` until a
`deleted_classes` migration removes it.

### Multiplayer is server-authoritative for exactly one game
Only poker has a `ServerSystem` (`createInitialState` / `handleAction` /
`getPublicState`) registered in `serverSystemRegistry`. `GameRoom` validates
turn order server-side and sends each viewer a redacted `getPublicState` so
opponents' hole cards never reach the client.

**Tradeoff** — the poker package also ships a fully separate, single-player
poker implementation (`client/PokerSystem.ts`, bot mode) that the UI can't
currently reach (`/play/poker` always opens the multiplayer lobby). Two
independent rule implementations now exist for the same game — see
[Drawbacks](#drawbacks--inefficiencies).

### Migrated off AWS Lambda/S3 onto Workers + Durable Objects
Git history (`19275b0`, `fda4905`) shows a full teardown of
`packages/infra` and `packages/handlers` in favor of a Worker + Durable
Objects. This collapses "API server" and "game-room state store" into one
deploy target with no separate database or
object-storage service to provision.

**Tradeoff** — all room state now lives in Durable Object
storage rather than a general-purpose datastore — fine at current scale,
but there's no analytics/query surface over past rooms, and the whole
backend is coupled to Cloudflare's DO model.

## Room lifecycle: a poker hand end-to-end

1. **Host creates a room** — `POST /rooms` with `{hostName, serverSystem: 'PokerServerSystem', maxPlayers}`. The Worker generates an 8-char room ID and calls `/init` on the corresponding `GameRoom` stub, retrying on a 409 (deterministic-ID collision).
2. **Players join** — `POST /rooms/:id/join` validates capacity and hand-in-progress state, then hands back a `wsUrl` the Worker builds from the request's own host.
3. **WebSocket upgrade** — `GET /rooms/:id/ws` reaches `GameRoom.handleWsUpgrade`, which seats a new player or reclaims an existing seat by name (reconnect), then accepts the socket via `state.acceptWebSocket` and serializes `{connectionId, playerName}` onto it so identity survives hibernation.
4. **Host starts the hand** — only the host's `startGame` is accepted. It calls `pokerServerSystem.createInitialState`; the resulting state is persisted and a per-viewer `getPublicState` is broadcast so each socket sees only its own hole cards.
5. **Players act** — each `playerAction` is checked against `actingConnectionId(state)`, then `handleAction` validates the move itself (raise amounts, checking into a bet) and throws a player-facing error for anything illegal, which is sent back to that socket only. The acting player has 30s (10s while disconnected) before the room applies `timeoutAction` (check, else fold).
6. **State fans out** — `broadcastPerViewer` re-derives a redacted view for every connected socket and pushes a `stateUpdate` after each action.
7. **Next hand** — once `isHandOver`, any seated player may send `nextHand`; mid-hand or duplicate requests are ignored. Chips carry over, the button moves one seat, and players who are disconnected or out of chips sit the hand out.
8. **Disconnects and expiry** — in the lobby a closed socket frees its seat. During a game the seat and chips are held so the player can rejoin by name and pick up their cards. One storage alarm serves three timers: the turn deadline, a 5-minute grace period after the last socket closes (then storage is deleted), and the 24h TTL, which is pushed back while sockets are still open.

## Drawbacks & inefficiencies

Findings from reading the current implementation, ranked by how much they'd
cost to leave alone.

**Notable — Poker rules are implemented twice.** The single-player path
(`PokerSystem.ts`, 651 lines, bot AI included) and the multiplayer path
(`games/poker/src/serverLogic.ts`) are independent implementations of Texas
Hold'em, each with its *own* hand evaluator (`games/poker/src/client/handEvaluator.ts`
vs. `games/poker/src/handEvaluator.ts`). Both now live in the poker package,
which makes merging them a package-local change. A rules fix — a side-pot edge case,
a hand-ranking bug — has to be found and re-applied twice, and the two modes
can silently drift apart.
`packages/games/poker/src/client/PokerSystem.ts` · `packages/games/poker/src/serverLogic.ts`

**Moderate — Test coverage is thin outside poker.** `pnpm test` (Vitest)
covers the poker rules engine and a couple of engine utilities, and `pnpm
e2e` drives the real Worker and web app in browsers (poker protocol, a
two-browser poker game, and the single-player games). There are still no
unit tests for the ECS core, manifest validation, or the other games'
systems; the e2e suite is the main guard there. See `.claude/skills/verify`.

**Minor — Multiplayer games are listed twice.** `web/src/platform.games.ts`
lists every game's client definition, and `server/src/games/registry.ts`
lists the server rules of the multiplayer ones. They're separate because the
Worker must import only a game's DOM-free `./server` entry. Adding a
multiplayer game means touching both.

**Minor — A retired Durable Object is still deployed.** `ManifestRegistry`
is an unreachable stub kept bound in `wrangler.toml` with its old stored
manifests, because deleting it (a `deleted_classes` migration) is permanent
and blocks rolling back past that deploy. See the plan's follow-ups.

**Minor — Room creation is throttled per IP, connections aren't.** `POST
/rooms` is capped at 10/minute per client IP by a Workers Rate Limiting
binding (`ROOM_CREATE_LIMITER` in `wrangler.toml`). Joining and WebSocket
upgrades have no limit, but they only reach rooms that already exist.
`packages/server/src/routes/rooms.ts`

## Deployment topology

GitHub Actions, triggered on push to `main` for any of `web/`, `engine/`,
`games/`, or `server/`.

| Stage | Target | Notes |
|---|---|---|
| `deploy-server` | Cloudflare Worker (`canvas-server`) | Runs `pnpm check:boundaries`, `pnpm -r typecheck` and `pnpm test` first and stops on failure; then `wrangler deploy`. |
| `deploy-pages` | Cloudflare Pages (static `@canvas/web` build) | Runs after `deploy-server` via `needs:`, and bakes `VITE_API_URL` into the build at compile time — the API origin can't change without a rebuild. |
| `smoke-prod` | Production | After `deploy-pages`, runs `pnpm e2e` against the live Worker and Pages site (Playwright + Chromium) and uploads screenshots/logs as an artifact. Reports problems; doesn't roll back. |

The Worker currently needs no secrets. Any future one stays out of
`wrangler.toml` `[vars]` — anything there also lands in the production
deploy — and is set with `wrangler secret put`, and read from a gitignored
`.dev.vars` locally.

## Open questions

- Should the two poker implementations converge on one rules engine, with
  the single-player mode running the server logic locally instead of
  reimplementing it?
- Which engine systems most need unit tests next? Manifest validation and
  the card-pile rules (solitaire) have no coverage below the e2e suite.
- Is 10 rooms/minute per IP the right cap, and should joins or WebSocket
  upgrades get a limit too?
