import {buildDeck, shuffle, deal} from './deck';
import {evaluate7CardHand, compareScores} from './handEvaluator';
import type {HandScore} from './handEvaluator';
import type {PokerAction, Card, LogEntry} from './types';
import type {ServerPlayer, ServerPokerGameState, RoomPlayer} from './serverTypes';

const SB = 5;
const BB = 10;

const ACTION_TYPES = new Set<string>(['fold', 'check', 'call', 'raise']);

/**
 * Thrown for an action the rules don't allow. GameRoom relays the message to
 * the player who sent it and leaves the game state unchanged.
 */
export class PokerActionError extends Error {}

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

/** Moves `amount` from a player's stack into the pot. */
function putChips(state: ServerPokerGameState, player: ServerPlayer, amount: number): void {
  player.chips -= amount;
  player.currentBet += amount;
  player.totalContributed = (player.totalContributed ?? 0) + amount;
  state.pot += amount;
  if (player.chips === 0) player.allIn = true;
}

function isBettingRoundOver(state: ServerPokerGameState): boolean {
  const active = state.players.filter((p) => !p.folded && !p.allIn);
  return active.every((p) => p.hasActed && p.currentBet === state.currentBet);
}

/**
 * True when nobody is left with a decision this hand: every remaining player
 * is all-in, or one player is left with chips and has already matched the bet.
 * The rest of the board is then dealt straight to showdown.
 */
function noFurtherBetting(state: ServerPokerGameState): boolean {
  const active = state.players.filter((p) => !p.folded && !p.allIn);
  return active.length <= 1 && active.every((p) => p.currentBet >= state.currentBet);
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

/**
 * Splits the pot into a main pot and side pots by contribution level, then
 * awards each to the best hand(s) among the players eligible for it. Tied
 * hands split the pot; odd chips go to the winner closest to the dealer's left.
 */
function resolveShowdown(state: ServerPokerGameState): void {
  state.phase = 'showdown';
  state.wentToShowdown = true;

  const n = state.players.length;
  const scores = new Map<number, HandScore>();
  state.players.forEach((p, i) => {
    if (!p.folded && p.holeCards) {
      scores.set(i, evaluate7CardHand([...p.holeCards, ...state.communityCards]));
    }
  });

  // Seat order starting left of the dealer, for odd-chip distribution.
  const orderFromDealer = Array.from({length: n}, (_, k) => (state.dealerIndex + 1 + k) % n);

  const remaining = state.players.map((p) => p.totalContributed ?? 0);
  const pots: Array<{amount: number; eligible: number[]}> = [];
  for (;;) {
    const live = [...scores.keys()].filter((i) => remaining[i]! > 0);
    if (live.length === 0) break;
    const level = Math.min(...live.map((i) => remaining[i]!));
    let amount = 0;
    for (let i = 0; i < n; i++) {
      const take = Math.min(remaining[i]!, level);
      amount += take;
      remaining[i] = remaining[i]! - take;
    }
    pots.push({amount, eligible: live});
  }
  // Chips folded players put in beyond the last live player's level.
  const leftover = remaining.reduce((a, b) => a + b, 0);
  if (leftover > 0 && pots.length > 0) pots[pots.length - 1]!.amount += leftover;

  addLog(state, '--- Showdown ---');
  for (const [i, score] of scores) {
    const p = state.players[i]!;
    addLog(state, `${p.name}: ${cardsStr(p.holeCards!)} (${score.name})`);
  }

  const summaries: string[] = [];
  pots.forEach((pot, potIdx) => {
    let best: HandScore | null = null;
    let winners: number[] = [];
    for (const i of pot.eligible) {
      const score = scores.get(i)!;
      const cmp = best ? compareScores(score, best) : 1;
      if (cmp > 0) {
        best = score;
        winners = [i];
      } else if (cmp === 0) {
        winners.push(i);
      }
    }
    winners.sort((a, b) => orderFromDealer.indexOf(a) - orderFromDealer.indexOf(b));

    const share = Math.floor(pot.amount / winners.length);
    let odd = pot.amount - share * winners.length;
    for (const w of winners) {
      state.players[w]!.chips += share + (odd > 0 ? 1 : 0);
      if (odd > 0) odd--;
    }

    const names = winners.map((w) => state.players[w]!.name);
    const potName = pots.length === 1 ? '' : potIdx === 0 ? 'main pot ' : `side pot ${potIdx} `;
    const handName = best ? ` with ${best.name}` : '';
    // A side pot only one player could win is just their uncalled chips coming back.
    const text =
      pot.eligible.length === 1
        ? `${names[0]} gets back $${pot.amount} uncalled`
        : winners.length === 1
          ? `${names[0]} wins ${potName}$${pot.amount}${handName}`
          : `${names.join(' and ')} split ${potName}$${pot.amount}${handName}`;
    summaries.push(text);
    addLog(state, text);
  });

  state.showdownResult = summaries.length > 0 ? summaries.join(' · ') : 'No winner';
  state.pot = 0;
}

function advancePhase(state: ServerPokerGameState): void {
  const n = state.players.length;

  for (const p of state.players) {
    p.currentBet = 0;
    p.hasActed = false;
  }
  state.currentBet = 0;
  state.lastRaiseSize = BB;

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

  // If nobody has a decision left (all-in), deal the remaining streets.
  if (state.phase !== 'showdown' && noFurtherBetting(state)) {
    advancePhase(state);
  }
}

/**
 * Deals a new hand. Players with no chips sit out. When `previous` is given
 * the button moves to the next seat after the previous dealer; otherwise the
 * first dealer is chosen at random.
 */
export function startHand(
  roomPlayers: RoomPlayer[],
  previous?: ServerPokerGameState | null,
): ServerPokerGameState {
  const players = roomPlayers
    .filter((p) => p.chips > 0)
    .sort((a, b) => a.seatIndex - b.seatIndex);
  if (players.length < 2) {
    throw new PokerActionError('At least two players with chips are needed to deal a hand');
  }
  const n = players.length;

  const serverPlayers: ServerPlayer[] = players.map((p) => ({
    connectionId: p.connectionId,
    seatIndex: p.seatIndex,
    name: p.name,
    chips: p.chips,
    holeCards: null,
    currentBet: 0,
    totalContributed: 0,
    folded: false,
    allIn: false,
    hasActed: false,
    isDealer: false,
    isSB: false,
    isBB: false,
  }));

  let dealerIndex: number;
  const prevDealerSeat = previous?.players[previous.dealerIndex]?.seatIndex;
  if (prevDealerSeat === undefined) {
    dealerIndex = Math.floor(Math.random() * n);
  } else {
    const next = serverPlayers.findIndex((p) => p.seatIndex > prevDealerSeat);
    dealerIndex = next === -1 ? 0 : next;
  }
  // Heads-up, the dealer posts the small blind and acts first preflop.
  const sbIdx = n === 2 ? dealerIndex : (dealerIndex + 1) % n;
  const bbIdx = (sbIdx + 1) % n;

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

  const handNumber = (previous?.handNumber ?? 0) + 1;
  const state: ServerPokerGameState = {
    phase: 'preflop',
    players: serverPlayers,
    deck,
    communityCards: [],
    pot: 0,
    currentBet: BB,
    lastRaiseSize: BB,
    actingIndex: 0,
    dealerIndex,
    handNumber,
    log: [],
    showdownResult: null,
    wentToShowdown: false,
  };

  const sbPlayer = serverPlayers[sbIdx]!;
  const bbPlayer = serverPlayers[bbIdx]!;
  const sbAmount = Math.min(SB, sbPlayer.chips);
  const bbAmount = Math.min(BB, bbPlayer.chips);
  putChips(state, sbPlayer, sbAmount);
  putChips(state, bbPlayer, bbAmount);

  addLog(state, `--- Hand #${handNumber} ---`);
  addLog(state, `${sbPlayer.name} posts SB $${sbAmount}`);
  addLog(state, `${bbPlayer.name} posts BB $${bbAmount}`);

  state.actingIndex = findNextActiveIndex(serverPlayers, (bbIdx + 1) % n);
  if (noFurtherBetting(state)) advancePhase(state);

  return state;
}

/**
 * Applies one player's action and returns the new state. Throws
 * PokerActionError when the action isn't legal; the input state is never
 * modified.
 */
export function applyAction(
  state: ServerPokerGameState,
  connectionId: string,
  action: PokerAction,
): ServerPokerGameState {
  if (state.phase === 'showdown' || state.phase === 'waiting') {
    throw new PokerActionError('The hand is over');
  }
  const acting = state.players[state.actingIndex];
  if (!acting || acting.connectionId !== connectionId) {
    throw new PokerActionError('Not your turn');
  }
  if (!action || typeof action !== 'object' || !ACTION_TYPES.has(action.type)) {
    throw new PokerActionError('Unknown action');
  }

  const s: ServerPokerGameState = JSON.parse(JSON.stringify(state)) as ServerPokerGameState;
  s.lastRaiseSize ??= BB;
  const n = s.players.length;
  const player = s.players[s.actingIndex]!;
  const callAmount = s.currentBet - player.currentBet;

  switch (action.type) {
    case 'fold':
      player.folded = true;
      addLog(s, `${player.name} ${action.timedOut ? 'ran out of time and folds' : 'folds'}`);
      break;

    case 'check':
      if (callAmount > 0) {
        throw new PokerActionError(`You can't check — it's $${callAmount} to call`);
      }
      addLog(s, `${player.name} ${action.timedOut ? 'ran out of time and checks' : 'checks'}`);
      break;

    case 'call': {
      if (callAmount === 0) {
        addLog(s, `${player.name} checks`);
        break;
      }
      const amount = Math.min(callAmount, player.chips);
      putChips(s, player, amount);
      addLog(s, `${player.name} calls $${amount}`);
      break;
    }

    case 'raise': {
      if (typeof action.amount !== 'number' || !Number.isFinite(action.amount)) {
        throw new PokerActionError('Raise amount is missing');
      }
      const maxTo = player.chips + player.currentBet;
      if (maxTo <= s.currentBet) {
        throw new PokerActionError("You don't have enough chips to raise — call instead");
      }
      // Requests below the minimum raise are bumped up to it; a player who
      // can't afford the minimum may still go all-in for less.
      const minTo = s.currentBet + s.lastRaiseSize;
      const target = Math.min(Math.max(Math.floor(action.amount), minTo), maxTo);
      const raiseSize = target - s.currentBet;
      putChips(s, player, target - player.currentBet);
      if (raiseSize >= s.lastRaiseSize) s.lastRaiseSize = raiseSize;
      s.currentBet = target;
      for (const p of s.players) {
        if (p !== player && !p.folded && !p.allIn) p.hasActed = false;
      }
      addLog(s, `${player.name} raises to $${target}${player.allIn ? ' (all-in)' : ''}`);
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
    s.wentToShowdown = false;
    s.pot = 0;
    return s;
  }

  if (isBettingRoundOver(s)) {
    advancePhase(s);
  } else {
    s.actingIndex = findNextActiveIndex(s.players, (s.actingIndex + 1) % n);
  }

  return s;
}

/** The action taken for a player whose turn timer runs out: check if free, else fold. */
export function timeoutAction(state: ServerPokerGameState): PokerAction | null {
  if (state.phase === 'showdown' || state.phase === 'waiting') return null;
  const acting = state.players[state.actingIndex];
  if (!acting) return null;
  return {type: acting.currentBet >= state.currentBet ? 'check' : 'fold', timedOut: true};
}

export function getPublicState(state: ServerPokerGameState, viewerConnectionId: string): unknown {
  // Hole cards are only shown for hands that reached a real showdown and
  // weren't folded; a hand won by everyone else folding stays hidden.
  const revealAll = state.phase === 'showdown' && state.wentToShowdown;
  const acting = state.phase === 'showdown' ? undefined : state.players[state.actingIndex];
  return {
    phase: state.phase,
    communityCards: state.communityCards,
    pot: state.pot,
    currentBet: state.currentBet,
    minRaiseTo: state.currentBet + (state.lastRaiseSize ?? BB),
    handNumber: state.handNumber,
    actingConnectionId: acting?.connectionId ?? null,
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
      holeCards:
        p.connectionId === viewerConnectionId || (revealAll && !p.folded) ? p.holeCards : null,
    })),
  };
}
