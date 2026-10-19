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

const conceal = Math.round(RULES.concealReduction * 100);

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
    detail: `${RULES.hazardEnterDamage} damage to a unit entering it, passing through included, then ${RULES.hazardDamage} every slot it stands here, whoever's turn it is. Ignores defence; Vulnerable still adds.`,
  },
  conceal: {
    name: 'Sandstorm',
    short: `Ranged hits deal ${conceal}% less`,
    detail: `Ranged attacks against a unit standing here deal ${conceal}% less damage. Doesn't block arrows or line of fire, and the unit stays visible.`,
  },
};

export function hailInfo(hail: HailEffect, currentSlot: number): HexInfo {
  const left = hail.untilSlot - currentSlot + 1;
  return {
    name: 'Hail',
    short: `${hail.damage ?? 0} damage, Slowed ${hail.slowed}`,
    detail: `For ${left} more slot${left === 1 ? '' : 's'}: a unit here when it lands, entering it or starting its turn here takes ${hail.damage ?? 0} damage (before Vulnerable and defence), then is Slowed ${hail.slowed} and Vulnerable ${hail.vulnerable}% for ${hail.statusSlots} slots.`,
  };
}
