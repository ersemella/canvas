/**
 * What a hex does, in words, for the page's inspector and the board's
 * tooltip (D11: everything on the board can be looked up). Built from the
 * rule values, so the text follows config.ts.
 */
import {HEROES} from './config';
import {hailEnds} from './resolve';
import type {Tile} from './map';
import type {FightState, HailEffect, ShotInAir} from './types';

export interface HexInfo {
  name: string;
  /** A few words, for the board's tooltip. */
  short: string;
  /** The full rule, for the side panel. */
  detail: string;
}

export const TILE_INFO: Record<Tile, HexInfo> = {
  sand: {name: 'Grass', short: 'Open ground', detail: 'No effect.'},
  obstacle: {
    name: 'Yurt',
    short: 'Blocks movement and arrows',
    detail: 'Blocks movement and arrows.',
  },
  mountain: {
    name: 'Mountains',
    short: 'Blocks movement and arrows',
    detail: 'Blocks movement and arrows.',
  },
};

/**
 * Where a map's look renames a tile (map.ts): the Gobi's open ground is
 * gravel and its yurts are ruins of the old frontier posts; the Flaming
 * Mountains' is red earth, their yurts the ruins of Gaochang and their
 * mountains on fire, though they block as any do.
 */
const MAP_TILE_INFO: Record<string, Partial<Record<Tile, HexInfo>>> = {
  gobi: {
    sand: {name: 'Gravel', short: 'Open ground', detail: 'No effect.'},
    obstacle: {
      name: 'Ruins',
      short: 'Blocks movement and arrows',
      detail: 'Blocks movement and arrows.',
    },
  },
  flaming: {
    sand: {name: 'Red earth', short: 'Open ground', detail: 'No effect.'},
    obstacle: {
      name: 'Ruins',
      short: 'Blocks movement and arrows',
      detail: 'Blocks movement and arrows.',
    },
    mountain: {
      name: 'Flaming Mountains',
      short: 'Blocks movement and arrows',
      detail: 'Blocks movement and arrows.',
    },
  },
};

/** What a tile is called and does on the map `mapId`. */
export function tileInfo(mapId: string, tile: Tile): HexInfo {
  return MAP_TILE_INFO[mapId]?.[tile] ?? TILE_INFO[tile];
}

/** The exit (camel.md, 18.2): not a tile but the camel's goal, said beside its tile. */
export const EXIT_INFO: HexInfo = {
  name: 'Road out',
  short: `${HEROES.camel.name} reaching it wins`,
  detail: `${HEROES.camel.name} reaching it wins.`,
};

/** What the camel does, in place of a hero's abilities (camel.md, 18.1, 18.2; timeline.md, 3.2). */
export const CAMEL_RULE = `Can’t attack. Walks 1 space a turn toward the road out, around anything in its way. Reaching it wins; falling loses.`;

export function hailInfo(hail: HailEffect, state: FightState): HexInfo {
  const caster = state.units.find((u) => u.id === hail.source);
  const until = hailEnds(
    hail.turns ?? 1,
    caster ? `the ${HEROES[caster.hero].name}’s` : 'its caster’s'
  );
  return {
    name: 'Hail',
    short: 'Immobilizes a unit that enters it',
    detail: `Units here or entering are Immobilized until ${until}.`,
  };
}

export function shotInfo(shot: ShotInAir, state: FightState): HexInfo {
  const archer = state.units.find((u) => u.id === shot.source);
  const who = archer ? `the ${HEROES[archer.hero].name}’s` : 'its archer’s';
  const damage = archer ? `${archer.power} damage` : 'its damage';
  if (shot.hex)
    return {
      name: 'Volley',
      short: 'Lands here when its card comes back',
      detail: `Lands when ${who} charging card comes back: ${damage} to whoever is here.`,
    };
  return {
    name: 'Drawn arrow',
    short: 'Flies down this line when its card comes back',
    detail: `Flies when ${who} charging card comes back: ${damage} to the first unit in this line.`,
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
  | 'enhanced'
  | 'degraded'
  | 'shield'
  | 'move'
  | 'push'
  | 'pull';

export const KEYWORD_INFO: Record<KeywordId, {name: string; detail: string}> = {
  speed: {
    name: 'Speed',
    detail: 'Lowers action cost: the faster act more often, and first.',
  },
  power: {name: 'Power', detail: 'Damage its abilities deal.'},
  defence: {name: 'Defence', detail: 'Raises health.'},
  melee: {name: 'Melee', detail: 'Targets a unit next to you.'},
  immobilized: {
    name: 'Immobilized',
    detail: 'Can’t walk. Can still act and be Moved.',
  },
  stunned: {
    name: 'Stunned',
    detail: 'Turns skipped.',
  },
  enhanced: {
    name: 'Enhanced',
    detail: 'Its abilities deal that much more damage until the end of its next turn.',
  },
  degraded: {
    name: 'Degraded',
    detail:
      'Its abilities deal that much less damage, to at least 0, until the end of its next turn.',
  },
  shield: {
    name: 'Shield',
    detail: 'Takes damage before health, until the start of its next turn.',
  },
  move: {name: 'Move', detail: 'Put on another space by others, not walking.'},
  push: {
    name: 'Push',
    detail: 'Moved that many spaces straight away, stopping at anything in the way.',
  },
  pull: {
    name: 'Pull',
    detail: 'Moved that many spaces straight toward it, stopping at anything in the way.',
  },
};
