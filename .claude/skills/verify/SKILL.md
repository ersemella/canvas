---
name: verify
description: Verify Canvas behavior for real — run the unit tests and the end-to-end suites that start the Worker and web app locally and drive them with real browsers. Use after changing game rules, the GameRoom Durable Object, the poker room page, or engine systems poker uses, and whenever asked to check, test, or manually verify that multiplayer poker works.
---

# Verifying Canvas

Two layers. Run both after any change that touches poker or the room server; they take about a minute together.

## 1. Unit tests — `pnpm test`

Runs every workspace package's `test` script (currently `packages/games/poker`, Vitest). Covers the poker rules engine (`serverLogic.ts`): action validation and exploit attempts, min-raise sizing, side pots, split pots and odd chips, heads-up blinds, button rotation, busted players sitting out, what each viewer can see, timeout actions, and a fuzz test that plays ~2,000 random hands with illegal actions mixed in and asserts chips are conserved.

Add new rules tests next to the code as `*.test.ts`.

## 2. End-to-end — `pnpm e2e`

`scripts/e2e/run.mjs` starts `wrangler dev` (127.0.0.1:8787) and Vite (localhost:3000), runs every `scripts/e2e/*.e2e.mjs` suite, then stops both servers. Pass a filter to run a subset: `pnpm e2e protocol`.

| Suite                    | What it proves                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `games.e2e.mjs`          | Single-player games in Chromium: all 5 games listed; Snake score counts, food never spawns on the snake, Game Over shows the score; Sudoku solved with real key presses ends on "You win!"; Blackjack dealer-natural peek, 3:2 natural payout, between-hand reshuffle, cards drawn on screen and still drawn after Play Again. Uses `window.__canvasWorld` (dev server only), so it skips itself against production. |
| `poker-protocol.e2e.mjs` | Raw WebSocket clients against the Worker: host-only start, negative raise can't mint chips, out-of-turn and check-into-a-bet rejected, mid-hand `nextHand` ignored, fold-wins hide cards, button rotates, seat held on disconnect, reconnect by name returns the same cards, disconnected player times out in ~10s.                                                                                                  |
| `poker-browser.e2e.mjs`  | Two Chromium windows: host vs guest lobby views, a full hand played by clicking the canvas buttons, next hand, refresh mid-hand, the 30s turn timeout.                                                                                                                                                                                                                                                               |

Output goes to `e2e-results/` (gitignored): `poker-*.png` screenshots, plus `wrangler.log` and `vite.log`. **Look at the screenshots** when a browser check fails — the canvas is drawn, so the DOM can't show what's on the table. A healthy run shows real player names (not "Bot1…"), your own hole cards, and the log in the side panel.

### Requirements

- Node 22+ (the protocol suite uses the built-in `WebSocket`).
- Ports 8787 and 3000 free. The runner refuses to start if either is already answering (a leftover server would serve stale code); stop stray `wrangler`/`vite`/`workerd` processes first.
- Chromium for Playwright. Cloud sessions have it preinstalled; on a laptop run `pnpm exec playwright install chromium` once.

### Against a deployed site

Set both URLs and the runner uses them instead of starting servers:

```
E2E_API_URL=https://canvas-server.esemella.workers.dev E2E_WEB_URL=https://canvas-bdg.pages.dev pnpm e2e
```

This creates a real room in production (it expires on its own). In a cloud session both hosts must be allowed in the environment's network settings first.

CI does exactly this after every deploy: the `smoke-prod` job in `.github/workflows/deploy.yml` runs `pnpm e2e` against production and uploads `e2e-results/` as a run artifact. When it fails, download that artifact and look at the screenshots and logs before changing code.

## Gotchas when writing suites

- Canvas buttons have no DOM: click by canvas coordinates, scaled from the scene size (1120×620 for poker) to the canvas's on-screen box. Button centers live in `packages/games/poker/game.json`.
- The poker client disables Call when nothing is owed; click Check first and fall back to Call.
- Use `check()`/`finish()` from `scripts/e2e/lib.mjs`; a suite fails by exiting non-zero.
- Don't `pkill -f wrangler` from a shell whose own command line contains that word — it kills the shell. The runner stops servers by process group.
