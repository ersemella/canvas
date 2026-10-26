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
   * unit's card goes `actionBase` × `speedPivot` ÷ (speed + `speedPivot`)
   * slots on, rounded, Temee's included, whatever the turn did. Each point
   * of speed adds 1 ÷ `speedPivot` of Temee's turn rate: speed 10 acts 3×
   * as often as Temee.
   */
  actionBase: 12,
  speedPivot: 5,
  /** Temee's starting slot (3.4), after every other unit's starting card. */
  camelStartSlot: 12,
  /**
   * The most abilities a unit has besides moving and Hold (owner,
   * 2026-10-25; 3 from 2026-10-24): a hero with this many takes no new
   * one from an upgrade.
   */
  maxAbilities: 2,
  /**
   * Ordinary walking cap (5.1): 2 since 2026-10-24 (owner; 3 from
   * 2026-10-22). At 3 the side acting first won 64% of mirror matches; at
   * 2 about 49% (balance.md, "Walk 2 and the ring of hail").
   */
  movementCap: 2,
  /** The most any stat (speed, defence or power) can reach (owner, 2026-10-25). */
  statMax: 10,
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
  /**
   * Abilities it can earn as a hero upgrade during a run, not in its
   * starting kit (owner, 2026-10-24; progression.md, 19.3).
   */
  upgrades?: AbilityId[];
  /** Spaces a move may cover; RULES.movementCap if unset. */
  moveCap?: number;
  /**
   * Moves the way Longshot flies: any number of spaces straight along one of
   * the six directions, up to the first unit, yurts or the map's edge (the
   * Horse Archer; owner, 2026-10-25). Hail still ends the move where it enters.
   */
  movesStraight?: boolean;
  /** Its card starts the fight last, at RULES.camelStartSlot, whatever its speed (the camel). */
  actsLast?: boolean;
  /**
   * Not player controlled: on each of its turns it steps along the shortest
   * walk to the exit, around yurts and units (`stepToExit` in board.ts)
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
    name: 'Grappler',
    letter: 'G',
    speed: 2,
    defence: 3,
    power: 1,
    // Throw folded into Grapple (owner, 2026-10-24), which leaves room for
    // both upgrades.
    abilities: ['grapple', 'hold'],
    // Haul and Shove (owner, 2026-10-24; balance.md, "Second abilities
    // measured"): side without them wins 47.8% and 49.6%.
    upgrades: ['haul', 'shove'],
  },
  mangudai: {
    name: 'Horse Archer',
    letter: 'H',
    speed: 3,
    defence: 1,
    power: 2,
    abilities: ['longshot', 'hold'],
    movesStraight: true,
    // Skirmish in place of Volley (owner, 2026-10-23; balance.md), an
    // upgrade since 2026-10-24 (owner). Volley and Feigned Retreat
    // upgrades too (owner, 2026-10-24; balance.md, "Second abilities
    // measured"): side without them wins 41.1% and 42.5%.
    upgrades: ['skirmish', 'volley', 'feignedRetreat'],
  },
  storm: {
    name: 'Storm Caller',
    letter: 'S',
    speed: 2,
    defence: 2,
    // 1 since 2026-10-23 (owner; balance.md): at 0 Hail dealt nothing and
    // couldn't break a grapple.
    power: 1,
    abilities: ['hail', 'hold'],
    // Sunlight added (owner, 2026-10-23), as measured: a trap for the AI
    // at Empower 2 (balance.md); an upgrade since 2026-10-24 (owner). Gale
    // an upgrade too (owner, 2026-10-24; balance.md, "Second abilities
    // measured"): side without it wins 40.6%.
    upgrades: ['sunlight', 'gale'],
  },
  /**
   * The Vanguard (owner, 2026-10-25; roster.md): a slow tank with
   * reach. Its first kit (2026-10-22) was removed with action costs on
   * 2026-10-23 (history.md). Speed 1, defence 3 (health 8) and power 2 are
   * the builder's first numbers, untested.
   */
  modao: {
    name: 'Vanguard',
    letter: 'V',
    speed: 1,
    defence: 3,
    power: 2,
    abilities: ['cleave', 'hold'],
  },
  /**
   * The Alchemist (owner, 2026-10-25; roster.md): a support whose
   * Elixir, a burst next to it, Empowers allies 2 and Weakens enemies 1
   * (`ABILITY.elixir`). Speed 3 (owner, 2026-10-25; 2 before; balance.md,
   * "Elixir's shape and Cleave's Delay": the Storm Caller's equal in its
   * seat, 49.2% from 40.6%); power 0 (owner, 2026-10-26, with the burst: it
   * deals no damage; 1 from earlier that day, 2 before; balance.md, "Two
   * hails, hail on entry, and a melee Elixir"); defence 1 (health 4) the
   * builder's first number.
   */
  alchemist: {
    name: 'Alchemist',
    letter: 'A',
    speed: 3,
    defence: 1,
    power: 0,
    abilities: ['elixir', 'hold'],
  },
  /**
   * The Swordsman (owner, 2026-10-26; roster.md): China's fast
   * melee striker. Speed 3, power 2, defence 1 (health 4) and a walk of 3
   * are the owner's; Swift Strike, its sword stroke, Hastens it when it hits
   * (`ABILITY.swiftStrike`).
   */
  youxia: {
    name: 'Swordsman',
    letter: 'Y',
    speed: 3,
    defence: 1,
    power: 2,
    abilities: ['swiftStrike', 'hold'],
    moveCap: 3,
  },
  /**
   * The caravan's camel (owner, 2026-10-21; camel.md): it can't attack, and
   * walks itself one space a turn along the shortest road from the top-left
   * corner to the exit in the bottom-right, around units in its way (owner,
   * 2026-10-22). It acts last in the starting order, at slot 12 (owner,
   * 2026-10-23). Defence 9 (health 20, ten Longshot hits) is a PLACEHOLDER for
   * the owner's "very high health". Speed 0, so an action cost of 12
   * (owner, 2026-10-23).
   */
  camel: {
    // Humphrey (owner, 2026-10-26; Temee before, the Mongolian for camel):
    // a name, so no "Your" before it (unitName).
    name: 'Humphrey',
    letter: 'C',
    speed: 0,
    defence: 9,
    power: 0,
    abilities: ['hold'],
    moveCap: 1,
    walksRoad: true,
    actsLast: true,
  },
  /**
   * An enemy NPC (owner, 2026-10-21): one attack, Bite. Speed 1 (owner,
   * 2026-10-24; was 2). Defence 1 (health 4), power 1 are PLACEHOLDERS on
   * the 2026-10-23 scale.
   */
  wolf: {
    name: 'Grey Wolf',
    letter: 'W',
    speed: 1,
    defence: 1,
    power: 1,
    abilities: ['bite', 'hold'],
  },
  /**
   * The China region's basic creature (progression.md, 19.5, the reskins;
   * 2026-10-25): a one-tailed fox spirit, the huli jing, the wolf's unit
   * with its stats and Bite under the fox's name and art, until the
   * region's own numbers are set.
   */
  fox: {
    name: 'Fox Spirit',
    letter: 'F',
    speed: 1,
    defence: 1,
    power: 1,
    abilities: ['bite', 'hold'],
  },
};

/** Each ability's shape. Damage is never listed: it is the user's power. */
export const ABILITY = {
  /**
   * Six straight lanes with no range limit (owner, 2026-10-20): the arrow
   * flies until it hits a unit, a yurt or the map's edge.
   */
  longshot: {range: Infinity},
  /**
   * One space exactly `range` from the Storm Caller (owner, 2026-10-24: a
   * ring, so the spaces next to it and 3 or more away are safe; within 3
   * from 2026-10-23, and before that a radius-1 area with damage and a
   * track Push). It stays for `turns` of its caster's turns: it lifts as
   * the last of them starts (2, the turn after next, since 2026-10-25; 1,
   * the next turn, before). A unit in the space when it lands, or that
   * enters it, is Immobilized until it disappears.
   * `max`: how many of a caster's hails stand at once, a new one past it
   * replacing the oldest; each lifts on its own, freeing only whoever it
   * held. 2 (owner, 2026-10-26; 1, one hail a caster, before).
   * `entry`: a unit that enters hail (walking or Moved) takes its caster's
   * power (owner, 2026-10-26). Both as measured, changing little
   * (balance.md, "Two hails, hail on entry, and a melee Elixir").
   */
  hail: {range: 2, turns: 2, max: 2 as number, entry: true as boolean},
  /**
   * Sunlight (owner, 2026-10-23): a unit within `range` that hits (not
   * Temee), not already Empowered, is Empowered `empower` until the end of
   * its next turn. `self`: the Storm Caller may target itself. `melts`:
   * hail on the target's space melts, and a space of hail alone is a
   * target. Both on since the owner's call the same day (balance.md).
   */
  sunlight: {range: 3, empower: 2, self: true as boolean, melts: true as boolean},
  /**
   * Skirmish (owner, 2026-10-23, in place of Volley): one step to a free
   * space next to the Horse Archer, then Longshot's shot from there, charged:
   * the Horse Archer's card is pushed `charge` of its action cost on, rounded
   * (half: 4 slots for the Horse Archer's 8), greyed while it charges; when it
   * comes back the arrow flies down the lane it was aimed along and the
   * first unit in it then takes the Horse Archer's power, with no turn for the
   * Horse Archer, and its card goes its action cost on to its next turn. At 0
   * it shoots at once (measured: a better Longshot rather than a second
   * ability; balance.md).
   */
  skirmish: {charge: 0.5 as number},
  /**
   * Each of the Grappler's turns that a grapple lasts, its target takes
   * this (owner, 2026-10-23), on top of the grapple's first hit.
   */
  grapple: {
    squeeze: 1,
    /** Whether a Grappler's Empower adds to its squeeze: yes (owner, 2026-10-23; balance.md). */
    empoweredSqueeze: true,
  },
  /**
   * Cleave (owner, 2026-10-25): the Vanguard's line of `reach`
   * spaces straight up or down from it, stopped by yurts, or a cone to one
   * side, its two diagonal neighbours and the space straight across beyond
   * them (owner, 2026-10-26; board.ts, `cleaveAreas`); each unit in it,
   * ally or enemy, takes the Vanguard's power, and each
   * one still standing is Delayed `delay` slots (keywords.md 17.3): 8
   * (owner, 2026-10-26; 5 from 2026-10-25; balance.md, "The Vanguard's buffs other than speed": China
   * against the Steppe 52.5% with Swift Strike's Haste 3).
   */
  /**
   * `shape`, a switch for measuring (board.ts, `cleaveAreas`): `built` as
   * above; `lines`, a line of `reach` in each of the six directions (the
   * shape before 2026-10-26); `arcs`, three neighbours side by side, six
   * ways; `cones`, the built cone six ways.
   */
  cleave: {reach: 2, delay: 8 as number, shape: 'built' as 'built' | 'lines' | 'arcs' | 'cones'},
  /**
   * Elixir (owner, 2026-10-25; a burst since 2026-10-26, as measured in
   * balance.md, "Two hails, hail on entry, and a melee Elixir"): a space
   * within `range` (1: next to the Alchemist, or its own), no line of fire,
   * and every unit within `radius` of it that hits, either side: an ally
   * is Empowered `empower` (2), an enemy Weakened `weaken` (1), each until
   * the end of its next turn, a new one replacing the last. No hit and no
   * heal (`fixed` 0); the Alchemist's power is 0, so it never takes its own.
   * Earlier that day a unit within 2, the Alchemist itself too: an ally
   * healed the Alchemist's power and was Empowered 1, an enemy took a hit
   * and was Weakened 1 (`shape: 'unit'`, `range: 2`, `fixed: 1`, `heal:
   * 'all'`, power 1; balance.md, "Elixir fixed at 1, with a hit").
   * `shape`: `burst` as built; `unit`, the unit on a space within `range`;
   * `aura`, every unit within `radius` of the Alchemist, aimed at its own
   * space (switches for measuring; the page draws a burst's area and aims
   * a unit's, but not an aura's).
   * `fixed`, a switch for measuring: above 0 an enemy is also hit for the
   * Alchemist's power, and the Empower and Weaken default to it; 0 as built,
   * when they default to power.
   * `heal`, with `fixed`: an ally heals the Alchemist's power, `all` the
   * camel too, `heroes` not; off as built.
   * `tempo`, a switch for measuring: an ally is also Hastened, an enemy
   * Delayed, that many slots, so any unit can be aimed at; 0 as built.
   * `empower`, `weaken`: the Empower on an ally and the Weaken on an enemy
   * (2 and 1 as built); 0 falls back to `fixed`, then power.
   * `self`, a switch for measuring: whether the Alchemist takes its own
   * Elixir (true as built); off, a burst or aura passes it over and it
   * can't be aimed at itself.
   */
  elixir: {
    range: 1 as number,
    shape: 'burst' as 'unit' | 'burst' | 'aura',
    radius: 1 as number,
    fixed: 0 as number,
    heal: false as false | 'all' | 'heroes',
    tempo: 0 as number,
    empower: 2 as number,
    weaken: 1 as number,
    self: true as boolean,
  },
  /**
   * Swift Strike (owner, 2026-10-26; Ten Paces until renamed the same day),
   * the Swordsman's *jian*: melee, and when it hits, the Swordsman's card is Hastened `haste` slots (keywords.md
   * 17.3). 3 (owner, 2026-10-26; 2 the builder's first; balance.md, "The Vanguard's buffs other than speed").
   */
  swiftStrike: {haste: 3 as number},
  /**
   * Upgrades (owner, 2026-10-24; balance.md, "Second abilities measured"):
   * Shove (melee, Push), Haul (Pull the first unit in a lane within
   * `range`), Feigned Retreat (the Bow, then a walk of up to `steps`), Gale
   * (each unit next to a space within `range` hit and Pushed) and Volley (a
   * space within `range`, charged as Skirmish).
   */
  shove: {push: 2},
  haul: {range: 3, pull: 2},
  feignedRetreat: {steps: 2},
  gale: {range: 3, push: 1},
  volley: {range: 3, charge: 0.5 as number},
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
   * The share of an Empower's worth the AI counts (`empowerGain` in
   * ai.ts): its extra damage, and a kill it makes, happen only if its unit
   * gets to hit on its next turn. ½ (2026-10-23; balance.md): at 1
   * Sunlight was a trap, at ½ the Storm Caller Hails most.
   */
  empoweredShare: 0.5 as number,
  /**
   * The share of a grappled unit's status cost the AI takes off while an
   * ally could strike the Grappler holding it (`rescueGain` in ai.ts): the
   * hit, which breaks the grapple, comes only on that ally's next turn.
   */
  rescueShare: 0.5,
  /**
   * The AI's one step of lookahead (threat.ts): minus this × the damage the
   * enemies acting before its next turn could deal the unit where it ends
   * × the share of its health that is, and this share of `kill` if it
   * would die. Without it the AI walked into an archer's reach.
   */
  threatFactor: 1,
  /**
   * Per hero, how much the threat counts. The Grappler's is 0: a
   * tank's job is to take hits, and at 1 it held back out of reach; the
   * Vanguard's too, for the same reason (untested).
   */
  caution: {
    bokh: 0,
    mangudai: 1,
    storm: 1,
    modao: 0,
    alchemist: 1,
    youxia: 1,
    camel: 0,
    wolf: 1,
    fox: 1,
  } as Record<HeroId, number>,
  friendlyDamageFactor: 1.5,
  /**
   * A charged shot in the air on a unit that acts before it lands and can
   * walk is worth this share of the hit: it can step out. PLACEHOLDER.
   */
  dodgeShare: 0.25,
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
   * at most 2 a point spread over its health (a wolf's or the Horse Archer's 4).
   * Temee's death is the enemy's victory, so it has no kill value; at 2 a
   * point, a hit on it is never worth less than the same hit's share of
   * any other unit, and only a finishing blow outranks it. PLACEHOLDERS;
   * 2 since 2026-10-23 (was 1).
   */
  camelHealthWeight: 2,
  perCamelHex: 0.75,
  /**
   * Deterministic work cap for one AI turn, which has a request of its own
   * (owner, 2026-10-24; was 110 a turn and 220 shared by all of a
   * request's AI turns). An action simulation or automatic timeline card
   * spends one unit. Exhaustion uses a legal Hold, with no extra search.
   */
  maxSimulations: 220,
  rootSimulations: 48,
  /**
   * Turns played at each reply, best guess first (ai.ts, `orderedInputs`): with
   * the guess, 6 beat 8 (ai-search.md, "Searching smarter").
   */
  replySimulations: 6,
  /**
   * How many options a decision searches on, by its distance from the
   * root (the root first), the last for any deeper.
   */
  searchWidths: [4] as readonly number[],
  /** Includes the root action: try two decisions, then three if work remains. */
  searchDepth: 3,
  /**
   * The AI in the player's browser (owner, 2026-10-25,
   * docs/plans/client-side-runs.md): as deep as the device gets in
   * `thinkMs`, narrowing further from the root (ai-search.md, "Looking
   * deeper with narrower decisions"). `work` bounds the search's memory,
   * which keeps every fight it plays; `depth` is a ceiling that a fight's
   * end usually reaches first.
   */
  browser: {
    thinkMs: 400,
    widths: [4, 3, 2] as readonly number[],
    depth: 24,
    work: 24_000,
  },
  victory: 1_000_000,
} as const;

/**
 * The default party, in party slot order (brief section 5): the three
 * prototype heroes. A party has at most this many heroes.
 */
export const PARTY: HeroId[] = ['bokh', 'mangudai', 'storm'];
/** Every hero the start menu offers and the enemy draws from, in party slot order. */
export const ROSTER: HeroId[] = [...PARTY, 'modao', 'alchemist', 'youxia'];
/**
 * The regions a run passes through, in order (setting.md, 15.3a), so far
 * the two whose stages are built: each names its basic creature (the
 * wolf's unit reskinned, progression.md, 19.5) and the enemy hero of its
 * first stage, and so of every one of its stages.
 */
export type RegionId = 'steppe' | 'china';
export const REGIONS: Record<RegionId, {creature: HeroId; firstEnemy: HeroId}> = {
  steppe: {creature: 'wolf', firstEnemy: 'mangudai'},
  // The Swordsman, China's damage hero, as the Horse Archer is the Steppe's.
  china: {creature: 'fox', firstEnemy: 'youxia'},
};
/**
 * A run's stages, in order (owner, 2026-10-24; for a while four, from three
 * wolves), region by region: how many of the heroes (ROSTER) and how many
 * of its region's creatures the enemy brings to each. In a region the
 * heroes come in one order, its first enemy then the rest in a random order
 * from the run's seed, so each stage brings the last one's heroes and one
 * more. The last is won to win the run.
 * `provision`: winning it earns a provision, assigned at the caravanserai
 * before the next (progression.md, 19.2: a region's stages 1 and 2).
 * `passive`: winning it, the region's last, offers a passive at the
 * caravanserai on the way to the next region (19.3's passive slot, alone
 * for now: three of the pool at random, one taken).
 * `map`: the id of the map it is fought on (MAPS in map.ts): the Steppe's
 * stages on the Steppe Crossing, China's on the Flaming Mountains; the Gobi
 * (`gobi`) was kept for the Arabia region, cut 2026-10-26, and has no
 * region now.
 */
export interface Stage {
  region: RegionId;
  heroes: number;
  creatures: number;
  provision: boolean;
  passive: boolean;
  map: string;
}
export const STAGES: Stage[] = [
  {region: 'steppe', heroes: 1, creatures: 2, provision: true, passive: false, map: 'steppe'},
  {region: 'steppe', heroes: 2, creatures: 1, provision: true, passive: false, map: 'steppe'},
  {region: 'steppe', heroes: 3, creatures: 0, provision: false, passive: true, map: 'steppe'},
  {region: 'china', heroes: 1, creatures: 2, provision: true, passive: false, map: 'flaming'},
  {region: 'china', heroes: 2, creatures: 1, provision: true, passive: false, map: 'flaming'},
  {region: 'china', heroes: 3, creatures: 0, provision: false, passive: false, map: 'flaming'},
];
/** How many passives the caravanserai between regions offers, one to be taken. */
export const PASSIVE_OFFER = 3;
/** The enemy hero of the first stage, and so of every Steppe stage (owner, 2026-10-24; was random). */
export const FIRST_ENEMY: HeroId = REGIONS.steppe.firstEnemy;
/** How many of a run's first stages always have mountains (owner, 2026-10-24; randomTiles). */
export const MOUNTAIN_STAGES = 3;
/** The player's camel, after the party in slot order; the enemy has none (camel.md). */
export const CAMEL: HeroId = 'camel';
