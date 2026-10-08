import {describe, expect, it} from 'vitest';
import {
  applyAction,
  getPublicState,
  PokerActionError,
  startHand,
  timeoutAction,
} from './serverLogic';
import type {RoomPlayer, ServerPokerGameState} from './serverTypes';
import type {Card, PokerAction} from './types';

// --- helpers ---

const SUITS = {s: '♠', h: '♥', d: '♦', c: '♣'} as const;
const RANKS: Record<string, number> = {A: 14, K: 13, Q: 12, J: 11, T: 10};

/** Parses shorthand like 'As', 'Td', '7c'. */
function card(s: string): Card {
  const rank = s.slice(0, -1);
  return {rank: RANKS[rank] ?? Number(rank), suit: SUITS[s.slice(-1) as keyof typeof SUITS]};
}

function seat(name: string, seatIndex: number, chips = 1000): RoomPlayer {
  return {connectionId: name, name, chips, seatIndex};
}

function totalChips(s: ServerPokerGameState): number {
  return s.players.reduce((a, p) => a + p.chips, 0) + s.pot;
}

function actor(s: ServerPokerGameState): string {
  return s.players[s.actingIndex]!.connectionId;
}

/** Fixes hole cards and the five board cards (with burns) for a deterministic showdown. */
function rig(
  s: ServerPokerGameState,
  holes: Record<string, [string, string]>,
  board: string[]
): void {
  for (const p of s.players) {
    const h = holes[p.name];
    if (h) p.holeCards = [card(h[0]), card(h[1])];
  }
  const [b1, b2, b3, b4, b5] = board.map(card);
  const burn = card('2c');
  s.deck = [burn, b1!, b2!, b3!, burn, b4!, burn, b5!, ...s.deck];
}

/** Plays `choose` for whoever is acting until the hand ends. */
function playOut(
  s: ServerPokerGameState,
  choose: (s: ServerPokerGameState) => PokerAction
): ServerPokerGameState {
  for (let i = 0; i < 50 && s.phase !== 'showdown'; i++) {
    const action = choose(s);
    try {
      s = applyAction(s, actor(s), action);
    } catch (err) {
      if (!(err instanceof PokerActionError)) throw err;
      s = applyAction(s, actor(s), {type: 'call'});
    }
  }
  return s;
}

const callDown = () => ({type: 'call'}) as PokerAction;

// --- tests ---

describe('action validation', () => {
  const fresh = () => startHand([seat('A', 0), seat('B', 1), seat('C', 2)]);

  it('clamps a negative raise up to the minimum instead of minting chips', () => {
    const s = fresh();
    const r = applyAction(s, actor(s), {type: 'raise', amount: -5000});
    expect(r.currentBet).toBe(20);
    expect(totalChips(r)).toBe(3000);
    expect(r.players.every((p) => p.chips >= 0)).toBe(true);
  });

  it.each<[string, PokerAction]>([
    ['unknown action type', {type: 'allin'} as unknown as PokerAction],
    ['NaN raise', {type: 'raise', amount: NaN}],
    ['raise with no amount', {type: 'raise'}],
    ['check facing a bet', {type: 'check'}],
  ])('rejects %s', (_, action) => {
    const s = fresh();
    expect(() => applyAction(s, actor(s), action)).toThrow(PokerActionError);
  });

  it('rejects out-of-turn actions', () => {
    const s = fresh();
    const other = s.players.find((p) => p.connectionId !== actor(s))!.connectionId;
    expect(() => applyAction(s, other, {type: 'call'})).toThrow('Not your turn');
  });

  it('never mutates the input state, even on a rejected action', () => {
    const s = fresh();
    const before = JSON.stringify(s);
    expect(() => applyAction(s, actor(s), {type: 'check'})).toThrow();
    applyAction(s, actor(s), {type: 'raise', amount: 100});
    expect(JSON.stringify(s)).toBe(before);
  });

  it('enforces the min raise as the last raise size', () => {
    const s = fresh();
    const r1 = applyAction(s, actor(s), {type: 'raise', amount: 11});
    expect(r1.currentBet).toBe(20);
    const r2 = applyAction(r1, actor(r1), {type: 'raise', amount: 25});
    expect(r2.currentBet).toBe(30);
  });

  it('rejects actions once the hand is over', () => {
    let s = fresh();
    s = applyAction(s, actor(s), {type: 'fold'});
    s = applyAction(s, actor(s), {type: 'fold'});
    expect(s.phase).toBe('showdown');
    expect(() => applyAction(s, s.players[0]!.connectionId, {type: 'call'})).toThrow(
      'The hand is over'
    );
  });
});

describe('pots', () => {
  it('builds a side pot when a short stack is all-in', () => {
    const s = startHand([seat('A', 0, 50), seat('B', 1, 200), seat('C', 2, 200)]);
    rig(s, {A: ['As', 'Ah'], B: ['Ks', 'Kh'], C: ['7d', '2s']}, ['Ac', 'Kd', '9c', '4h', '3s']);
    const end = playOut(s, (st) =>
      st.players[st.actingIndex]!.name === 'C' ? {type: 'call'} : {type: 'raise', amount: 10_000}
    );
    const chips = Object.fromEntries(end.players.map((p) => [p.name, p.chips]));
    expect(totalChips(end)).toBe(450);
    expect(chips).toEqual({A: 150, B: 300, C: 0});
    expect(end.showdownResult).toMatch(/side pot/);
  });

  it('splits a tied pot evenly', () => {
    const s = startHand([seat('A', 0), seat('B', 1), seat('C', 2)]);
    rig(s, {A: ['2s', '3h'], B: ['2d', '3c'], C: ['4s', '4h']}, ['Ts', 'Jd', 'Qh', 'Kc', 'Ac']);
    const end = playOut(s, callDown);
    expect(end.players.map((p) => p.chips)).toEqual([1000, 1000, 1000]);
    expect(end.showdownResult).toMatch(/split/);
  });

  it('conserves chips when a split leaves an odd chip', () => {
    const s = startHand([seat('A', 0, 15), seat('B', 1), seat('C', 2)]);
    rig(s, {A: ['2s', '3h'], B: ['2d', '3c'], C: ['4s', '4h']}, ['Ts', 'Jd', 'Qh', 'Kc', 'Ac']);
    expect(totalChips(playOut(s, callDown))).toBe(2015);
  });
});

describe('dealing', () => {
  it('heads-up: the dealer posts the small blind and acts first', () => {
    const s = startHand([seat('A', 0), seat('B', 1)]);
    const dealer = s.players[s.dealerIndex]!;
    expect(dealer.isSB).toBe(true);
    expect(dealer.currentBet).toBe(5);
    expect(s.actingIndex).toBe(s.dealerIndex);
  });

  it('moves the button to the next seat and increments the hand number', () => {
    const prev = startHand([seat('A', 0), seat('B', 1), seat('C', 2), seat('D', 3)]);
    prev.dealerIndex = 1; // seat 1
    const next = startHand([seat('A', 0), seat('B', 1), seat('C', 2), seat('D', 3)], prev);
    expect(next.players[next.dealerIndex]!.seatIndex).toBe(2);
    expect(next.handNumber).toBe(prev.handNumber + 1);
  });

  it('sits out busted players and skips their seat for the button', () => {
    const prev = startHand([seat('A', 0), seat('B', 1), seat('C', 2), seat('D', 3)]);
    prev.dealerIndex = 1;
    const next = startHand([seat('A', 0), seat('B', 1), seat('C', 2, 0), seat('D', 3)], prev);
    expect(next.players.map((p) => p.name)).toEqual(['A', 'B', 'D']);
    expect(next.players[next.dealerIndex]!.seatIndex).toBe(3);
  });

  it('refuses to deal with fewer than two funded players', () => {
    expect(() => startHand([seat('A', 0), seat('B', 1, 0)])).toThrow(PokerActionError);
  });
});

describe('what each player can see', () => {
  type PubPlayers = {players: Array<{connectionId: string; holeCards: unknown}>};

  it('keeps cards hidden when the hand is won by folds', () => {
    let s = startHand([seat('A', 0), seat('B', 1), seat('C', 2)]);
    s = applyAction(s, actor(s), {type: 'fold'});
    s = applyAction(s, actor(s), {type: 'fold'});
    const pub = getPublicState(s, 'A') as PubPlayers;
    expect(
      pub.players.filter((p) => p.connectionId !== 'A').every((p) => p.holeCards === null)
    ).toBe(true);
  });

  it('reveals live hands at showdown but not folded ones', () => {
    let s = startHand([seat('A', 0), seat('B', 1), seat('C', 2)]);
    const folder = actor(s);
    s = applyAction(s, folder, {type: 'fold'});
    s = playOut(s, callDown);
    const viewer = s.players.find((p) => p.connectionId !== folder)!.connectionId;
    const pub = getPublicState(s, viewer) as PubPlayers;
    expect(pub.players.find((p) => p.connectionId === folder)!.holeCards).toBeNull();
    expect(
      pub.players.filter((p) => p.connectionId !== folder).every((p) => p.holeCards !== null)
    ).toBe(true);
  });
});

describe('turn timeout', () => {
  it('folds when facing a bet and checks when free', () => {
    const s = startHand([seat('A', 0), seat('B', 1), seat('C', 2)]);
    expect(timeoutAction(s)).toEqual({type: 'fold', timedOut: true});
    let t = playOut(s, callDown); // not used further; just ensure it runs
    expect(t.phase).toBe('showdown');
    t = startHand([seat('A', 0), seat('B', 1)]);
    t = applyAction(t, actor(t), {type: 'call'}); // SB completes; BB may check
    expect(timeoutAction(t)).toEqual({type: 'check', timedOut: true});
  });
});

describe('fuzz', () => {
  it('conserves chips across thousands of random hands with illegal actions mixed in', () => {
    let hands = 0;
    for (let game = 0; game < 300; game++) {
      let room = ['A', 'B', 'C', 'D'].map((n, i) =>
        seat(n, i, 1 + Math.floor(Math.random() * 400))
      );
      const start = room.reduce((a, p) => a + p.chips, 0);
      let prev: ServerPokerGameState | null = null;
      for (let h = 0; h < 10 && room.filter((p) => p.chips > 0).length >= 2; h++) {
        let s = startHand(room, prev);
        hands++;
        for (let i = 0; i < 200 && s.phase !== 'showdown'; i++) {
          const roll = Math.random();
          const action =
            roll < 0.15
              ? {type: 'fold'}
              : roll < 0.4
                ? {type: 'check'}
                : roll < 0.7
                  ? {type: 'call'}
                  : roll < 0.95
                    ? {type: 'raise', amount: Math.floor(Math.random() * 600) - 100}
                    : {type: 'bogus', amount: -1e9};
          try {
            s = applyAction(s, actor(s), action as PokerAction);
          } catch (err) {
            if (!(err instanceof PokerActionError)) throw err;
          }
        }
        expect(s.phase).toBe('showdown');
        expect(s.pot).toBe(0);
        expect(s.players.every((p) => p.chips >= 0)).toBe(true);
        room = room.map((p) => ({
          ...p,
          chips: s.players.find((q) => q.connectionId === p.connectionId)?.chips ?? p.chips,
        }));
        expect(room.reduce((a, p) => a + p.chips, 0)).toBe(start);
        prev = s;
      }
    }
    expect(hands).toBeGreaterThan(1000);
  });
});
