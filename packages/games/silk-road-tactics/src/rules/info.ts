/**
 * What a hex does, in words, for the page's inspector and the board's
 * tooltip (D11: everything on the board can be looked up). Built from the
 * rule values, so the text follows config.ts.
 */
import {RULES} from './config';
import type {Tile} from './map';
import type {FogEffect, HailEffect} from './types';

export interface HexInfo {
  name: string;
  /** A few words, for the board's tooltip. */
  short: string;
  /** The full rule, for the side panel. */
  detail: string;
}

const obscured = Math.round(RULES.obscuredReduction * 100);
/** An Obscured attacker hitting an Obscured target: both cuts, one after the other. */
const bothObscured = Math.round((1 - (1 - RULES.obscuredReduction) ** 2) * 100);

export const TILE_INFO: Record<Tile, HexInfo> = {
  sand: {name: 'Sand', short: 'Open ground', detail: 'Open ground: no effect.'},
  obstacle: {
    name: 'Ruins',
    short: 'Blocks movement and arrows',
    detail: `Impassable. Blocks movement, arrows and line of fire. A unit displaced into ruins takes ${RULES.collisionDamage} damage (ignores defence).`,
  },
  hazard: {
    name: 'Quicksand',
    short: `${RULES.hazardEnterDamage} damage on entering, ${RULES.hazardDamage} every slot`,
    detail: `${RULES.hazardEnterDamage} damage to a unit entering it, passing through included, then ${RULES.hazardDamage} every slot it stands here, whoever's turn it is, through Vulnerable and defence.`,
  },
  conceal: {
    name: 'Sandstorm',
    short: `Obscured: ranged hits in or out deal ${obscured}% less`,
    detail: `Obscured: ranged hits on a unit here deal ${obscured}% less, and so do ranged hits by a unit here. Doesn't block arrows or line of fire, and the unit stays visible.`,
  },
};

export function hailInfo(hail: HailEffect, currentSlot: number): HexInfo {
  const left = hail.untilSlot - currentSlot + 1;
  return {
    name: 'Hail',
    short: `${hail.damage ?? 0} damage, Slowed ${hail.slowed}`,
    detail: `For ${left} more slot${left === 1 ? '' : 's'}: a unit here when it lands, entering it or starting its turn here takes ${hail.damage ?? 0} damage (before Vulnerable and defence), then is Slowed ${hail.slowed} for ${hail.statusSlots} slots.`,
  };
}

export function fogInfo(fog: FogEffect, currentSlot: number): HexInfo {
  const left = fog.untilSlot - currentSlot + 1;
  return {
    name: 'Fog',
    short: `Obscured: ranged hits in or out deal ${obscured}% less`,
    detail: `For ${left} more slot${left === 1 ? '' : 's'}, Obscured: ranged hits on a unit here deal ${obscured}% less (not on top of a sandstorm), and so do ranged hits by a unit here. Doesn't block arrows or line of fire.`,
  };
}

/**
 * The words the stat sheet marks as keywords, statuses and stats alike:
 * tapping one shows its rule (keywords.md, section 17). Built from the rule
 * values like the tiles'.
 */
export type KeywordId =
  | 'health'
  | 'speed'
  | 'power'
  | 'defence'
  | 'slots'
  | 'duration'
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
  health: {name: 'Health', detail: 'The unit falls when it reaches 0.'},
  speed: {
    name: 'Speed',
    detail:
      'How soon its turns come: the higher its speed, the fewer slots each action costs it, so it acts more often.',
  },
  power: {
    name: 'Power',
    detail:
      'Raises its damage and healing: each 50 power adds the ability’s base amount once more. The numbers shown already include it.',
  },
  defence: {
    name: 'Defence',
    detail: `Cuts damage it takes: by defence ÷ (defence + ${RULES.defenceConstant}), after Vulnerable.`,
  },
  slots: {
    name: 'Cost in slots',
    detail:
      'How far along the track its card moves: its next turn comes this many slots from now. If that slot is taken, the card goes to the next free one.',
  },
  duration: {
    name: 'Duration',
    detail: 'How many slots its effect stays on the board or the units.',
  },
  charged: {
    name: 'Charged',
    detail:
      'The card first moves by the charge cost, and the ability goes off when it’s reached; then the card moves again by the recovery cost.',
  },
  ultimate: {
    name: 'Ultimate',
    detail: `A hero’s strongest ability, once a fight: ready once it has spent ${RULES.ultimateCharge} action cost on its turns (moves included, not a Hold that stays put).`,
  },
  melee: {name: 'Melee', detail: 'Aimed at a unit on a space next to the user.'},
  immobilized: {
    name: 'Immobilized',
    detail:
      'Can’t move, or use an ability that moves it. It still acts, and can still be knocked or thrown elsewhere.',
  },
  slowed: {
    name: 'Slowed',
    detail: `Moves this many spaces fewer on a Move turn (at least 1; normally ${RULES.movementCap}).`,
  },
  vulnerable: {
    name: 'Vulnerable',
    detail: `Takes this much more damage, before defence. Being flanked makes a unit Vulnerable ${RULES.flankVulnerable}%; only the larger counts.`,
  },
  taunted: {
    name: 'Taunted',
    detail:
      'While it can reach the unit that taunted it, it must attack that unit or end its turn. Ends early if the taunter falls.',
  },
  crushed: {
    name: 'Crushed',
    detail: 'Takes this much damage every slot, through Vulnerable and defence.',
  },
  flanked: {
    name: 'Flanked',
    detail: `Two enemies stand on opposite sides of it: it’s Vulnerable ${RULES.flankVulnerable}% while they do.`,
  },
  obscured: {
    name: 'Obscured',
    detail: `In a sandstorm or fog: ranged hits on it, and ranged hits by it, deal ${obscured}% less (${bothObscured}% less when both are). Melee, hail and quicksand are unaffected.`,
  },
  cleanse: {
    name: 'Cleanse',
    detail: 'Removes the harmful statuses abilities put on it (not a flank’s Vulnerable).',
  },
};
