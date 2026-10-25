# Plan: Silk Road Run in the browser

Status: **draft, 2026-10-25; waiting on the owner's decisions (*Open
questions*).** Nothing is built. It would replace decisions D3, D4 and D7
of [roguelike-tactics/architecture.md](roguelike-tactics/architecture.md)
for Silk Road Run, so it needs the owner's go-ahead first. **When starting
the work,** read this file, then `architecture.md` (D3, D7, D11 and
*Long-lived storage and cost*), [roguelike-tactics/ai-search.md](roguelike-tactics/ai-search.md)
(*Work caps* and *Looking deeper with narrower decisions*) and
`.claude/skills/verify/SKILL.md`.

## Goal

The whole run (creating it, every turn, every AI turn and saving it) runs
in the player's browser. The Worker serves no `/runs` request, so:

- the AI isn't bound by the Free plan's 10 ms of CPU a request and can
  search deeper (the 56% win of `searchWidths` [4, 3, 2], depth 5,
  measured and left unbuilt for lack of CPU);
- a turn needs no round trip, so it plays as soon as it's confirmed;
- the game uses none of the account's daily 100,000 requests and
  Durable Object writes, which poker shares.

The game must play exactly as it does now: same rules, same views, same
page, same playback.

## What it gives up

These are the reasons architecture.md keeps the run on the server. They
are accepted here, for as long as nothing in the game reaches other
players:

- **Permadeath and the hidden seed aren't enforced.** The run, its seed
  included, sits in the browser's storage. A player can read the seed
  (future encounters and offers), or copy their storage and restore it
  after a death. That only affects their own single-player game.
- **Rival caravans and rewards (D1, D2, D8, D9) can't be built on top of
  it.** A party built in a browser can be forged. Building them means
  bringing a server back: the run plays in the browser and the server
  replays what other players will see before it counts (option 2 of
  2026-10-25). Combat is deterministic, so a run's seed and its actions
  are enough to replay it. This plan keeps that open (L6).
- **A run lives on one browser.** No resuming on another device, and
  clearing the site's data ends the run. The player key (D4) already
  lived in `localStorage`, so a run was in practice tied to the browser
  already.

## What already exists (don't rebuild it)

- **The rules are already browser-safe.** `silkRoadRunRunSystem` in
  `packages/games/silk-road-run/src/server.ts` has no DOM and no Worker
  dependencies (only `@canvas/engine/server`), it's deterministic, and it
  never reads a clock. `testStage.ts` imports `test-stage.json`, which
  Vite bundles.
- **The page already runs the rules.** Previews (D11) call into
  `@canvas/games-silk-road-run` from `useTurnPlan.ts`, so most of the
  fight code is in the page's bundle already.
- **One seam.** The page reaches the server only through `runsApi`
  (`packages/web/src/pages/tactics/runsApi.ts`), and every method answers
  a `RunResponse` (`{runId, game, status, view}`). `useRun.ts` builds on
  it and on nothing else.
- **The AI turn is already its own step.** While `view.aiDue` is set the
  page asks for the AI's turn (`continue`) and plays the answers back in
  order; it's already asynchronous, so the AI can move to a Web Worker
  without `useRun` changing how it waits.
- **`RunRoom`'s logic is small** (`packages/server/src/durableObjects/RunRoom.ts`):
  create, act, view, abandon, end an outdated run, and nothing else the
  browser needs (the ledger only tracks the one active run).

## Decisions (proposed)

### L1. A local `runsApi`, same interface

A new `localRuns.ts` beside `runsApi.ts` with the same methods and the
same answers: `active`, `get`, `start`, `turn`, `continue`, `next` and
`abandon` (today's server route), each returning a `Promise<RunResponse>`.
It does what `RunRoom` and `routes/runs.ts` do today:

- `start`: a new `runId`, a seed from `crypto.getRandomValues`, then
  `createRun(seed, setup)`; the active run, if any, is abandoned.
- `turn`, `continue`, `next`: `handleAction(state, {...body, type})`. A
  thrown `RuleError` becomes a rejected promise with its message, as an
  error answer is today. Then `status(next)`, save, and answer
  `getView(next)`.
- `get`: an outdated run (`outdated(state)`) is ended as `expired` and
  rejected with today's message; the page starts a new one, as now.
- A finished run is kept until a new one starts (no alarm, no ledger).

`useRun` imports `localRuns` instead of `runsApi`; nothing else in the
page changes. `RunResponse` and `RunStatus` stay the engine's types.

**Why:** the page, its playback and its tests are built around these
answers; keeping them makes the move a swap of one module, and the swap
back (or to option 2) the same.

### L2. The AI in a Web Worker

`continue` posts the run's state to a module worker
(`new Worker(new URL('./aiWorker.ts', import.meta.url), {type: 'module'})`),
which runs `handleAction(state, {type: 'continue'})` and posts the new
state back. The other actions are fast (a player's turn alone has a p99 of
0.06 ms) and stay on the main thread. One AI turn per `continue` stays, so
the page keeps playing each turn back as it arrives.

**Why:** a deeper search (L5) can take tens of milliseconds, or more on a
slow phone; on the main thread it would stall the board's playback.

- The state crosses as a structured clone; the rules' WeakMap caches
  (`board.ts`, `map.ts`, `threat.ts`, `fight.ts`) start empty for each
  call, as they do today in `RunRoom`. Keeping the state in the worker
  between calls would let them hit; measure first (it was the open idea
  of 2026-10-25 for `RunRoom`).
- A browser without module workers (none the game supports today, but
  check) runs the same call on the main thread.

### L3. One saved run in `localStorage`

One key, `canvas:tactics:run`, holds the run as `RunRoom` stores it:
`{runId, game, state, status, createdAt, updatedAt}`, written after every
action, before answering. `active` reads it. Starting a run overwrites it
(abandoning the old one, as one active run per player key does now).

- Measure the saved size of the largest run (the last stage's fight with
  its log); `localStorage` allows about 5 MB a site. If it's near that,
  use IndexedDB instead (asynchronous, which `localRuns` already is).
- Storage blocked (private mode, some embeds): the run lives in memory
  for the page load and a reload starts over, as the player key does
  today.
- Two tabs: the last write wins. Listen for the `storage` event and
  reload the run in the other tab, or show "this run is open in another
  tab". Proposed: reload it.
- `RUN_FORMAT` and `outdated` keep working: a run saved by an older
  release is ended, not migrated, as now.

### L4. The seed in the browser

`createRun` takes a seed from `crypto.getRandomValues`, as the Worker
does now. The view still never carries it (`getView` is unchanged, and
the page only ever renders the view), but the saved run does. No attempt
to hide it: anything the page can read, the player can.

### L5. A larger AI budget (its own phase)

Once the AI runs in a worker, the budget is the owner's call, not the
platform's:

- Merge the width taper (branch `claude/ai-width-taper`,
  `AI.searchWidths`, still unmerged): `[4, 3, 2]`, `searchDepth` 5,
  220 units won 56% on mirrored pairs (ai-search.md).
- Keep the cap in work units, never a clock, so the AI stays
  deterministic: the same position gets the same turn on every device.
- Choose the cap from a time target on a slow device, for example the
  slowest AI turn under 100 ms with Chrome's CPU throttled 4× (Playwright
  can emulate it). Measure what deeper horizons and larger caps buy with
  `mirror.mjs`, as before.
- The balance scripts (`scripts/balance/`) already run the AI locally, so
  their numbers stay comparable.

### L6. The server code goes, in a later phase

After the browser version has shipped and played well for a while:

- Remove `RunRoom`, `PlayerLedger`, `routes/runs.ts`, `playerKey.ts` (if
  nothing else uses it) and their bindings, with a `deleted_classes`
  migration in `wrangler.toml` (as planned for `ManifestRegistry`).
  Deleting a class deletes its stored runs.
- Remove `"canvas": {"serverKind": "run"}` from the game's `package.json`,
  so `gen-game-registry.mjs` leaves it out of the Worker bundle. Decide
  whether `RunSystem` stays in `@canvas/engine/server` (proposed: yes,
  the browser uses it, and option 2 would need it on the server again).
- Runs on the server when the page switches are left behind: the page
  never asks for them again and their players start a new run (the same
  as a `RUN_FORMAT` bump). They're deleted with the class.

**Why later:** until then the switch can be undone by reverting one
import, and the server's tests keep proving the rules work under the
Worker too, which option 2 would need.

## Phases

1. **Local runs.** `localRuns.ts` (L1, L3, L4) and the AI worker (L2);
   `useRun` switched; same AI budget as now. The Worker still has
   `/runs`, unused by the page.
   - Tests: the page has no unit test runner, so either add Vitest to
     `@canvas/web` for `localRuns` (start, a turn, an illegal turn leaving
     the run unchanged, `continue` refused when no AI turn is due, a
     reload resuming, an outdated run ending, storage blocked), or test
     it through the browser suite. Proposed: Vitest.
   - `tactics.e2e.mjs`: the page part keeps every check it has, and
     checks that the page sends no `/runs` request. A reload resuming and
     Reset run work as they did. The API part (player keys, another
     key's run, the seed never in the view) stays while the routes exist.
   - Check the bundle size the rules and the worker add to the page.
2. **Deeper AI** (L5): merge the width taper, measure on a throttled
   CPU, set the caps.
3. **Remove the server's runs** (L6), the API part of `tactics.e2e.mjs`
   and `RunRoom.test.ts`.
4. **Docs, as each phase lands:** architecture.md (D3, D4, D7 replaced,
   and *Long-lived storage and cost*: no requests per action), the
   tactics README's status and decision index, history.md (why the run
   left the server), ai-search.md (*Work caps*: no 10 ms ceiling),
   owner-decisions.md section 3, the verify skill's `tactics.e2e.mjs`
   row, and `ARCHITECTURE.md` where it describes runs.

## Open questions (the owner's)

1. **Go ahead at all?** It gives up enforced permadeath, the hidden seed
   and (until a server returns, option 2) rival caravans.
2. **The AI budget** (L5): what time target on what device.
3. **Two tabs** (L3): reload the run in the other tab, or refuse there.
4. **Unit tests in `@canvas/web`** (phase 1): add Vitest, or browser
   tests only.
5. **When to remove the server's runs** (L6), and whether `RunSystem`
   stays in the engine.
