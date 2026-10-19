/**
 * Async room policies over raw WebSockets, using the test-only
 * E2EAsyncCountSystem (packages/server/test/asyncTestGame.ts): seat tokens,
 * lobby seats held while away, no turn timeout for a disconnected player,
 * new rounds dealt to absent players, and a token reconnect replacing an old
 * socket. Also checks a poker room still gets no seat token.
 *
 * Needs the local test Worker, so it skips against a deployed site.
 */
import {API_URL, check, createPokerRoom, finish, sleep} from './lib.mjs';

if (!process.env.E2E_LOCAL) {
  console.log('  (skipped: needs the local test Worker with the async test game)');
  finish();
}

const WS_BASE = API_URL.replace(/^http/, 'ws');
const SYSTEM = 'E2EAsyncCountSystem';

function connect(roomId, name, seatToken) {
  const q = new URLSearchParams({playerName: name});
  if (seatToken) q.set('seatToken', seatToken);
  const ws = new WebSocket(`${WS_BASE}/rooms/${roomId}/ws?${q}`);
  const c = {
    ws,
    name,
    msgs: [],
    id: null,
    token: null,
    state: null,
    players: null,
    closeCode: null,
  };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    c.msgs.push(m);
    if (m.type === 'connected') {
      c.id = m.connectionId;
      c.token = m.seatToken ?? null;
    }
    if (m.state) c.state = m.state;
    if (m.players) c.players = m.players;
  };
  ws.onclose = (e) => (c.closeCode = e.code);
  return new Promise((res) => {
    ws.onopen = () => res(c);
    ws.onerror = () => res(null); // refused upgrade
  });
}
const send = (c, action, payload) => c.ws.send(JSON.stringify({action, payload}));
const join = (room, playerName, seatToken) =>
  fetch(`${API_URL}/rooms/${room}/join`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(seatToken ? {playerName, seatToken} : {playerName}),
  });
const close = async (c) => {
  c.ws.close();
  await sleep(400);
};
const actingName = (st) => (st.total >= 10 ? null : st.players[st.acting].name);

const res = await fetch(`${API_URL}/rooms`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({hostName: 'Ann', serverSystem: SYSTEM, maxPlayers: 4}),
});
const room = (await res.json()).roomId;

// ── Seat tokens ─────────────────────────────────────────────────────────────
let A = await connect(room, 'Ann');
await sleep(150);
let B = await connect(room, 'Ben');
await sleep(250);
check('each seat gets its own secret token', A.token && B.token && A.token !== B.token);
check('tokens are never broadcast', !JSON.stringify(A.msgs).includes(B.token));
const annToken = A.token;
const benToken = B.token;

// ── Lobby seats are held while away ─────────────────────────────────────────
await close(B);
const lobby = A.players;
check(
  'a player who leaves the lobby keeps their seat',
  lobby?.some((p) => p.name === 'Ben' && p.connected === false),
  lobby
);
check('the name alone cannot reclaim a seat (join)', (await join(room, 'Ben')).status === 409);
check('the name alone cannot reclaim a seat (socket)', (await connect(room, 'Ben')) === null);
check('the token can', (await join(room, 'Ben', benToken)).ok);
B = await connect(room, 'Ben', benToken);
await sleep(250);
check('reclaiming returns the same seat and token', B?.token === benToken, B?.token);

// ── No turn timeout while the acting player is away ─────────────────────────
send(A, 'startGame');
await sleep(400);
check(
  'the game starts with no turn deadline',
  A.msgs.find((m) => m.type === 'gameStarted')?.turnDeadline === null
);
const first = actingName(B.state);
const away = first === 'Ann' ? A : B;
const stays = away === A ? B : A;
const awayToken = away === A ? annToken : benToken;
const updatesBefore = stays.msgs.filter((m) => m.type === 'stateUpdate').length;
await close(away);
console.log('  … waiting 12s (poker would time a disconnected player out after 10s)');
await sleep(12_000);
check(
  'a disconnected player keeps their turn (no timeout move)',
  stays.msgs.filter((m) => m.type === 'stateUpdate').length === updatesBefore &&
    stays.state.total === 0,
  stays.state
);

// ── Back days later with the token, and play ────────────────────────────────
const back = await connect(room, away.name, awayToken);
send(back, 'sync');
await sleep(300);
check(
  'the returning player sees the game and has the move',
  back.state && actingName(back.state) === back.name
);
if (back === null || !back.state) finish();
if (away === A) A = back;
else B = back;

// Play the round out, taking turns.
for (let i = 0; i < 20 && A.state.total < 10; i++) {
  const mover = actingName(A.state) === 'Ann' ? A : B;
  send(mover, 'playerAction', {add: 2});
  await sleep(150);
}
check('the round finishes', A.state.total >= 10, A.state);

// ── New rounds include absent players ───────────────────────────────────────
await close(B);
send(A, 'nextHand');
await sleep(400);
check(
  'a new round deals in a disconnected player',
  A.state.round === 2 &&
    A.state.players
      .map((p) => p.name)
      .sort()
      .join() === 'Ann,Ben',
  A.state
);

// ── A newer connection replaces an old one ──────────────────────────────────
const A2 = await connect(room, 'Ann', annToken);
await sleep(400);
check(
  'reconnecting with the token replaces the old socket',
  A.closeCode === 4000 && A2?.token === annToken,
  A.closeCode
);
A2?.ws.close();

// ── Poker (default policy) is untouched ─────────────────────────────────────
const pokerRoom = await createPokerRoom('Pia');
const P = await connect(pokerRoom, 'Pia');
await sleep(250);
check(
  'a poker room sends no seat token',
  P &&
    P.msgs.find((m) => m.type === 'connected') &&
    !('seatToken' in P.msgs.find((m) => m.type === 'connected'))
);
P?.ws.close();

await sleep(200);
finish();
