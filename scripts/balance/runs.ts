// Whole runs, AI against AI: a party plays STAGES one after another as the
// page does (run.ts), the fallen gone for the run, the survivors and the
// camel going on at full health, until a stage is lost or the last is won.
// The production AI plays both sides, the player's heroes included, at its
// fixed work cap, so a seed always plays the same run.
import {
  createRun,
  handleRunAction,
  passiveOffer,
  rivalPicks,
  runStatus,
  runView,
} from '@balance-rules/run';
import type {RunState} from '@balance-rules/run';
import {actingUnit, advanceToDecision, applyTurn} from '@balance-rules/fight';
import {chooseAiTurn} from '@balance-rules/ai';
import {ABILITY, AI, CAMEL, HEROES, RULES, STAGES} from '@balance-rules/config';
import {ABILITIES} from '@balance-rules/abilities';
import {hasPassive} from '@balance-rules/passives';
import type {HeroId, StatId} from '@balance-rules/types';
import {snapshot, type Config} from './snapshot';

export type RunExperiment = {
  /** The player's heroes, one to three of ROSTER; the camel is added. */
  party: HeroId[];
  /** Changes the config for both sides, undone afterwards (as ablate.ts's `patch`). */
  patch?: (config: Config) => void;
  /**
   * The stat each provision raises (progression.md, 19.2), on the survivor
   * with the lowest stat total, party order breaking ties: `defence` by
   * default. The same policy for every party, so it doesn't favour one.
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
  const config: Config = {ABILITY, AI, HEROES, RULES, ABILITIES};
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
      state = handleRunAction(state, {type: 'next', ...caravanserai(state, provision)});
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
 * The caravanserai's choices after a won stage: the provision owed (the
 * view's `provision`), and the extra one (`extraProvision`), each to the
 * weakest survivor, and the party's two picks of the passives drafted, each
 * the first left in the offer, to the first survivor not carrying it (the
 * rival's picks following from them).
 */
function caravanserai(state: RunState, stat: StatId) {
  const standing = state.fight.units
    .filter((u) => u.side === 'player' && u.hero !== CAMEL && u.alive)
    .sort((a, b) => a.partyIndex - b.partyIndex);
  type Pick = {hero: HeroId; stat: StatId};
  const out: {provision?: Pick; extra?: Pick; passives?: {hero: HeroId; passive: string}[]} = {};
  const total = (u: (typeof standing)[number]) => u.speed + u.defence + u.power;
  // The provisions taken here so far, counted towards the stats they raise.
  const taken: Pick[] = [];
  const raised = (u: (typeof standing)[number], s: StatId) =>
    u[s] + taken.filter((p) => p.hero === u.hero && p.stat === s).length;
  /** The weakest survivor's stat; at RULES.statMax for everyone standing, the first still below it. */
  const pick = (): Pick | undefined => {
    const stats: StatId[] = [stat, 'defence', 'power', 'speed'];
    for (const s of stats) {
      const weakest = standing
        .filter((u) => raised(u, s) < RULES.statMax)
        .reduce<
          (typeof standing)[number] | undefined
        >((best, u) => (!best || total(u) < total(best) ? u : best), undefined);
      if (weakest) {
        const p = {hero: weakest.hero, stat: s};
        taken.push(p);
        return p;
      }
    }
    return undefined;
  };
  const view = runView(state);
  if (view.provision) out.provision = pick();
  // Humphrey unhurt all stage: an extra one, the same way.
  if (view.extraProvision) out.extra = pick();
  const offer = passiveOffer(state);
  if (offer.length) {
    const mine: {hero: HeroId; passive: (typeof offer)[number]}[] = [];
    while (mine.length < 2) {
      const gone = [
        ...mine.map((p) => p.passive),
        ...rivalPicks(
          offer,
          view.rivals,
          mine.map((p) => p.passive)
        ).map((p) => p.passive),
      ];
      const next = offer
        .filter((id) => !gone.includes(id))
        .map((passive) => ({passive, taker: standing.find((u) => !hasPassive(u, passive))}))
        .find((c) => c.taker);
      if (!next) break;
      mine.push({hero: next.taker!.hero, passive: next.passive});
    }
    out.passives = mine;
  }
  return out;
}
