import {buildDeck, shuffle, deal} from './deck';
import {findWinner} from './handEvaluator';
import type {PokerAction, Card, LogEntry} from './types';
import type {ServerPlayer, ServerPokerGameState, RoomPlayer} from './serverTypes';

const SB = 5;
const BB = 10;

function cardStr(card: Card): string {
  const rankStr =
    card.rank === 14
      ? 'A'
      : card.rank === 13
        ? 'K'
        : card.rank === 12
          ? 'Q'
          : card.rank === 11
            ? 'J'
            : String(card.rank);
  return `${rankStr}${card.suit}`;
}

function cardsStr(cards: readonly Card[]): string {
  return cards.map((c) => cardStr(c)).join(' ');
}

function addLog(state: ServerPokerGameState, text: string): void {
  const entry: LogEntry = {text, timestamp: Date.now()};
  state.log.push(entry);
  if (state.log.length > 50) {
    state.log = state.log.slice(-50);
  }
}

function isBettingRoundOver(state: ServerPokerGameState): boolean {
  const active = state.players.filter((p) => !p.folded && !p.allIn);
  return active.every((p) => p.hasActed && p.currentBet === state.currentBet);
}

function findNextActiveIndex(players: readonly ServerPlayer[], startIdx: number): number {
  let idx = startIdx;
  for (let i = 0; i < players.length; i++) {
    const p = players[idx];
    if (p && !p.folded && !p.allIn) return idx;
    idx = (idx + 1) % players.length;
  }
  return startIdx;
}

function resolveShowdown(state: ServerPokerGameState): void {
  state.phase = 'showdown';

  const result = findWinner(
    state.players.map((p, i) => ({id: i, holeCards: p.holeCards, folded: p.folded})),
    state.communityCards
  );

  const winner = state.players[result.winnerIndex];
  if (winner) {
    winner.chips += state.pot;
    state.showdownResult = `${winner.name} wins $${state.pot} with ${result.handName}!`;
    addLog(state, '--- Showdown ---');
    for (const p of state.players) {
      if (!p.folded && p.holeCards) {
        addLog(state, `${p.name}: ${cardsStr(p.holeCards)}`);
      }
    }
    addLog(state, state.showdownResult);
  } else {
    state.showdownResult = 'No winner';
  }

  state.pot = 0;
}

function advancePhase(state: ServerPokerGameState): void {
  const n = state.players.length;

  for (const p of state.players) {
    p.currentBet = 0;
    p.hasActed = false;
  }
  state.currentBet = 0;

  const startIdx = (state.dealerIndex + 1) % n;
  state.actingIndex = findNextActiveIndex(state.players, startIdx);

  switch (state.phase) {
    case 'preflop': {
      let deck = state.deck;
      const burn1 = deal(deck);
      deck = burn1.remaining;
      const f1 = deal(deck);
      deck = f1.remaining;
      const f2 = deal(deck);
      deck = f2.remaining;
      const f3 = deal(deck);
      deck = f3.remaining;
      state.communityCards = [f1.card, f2.card, f3.card];
      state.deck = deck;
      state.phase = 'flop';
      addLog(state, `--- Flop: ${cardsStr(state.communityCards)} ---`);
      break;
    }
    case 'flop': {
      let deck = state.deck;
      const burn2 = deal(deck);
      deck = burn2.remaining;
      const t1 = deal(deck);
      deck = t1.remaining;
      state.communityCards = [...state.communityCards, t1.card];
      state.deck = deck;
      state.phase = 'turn';
      addLog(state, `--- Turn: ${cardStr(t1.card)} ---`);
      break;
    }
    case 'turn': {
      let deck = state.deck;
      const burn3 = deal(deck);
      deck = burn3.remaining;
      const r1 = deal(deck);
      deck = r1.remaining;
      state.communityCards = [...state.communityCards, r1.card];
      state.deck = deck;
      state.phase = 'river';
      addLog(state, `--- River: ${cardStr(r1.card)} ---`);
      break;
    }
    case 'river':
      resolveShowdown(state);
      break;
  }
}

export function startHand(players: RoomPlayer[]): ServerPokerGameState {
  const n = players.length;
  const serverPlayers: ServerPlayer[] = players.map((p) => ({
    connectionId: p.connectionId,
    seatIndex: p.seatIndex,
    name: p.name,
    chips: p.chips,
    holeCards: null,
    currentBet: 0,
    folded: false,
    allIn: false,
    hasActed: false,
    isDealer: false,
    isSB: false,
    isBB: false,
  }));

  const dealerIndex = Math.floor(Math.random() * n);
  const sbIdx = (dealerIndex + 1) % n;
  const bbIdx = (dealerIndex + 2) % n;

  serverPlayers[dealerIndex]!.isDealer = true;
  serverPlayers[sbIdx]!.isSB = true;
  serverPlayers[bbIdx]!.isBB = true;

  let deck = shuffle(buildDeck());
  for (const p of serverPlayers) {
    const r1 = deal(deck);
    deck = r1.remaining;
    const r2 = deal(deck);
    deck = r2.remaining;
    p.holeCards = [r1.card, r2.card];
  }

  const sbPlayer = serverPlayers[sbIdx]!;
  const bbPlayer = serverPlayers[bbIdx]!;
  const sbAmount = Math.min(SB, sbPlayer.chips);
  const bbAmount = Math.min(BB, bbPlayer.chips);

  sbPlayer.chips -= sbAmount;
  sbPlayer.currentBet = sbAmount;
  if (sbPlayer.chips === 0) sbPlayer.allIn = true;

  bbPlayer.chips -= bbAmount;
  bbPlayer.currentBet = bbAmount;
  if (bbPlayer.chips === 0) bbPlayer.allIn = true;

  const pot = sbAmount + bbAmount;
  const now = Date.now();
  const log: LogEntry[] = [
    {text: '--- Hand #1 ---', timestamp: now},
    {text: `${sbPlayer.name} posts SB $${sbAmount}`, timestamp: now},
    {text: `${bbPlayer.name} posts BB $${bbAmount}`, timestamp: now},
  ];

  const actingIndex = (bbIdx + 1) % n;

  return {
    phase: 'preflop',
    players: serverPlayers,
    deck,
    communityCards: [],
    pot,
    currentBet: BB,
    actingIndex,
    dealerIndex,
    handNumber: 1,
    log,
    showdownResult: null,
  };
}

export function applyAction(
  state: ServerPokerGameState,
  connectionId: string,
  action: PokerAction
): ServerPokerGameState {
  const s: ServerPokerGameState = JSON.parse(JSON.stringify(state)) as ServerPokerGameState;
  const n = s.players.length;

  const acting = s.players[s.actingIndex];
  if (!acting || acting.connectionId !== connectionId) return s;

  const player = acting;
  const callAmount = s.currentBet - player.currentBet;

  switch (action.type) {
    case 'fold':
      player.folded = true;
      addLog(s, `${player.name} folds`);
      break;

    case 'check':
      if (callAmount > 0) {
        player.folded = true;
        addLog(s, `${player.name} folds`);
      } else {
        addLog(s, `${player.name} checks`);
      }
      break;

    case 'call': {
      const amount = Math.min(callAmount, player.chips);
      player.chips -= amount;
      player.currentBet += amount;
      s.pot += amount;
      if (player.chips === 0) player.allIn = true;
      addLog(s, `${player.name} calls $${amount}`);
      break;
    }

    case 'raise': {
      const raiseTotal = Math.min(
        action.amount ?? s.currentBet * 2,
        player.chips + player.currentBet
      );
      const raiseExtra = raiseTotal - player.currentBet;
      const actualPay = Math.min(raiseExtra, player.chips);
      player.chips -= actualPay;
      player.currentBet += actualPay;
      s.pot += actualPay;
      if (player.chips === 0) player.allIn = true;
      if (player.currentBet > s.currentBet) {
        s.currentBet = player.currentBet;
        for (const p of s.players) {
          if (p.connectionId !== connectionId && !p.folded && !p.allIn) {
            p.hasActed = false;
          }
        }
      }
      addLog(s, `${player.name} raises to $${player.currentBet}`);
      break;
    }
  }

  player.hasActed = true;

  const activePlayers = s.players.filter((p) => !p.folded);
  if (activePlayers.length === 1) {
    const winner = activePlayers[0]!;
    winner.chips += s.pot;
    s.showdownResult = `${winner.name} wins $${s.pot}!`;
    addLog(s, s.showdownResult);
    s.phase = 'showdown';
    s.pot = 0;
    return s;
  }

  if (isBettingRoundOver(s)) {
    advancePhase(s);
  } else {
    let next = (s.actingIndex + 1) % n;
    for (let attempts = 0; attempts < n; attempts++) {
      const p = s.players[next]!;
      if (!p.folded && !p.allIn) {
        s.actingIndex = next;
        break;
      }
      next = (next + 1) % n;
    }
  }

  return s;
}

export function getPublicState(state: ServerPokerGameState, viewerConnectionId: string): unknown {
  const isShowdown = state.phase === 'showdown';
  return {
    phase: state.phase,
    communityCards: state.communityCards,
    pot: state.pot,
    currentBet: state.currentBet,
    actingConnectionId: state.players[state.actingIndex]?.connectionId ?? null,
    showdownResult: state.showdownResult,
    log: state.log,
    players: state.players.map((p) => ({
      connectionId: p.connectionId,
      name: p.name,
      chips: p.chips,
      currentBet: p.currentBet,
      folded: p.folded,
      allIn: p.allIn,
      isDealer: p.isDealer,
      isSB: p.isSB,
      isBB: p.isBB,
      holeCards: p.connectionId === viewerConnectionId || isShowdown ? p.holeCards : null,
    })),
  };
}
