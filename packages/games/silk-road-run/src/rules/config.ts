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
import type {AbilityId, HeroId, PassiveId} from './types';

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
  /**
   * The health a caravanserai's provision heals the camel, taken in place of
   * a stat, up to its full health (owner, 2026-10-28; full health before).
   */
  camelHeal: 4,
  /**
   * Scorched ground's burn (owner, 2026-10-28; `scorched` in map.ts): the
   * damage a unit takes Moved onto it, or ending its turn on it.
   */
  scorch: 1,
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
  },
  /**
   * The Alchemist (owner, 2026-10-25; roster.md): a support whose
   * Elixir, on a unit within 2, heals an ally its power and Empowers it 2,
   * or hits an enemy for its power and Weakens it 2 (`ABILITY.elixir`;
   * 2026-10-27; an ally within 3 healed, Empowered 1 and Hastened 3 before
   * that; earlier on 2026-10-26 a burst next to it of Haste 3
   * and Delay 3, before that of Empower 2 and Weaken 1). Speed 3 (owner, 2026-10-25; 2 before; balance.md,
   * "Elixir's shape and Cleave's Delay": the Storm Caller's equal in its
   * seat, 49.2% from 40.6%); power 1 (owner, 2026-10-26; 0 with the
   * burst earlier that day, 1 before it, 2 before that; balance.md, "Two
   * hails, hail on entry, and a melee Elixir"): the Elixir's heal and hit;
   * defence 1 (health 4) the builder's first number.
   */
  alchemist: {
    name: 'Alchemist',
    letter: 'A',
    speed: 3,
    defence: 1,
    power: 1,
    abilities: ['elixir', 'hold'],
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
   * owner's. Longshot hits the first unit in line, Piercing
   * (`ABILITY.longshot`).
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
   * The Priest (owner, 2026-10-28; roster.md): Byzantium's support, a
   * healer. Speed 2, defence 1 (health 4) and power 3 are the owner's.
   * Blessing heals an ally his power, and what it can't heal becomes
   * Shield (`ABILITY.blessing`).
   */
  priest: {
    name: 'Priest',
    letter: 'P',
    speed: 2,
    defence: 1,
    power: 3,
    abilities: ['blessing', 'hold'],
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
};

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
   * yurts as Snap Shot (`first`), and Piercing (`pierce`); Pushed 1
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
    pierce: true as boolean,
    push: 0 as number,
    delay: 0 as number,
    weaken: 0 as number,
    pin: false as boolean,
  },
  /**
   * Blessing (owner, 2026-10-28; roster.md), the Priest's: one ally within
   * `range` (2), the Priest himself too (`self`) and the camel too
   * (`camel`), no line of fire, heals the Priest's power; with `overheal`,
   * the heal beyond the ally's missing health becomes Shield (keywords.md,
   * 17.6), and `shield` more is given on top whatever it heals. A Shield lasts until the start of the ally's next turn and adds
   * to one it has. Nothing on an enemy, unless `smite`: an enemy within
   * range is hit for the Priest's power instead (a switch for measuring,
   * off as built). `shield` 0 as built: the overheal is the Shield.
   */
  blessing: {
    range: 2 as number,
    smite: false as boolean,
    self: true as boolean,
    camel: true as boolean,
    overheal: true as boolean,
    shield: 0 as number,
  },
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
   * one still standing is Delayed `delay` slots (keywords.md 17.3): 8
   * (owner, 2026-10-26; 5 from 2026-10-25; balance.md, "The Vanguard's buffs other than speed": China
   * against the Steppe 52.5% with Swift Strike's Haste 3).
   */
  /**
   * `shape`, a switch for measuring (board.ts, `cleaveAreas`): `built` as
   * above (`lines` before 2026-10-27); `arcs`, three neighbours side by
   * side, six ways; `cones`, two diagonal neighbours and the space straight
   * across beyond them, six ways.
   */
  cleave: {reach: 2, delay: 8 as number, shape: 'built' as 'built' | 'arcs' | 'cones'},
  /**
   * Elixir (owner, 2026-10-25; as built since 2026-10-27, as measured in
   * balance.md, "The Elixir on one unit within 2, Empower 2 and Weaken
   * 2"): a unit within `range` (2), the Alchemist itself too (`self`, owner,
   * 2026-10-27), no line of fire. An ally is healed the Alchemist's power (1, `heal`: the camel
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
   * `unstoppable`, a switch for measuring (2026-10-26): an ally is also
   * Unstoppable (keywords.md, 17.4) until the start of its next turn; off
   * as built.
   * `self`: whether the Alchemist takes its own Elixir; on as built
   * (owner, 2026-10-27: its own Empower 2 lasting through the end of its
   * next turn); off from 2026-10-26 (with it, it Hastened itself on every
   * Elixir and kept the enemy beside it from acting), so a burst or aura
   * passed it over and it couldn't be aimed at itself.
   * `swap`, a switch for measuring (2026-10-27): an ally but the camel
   * swaps its speed and its health (`swapSpeedHealth` in resolve.ts),
   * until the end of its next turn (`swapUntil: 'end'`, its card placed
   * after that turn at the swapped speed) or the start of it (`'start'`);
   * `pool`, the swapped health a pool of its own, the unit's own health
   * back untouched unless it fell, or `carry`, the health it gains or loses
   * meanwhile carried back, falling if none is left; off as built.
   * `immortal`, a switch for measuring (2026-10-27): an ally is also
   * Immortal (keywords.md, 17.6) until the start of its next turn, `all`
   * the camel too, `heroes` not; off as built. `immortalWhen`: `now`, from
   * the Elixir until the start of its next turn, or `delayed`, from the
   * start of its next turn until the start of the turn after (so it acts
   * Immortal).
   */
  elixir: {
    range: 2 as number,
    shape: 'unit' as 'unit' | 'burst' | 'aura',
    radius: 1 as number,
    fixed: 1 as number,
    heal: 'all' as false | 'all' | 'heroes',
    haste: 0 as number,
    delay: 0 as number,
    empower: 2 as number,
    weaken: 2 as number,
    self: true as boolean,
    unstoppable: false as boolean,
    swap: false as false | 'pool' | 'carry',
    immortal: false as false | 'all' | 'heroes',
    immortalWhen: 'now' as 'now' | 'delayed',
    swapUntil: 'end' as 'start' | 'end',
  },
  /**
   * Swift Strike (owner, 2026-10-26; Ten Paces until renamed the same day),
   * the Duelist's *jian*: melee, and when it hits, the Duelist's card is Hastened `haste` slots (keywords.md
   * 17.3). 3 (owner, 2026-10-26; 2 the builder's first; balance.md, "The Vanguard's buffs other than speed").
   */
  swiftStrike: {haste: 3 as number},
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
   * An Elixir's swap (`ABILITY.elixir.swap`, a switch for measuring): each
   * point of health the ally loses for now, in the AI's first guess (the
   * search sees whether it is struck meanwhile).
   */
  swapRisk: 0.5 as number,
  /**
   * An Elixir's delayed Immortal (`ABILITY.elixir.immortalWhen`), in the
   * AI's first guess: this share of a turn of the ally's, taken without fear.
   */
  immortalWorth: 1 as number,
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
    priest: 1,
    camel: 0,
    wolf: 1,
    fox: 1,
  } as Record<HeroId, number>,
  friendlyDamageFactor: 1.5,
  /**
   * A Shield (Blessing, Rally) is worth this share of the damage it could
   * absorb before the unit's next turn: the hits the enemies acting before
   * then could deal it, at most its Shield. PLACEHOLDER.
   */
  shieldShare: 0.75,
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
  'priest',
];
/**
 * The regions a run passes through, in order (setting.md, 15.3a), so far
 * the three whose stages are built: each names its own three heroes
 * and its basic creature, the wolf's unit reskinned (progression.md,
 * 19.5), if its stages bring one: only the Steppe's do (owner,
 * 2026-10-28; China's fox spirits taken out).
 */
export type RegionId = 'steppe' | 'china' | 'persia';
export const REGIONS: Record<RegionId, {heroes: HeroId[]; creature: HeroId | null}> = {
  steppe: {heroes: ['mangudai', 'bokh', 'storm'], creature: 'wolf'},
  china: {heroes: ['youxia', 'modao', 'alchemist'], creature: null},
  persia: {heroes: ['archer', 'mahout', 'magus'], creature: null},
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
 * `provision`: winning it earns a provision, assigned at the caravanserai
 * before the next (progression.md, 19.2: a region's stages 1 and 2).
 * `passive`: winning it, the region's last, offers a passive at the
 * caravanserai on the way to the next region (19.3's passive slot, alone
 * for now: three of the pool at random, one taken).
 * `map`: the id of the map it is fought on (MAPS in map.ts): the Steppe's
 * stages on the Steppe Crossing, China's in the Gobi Desert (`gobi`; owner,
 * 2026-10-28; the Flaming Mountains, `flaming`, from 2026-10-26, kept so
 * a run saved there still loads), Persia's on the Salt Flats (`salt`).
 */
export interface Stage {
  region: RegionId;
  heroes: number;
  outsiders: number;
  creatures: number;
  provision: boolean;
  passive: boolean;
  map: string;
}
export const STAGES: Stage[] = [
  {
    region: 'steppe',
    heroes: 1,
    outsiders: 0,
    creatures: 2,
    provision: true,
    passive: false,
    map: 'steppe',
  },
  {
    region: 'steppe',
    heroes: 2,
    outsiders: 0,
    creatures: 1,
    provision: true,
    passive: false,
    map: 'steppe',
  },
  {
    region: 'steppe',
    heroes: 3,
    outsiders: 0,
    creatures: 0,
    provision: false,
    passive: true,
    map: 'steppe',
  },
  {
    region: 'china',
    heroes: 1,
    outsiders: 2,
    creatures: 0,
    provision: true,
    passive: false,
    map: 'gobi',
  },
  {
    region: 'china',
    heroes: 2,
    outsiders: 1,
    creatures: 0,
    provision: true,
    passive: false,
    map: 'gobi',
  },
  {
    region: 'china',
    heroes: 3,
    outsiders: 0,
    creatures: 0,
    provision: false,
    passive: true,
    map: 'gobi',
  },
  {
    region: 'persia',
    heroes: 1,
    outsiders: 2,
    creatures: 0,
    provision: true,
    passive: false,
    map: 'salt',
  },
  {
    region: 'persia',
    heroes: 2,
    outsiders: 1,
    creatures: 0,
    provision: true,
    passive: false,
    map: 'salt',
  },
  {
    region: 'persia',
    heroes: 3,
    outsiders: 0,
    creatures: 0,
    provision: false,
    passive: false,
    map: 'salt',
  },
];
/** How many passives the caravanserai between regions offers, one to be taken. */
export const PASSIVE_OFFER = 3;
/** How many of a run's first stages always have mountains (owner, 2026-10-24; randomTiles). */
export const MOUNTAIN_STAGES = 3;
/** The player's camel, after the party in slot order; the enemy has none (camel.md). */
export const CAMEL: HeroId = 'camel';
