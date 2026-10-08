/**
 * Poker over raw WebSockets: host-only start, rejected exploits, next-hand
 * guard, button rotation, reconnect by name, and the disconnected-player
 * turn timeout (10s). Talks to the Worker directly, no browser.
 */
import {API_URL, check, createPokerRoom, finish, sleep} from './lib.mjs';

const WS_BASE = API_URL.replace(/^http/, 'ws');

function connect(roomId, name) {
  const ws = new WebSocket(`${WS_BASE}/rooms/${roomId}/ws?playerName=${encodeURIComponent(name)}`);
  const c = {ws, name, msgs: [], id: null, state: null};
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    c.msgs.push(m);
    if (m.type === 'connected') c.id = m.connectionId;
    if (m.state) c.state = m.state;
  };
  return new Promise((res, rej) => {
    ws.onopen = () => res(c);
    ws.onerror = rej;
  });
}
const send = (c, action, payload) => c.ws.send(JSON.stringify({action, payload}));
const lastError = (c) => [...c.msgs].reverse().find((m) => m.type === 'error')?.message;
const chipsTotal = (st) => st.players.reduce((a, p) => a + p.chips, 0) + st.pot;
const join = (room, playerName) =>
  fetch(`${API_URL}/rooms/${room}/join`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({playerName}),
  });

const room = await createPokerRoom('Alice');
const A = await connect(room, 'Alice');
await sleep(150);
const B = await connect(room, 'Bob');
await sleep(250);

const lobby = A.msgs.filter((m) => m.players).at(-1).players;
check(
  'first player is host',
  lobby.find((p) => p.name === 'Alice')?.isHost && !lobby.find((p) => p.name === 'Bob')?.isHost,
  lobby
);

send(B, 'startGame');
await sleep(250);
check(
  'non-host cannot start',
  lastError(B) === 'Only the host can start the game' && !B.state,
  lastError(B)
);

send(A, 'startGame');
await sleep(350);
check('host starts the game', A.state?.phase === 'preflop' && B.state?.phase === 'preflop');
check(
  'each player sees only their own cards',
  A.state.players.find((p) => p.name === 'Bob').holeCards === null &&
    B.state.players.find((p) => p.name === 'Alice').holeCards === null
);
check('turn deadline is sent', typeof A.msgs.at(-1).turnDeadline === 'number');

const actor = () => (A.state.actingConnectionId === A.id ? A : B);
const other = () => (actor() === A ? B : A);

send(actor(), 'playerAction', {type: 'raise', amount: -1_000_000});
await sleep(250);
check(
  'negative raise cannot mint chips',
  chipsTotal(A.state) === 2000 && A.state.players.every((p) => p.chips >= 0),
  chipsTotal(A.state)
);

send(other(), 'playerAction', {type: 'call'});
await sleep(250);
check('out-of-turn action rejected', lastError(other()) === 'Not your turn');

const handBefore = A.state.handNumber;
const potBefore = A.state.pot;
send(other(), 'nextHand');
await sleep(250);
check(
  'nextHand mid-hand is ignored',
  A.state.handNumber === handBefore && A.state.pot === potBefore
);

send(actor(), 'playerAction', {type: 'check'});
await sleep(250);
check(
  'checking into a bet rejected',
  /can't check/.test(lastError(actor()) ?? ''),
  lastError(actor())
);

const dealer1 = A.state.players.find((p) => p.isDealer).name;
send(actor(), 'playerAction', {type: 'fold'});
await sleep(250);
check('fold ends the hand', A.state.phase === 'showdown');
check(
  'fold-win keeps cards hidden',
  A.state.players.filter((p) => p.name !== 'Alice').every((p) => p.holeCards === null)
);

send(B, 'nextHand');
await sleep(350);
check('any player can deal after showdown', A.state.handNumber === 2, A.state.handNumber);
check('button rotates', A.state.players.find((p) => p.isDealer).name !== dealer1);
send(A, 'nextHand');
await sleep(250);
check('a second next-hand click is ignored', A.state.handNumber === 2);

// Reconnect mid-hand.
const bobCards = JSON.stringify(B.state.players.find((p) => p.name === 'Bob').holeCards);
B.ws.close();
await sleep(500);
const left = A.msgs.filter((m) => m.type === 'playerLeft').at(-1);
check(
  'disconnect holds the seat and marks it',
  left?.players.find((p) => p.name === 'Bob')?.connected === false,
  left?.players
);
check('rejoin by name allowed mid-hand', (await join(room, 'Bob')).ok);
const B2 = await connect(room, 'Bob');
send(B2, 'sync');
await sleep(350);
check(
  'reconnected player gets their cards back',
  B2.state?.handNumber === 2 &&
    JSON.stringify(B2.state.players.find((p) => p.name === 'Bob').holeCards) === bobCards
);
check('new names still blocked mid-game', (await join(room, 'Mallory')).status === 400);

// A disconnected acting player times out after ~10s.
const actingName = A.state.players.find((p) => p.connectionId === A.state.actingConnectionId).name;
const leaver = actingName === 'Alice' ? A : B2;
const stayer = leaver === A ? B2 : A;
const logBefore = stayer.state.log.length;
leaver.ws.close();
const t0 = Date.now();
const timedOut = () =>
  stayer.state.log.slice(logBefore).some((e) => /ran out of time/.test(e.text));
while (Date.now() - t0 < 16_000 && !timedOut()) await sleep(500);
check(
  `disconnected player's turn times out (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
  timedOut()
);

A.ws.close();
B2.ws.close();
finish();
