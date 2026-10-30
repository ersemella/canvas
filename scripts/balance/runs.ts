// Whole runs, AI against AI: a party plays STAGES one after another as the
// page does (run.ts), the fallen gone for the run, the survivors and the
// camel going on at full health, until a stage is lost or the last is won.
// The production AI plays both sides, the player's heroes included, at its
// fixed work cap, so a seed always plays the same run.
import {createRun, handleRunAction, isStatCard, runStatus, runView} from '@balance-rules/run';
import type {RunState} from '@balance-rules/run';
import {actingUnit, advanceToDecision, applyTurn} from '@balance-rules/fight';
import {chooseAiTurn} from '@balance-rules/ai';
import {ABILITY, AI, CAMEL, HEROES, RULES, SPEARHEAD, STAGES} from '@balance-rules/config';
import {ABILITIES} from '@balance-rules/abilities';
import {hasPassive} from '@balance-rules/passives';
import type {CardId, HeroId, PassiveId, StatId} from '@balance-rules/types';
import {snapshot, type Config} from './snapshot';

export type RunExperiment = {
  /** The player's heroes, one to three of ROSTER; the camel is added. */
  party: HeroId[];
  /** Changes the config for both sides, undone afterwards (as ablate.ts's `patch`). */
  patch?: (config: Config) => void;
  /**
   * The stat the caravanserai's draft takes first when it is drawn
   * (progression.md, 19.3), on the survivor with the lowest stat total,
   * party order breaking ties: `defence` by default; then the other stats,
   * then the first passive or upgrade left. The same policy for every party,
   * so it doesn't favour one.
   */
  provision?: StatId;
  /**
   * The player's heroes' search in place of production's (ablate.ts's
   * `mod.search`): a horizon in decisions and a work cap a turn. The camel
   * and the enemy keep production's.
   */
  search?: {depth: number; work: number};
};
type Options = RunExperiment & {runs: number; seed: number; maxTurns: number};

/** How a lost stage ended: the camel killed, every hero killed, or no end within `maxTurns`. */
type Loss = 'camelKilled' | 'partyKilled' | 'stalled';

export function simulateRuns(options: Options) {
  const config: Config = {ABILITY, AI, HEROES, RULES, ABILITIES, SPEARHEAD};
  const restore = snapshot(config);
  try {
    options.patch?.(config);
    return run(options);
  } finally {
    restore();
  }
}

function run({runs, seed, maxTurns, party, provision = 'defence', search}: Options) {
  const stages = STAGES.map(() => ({
    reached: 0,
    won: 0,
    lost: {camelKilled: 0, partyKilled: 0, stalled: 0} as Record<Loss, number>,
    /** Heroes standing at the start of the stage, summed over the runs that reached it. */
    heroesIn: 0,
    /** Heroes standing at the end of the stages won. */
    heroesOutOfWins: 0,
  }));
  /** Runs each hero of the party was still standing at the end of. */
  const finishedWith: Record<string, number> = {};
  let won = 0;

  for (let r = 0; r < runs; r++) {
    let state: RunState = createRun(seed + r, {party});
    for (;;) {
      const stage = stages[state.stage]!;
      const heroes = () =>
        state.fight.units.filter((u) => u.side === 'player' && u.hero !== CAMEL && u.alive);
      stage.reached++;
      stage.heroesIn += heroes().length;
      const fight = state.fight;
      let turns = 0;
      while (fight.phase === 'fight' && turns < maxTurns) {
        const unit = actingUnit(fight)!;
        const own = search && unit.side === 'player' && unit.hero !== CAMEL;
        applyTurn(
          fight,
          unit,
          own
            ? chooseWith(search)(fight, unit)
            : chooseAiTurn(fight, unit, {left: AI.maxSimulations})
        );
        advanceToDecision(fight);
        turns++;
      }
      if (fight.phase !== 'won') {
        const camel = fight.units.find((u) => u.hero === CAMEL);
        stage.lost[
          fight.phase === 'fight' ? 'stalled' : camel?.alive ? 'partyKilled' : 'camelKilled'
        ]++;
        break;
      }
      stage.won++;
      stage.heroesOutOfWins += heroes().length;
      if (runStatus(state) === 'won') {
        won++;
        for (const u of heroes()) finishedWith[u.hero] = (finishedWith[u.hero] ?? 0) + 1;
        break;
      }
      state = handleRunAction(draftAll(state, provision), {type: 'next'});
    }
  }

  const round = (n: number, places = 1) => +n.toFixed(places);
  const pct = (n: number, of: number) => round((100 * n) / (of || 1));
  return {
    runs,
    party,
    runWinPct: pct(won, runs),
    /** By stage: the share of runs reaching it, its win rate, and how it was lost. */
    stages: stages.map((s, i) => ({
      stage: i + 1,
      region: STAGES[i]!.region,
      reachedPct: pct(s.reached, runs),
      winPct: pct(s.won, s.reached),
      lost: s.lost,
      heroesIn: round(s.heroesIn / (s.reached || 1), 2),
      heroesLeftPerWin: round(s.heroesOutOfWins / (s.won || 1), 2),
    })),
    /** Of the runs won, the share each hero finished standing in. */
    finishedWithPct: Object.fromEntries(party.map((h) => [h, pct(finishedWith[h] ?? 0, won)])),
  };
}

/** chooseAiTurn with its own horizon and work cap (as ablate.ts's `searchWith`). */
function chooseWith({depth, work}: {depth: number; work: number}) {
  const ai = AI as {maxSimulations: number};
  return (fight: RunState['fight'], unit: Parameters<typeof chooseAiTurn>[1]) => {
    const saved = ai.maxSimulations;
    ai.maxSimulations = work;
    try {
      return chooseAiTurn(fight, unit, {left: work}, undefined, {depth, work});
    } finally {
      ai.maxSimulations = saved;
    }
  };
}

/**
 * The party's picks in the caravanserai's draft after a won stage, each the
 * first of these open: `stat`, then defence, power and speed, to the
 * weakest survivor below RULES.statMax; then the first passive or upgrade
 * left, to the first survivor not carrying it.
 */
function draftAll(state: RunState, stat: StatId): RunState {
  const order: StatId[] = [stat, 'defence', 'power', 'speed'];
  for (let view = runView(state); view.draft && view.draft.mine.length < view.draft.picks; ) {
    const {offer, mine, rival} = view.draft;
    const gone: CardId[] = [...mine.flatMap((p) => ('card' in p ? [p.card] : [])), ...rival];
    const open = offer.filter((c) => !gone.includes(c));
    const standing = state.fight.units
      .filter((u) => u.side === 'player' && u.hero !== CAMEL && u.alive)
      .sort((a, b) => a.partyIndex - b.partyIndex);
    const total = (u: (typeof standing)[number]) => u.speed + u.defence + u.power;
    const raised = (u: (typeof standing)[number], s: StatId) =>
      u[s] + mine.filter((p) => 'card' in p && p.hero === u.hero && p.card === s).length;
    let pick: {hero: HeroId; card: CardId} | undefined;
    for (const s of order.filter((c) => open.includes(c))) {
      const weakest = standing
        .filter((u) => raised(u, s) < RULES.statMax)
        .reduce<
          (typeof standing)[number] | undefined
        >((best, u) => (!best || total(u) < total(best) ? u : best), undefined);
      if (weakest) {
        pick = {hero: weakest.hero, card: s};
        break;
      }
    }
    for (const card of open.filter((c) => !isStatCard(c))) {
      if (pick) break;
      const taker = standing.find((u) => !hasPassive(u, card as PassiveId));
      if (taker) pick = {hero: taker.hero, card};
    }
    state = handleRunAction(state, {type: 'draft', pick: pick ?? {heal: true}});
    view = runView(state);
  }
  return state;
}
