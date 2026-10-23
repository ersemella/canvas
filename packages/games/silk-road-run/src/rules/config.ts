/**
 * Every rule number, in one place so play-testing can change them without
 * touching rules code (docs/plans/roguelike-tactics/phase-1-brief.md).
 *
 * Stats and kits were redefined by the owner on 2026-10-23
 * (heroes-and-gear.md, 9.1; roster.md): speed, defence and power are
 * small whole numbers; health is (1 + defence) × 2; every ability deals
 * exactly its user's power in damage. Values marked PLACEHOLDER are the
 * builder's, for units the owner hasn't set.
 */
import type {AbilityId, HeroId} from './types';

export const RULES = {
  /**
   * Action cost (timeline.md, 3.2; owner, 2026-10-23): after each turn, a
   * unit's card goes `actionBase` − `speedSlots` × speed slots on, Temee's
   * included, whatever the turn did.
   */
  actionBase: 12,
  speedSlots: 2,
  /** Temee's starting slot (3.4), after every other unit's starting card. */
  camelStartSlot: 12,
  /** Ordinary walking cap (5.1): 3 since 2026-10-22 (owner). */
  movementCap: 3,
  /** Size of the track window the page shows (open question 1). */
  trackWindow: 30,
} as const;

/** Health from defence (owner, 2026-10-23): (1 + defence) × 2. */
export function healthOf(defence: number): number {
  return (1 + defence) * 2;
}

export interface HeroStats {
  name: string;
  /** One letter for the board's circles. */
  letter: string;
  /** Sets the card's action cost (3.2) and starting slot (3.4). */
  speed: number;
  /** Sets health (`healthOf`). */
  defence: number;
  /** The damage each of its abilities deals. */
  power: number;
  abilities: AbilityId[];
  /** Spaces a move may cover; RULES.movementCap if unset. */
  moveCap?: number;
  /** Its card starts the fight last, at RULES.camelStartSlot, whatever its speed (the camel). */
  actsLast?: boolean;
  /**
   * Not player controlled: on each of its turns it steps along the shortest
   * walk to the exit, around ruins and units (`stepToExit` in board.ts)
   * (the camel).
   */
  walksRoad?: boolean;
}

/**
 * The owner's numbers (2026-10-23) for the three prototype heroes; the
 * camel's and the wolf's are PLACEHOLDERS on the same scale. No gear in
 * Phase 1 (owner, 2026-10-20): these are a unit's stats.
 */
export const HEROES: Record<HeroId, HeroStats> = {
  bokh: {
    name: 'Bökh Champion',
    letter: 'B',
    speed: 2,
    defence: 3,
    power: 1,
    abilities: ['grapple', 'throw', 'hold'],
  },
  mangudai: {
    name: 'Mangudai Outrider',
    letter: 'M',
    speed: 3,
    defence: 1,
    power: 2,
    // Volley in place of Overwatch (owner, 2026-10-23), to measure it.
    abilities: ['bow', 'volley', 'hold'],
  },
  storm: {
    name: 'Yadachy Storm Caller',
    letter: 'S',
    speed: 2,
    defence: 2,
    // 1 since 2026-10-23 (owner; balance.md): at 0 Hail dealt nothing and
    // couldn't break a grapple.
    power: 1,
    // Fog in place of Sunlight (owner, 2026-10-23), to measure it.
    abilities: ['hail', 'fog', 'hold'],
  },
  /**
   * The caravan's camel (owner, 2026-10-21; camel.md): it can't attack, and
   * walks itself one space a turn along the shortest road from the top-left
   * corner to the exit in the bottom-right, around units in its way (owner,
   * 2026-10-22). It acts last in the starting order, at slot 12 (owner,
   * 2026-10-23). Defence 9 (health 20, ten bow hits) is a PLACEHOLDER for
   * the owner's "very high health". Speed 0, so an action cost of 12
   * (owner, 2026-10-23).
   */
  camel: {
    // Temee (owner, 2026-10-21): a name, so no "Your" before it (unitName).
    name: 'Temee',
    letter: 'T',
    speed: 0,
    defence: 9,
    power: 0,
    abilities: ['hold'],
    moveCap: 1,
    walksRoad: true,
    actsLast: true,
  },
  /**
   * An enemy NPC (owner, 2026-10-21): one attack, Bite. Speed 2, defence 1
   * (health 4), power 1 are PLACEHOLDERS on the 2026-10-23 scale.
   */
  wolf: {
    name: 'Wolf',
    letter: 'W',
    speed: 2,
    defence: 1,
    power: 1,
    abilities: ['bite', 'hold'],
  },
};

/** Each ability's shape. Damage is never listed: it is the user's power. */
export const ABILITY = {
  /**
   * Six straight lanes with no range limit (owner, 2026-10-20): the arrow
   * flies until it hits a unit, ruins or the map's edge. `minRange` 2
   * keeps it off an adjacent unit, which still stops the arrow (a variant
   * measured against it).
   */
  bow: {range: Infinity, minRange: 1},
  /**
   * One space, its centre within 3 (owner, 2026-10-23; was a radius-1 area
   * with damage and a track Push). It stays until its caster's next turn;
   * a unit in the space when it lands, or that enters it, is Immobilized
   * until it disappears.
   */
  hail: {range: 3},
  /**
   * One space within 3, resolving at once (owner, 2026-10-23): a unit there
   * is healed this much, never past its health, and cleansed of every
   * status; hail there melts.
   */
  sunlight: {range: 3, heal: 1},
  /**
   * Arrows from above (owner, 2026-10-23): one space within 3, no line of
   * fire needed, as hail falls; the unit there takes the Outrider's power.
   * `minRange` 2 keeps it off adjacent units; `less` takes that much off its
   * damage (variants measured against it).
   */
  volley: {range: 3, minRange: 1, less: 0},
  /**
   * One space within 3, until the Storm Caller's next turn (owner,
   * 2026-10-23): a unit standing in it is Degraded by this much (its
   * abilities deal that much less, at least 0). `radius` 1 is the owner's
   * first proposal (the space and its neighbours), measured against it.
   */
  fog: {range: 3, radius: 0, degrade: 1},
  /**
   * The bow's lane, held until the Outrider's next turn (owner,
   * 2026-10-23). `everyUnit`: false, the first unit to enter it is shot and
   * the overwatch ends; true, each unit entering it is shot, once each,
   * until the Outrider's next turn. `stopsWalk`: the shot ends a walk where
   * it lands, as hail does.
   */
  overwatch: {everyUnit: false, stopsWalk: false},
  /**
   * Each of the Champion's turns that a grapple lasts, its target takes
   * this (owner, 2026-10-23), on top of the grapple's first hit.
   */
  grapple: {squeeze: 1},
} as const;

/** Enemy AI scoring (brief section 6), on the 2026-10-23 health scale (a hit is 1 or 2). */
export const AI = {
  /** On top of the health taken. */
  kill: 4,
  /**
   * Immobilized is worth this share of the unit's own best hit, a ranged
   * or area attacker still attacking where it stands, a melee one mostly
   * not; Stunned is worth the whole hit, a turn lost.
   */
  immobilizedShare: {ranged: 0.1, melee: 0.4},
  stunnedShare: 1,
  /**
   * The AI's one step of lookahead (threat.ts): minus this × the damage the
   * enemies acting before its next turn could deal the unit where it ends
   * × the share of its health that is, and this share of `kill` if it
   * would die. Without it the AI walked into an archer's reach.
   */
  threatFactor: 1,
  /**
   * Per hero, how much the threat counts. The Bökh Champion's is 0: a
   * tank's job is to take hits, and at 1 it held back out of reach.
   */
  caution: {bokh: 0, mangudai: 1, storm: 1, camel: 0, wolf: 1} as Record<HeroId, number>,
  friendlyDamageFactor: 1.5,
  /**
   * Minus this per space between the unit and what it closes in on after
   * its turn (for the enemy, Temee once no hero is in its reach; otherwise
   * the nearest enemy), so an AI with nothing in reach closes in instead of holding
   * forever; small next to any hit.
   */
  perHexFromEnemy: 0.2,
  /**
   * The caravan's camel (camel.md): its health is worth this much a point,
   * and each space it stands from the exit is worth `perCamelHex` to the
   * enemy. A hero's or wolf's point is worth 1, plus `kill` when it falls:
   * at most 2 a point spread over its health (a wolf's or the Outrider's 4).
   * Temee's death is the enemy's victory, so it has no kill value; at 2 a
   * point, a hit on it is never worth less than the same hit's share of
   * any other unit, and only a finishing blow outranks it. PLACEHOLDERS;
   * 2 since 2026-10-23 (was 1).
   */
  camelHealthWeight: 2,
  perCamelHex: 0.75,
  /**
   * Deterministic work caps shared across all AI turns in a request.
   * An action simulation or automatic timeline card spends one unit.
   * Exhaustion uses a legal Hold, with no extra search.
   */
  maxSimulations: 110,
  requestSimulations: 220,
  /**
   * What each AI turn in a request still gets once the request's budget is
   * spent: enough for a greedy pick, no lookahead. With only Holds, a
   * Champion grappling the last hero beside a wolf on the exit stalled the
   * fight for good (2026-10-23, on the 8 × 8 board).
   */
  turnFloorSimulations: 48,
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
/** Every hero the start menu offers and the enemy draws from, in party slot order. */
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
