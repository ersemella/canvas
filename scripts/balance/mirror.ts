// Mirror matches: the same heroes on both sides, no camel, the production AI
// on both. Each seed is played twice: as dealt, and with the board mirrored
// left to right and the two sides swapped, so each team gets the other's
// ground, starting places and turn order. Over a pair the setup is exactly
// fair, so the player side's win rate measures only a bias of the AI or the
// rules towards one side; it should be 50%. It doesn't measure how well the
// AI plays: two copies of a bad AI are just as even. For that, give the two
// teams different AIs (`variants`): each AI keeps its team across the pair,
// so `aWinPct` is team a's AI's share of wins on fair setups.
import {createFight, advance, applyTurn, actingUnit} from '@balance-rules/fight';
import {chooseAiTurn} from '@balance-rules/ai';
import {AI, CAMEL} from '@balance-rules/config';
import {hexKey, hexToOffset, offsetToHex} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import type {FightState, HeroId, Side, TurnInput, Unit} from '@balance-rules/types';

/** How an AI searches: its horizon in decisions and its work cap per turn (production: 3 and 110). */
type Variant = {depth: number; work: number};
export const VARIANTS: Record<string, Variant> = {
  production: {depth: AI.searchDepth, work: AI.maxSimulations},
  /** No lookahead: the heuristic's best root action. */
  greedy: {depth: 1, work: AI.maxSimulations},
  /** A horizon of four and four times the work. */
  deep: {depth: 4, work: 4 * AI.maxSimulations},
};
type Options = {
  pairs: number;
  seed: number;
  maxTurns: number;
  party: HeroId[];
  /** Team a's and team b's AIs; team a is the player side in each pair's first fight. */
  variants?: [string, string];
};

function chooser(variant: Variant) {
  const ai = AI as {maxSimulations: number};
  return (state: FightState, unit: Unit): TurnInput => {
    const saved = ai.maxSimulations;
    ai.maxSimulations = variant.work;
    try {
      return chooseAiTurn(state, unit, {left: variant.work}, undefined, {depth: variant.depth});
    } finally {
      ai.maxSimulations = saved;
    }
  };
}

/** The board's left-right mirror (map.ts): column c and 7 − c on even rows, c and 6 − c on odd. */
function mirrorHex(h: Hex): Hex {
  const {col, row} = hexToOffset(h);
  return offsetToHex({col: (row & 1 ? 6 : 7) - col, row});
}

/** A fight as dealt by its seed, with the camel taken out. */
function dealt(seed: number, party: HeroId[]): FightState {
  const state = createFight(seed, party, party);
  state.units = state.units.filter((u) => u.hero !== CAMEL);
  for (const u of state.units) u.controller = 'human';
  state.log = [];
  return state;
}

/**
 * The same fight from the other side: tiles and places mirrored, sides
 * swapped. Cards keep their slots and the units their order, so a speed tie
 * goes to the same team as before.
 */
function mirrored(state: FightState): FightState {
  const copy: FightState = structuredClone(state);
  copy.tiles = Object.fromEntries(
    Object.entries(state.tiles).map(([key, tile]) => {
      const [q, r] = key.split(',').map(Number);
      return [hexKey(mirrorHex({q: q!, r: r!})), tile];
    })
  );
  for (const u of copy.units) {
    u.side = u.side === 'player' ? 'enemy' : 'player';
    u.id = `${u.side === 'player' ? 'p' : 'e'}${u.id.slice(1)}`;
    if (u.hex) u.hex = mirrorHex(u.hex);
  }
  return copy;
}

/** Plays a fight out; the winning side, or null if still going after `maxTurns` actions. */
function play(
  state: FightState,
  maxTurns: number,
  choose: Record<Side, ReturnType<typeof chooser>>
): {winner: Side | null; turns: number} {
  advance(state, chooseAiTurn);
  let turns = 0;
  while (state.phase === 'fight' && turns < maxTurns) {
    const u = actingUnit(state)!;
    applyTurn(state, u, choose[u.side](state, u));
    advance(state, chooseAiTurn);
    turns++;
  }
  state.log = [];
  const winner = state.phase === 'won' ? 'player' : state.phase === 'lost' ? 'enemy' : null;
  return {winner, turns};
}

/** The side whose card the track reaches first. */
function firstMover(state: FightState): Side {
  let best = state.units[0]!;
  for (const u of state.units) if (u.slot! < best.slot!) best = u;
  return best.side;
}

export function runMirror({pairs, seed, maxTurns, party, variants}: Options) {
  const [a, b] = (variants ?? ['production', 'production']).map((name) => {
    if (!VARIANTS[name]) throw new Error(`Unknown AI ${name}; one of ${Object.keys(VARIANTS)}`);
    return chooser(VARIANTS[name]);
  });
  let playerWins = 0;
  let aWins = 0;
  let decided = 0;
  let stalls = 0;
  let firstMoverWins = 0;
  /** Pairs with both fights decided, and those where the same team won both (its setup decided it). */
  let bothDecided = 0;
  let sameTeam = 0;
  const lengths: number[] = [];
  for (let p = 0; p < pairs; p++) {
    const dealtFight = dealt(seed + p, party);
    const fights = [dealtFight, mirrored(dealtFight)];
    const results = fights.map((state, i) => {
      const first = firstMover(state);
      // Team a is the player side in the first fight and the enemy in the mirrored one.
      const result = play(state, maxTurns, i ? {player: b!, enemy: a!} : {player: a!, enemy: b!});
      if (result.winner === null) stalls++;
      else {
        decided++;
        if (result.winner === 'player') playerWins++;
        if ((result.winner === 'player') === (i === 0)) aWins++;
        if (result.winner === first) firstMoverWins++;
        lengths.push(result.turns);
      }
      return result.winner;
    });
    const [wa, wb] = results;
    if (wa && wb) {
      bothDecided++;
      // The team that was the player in fight a is the enemy in fight b.
      if (wa !== wb) sameTeam++;
    }
  }
  const pct = (n: number, of: number) => +((100 * n) / (of || 1)).toFixed(1);
  // A 95% Wilson interval on a share of decided fights.
  const interval = (wins: number) => {
    const z = 1.96;
    const phat = wins / (decided || 1);
    const centre = (phat + (z * z) / (2 * decided)) / (1 + (z * z) / decided);
    const half =
      (z * Math.sqrt((phat * (1 - phat)) / decided + (z * z) / (4 * decided * decided))) /
      (1 + (z * z) / decided);
    return [pct(centre - half, 1), pct(centre + half, 1)];
  };
  const sorted = [...lengths].sort((x, y) => x - y);
  return {
    party,
    fights: 2 * pairs,
    decided,
    stallPct: pct(stalls, 2 * pairs),
    playerWinPct: pct(playerWins, decided),
    playerWinPct95: interval(playerWins),
    variants: variants ?? ['production', 'production'],
    aWinPct: pct(aWins, decided),
    aWinPct95: interval(aWins),
    firstMoverWinPct: pct(firstMoverWins, decided),
    sameTeamWonBothPct: pct(sameTeam, bothDecided),
    medianTurns: sorted[sorted.length >> 1] ?? null,
  };
}
