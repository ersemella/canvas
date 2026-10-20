/**
 * Every Phase 1 number, in one place so play-testing can change them
 * without touching rules code (docs/plans/roguelike-tactics/phase-1-brief.md).
 *
 * Rule values come from the brief's section 2. Hero stats and ability
 * values marked PLACEHOLDER are the owner's to set (brief section 4); they
 * are guesses from the roster's relative bands, only so a fight can be
 * played.
 */
import type {AbilityId, FightState, HeroId} from './types';

export const RULES = {
  /**
   * Track (3.2, 3.4): slotsForward = floor(cost × speedScale / (speed + C)).
   * Speed reads on the same Low 10 / Medium 25 / High 40 scale as power
   * and defence (owner, 2026-10-20). Each speed is the old one × 5 + 5
   * and C the old 6 × 5 − 5, so speed + C is 5 times the old sum and
   * every placement is unchanged.
   */
  C: 25,
  speedScale: 5,
  /**
   * Starting slots (3.4) use a typical action's cost, so the opening order
   * is spaced by speed like any later turn (owner, 2026-10-19; was 50,
   * which bunched every card into slots 3 to 8).
   */
  startCost: 100,
  /** Ordinary walking is a separate action; all units block its path. */
  blockAllUnits: true,
  separateMovement: true,
  moveActionCost: 20,
  moveCostPerHex: 10,
  cost: {typical: 100, quick: 60, slow: 150},
  /**
   * Ordinary walking cap (5.1); Slowed lowers it, to at least 1.
   * Restored to 4 on 2026-10-20 now that movement is a separate action.
   */
  movementCap: 4,
  /** Turns a hero must complete before its ultimate unlocks (10.10). */
  ultimateUnlockTurns: 3,
  /**
   * Damage reduction = defence / (defence + defenceConstant) (9.1). 50
   * since defence moved to the shared stat scale (owner, 2026-10-20; was
   * 20, with every defence 2.5 times smaller), so every hit is unchanged.
   */
  defenceConstant: 50,
  minimumDamage: 1,
  /**
   * Quicksand: every slot a unit stands on it, whoever's turn it is
   * (owner, 2026-10-19; was 40 at the start of each of the unit's own
   * turns, ~4 a slot for a Medium-speed hero's typical turn). Defence applies
   * to it, and to entering it (owner, 2026-10-19); then both were doubled
   * to 8 and 80 (owner, 2026-10-20).
   */
  hazardDamage: 8,
  /** Quicksand: on entering it, passing through included, so crossing it still costs. */
  hazardEnterDamage: 80,
  /**
   * Obscured (a sandstorm or fog hex): ranged hits on a unit standing in
   * one deal this much less, and so do ranged hits by one; both when both
   * are, so a quarter. Sandstorm worked as fog does from 2026-10-20 (owner;
   * it only weakened hits on its occupant before).
   */
  obscuredReduction: 0.5,
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

/**
 * Starter armour (fixed in Phase 1): defence it adds, speed it costs.
 * PLACEHOLDER values (were 3 and 8 defence, 0 and 1 speed, before the
 * shared stat scale; light armour's 10 also absorbs Low defence going from
 * 12.5 to 10, so the Outrider's total reduction is unchanged).
 */
export const ARMOUR = {
  light: {defence: 10, speed: 0},
  medium: {defence: 20, speed: 5},
} as const;

/**
 * PLACEHOLDER stats, from the roster's bands, except that the Outrider and
 * the Storm Caller both have 360 health (owner, 2026-10-20; were 300 and
 * 420, and the Outrider died first in nearly every fight): health Low 300 / Medium 420 /
 * High 540 (High about 1.8× Low, 9.1). Speed, defence and power share one
 * scale, Low 10 / Medium 25 / High 40 (owner, 2026-10-20), so a hero's
 * bands read straight off its numbers; RULES.C, RULES.speedScale and
 * RULES.defenceConstant compensate, leaving every fight number as it was
 * (speed was Medium 4, High 7; defence Low 5, Medium 10).
 */
export const HEROES: Record<HeroId, HeroStats> = {
  bokh: {
    name: 'Bökh Champion',
    letter: 'B',
    health: 540,
    speed: 25,
    defence: 25,
    power: 10,
    armour: 'medium',
    abilities: ['throw', 'pin', 'rampage', 'hold'],
    ultimate: 'rampage',
  },
  mangudai: {
    name: 'Mangudai Outrider',
    letter: 'M',
    health: 360,
    speed: 40,
    defence: 10,
    power: 40,
    armour: 'light',
    abilities: ['bow', 'dash', 'volley', 'hold'],
    ultimate: 'volley',
  },
  storm: {
    name: 'Yadachy Storm Caller',
    letter: 'S',
    health: 360,
    speed: 25,
    defence: 25,
    power: 25,
    armour: 'medium',
    abilities: ['sunlight', 'hail', 'fog', 'freeze', 'hold'],
    ultimate: 'freeze',
  },
};

/** Ability values. Costs follow the brief; everything else is PLACEHOLDER. */
export const ABILITY = {
  /**
   * Cheaper than a quick action (owner, 2026-10-19; was 60), so waiting a few slots
   * to react is a real option. Ordinary movement instead costs
   * RULES.moveActionCost plus RULES.moveCostPerHex for each hex. Holding without moving doesn't count
   * toward the ultimate (see `countsTowardUltimate`).
   */
  hold: {cost: 30},
  bow: {cost: RULES.cost.typical, range: 5, damage: 120},
  /**
   * Up to `distance` hexes (owner, 2026-10-19; was exactly 3, which on this
   * board often had no free hex to end on: chosen on 5% of the Outrider's
   * turns in AI-vs-AI fights, 17% with "up to"). Restored to 3 on
   * 2026-10-20 with separate movement (briefly 2 when walking was capped at 3).
   * Cost 40 (owner, 2026-10-20; was quick, 60): at 60 it cost more than
   * walking the same 3 hexes (50), so it was all but unused.
   */
  dash: {cost: 40, distance: 3},
  /** Ultimates buffed (owner, 2026-10-20; damage was 135). */
  volley: {range: 5, radius: 1, damage: 200, chargeCost: 40, recoveryCost: RULES.cost.typical},
  /**
   * Heal 40, 60 at the Storm Caller's power (owner, 2026-10-19; was 25,
   * 37 healed, under a fifth of a bow hit). Over 1,000 AI-vs-AI fights from
   * random deployments: no stalls (17 at 25), and fights shorter.
   * One unit within `range` (owner, 2026-10-20; was everyone within 1 of
   * the caster, which under separate movement took a turn to set up), and
   * heal 50, 75 at its power (owner, 2026-10-20). Over 200 AI-vs-AI fights
   * each, 5.5% were unfinished at 400 actions at 50, 12% at 60.
   */
  sunlight: {cost: RULES.cost.typical, range: 4, heal: 50},
  hail: {
    cost: RULES.cost.typical,
    range: 4,
    damage: 50,
    hexSlots: 20,
    slowed: 2,
    vulnerable: 25,
    statusSlots: 10,
  },
  /** Replaced Gale (owner, 2026-10-20). Its hexes are Obscured (`RULES.obscuredReduction`). */
  fog: {cost: RULES.cost.typical, range: 4, radius: 1, slots: 20},
  /**
   * Ultimates buffed (owner, 2026-10-20): it now deals damage (none
   * before), for 20 slots (was 15), Vulnerable 50% (was 25%).
   */
  freeze: {
    range: 4,
    radius: 1,
    damage: 60,
    immobilizedSlots: 20,
    vulnerable: 50,
    chargeCost: 40,
    recoveryCost: RULES.cost.typical,
  },
  throw: {cost: RULES.cost.typical, damage: 80},
  /**
   * The target is also Crushed, taking base `damagePerSlot` every slot while
   * pinned, scaled by power, through Vulnerable and defence (owner,
   * 2026-10-19; lowered from 8 to 6, 2026-10-20), and Taunted by the
   * Champion (17.5).
   */
  pin: {cost: RULES.cost.typical, slots: 12, vulnerable: 25, damagePerSlot: 6},
  /** Ultimates buffed (owner, 2026-10-20; was slow, 150, and damage 100). */
  rampage: {cost: RULES.cost.typical, distance: 3, damage: 160, displace: 1},
} as const;

/** Enemy AI scoring (brief section 6); tuning placeholders from the brief. */
export const AI = {
  kill: 300,
  flankedTarget: 100,
  breaksAllyFlank: 50,
  perSlowed: 40,
  perImmobilizedSlot: 2,
  perVulnerablePercent: 2,
  /** Not in the brief: per point of damage a Crushed status will still deal. */
  perCrushDamage: 1,
  /** Not in the brief: per slot a unit stays Taunted. */
  perTauntedSlot: 2,
  /**
   * Not in the brief: fog has no immediate effect to score, so the AI
   * values each unit it newly Obscures, and every unit standing Obscured
   * (fog or sandstorm) when it looks ahead. Shielding: this divided by the unit's
   * max health (the frailest matter most), when the other side has a
   * ranged attacker. Blinding: a flat value per ranged attacker covered.
   * For the shielded side or against the blinded one; the other way for
   * the opposite side.
   */
  /**
   * Not in the brief: the AI's one step of lookahead (threat.ts). Minus
   * this × the damage the enemies acting within the next typical turn could
   * deal the unit where it ends × the share of its health that is, and this
   * share of `kill` if it would die. Without it the AI walked into an
   * archer's reach, and on speed ties the side that moved first lost 60-67%
   * of AI-vs-AI fights; with it, 49-51%.
   */
  threatFactor: 1,
  /**
   * Per hero, how much the threat counts. The Bökh Champion's is 0: a tank's
   * job is to take hits, and at 1 it Held on 44% of its turns to stay out of
   * reach (14% before the lookahead, 20% with it at 0).
   */
  caution: {bokh: 0, mangudai: 1, storm: 1} as Record<HeroId, number>,
  fogShield: 72_000,
  fogBlind: 300,
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
   * Not in the brief: the AI scores a Hold's time as if it cost this much,
   * not its real cost. Scoring one turn at a time, it took the cheap Hold's
   * saved slots at face value with no plan for using them: at 30 it Held on
   * 54% of its turns and 9 in 300 AI-vs-AI fights stalled (9% and none
   * when Hold cost 60).
   */
  holdScoringCost: 60,
  /**
   * Deterministic work caps shared across all AI turns in a request.
   * An action simulation, charged preview, or automatic timeline card
   * spends one unit. Exhaustion uses a legal Hold, with no extra search.
   * Counts are calibrated locally; production CPU still needs monitoring.
   */
  maxSimulations: 110,
  requestSimulations: 220,
  rootSimulations: 48,
  replySimulations: 8,
  searchWidth: 4,
  /** Includes the root action: try two decisions, then three if work remains. */
  searchDepth: 3,
  victory: 1_000_000,
} as const;

/** The party, in party slot order, for both sides in Phase 1 (brief section 5). */
export const PARTY: HeroId[] = ['bokh', 'mangudai', 'storm'];

/** Experimental overrides are used only by the headless balance runner. */
export function movementRules(state: FightState) {
  return state.experiment ?? RULES;
}
