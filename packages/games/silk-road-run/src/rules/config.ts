/**
 * Every Phase 1 number, in one place so play-testing can change them
 * without touching rules code (docs/plans/roguelike-tactics/phase-1-brief.md).
 *
 * Rule values come from the brief's section 2. Hero stats and ability
 * values marked PLACEHOLDER are the owner's to set (brief section 4); they
 * are guesses from the roster's relative bands, only so a fight can be
 * played.
 */
import type {AbilityId, FightState, HeroId, PassiveId} from './types';

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
   * Restored to 4 on 2026-10-20 now that movement is a separate action;
   * 3 since 2026-10-22 (owner).
   */
  movementCap: 3,
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
  /**
   * Push limit (3.6): the most a card can be pushed later, yielding
   * included, between two of its own turns. PLACEHOLDER: the docs' default.
   */
  pushLimit: 10,
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
  /** An always-on trait (roster.md, Passives): the Vanguard's Hold the Line, the Champion's Inevitable. */
  passive?: PassiveId;
  /**
   * Not player controlled: on each of its turns it steps along the
   * shortest walk to the exit, around ruins and units (`stepToExit` in
   * board.ts), then its card goes this many slots on (the camel).
   */
  routeSlots?: number;
}

/**
 * PLACEHOLDER stats, from the roster's bands: health Low 300 / Medium 420 /
 * High 540 (High about 1.8× Low, 9.1). The Outrider and the Storm Caller
 * are back on their tiers, 300 and 420 (owner, 2026-10-21; both were 360
 * from 2026-10-20, when the Outrider died first in nearly every fight).
 * Over 400 AI-vs-AI fights, a side with 300/420 against 360/360 won 47.5%;
 * with both on it the Outrider survived 21.9% of fights (26.8%) and the
 * Storm Caller 49.4% (44.3%). Bow kills are unchanged (2 and 3 hits);
 * Volley now kills the Outrider in one hit (300 after defence).
 * Speed, defence and power share one scale, Low 10 / Medium 25 / High 40
 * (owner, 2026-10-20), so a hero's bands read straight off its numbers; RULES.C, RULES.speedScale and
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
    // Pared back to its basics for balancing (owner, 2026-10-22): the
    // ultimate, Lunge, is out of the kit. Throw is back in place of Shove
    // (owner, 2026-10-22), landing only beside the Champion.
    abilities: ['grapple', 'throw', 'hold'],
    // The counter to hail's Push (owner, 2026-10-22, playtest).
    passive: 'inevitable',
  },
  mangudai: {
    name: 'Mangudai Outrider',
    letter: 'M',
    health: 300,
    speed: 40,
    defence: 10,
    power: 40,
    // Pared back for balancing (owner, 2026-10-22): Leap and the ultimate, Volley, are out.
    abilities: ['bow', 'hold'],
  },
  storm: {
    name: 'Yadachy Storm Caller',
    letter: 'S',
    health: 420,
    speed: 25,
    defence: 25,
    power: 25,
    // Pared back for balancing (owner, 2026-10-22): Sunlight and the ultimate, Freeze, are out.
    abilities: ['hail', 'hold'],
  },
  /**
   * The Modao Vanguard (roster.md, 15.8; owner, 2026-10-22): health Medium,
   * speed Low, defence High, power Medium. A tank that taunts, guards
   * itself with Barrier and pushes enemies back on the track. Tuned by
   * scripts/balance/experiments/modao*.mjs (balance.md).
   */
  modao: {
    name: 'Modao Vanguard',
    letter: 'V',
    health: 420,
    speed: 10,
    defence: 40,
    power: 25,
    abilities: ['reap', 'challenge', 'advance', 'hold'],
    ultimate: 'advance',
    passive: 'holdTheLine',
  },
  /**
   * The caravan's camel (owner, 2026-10-21; camel.md): it can't attack.
   * Very high health (owner) and defence High (owner, 2026-10-21; was 0).
   * Health 1,500 and speed Low are PLACEHOLDERS. Not player controlled
   * (owner, 2026-10-22): it walks itself along the fixed shortest road from
   * the top-left corner to the exit in the bottom-right, one space every
   * 14 slots, walking around units in its way (owner, 2026-10-22).
   */
  camel: {
    // Temee (owner, 2026-10-21): a name, so no "Your" before it (unitName).
    name: 'Temee',
    letter: 'T',
    health: 1500,
    speed: 10,
    defence: 40,
    power: 0,
    abilities: ['hold'],
    moveCap: 1,
    moveCost: RULES.cost.typical,
    routeSlots: 14,
    // Despite its speed, it acts first in every fight (owner, 2026-10-21).
    actsFirst: true,
  },
  /**
   * An enemy NPC (owner, 2026-10-21): power Medium, speed Medium, health
   * Low, defence Low; one attack, Bite, and no ultimate.
   */
  wolf: {
    name: 'Wolf',
    letter: 'W',
    health: 300,
    speed: 25,
    defence: 10,
    power: 25,
    abilities: ['bite', 'hold'],
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
   * No cleanse (owner, 2026-10-22, playtest): nothing frees a unit the
   * Bökh Champion grapples.
   */
  sunlight: {cost: RULES.cost.quick, range: 4, heal: 50},
  /**
   * Track control in an area (owner, 2026-10-22, playtest; was one hex,
   * range 4, 20 slots, damage 40 and Slowed 2): every unit in it when it
   * lands takes `damage` and is Pushed `castPush`, allies too. Pared back
   * for balancing (owner, 2026-10-22): centre within 3 (was 6), Push 5.
   * It stays on the ground `hexSlots` (owner, 2026-10-22), and a unit that
   * starts its turn in it takes `turnDamage` (it Pushed 2 before). Damage
   * values and duration are PLACEHOLDERS.
   */
  hail: {
    cost: RULES.cost.typical,
    range: 3,
    radius: 1,
    castPush: 5,
    damage: 40,
    hexSlots: 20,
    turnDamage: 20,
  },
  /**
   * Ultimates buffed (owner, 2026-10-20): it now deals damage (none
   * before), for 20 slots (was 15), Vulnerable 50% (was 25%). Charge 20 and
   * recovery 60, as Volley's (owner, 2026-10-20; were 40 and 100).
   * Instant, typical cost (owner, 2026-10-20; was charged): its targets
   * stepped out of the charge, and a side without it won 52% of AI-vs-AI
   * fights; instant, 48.7% (balance.md). Damage 120 (owner, 2026-10-22; was
   * 60, when a side without it won 48%; 43% at 120).
   */
  freeze: {
    cost: RULES.cost.typical,
    range: 4,
    radius: 1,
    damage: 120,
    immobilizedSlots: 20,
    vulnerable: 50,
  },
  /**
   * Only the unit the Champion is grappling (owner, 2026-10-22, playtest):
   * to another free space next to the Champion, keeping the grapple, or
   * one space straight back, ending it. Damage 120 (was 80, on anyone
   * adjacent): it is the Champion's only damage outside Lunge.
   */
  /**
   * Only the unit the Champion pins, to a free space next to the Champion,
   * so the grapple holds (owner, 2026-10-22; one space straight back,
   * ending it, was allowed too). Damage 120.
   */
  throw: {cost: RULES.cost.typical, damage: 120},
  /**
   * A unit within `range`: the Champion steps in next to it first if it
   * isn't already, then it takes `damage` and is pinned: Immobilized, and
   * nothing else, for `slots`, while the two stay adjacent; one target at
   * a time, a new grapple releasing the last (owner, 2026-10-22, pared back
   * for balancing; was melee, no damage, Immobilized, Vulnerable 25% and
   * Pinned, its abilities reaching only hexes next to it). The Champion
   * isn't held itself: moving away releases the target, as a wrestler
   * would. Damage PLACEHOLDER.
   */
  grapple: {cost: RULES.cost.typical, range: 2, slots: 12, damage: 60},
  /**
   * Melee, only on the unit the Champion is pinning (owner, 2026-10-22):
   * Displace it `displace` away, which breaks the grapple. Out of the kit,
   * replaced by Throw (owner, 2026-10-22).
   */
  shove: {cost: RULES.cost.typical, displace: 1},
  /**
   * The Bökh Champion's ultimate (owner, 2026-10-22; replaced Rampage,
   * typical cost, 3 hexes, damage 160, Displace 1): a unit within `reach`,
   * after a bound of up to `reach - 1` hexes, takes `damage` and is grappled
   * as by Grapple. Over 400 AI-vs-AI fights a side without Rampage won 44.8%;
   * without a Lunge of reach 3, no damage and Vulnerable 50%, 46.4%; of
   * reach 2 with damage 100, 44.9%. As built, with Grapple melee only at
   * Crushed 10: 46.3% without Lunge, 44.9% without Grapple (balance.md).
   */
  lunge: {cost: RULES.cost.typical, reach: 3, damage: 100},
  /**
   * The Modao Vanguard's kit (owner, 2026-10-22, for playtesting; the
   * measurements are in balance.md). Challenge: Taunt one unit within
   * `range`, and a fresh Barrier on the Vanguard, replacing any it has.
   * Quick, so at Low speed (8 slots) the taunt outlasts the Vanguard's next
   * turn; the Barrier lasts 6 slots, short of it (was 16: refreshed every
   * turn, it was cast on 57% of the Vanguard's turns and absorbed about 600
   * damage a fight, and 7% of AI-vs-AI mirror fights went unfinished).
   * Barrier 40 (owner, 2026-10-22, playtest; was 80): it takes a hit whole
   * whatever its size, so its value only sets how many small hits it eats.
   */
  challenge: {cost: RULES.cost.quick, range: 3, tauntSlots: 14, barrier: 40, barrierSlots: 6},
  /**
   * A cone in one of six directions: the hex next to the Vanguard and the
   * three behind it, through every unit in it, ruins stopping it: damage,
   * then Push (owner, 2026-10-22, playtest: Push 3, was 2; the straight line
   * of 2 it replaced was hard to land, and a sweep over the three hexes
   * next to it before that was used on 2–13% of its turns while it spent
   * 40–78% walking).
   */
  reap: {cost: RULES.cost.typical, damage: 70, push: 3},
  /**
   * A charge of up to `steps` hexes in a straight line over free ground (or
   * none), then every adjacent unit takes damage, is displaced 1 away and
   * pushed (owner, 2026-10-22, playtest: with no step it rarely had anyone
   * next to it). Instant (owner, 2026-10-22; was charged, charge 20,
   * recovery 60: its targets stepped out of it, and a side without it won
   * 50% of AI-vs-AI mirror fights; instant, 45%).
   */
  advance: {cost: RULES.cost.typical, steps: 3, radius: 1, damage: 160, displace: 1, push: 4},
  /** The wolf's one attack (owner, 2026-10-21). Damage PLACEHOLDER: 150 at its power. */
  bite: {cost: RULES.cost.typical, damage: 100},
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
  /**
   * Not in the brief: Pinned is worth this share of the unit's own
   * pressure over the slots it lasts; a melee unit loses nothing to it.
   * PLACEHOLDER (2026-10-22).
   */
  pinnedShare: {ranged: 0.6, melee: 0},
  /** Not in the brief: per point of damage a Crushed status will still deal. */
  perCrushDamage: 1,
  /** Not in the brief: per slot a unit stays Taunted. */
  perTauntedSlot: 2,
  /**
   * Not in the brief: a pushed card is worth the damage its unit doesn't
   * deal meanwhile, its rate × the slots pushed, times this (balance.md,
   * principle 11).
   */
  pushShare: 1,
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
  caution: {bokh: 0, mangudai: 1, storm: 1, modao: 0, camel: 0, wolf: 1} as Record<HeroId, number>,
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

/**
 * The default party, in party slot order (brief section 5): the three
 * prototype heroes. A party has at most this many heroes.
 */
export const PARTY: HeroId[] = ['bokh', 'mangudai', 'storm'];
/**
 * Every hero the start menu offers and the enemy draws from, in party slot
 * order: the prototype heroes. The Modao Vanguard (2026-10-22) is left out
 * for now (owner, 2026-10-22), while the game is pared back for balancing;
 * its kit is still in the rules.
 */
export const ROSTER: HeroId[] = [...PARTY];
/**
 * A run's stages, in order (owner, 2026-10-21): how many of the heroes
 * (ROSTER), picked at random from the run's seed, and how many wolves the
 * enemy brings to each. The last is won to win the run.
 */
export const STAGES: {heroes: number; wolves: number}[] = [
  {heroes: 1, wolves: 2},
  {heroes: 2, wolves: 1},
  {heroes: 3, wolves: 0},
];
/** The player's camel, after the party in slot order; the enemy has none (camel.md). */
export const CAMEL: HeroId = 'camel';

/** Experimental overrides are used only by the headless balance runner. */
export function movementRules(state: FightState) {
  return state.experiment ?? RULES;
}
