/**
 * Every Phase 1 number, in one place so play-testing can change them
 * without touching rules code (docs/plans/roguelike-tactics/phase-1-brief.md).
 *
 * Rule values come from the brief's section 2. Hero stats and ability
 * values marked PLACEHOLDER are the owner's to set (brief section 4); they
 * are guesses from the roster's relative bands, only so a fight can be
 * played.
 */
import type {AbilityId, HeroId} from './types';

export const RULES = {
  /** Track (3.2, 3.4): slotsForward = floor(cost / (speed + C)). */
  C: 6,
  startCost: 50,
  moveCostPerHex: 10,
  cost: {typical: 100, quick: 60, slow: 150},
  /** Hexes per turn (5.1); Slowed lowers it, to at least 1. */
  movementCap: 4,
  /** Turns a hero must complete before its ultimate unlocks (10.10). */
  ultimateUnlockTurns: 3,
  /** Damage reduction = defence / (defence + defenceConstant) (9.1). */
  defenceConstant: 20,
  minimumDamage: 1,
  /** Quicksand: on entering and at the start of each turn on it. */
  hazardDamage: 40,
  /** Sandstorm: ranged attacks against its occupant deal this much less. */
  concealReduction: 0.5,
  /** A flanked unit is Vulnerable this much while flanked (6.3). */
  flankVulnerable: 25,
  /** Displace stopped early: to the displaced unit and to a unit it hits. */
  collisionDamage: 20,
  /** Size of the track window the page shows (open question 1). */
  trackWindow: 30,
} as const;

export interface HeroStats {
  name: string;
  /** One letter for the board's circles. */
  letter: string;
  health: number;
  speed: number;
  defence: number;
  power: number;
  armour: 'light' | 'medium';
  abilities: AbilityId[];
  ultimate: AbilityId;
}

/** Starter armour (fixed in Phase 1): defence it adds, speed it costs. PLACEHOLDER values. */
export const ARMOUR = {
  light: {defence: 3, speed: 0},
  medium: {defence: 8, speed: 1},
} as const;

/**
 * PLACEHOLDER stats, from the roster's bands: health Low 300 / Medium 420 /
 * High 540 (High about 1.8× Low, 9.1); speed Medium 4, High 7; defence Low
 * 5, Medium 10; power Low 10, Medium 25, High 40.
 */
export const HEROES: Record<HeroId, HeroStats> = {
  bokh: {
    name: 'Bökh Champion',
    letter: 'B',
    health: 540,
    speed: 4,
    defence: 10,
    power: 10,
    armour: 'medium',
    abilities: ['throw', 'pin', 'rampage', 'hold'],
    ultimate: 'rampage',
  },
  mangudai: {
    name: 'Mangudai Outrider',
    letter: 'M',
    health: 300,
    speed: 7,
    defence: 5,
    power: 40,
    armour: 'light',
    abilities: ['bow', 'dash', 'volley', 'hold'],
    ultimate: 'volley',
  },
  storm: {
    name: 'Yadachy Storm Caller',
    letter: 'S',
    health: 420,
    speed: 4,
    defence: 10,
    power: 25,
    armour: 'medium',
    abilities: ['clearStorm', 'hail', 'gale', 'freeze', 'hold'],
    ultimate: 'freeze',
  },
};

/** Ability values. Costs follow the brief; everything else is PLACEHOLDER. */
export const ABILITY = {
  hold: {cost: RULES.cost.quick},
  bow: {cost: RULES.cost.typical, range: 5, damage: 80},
  dash: {cost: RULES.cost.quick, distance: 3},
  volley: {range: 5, radius: 1, damage: 90, chargeCost: 40, recoveryCost: RULES.cost.typical},
  clearStorm: {cost: RULES.cost.typical, radius: 1, heal: 25},
  hail: {cost: RULES.cost.typical, range: 4, hexSlots: 20, slowed: 2, vulnerable: 25, statusSlots: 10},
  gale: {cost: RULES.cost.typical, displace: 1, slowed: 1, slowedSlots: 10},
  freeze: {range: 4, radius: 1, immobilizedSlots: 15, vulnerable: 25, chargeCost: 40, recoveryCost: RULES.cost.typical},
  throw: {cost: RULES.cost.typical, damage: 80},
  pin: {cost: RULES.cost.typical, slots: 12, vulnerable: 25},
  rampage: {cost: RULES.cost.slow, distance: 3, damage: 100, displace: 1},
} as const;

/** Enemy AI scoring (brief section 6); tuning placeholders from the brief. */
export const AI = {
  kill: 300,
  flankedTarget: 100,
  breaksAllyFlank: 50,
  perSlowed: 40,
  perImmobilizedSlot: 2,
  perVulnerablePercent: 2,
  friendlyDamageFactor: 1.5,
  perSlotMoved: 10,
  /**
   * Not in the brief: minus this per hex between the unit and the nearest
   * enemy after its turn, so an AI with nothing in reach closes in instead
   * of holding forever. Worth more than the ~1 slot (−10) a hex of
   * movement costs, small next to any real effect.
   */
  perHexFromEnemy: 15,
  /**
   * The search cap, counted in simulated options (a few hundredths of a ms
   * each), nearest moves first, so a request stays within the Free plan's
   * 10 ms of CPU. A count, not a time limit, so fights stay deterministic.
   * One AI turn tries at most `maxSimulations`; all the AI turns in one
   * request share `requestSimulations`, but each gets at least
   * `minSimulations`.
   */
  maxSimulations: 150,
  requestSimulations: 300,
  minSimulations: 40,
} as const;

/** The party, in party slot order, for both sides in Phase 1 (brief section 5). */
export const PARTY: HeroId[] = ['bokh', 'mangudai', 'storm'];
