# Canvas — Architecture Design Doc

Canvas is a browser game arcade: a small ECS engine renders games to a 2D
canvas. Poker is played over a live, server-authoritative connection;
Caravan, a single-player tactical roguelike, plays its whole run in
the browser, its AI in a Web Worker. Everything else is a static,
declarative manifest.

## Overview

```
Browser (@canvas/web)                    Cloudflare Worker (@canvas/server)
  React + react-router                      routes: /rooms
  @canvas/engine ECS + Canvas2D  <——HTTP/WS——>
  Caravan: run host + localStorage            │ DO stub
    AI in a Web Worker                              ▼
                                       GameRoom (Durable Object) × 1 per room
                                         idFromName(roomId) · WebSocket
                                         Hibernation · SQLite storage · alarms
```

Static assets (the `@canvas/web` build output) ship separately via Cloudflare
Pages — see [Deployment topology](#deployment-topology).

Four of six games (`snake`, `blackjack`, `solitaire`, `sudoku`) are pure
client-side manifests: a `game.json` describing a scene and a list of
engine systems, bundled into the web build and rendered entirely in the browser.
`poker` runs against the server, using a `GameRoom` Durable Object as the
authoritative game state and WebSocket hub. `silk-road-run` plays each
run in the browser with the engine's run host, saved in `localStorage`;
its page previews turns with the same rules.

## Package layout

| Package | Role | Notes |
|---|---|---|
| `@canvas/engine` | ECS core, generic components/systems, manifest loader, plugin API | Built with `tsc -b` to `dist/` (ESM + `.d.ts`), which its `exports` point at; inside the repo every consumer resolves it to `src/` through tsconfig `paths`, so nothing needs a build first. Ships `World`, `Scene`, `Entity`, a `SystemRegistry`, and game-agnostic systems (grid, hex grid, physics, drag/drop, click, card piles, grid puzzles, side panel, network). No game-specific code: games add their own through `register()`. `@canvas/engine/server` is a DOM-free entry with the `ServerSystem` contract, the single-player `RunSystem` contract and its host (`runs.ts`), and the hex geometry (`math/Hex`), so a game's rules and its renderer share one. Rendering: rects, text, circles, hexagons and sprite-sheet frames (loaded through `assetLoader`); a manifest's `canvas.scale` draws the scene at a low resolution scaled up by a whole number, and `canvas.pixelArt` keeps the pixels sharp. Input is keyboard plus Pointer Events (mouse, touch and pen drive the same click/drag state; touch swipes become `Swipe*` virtual keys). |
| `@canvas/web` | React shell, routing, canvas host, poker lobby UI | Builds in the games listed in `src/platform.games.ts` (generated), instantiates a `World` per game, and is the only package with a UI framework. |
| `@canvas/server` | Cloudflare Worker: routing, CORS, DO orchestration | Thin — most logic lives in the `GameRoom` Durable Object. Games' server rules (`ServerSystem`s) are registered in `src/games/registry.ts` (generated). |
| `games/poker` | Poker client systems + server-authoritative Texas Hold'em logic | `.` exports the game definition, whose `register()` adds the table's client systems in `src/client/` (`PokerSystem` sends actions and turns server state into a view, `PokerRendererSystem` draws it); `./server` (DOM-free) exports a `ServerSystem` consumed by `GameRoom` — the only implementation of the rules, with the deck, hand evaluator, and public-state redaction. |
| `games/silk-road-run` | Tactical roguelike: rules, run entry, board renderer | `src/rules/` is DOM-free and shared: `./run` exports a `RunSystem` that the page (`@canvas/web`'s `pages/tactics/`, `localRuns.ts` and `aiWorker.ts`) plays, and the page imports the same rules for previews. Plan: `docs/plans/roguelike-tactics/`. Hero numbers in `src/rules/config.ts` are placeholders. |
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
optional `register()`). `platform.games.json` at the repo root lists the
games the platform builds in, in home-page order — the one place that names
them. `pnpm games:gen` (`scripts/gen-game-registry.mjs`) generates from it
the web's `src/platform.games.ts`, the Worker's `src/games/registry.ts`
(games whose package exports `./server`, which default-exports a
`ServerSystem`), and the web/server `package.json` dependencies and web
tsconfig paths. The deploy runs `pnpm games:check` and fails if any of
those are stale. The web shell builds its game list from the generated
file; nothing is fetched at runtime.

**Tradeoff** — adding or changing a game means a web redeploy. This replaced
a singleton `ManifestRegistry` Durable Object that the deploy uploaded every
`game.json` into (bearer-token gated, index replaced on every upload). That
class is retired and unreachable, but still bound in `wrangler.toml` until a
`deleted_classes` migration removes it.

### Single-player runs play in the browser
Caravan's run never leaves the browser (owner, 2026-10-25;
`docs/plans/client-side-runs.md`). The page (`pages/tactics/localRuns.ts`)
hosts it with the engine's run host (`@canvas/engine/server`, `runs.ts`:
`startRun`, `playRun`, `runResponse`, which own what the retired `RunRoom`
did: refused and finished actions, runs saved by older rules ended as
`expired`) and saves it in `localStorage` after every action, one run a
browser. Only one tab plays it (a Web Lock); another says so and takes over
once that tab closes. Each action, an AI turn above all, runs in a Web
Worker (`aiWorker.ts`), so a long search never stalls the board's playback.

**Tradeoff** — nothing is enforced: a player can read the seed (future
encounters and offers) or restore a saved run after a death. That only
touches their own game, while nothing reaches other players; rival caravans
and rewards would need a server to replay what other players see. In return
the AI has no CPU limit: given a clock (`RunContext.now`) it searches as
deep as the device gets in `AI.browser.thinkMs`, so a turn depends on the
machine. Without a clock (unit tests, balance scripts) it keeps to a fixed
work cap and stays deterministic.

### Multiplayer is server-authoritative for exactly one game
Only poker has a `ServerSystem` (`createInitialState` / `handleAction` /
`getPublicState`) registered in `serverSystemRegistry`. `GameRoom` validates
turn order server-side and sends each viewer a redacted `getPublicState` so
opponents' hole cards never reach the client.

**Tradeoff** — poker can only be played online: there's no offline or
vs-bots mode. (A single-player bot mode with its own copy of the rules
existed, but no UI reached it, so it was removed rather than kept in sync.)

### Room timing is a per-game policy, so async games fit too
How a room runs — turn timers, how long it lives, whether lobby seats are
held, who is dealt into a new round, and how a returning player proves a
seat is theirs — comes from the game's optional `ServerSystem.room`
(`RoomPolicy`, in `@canvas/engine/server`). `packages/server/src/roomPolicy.ts`
holds the defaults and the timer math as pure, unit-tested functions;
`GameRoom` does only the I/O. The defaults are real-time play, exactly what
poker had before policies existed (poker sets none): 30s turns, 10s when
the acting player is disconnected, deletion 5 minutes after the room
empties, a 24h TTL extended only while someone is connected, lobby seats
freed on disconnect, new hands dealt to connected players, rejoin by name.

An async game (hours between turns, games lasting days) sets no turn limit,
keeps empty rooms, extends the TTL on every join and move, holds lobby
seats, deals absent players into new rounds, and uses `seatIdentity:
'token'`: the server gives each seat a secret in its `connected` message,
and only that token (as `seatToken` on join and on the WebSocket URL)
reclaims the seat; a newer connection with it replaces an older one.
`scripts/e2e/rooms-async.e2e.mjs` proves this end to end with a test-only
game (`packages/server/test/`) registered only by the local e2e Worker entry.

**Tradeoff** — the platform runs async rooms, but no async game ships yet,
and an async game would also need what real-time play doesn't: a way to tell
players it's their turn (email or push), a "my games" list in the web app,
and somewhere for the client to keep seat tokens across devices. That work
is planned in `docs/plans/async-games.md`, to start once an async game exists;
its decision log records the choices made so far (no accounts, no email, turn
deadlines per game, hand-rolled Web Push) and when to revisit them. A seat
token travels in the WebSocket URL, which browsers can't avoid (no custom
headers on WebSocket), so it can appear in request logs.

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

With the default (real-time) room policy; see *Room timing is a per-game policy* for what a game can change.

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

**Moderate — Test coverage is thin outside poker.** `pnpm test` (Vitest)
covers the poker rules engine and a couple of engine utilities, and `pnpm
e2e` drives the real Worker and web app in browsers (poker protocol, a
two-browser poker game, and the single-player games). There are still no
unit tests for the ECS core, manifest validation, or the other games'
systems; the e2e suite is the main guard there. See `.claude/skills/verify`.

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
| `deploy-server` | Cloudflare Worker (`canvas-server`) | Runs `pnpm check:boundaries`, `pnpm games:check`, `pnpm -r typecheck` and `pnpm test` first and stops on failure; then `wrangler deploy`. |
| `deploy-pages` | Cloudflare Pages (static `@canvas/web` build) | Runs after `deploy-server` via `needs:`, and bakes `VITE_API_URL` into the build at compile time — the API origin can't change without a rebuild. |
| `smoke-prod` | Production | After `deploy-pages`, runs `pnpm e2e` against the live Worker and Pages site (Playwright + Chromium) and uploads screenshots/logs as an artifact. Reports problems; doesn't roll back. |

The Worker currently needs no secrets. Any future one stays out of
`wrangler.toml` `[vars]` — anything there also lands in the production
deploy — and is set with `wrangler secret put`, and read from a gitignored
`.dev.vars` locally.

## Open questions

- Which engine systems most need unit tests next? Manifest validation and
  the card-pile rules (solitaire) have no coverage below the e2e suite.
- Is 10 rooms/minute per IP the right cap, and should joins or WebSocket
  upgrades get a limit too?
