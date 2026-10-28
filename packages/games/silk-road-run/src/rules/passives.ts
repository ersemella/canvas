/**
 * The passives (progression.md, 19.8; owner, 2026-10-24): hero-agnostic
 * rules, each working on whichever unit carries it ("this hero"), in the
 * keywords' terms (keywords.md). Their effects are woven into the rules
 * where each bends one: damage (`hit`, `applyDamage` in resolve.ts), the
 * track (`haste`, `delay`, the card's placement in fight.ts), walking
 * (`reachableHexes` in board.ts) and statuses (`stun`). No hero carries
 * one yet: the test stage gives them (`Loadout.passives`), and an upgrade
 * offer's passive slot (19.3) will.
 */
import type {PassiveId, Unit} from './types';

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
};

/**
 * Passives a hero starts with that the caravanserai doesn't offer:
 * Unstoppable, the Juggernaut's (owner, 2026-10-27), isn't in 19.8's
 * pool.
 */
export const NOT_OFFERED: readonly PassiveId[] = ['unstoppable'];

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
