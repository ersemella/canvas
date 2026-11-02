/**
 * The passives (progression.md, 19.8; owner, 2026-10-24): hero-agnostic
 * rules, each working on whichever unit carries it ("this hero"), in the
 * keywords' terms (keywords.md). Their effects are woven into the rules
 * where each bends one: damage (`hit`, `applyDamage` in resolve.ts), the
 * track (`haste`, `delay`, the card's placement in fight.ts), walking
 * (`reachableHexes` in board.ts) and statuses (`stun`). No hero carries
 * one yet: the test stage gives them (`Loadout.passives`), and every
 * caravanserai drafts them with the stat provisions (19.3): the party's
 * picks, and the rival's for the enemy (`fitRank`).
 */
import {
  ARMOURED,
  BATTLE_CRY,
  BLOODLUST,
  DEVOTED,
  FURY,
  HEROES,
  ONE_EYE,
  PASSIVE,
  RULES,
  SPEARHEAD,
  UPGRADE,
} from './config';
import type {Rarity} from './config';
import type {AbilityId, HeroId, PassiveId, Unit} from './types';

export type PassiveGroup =
  | 'track'
  | 'board'
  | 'damage'
  | 'control'
  | 'allies'
  | 'attacks'
  | 'healing'
  | 'targeting';

export interface PassiveDef {
  id: PassiveId;
  name: string;
  group: PassiveGroup;
  /** The rule, for the stat sheet (D11: every passive is public). */
  rule: string;
  /**
   * A passive (19.8), or a generic ability upgrade (19.9), which changes how
   * its carrier's abilities work; both are drafted and carried alike.
   */
  kind: 'passive' | 'upgrade';
  /** How rarely the caravanserai offers it (19.3b, `RARITY_WEIGHT`); none for one it doesn't. */
  rarity?: Rarity;
}

const def = (
  id: PassiveId,
  name: string,
  group: PassiveGroup,
  rule: string,
  rarity?: Rarity
): PassiveDef => ({id, name, group, rule, kind: 'passive', ...(rarity ? {rarity} : {})});

const upgrade = (
  id: PassiveId,
  name: string,
  group: PassiveGroup,
  rule: string,
  rarity: Rarity
): PassiveDef => ({id, name, group, rule, kind: 'upgrade', rarity});

/**
 * The pool, in 19.8's order. Pared down by the owner on 2026-11-02: 22 cards
 * removed (Defy Fate, Vengeance, Ward, Shake Loose, Reel In, Rebound,
 * Piercing Eye, Mending Strike and Shot, Iron Will, Immovable Object,
 * Wearying, Fervour, Bulwark, Rally, Quickening, Inspire, Hardened,
 * Fortify, Lockdown, Lethargy and Hamstring; Invigorate the same day), Concussive split in three
 * with Staggering folded in, and Plated, Braced, Sure Hand, Empowering,
 * Hastening and Sheltering added, Unstoppable offered. The rarities of
 * the new and changed cards are the builder's estimate, not measured.
 */
export const PASSIVES: Record<PassiveId, PassiveDef> = {
  steadyGait: def(
    'steadyGait',
    'Steady Gait',
    'track',
    'Inevitable: its card can’t be Delayed or Hastened.',
    'rare'
  ),
  secondWind: def(
    'secondWind',
    'Second Wind',
    'track',
    `The first time each fight it is at half its health or less, its card is Hastened ${PASSIVE.secondWind.haste}.`,
    'common'
  ),
  patient: def(
    'patient',
    'Patient',
    'track',
    'A turn it ends without moving or using an ability, its card goes 2 fewer slots on.',
    'common'
  ),
  momentum: def(
    'momentum',
    'Momentum',
    'track',
    `After a turn in which it takes a unit off the board, its card is Hastened ${PASSIVE.momentum.haste}.`,
    'uncommon'
  ),
  rooted: def(
    'rooted',
    'Rooted',
    'board',
    'Can’t be Pushed or Pulled. Can still be Immobilized and Moved.',
    'rare'
  ),
  unstoppable: def(
    'unstoppable',
    'Unstoppable',
    'board',
    'Can’t be Pushed, Pulled, Immobilized or Stunned, so it can’t be grappled and hail doesn’t stop its walk.',
    'rare'
  ),
  lightStep: def(
    'lightStep',
    'Light Step',
    'board',
    'Walks through allies, and may end its walk swapping places with an ally.',
    'common'
  ),
  lastStand: def(
    'lastStand',
    'Last Stand',
    'damage',
    `The first time each fight it would fall, it is left at 1 health instead, Delayed ${RULES.durations.stun}.`,
    'rare'
  ),
  opportunist: def(
    'opportunist',
    'Opportunist',
    'damage',
    'Its attacks deal 1 more to a unit whose card is behind its own next card, or off the track.',
    'rare'
  ),
  glassCannon: def(
    'glassCannon',
    'Glass Cannon',
    'damage',
    'Empower 1 always, but starts each fight at half its health.',
    'epic'
  ),
  plated: def(
    'plated',
    'Plated',
    'damage',
    `Armour ${PASSIVE.plated.armour} against every hit, unless it Pierces.`,
    'epic'
  ),
  braced: def(
    'braced',
    'Braced',
    'damage',
    `Starts each fight with Shield ${PASSIVE.braced.shield}, lasting until spent.`,
    'uncommon'
  ),
  flanker: def(
    'flanker',
    'Flanker',
    'allies',
    'Its attacks deal 1 more when an ally stands on the far side of the target, opposite it.',
    'common'
  ),
  loneWolf: def(
    'loneWolf',
    'Lone Wolf',
    'allies',
    'Empower 1 while no ally is within 2 spaces.',
    'rare'
  ),
  sureHand: def('sureHand', 'Sure Hand', 'allies', 'Its abilities don’t damage allies.', 'common'),
  oneEye: def(
    'oneEye',
    'One Eye',
    'damage',
    `Armour ${ONE_EYE.armour} against hits from anyone not standing in the lane its eye faces. It turns toward whatever it walks to or aims at.`
  ),
  devoted: def(
    'devoted',
    'Devoted',
    'allies',
    `Whenever its Devoted partner is hit, its card is Hastened ${DEVOTED.haste}.`
  ),
  armoured: def(
    'armoured',
    'Armoured',
    'damage',
    `Armour ${ARMOURED.armour} against every hit, unless it Pierces.`
  ),
  fury: def('fury', 'Fury', 'damage', `Whenever it is hit, its card is Hastened ${FURY.haste}.`),
  battleCry: def(
    'battleCry',
    'Battle Cry',
    'allies',
    BATTLE_CRY.self === BATTLE_CRY.allies
      ? `Whenever it is hit, its card and each ally's within ${BATTLE_CRY.range} are Hastened ${BATTLE_CRY.self}.`
      : `Whenever it is hit, its card is Hastened ${BATTLE_CRY.self} and each ally's within ${BATTLE_CRY.range} ${BATTLE_CRY.allies}.`
  ),
  bloodlust: def(
    'bloodlust',
    'Bloodlust',
    'damage',
    BLOODLUST.stacks
      ? `Whenever its hit damages an enemy, it is Empowered ${BLOODLUST.empower} more, up to ${BLOODLUST.max}, for ${BLOODLUST.slots} slots.`
      : `Whenever its hit damages an enemy, it is Empowered ${BLOODLUST.empower} for ${BLOODLUST.slots} slots.`
  ),
  spearhead: def(
    'spearhead',
    'Spearhead',
    'allies',
    `Whenever it is hit, each ally ${SPEARHEAD.range === 1 ? 'next to it' : `within ${SPEARHEAD.range}`} is Hastened ${SPEARHEAD.haste}.`
  ),
  serpentKing: def(
    'serpentKing',
    'Serpent King',
    'damage',
    'While either of its serpents is on the board, no damage reaches its health.'
  ),
  regrow: def(
    'regrow',
    'Zahhak’s Serpent',
    'allies',
    'Cut down, it can be grown back by Zahhak on his turn, next to him at full health.'
  ),
  // The generic ability upgrades (19.9; owner, 2026-10-29), rarer the stronger.
  forceful: upgrade(
    'forceful',
    'Forceful',
    'board',
    `Its attacks Push the target ${UPGRADE.forceful.push}; not one that already Pushes.`,
    'uncommon'
  ),
  concussive1: upgrade(
    'concussive1',
    'Concussive I',
    'attacks',
    `Its attacks Delay the target ${UPGRADE.concussive1.delay}.`,
    'rare'
  ),
  concussive2: upgrade(
    'concussive2',
    'Concussive II',
    'attacks',
    `Its attacks Delay the target ${UPGRADE.concussive2.delay}.`,
    'epic'
  ),
  concussive3: upgrade(
    'concussive3',
    'Concussive III',
    'attacks',
    `Its attacks Delay the target ${UPGRADE.concussive3.delay}.`,
    'legendary'
  ),
  sundering: upgrade('sundering', 'Sundering', 'attacks', 'Its attacks Pierce.', 'uncommon'),
  crippling: upgrade(
    'crippling',
    'Crippling',
    'attacks',
    `Its attacks Weaken the target ${UPGRADE.crippling.weaken}.`,
    'uncommon'
  ),
  empowering: upgrade(
    'empowering',
    'Empowering',
    'allies',
    `Each unit its abilities hit or affect, enemy or ally, is Empowered ${UPGRADE.empowering.empower} for ${RULES.durations.turn} slots.`,
    'common'
  ),
  hastening: upgrade(
    'hastening',
    'Hastening',
    'allies',
    `Each unit its abilities hit or affect, enemy or ally, is Hastened ${UPGRADE.hastening.haste}.`,
    'common'
  ),
  sheltering: upgrade(
    'sheltering',
    'Sheltering',
    'allies',
    `Each unit its abilities hit or affect, enemy or ally, gains Shield ${UPGRADE.sheltering.shield} for ${RULES.durations.turn} slots.`,
    'common'
  ),
  forked: upgrade(
    'forked',
    'Forked',
    'targeting',
    'Its single-target abilities take one extra target.',
    'legendary'
  ),
};

/**
 * Passives a hero starts with that the caravanserai doesn't offer: One Eye,
 * the Cyclops's, Devoted, the Bull Demon King's and Princess Iron Fan's
 * (owner, 2026-10-28), Armoured, the Cataphract's (owner, 2026-10-29), the
 * Serpent King and Regrow, Zahhak's and his serpents' (2026-10-29),
 * Spearhead, the Vanguard's from 2026-10-30 to 2026-10-31 (owner), and the
 * Barbarian's Fury, Bloodlust and Battle Cry aren't in 19.8's pool.
 * Unstoppable, the Juggernaut's, is offered since 2026-11-02 (owner).
 */
export const NOT_OFFERED: readonly PassiveId[] = [
  'oneEye',
  'devoted',
  'armoured',
  'serpentKing',
  'regrow',
  'spearhead',
  'fury',
  'bloodlust',
  'battleCry',
];

/** Whether `unit` carries the passive `id`. */
export function hasPassive(unit: Unit, id: PassiveId): boolean {
  return unit.passives?.includes(id) ?? false;
}

/**
 * For a passive that works once a fight: whether `unit` carries `id` and
 * hasn't used it yet this fight, marking it used if so.
 */
export function spendPassive(unit: Unit, id: PassiveId): boolean {
  if (!hasPassive(unit, id) || unit.spent?.includes(id)) return false;
  // A new list: copies of a fight (previews, the AI's search) share a unit's arrays.
  unit.spent = [...(unit.spent ?? []), id];
  return true;
}

/** The passives `unit` carries, in 19.8's order. */
export function passivesOf(unit: Unit): PassiveDef[] {
  return (Object.keys(PASSIVES) as PassiveId[])
    .filter((id) => hasPassive(unit, id))
    .map((id) => PASSIVES[id]);
}

/**
 * How well a passive suits a hero (progression.md, 19.3a, 19.3c; owner,
 * 2026-10-28), for the rival's draft and for which enemy unit carries its
 * picks (`fitRank`): the passives that supplement it most, best first (`likes`), and those that do it
 * little or no good (`useless`, last). The rest come between, in the
 * pool's order. Builder's first reading of each kit, unmeasured: a slow
 * tank wants to hold the line (Plated, Braced), a fast striker to keep
 * its tempo (Momentum, Opportunist), a frail support to survive (Last
 * Stand, Braced); nothing that undoes its kit (Steady Gait on the
 * Duelist, whose Swift Strike Hastens it) or that it already has the
 * effect of (Rooted on the Unstoppable Juggernaut).
 */
export const DRAFT_FIT: Partial<Record<HeroId, {likes: PassiveId[]; useless: PassiveId[]}>> = {
  youxia: {
    likes: ['momentum', 'opportunist', 'flanker', 'lastStand', 'secondWind', 'braced'],
    useless: ['steadyGait', 'loneWolf', 'patient'],
  },
  modao: {
    likes: ['plated', 'braced', 'rooted', 'unstoppable', 'secondWind', 'lastStand'],
    useless: ['glassCannon', 'loneWolf', 'lightStep'],
  },
  alchemist: {
    likes: ['lastStand', 'braced', 'lightStep', 'secondWind', 'plated', 'unstoppable'],
    useless: ['glassCannon', 'loneWolf', 'flanker'],
  },
  archer: {
    likes: ['loneWolf', 'opportunist', 'glassCannon', 'lastStand', 'braced', 'momentum'],
    useless: ['flanker', 'sureHand'],
  },
  mahout: {
    likes: ['plated', 'braced', 'momentum', 'secondWind', 'opportunist'],
    useless: ['rooted', 'loneWolf', 'lightStep'],
  },
  magus: {
    likes: ['lastStand', 'braced', 'lightStep', 'plated', 'unstoppable', 'secondWind'],
    useless: ['glassCannon', 'opportunist', 'flanker', 'momentum', 'loneWolf'],
  },
  varangian: {
    likes: ['opportunist', 'momentum', 'flanker', 'secondWind', 'braced', 'lastStand'],
    useless: ['loneWolf', 'patient'],
  },
  cataphract: {
    likes: ['plated', 'braced', 'momentum', 'unstoppable', 'secondWind'],
    useless: ['lightStep', 'loneWolf', 'glassCannon', 'patient'],
  },
  priest: {
    likes: ['lastStand', 'braced', 'plated', 'lightStep', 'secondWind', 'unstoppable'],
    useless: ['glassCannon', 'opportunist', 'flanker', 'momentum', 'loneWolf'],
  },
};

/**
 * What a hero's abilities do, for whether a generic upgrade (19.9) can work
 * on its kit: attack in melee or at range, heal, Delay, Weaken, Empower or
 * Hasten an ally, Immobilize, or aim at one target (Forked). The builder's
 * reading of each kit, for the rival's draft.
 */
type Trait =
  | 'melee'
  | 'ranged'
  | 'heals'
  | 'delays'
  | 'weakens'
  | 'empowers'
  | 'hastens'
  | 'immobilizes'
  | 'single';

const TRAITS: Partial<Record<AbilityId, Trait[]>> = {
  grapple: ['melee'],
  shove: ['single'],
  haul: ['single'],
  snapShot: ['melee', 'ranged', 'single'],
  skirmish: ['melee', 'ranged'],
  volley: ['ranged'],
  feignedRetreat: ['melee', 'ranged'],
  hail: ['ranged', 'immobilizes'],
  sunlight: ['empowers', 'single'],
  gale: ['melee', 'ranged'],
  cleave: ['melee', 'ranged', 'delays'],
  elixir: ['heals', 'empowers', 'weakens', 'single'],
  // A dash moves him, so no second target (Forked) since 2026-10-31.
  swiftStrike: ['melee'],
  omen: ['single'],
  eclipse: ['delays', 'hastens'],
  stomp: ['melee'],
  longshot: ['ranged', 'delays', 'single'],
  blessing: ['heals', 'single'],
  invocation: ['heals', 'ranged'],
  axeThrow: ['melee', 'ranged', 'single'],
  leap: ['melee'],
  charge: ['melee'],
  reave: ['melee', 'ranged'],
  lunge: ['melee'],
};

/** The traits a generic upgrade needs one of to do anything (19.9). */
const NEEDS: Partial<Record<PassiveId, Trait[]>> = {
  forceful: ['melee', 'ranged'],
  concussive1: ['melee', 'ranged'],
  concussive2: ['melee', 'ranged'],
  concussive3: ['melee', 'ranged'],
  sundering: ['melee', 'ranged'],
  crippling: ['melee', 'ranged'],
  // Of use on a kit that reaches allies: on an enemy each is a gift.
  empowering: ['heals', 'empowers', 'hastens'],
  hastening: ['heals', 'empowers', 'hastens'],
  sheltering: ['heals', 'empowers', 'hastens'],
  forked: ['single'],
};

/** Whether the generic upgrade `id` can work on `hero`'s kit (`TRAITS`); any passive can. */
export function fitsKit(hero: HeroId, id: PassiveId): boolean {
  const needs = NEEDS[id];
  if (!needs) return true;
  const has = HEROES[hero].abilities.flatMap((a) => TRAITS[a] ?? []);
  return needs.some((t) => has.includes(t));
}

/** The rarities, strongest first, for the rival's draft. */
export const RARITY_ORDER: Rarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common'];

/**
 * How well the passive or upgrade `id` suits `hero`, lower the better: a
 * passive that supplements it most (`DRAFT_FIT`, 0 to 5); an upgrade its kit
 * can use, the rarest (strongest) first (50s); the other passives, in the
 * pool's order (100s); those that do it no good, and upgrades its kit can't
 * use (500s); one its hero already starts with (the Magus's Steady Gait),
 * 1000. Under 500, it does the hero some good.
 */
export function fitRank(hero: HeroId, id: PassiveId): number {
  const fit = DRAFT_FIT[hero];
  if ((HEROES[hero].passives ?? []).includes(id)) return 1000;
  const like = fit?.likes.indexOf(id) ?? -1;
  if (like >= 0) return like;
  const pool = Object.keys(PASSIVES).indexOf(id);
  const def = PASSIVES[id];
  if (def.kind === 'upgrade')
    return fitsKit(hero, id) ? 50 + RARITY_ORDER.indexOf(def.rarity!) : 500 + pool;
  return (fit?.useless.includes(id) ? 500 : 100) + pool;
}

/** The passive or upgrade of `open` that suits `hero` best (`fitRank`). */
export function draftPick(hero: HeroId, open: readonly PassiveId[]): PassiveId {
  return [...open].sort((a, b) => fitRank(hero, a) - fitRank(hero, b))[0]!;
}
