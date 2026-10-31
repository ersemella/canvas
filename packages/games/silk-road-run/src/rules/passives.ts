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
import {ARMOURED, DEVOTED, FURY, HEROES, ONE_EYE, RULES, SPEARHEAD, UPGRADE} from './config';
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

/** The pool, in 19.8's order. */
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
    'The first time each fight it is at half its health or less, its card is Hastened 2.',
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
    'After a turn in which it takes a unit off the board, its card is Hastened 1.',
    'common'
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
    'Can’t be Pushed, Pulled, Immobilized or Stunned, so it can’t be grappled and hail doesn’t stop its walk.'
  ),
  lightStep: def(
    'lightStep',
    'Light Step',
    'board',
    'Walks through allies, and may end its walk swapping places with an ally.',
    'uncommon'
  ),
  rebound: def(
    'rebound',
    'Rebound',
    'board',
    'When it is Pushed, Pulled or Moved, each unit next to where it ends, allies included, is Pushed 1 away from it.',
    'common'
  ),
  hardened: def(
    'hardened',
    'Hardened',
    'damage',
    'Armour 1 against the first hit it takes each fight.',
    'uncommon'
  ),
  lastStand: def(
    'lastStand',
    'Last Stand',
    'damage',
    `The first time each fight it would fall, it is left at 1 health instead, Delayed ${RULES.durations.stun}.`,
    'rare'
  ),
  piercingEye: def(
    'piercingEye',
    'Piercing Eye',
    'damage',
    'Its attacks Pierce against a unit that is Immobilized or Stunned.',
    'common'
  ),
  opportunist: def(
    'opportunist',
    'Opportunist',
    'damage',
    'Its attacks deal 1 more to a unit whose card is behind its own next card, or off the track.',
    'rare'
  ),
  bulwark: def(
    'bulwark',
    'Bulwark',
    'damage',
    `When an ally next to it takes its first hit in ${RULES.durations.turn} slots, the ally takes 1 less and this unit takes that 1.`,
    'common'
  ),
  glassCannon: def(
    'glassCannon',
    'Glass Cannon',
    'damage',
    'Empower 1 always, but starts each fight at half its health.',
    'epic'
  ),
  ironWill: def(
    'ironWill',
    'Iron Will',
    'control',
    'The first time each fight it would be Stunned, it isn’t.',
    'common'
  ),
  shakeLoose: def(
    'shakeLoose',
    'Shake Loose',
    'control',
    'When it takes damage while Stunned, the Stun ends.',
    'common'
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
  rally: def(
    'rally',
    'Rally',
    'allies',
    `At the start of its turn, each ally next to it gains Shield 1 for ${RULES.durations.turn} slots.`,
    'uncommon'
  ),
  vengeance: def(
    'vengeance',
    'Vengeance',
    'allies',
    `When an ally falls, its card is Hastened 3 and it is Empowered 1 for ${RULES.durations.turn} slots.`,
    'common'
  ),
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
  wearying: upgrade(
    'wearying',
    'Wearying',
    'track',
    `When its ability Delays an enemy, the enemy is also Weakened ${UPGRADE.wearying.weaken}.`,
    'common'
  ),
  lethargy: upgrade(
    'lethargy',
    'Lethargy',
    'track',
    `When its ability Weakens an enemy, the enemy is also Delayed ${UPGRADE.lethargy.delay}.`,
    'rare'
  ),
  inspire: upgrade(
    'inspire',
    'Inspire',
    'track',
    `When its ability Empowers an ally, the ally is also Hastened ${UPGRADE.inspire.haste}.`,
    'uncommon'
  ),
  fervour: upgrade(
    'fervour',
    'Fervour',
    'track',
    `When its ability Hastens an ally, the ally is also Empowered ${UPGRADE.fervour.empower}.`,
    'common'
  ),
  forceful: upgrade(
    'forceful',
    'Forceful',
    'board',
    `Its attacks Push the target ${UPGRADE.forceful.push}; not one that already Pushes.`,
    'uncommon'
  ),
  reelIn: upgrade(
    'reelIn',
    'Reel In',
    'board',
    `Its ranged attacks Pull the target ${UPGRADE.reelIn.pull}. With Forceful, the target stays put.`,
    'common'
  ),
  staggering: upgrade(
    'staggering',
    'Staggering',
    'attacks',
    `Its attacks Delay the target ${UPGRADE.staggering.delay}.`,
    'epic'
  ),
  hamstring: upgrade(
    'hamstring',
    'Hamstring',
    'attacks',
    `Its attacks Immobilize the target for ${RULES.durations.turn} slots.`,
    'epic'
  ),
  concussive: upgrade(
    'concussive',
    'Concussive',
    'attacks',
    `Its attacks Delay the target ${RULES.durations.stun}.`,
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
  lockdown: upgrade(
    'lockdown',
    'Lockdown',
    'control',
    `When its ability Immobilizes a unit, the unit is also Delayed ${RULES.durations.stun}.`,
    'rare'
  ),
  defyFate: upgrade(
    'defyFate',
    'Defy Fate',
    'control',
    `Its attacks Delay an Inevitable target ${RULES.durations.stun}, though Inevitable.`,
    'common'
  ),
  immovableObject: upgrade(
    'immovableObject',
    'Immovable Object',
    'control',
    `Its attacks Delay an Unstoppable target ${UPGRADE.immovableObject.delay}.`,
    'common'
  ),
  invigorate: upgrade(
    'invigorate',
    'Invigorate',
    'healing',
    `When its ability heals an ally, the ally is also Empowered ${UPGRADE.invigorate.empower}.`,
    'common'
  ),
  quickening: upgrade(
    'quickening',
    'Quickening',
    'healing',
    `When its ability heals an ally, the ally is also Hastened ${UPGRADE.quickening.haste}.`,
    'uncommon'
  ),
  fortify: upgrade(
    'fortify',
    'Fortify',
    'healing',
    `When its ability heals an ally, the ally also gains Armour ${UPGRADE.fortify.armour} for ${RULES.durations.turn} slots.`,
    'uncommon'
  ),
  ward: upgrade(
    'ward',
    'Ward',
    'healing',
    `When its ability heals an ally, the ally also gains Shield ${UPGRADE.ward.shield} for ${RULES.durations.turn} slots.`,
    'common'
  ),
  mendingStrike: upgrade(
    'mendingStrike',
    'Mending Strike',
    'healing',
    'Its melee attacks heal an ally they hit its power, Empower and Weaken counted, instead of hurting it.',
    'common'
  ),
  mendingShot: upgrade(
    'mendingShot',
    'Mending Shot',
    'healing',
    'Its ranged attacks heal an ally they hit its power, Empower and Weaken counted, instead of hurting it.',
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
 * Passives a hero starts with that the caravanserai doesn't offer:
 * Unstoppable, the Juggernaut's (owner, 2026-10-27), One Eye, the
 * Cyclops's, Devoted, the Bull Demon King's and Princess Iron Fan's (owner,
 * 2026-10-28), Armoured, the Cataphract's (owner, 2026-10-29), the
 * Serpent King and Regrow, Zahhak's and his serpents' (2026-10-29), and
 * Spearhead, the Vanguard's from 2026-10-30 to 2026-10-31 (owner), aren't
 * in 19.8's pool.
 */
export const NOT_OFFERED: readonly PassiveId[] = [
  'unstoppable',
  'oneEye',
  'devoted',
  'armoured',
  'serpentKing',
  'regrow',
  'spearhead',
  'fury',
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
 * tank wants to hold the line (Bulwark, Rally), a fast striker to keep
 * its tempo (Momentum, Opportunist), a frail support to survive (Last
 * Stand, Hardened); nothing that undoes its kit (Steady Gait on the
 * Duelist, whose Swift Strike Hastens it) or that it already has the
 * effect of (Rooted or Iron Will on the Unstoppable Juggernaut).
 */
export const DRAFT_FIT: Partial<Record<HeroId, {likes: PassiveId[]; useless: PassiveId[]}>> = {
  youxia: {
    likes: ['momentum', 'opportunist', 'flanker', 'lastStand', 'secondWind', 'hardened'],
    useless: ['steadyGait', 'loneWolf', 'patient'],
  },
  modao: {
    likes: ['bulwark', 'rally', 'hardened', 'ironWill', 'rooted', 'secondWind'],
    useless: ['glassCannon', 'loneWolf', 'lightStep'],
  },
  alchemist: {
    likes: ['lastStand', 'hardened', 'lightStep', 'secondWind', 'ironWill', 'rally'],
    useless: ['glassCannon', 'loneWolf', 'piercingEye', 'flanker'],
  },
  archer: {
    likes: ['loneWolf', 'opportunist', 'glassCannon', 'lastStand', 'hardened', 'momentum'],
    useless: ['piercingEye', 'bulwark', 'rally', 'flanker'],
  },
  mahout: {
    likes: ['rally', 'bulwark', 'hardened', 'momentum', 'secondWind', 'opportunist'],
    useless: ['rooted', 'ironWill', 'shakeLoose', 'loneWolf', 'lightStep'],
  },
  magus: {
    likes: ['lastStand', 'hardened', 'lightStep', 'ironWill', 'rebound', 'secondWind'],
    useless: ['glassCannon', 'opportunist', 'flanker', 'piercingEye', 'momentum', 'loneWolf'],
  },
  varangian: {
    likes: ['opportunist', 'momentum', 'flanker', 'secondWind', 'hardened', 'lastStand'],
    useless: ['loneWolf', 'patient'],
  },
  cataphract: {
    likes: ['bulwark', 'hardened', 'momentum', 'rally', 'ironWill', 'rebound'],
    useless: ['lightStep', 'loneWolf', 'glassCannon', 'patient'],
  },
  priest: {
    likes: ['lastStand', 'hardened', 'ironWill', 'lightStep', 'secondWind', 'rally'],
    useless: ['glassCannon', 'opportunist', 'flanker', 'piercingEye', 'momentum', 'loneWolf'],
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
  stomp: ['melee'],
  longshot: ['ranged', 'delays', 'single'],
  blessing: ['heals', 'single'],
  invocation: ['heals', 'ranged'],
  axeThrow: ['melee', 'ranged', 'single'],
  leap: ['melee'],
  charge: ['melee'],
  reave: ['melee', 'ranged'],
  wadeIn: ['melee'],
};

/** The traits a generic upgrade needs one of to do anything (19.9). */
const NEEDS: Partial<Record<PassiveId, Trait[]>> = {
  wearying: ['delays'],
  lethargy: ['weakens'],
  inspire: ['empowers'],
  fervour: ['hastens'],
  forceful: ['melee', 'ranged'],
  reelIn: ['ranged'],
  staggering: ['melee', 'ranged'],
  hamstring: ['melee', 'ranged'],
  concussive: ['melee', 'ranged'],
  sundering: ['melee', 'ranged'],
  crippling: ['melee', 'ranged'],
  lockdown: ['immobilizes'],
  defyFate: ['melee', 'ranged'],
  immovableObject: ['melee', 'ranged'],
  invigorate: ['heals'],
  quickening: ['heals'],
  fortify: ['heals'],
  ward: ['heals'],
  mendingStrike: ['melee'],
  mendingShot: ['ranged'],
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
