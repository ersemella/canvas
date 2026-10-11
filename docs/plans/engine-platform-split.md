# Plan: split Canvas into engine, platform, and per-game packages

Status: **done** — all six phases merged and deployed 2026-10-11, with the deviations and follow-ups under [Progress and deviations](#progress-and-deviations). The one step left undone is deleting the retired `ManifestRegistry` Durable Object, an irreversible production change left for the owner.
Written 2026-10-11 as a hand-off to a fresh Claude Code session. Read this whole file, then `ARCHITECTURE.md` and
`CLAUDE.md`, before changing anything.

## Goal

Turn the monorepo into three kinds of package with hard boundaries, **inside
this repo first**:

- **`@canvas/engine`** — a reusable, game-agnostic framework: ECS core,
  rendering, input, loaders, and *generic* systems only.
- **`@canvas/games-<id>`** — one package per game. Each exports a
  `GameModule` (manifest + its own systems/components) and, for multiplayer
  games, a `ServerSystem`. Games depend only on the engine's public API.
- **The platform** (today's `@canvas/web` + `@canvas/server`) — the web shell,
  Worker, Durable Objects, and CI. It lists which games to include and builds
  them in.

Splitting into separate git repos (engine repo, platform repo, one repo per
game) is a **later, separate step** once these boundaries hold — out of scope
here except for making it mechanical (see Phase 6).

### Why (decision record)

Runtime loading of game code was considered and rejected for now: it needs a
dynamic `import()` contract, a host-provided engine to keep input singletons
shared (`mouseService`, `inputService` are module-level), and a Worker per
multiplayer game (Workers can't load code at runtime). Building games into the
platform at build time avoids all three: one bundled engine instance, the
Worker imports game server logic statically (as it already does for poker),
and everything typechecks together. Cost: adding/updating a game means a
platform redeploy — acceptable.

## Ground rules

- **Git:** per `CLAUDE.md`, merge to `main` directly (no PR) unless told
  otherwise. Every push to `main` touching `packages/**` deploys to production
  via `.github/workflows/deploy.yml` (typecheck → unit tests → Worker → Pages →
  `smoke-prod` e2e against production). **Keep `main` deployable after every
  phase**; one phase (or sub-step) per merge.
- **Verify every phase** with the `verify` skill (`.claude/skills/verify`):
  `pnpm -r --if-present typecheck`, `pnpm test`, and `pnpm e2e` (starts
  `wrangler dev` + Vite; ~2 min; 50+ checks across games and poker). Look at
  the screenshots in `e2e-results/` — the games draw on a canvas. After each
  merge, confirm the deploy run and its `smoke-prod` job are green.
- **No behavior changes.** This is a structural refactor. Every game must play
  exactly as it does now; the existing e2e suites are the safety net. If a
  suite needs updating because something *moved* (e.g. an import path), that's
  fine; if it fails because behavior changed, that's a bug.
- **Single-player poker** (`PokerSystem` in bot mode) is currently unreachable
  from the UI (`/play/poker` always opens the multiplayer lobby). Move it with
  the rest of poker; don't fix, extend, or delete it in this plan.
- Don't kill dev servers with `pkill -f wrangler` from a shell whose own
  command line contains that word — it kills the shell. `pnpm e2e` stops its
  servers itself and refuses to start if ports 8787/3000 are busy.

## Current coupling (what has to be cut)

Measured on `main` at the time of writing:

| Coupling | Where |
|---|---|
| Game-specific systems live in the engine and are registered as built-ins | `engine/src/loader/ComponentLoader.ts` `registerBuiltinSystems()` registers `BlackjackSystem`, `PokerSystem`, `PokerRendererSystem`, `SidePanelSystem`, `NetworkSystem` alongside generic ones |
| Game-specific components in the engine | `engine/src/components/BlackjackConfigComponent.ts`, `PokerConfigComponent.ts` (registered in `registerBuiltinComponents()`) |
| Game-specific engine code | `systems/PokerSystem.ts`, `PokerRendererSystem.ts`, `pokerGameState.ts`, `pokerTypes.ts`, `util/botAI.ts`, `util/handEvaluator.ts` (poker); `systems/BlackjackSystem.ts` (blackjack); `generators/sudokuGenerator.ts` + `puzzleGenerators.ts` (sudoku); `dealKlondike` in `systems/CardPileSystem.ts` and `DealPatternConfig` `type: 'klondike'` in `components/DeckConfigComponent.ts` (solitaire) |
| Game-specific engine exports | `engine/src/index.ts` exports `BlackjackSystem`, `PokerSystem`, `PokerRendererSystem`, their config types, `puzzleGenerators` |
| Closed list of system names | `SystemName` union in `engine/src/types/manifest.ts`; `validateManifestSystems` in `engine/src/loader/GameLoader.ts` rejects anything not registered ("Only built-in engine systems can be used in static manifests") |
| Web imports a game package directly | `web/src/pages/poker/PokerRoomPage.tsx` imports `@canvas/games-poker/game.json`; `web/package.json` depends on `@canvas/games-poker` |
| Server imports a game package directly | `server/src/games/registry.ts` imports `@canvas/games-poker/server` |
| `ServerSystem` declared twice | `server/src/types.ts` and inlined in `games/poker/src/server.ts` (a type-level drift check in the registry keeps them equal) |
| Games are discovered at runtime from the Worker | `web/src/registry/games.ts` fetches `/manifests/index.json`; manifests are uploaded by `server/scripts/upload-manifests.mjs` (hard-coded list of 5 games) into the `ManifestRegistry` Durable Object |

Generic and **staying in the engine**: ECS core, `RenderSystem`, input
(`InputSystem`, `InputFlushSystem`, `MouseSystem` — pointer events + swipe
virtual keys), `ClickSystem`, `DragDropSystem`, `ChildTransformSystem`, the
grid systems (Snake's), `GridCursorSystem`, `GridPuzzleSystem`,
`CardPileSystem`, `PileLayoutSystem`, `TriggerSystem`, physics, loaders,
`util/Shoe.ts`, `util/CardHandRenderer.ts` (generic card-hand helpers used by
Blackjack — keep them in the engine as reusable card utilities).

## Target shape (end of this plan, still one repo)

```
packages/
  engine/            @canvas/engine        generic only; public API = src/index.ts
  games/
    snake/           @canvas/games-snake      manifest only
    sudoku/          @canvas/games-sudoku     manifest + SudokuGenerator registration
    solitaire/       @canvas/games-solitaire  manifest + Klondike deal registration
    blackjack/       @canvas/games-blackjack  manifest + BlackjackSystem + BlackjackConfig
    poker/           @canvas/games-poker      manifest + client systems + ServerSystem
  web/               @canvas/web           platform shell (unchanged name for now)
  server/            @canvas/server        platform Worker (unchanged name for now)
  platform.games.ts  (or similar)          the list of games the platform builds in
```

Each game package's entry exports a `GameDefinition`, e.g.:

```ts
export interface GameDefinition {
  id: string;                       // 'blackjack'
  manifest: GameManifest;           // the game.json
  register?(engine: EngineAPI): void; // registers its systems/components/generators
  server?: ServerSystem;            // multiplayer only
}
```

Exact names are yours to choose; keep it minimal. `ServerSystem` and
`RoomPlayer` move to the engine (types only) so the server and poker share one
definition — delete the inlined copy and the drift check that replaced it.

## Phases

Each phase ends with typecheck + unit tests + full `pnpm e2e` green, a merge to
`main`, and a green deploy including `smoke-prod`.

### Phase 1 — Engine plugin API (no moves yet)

- Give the engine a public way for a game to register its own systems,
  components, puzzle generators, and deal patterns. `SystemRegistry.register`
  and `registerDataComponent` exist; expose them deliberately from
  `index.ts` as the plugin API.
- Loosen `SystemName` to `string` (keep the built-in names documented), and
  make `validateManifestSystems` check against the registry *after* the game's
  `register()` has run. Update its error message.
- Make Sudoku's generator and Solitaire's deal pluggable: a registry keyed by
  name (`puzzleGenerators` already is one; add the same for deal patterns so
  `DealPatternConfig.type` is a string looked up in it, with `klondike`
  registered as before for now).
- Move `ServerSystem`/`RoomPlayer` types into the engine; have
  `@canvas/server` and `games/poker` import them. Remove the inlined copy in
  `games/poker/src/server.ts` and the drift-check comment in
  `server/src/games/registry.ts`.

Acceptance: no behavior change; everything still registered from the engine;
the new API exists and is exported.

### Phase 2 — Game definitions and the platform's game list

- Give every `packages/games/*` package an entry module exporting its
  `GameDefinition` (manifest imported from its `game.json`; `register` empty
  for now).
- Add the platform's list of games (one file importing each game package).
  The web shell builds its game list from it and calls each game's
  `register()` before loading; the Worker builds `serverSystemRegistry` from
  the games that export `server`.
- Decide manifests' source of truth: the simplest end state is **bundled**
  manifests (the web imports them via the game list) and **deleting** runtime
  manifest loading — `ManifestRegistry` DO, `/manifests` routes,
  `upload-manifests.mjs`, the upload step in `deploy.yml`, the manifest cache
  purge, the upload-route CORS special case, and the `MANIFEST_ADMIN_TOKEN`
  secret usage. This removes a whole class of problems (index replaced on
  upload, shared admin token). Do it as its own sub-step/merge, and update
  `ARCHITECTURE.md` and the e2e runner (it uploads manifests locally) in the
  same change. Removing a Durable Object class from `wrangler.toml` needs a
  `deleted_classes` migration — check the Cloudflare docs and do it right.
- Web stops importing `@canvas/games-poker/game.json` directly; it goes through
  the game list.

Acceptance: the platform's game list is the only place that names games;
games appear and play exactly as before.

### Phase 3 — Move Blackjack out of the engine (the pilot)

- Move `BlackjackSystem.ts` and `BlackjackConfigComponent.ts` into
  `packages/games/blackjack/src`, registered by the game's `register()`.
  Imports from the engine go through `@canvas/engine` only (no deep paths).
- Remove them from the engine's built-in registration and `index.ts`.
- The games e2e suite finds systems by `constructor.name` (`'BlackjackSystem'`)
  via the dev-only `window.__canvasWorld` hook — keep the class name.

Acceptance: engine has no Blackjack code; Blackjack checks in `pnpm e2e` pass
(split, insurance, surrender, peek, reshuffle, Play Again).

### Phase 4 — Sudoku, Solitaire, Snake

- Sudoku: move `sudokuGenerator.ts` into the sudoku package; register it under
  the name the manifest already uses (`generator: 'sudoku'`).
- Solitaire: move `dealKlondike` into the solitaire package as a registered
  deal pattern; `CardPileSystem` stays generic.
- Snake: manifest-only; just confirm it needs nothing from the engine beyond
  generic systems.

Acceptance: engine contains no Sudoku/Klondike-specific code; their e2e checks
pass (number pad, solve to "You win!", undo, draw 3, double-click, auto-finish,
no-moves).

### Phase 5 — Poker

- Move `PokerSystem`, `PokerRendererSystem`, `pokerGameState.ts`,
  `pokerTypes.ts`, `PokerConfigComponent`, `util/botAI.ts`, and the engine's
  `util/handEvaluator.ts` into `packages/games/poker`. `SidePanelSystem` and
  `NetworkSystem` are only used by poker today — decide whether they're
  generic enough to stay in the engine (they look generic; prefer keeping them)
  and note the decision in `ARCHITECTURE.md`.
- The poker package now has both client (`register`) and server (`server`)
  sides. **Do not** merge the two poker rule implementations in this plan —
  that's a separate project (see `ARCHITECTURE.md` drawbacks); just move code.
- The poker lobby/room pages and `/play/poker` routes stay in the platform.

Acceptance: engine has no poker code; both poker e2e suites pass (protocol and
two-browser), and the poker unit tests run from the poker package.

### Phase 6 — Enforce boundaries and prepare for separate repos

- Add a check (lint rule or a small script in CI) that game packages import
  only `@canvas/engine` (no deep `@canvas/engine/src/...` paths, no
  `@canvas/web`/`@canvas/server`), and the engine imports no game or platform
  package.
- Make the engine buildable as a real package: `exports`/`types` pointing at
  built output (it currently points at `src/`), and declare it as a
  `peerDependency` of each game package.
- Give game packages a minimal standalone way to run their game against the
  engine (a tiny dev page), so a future game repo can develop without the
  platform. Optional but recommended.
- Update `ARCHITECTURE.md` (package layout, decisions, drawbacks) and the
  `verify` skill if commands or paths changed.

Acceptance: boundaries are enforced in CI. At this point, moving a package to
its own repo is file-moving plus publishing — that move itself is **not** part
of this plan; stop and report.

## Out of scope

- Separate git repos, publishing to npm/GitHub Packages.
- Runtime loading of game code.
- Merging the single-player and multiplayer poker rules.
- New features or gameplay changes.

## When done

Report: what moved where, anything you decided differently from this plan and
why, and any follow-ups. Leave this file in place with its status updated.

## Progress and deviations

Recorded by the session carrying out the plan.

### Phase 1 — done
- Deal patterns: `dealPatterns` registry (`engine/src/generators/dealPatterns.ts`);
  a pattern returns placements (`{pileId, card, faceUp}`) and `CardPileSystem`
  creates the entities. `DealPatternConfig` is `{type: string, ...options}`.
- `SystemName` is `BuiltinSystemName | (string & {})`, so editors still
  suggest built-in names. `EntityComponents` takes game-registered
  components through an index signature.
- `ServerSystem`/`RoomPlayer` live in `engine/src/server.ts`, exported as a
  separate DOM-free entry, **`@canvas/engine/server`**, as well as from the
  main entry. The Worker can't typecheck the engine's main entry (no DOM
  lib; the engine uses `baseUrl` bare imports), so the server and the
  poker package's server side import the subpath.
- Packages that reference the engine project typecheck with `tsc -b`
  (as `web` already did); `tsc --noEmit` fails on a clean checkout.

### Phase 2 — done, with two deviations
- **The server side isn't in `GameDefinition`.** A game's `.` entry exports
  its `GameDefinition` (id, manifest, `register`); a multiplayer game's
  server rules are a separate DOM-free `./server` entry. Putting `server` on
  the definition would make the Worker import client code (canvas systems,
  DOM types). So there are two lists, both in the platform:
  `web/src/platform.games.ts` (every game, client side) and
  `server/src/games/registry.ts` (server rules of multiplayer games).
- **`ManifestRegistry` is retired but not deleted.** Manifests are bundled
  (2a), and the `/manifests` routes, `upload-manifests.mjs`, the deploy
  upload step, the cache purge, the CORS special case, and the
  `MANIFEST_ADMIN_TOKEN` usage are gone (2b). The class itself remains as a
  stub returning 410, still bound in `wrangler.toml`, with its stored
  manifest copies intact. Deleting it takes a `deleted_classes` migration,
  which permanently deletes the namespace and stops wrangler from rolling
  back past that deploy — irreversible in production, so it's left for the
  owner. To finish: remove the `MANIFEST_REGISTRY` binding, the stub class
  and its export from `server/src/index.ts`, and the `Env` field, then add

  ```toml
  [[migrations]]
  tag = "v2"
  deleted_classes = ["ManifestRegistry"]
  ```

  Then delete the now-unused `MANIFEST_ADMIN_TOKEN` Worker secret
  (`wrangler secret delete MANIFEST_ADMIN_TOKEN`) and GitHub Actions secret.
- `STATIC_GAMES` (the empty escape hatch in the web registry) is gone: any
  game can now ship code through `register()`.

### Phase 3 — done
- `BlackjackSystem` and `BlackjackConfigData` live in
  `games/blackjack/src`; the game's `register()` registers both. The
  config component no longer self-registers on import.
- The engine now exports its card-hand helpers (`renderCardHand`,
  `rankLabel`, `suitColor`, `cardXPositions` and their types) as public API.

### Phase 4 — done
- `generateSudoku` lives in `games/sudoku/src/sudokuGenerator.ts` and
  `dealKlondike` in `games/solitaire/src/klondikeDeal.ts`, both plain
  exported functions that the game's `register()` installs under the names
  the manifests already use (`sudoku`, `klondike`). Neither self-registers
  on import any more.
- Snake needed nothing: its manifest lists only generic grid systems.

### Phase 5 — done
- Poker's client code is in `games/poker/src/client/` (`PokerSystem`,
  `PokerRendererSystem`, `pokerGameState`, `pokerTypes`,
  `PokerConfigComponent`, `botAI`, and the client `handEvaluator`); the
  subfolder keeps it apart from the server-side `handEvaluator.ts`/`types.ts`.
  The game's `register()` registers the two systems and `PokerConfig`.
- `SidePanelSystem` and `NetworkSystem` stay in the engine (they have no
  poker knowledge); recorded in `ARCHITECTURE.md`.
- The Worker bundle size is unchanged: it imports only `./server`.

### Phase 6 — done
- **Boundaries:** `scripts/check-boundaries.mjs` (`pnpm check:boundaries`)
  runs first in `deploy.yml`. It fails if the engine imports any workspace
  package or a relative path outside itself, or if a game imports anything
  but `@canvas/engine`, `@canvas/engine/server` and its own files.
- **Buildable engine:** its imports are now relative (they were `baseUrl`
  bare specifiers like `'core/System'`, which a published `.d.ts` can't
  resolve). `pnpm --filter @canvas/engine build` (`tsc -b`) emits ESM +
  `.d.ts` to `dist/`, and `main`/`types`/`exports` point there, with
  `files: ["dist"]`. In-repo consumers still resolve the engine to `src/`
  through tsconfig `paths` (web, games, and now the server for
  `@canvas/engine/server`), so dev, e2e and CI need no build step. Checked
  by packing the engine and typechecking (strict, without `skipLibCheck`)
  and bundling a small game with a custom system in a project outside the
  repo. The unused Vite library config is gone.
- Each game declares `@canvas/engine` as a `peerDependency` (`workspace:^`),
  plus a `devDependency` for local work.
- **Standalone dev pages:** `pnpm dev` in any game package serves
  `dev/index.html` through `dev/vite.config.ts` (kept out of the package
  root so Vitest doesn't use it), running the game via the engine's new
  `runGame(definition, canvas)`. Checked in Chromium for all five games.
  For poker this runs the single-player bot mode, which the platform UI
  still never opens.
- `ARCHITECTURE.md` (package layout, boundaries, decisions, drawbacks) and
  the `verify` skill are updated. The root `build` script no longer calls
  the nonexistent `@canvas/games-snake build`.

## Follow-ups

1. **Delete `ManifestRegistry`** when the owner is ready (steps under
   Phase 2 above). Irreversible: it drops the namespace and its stored
   manifest copies, and wrangler then refuses rollbacks past that deploy.
   After that, delete the `MANIFEST_ADMIN_TOKEN` Worker and GitHub secrets.
2. Moving packages into their own repos (out of scope here): publish
   `@canvas/engine` from its `dist/`; swap each consumer's tsconfig
   `paths` entry for the published version; give each game repo its
   `dev/` page as its dev loop.
3. Consider one game list for both sides, e.g. a generated server
   registry from games that ship a `./server` entry. Today a multiplayer
   game is listed in `web/src/platform.games.ts` and
   `server/src/games/registry.ts`.
4. Unchanged from before and still open: merging the two poker rule
   implementations (now both inside `games/poker`), and unit tests for the
   ECS core and manifest validation.
