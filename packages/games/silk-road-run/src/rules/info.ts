/**
 * What a hex does, in words, for the page's inspector and the board's
 * tooltip (D11: everything on the board can be looked up). Built from the
 * rule values, so the text follows config.ts.
 */
import {HEROES, RULES} from './config';
import type {Tile} from './map';
import type {FightState, HailEffect} from './types';

export interface HexInfo {
  name: string;
  /** A few words, for the board's tooltip. */
  short: string;
  /** The full rule, for the side panel. */
  detail: string;
}

export const TILE_INFO: Record<Tile, HexInfo> = {
  sand: {name: 'Sand', short: 'Open ground', detail: 'Open ground: no effect.'},
  obstacle: {
    name: 'Ruins',
    short: 'Blocks movement and arrows',
    detail: 'Blocks movement and arrows.',
  },
};

/** The exit (camel.md, 18.2): not a tile but the camel's goal, said beside its tile. */
export const EXIT_INFO: HexInfo = {
  name: 'Road out',
  short: `${HEROES.camel.name} reaching it wins`,
  detail: `The road out: ${HEROES.camel.name} reaching it wins the fight.`,
};

/** What the camel does, in place of a hero's abilities (camel.md, 18.1, 18.2; timeline.md, 3.2). */
export const CAMEL_RULE = `Can’t attack, and walks itself: 1 space a turn toward the exit, around anything in its way, its card then going its action cost on, like any unit’s. Reaching the road out wins the fight; if it falls, the fight is lost.`;

export function hailInfo(hail: HailEffect, state: FightState): HexInfo {
  const caster = state.units.find((u) => u.id === hail.source);
  const until = caster ? `${HEROES[caster.hero].name}’s next turn` : 'its caster’s next turn';
  return {
    name: 'Hail',
    short: 'Immobilizes a unit that enters it',
    detail: `A unit here, or that enters it, is Immobilized until the hail is gone: at ${until}.`,
  };
}

/**
 * The words the stat sheet marks as keywords, statuses and stats alike:
 * tapping one shows its rule (keywords.md, section 17). Built from the rule
 * values like the tiles'.
 */
export type KeywordId =
  | 'speed'
  | 'power'
  | 'defence'
  | 'melee'
  | 'immobilized'
  | 'stunned'
  | 'move';

export const KEYWORD_INFO: Record<KeywordId, {name: string; detail: string}> = {
  speed: {
    name: 'Speed',
    detail: `Sets the action cost: after each turn, the card goes ${RULES.actionBase} − ${RULES.speedSlots} × speed slots on, so the faster act more often. The fight starts with the fastest cards first, ${HEROES.camel.name}’s last.`,
  },
  power: {name: 'Power', detail: 'The damage each of its abilities deals.'},
  defence: {name: 'Defence', detail: 'Sets health: (1 + defence) × 2.'},
  melee: {name: 'Melee', detail: 'Targets a unit next to the user.'},
  immobilized: {
    name: 'Immobilized',
    detail: 'Can’t move to a different space by itself. Can still act, and be moved by others.',
  },
  stunned: {
    name: 'Stunned',
    detail: 'Can’t take any action, moving included: its turns are skipped.',
  },
  move: {name: 'Move', detail: 'Put on another space by someone else, not walking.'},
};
