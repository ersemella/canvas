/**
 * The passives (progression.md, 19.8; owner, 2026-10-24): hero-agnostic
 * rules, each working on whichever unit carries it ("this hero"), in the
 * keywords' terms (keywords.md). Their effects are woven into the rules
 * where each bends one: damage (`hit`, `applyDamage` in resolve.ts), the
 * track (`haste`, `delay`, the card's placement in fight.ts), walking
 * (`reachableHexes` in board.ts) and statuses (`stun`). No hero carries
 * one yet: the test stage gives them (`Loadout.passives`), and the
 * caravanserai between regions drafts them (19.3a): the party's two picks,
 * the rival's two (`draftPick`).
 */
import {ARMOURED, DEVOTED, HEROES, ONE_EYE} from './config';
import type {HeroId, PassiveId, Unit} from './types';

export type PassiveGroup = 'track' | 'board' | 'damage' | 'control' | 'allies';

export interface PassiveDef {
  id: PassiveId;
  name: string;
  group: PassiveGroup;
  /** The rule, for the stat sheet (D11: every passive is public). */
  rule: string;
}

const def = (id: PassiveId, name: string, group: PassiveGroup, rule: string): PassiveDef => ({
  id,
  name,
  group,
  rule,
});

/** The pool, in 19.8's order. */
export const PASSIVES: Record<PassiveId, PassiveDef> = {
  steadyGait: def(
    'steadyGait',
    'Steady Gait',
    'track',
    'Inevitable: its card can’t be Delayed or Hastened.'
  ),
  secondWind: def(
    'secondWind',
    'Second Wind',
    'track',
    'The first time each fight it is at half its health or less, its card is Hastened 2.'
  ),
  patient: def(
    'patient',
    'Patient',
    'track',
    'A turn it ends without moving or using an ability, its card goes 2 fewer slots on.'
  ),
  momentum: def(
    'momentum',
    'Momentum',
    'track',
    'After a turn in which it takes a unit off the board, its card is Hastened 1.'
  ),
  rooted: def(
    'rooted',
    'Rooted',
    'board',
    'Can’t be Pushed or Pulled. Can still be Immobilized and Moved.'
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
    'Walks through allies, and may end its walk swapping places with an ally.'
  ),
  rebound: def(
    'rebound',
    'Rebound',
    'board',
    'When it is Pushed, Pulled or Moved, each unit next to where it ends, allies included, is Pushed 1 away from it.'
  ),
  hardened: def(
    'hardened',
    'Hardened',
    'damage',
    'Armour 1 against the first hit it takes each fight.'
  ),
  lastStand: def(
    'lastStand',
    'Last Stand',
    'damage',
    'The first time each fight it would fall, it is left at 1 health instead, Stunned for its next turn.'
  ),
  piercingEye: def(
    'piercingEye',
    'Piercing Eye',
    'damage',
    'Its attacks Pierce against a unit that is Immobilized or Stunned.'
  ),
  opportunist: def(
    'opportunist',
    'Opportunist',
    'damage',
    'Its attacks deal 1 more to a unit that hasn’t had a turn since its own last turn.'
  ),
  bulwark: def(
    'bulwark',
    'Bulwark',
    'damage',
    'When an ally next to it takes its first hit between this unit’s turns, the ally takes 1 less and this unit takes that 1.'
  ),
  glassCannon: def(
    'glassCannon',
    'Glass Cannon',
    'damage',
    'Empower 1 always, but starts each fight at half its health.'
  ),
  ironWill: def(
    'ironWill',
    'Iron Will',
    'control',
    'The first time each fight it would be Stunned, it isn’t.'
  ),
  shakeLoose: def(
    'shakeLoose',
    'Shake Loose',
    'control',
    'When it takes damage while Stunned, the Stun ends.'
  ),
  flanker: def(
    'flanker',
    'Flanker',
    'allies',
    'Its attacks deal 1 more when an ally stands on the far side of the target, opposite it.'
  ),
  loneWolf: def('loneWolf', 'Lone Wolf', 'allies', 'Empower 1 while no ally is within 2 spaces.'),
  rally: def(
    'rally',
    'Rally',
    'allies',
    'At the start of its turn, each ally next to it gains Shield 1 until that ally’s next turn.'
  ),
  vengeance: def(
    'vengeance',
    'Vengeance',
    'allies',
    'When an ally falls, its card is Hastened 3 and it is Empowered 1 for its next turn.'
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
};

/**
 * Passives a hero starts with that the caravanserai doesn't offer:
 * Unstoppable, the Juggernaut's (owner, 2026-10-27), One Eye, the
 * Cyclops's, Devoted, the Bull Demon King's and Princess Iron Fan's (owner,
 * 2026-10-28), Armoured, the Cataphract's (owner, 2026-10-29), and the
 * Serpent King and Regrow, Zahhak's and his serpents' (2026-10-29), aren't
 * in 19.8's pool.
 */
export const NOT_OFFERED: readonly PassiveId[] = [
  'unstoppable',
  'oneEye',
  'devoted',
  'armoured',
  'serpentKing',
  'regrow',
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
 * How the rival drafts at the caravanserai between regions (progression.md,
 * 19.3a; owner, 2026-10-28): for the hero it drafts for, the passives
 * that supplement it most, best first (`likes`), and those that do it
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
 * The rival's pick for `hero` from the passives still open: the one that
 * supplements it most (`DRAFT_FIT`), one its hero already starts with
 * (the Magus's Steady Gait) last of all; the first open without a fit.
 */
export function draftPick(hero: HeroId, open: readonly PassiveId[]): PassiveId {
  const fit = DRAFT_FIT[hero];
  const own = HEROES[hero].passives ?? [];
  const rank = (id: PassiveId) => {
    if (own.includes(id)) return 1000;
    const like = fit?.likes.indexOf(id) ?? -1;
    if (like >= 0) return like;
    const pool = Object.keys(PASSIVES).indexOf(id);
    return (fit?.useless.includes(id) ? 500 : 100) + pool;
  };
  return [...open].sort((a, b) => rank(a) - rank(b))[0]!;
}
