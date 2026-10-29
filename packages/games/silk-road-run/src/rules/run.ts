/**
 * A run: its stages (STAGES in config.ts) one after another, each a fight
 * against a bigger enemy band. Heroes who fall are gone for the run; the
 * survivors and the camel go on to the next stage, by way of the
 * caravanserai, which drafts provisions (progression.md, 19.3; owner,
 * 2026-10-29): stat, passive and ability upgrades, drawn by rarity, the
 * party picking one and the rival one in turn, the rest discarded; 3 drawn
 * and 1 each after a regular stage, 5 and 2 each after a boss; if the
 * camel took no damage, one more drawn and one more pick for the party,
 * its last. A pick can heal the camel instead. A provision once drawn is
 * never drawn again in the run.
 * The rival's provisions go to the enemy of every stage after. The heroes
 * start each stage at full health; the camel keeps the health it ended the
 * last one with, unless healed there (camel.md, 18.4). The run keeps the
 * seed; the view is the fight, which never contains it.
 */
import type {Hex, RunContext} from '@canvas/engine/server';
import {ABILITIES} from './abilities';
import {chooseAiTurn} from './ai';
import {
  AI,
  CAMEL,
  CREATURES,
  DRAFT,
  HEROES,
  MOUNTAIN_STAGES,
  PARTY,
  RARITY_WEIGHT,
  REGIONS,
  ROSTER,
  RULES,
  STAGES,
  STAT_RARITY,
  type Rarity,
  type RegionId,
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
  type EnemyCards,
} from './fight';
import {mapById} from './map';
import {NOT_OFFERED, PASSIVES, RARITY_ORDER, fitRank, hasPassive} from './passives';
import {createTestFight} from './testStage';
import {shuffled} from './track';
import type {
  AbilityId,
  ActionTarget,
  CardId,
  DraftPick,
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
export const RUN_FORMAT = 18;

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
   * The party's stat provisions so far, in the order drafted (progression.md,
   * 19.2), a fallen hero's included; missing in runs from before them.
   */
  provisions?: Provision[];
  /** The passives and upgrades the party drafted at the caravanserais, in the order taken. */
  passives?: PassivePick[];
  /** The rival's provisions, in the order taken: every stage's enemy shares them out (`rivalShares`). */
  rivalCards?: CardId[];
  /**
   * Every provision the caravanserais have drawn so far, picked or
   * discarded, in the order drawn: none is drawn again (owner, 2026-10-29).
   */
  offered?: CardId[];
  /**
   * The party's picks so far in the caravanserai's draft (`draft`), each
   * kept for good, so the rival's answer to another pick is never shown
   * (owner, 2026-10-28). Cleared on setting out.
   */
  picks?: DraftPick[];
  fight: FightState;
}

export interface RunView {
  version: number;
  /** Which stage of the run this is, from 0, of `stages`. */
  stage: number;
  stages: number;
  /** The caravanserai's draft once this stage is won; null after the run's last, or before it is won. */
  draft: DraftView | null;
  /**
   * The fight. While an AI unit's turn is due its `awaiting` is null: the
   * page has no unit to control.
   */
  fight: FightState;
  /** An AI unit's turn is due: the page asks for it (`continue`), one a request. */
  aiDue: boolean;
}

/** The caravanserai's draft as the page shows it (progression.md, 19.3). */
export interface DraftView {
  /** The provisions drawn, in the order drawn. */
  offer: CardId[];
  /** How many the party picks: one more than the rival with `extra`. */
  picks: number;
  /** How many the rival picks. */
  rivalPicks: number;
  /**
   * The camel took no damage in the stage (camel.md, 18.4): one more card
   * drawn, and the party picks one more.
   */
  extra: boolean;
  /** The party's picks so far. */
  mine: DraftPick[];
  /** The rival's answer to each of them so far. */
  rival: CardId[];
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
 * The enemy for a stage: its number of its region's heroes, the first of
 * one random order for its whole region from the run's seed, so a stage brings the heroes of the one before
 * it in the region and more; then its outsiders, the first of one random
 * order of the heroes of the regions before; then the region's creatures
 * (wolves on the Steppe). A boss stage brings the region's boss and its
 * creatures in their place, once the region has a boss (REGIONS).
 */
export function stageEnemies(seed: number, stage: number): HeroId[] {
  const {region, boss, heroes, outsiders, creatures} = STAGES[stage]!;
  const creature = REGIONS[region].creature;
  const fill = () => (creature ? Array<HeroId>(creatures).fill(creature) : []);
  // A boss stage: the region's boss (one unit, or two) and its creatures, if it has a boss yet.
  const theBoss = boss ? REGIONS[region].boss : null;
  if (theBoss) return [...theBoss, ...fill()];
  const {picked, others} = regionOrder(seed, region);
  return [...picked.slice(0, heroes), ...others.slice(0, outsiders), ...fill()];
}

/**
 * The order a region's heroes come in (`picked`), and the heroes of the
 * regions before it (`others`), from the run's seed.
 */
function regionOrder(seed: number, region: RegionId): {picked: HeroId[]; others: HeroId[]} {
  const regions = Object.keys(REGIONS) as RegionId[];
  const regionIndex = regions.indexOf(region);
  const random = seededRandom((seed ^ 0x5bd1e995) + regionIndex * 0x9e3779b9);
  const picked = shuffled(REGIONS[region].heroes, random);
  const before = regions.slice(0, regionIndex).flatMap((r) => REGIONS[r].heroes);
  return {picked, others: shuffled(before, random)};
}

/** Each stage's map and start from its own seed; the first stage's is the run's. */
const stageSeed = (seed: number, stage: number) => (seed + stage * 0x9e3779b9) >>> 0;

/**
 * A stage's fight, on its map, advanced to its first decision, the player's
 * or the AI's; the first `MOUNTAIN_STAGES` always have mountains. The camel
 * starts it with `camelHp`, the health it ended the stage before with; at
 * full health on the first. The enemy shares out the rival's provisions
 * (`rivalShares`).
 */
function stageFight(
  seed: number,
  stage: number,
  party: HeroId[],
  provisions: Provision[] = [],
  passives: PassivePick[] = [],
  camelHp?: number,
  rivalCards: CardId[] = []
): FightState {
  const enemies = stageEnemies(seed, stage);
  const fight = createFight(
    stageSeed(seed, stage),
    party,
    enemies,
    stage < MOUNTAIN_STAGES,
    provisions,
    mapById(STAGES[stage]!.map),
    passives,
    rivalShares(enemies, rivalCards)
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

/** Whether a provision card is a stat, +1 of it. */
export const isStatCard = (card: CardId): card is StatId => STATS.includes(card as StatId);

/** A provision card's rarity (progression.md, 19.3b): the stats' `STAT_RARITY`. */
export const cardRarity = (card: CardId): Rarity =>
  isStatCard(card) ? STAT_RARITY : (PASSIVES[card].rarity ?? 'common');

/** The enemy units of a line-up that can carry the rival's provisions: not its creatures. */
const carriers = (enemies: readonly HeroId[]) =>
  enemies.flatMap((hero, i) => (CREATURES.includes(hero) ? [] : [i]));

/**
 * The rival's provisions shared out over a stage's `enemies` (progression.md,
 * 19.3; owner, 2026-10-29), each in the order taken, never to a creature: a
 * stat to the unit with the fewest of them so far that can still take it
 * (RULES.statMax); a passive or upgrade to the unit it suits best
 * (`fitRank`) that doesn't carry it yet, the fewest so far breaking a tie.
 * One no unit can take is left out. By the enemy's place in `enemies`.
 */
export function rivalShares(enemies: readonly HeroId[], cards: readonly CardId[]): EnemyCards[] {
  const out: EnemyCards[] = enemies.map(() => ({passives: []}));
  const held = enemies.map(() => 0);
  for (const card of cards) {
    const options = carriers(enemies).filter((i) => {
      const hero = enemies[i]!;
      if (isStatCard(card))
        return HEROES[hero][card] + (out[i]!.provisions?.[card] ?? 0) < RULES.statMax;
      return !(HEROES[hero].passives ?? []).includes(card) && !out[i]!.passives.includes(card);
    });
    const key = (i: number) => (isStatCard(card) ? 0 : fitRank(enemies[i]!, card)) * 100 + held[i]!;
    const to = options.reduce<number | null>(
      (best, i) => (best === null || key(i) < key(best) ? i : best),
      null
    );
    if (to === null) continue;
    const share = out[to]!;
    if (isStatCard(card))
      share.provisions = {...share.provisions, [card]: (share.provisions?.[card] ?? 0) + 1};
    else share.passives.push(card);
    held[to]!++;
  }
  return out;
}

/** The camel took no damage in the stage, healed back or not (owner, 2026-10-28). */
function camelUnhurt(fight: FightState): boolean {
  const camel = fight.units.find((u) => u.hero === CAMEL);
  return camel !== undefined && !camel.damaged;
}

/**
 * The caravanserai's draft once the run's stage is won (`DRAFT`): its size,
 * how many the party picks and how many the rival; null after the run's
 * last stage. The camel unhurt in the stage, one more card is drawn and
 * the party picks one more (owner, 2026-10-29), its last pick.
 */
function draftSize(run: RunState): {offer: number; picks: number; rival: number} | null {
  if (run.test || run.fight.phase !== 'won' || run.stage >= stageCount(run) - 1) return null;
  const {offer, picks} = STAGES[run.stage]!.boss ? DRAFT.boss : DRAFT.stage;
  const extra = camelUnhurt(run.fight) ? 1 : 0;
  return {offer: offer + extra, picks: picks + extra, rival: picks};
}

/** How many picks the rival makes in the caravanserai's draft. */
const rivalOwed = (run: RunState) => draftSize(run)?.rival ?? 0;

/**
 * The provisions the caravanserai draws once the run's stage is won (`DRAFT`,
 * progression.md, 19.3): from the stats and the passives and upgrades of the
 * pool, one at a time from the run's seed and the stage, so a reload offers
 * the same, each as often as its rarity's weight (`RARITY_WEIGHT`; 19.3b).
 * A provision drawn at an earlier caravanserai, picked or not, isn't drawn
 * again in the run (`offered`; owner, 2026-10-29); nor is a stat every hero
 * standing has at RULES.statMax, or a passive every hero standing already
 * carries. Late in a run the pool can run short, and fewer are drawn.
 */
export function draftOffer(run: RunState): CardId[] {
  const size = draftSize(run);
  if (!size) return [];
  const standing = run.fight.units.filter(
    (u) => u.side === 'player' && u.hero !== CAMEL && u.alive
  );
  const offered = run.offered ?? [];
  const open: CardId[] = [
    ...STATS.filter((stat) => standing.some((u) => u[stat] < RULES.statMax)),
    ...(Object.keys(PASSIVES) as PassiveId[]).filter(
      (id) => !NOT_OFFERED.includes(id) && standing.some((u) => !hasPassive(u, id))
    ),
  ].filter((card) => !offered.includes(card));
  return weightedDraw(
    open,
    (card) => RARITY_WEIGHT[cardRarity(card)],
    seededRandom(stageSeed(run.seed, run.stage) ^ 0x27d4eb2f),
    size.offer
  );
}

/**
 * How many picks the party makes in the caravanserai's draft: none when it
 * draws nothing, and, with fewer drawn than the draft's size, only those
 * that still find a card left after the picks and the rival's answers
 * before them.
 */
function picksOwed(run: RunState): number {
  const drawn = draftOffer(run).length;
  const size = draftSize(run);
  if (!size || drawn === 0) return 0;
  let owed = 0;
  while (owed < size.picks && owed + Math.min(owed, size.rival) < drawn) owed++;
  return owed;
}

/** `n` of `items` drawn one at a time without putting back, each as often as its `weight`. */
export function weightedDraw<T>(
  items: readonly T[],
  weight: (item: T) => number,
  random: () => number,
  n: number
): T[] {
  const left = [...items];
  const out: T[] = [];
  while (out.length < n && left.length > 0) {
    const total = left.reduce((sum, item) => sum + weight(item), 0);
    let r = random() * total;
    let i = 0;
    while (i < left.length - 1 && (r -= weight(left[i]!)) >= 0) i++;
    out.push(...left.splice(i, 1));
  }
  return out;
}

/**
 * The enemy the rival drafts for (progression.md, 19.3): the next stage's
 * units that carry provisions (not its creatures).
 */
export function draftRivals(run: RunState): HeroId[] {
  const enemies = stageEnemies(run.seed, run.stage + 1);
  return carriers(enemies).map((i) => enemies[i]!);
}

/**
 * The rival's pick from `open`, for `rivals`: the rarest provision one of
 * them can use (a stat; a passive or upgrade some rival's `fitRank` puts
 * under 500), the one that suits a rival best breaking a tie, then the
 * draw's order; with none of use, the same over the rest.
 */
export function rivalPick(rivals: readonly HeroId[], open: readonly CardId[]): CardId {
  const fit = (card: CardId) =>
    isStatCard(card) ? 0 : Math.min(...rivals.map((hero) => fitRank(hero, card)));
  const key = (card: CardId) =>
    (fit(card) < 500 ? 0 : 100_000) + RARITY_ORDER.indexOf(cardRarity(card)) * 10_000 + fit(card);
  return open.reduce((best, card) => (key(card) < key(best) ? card : best));
}

/**
 * The rival's picks in a draft of `offer`, given the party's so far
 * (`mine`, in the order picked): after each, the rival's pick
 * (`rivalPick`) from those left, until it has `most`. A heal takes no card.
 */
export function rivalPicks(
  offer: readonly CardId[],
  rivals: readonly HeroId[],
  mine: readonly DraftPick[],
  most = Infinity
): CardId[] {
  const picks: CardId[] = [];
  mine.forEach((_, i) => {
    if (picks.length >= most) return;
    const gone = [...mine.slice(0, i + 1).flatMap((p) => ('card' in p ? [p.card] : [])), ...picks];
    const left = offer.filter((card) => !gone.includes(card));
    if (left.length > 0) picks.push(rivalPick(rivals, left));
  });
  return picks;
}

/** The camel's health once the heals among `picks` are taken. */
function healedCamel(fight: FightState, picks: readonly DraftPick[]): number {
  const camel = fight.units.find((u) => u.hero === CAMEL)!;
  const heals = picks.filter((p) => 'heal' in p).length;
  return Math.min(camel.hp + heals * RULES.camelHeal, camel.maxHp);
}

/**
 * Checks one of the party's draft picks against the picks before it: a
 * card still open, to a hero still standing who can take it (a stat below
 * RULES.statMax, counting the picks before; a passive it doesn't carry
 * yet); or a heal, the camel still hurt.
 */
function checkPick(run: RunState, pick: DraftPick): void {
  const before = run.picks ?? [];
  if ('heal' in pick) {
    const camel = run.fight.units.find((u) => u.hero === CAMEL)!;
    if (healedCamel(run.fight, before) >= camel.maxHp)
      throw new RuleError(`${HEROES[CAMEL].name} is already at full health.`);
    return;
  }
  const offer = draftOffer(run);
  const gone = [
    ...before.flatMap((p) => ('card' in p ? [p.card] : [])),
    ...rivalPicks(offer, draftRivals(run), before, rivalOwed(run)),
  ];
  if (!offer.includes(pick.card) || gone.includes(pick.card))
    throw new RuleError('That provision isn’t on offer.');
  if (!survivors(run.fight).includes(pick.hero))
    throw new RuleError('Only a hero still in the party can take a provision.');
  const unit = run.fight.units.find((u) => u.side === 'player' && u.hero === pick.hero)!;
  if (isStatCard(pick.card)) {
    const more = before.filter((p) => 'card' in p && p.hero === pick.hero && p.card === pick.card);
    if (unit[pick.card] + more.length >= RULES.statMax)
      throw new RuleError(`No stat can go above ${RULES.statMax}.`);
  } else if (hasPassive(unit, pick.card)) {
    throw new RuleError('That hero already carries it.');
  }
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

function parsePick(raw: unknown): DraftPick {
  const p = raw as {hero?: unknown; card?: unknown; heal?: unknown} | null;
  if (p && typeof p === 'object' && p.heal === true && p.hero === undefined && p.card === undefined)
    return {heal: true};
  if (
    !p ||
    typeof p !== 'object' ||
    !ROSTER.includes(p.hero as HeroId) ||
    typeof p.card !== 'string' ||
    !(STATS.includes(p.card as StatId) || Object.hasOwn(PASSIVES, p.card))
  )
    throw new RuleError('Malformed pick.');
  return {hero: p.hero as HeroId, card: p.card as CardId};
}

/** Checks an action from the network and copies only the fields the rules read. */
export function parseAction(raw: unknown): RunAction {
  const a = raw as Record<string, unknown> | null;
  if (!a || typeof a !== 'object') throw new RuleError('Malformed action.');
  if (a.type === 'next') return {type: 'next'};
  if (a.type === 'draft') return {type: 'draft', pick: parsePick(a.pick)};
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
 * side's. Or, once a stage short of the last is won, a pick in the
 * caravanserai's draft (`draft`, kept for good, the rival answering it at
 * once), and with every pick made, on to the next stage (`next`): the
 * party's stats raised and passives carried, the camel healed for each
 * heal, the rival's picks added to its provisions; the camel takes its
 * health on with it. Given a clock (`context.now`) the AI looks as deep as
 * it gets in AI.browser.thinkMs; without one it keeps to AI.maxSimulations,
 * the same turn on every machine (tests, balance).
 */
export function handleRunAction(run: RunState, raw: unknown, context?: RunContext): RunState {
  const action = parseAction(raw);
  const {stage} = run;
  if (action.type === 'draft') {
    const picks = run.picks ?? [];
    if (picks.length >= picksOwed(run)) throw new RuleError('There is nothing to pick.');
    checkPick(run, action.pick);
    return {
      ...run,
      version: run.version + 1,
      picks: [...picks, action.pick],
      fight: {...run.fight, events: []},
    };
  }
  if (action.type === 'next') {
    if (run.fight.phase !== 'won' || stage >= stageCount(run) - 1)
      throw new RuleError('There is no next stage to go on to.');
    const picks = run.picks ?? [];
    if (picks.length < picksOwed(run)) throw new RuleError('Make your picks before setting out.');
    const party = survivors(run.fight);
    const provisions = [...(run.provisions ?? [])];
    const passives = [...(run.passives ?? [])];
    for (const pick of picks) {
      if (!('card' in pick)) continue;
      if (isStatCard(pick.card)) provisions.push({hero: pick.hero, stat: pick.card});
      else passives.push({hero: pick.hero, passive: pick.card});
    }
    const offer = draftOffer(run);
    const rivalCards = [
      ...(run.rivalCards ?? []),
      ...rivalPicks(offer, draftRivals(run), picks, rivalOwed(run)),
    ];
    const offered = [...(run.offered ?? []), ...offer];
    const fight = stageFight(
      run.seed,
      stage + 1,
      party,
      provisions,
      passives,
      healedCamel(run.fight, picks),
      rivalCards
    );
    // The draft is spent.
    const {picks: _picks, ...rest} = run;
    return {
      ...rest,
      version: run.version + 1,
      stage: stage + 1,
      provisions,
      passives,
      ...(rivalCards.length ? {rivalCards} : {}),
      ...(offered.length ? {offered} : {}),
      fight,
    };
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
    draft: draftView(run),
    fight: due ? {...run.fight, awaiting: null} : run.fight,
    aiDue: due,
  };
}

/** The caravanserai's draft for the page; null when there is none. */
function draftView(run: RunState): DraftView | null {
  const offer = draftOffer(run);
  const size = draftSize(run);
  if (!size) return null;
  const mine = run.picks ?? [];
  return {
    offer,
    picks: picksOwed(run),
    rivalPicks: offer.length > 0 ? size.rival : 0,
    extra: camelUnhurt(run.fight),
    mine,
    rival: rivalPicks(offer, draftRivals(run), mine, size.rival),
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
