/**
 * What a hex does, in words, for the page's inspector and the board's
 * tooltip (D11: everything on the board can be looked up). Built from the
 * rule values, so the text follows config.ts.
 */
import {RULES} from './config';
import type {Tile} from './map';
import type {HailEffect} from './types';

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
    detail: `Blocks movement and arrows. A unit knocked into it takes ${RULES.collisionDamage} damage.`,
  },
  hazard: {
    name: 'Quicksand',
    short: `${RULES.hazardEnterDamage} damage on entering, ${RULES.hazardDamage} every slot`,
    detail: `${RULES.hazardEnterDamage} damage on entering, passing through too, then ${RULES.hazardDamage} every slot a unit stays.`,
  },
  conceal: {
    name: 'Sandstorm',
    short: 'Obscured: ranged abilities can’t target in or through it',
    detail: 'A unit here is Obscured.',
  },
};

/** The four exits (camel.md, 18.2): not a tile but the camel's goal, said beside its tile. */
export const EXIT_INFO: HexInfo = {
  name: 'Road out',
  short: 'Your camel reaching it wins',
  detail: 'The road out: your camel reaching any of these four spaces wins the fight.',
};

/** What the camel does, in place of a hero's abilities (camel.md, 18.1, 18.2). */
export const CAMEL_RULE = `Can’t attack. Moves 1 space a turn, at a typical action’s cost (${RULES.cost.typical}). Reaching the road out wins the fight; if it falls, the fight is lost.`;

/** How long an effect on a hex lasts: said last, after what it does. */
function slotsLeft(left: number): string {
  return `${left} slot${left === 1 ? '' : 's'} left.`;
}

export function hailInfo(hail: HailEffect, currentSlot: number): HexInfo {
  const left = hail.untilSlot - currentSlot + 1;
  return {
    name: 'Hail',
    short: `${hail.damage ?? 0} damage, Slowed ${hail.slowed}`,
    detail: `${hail.damage ?? 0} damage and Slowed ${hail.slowed} for ${hail.statusSlots} slots to a unit here when it lands, enters or starts a turn. ${slotsLeft(left)}`,
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
  | 'slots'
  | 'charged'
  | 'ultimate'
  | 'melee'
  | 'immobilized'
  | 'slowed'
  | 'vulnerable'
  | 'taunted'
  | 'crushed'
  | 'flanked'
  | 'obscured'
  | 'cleanse';

export const KEYWORD_INFO: Record<KeywordId, {name: string; detail: string}> = {
  speed: {name: 'Speed', detail: 'Higher speed: actions cost fewer slots, so turns come sooner.'},
  power: {
    name: 'Power',
    detail: 'Scales damage and healing. Already counted in the numbers shown.',
  },
  defence: {
    name: 'Defence',
    detail: `Cuts damage taken: ${RULES.defenceConstant} defence halves it.`,
  },
  slots: {
    name: 'Cost',
    detail: 'Slots until its next turn. A taken slot pushes the card to the next free one.',
  },
  charged: {
    name: 'Charged',
    detail: 'Goes off when the charge runs out, then the recovery passes before its next turn.',
  },
  ultimate: {
    name: 'Ultimate',
    detail: `Once a fight, after ${RULES.ultimateCharge} action cost spent.`,
  },
  melee: {name: 'Melee', detail: 'Targets a unit next to the user.'},
  immobilized: {
    name: 'Immobilized',
    detail: 'Can’t move, or use abilities that move it. Can still act and be knocked away.',
  },
  slowed: {
    name: 'Slowed',
    detail: `Moves this many fewer spaces (normally ${RULES.movementCap}, at least 1).`,
  },
  vulnerable: {
    name: 'Vulnerable',
    detail: 'Takes this much more damage. Only the largest counts.',
  },
  taunted: {
    name: 'Taunted',
    detail: 'Must attack the taunter, or end its turn, while it can reach it.',
  },
  crushed: {name: 'Crushed', detail: 'Takes this much damage every slot.'},
  flanked: {
    name: 'Flanked',
    detail: `Enemies on opposite sides: Vulnerable ${RULES.flankVulnerable}% while they stay.`,
  },
  obscured: {
    name: 'Obscured',
    detail:
      'In a sandstorm: ranged abilities can’t target it, or anyone past it, and it can’t shoot a bow out.',
  },
  cleanse: {name: 'Cleanse', detail: 'Removes harmful statuses from abilities.'},
};
