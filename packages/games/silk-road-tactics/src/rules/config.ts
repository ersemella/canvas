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
  /**
   * Action cost a hero must spend before its ultimate unlocks (10.10):
   * every turn's cost counts, moves included, but not a Hold without a move
   * (owner, 2026-10-20; was 3 turns, which a few cheap moves met: over 200
   * AI-vs-AI fights it unlocked around slot 20 for the Outrider and
   * Champion, 32 for the Storm Caller, with first damage at 14 and the end
   * at 83). At 300, all three unlock around slot 38 and are first used at
   * 37 to 50. Cost spent per slot is fixed for a given speed, so this is
   * time spent acting. Over 300 fights, 7.7% were unfinished at 400 actions
   * (3.3% with 3 turns; 6.3% at 250, 5.7% at 200): later ultimates mean less
   * finishing damage, which a rule for stalled fights would settle.
   */
  ultimateCharge: 300,
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
  abilities: AbilityId[];
  /** The camel has none. */
  ultimate?: AbilityId;
  /** Hexes a move may cover, before Slowed; RULES.movementCap if unset. */
  moveCap?: number;
  /** A move's whole cost, in place of RULES.moveActionCost plus RULES.moveCostPerHex a hex. */
  moveCost?: number;
  /** Its card starts the fight first, whatever its speed (the camel). */
  actsFirst?: boolean;
}

/**
 * PLACEHOLDER stats, from the roster's bands, except that the Outrider and
 * the Storm Caller both have 360 health (owner, 2026-10-20; were 300 and
 * 420, and the Outrider died first in nearly every fight): health Low 300 / Medium 420 /
 * High 540 (High about 1.8× Low, 9.1). Speed, defence and power share one
 * scale, Low 10 / Medium 25 / High 40 (owner, 2026-10-20), so a hero's
 * bands read straight off its numbers; RULES.C, RULES.speedScale and
 * RULES.defenceConstant compensate (speed was Medium 4, High 7; defence
 * Low 5, Medium 10). No gear in Phase 1 (owner, 2026-10-20): these base
 * stats are a unit's stats. The starter armour, light (+10 defence) on the
 * Outrider and medium (+20 defence, −5 speed) on the others, was removed.
 */
export const HEROES: Record<HeroId, HeroStats> = {
  bokh: {
    name: 'Bökh Champion',
    letter: 'B',
    health: 540,
    speed: 25,
    defence: 25,
    power: 10,
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
    abilities: ['bow', 'leap', 'volley', 'hold'],
    ultimate: 'volley',
  },
  storm: {
    name: 'Yadachy Storm Caller',
    letter: 'S',
    health: 360,
    speed: 25,
    defence: 25,
    power: 25,
    abilities: ['sunlight', 'hail', 'freeze', 'hold'],
    ultimate: 'freeze',
  },
  /**
   * The caravan's camel (owner, 2026-10-21; camel.md): it can't attack, and
   * moves one hex a turn at a typical action's cost, so it advances very
   * slowly. Very high health (owner) and defence High (owner, 2026-10-21;
   * was 0). Health 1,500 and speed Low are PLACEHOLDERS.
   */
  camel: {
    name: 'Caravan Camel',
    letter: 'C',
    health: 1500,
    speed: 10,
    defence: 40,
    power: 0,
    abilities: ['hold'],
    moveCap: 1,
    moveCost: RULES.cost.typical,
    // Despite its speed, it acts first in every fight (owner, 2026-10-21).
    actsFirst: true,
  },
};

/** Ability values. Costs follow the brief; everything else is PLACEHOLDER. */
export const ABILITY = {
  /**
   * Cheaper than a quick action (owner, 2026-10-19; was 60), so waiting a few slots
   * to react is a real option. Ordinary movement instead costs
   * RULES.moveActionCost plus RULES.moveCostPerHex for each hex. Holding without moving doesn't count
   * toward the ultimate's charge (see `countsTowardUltimate`).
   */
  hold: {cost: 30},
  /**
   * No range limit (owner, 2026-10-20; was 5): the arrow flies until it
   * hits a unit, ruins or the map's edge.
   */
  bow: {cost: RULES.cost.typical, range: Infinity, damage: 120},
  /**
   * Leap replaced Dash (owner, 2026-10-21): exactly 2 hexes in a straight
   * line, over whatever is in the hex between (ruins, a unit of either
   * side, quicksand, hail), landing on a free walkable hex. Dash moved up
   * to 3 in a line, stopped by ruins and enemies, at cost 40, too close to
   * walking. Cost 20, a slot for the Outrider: over 400 AI-vs-AI fights a
   * side without it won 40.3% (Dash: 45.1%); at 30 (2 slots) 48.8%, at 40
   * 50.8% (balance.md).
   */
  leap: {cost: 20},
  /**
   * Ultimates buffed (owner, 2026-10-20; damage was 135). Charge 20 and
   * recovery 60 (owner, 2026-10-20; were 40 and 100): at 140 in all its
   * targets stepped out cheaply and a side without it won 57% of AI-vs-AI
   * fights; at 80, 48% (docs/plans/roguelike-tactics/balance.md).
   */
  volley: {range: 5, radius: 1, damage: 200, chargeCost: 20, recoveryCost: 60},
  /**
   * Heal 40, 60 at the Storm Caller's power (owner, 2026-10-19; was 25,
   * 37 healed, under a fifth of a bow hit). Over 1,000 AI-vs-AI fights from
   * random deployments: no stalls (17 at 25), and fights shorter.
   * One unit within `range` (owner, 2026-10-20; was everyone within 1 of
   * the caster, which under separate movement took a turn to set up), and
   * heal 50, 75 at its power (owner, 2026-10-20). Over 200 AI-vs-AI fights
   * each, 5.5% were unfinished at 400 actions at 50, 12% at 60.
   * Quick, heal 35 (owner, 2026-10-20; was typical, heal 50): over 300
   * AI-vs-AI fights, 3% unfinished either way, Sunlight chosen on 17% of
   * the Storm Caller's turns (9% before); quick at heal 50 took over (33%,
   * six times the healing).
   * Heal 50, 75 at its power (owner, 2026-10-20; was 35): at 35 a side
   * without it won 51% of AI-vs-AI fights, at 50 41%, with 2.5%
   * unfinished once the AI stopped spamming fog (balance.md).
   * It also clears hail from the target's own hex (owner,
   * 2026-10-21; abilities.ts): an answer to hail, as Clear the Storm was.
   */
  sunlight: {cost: RULES.cost.quick, range: 4, heal: 50},
  /**
   * No Vulnerable (owner, 2026-10-20; was 25%), leaving it to Freeze and
   * flanking: damage and Slowed make it area denial. Over 300 AI-vs-AI
   * fights, 6% unfinished (4% with it); without its damage, 19%.
   */
  hail: {
    cost: RULES.cost.typical,
    range: 4,
    damage: 50,
    hexSlots: 20,
    slowed: 2,
    statusSlots: 10,
  },
  /**
   * Ultimates buffed (owner, 2026-10-20): it now deals damage (none
   * before), for 20 slots (was 15), Vulnerable 50% (was 25%). Charge 20 and
   * recovery 60, as Volley's (owner, 2026-10-20; were 40 and 100).
   * Instant, typical cost (owner, 2026-10-20; was charged): its targets
   * stepped out of the charge, and a side without it won 52% of AI-vs-AI
   * fights; instant, 48.7% (balance.md).
   */
  freeze: {
    cost: RULES.cost.typical,
    range: 4,
    radius: 1,
    damage: 60,
    immobilizedSlots: 20,
    vulnerable: 50,
  },
  throw: {cost: RULES.cost.typical, damage: 80},
  /**
   * The target is also Crushed, taking base `damagePerSlot` every slot while
   * pinned, scaled by power, through Vulnerable and defence (owner,
   * 2026-10-19; lowered from 8 to 6, 2026-10-20), and Taunted by the
   * Champion (17.5). No Vulnerable (owner, 2026-10-20; was 25%): over 300
   * AI-vs-AI fights, the same 4% unfinished, Pin on 16% of the Champion's
   * turns (22% with it). The Champion isn't Immobilized itself (owner,
   * 2026-10-20; it was): the pin holds while the two stay adjacent, so the
   * Champion moving away releases the target, as a wrestler would. Over
   * 400 AI-vs-AI fights a side without Pin then won 44.8% (about 50%
   * with the Champion held too). It may step one hex first, to a free hex
   * next to the target, at the same cost (owner, 2026-10-21): a side
   * without the step won 47.0% (52.8% at cost 120).
   */
  pin: {cost: RULES.cost.typical, slots: 12, damagePerSlot: 6},
  /** Ultimates buffed (owner, 2026-10-20; was slow, 150, and damage 100). */
  rampage: {cost: RULES.cost.typical, distance: 3, damage: 160, displace: 1},
} as const;

/** Enemy AI scoring (brief section 6); tuning placeholders from the brief. */
export const AI = {
  kill: 300,
  flankedTarget: 100,
  breaksAllyFlank: 50,
  perSlowed: 40,
  /**
   * Not in the brief: Vulnerable, Immobilized and Obscured are priced in
   * damage, not flat points (owner, 2026-10-20; were 2 per % of Vulnerable
   * whatever its duration, 2 per slot Immobilized, and flat fog values),
   * from each side's pressure: its units' best basic hit over the slots a
   * typical turn takes (ai.ts). Vulnerable is worth its share of the
   * pressure on the unit, split across its side's living units, over the
   * slots it lasts, at most `statusHorizon`. Immobilized is worth this
   * share of the unit's own pressure over the slots it lasts: a ranged or
   * area attacker still attacks where it stands, a melee one mostly can't.
   * Obscured is worth the ranged hits it stops on the unit until the
   * unit can move away. Flat weights made fog a trap (39% of the
   * Storm Caller's turns; a side without it won 74% of AI-vs-AI fights)
   * and valued Freeze's Vulnerable the same for 1 slot as for 20
   * (docs/plans/roguelike-tactics/balance.md).
   */
  statusHorizon: 20,
  immobilizedShare: {ranged: 0.1, melee: 0.4},
  /** Not in the brief: per point of damage a Crushed status will still deal. */
  perCrushDamage: 1,
  /** Not in the brief: per slot a unit stays Taunted. */
  perTauntedSlot: 2,
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
  caution: {bokh: 0, mangudai: 1, storm: 1, camel: 0} as Record<HeroId, number>,
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
   * Not in the brief: the caravan's camel (camel.md). Its health is worth
   * this much a point (a hero's is worth 1, plus `kill`; the camel's death
   * is a victory, so it has no kill value), and each hex it stands from an
   * exit is worth `perCamelHex` to the enemy. PLACEHOLDERS.
   */
  camelHealthWeight: 1,
  perCamelHex: 60,
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
/** The player's camel, after the party in slot order; the enemy has none (camel.md). */
export const CAMEL: HeroId = 'camel';

/** Experimental overrides are used only by the headless balance runner. */
export function movementRules(state: FightState) {
  return state.experiment ?? RULES;
}
