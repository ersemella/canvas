# Plan: what an async game needs beyond room support

Status: **parked until an async game exists.** Written 2026-10-12. Start
when someone is building a game whose turns take hours and whose games last
days. Read this whole file, then `ARCHITECTURE.md` (especially *Room timing
is a per-game policy*), `CLAUDE.md`, and `.claude/skills/verify/SKILL.md`,
before changing anything.

## Goal

A player can start or join an async game, close the tab, get told when it's
their turn (even days later, on another device), come back to the right
seat, and see all their open games in one place — without changing how
poker (real-time) plays.

## What already exists (don't rebuild it)

Done 2026-10-12 (`feat(server): per-game room policies…`):

- **Room policies.** A game's `ServerSystem.room` (`RoomPolicy` in
  `@canvas/engine/server`) can turn off turn timeouts, keep empty rooms,
  extend the room TTL on activity (e.g. 14 days), hold lobby seats, deal
  absent players into new rounds, and switch to **seat tokens**. Defaults
  are real-time and are what poker uses. Logic: `packages/server/src/roomPolicy.ts`
  (pure, unit-tested); I/O: `packages/server/src/durableObjects/GameRoom.ts`.
- **Seat tokens (server side).** With `seatIdentity: 'token'`, the seat's
  first `connected` message carries `seatToken`; only that token (as
  `seatToken` in the join body and on the WebSocket URL) reclaims the seat,
  and a newer connection with it closes the old socket with code `4000`.
  Stored in `RoomRecord.seatTokens` (DO storage), never broadcast.
- **Proof.** `scripts/e2e/rooms-async.e2e.mjs` drives a test-only
  turn-based game (`packages/server/test/asyncTestGame.ts`), served only by
  the local e2e Worker entry (`packages/server/test/e2e-worker.ts`).
- **Game list.** A new game goes in `platform.games.json`, then
  `pnpm games:gen`. A multiplayer game's package exports `./server`
  (default-exporting its `ServerSystem`).

What's missing is everything a *player* needs: the web client is
poker-specific, nothing keeps seat tokens in the browser, there's no list of
your games, and nothing tells you it's your turn.

## Ground rules

- Same workflow as `docs/plans/engine-platform-split.md`: one phase (or
  sub-step) per merge to `main` (no PR unless asked), each verified with
  `pnpm check:boundaries`, `pnpm games:check`, `pnpm -r --if-present typecheck`,
  `pnpm test`, `pnpm e2e` (look at the screenshots), then a green deploy
  including `smoke-prod`. Every push touching `packages/**` deploys to
  production.
- **Poker must not change.** Everything here is opt-in per game (room
  policy, a manifest field, or a new page). The poker suites are the guard;
  `rooms-async` asserts poker gets no seat token.
- **Develop against the test game first**, then the real one. Extend
  `asyncTestGame` (and give it a tiny client if a phase needs a browser)
  rather than waiting on the real game's rules.
- Secrets (VAPID private key, email API key) go in `wrangler secret put` and
  a gitignored `.dev.vars` locally — never `wrangler.toml` `[vars]`.

## Decisions to make before starting

Ask the owner; each changes the work below.

1. **Accounts or not?** Recommended: **no accounts** for v1. Identity stays
   the per-room seat token kept in the browser, moved between devices with
   a rejoin link (Phase 2). Accounts would replace Phases 2–3's
   browser-side bookkeeping but add sign-in, recovery and a user store.
2. **Email fallback?** Web push doesn't reach iPhone users unless they add
   the site to their Home Screen (iOS 16.4+), and can be blocked or
   dropped. Email reaches everyone but needs a provider (Cloudflare Email
   Service, Resend, Postmark…), address collection with consent, and
   unsubscribe. Recommended: push first (Phase 4), email as an optional
   Phase 5 once there are real players.
3. **Turn deadlines for the async game.** None at all, or a long one (e.g.
   3 days, then the game's `timeoutAction`)? Reminders before it (Phase 6)?
   This is a game-design call per game; the room policy supports both.
4. **Push library or hand-rolled?** Web Push needs RFC 8291 payload
   encryption and a VAPID (RFC 8292) ES256 JWT. Both are doable with the
   Workers WebCrypto API; a small Workers-compatible library saves code.
   Pick one that runs on Workers without Node built-ins, or hand-roll
   (~150 lines) with test vectors.

## Phases

### Phase 1 — Generic multiplayer room UI

Today `/play/poker` (`web/src/pages/poker/PokerLobbyPage.tsx`) and
`/play/poker/:roomId` (`PokerRoomPage.tsx`) are poker-only: the lobby
hard-codes `serverSystem: 'PokerServerSystem'` and `maxPlayers: 6`, and the
room page builds poker's module.

- Let a game declare it's multiplayer: `GameManifest.serverSystem` already
  exists (unused); add `maxPlayers` (and `minPlayers` if useful) beside it.
- Add generic lobby and room pages (`/play/:gameId` for a manifest with
  `serverSystem`, `/play/:gameId/:roomId` for a room), driven by the game's
  definition: create/join, waiting list, host-only start, then the game's
  canvas wired to the WebSocket exactly as `PokerRoomPage` does (`ws:send`
  ↔ socket, `sync` after mount).
- **Leave poker on its own pages.** Migrating poker to the generic pages
  is optional and only once they're proven; if done, it must keep every
  poker e2e check passing unchanged.

Acceptance: the test game is playable by two browsers through the generic
pages; poker suites unchanged.

### Phase 2 — Seat tokens in the browser

- Store per room `{name, seatToken, gameId}` in `localStorage` (key per
  room). Save `seatToken` from `connected`; send it in the join body and on
  the WebSocket URL for token games.
- Handle close code `4000` ("Opened on another device or tab") instead of
  reconnecting in a loop.
- **Rejoin link** to move a seat to another device:
  `/play/:gameId/:roomId#seat=<token>`. Use the URL *fragment* so the token
  never reaches a server or its logs; the page reads it, stores it, and
  strips it from the address bar.
- Consider moving the token out of the WebSocket URL (query strings can
  land in request logs): accept it as the first WebSocket message
  (`{action: 'auth', seatToken}`) before seating. Server change, token
  games only; keep the URL form working for one deploy if it shipped.
- Lost token (cleared storage, no link saved): the seat is gone. Decide
  whether the host may release a seat, or accept the loss for v1.

Acceptance: e2e — reload keeps the seat; a second browser context with the
rejoin link takes the seat and the first sees the "opened elsewhere"
message; a context with the name but no token is refused.

### Phase 3 — "My games" list

- A page (and home-page section) listing the rooms in `localStorage` with
  game, players, status, and **whose turn**, plus "Your turn" badges.
- Server: extend `GET /rooms/:id` (`handleMeta`) with the acting player's
  *name* (from `actingConnectionId`) and a last-activity time. Public
  info only — no game state, no tokens.
- Drop rooms that return 404 (expired or deleted) from the list.
- Rooms stay discoverable only by link/code; there's no public room list.

Acceptance: e2e — two rooms joined in one browser both show, with the
correct "your turn" flag, and update after a move.

### Phase 4 — Push notifications ("your turn")

Client:
- A service worker (`web/public/sw.js`) that shows the notification and
  focuses or opens the room on click.
- A web app manifest + icons, so iOS users can **Add to Home Screen**
  (required for push on iPhone/iPad) — with a short in-app explanation
  shown to iOS Safari users.
- A "Notify me when it's my turn" button (permission must come from a
  tap). On grant: `pushManager.subscribe` with the VAPID public key
  (`VITE_VAPID_PUBLIC_KEY`), then send the subscription to the room.

Server:
- New WebSocket action `subscribePush` (token games only) storing the
  subscription per seat in DO storage beside `seatTokens`; never broadcast;
  deleted with the room. Allow unsubscribing.
- After `commitGameState`, if the acting player changed and isn't
  connected, send one push (`ctx.waitUntil`, so the move isn't delayed):
  short payload (`{roomId, gameId, text: 'Your turn in …'}`), TTL ~1 day,
  topic per room so a newer push replaces an unread older one.
- Drop a subscription on `404`/`410` from the push service.
- One notification per turn change; no push for your own move or while
  you're connected.
- VAPID keys: generate once; private key via `wrangler secret put
  VAPID_PRIVATE_KEY` (and `.dev.vars`), public key in the web build env and
  a GitHub Actions secret for the deploy.

Testing: real push services can't be reached from e2e, so the local runner
starts a small HTTP server that acts as the push endpoint; the suite
registers a subscription pointing at it with test keys, makes a move, and
decrypts the captured request (proves encryption + VAPID). A Playwright
check covers the permission flow and the service worker showing a
notification from a simulated push event.

Acceptance: the above suites pass; `smoke-prod` unaffected (push checks
local-only); poker never sends pushes.

### Phase 5 — Email fallback (only if decided)

- Collect an address per seat with explicit consent; store with the seat,
  deleted with the room; every email has an unsubscribe link (a signed URL
  that clears it).
- Send when it's your turn and you have no push subscription, or after a
  delay (e.g. 30 min) with no move — use the room alarm (see Phase 6).
- Provider key via `wrangler secret`; rate-limit sends per address.

### Phase 6 — Reminders, deadlines and game end

- Room policy: `remindAfterMs` (e.g. 24h into a turn: send a reminder).
  `nextAlarmAt`/`decideAlarm` in `roomPolicy.ts` gain the reminder time;
  unit tests as for the existing timers.
- Long turn deadlines already work (`turnTimeoutMs`, e.g. 3 days →
  `timeoutAction`); notify the timed-out player and the next one.
- **Game over.** `GameRoom` only knows "hand over" (`isHandOver`). An async
  game ends: add an optional `isGameOver(state)` to `ServerSystem`; then
  mark the room `finished`, notify everyone, stop timers, and expire the
  room sooner (e.g. 7 days, so players can see the result).
- **Leaving.** A "resign/leave game" action, with game-defined effect
  (forfeit, or a bot/timeout plays the seat).

### Phase 7 — Abuse and cost guards

Async rooms live for days and hold storage, and pushes are outbound calls:

- Per-connection WebSocket message rate limit in `GameRoom` (drop, then
  close on abuse) — also protects real-time rooms; must not affect normal
  poker play (check the poker suites).
- Cap rooms per creator/IP per day for async games (room creation is
  already limited to 10/min/IP).
- A budget alert on the Cloudflare account if it's on Workers Paid.

## Out of scope

- Accounts, sign-in, friends lists, matchmaking, public room listings.
- Native mobile apps.
- Changing poker's real-time behavior or moving poker onto the generic
  pages (optional, separate, only with its suites unchanged).

## When done

Update this file's status, record decisions and deviations per phase (as
the engine-split plan does), update `ARCHITECTURE.md` (room lifecycle for
async games, push/email, data kept per seat) and the `verify` skill (new
suites and the local push endpoint).
