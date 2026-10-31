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
import type {AbilityId, HeroId, LeapShape, PassiveId} from './types';

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
  /**
   * Wait (timeline.md, 3.2; in runs since 2026-10-31, the owner's call,
   * proposed 2026-10-30): a turn that does nothing, a Hold without a walk
   * or a turn skipped with only Hold to choose (not a Stunned one, nor
   * Temee's), sends the card this share of its action cost on, rounded, at
   * least 1: 5, 6 and 7 slots for speeds 3, 2 and 1 in place of 8, 9 and
   * 10. 1 turns it off.
   */
  waitShare: (2 / 3) as number,
  /** Patient's saving (19.8): an idle turn's card goes this many slots fewer on, after Wait. */
  patientSlots: 2 as number,
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
  /**
   * The health a pick in the caravanserai's draft heals the camel, taken in
   * place of a card, up to its full health (owner, 2026-10-28; full health
   * before; a pick of the draft since 2026-10-29).
   */
  camelHeal: 4,
  /**
   * Scorched ground's burn (owner, 2026-10-28; `scorched` in map.ts): the
   * damage a unit takes Moved onto it, or ending its turn on it.
   */
  scorch: 1,
  /**
   * Durations in slots (owner, 2026-10-29; balance.md, "Durations in a
   * fixed number of slots"), in place of turns: every effect that lasted
   * until a unit's next turn (Empower, Weaken, a Shield but a lasting one,
   * Fortify's Armour, the Immobilized of Hamstring or a pin, Princess Iron
   * Fan's fire) lasts `turn` slots from the slot it is given, hail `hail`,
   * whatever turns come in between, ending as the track passes its last
   * slot (`expireDurations` in resolve.ts); a Stun for a unit's next turn
   * is a Delay of `stun` (`stunForATurn`). A grapple squeezes every `turn`
   * slots, Bulwark covers each ally once every `turn` slots. 8 is the
   * fastest hero's turn, so an Empower seldom lasts two of a unit's turns.
   */
  durations: {turn: 8 as number, hail: 16 as number, stun: 6 as number},
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
  /**
   * Passives it carries from the start, beside any it takes (progression.md,
   * 19.8): the Magus's Inevitable, as Steady Gait (owner, 2026-10-27).
   */
  passives?: PassiveId[];
  /** Spaces a move may cover; RULES.movementCap if unset. */
  moveCap?: number;
  /**
   * Moves the way Snap Shot flies: any number of spaces straight along one of
   * the six directions, up to the first unit, yurts or the map's edge (the
   * Outrider; owner, 2026-10-25). Hail still ends the move where it enters.
   * With a `moveCap`, at most that many (the Duelist's straight walk,
   * owner's idea, 2026-10-31).
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
  /**
   * A region's boss (enemies.md): while one stands, the road out is
   * sealed, so the camel can't win by reaching it (`exitSealed` in
   * board.ts; owner, 2026-10-29). Not Zahhak's serpents.
   */
  boss?: boolean;
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
    name: 'Outrider',
    letter: 'O',
    speed: 3,
    defence: 1,
    power: 2,
    abilities: ['snapShot', 'hold'],
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
    // 2 since 2026-10-27 (owner; balance.md, "The Storm Caller at power
    // 2"): at 1 the Duelist and Vanguard in its seat won 63%. 1 from
    // 2026-10-23: at 0 Hail dealt nothing and couldn't break a grapple.
    power: 2,
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
    // No passive (owner, 2026-10-31; balance.md, "Spearhead off, Cleave's
    // Delay raised in its place": its role score 50.4% without, 54.9% with,
    // since the Cataphract's slam came off). Spearhead at range 2 from
    // 2026-10-30 (balance.md, "Spearhead at range 2": 45.6% to 51% then).
  },
  /**
   * The Alchemist (owner, 2026-10-25; roster.md): a support whose
   * Elixir, an overdose on any unit within 3, ally or enemy, Empowers its
   * hits to 6 for 8 slots and hits it for his power (`ABILITY.elixir`),
   * and whose Sedative heals any unit within 3 his power and Weakens it to
   * nothing for 8 slots (`ABILITY.sedative`; both owner, 2026-10-31; from 2026-10-27, on a unit within 2, an ally healed his
   * power and Empowered 2, an enemy hit and Weakened 2; an ally within 3 healed, Empowered 1 and Hastened 3 before
   * that; earlier on 2026-10-26 a burst next to it of Haste 3
   * and Delay 3, before that of Empower 2 and Weaken 1). Speed 3 (owner, 2026-10-25; 2 before; balance.md,
   * "Elixir's shape and Cleave's Delay": the Storm Caller's equal in its
   * seat, 49.2% from 40.6%); power 1 (owner, 2026-10-26; 0 with the
   * burst earlier that day, 1 before it, 2 before that; balance.md, "Two
   * hails, hail on entry, and a melee Elixir"): the overdose's hit;
   * defence 1 (health 4) the builder's first number.
   */
  alchemist: {
    name: 'Alchemist',
    letter: 'A',
    speed: 3,
    defence: 1,
    power: 1,
    abilities: ['elixir', 'sedative', 'hold'],
  },
  /**
   * The Duelist (owner, 2026-10-26; roster.md): China's fast
   * melee striker. Speed 3, power 2, defence 1 (health 4) and a walk of 3
   * are the owner's; Swift Strike, its sword stroke, Hastens it when it hits
   * (`ABILITY.swiftStrike`).
   */
  youxia: {
    name: 'Duelist',
    letter: 'D',
    speed: 3,
    defence: 1,
    power: 2,
    abilities: ['swiftStrike', 'hold'],
    moveCap: 3,
    // Walks straight, up to 3 (owner, 2026-10-31; balance.md, "The
    // Duelist walking straight, and a dash").
    movesStraight: true,
  },
  /**
   * The Magus (owner, 2026-10-27; roster.md): Persia's support, a track
   * controller. Speed 2, defence 1 (health 4) and power 0 are the owner's:
   * no ability of its deals damage. Inevitable from the start (Steady
   * Gait): nothing Delays or Hastens its card, its own Omen
   * included, though a collision still bumps it (3.3; owner, 2026-10-27).
   */
  magus: {
    name: 'Magus',
    letter: 'M',
    speed: 2,
    defence: 1,
    power: 0,
    abilities: ['omen', 'hold'],
    passives: ['steadyGait'],
  },
  /**
   * The Juggernaut (owner, 2026-10-27; roster.md): Persia's tank, a
   * mahout on a war elephant. Speed 1, defence 3 (health 8) and power 2
   * are the owner's. Unstoppable from the start (17.4): no Push, Pull,
   * Immobilized or Stunned, so no grapple, and hail doesn't stop its walk.
   * Stomp hits every unit around it and drives them back (`ABILITY.stomp`).
   */
  mahout: {
    name: 'Juggernaut',
    letter: 'J',
    speed: 1,
    defence: 3,
    power: 2,
    abilities: ['stomp', 'hold'],
    passives: ['unstoppable'],
  },
  /**
   * The Ranger (owner, 2026-10-27; roster.md): a Persian foot archer, a
   * candidate for Persia's damage hero beside the Cataphract. Speed 2,
   * defence 1 (health 4) and power 3, the most of any hero, are the
   * owner's. Longshot hits the first unit in line (`ABILITY.longshot`),
   * Piercing until 2026-10-31 (owner).
   */
  archer: {
    name: 'Ranger',
    letter: 'R',
    speed: 2,
    defence: 1,
    power: 3,
    abilities: ['longshot', 'hold'],
  },
  /**
   * The Barbarian (owner, 2026-10-28; roster.md): Byzantium's tank since
   * 2026-10-31 (owner; its damage hero before, the Cataphract its tank), a
   * Varangian guardsman with a great axe. Speed 1, defence 3 (health 8),
   * power 2 (owner, 2026-10-31; speed 1, defence 2, power 3 before),
   * Lunge (`ABILITY.lunge`; Hew on the test stage, then Wade In) and Fury (`FURY`, Haste 5)
   * as measured in balance.md, "Hew as a line, with Fury". Before that: Leap (owner,
   * 2026-10-30): over anything to a free space 2 away off his straight
   * lines, hitting the two spaces in front of where he lands. In place of
   * Axe Throw (owner, later 2026-10-28; `ABILITY.axeThrow`: any unit within
   * 3 in a straight line, over whatever is in between, hit and Pushed 1),
   * itself in place of Reave (the axe swung through three spaces next to
   * it, or thrown down a line of three and left lying where it lands;
   * balance.md, "All twelve heroes": 26–39% in the damage seats); both
   * kept for measuring.
   */
  varangian: {
    name: 'Barbarian',
    letter: 'B',
    speed: 1,
    defence: 3,
    power: 2,
    abilities: ['lunge', 'hold'],
    passives: ['fury'],
  },
  /**
   * The Priest (owner, 2026-10-28; roster.md): Byzantium's support, a
   * healer. Speed 1, defence 2 (health 6) and power 3 are the owner's
   * (2026-10-31; speed 2, defence 1 before). Invocation in place of
   * Blessing (owner, 2026-10-31; `ABILITY.invocation`): charged, it lands
   * on a space within 3 and the spaces next to it when his card comes
   * back, enemies there hit and allies healed his power. Blessing is kept,
   * in no kit (`ABILITY.blessing`).
   */
  priest: {
    name: 'Priest',
    letter: 'P',
    speed: 1,
    defence: 2,
    power: 3,
    abilities: ['invocation', 'hold'],
  },
  /**
   * The Cataphract (owner, 2026-10-28; roster.md): Byzantium's damage hero
   * since 2026-10-31 (owner; its tank before), armoured heavy cavalry.
   * Speed 2, defence 2 (health 6), power 2 (owner, 2026-10-31; speed 2,
   * defence 3, power 1 before), Armour after each charge in place of
   * Armoured (`ABILITY.charge.armour`). It has no walk of its own (`moveCap` 0): it moves only by
   * Charge, any distance straight, carrying every unit in its way ahead of
   * it while there is room (`charge` in abilities.ts; owner, later
   * 2026-10-28: the first unit only before, a second it met stopping it).
   */
  cataphract: {
    name: 'Cataphract',
    letter: 'K',
    speed: 2,
    defence: 2,
    power: 2,
    abilities: ['charge', 'hold'],
    // Armoured (owner, 2026-10-29) until 2026-10-31, when he became the
    // damage hero: Armour 1 for 8 slots after each charge in its place
    // (balance.md, "The Cataphract braced after a charge"; Armoured always
    // 3-8 points over the other damage heroes).
    moveCap: 0,
  },
  /**
   * The caravan's camel (owner, 2026-10-21; camel.md): it can't attack, and
   * walks itself one space a turn along the shortest road from the top-left
   * corner to the exit in the bottom-right, around units in its way (owner,
   * 2026-10-22). It acts last in the starting order, at slot 12 (owner,
   * 2026-10-23). Defence 9 (health 20, ten Snap Shot hits) is a PLACEHOLDER for
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
  /**
   * The Steppe's boss, the Cyclops (owner, 2026-10-28; enemies.md, "The
   * Cyclops"), Tepegöz of the *Book of Dede Korkut*, whose hide turned
   * Basat's arrows until he struck the eye: One Eye (Armour
   * `ONE_EYE.armour` against hits from outside the lane it faces), Smash
   * (melee) and Boulder (Snap Shot's lanes, the units next to where it lands
   * Pushed). Not in the ROSTER: the test stage brings it. Speed 1, defence
   * 5 (health 12) and power 3 are the builder's first numbers, untested.
   */
  giant: {
    name: 'Cyclops',
    letter: 'E',
    speed: 1,
    defence: 5,
    power: 3,
    abilities: ['smash', 'boulder', 'hold'],
    passives: ['oneEye'],
    boss: true,
  },
  /**
   * China's boss, one of two (owner, 2026-10-28; enemies.md, "The Bull Demon King
   * and Princess Iron Fan"): the Bull Demon King of *Journey to the West*. Gore
   * is Trample as first built, a charge (`ABILITY.gore`). Devoted to
   * Princess Iron Fan (`DEVOTED`). Not in the ROSTER: China's fourth stage brings them (owner, 2026-10-28), as the test stage does.
   * Speed 1, defence 5 (health 12), power 3 are the owner's.
   */
  oxKing: {
    name: 'Bull Demon King',
    letter: 'K',
    speed: 1,
    defence: 5,
    power: 3,
    abilities: ['gore', 'hold'],
    passives: ['devoted'],
    boss: true,
  },
  /**
   * The Bull Demon King's wife (owner, 2026-10-28), Princess Iron Fan: the
   * Iron Fan (the Banana-leaf Fan until 2026-10-28) blows a line of units back (`ABILITY.bananaFan`), and
   * Fan the Flames sets a space within 3 and those next to it alight
   * (`ABILITY.fanFlames`). Devoted (`DEVOTED`). Speed 3, defence 2 (health
   * 6), power 1 are the owner's.
   */
  fanLady: {
    name: 'Princess Iron Fan',
    letter: 'L',
    speed: 3,
    defence: 2,
    power: 1,
    abilities: ['bananaFan', 'fanFlames', 'hold'],
    passives: ['devoted'],
    boss: true,
  },
  /**
   * Persia's boss (2026-10-29; enemies.md, "Zahhak"): the serpent-shouldered
   * king of the *Shahnameh*, whose two serpents, kissed onto his shoulders
   * by Iblis, grew back each time they were cut off. The Serpent King
   * (`serpentKing`): no damage reaches his health while either of his
   * serpents is on the board. Feed the Serpents: melee. Regrow
   * (`regrowSerpent`, owner, 2026-10-29): on his turn, a fallen serpent
   * grows back on an open space next to him. Not in the ROSTER. Speed 1,
   * defence 4 (health 10) and power 3 are the builder's first numbers,
   * untested.
   */
  zahhak: {
    name: 'Zahhak',
    letter: 'Z',
    speed: 1,
    defence: 4,
    power: 3,
    abilities: ['feed', 'regrowSerpent', 'hold'],
    passives: ['serpentKing'],
    boss: true,
  },
  /**
   * The serpents on Zahhak's shoulders (2026-10-29), two of them, each its
   * own unit with its own card: the boss's "two heads, two turns"
   * (enemies.md, 11.3; setting.md). Bite, as the wolf's. Cut down, only
   * Zahhak brings it back, spending a turn on it (`regrowSerpent`).
   * Speed 3, defence 0 (health 2) and power 1 are the builder's first
   * numbers, untested.
   */
  serpent: {
    name: 'Serpent',
    letter: 'N',
    speed: 3,
    defence: 0,
    power: 1,
    abilities: ['bite', 'hold'],
    passives: ['regrow'],
  },
};

/**
 * Devoted (owner, 2026-10-28), the Bull Demon King's and Princess Iron Fan's: whenever
 * one of them is hit (any damage coming at it, a Shield's or not), the
 * other's card is Hastened `haste`, Swift Strike's number.
 */
export const DEVOTED = {haste: 3 as number};

/**
 * One Eye (owner, 2026-10-28), the Cyclops's passive: a hit on it
 * from a unit not standing in its front lane, straight out the way it
 * faces at any distance, loses `armour` (17.6's Armour, so a Piercing hit
 * ignores it). The builder's first number.
 */
export const ONE_EYE = {armour: 3 as number};

/**
 * Armoured (owner, 2026-10-29), the Cataphract's: Armour `armour` against
 * every hit (17.6), unless it Pierces.
 */
export const ARMOURED = {armour: 1 as number};

/**
 * Spearhead, the Vanguard's (owner, 2026-10-30; balance.md, "Spearhead"),
 * not offered at the caravanserai: whenever it is hit (any damage coming
 * at it, a Shield's or not, as Devoted), each ally within `range` of it,
 * Humphrey too, is Hastened `haste`, Devoted's number. Range 2 (owner,
 * 2026-10-30, as measured: "Spearhead at range 2"); 1, next to it, when
 * first built, off. No hero's since 2026-10-31 (owner; balance.md,
 * "Spearhead off, Cleave's Delay raised in its place").
 */
export const SPEARHEAD = {haste: 3 as number, range: 2 as number};

/**
 * Fury (owner, 2026-10-31), the Barbarian's, not offered: whenever it is
 * hit (any damage coming at it, a Shield's or not, as Spearhead), its own
 * card is Hastened `haste`: 5 (owner, 2026-10-31, as measured: balance.md,
 * "Fury's Haste 5"; 3, Devoted's and Spearhead's, on the test stage first).
 */
export const FURY = {haste: 5 as number};

/**
 * The generic ability upgrades' amounts (progression.md, 19.9; owner,
 * 2026-10-29): the builder's first readings, marked TBD there. Each Delay,
 * Haste, Weaken, Empower, Armour and Shield is the keyword's own (17.3,
 * 17.6), Push and Pull 1 (17.4).
 */
export const UPGRADE = {
  wearying: {weaken: 1},
  lethargy: {delay: 2},
  inspire: {haste: 2},
  fervour: {empower: 1},
  forceful: {push: 1},
  reelIn: {pull: 1},
  staggering: {delay: 2},
  crippling: {weaken: 1},
  immovableObject: {delay: 2},
  invigorate: {empower: 1},
  quickening: {haste: 2},
  fortify: {armour: 1},
  ward: {shield: 1},
} as const;

/** Each ability's shape. Damage is never listed: it is the user's power. */
export const ABILITY = {
  /**
   * Six straight lanes with no range limit (owner, 2026-10-20): the arrow
   * flies until it hits a unit, a yurt or the map's edge.
   */
  snapShot: {range: Infinity},
  /**
   * Longshot (owner, 2026-10-27; roster.md), the Ranger's: down any of
   * its six lines, at any range, the first unit in line hit, stopped by
   * yurts as Snap Shot (`first`); Piercing (`pierce`) until 2026-10-31,
   * when the owner took it off, so Armour now stands against it; Pushed 1
   * (`push`) from 2026-10-28 until later that day (owner: balance.md,
   * "Longshot's Push, flying over the spaces next to the Ranger", 55.2%
   * in the Steppe's damage seat with it, 49.6% without); Delayed 3, `delay`, from later
   * 2026-10-27: balance.md, "Longshot's effect", 49.4% in the Steppe's
   * damage seat, 50.9% in China's). Built first hitting any unit on its
   * lines, past everything (`first` off, no Pierce or Delay): 58–67% in
   * every seat.
   * Switches for measuring nerfs (balance.md, "Archer nerfs and Magus
   * buffs"), off as built but `minRange`: `minRange`, the nearest space
   * it shoots, 2 (owner, 2026-10-28: no shot at the spaces next to the
   * Ranger; owner, later 2026-10-28: its arrow flies over them, units and
   * yurts there included, and hits the first unit beyond);
   * `camel`, whether it may shoot the camel; `falloff`, the range past
   * which its hit is 1 less; `first`, stopped by the first unit or yurt
   * in its line, as Snap Shot; `pierce`, its hit Pierces Armour (17.6);
   * `push`, the unit hit then Pushed this far away from the Ranger (17.4);
   * in its place (balance.md, "Longshot's effect"), `delay`, the unit hit
   * Delayed this much (17.3); `weaken`, Weakened this much (17.6); `pin`,
   * Immobilized through its next turn (17.5), unless Unstoppable.
   */
  longshot: {
    range: Infinity as number,
    minRange: 2 as number,
    camel: true as boolean,
    falloff: Infinity as number,
    first: true as boolean,
    pierce: false as boolean,
    push: 0 as number,
    delay: 0 as number,
    weaken: 0 as number,
    pin: false as boolean,
  },
  /**
   * Blessing (owner, 2026-10-28; roster.md), the Priest's, built in a line
   * with himself too since 2026-10-30 (`shape` `line`, `lineSelf`; balance.md,
   * "Blessing in a line": 47.5% as a score, 43.8% as one ally). As one ally: within
   * `range` (2), the Priest himself too (`self`) and the camel too
   * (`camel`), no line of fire, heals the Priest's power; with `overheal`,
   * the heal beyond the ally's missing health becomes Shield (keywords.md,
   * 17.6), and `shield` (1) more is given on top whatever it heals. With
   * `lasts` the Shield stays until damage spends it, a unit holding at most
   * `cap` (3, his power) of it; otherwise until the ally's next turn.
   * Built so later 2026-10-28 (owner; balance.md, "A heal, its excess and
   * 1 more as a lasting Shield": 50.3%, 50.3% and 52.0% in the support
   * seats); before, no Shield on top and none lasting (42.7%, 22.8%,
   * 41.6%). Nothing on an enemy, unless `smite`: an enemy within range is
   * hit for the Priest's power instead (a switch for measuring, off).
   * Switches for a Shield in place of the heal (balance.md, "Blessing as
   * a Shield"), off: `heal` false, no heal, the ally Shielded the Priest's
   * power (and `shield` more); `shape` `aura`, every ally within `radius`
   * of the Priest at once, in place of one within `range`; `shape` `line`
   * (the owner, 2026-10-30; off), every unit on one of the six straight
   * lines out from him to the map's edge, through yurts, units and all,
   * allies and enemies alike, each blessed as one ally would be, any line
   * aimed, a unit on it or not; with `lineSelf` the Priest himself too
   * (whenever the line held a unit until later 2026-10-30, as measured).
   * `mode` `track` (the owner's idea, 2026-10-30; balance.md, "Blessing by
   * the track"; off): no Shield, a unit within `range` healed or hit by how
   * far its card lies from the current slot, `d` slots on. Below `split`
   * an ally is healed, above it an enemy is hit; at `split`, nothing. With
   * `scale` `cap` the amount is `|d − split|`, at most his power (Empower,
   * Weaken and passives counted); with `bands`, his power at 2 or more
   * from `split`, half of it (rounded down) at 1. The Priest himself, his
   * card at the current slot, is healed. With `trackShield` (the owner,
   * 2026-10-30; off) the heal beyond the ally's missing health becomes
   * Shield, lasting with `lasts`, a unit holding at most `cap`. With
   * `trackSmite` off (the owner, 2026-10-30) no enemy is hit: a pure support.
   */
  /**
   * Invocation (owner, 2026-10-31), the Priest's in place of Blessing: a
   * space within `range` (no line of fire) and every space within `radius`
   * of it. Charged: it does nothing as he casts it, his card going
   * `charge` of his action cost on, rounded (6 slots at speed 1; owner,
   * 2026-10-31, as measured even, balance.md, "Invocation's charge"; a
   * Hold's cost, 10, before), greyed while it charges;
   * when it comes back, every enemy in the area then takes his power and
   * every ally there, himself and the camel too, is healed his power (an
   * Empower he cast it with adding to the hit and the heal alike)
   * (`landShots`), and his card goes his action cost on, a full turn. A
   * Stun before it lands loses it, as a drawn arrow.
   * `charge` null charges a Hold's cost instead (a Wait's when Wait is
   * on), as first built.
   */
  invocation: {range: 3 as number, radius: 1 as number, charge: 0.6 as number | null},
  blessing: {
    mode: 'heal' as 'heal' | 'track',
    scale: 'bands' as 'cap' | 'bands',
    split: 5 as number,
    trackShield: false as boolean,
    trackSmite: true as boolean,
    lineSelf: true as boolean,
    lasts: true as boolean,
    cap: 3 as number,
    range: 2 as number,
    heal: true as boolean,
    shape: 'line' as 'unit' | 'aura' | 'line',
    radius: 1 as number,
    smite: false as boolean,
    self: true as boolean,
    camel: true as boolean,
    overheal: true as boolean,
    shield: 1 as number,
  },
  /**
   * One space exactly `range` from the Storm Caller (owner, 2026-10-24: a
   * ring, so the spaces next to it and 3 or more away are safe; within 3
   * from 2026-10-23, and before that a radius-1 area with damage and a
   * track Push). It stays `RULES.durations.hail` slots (16, owner,
   * 2026-10-29; 2 of its caster's turns from 2026-10-25, 1 before). A unit
   * in the space when it lands, or that enters it, is Immobilized until it
   * disappears.
   * `max`: how many of a caster's hails stand at once, a new one past it
   * replacing the oldest; each lifts on its own, freeing only whoever it
   * held. 2 (owner, 2026-10-26; 1, one hail a caster, before).
   * `entry`: a unit that enters hail (walking or Moved) takes its caster's
   * power (owner, 2026-10-26). Both as measured, changing little
   * (balance.md, "Two hails, hail on entry, and a melee Elixir").
   */
  hail: {range: 2, max: 2 as number, entry: true as boolean},
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
   * space next to the Outrider, then Snap Shot's shot from there, charged:
   * the Outrider's card is pushed `charge` of its action cost on, rounded
   * (half: 4 slots for the Outrider's 8), greyed while it charges; when it
   * comes back the arrow flies down the lane it was aimed along and the
   * first unit in it then takes the Outrider's power, with no turn for the
   * Outrider, and its card goes its action cost on to its next turn. At 0
   * it shoots at once (measured: a better Snap Shot rather than a second
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
   * spaces straight out from it in any of the six directions, stopped by
   * yurts (owner, 2026-10-27, as measured in balance.md, "Cleave as a line
   * of 2 six ways"; from 2026-10-26 a line up or down or a cone of 3 to one
   * side; board.ts, `cleaveAreas`); each unit in it,
   * ally or enemy, takes the Vanguard's power, and each
   * one still standing is Delayed `delay` slots (keywords.md 17.3): 6
   * (owner, 2026-10-28; balance.md, "All twelve heroes": at 8 the Vanguard
   * won 54–79% in the tank seats); 8 from 2026-10-26 (5 from 2026-10-25;
   * balance.md, "The Vanguard's buffs other than speed": China against the
   * Steppe 52.5% with Swift Strike's Haste 3).
   */
  /**
   * `shape`, a switch for measuring (board.ts, `cleaveAreas`): `built` as
   * above (`lines` before 2026-10-27); `arcs`, three neighbours side by
   * side, six ways; `cones`, two diagonal neighbours and the space straight
   * across beyond them, six ways.
   */
  cleave: {reach: 2, delay: 6 as number, shape: 'built' as 'built' | 'arcs' | 'cones'},
  /**
   * Elixir (owner, 2026-10-25). As built since 2026-10-31, an overdose
   * (`overdose` 6, below): a unit within `range` (3), the Alchemist itself
   * too, no line of fire, ally or enemy, Empowered until its hits deal 6
   * for 8 slots and hit for the Alchemist's power; nothing else.
   * From 2026-10-27 until then (as measured in
   * balance.md, "The Elixir on one unit within 2, Empower 2 and Weaken
   * 2"): a unit within 2, the Alchemist itself too (`self`, owner,
   * 2026-10-27), no line of fire. An ally was healed the Alchemist's power (1, `heal`: the camel
   * too) and Empowered `empower` (2, a unit that hits, until the end of its
   * next turn); an enemy is hit for the Alchemist's power (`fixed` 1) and
   * Weakened `weaken` (2, a unit that hits, until the end of its next
   * turn). No Haste or Delay.
   * From late on 2026-10-26 until then, an ally within 3 only, healed 1,
   * Empowered 1 and Hastened 3, nothing on an enemy.
   * Earlier on 2026-10-26 a burst next to the Alchemist (`shape: 'burst'`,
   * `range: 1`, no heal or Empower): every unit within `radius` of it but
   * the Alchemist, an ally Hastened 3, an enemy Delayed 3; before that the
   * same burst Empowering allies 2 and Weakening enemies 1, a unit that
   * hits only.
   * Earlier still that day a unit within 2, the Alchemist itself too: an ally
   * healed the Alchemist's power and was Empowered 1, an enemy took a hit
   * and was Weakened 1 (`shape: 'unit'`, `range: 2`, `fixed: 1`, `heal:
   * 'all'`, power 1; balance.md, "Elixir fixed at 1, with a hit").
   * `shape`: `unit` as built, the unit on a space within `range`; `burst`;
   * `aura`, every unit within `radius` of the Alchemist, aimed at its own
   * space (switches for measuring; the page draws a burst's area and aims
   * a unit's, but not an aura's).
   * `fixed`, a switch for measuring: above 0 an enemy is also hit for the
   * Alchemist's power, and the Empower and Weaken default to it; 0 as built.
   * `heal`: an ally heals the Alchemist's power, `all` the camel too
   * (as built), `heroes` not (with `fixed` only, until 2026-10-26).
   * `haste`, `delay`: an ally is Hastened `haste` slots, an enemy Delayed
   * `delay`, so any unit on that side is caught (3 and 0 as built, 3 and 3
   * with the burst; `tempo`, both at once, a switch before).
   * `empower`, `weaken`: the Empower on an ally and the Weaken on an enemy
   * (1 and 0 as built; 0 and 0 with the Haste burst, 2 and 1 before); 0
   * falls back to `fixed`, and at 0 too gives none (it fell back to power
   * too until the Alchemist's power was 1 again, 2026-10-26).
   * `self`: whether the Alchemist takes its own Elixir; on as built
   * (owner, 2026-10-27: its own Empower 2 lasting through the end of its
   * next turn); off from 2026-10-26 (with it, it Hastened itself on every
   * Elixir and kept the enemy beside it from acting), so a burst or aura
   * passed it over and it couldn't be aimed at itself.
   * Its switches for measuring an ally made Unstoppable, Immortal, or
   * swapping its speed and health until its next turn (2026-10-26 and 27,
   * all off) were removed on 2026-10-29 with every other effect lasting by
   * turns (balance.md, "Elixir on one ally within 3: a heal and
   * Unstoppable", "The Elixir swapping speed and health", "The Elixir
   * granting Immortal").
   * `line` (owner's idea, 2026-10-31; off): aimed as Axe Throw is, a unit on
   * one of the Alchemist's six lines within `range`, over anything in
   * between, so not the Alchemist itself.
   * `mode` (owner's ideas, 2026-10-31; `built` as built): `alternate`, its
   * casts taking turns, the first healing an ally the Alchemist's power, the
   * next hitting an enemy for it, and so on (`Unit.elixirCasts`), no
   * Empower or Weaken; `poison`, any unit healed the Alchemist's power, then
   * losing 1 every `poisonEvery` slots until its power + `poisonExtra` is
   * lost (`Unit.poison`), no Empower, Weaken or hit.
   * `overdose` (owner, 2026-10-31; 6 as built, with `range` 3; balance.md,
   * "The Elixir as an overdose"; 0 the Elixir before, below): above 0, the unit
   * given it, ally or enemy, is Empowered (one that hits) up to that
   * damage, its power + Empower `overdose` (at least 1), for
   * `RULES.durations.turn` slots, and takes the Alchemist's power (as
   * hail's damage: a Shield takes it, Armour not; it can fell the unit).
   * No heal, hit or Weaken.
   */
  elixir: {
    range: 3 as number,
    shape: 'unit' as 'unit' | 'burst' | 'aura',
    radius: 1 as number,
    fixed: 1 as number,
    heal: 'all' as false | 'all' | 'heroes',
    haste: 0 as number,
    delay: 0 as number,
    empower: 2 as number,
    weaken: 2 as number,
    self: true as boolean,
    line: false as boolean,
    mode: 'built' as 'built' | 'alternate' | 'poison',
    poisonEvery: 6 as number,
    poisonExtra: 1 as number,
    overdose: 6 as number,
  },
  /**
   * Sedative (owner, 2026-10-31; the Alchemist's second ability beside the
   * overdose, as measured in balance.md, "The overdose with a Sedative
   * beside it"): a unit within
   * `range`, the Alchemist too, ally or enemy, healed the Alchemist's power
   * and Weakened by all it deals (its power, Empower and passives), so its
   * hits deal nothing for `RULES.durations.turn` slots.
   */
  sedative: {range: 3 as number},
  /**
   * Swift Strike (owner, 2026-10-26; Ten Paces until renamed the same day),
   * the Duelist's *jian*: melee, and when it hits, the Duelist's card is Hastened `haste` slots (keywords.md
   * 17.3). 3 (owner, 2026-10-26; 2 the builder's first; balance.md, "The Vanguard's buffs other than speed").
   */
  swiftStrike: {
    haste: 3 as number,
    /**
     * A lunge first (owner's idea, 2026-10-30; balance.md, "The Duelist's
     * lunge and streak"): up to this many spaces straight at the unit it
     * strikes, stopped by yurts and units, ending next to it. 0 as built
     * (melee only).
     */
    lunge: 0 as number,
    /**
     * The lunge passes through units (owner's idea, 2026-10-30): each unit on
     * a space it crosses is hit, and it lands on a free space past them,
     * striking the unit in front too. Off as built.
     */
    passThrough: false as boolean,
    /**
     * Jumps (owner's idea, 2026-10-30): Swift Strike may also hit a unit
     * next to it and land on the free space past it, and from there jump
     * another unit next to it, and so on in the same turn, as a checkers
     * king does, never the same unit twice. With `lunge` 1 it also hits a
     * unit 2 away in line, stepping one space in. Off as built.
     */
    jump: false as boolean,
    /**
     * A dash (owner's idea, 2026-10-31): Swift Strike is only a move of
     * exactly `dash` spaces straight along one of the six directions,
     * through the units on the spaces before the last, each hit, to the free
     * space it lands on; with yurts or the map's edge on that space, one
     * fewer, through a unit next to it. No strike in place. 3 since
     * 2026-10-31 (owner; balance.md, "The Duelist walking straight, and a
     * dash"), with `dashMin` 2 and his straight walk; 0: melee, as first built.
     */
    dash: 3 as number,
    /**
     * The shortest dash (owner's idea, 2026-10-31): it may stop on any free
     * space from `dashMin` to `dash` out, with a unit passed on the way.
     * 0: exactly `dash` (one fewer against yurts or the edge), as first built.
     * 2 since 2026-10-31 (owner).
     */
    dashMin: 2 as number,
    /** With `jump`, a jump may be followed by another in the same turn. On (owner, 2026-10-30). */
    chain: true as boolean,
    /**
     * Whether a turn without a strike starts the streak again (on), or it
     * runs all fight, each hit raising the Haste (off; owner's idea,
     * 2026-10-30).
     */
    streakResets: true as boolean,
    /**
     * The Haste by how many turns running it has struck (owner's idea,
     * 2026-10-30): the first strike's, the second's, and the last held while
     * the streak lasts; a turn without a strike starts it again. Empty as
     * built (`haste` every time).
     */
    streak: [] as number[],
  },
  /**
   * Omen (owner, 2026-10-28; roster.md), the Magus's, named Conjunction
   * until then (balance.md, "Omen": 48.8% in the Steppe's
   * support seat, 51.7% in China's, the widest skill span measured), one
   * unit within `range` (3), of either side, the camel too, not
   * Inevitable, whose card comes before the Magus's next turn: an ally's
   * card put just after his current turn, an enemy's just after his next,
   * with no guard against putting the same enemy back each turn. Built
   * first as a swap of two cards (`mode: 'swap'`), then on 2026-10-27 as a
   * bracket of two (`mode: 'bracket'`), both at range 2.
   * Switches for measuring buffs (balance.md, "Archer nerfs and Magus
   * buffs"), off as built: `hit`, each enemy swapped hit for the Magus's
   * power; `delay`, each enemy swapped then Delayed this much more.
   * `mode`: `single` (as built), `swap`, the first built (the two cards
   * swap places, one Hastened and the other Delayed by the gap), or
   * `bracket`, the first of two units' cards put just after his current
   * turn and the second's just after his next; `before`, the second's just before his
   * next turn instead; `once` (with `bracket`), a unit put after his next
   * turn can't be put there again until it has acted; `single` (balance.md,
   * "Omen"), one unit in place of two, an ally's card put just after his
   * current turn and an enemy's just after his next, the Elixir's choice
   * of side. `rider` (with `single`): the ally Empowered, the enemy
   * Weakened, this much.
   */
  omen: {
    range: 3 as number,
    hit: false as boolean,
    delay: 0 as number,
    mode: 'single' as 'swap' | 'bracket' | 'before' | 'single',
    once: false as boolean,
    rider: 0 as number,
  },
  /**
   * Stomp (owner, 2026-10-28; balance.md, "Trample as a stomp"; Trample
   * until renamed that day), the Juggernaut's, `mode: 'stomp'`: it steps 1 space or stays (`step: 1`;
   * 0, in place only), and every unit next to it, ally or enemy, takes its
   * power and is Pushed 1 away.
   *
   * `mode: 'charge'`, as first built (2026-10-27; roster.md): a walk of 1
   * to `steps` spaces straight out in any of the six directions, stopped
   * by yurts and the map's edge. The units in its way, ally or enemy, a row
   * of them together, each take its power and are Pushed back ahead of it,
   * one space for each it walks; a row that can't be Pushed stops it behind.
   */
  stomp: {steps: 2 as number, mode: 'stomp' as 'charge' | 'stomp', step: 1 as number},
  /**
   * Boulder (owner, 2026-10-28), the Cyclops's: thrown down any of
   * Snap Shot's six lanes, the first unit in it hit for the giant's power,
   * then every other unit next to where it lands, ally or enemy, Pushed
   * `push` away from it, no damage (as Stomp's Push, but around the
   * landing).
   */
  boulder: {push: 1 as number},
  /**
   * Reave (owner, 2026-10-28; roster.md), the Barbarian's great axe, one
   * ability aimed two ways. A **swipe**: a space next to it and the two
   * either side of that one, every unit there hit, allies and Humphrey
   * too. A **throw**: a line of `throwRange` spaces straight out from it,
   * stopped early by a yurt or the map's edge (at least 2 spaces), every
   * unit along it hit; the axe lands on its last space, and until the
   * Barbarian enters a space on or next to it, it can only move and Hold.
   */
  reave: {throwRange: 3 as number},
  /**
   * Lunge (owner, 2026-10-31; Hew on the test stage, Wade In when the
   * Barbarian took it in runs the same day), his: `shape` `line` as built,
   * below. First a funnel, the two spaces next to him either side of one way
   * and the space past them that touches both, every unit there hit for his
   * power, allies and Humphrey too. He gains Shield `shieldPerHit` for each
   * enemy hit (owner, later 2026-10-31, in place of an Empower of 1 each),
   * added to any he has, for `slots` slots: 10, his own turn's at speed 1,
   * so it lasts to his next turn (8, `RULES.durations.turn`, ends before it).
   * `shape` `line` (owner, later 2026-10-31, the funnel and its Shield off):
   * the first unit up to `reach` (2) away along one of his six lines, ally
   * or enemy, hit for his power; one further than next to him, he steps
   * in until next to it first, as a lunge (stopped by hail).
   */
  lunge: {
    shape: 'line' as 'funnel' | 'line',
    reach: 2 as number,
    shieldPerHit: 0 as number,
    slots: 10 as number,
  },
  /**
   * Alignment (owner, 2026-10-31; the test stage's Magus's in place of Omen,
   * no hero's in runs): one of his six lines, to the map's edge through
   * anything, and the cards of every unit on it, of either side, Humphrey
   * too, not Inevitable and on the track, rearranged as he likes: each put
   * on any blank card of the deck, or several swapped among themselves in
   * any order. The deck (the track as drawn) runs from the slot after his
   * turn to just before his next turn (`beforeNext`, owner, later
   * 2026-10-31: no card it moves lands after his next turn, so he can't
   * hold an enemy back turn after turn; Omen's reach). Without it, to
   * `deck` slots on (12, the camel's start; a whole turn of the slowest),
   * or to the furthest card on it if that is further, as first built.
   * `swaps` (owner, later 2026-10-31; on, over `beforeNext` and `deck`):
   * swaps only, no blank cards: the cards of the line's units, his own
   * next turn's (where his card would land after this turn) and
   * Humphrey's (on the line or not) permuted among themselves, so every
   * card sent back brings another forward. `self` (with `swaps`): his own
   * next turn's card in the pool too; on, it gave him turn after turn
   * (balance.md, "Alignment as swaps only"), so off (owner, later
   * 2026-10-31): the line's cards and Humphrey's only.
   */
  alignment: {
    swaps: true as boolean,
    self: false as boolean,
    beforeNext: true as boolean,
    deck: 12 as number,
  },
  /**
   * Charge (owner, 2026-10-28; roster.md), the Cataphract's slam (owner,
   * 2026-10-29): each unit it hits that ends the charge with yurts or the
   * map's edge right behind it, along the charge, is slammed into them,
   * with `slam` `delay`, Delayed `delay` slots (owner, later 2026-10-29;
   * 6, balance.md, "The slam as a Delay": 4 was weaker in every seat);
   * with `stun`, Stunned for its next turn, as first built (balance.md,
   * "The slam without Armour": 74.7% in China's tank seat); `none`, no slam
   * (owner, 2026-10-31: the slam's Delay taken off).
   */
  /**
   * `armour` (owner, later 2026-10-31; the Cataphract as damage, in runs
   * since 2026-10-31): Armour that many after every charge, for `armourSlots` (8)
   * slots, so he holds out where it leaves him in melee. A unit's own
   * (`Unit.chargeArmour`, the test stage's `charge`) comes first.
   */
  charge: {
    slam: 'none' as 'delay' | 'stun' | 'none',
    delay: 6 as number,
    armour: 1 as number,
    armourSlots: 8 as number,
  },
  /**
   * Axe Throw (owner, 2026-10-28; roster.md), the Barbarian's: any unit on
   * one of the six straight lines from him, 1 to `range` (3) spaces away,
   * ally or enemy, the camel too; the axe flies over yurts and units in
   * between, hits the unit for his power and Pushes it `push` (1) away
   * (17.4). The axe comes back: nothing to pick up.
   */
  axeThrow: {range: 3 as number, push: 1 as number},
  /**
   * Leap (owner, 2026-10-30), the Barbarian's: the spaces next to where he
   * lands that it hits, by `shape`. `front` (built): the two straight
   * ahead, either side of the way he flew, for his power. `forward`: those
   * and the one either side of them, 4 for his power (all but the two he
   * flew over). `splash`: all six, the front two for his power and the
   * rest for `splash`, from no one's power.
   */
  /**
   * With `shield` (owner, 2026-10-30; off): a leap that hits enemies Shields
   * him by the damage they take, until spent, his Shield at most
   * `shieldCap`; one that hits no one takes away any Shield he has.
   * With `perHit` above 0 (owner, 2026-10-31; the test stage's Barbarian as
   * a tank, off in runs): `perHit` Shield for every enemy the axe hits,
   * Humphrey and allies not counted, lasting `RULES.durations.turn` (8)
   * slots, added to any he has. A unit's own (`Unit.leapShape`,
   * `.leapShieldPerHit`, the test stage's `leap`) comes first.
   */
  leap: {
    shape: 'front' as LeapShape,
    splash: 1 as number,
    shield: false as boolean,
    shieldCap: 3 as number,
    perHit: 0 as number,
  },
  /**
   * Gore (owner, 2026-10-28), the Bull Demon King's: Stomp's charge
   * (`stomp.mode: 'charge'`, Trample as first built), a walk of up to
   * `steps` in a line, every unit in its way hit and the row Pushed back.
   */
  gore: {steps: 2 as number},
  /**
   * The Iron Fan (owner, 2026-10-28), Princess Iron Fan's: every unit in
   * a line of `reach` straight out from her, ally or enemy, is Pushed
   * `push` away along it, the farthest first. No damage: the fire does it.
   */
  bananaFan: {reach: 3 as number, push: 2 as number},
  /**
   * Fan the Flames (owner, 2026-10-28), Princess Iron Fan's: an open space
   * within `range` and the open spaces next to it catch fire until her
   * next turn (aimed at a burning ridge anywhere, its neighbours alight,
   * until her map lost its ridges the same day); entering one, by walking
   * or Moved there, deals `burn` (the fissures' hazard, tried 2026-10-26),
   * from no one's power.
   */
  fanFlames: {range: 3 as number, burn: 1 as number},
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
   * A switch for measuring (2026-10-26): what a turn's Haste or Delay on
   * other units is worth when its options are screened (`scoreOutcome`),
   * × the share of a turn each card moved × its turn's worth, as
   * `guessValue` orders them. 0 as built: Delay and Haste count only in
   * that ordering and where the search plays the turn they move.
   */
  trackWorth: 0 as number,
  /**
   * A switch for measuring (2026-10-30; balance.md, "Wait"): what the
   * search's leaf (`evaluatePosition`) counts for how soon each card comes
   * back, × the share of a turn it is from its next turn × its turn's
   * worth (`trackPoints` in ai.ts), and the actor's own card in its
   * screening. 0.25 since 2026-10-31, with Wait in runs and `reachShare`
   * at the same weight, so a third of a turn saved and a hit set up are
   * priced alike (balance.md, "Walks priced by the hit they set up"); at
   * 1 without reach the AI Waited in place of walking.
   */
  leafTrack: 0.25 as number,
  /**
   * A switch for measuring (2026-10-30; balance.md, "Spearhead"): a unit
   * standing next to an ally with Spearhead is worth this × the Haste it
   * would get from one hit on that ally, as a share of its turn × its
   * turn's worth (`spearheadPoints` in ai.ts): roughly the hits the ally
   * takes before the unit's next turn. 0 as built: allies don't seek it.
   */
  spearheadShare: 0 as number,
  /**
   * A switch for measuring (2026-10-31; balance.md, "Walks priced by the
   * hit they set up"): what the search's leaf counts for each unit's best
   * hit from where it stands (`reachPoints` in ai.ts), its side's for it
   * and the other's against, × this share; and screening counts the
   * actor's own. 0.25 since 2026-10-31 (1.5 to 11 points stronger in the
   * mirrors, the browser's search about 6% shallower); 0, a walk is worth
   * only `perHexFromEnemy`.
   */
  reachShare: 0.25 as number,
  /**
   * A switch for measuring (2026-10-31; balance.md, "A horizon of
   * slots"): a line of the search ends once the track is this many slots
   * past the turn being chosen, as well as at its depth in decisions, so
   * a line that Waits sees as much of the track as one that acts (the
   * depth must be deep enough to reach it). 0 as built: decisions only.
   */
  horizonSlots: 0 as number,
  /**
   * A Wait always searched (2026-10-31; balance.md, "A Wait always
   * searched"): a Hold in place that brings the card back sooner than its
   * action cost (a Wait) joins the options a decision searches on, played
   * if it wasn't tried: the root's at 1, every decision's at 2. 1 since
   * 2026-10-31 (the owner's call; measured no gain or loss at either, the
   * root's the cheaper); 0, a Hold is searched only if it screens among
   * the best.
   */
  keepWait: 1 as number,
  /**
   * Root options whose searched values are within this of the best are
   * near-ties, settled by what each does at once (2026-10-31; balance.md,
   * "Walks priced by the hit they set up"): with reach counted, stepping in
   * to hit next turn could score a hair over hitting now.
   */
  tieMargin: 0.05 as number,
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
    magus: 1,
    // A tank, as the Grappler and the Vanguard.
    mahout: 0,
    archer: 1,
    // A tank since 2026-10-31.
    varangian: 0,
    priest: 1,
    // Byzantium's damage hero since 2026-10-31.
    cataphract: 1,
    camel: 0,
    wolf: 1,
    fox: 1,
    // A boss walks into reach, as a tank does.
    giant: 0,
    oxKing: 0,
    fanLady: 1,
    zahhak: 0,
    // As the wolf: a serpent cut down grows back, but not soon.
    serpent: 1,
  } as Record<HeroId, number>,
  friendlyDamageFactor: 1.5,
  /**
   * A Shield (Blessing, Rally) is worth this share of the damage it could
   * absorb before the unit's next turn: the hits the enemies acting before
   * then could deal it, at most its Shield. PLACEHOLDER.
   */
  shieldShare: 0.75,
  /**
   * A lasting Shield (`ABILITY.blessing.lasts`) is worth at least this share
   * of it: it stays until spent. PLACEHOLDER.
   */
  lastingShieldShare: 0.75,
  /**
   * A charged shot in the air on a unit that acts before it lands and can
   * walk is worth this share of the hit: it can step out. PLACEHOLDER.
   */
  dodgeShare: 0.25,
  /**
   * Fire (Princess Iron Fan's Fan the Flames): each unit standing next to a
   * burning space, not in it, is worth this share of the burn to the
   * fire's side (`firePoints` in ai.ts), as it may be Pushed in or have to
   * walk through. The builder's PLACEHOLDER.
   */
  fireShare: 0.5,
  /**
   * Minus this per space between the unit and what it closes in on after
   * its turn (for the enemy, Temee once no hero is in its reach; otherwise
   * the nearest enemy), so an AI with nothing in reach closes in instead of holding
   * forever; small next to any hit.
   */
  perHexFromEnemy: 0.2,
  /**
   * The Barbarian with its axe thrown (Reave): it closes in on the axe
   * first, and lying out the axe counts as this many spaces more, so
   * picking it up is progress and a throw costs it. PLACEHOLDER.
   */
  axeOut: 5,
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
export const ROSTER: HeroId[] = [
  ...PARTY,
  'modao',
  'alchemist',
  'youxia',
  'magus',
  'mahout',
  'archer',
  'varangian',
  'priest',
  'cataphract',
];
/**
 * The regions a run passes through, in order (setting.md, 15.3a), so far
 * the three whose stages are built: each names its own three heroes
 * and its basic creature, the wolf's unit reskinned (progression.md,
 * 19.5), if its stages bring one: only the Steppe's do (owner,
 * 2026-10-28; China's fox spirits taken out). Byzantium has no stages
 * yet, so no enemy brings its Barbarian, its Cataphract or its Priest.
 */
export type RegionId = 'steppe' | 'china' | 'persia' | 'byzantium';
/**
 * `boss`: the region's boss, the enemy of its last stage (owner,
 * 2026-10-28; enemies.md), one unit or two: the Cyclops on the Steppe,
 * the Bull Demon King and Princess Iron Fan in China (owner, 2026-10-28),
 * Zahhak and his two serpents in Persia (2026-10-29); null while the region has none built, and its last stage brings its heroes.
 */
export const REGIONS: Record<
  RegionId,
  {heroes: HeroId[]; creature: HeroId | null; boss: HeroId[] | null}
> = {
  steppe: {heroes: ['mangudai', 'bokh', 'storm'], creature: 'wolf', boss: ['giant']},
  china: {heroes: ['youxia', 'modao', 'alchemist'], creature: null, boss: ['oxKing', 'fanLady']},
  persia: {
    heroes: ['archer', 'mahout', 'magus'],
    creature: null,
    boss: ['zahhak', 'serpent', 'serpent'],
  },
  byzantium: {heroes: ['varangian', 'cataphract', 'priest'], creature: null, boss: null},
};
/**
 * A run's stages, in order (owner, 2026-10-24; for a while four, from three
 * wolves), region by region: how many of its region's heroes (REGIONS),
 * how many heroes of the regions before (`outsiders`) and how many of its
 * region's creatures the enemy brings to each (owner, 2026-10-28: the
 * Steppe's heroes and wolves, then China's heroes and the Steppe's, then
 * Persia's and the Steppe's or China's). In a region its heroes come in one
 * random order from the run's seed, the first of them random too (owner,
 * 2026-10-28; the Outrider and then each region's damage hero before), and so do the heroes of the regions before, so each stage brings
 * the last one's own heroes and one more. The last is won to win the run.
 * Four stages a region (owner, 2026-10-28; three before), the fourth its
 * boss's (`boss`): the region's boss (REGIONS) and `creatures` of its
 * creatures, or, for a region with no boss built yet, its heroes as for
 * the others.
 * Winning any stage short of the run's last leads to the caravanserai's
 * draft (`DRAFT`; progression.md, 19.3, owner 2026-10-29): a boss stage's
 * the bigger.
 * `map`: the id of the map it is fought on (MAPS in map.ts): the Steppe's
 * stages on the Steppe Crossing, its boss's in the Cyclops's cave (`cave`;
 * owner, 2026-10-28: each boss fight on a map of its own), China's in the Gobi Desert (`gobi`; owner,
 * 2026-10-28; the Flaming Mountains, `flaming`, from 2026-10-26, kept so
 * a run saved there still loads), its boss's in the Flaming Mountains
 * with nothing on them (`fireMountain`; owner, 2026-10-28), Persia's on the Salt Flats (`salt`),
 * its boss's in Zahhak's palace (`palace`, 2026-10-29).
 */
export interface Stage {
  region: RegionId;
  boss: boolean;
  heroes: number;
  outsiders: number;
  creatures: number;
  map: string;
}
export const STAGES: Stage[] = [
  {
    region: 'steppe',
    boss: false,
    heroes: 1,
    outsiders: 0,
    creatures: 2,
    map: 'steppe',
  },
  {
    region: 'steppe',
    boss: false,
    heroes: 2,
    outsiders: 0,
    creatures: 1,
    map: 'steppe',
  },
  {
    region: 'steppe',
    boss: false,
    heroes: 3,
    outsiders: 0,
    creatures: 0,
    map: 'steppe',
  },
  {
    region: 'steppe',
    boss: true,
    heroes: 3,
    outsiders: 0,
    creatures: 2,
    map: 'cave',
  },
  {
    region: 'china',
    boss: false,
    heroes: 1,
    outsiders: 2,
    creatures: 0,
    map: 'gobi',
  },
  {
    region: 'china',
    boss: false,
    heroes: 2,
    outsiders: 1,
    creatures: 0,
    map: 'gobi',
  },
  {
    region: 'china',
    boss: false,
    heroes: 3,
    outsiders: 0,
    creatures: 0,
    map: 'gobi',
  },
  {
    region: 'china',
    boss: true,
    heroes: 3,
    outsiders: 0,
    creatures: 0,
    map: 'fireMountain',
  },
  {
    region: 'persia',
    boss: false,
    heroes: 1,
    outsiders: 2,
    creatures: 0,
    map: 'salt',
  },
  {
    region: 'persia',
    boss: false,
    heroes: 2,
    outsiders: 1,
    creatures: 0,
    map: 'salt',
  },
  {
    region: 'persia',
    boss: false,
    heroes: 3,
    outsiders: 0,
    creatures: 0,
    map: 'salt',
  },
  {
    region: 'persia',
    boss: true,
    heroes: 3,
    outsiders: 0,
    creatures: 0,
    map: 'palace',
  },
];
/**
 * The caravanserai's draft after each stage short of the run's last
 * (progression.md, 19.3; owner, 2026-10-29): `offer` provisions drawn, the
 * party picking one, the rival one, until each has taken `picks`; the rest
 * are discarded. After a regular stage 3, 1 each; after a boss 5, 2 each.
 * Humphrey taking no damage in the stage draws one more, and the party
 * picks one more, its last (owner, 2026-10-29; camel.md, 18.4).
 */
export const DRAFT = {stage: {offer: 3, picks: 1}, boss: {offer: 5, picks: 2}};
/**
 * The enemy units that carry none of the rival's provisions (progression.md,
 * 19.3; owner, 2026-10-29): the creatures, Zahhak's serpents among them.
 */
export const CREATURES: readonly HeroId[] = ['wolf', 'fox', 'serpent'];
/**
 * The rarities (progression.md, 19.3b; owner, 2026-10-29): each provision
 * the caravanserai offers has one, set by how strong it is (measured,
 * balance.md, "A provision against a passive or an upgrade"), and is drawn
 * with its rarity's weight, so a legendary one is 8 times rarer than a
 * common one.
 */
export type Rarity = 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common';
export const RARITY_WEIGHT: Record<Rarity, number> = {
  legendary: 1,
  epic: 2,
  rare: 4,
  uncommon: 6,
  common: 8,
};
/** A stat upgrade's rarity (owner, 2026-10-29: Epic, as measured). */
export const STAT_RARITY: Rarity = 'epic';
/**
 * How many of a run's first stages always have mountains (owner, 2026-10-24;
 * randomTiles): the Steppe's, four since 2026-10-28.
 */
export const MOUNTAIN_STAGES = 4;
/** The player's camel, after the party in slot order; the enemy has none (camel.md). */
export const CAMEL: HeroId = 'camel';
