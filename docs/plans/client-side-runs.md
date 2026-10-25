# Plan: Silk Road Run in the browser

Status: **built 2026-10-25** (phases 1 to 4; *Built*, below). Drafted the
same day, and the owner's answers are in *Owner's decisions*. It replaces
decisions D3, D4 and D7 of
[roguelike-tactics/architecture.md](roguelike-tactics/architecture.md) for
Silk Road Run. **For later work on it,** read *Built* and the decision it
concerns, then `.claude/skills/verify/SKILL.md`.

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

## Decisions

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
- Two tabs: only one plays the run (owner, 2026-10-25). The first to
  open it holds a Web Lock; another shows "This run is open in another
  tab" and waits for the lock, taking the run over once that tab closes.
  Without Web Locks every tab plays and the last write wins.
- `RUN_FORMAT` and `outdated` keep working: a run saved by an older
  release is ended, not migrated, as now.

### L4. The seed in the browser

`createRun` takes a seed from `crypto.getRandomValues`, as the Worker
does now. The view still never carries it (`getView` is unchanged, and
the page only ever renders the view), but the saved run does. No attempt
to hide it: anything the page can read, the player can.

### L5. The AI as deep as the device allows

The owner chose (2026-10-25) to look as deep as the current device gets,
rather than a fixed cap from a time target. So in the browser:

- The host passes the rules a clock (`RunContext.now`), and an AI turn
  searches until `AI.browser.thinkMs` (400 ms) has passed, deepening one
  decision at a time and keeping the last depth it completed, as before.
  The clock is read every 32nd unit of work.
- The width taper (from branch `claude/ai-width-taper`, now merged as
  `AI.searchWidths`): `AI.browser.widths` [4, 3, 2], the last for any
  deeper decision. A ceiling of 24 decisions, and 24,000 units of work to
  bound memory (the search keeps every fight it plays: about 60 MB at
  20,000).
- **The AI is no longer deterministic in the browser:** a faster device
  looks deeper and may choose another turn. Nothing needs it to be (no
  server replays the run). Without a clock (unit tests, `scripts/balance/`)
  it keeps `AI.maxSimulations` and `searchDepth` 3, and plays exactly as
  before, so balance numbers stay comparable.

### L6. The server code goes

The owner chose (2026-10-25) to remove it once the page had moved; done in
the same change:

- Remove `RunRoom`, `PlayerLedger`, `routes/runs.ts`, `playerKey.ts` (if
  nothing else uses it) and their bindings, with a `deleted_classes`
  migration in `wrangler.toml` (as planned for `ManifestRegistry`).
  Deleting a class deletes its stored runs.
- Remove `"canvas": {"serverKind": "run"}` and the `./server` entry from
  the game's `package.json` (its entry is `./run`), so
  `gen-game-registry.mjs` leaves it out of the Worker bundle; the
  generator no longer knows run games. `RunSystem` stays in
  `@canvas/engine/server`, with the run host that took `RunRoom`'s logic
  (owner: keep what's reusable in the engine).
- Runs on the server when the page switches are left behind: the page
  never asks for them again and their players start a new run (the same
  as a `RUN_FORMAT` bump). They're deleted with the class.

Going back to the server (option 2) would mean a host like `RunRoom`
again, calling the same `playRun`.

## Phases

1. **Local runs.** `localRuns.ts` (L1, L3, L4) and the AI worker (L2);
   `useRun` switched; same AI budget as now. The Worker still has
   `/runs`, unused by the page.
   - Tests: the run host's logic is unit-tested in the engine
     (`runs.test.ts`); the page itself through the browser suite only
     (owner, 2026-10-25).
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

## Owner's decisions (2026-10-25)

1. **Go ahead.**
2. **The AI budget** (L5): be flexible, as deep as possible on the
   current device.
3. **Two tabs** (L3): refuse to play in the second.
4. **Tests:** browser tests only in `@canvas/web` (no Vitest there).
5. **The server's runs** (L6): removed once the page has moved; what's
   reusable stays in the engine.

## Built (2026-10-25)

- **Engine:** `src/runs.ts` in `@canvas/engine/server`: `RunSystem` (its
  `handleAction` takes a `RunContext`), `RunRecord`, and the host,
  `startRun`, `playRun`, `runResponse`, `outdatedRun`, `expireRun`,
  `abandonRun`, throwing `RunError` with the player's message. Tests in
  `src/runs.test.ts`.
- **Page:** `pages/tactics/localRuns.ts` (L1, L3, L4: the methods
  `runsApi` had, the run in `localStorage` under `canvas:tactics:run`, in
  memory when storage is blocked; the tab claimed with a Web Lock,
  `canvas:tactics:tab`) and `aiWorker.ts` (L2: every action, played in
  order). A tab without the lock shows "This run is open in another tab"
  and takes the run over once that tab closes. `runsApi.ts` and the dev
  server's `/runs` proxy are gone.
- **Game:** `src/run.ts` (the `./run` entry) in place of `src/server.ts`;
  `handleRunAction` takes the context and, given a clock, searches with
  `AI.browser` (L5).
- **Server:** `RunRoom`, `PlayerLedger`, `routes/runs.ts` and
  `playerKey.ts` removed; migration `v3` deletes both classes (L6).
- **Tests:** `tactics.e2e.mjs` lost its API part (the rules behind it are
  in `rules.test.ts`) and checks that the page sends no `/runs` request, a
  second tab is refused, and takes over once the first closes.

**Measured** (this machine, Node, 40 AI turns from six runs): in 400 ms
the search completed 11 to 24 decisions, median 13, against 3 before, on
about 15,000 units of work, with up to 63 MB held while it runs. Against
the AI before (`scripts/balance/mirror.mjs --ai browser-slow,production`
and the other way round, 80 mirrored pairs from seed 7000 each way), at
only 100 ms a turn and with the machine's four cores shared by two runs and
the end-to-end suites: **87% of decided fights** (90.3% as team a, 84.2%
as team b). Unfinished fights (no winner in 400 actions) were 25 to 29%, against
10.7 to 13.7% in the balance README's runs of the AI before against
other AIs (2026-10-22): worth watching in play.

## Follow-ups

- **Slow phones:** the depth reached is untested on a phone. 400 ms and
  24,000 units are the knobs (`AI.browser`); a phone's memory may want a
  lower `work`.
- **Stalled fights:** see *Measured*; the evaluation may prefer waiting
  when it sees far enough to know an attack is answered.
- `ManifestRegistry`'s `deleted_classes` migration (engine-platform-split
  follow-ups) can go in the next one.
