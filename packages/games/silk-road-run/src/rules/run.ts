/**
 * A run: its stages (STAGES in config.ts) one after another, each a fight
 * against a bigger enemy band. Heroes who fall are gone for the run; the
 * survivors and the camel go on to the next stage, by way of the
 * caravanserai, where a stage that earns one gives a provision, and the
 * last stage of a region offers three passives, one taken. The heroes start
 * each stage at full health; the camel keeps the health it ended the last
 * one with (camel.md, 18.4). The run keeps the seed;
 * the view is the fight, which never contains it.
 */
import type {Hex, RunContext} from '@canvas/engine/server';
import {ABILITIES} from './abilities';
import {chooseAiTurn} from './ai';
import {
  AI,
  CAMEL,
  MOUNTAIN_STAGES,
  PARTY,
  PASSIVE_OFFER,
  REGIONS,
  ROSTER,
  RULES,
  STAGES,
} from './config';
import {
  RuleError,
  actingUnit,
  advanceToDecision,
  applyTurn,
  cloneFight,
  createFight,
  refreshStats,
  seededRandom,
} from './fight';
import {mapById} from './map';
import {PASSIVES, hasPassive} from './passives';
import {createTestFight} from './testStage';
import {shuffled} from './track';
import type {
  AbilityId,
  ActionTarget,
  FightState,
  HeroId,
  PassiveId,
  PassivePick,
  Provision,
  RunAction,
  StatId,
  TurnInput,
  Unit,
} from './types';

/**
 * The format of what a run saves. Bump it with any change to `RunState` or
 * `FightState` that a run saved before can't play on (a field added,
 * removed or reinterpreted): older runs are then ended rather than
 * patched (`runOutdated`), so the rules never handle an old shape.
 */
export const RUN_FORMAT = 8;

export interface RunState {
  /** `RUN_FORMAT` when the run was created; missing in runs from before it existed. */
  format: number;
  seed: number;
  /** Bumped on every action; the view carries it (brief section 8). */
  version: number;
  /** Which of STAGES the run is at. */
  stage: number;
  /** A test stage (test-stage.json; `testStage.ts`): one fight, its own line-up, won to win the run. */
  test?: boolean;
  /**
   * The provisions earned so far, in the order earned (progression.md,
   * 19.2), a fallen hero's included; missing in runs from before them.
   */
  provisions?: Provision[];
  /** The passives taken at the caravanserais between regions, in the order taken. */
  passives?: PassivePick[];
  fight: FightState;
}

export interface RunView {
  version: number;
  /** Which stage of the run this is, from 0, of `stages`. */
  stage: number;
  stages: number;
  /** Winning this stage earns a provision, assigned at the caravanserai on the way to the next. */
  provision: boolean;
  /**
   * The passives the caravanserai offers once this stage is won, one to be
   * taken: the region's last stage, short of the run's last; none otherwise.
   */
  passives: PassiveId[];
  /**
   * The fight. While an AI unit's turn is due its `awaiting` is null: the
   * page has no unit to control.
   */
  fight: FightState;
  /** An AI unit's turn is due: the page asks for it (`continue`), one a request. */
  aiDue: boolean;
}

/**
 * A new run with the party chosen on the start menu (`{party}`; all three
 * heroes if none is given), its fight advanced to the first decision,
 * the player's or the AI's. `{test: true}` starts the test stage instead,
 * a run of one fight set up in test-stage.json.
 */
export function createRun(seed: number, setup?: unknown): RunState {
  if ((setup as {test?: unknown} | null | undefined)?.test === true) {
    const fight = createTestFight(seed);
    fight.events = [];
    advanceToDecision(fight);
    return {format: RUN_FORMAT, seed, version: 0, stage: 0, test: true, fight};
  }
  return {
    format: RUN_FORMAT,
    seed,
    version: 0,
    stage: 0,
    fight: stageFight(seed, 0, parseParty(setup)),
  };
}

/**
 * The enemy for a stage: its number of heroes, the first of one order for
 * its whole region, the region's first enemy then the rest at random from
 * the run's seed, so a stage brings the heroes of the one before it in the
 * region and more; then the region's creatures (wolves on the Steppe).
 */
export function stageEnemies(seed: number, stage: number): HeroId[] {
  const {region, heroes, creatures} = STAGES[stage]!;
  const {firstEnemy, creature} = REGIONS[region];
  const regionIndex = Object.keys(REGIONS).indexOf(region);
  const rest = ROSTER.filter((h) => h !== firstEnemy);
  const random = seededRandom((seed ^ 0x5bd1e995) + regionIndex * 0x9e3779b9);
  const picked = [firstEnemy, ...shuffled(rest, random)];
  return [...picked.slice(0, heroes), ...Array<HeroId>(creatures).fill(creature)];
}

/** Each stage's map and start from its own seed; the first stage's is the run's. */
const stageSeed = (seed: number, stage: number) => (seed + stage * 0x9e3779b9) >>> 0;

/**
 * A stage's fight, on its map, advanced to its first decision, the player's
 * or the AI's; the first `MOUNTAIN_STAGES` always have mountains. The camel
 * starts it with `camelHp`, the health it ended the stage before with; at
 * full health on the first.
 */
function stageFight(
  seed: number,
  stage: number,
  party: HeroId[],
  provisions: Provision[] = [],
  passives: PassivePick[] = [],
  camelHp?: number
): FightState {
  const fight = createFight(
    stageSeed(seed, stage),
    party,
    stageEnemies(seed, stage),
    stage < MOUNTAIN_STAGES,
    provisions,
    mapById(STAGES[stage]!.map),
    passives
  );
  const camel = fight.units.find((u) => u.hero === CAMEL)!;
  if (camelHp !== undefined) camel.hp = Math.min(camelHp, camel.maxHp);
  fight.events = [];
  advanceToDecision(fight);
  return fight;
}

/** The heroes still standing at the end of a fight, in party order. */
function survivors(fight: FightState): HeroId[] {
  return fight.units
    .filter((u) => u.side === 'player' && u.hero !== CAMEL && u.alive)
    .sort((a, b) => a.partyIndex - b.partyIndex)
    .map((u) => u.hero);
}

const STATS: StatId[] = ['speed', 'defence', 'power'];

/** The party's heroes standing, as a provision sees them: any with a stat below RULES.statMax. */
function raisable(fight: FightState): Unit[] {
  return fight.units.filter(
    (u) =>
      u.side === 'player' && u.hero !== CAMEL && u.alive && STATS.some((s) => u[s] < RULES.statMax)
  );
}

/**
 * Whether winning the run's stage earns a provision: one that earns them
 * (STAGES), unless every hero standing has every stat at RULES.statMax.
 */
function provisionOwed(run: RunState): boolean {
  return !run.test && Boolean(STAGES[run.stage]?.provision) && raisable(run.fight).length > 0;
}

/**
 * The passives the caravanserai offers once the run's stage is won: on a
 * region's last stage (STAGES) short of the run's last, `PASSIVE_OFFER` of
 * the pool at random from the run's seed and the stage, so a reload offers
 * the same ones. A passive every hero standing already carries isn't offered.
 */
export function passiveOffer(run: RunState): PassiveId[] {
  const {stage} = run;
  if (run.test || !STAGES[stage]?.passive || stage >= stageCount(run) - 1) return [];
  const standing = run.fight.units.filter(
    (u) => u.side === 'player' && u.hero !== CAMEL && u.alive
  );
  const open = (Object.keys(PASSIVES) as PassiveId[]).filter((id) =>
    standing.some((u) => !hasPassive(u, id))
  );
  return shuffled(open, seededRandom(stageSeed(run.seed, stage) ^ 0x27d4eb2f)).slice(
    0,
    PASSIVE_OFFER
  );
}

/** How many stages the run has: STAGES, or the test stage alone. */
const stageCount = (run: RunState) => (run.test ? 1 : STAGES.length);

/**
 * Checks a start menu's party from the network: one to three of the
 * roster's heroes, each at most once; none given, the default party.
 */
export function parseParty(setup: unknown): HeroId[] {
  const party = (setup as {party?: unknown} | null | undefined)?.party;
  if (party === undefined) return PARTY;
  if (
    !Array.isArray(party) ||
    party.length === 0 ||
    party.length > PARTY.length ||
    party.some((h, i) => !ROSTER.includes(h as HeroId) || party.indexOf(h) !== i)
  ) {
    throw new RuleError('Choose one to three different heroes.');
  }
  return party as HeroId[];
}

const isInt = (n: unknown): n is number => Number.isInteger(n) && Math.abs(n as number) < 1000;

function parseHex(raw: unknown): Hex {
  const h = raw as Hex | null;
  if (!h || typeof h !== 'object' || !isInt(h.q) || !isInt(h.r))
    throw new RuleError('Malformed hex.');
  return {q: h.q, r: h.r};
}

/** Checks an action from the network and copies only the fields the rules read. */
export function parseAction(raw: unknown): RunAction {
  const a = raw as Record<string, unknown> | null;
  if (!a || typeof a !== 'object') throw new RuleError('Malformed action.');
  if (a.type === 'next') {
    const out: RunAction = {type: 'next'};
    if (a.provision !== undefined) {
      const p = a.provision as {hero?: unknown; stat?: unknown} | null;
      if (
        !p ||
        typeof p !== 'object' ||
        !ROSTER.includes(p.hero as HeroId) ||
        !STATS.includes(p.stat as StatId)
      )
        throw new RuleError('Malformed provision.');
      out.provision = {hero: p.hero as HeroId, stat: p.stat as StatId};
    }
    if (a.passive !== undefined) {
      const p = a.passive as {hero?: unknown; passive?: unknown} | null;
      if (
        !p ||
        typeof p !== 'object' ||
        !ROSTER.includes(p.hero as HeroId) ||
        typeof p.passive !== 'string' ||
        !Object.hasOwn(PASSIVES, p.passive)
      )
        throw new RuleError('Malformed passive.');
      out.passive = {hero: p.hero as HeroId, passive: p.passive as PassiveId};
    }
    return out;
  }
  if (a.type === 'continue') return {type: 'continue'};
  if (a.type === 'turn') {
    const action = a.action as
      | {ability?: unknown; target?: {hex?: unknown; to?: unknown}}
      | undefined;
    if (
      !action ||
      typeof action.ability !== 'string' ||
      !Object.hasOwn(ABILITIES, action.ability)
    ) {
      throw new RuleError('Unknown ability.');
    }
    const out: RunAction = {type: 'turn', action: {ability: action.ability as AbilityId}};
    if (action.target !== undefined) {
      const target: ActionTarget = {};
      if (action.target.hex !== undefined) target.hex = parseHex(action.target.hex);
      if (action.target.to !== undefined) target.to = parseHex(action.target.to);
      out.action.target = target;
    }
    if (a.move !== undefined) {
      if (!Array.isArray(a.move) || a.move.length > 10) throw new RuleError('Malformed move.');
      out.move = a.move.map(parseHex);
    }
    return out;
  }
  throw new RuleError('Unknown action.');
}

/**
 * One action: the player's turn, or the AI's turn that is due
 * (`continue`), each on its own, so the page can play one back while the
 * next is worked out; then the track runs on to the next decision, either
 * side's. Or, once a stage short of the last is won, on to the next, with
 * the provision it earned given to one of the survivors, and on leaving a
 * region one of the passives offered (`passiveOffer`) to one of them; the
 * camel takes its health on with it. Given
 * a clock (`context.now`) the AI looks as deep as it gets in
 * AI.browser.thinkMs; without one it keeps to AI.maxSimulations, the same
 * turn on every machine (tests, balance).
 */
export function handleRunAction(run: RunState, raw: unknown, context?: RunContext): RunState {
  const action = parseAction(raw);
  const {stage} = run;
  if (action.type === 'next') {
    if (run.fight.phase !== 'won' || stage >= stageCount(run) - 1)
      throw new RuleError('There is no next stage to go on to.');
    const party = survivors(run.fight);
    const provisions = [...(run.provisions ?? [])];
    if (provisionOwed(run)) {
      if (!action.provision) throw new RuleError('Choose a hero and a stat to raise.');
      const {hero, stat} = action.provision;
      if (!party.includes(hero))
        throw new RuleError('Only a hero still in the party can take a provision.');
      const unit = run.fight.units.find((u) => u.side === 'player' && u.hero === hero)!;
      if (unit[stat] >= RULES.statMax)
        throw new RuleError(`No stat can go above ${RULES.statMax}.`);
      provisions.push(action.provision);
    } else if (action.provision) {
      throw new RuleError('There is no provision to take.');
    }
    const passives = [...(run.passives ?? [])];
    const offer = passiveOffer(run);
    if (offer.length > 0) {
      if (!action.passive) throw new RuleError('Choose a passive and a hero to carry it.');
      const {hero, passive} = action.passive;
      if (!offer.includes(passive)) throw new RuleError('That passive isn’t on offer.');
      if (!party.includes(hero))
        throw new RuleError('Only a hero still in the party can take a passive.');
      const unit = run.fight.units.find((u) => u.side === 'player' && u.hero === hero)!;
      if (hasPassive(unit, passive)) throw new RuleError('That hero already carries it.');
      passives.push(action.passive);
    } else if (action.passive) {
      throw new RuleError('There is no passive to take.');
    }
    const camel = run.fight.units.find((u) => u.hero === CAMEL)!;
    const fight = stageFight(run.seed, stage + 1, party, provisions, passives, camel.hp);
    return {...run, version: run.version + 1, stage: stage + 1, provisions, passives, fight};
  }
  const fight = cloneFight(run.fight, true);
  refreshStats(fight);
  // What this action sets off, for the page to play back.
  fight.events = [];
  if (fight.phase !== 'fight') throw new RuleError('The fight is not in progress.');
  const unit = actingUnit(fight);
  if (action.type === 'continue') {
    if (unit?.controller !== 'ai') throw new RuleError('No AI turn is due.');
    applyTurn(fight, unit, aiTurn(fight, unit, context?.now));
  } else {
    if (unit?.controller !== 'human') throw new RuleError('It is not your turn.');
    const {type: _type, ...input} = action;
    applyTurn(fight, unit, input);
  }
  advanceToDecision(fight);
  return {...run, version: run.version + 1, fight};
}

function aiTurn(fight: FightState, unit: Unit, now?: () => number): TurnInput {
  if (!now) return chooseAiTurn(fight, unit, {left: AI.maxSimulations});
  const {work, depth, widths, thinkMs} = AI.browser;
  const start = now();
  const stop = () => now() - start > thinkMs;
  return chooseAiTurn(fight, unit, {left: work}, undefined, {work, depth, widths, stop});
}

/** Whether the fight waits on an AI unit's turn. */
function aiDue(fight: FightState): boolean {
  return actingUnit(fight)?.controller === 'ai';
}

export function runView(run: RunState): RunView {
  // A run started before the stats were re-tuned shows, and previews with, today's.
  refreshStats(run.fight);
  const due = aiDue(run.fight);
  return {
    version: run.version,
    stage: run.stage,
    stages: stageCount(run),
    provision: provisionOwed(run),
    passives: passiveOffer(run),
    fight: due ? {...run.fight, awaiting: null} : run.fight,
    aiDue: due,
  };
}

/** Won once the last stage is won; a stage before it, won, waits for `next`. */
export function runStatus(run: RunState): 'active' | 'won' | 'lost' {
  if (run.fight.phase === 'lost') return 'lost';
  return run.fight.phase === 'won' && run.stage >= stageCount(run) - 1 ? 'won' : 'active';
}

/** Saved in another format than this version's (`RUN_FORMAT`): the platform ends it. */
export function runOutdated(run: RunState): boolean {
  return run.format !== RUN_FORMAT;
}
