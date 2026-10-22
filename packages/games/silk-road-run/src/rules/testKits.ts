/**
 * For tests only. The heroes' kits from before the game was pared back for
 * balancing (owner, 2026-10-22): the parked abilities (the ultimates, Leap,
 * Sunlight and Throw) keep their rules, and their tests run with these.
 */
import {HEROES} from './config';
import type {AbilityId, HeroId} from './types';

const FULL_KITS: Partial<Record<HeroId, {abilities: AbilityId[]; ultimate: AbilityId}>> = {
  bokh: {abilities: ['grapple', 'shove', 'throw', 'lunge', 'hold'], ultimate: 'lunge'},
  mangudai: {abilities: ['bow', 'leap', 'volley', 'hold'], ultimate: 'volley'},
  storm: {abilities: ['sunlight', 'hail', 'freeze', 'hold'], ultimate: 'freeze'},
};

/** `test`, run with the full kits, and today's put back after. */
export function withFullKits(test: () => void): () => void {
  return () => {
    const heroes = Object.keys(FULL_KITS) as HeroId[];
    const saved = heroes.map((h) => ({...HEROES[h]}));
    for (const h of heroes) Object.assign(HEROES[h], FULL_KITS[h]);
    try {
      test();
    } finally {
      heroes.forEach((h, i) => {
        delete HEROES[h].ultimate;
        Object.assign(HEROES[h], saved[i]);
      });
    }
  };
}
