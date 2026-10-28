/**
 * What a hex does, in words, for the page's inspector and the board's
 * tooltip (D11: everything on the board can be looked up). Built from the
 * rule values, so the text follows config.ts.
 */
import {ABILITY, HEROES, RULES} from './config';
import {hailEnds} from './resolve';
import type {Tile} from './map';
import type {FightState, FireEffect, HailEffect, ShotInAir} from './types';

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
    name: 'Tent',
    short: 'Blocks movement and arrows',
    detail: 'Blocks movement and arrows.',
  },
  mountain: {
    name: 'Mountains',
    short: 'Blocks movement and arrows',
    detail: 'Blocks movement and arrows.',
  },
  // The Flaming Mountains' (map.ts, `scorched`; owner, 2026-10-28).
  scorched: {
    name: 'Scorched ground',
    short: `Burns ${RULES.scorch} when Moved here or ending a turn here`,
    detail: `A unit Moved here, or ending its turn here, takes ${RULES.scorch} damage. Walking across doesn’t burn.`,
  },
};

/**
 * Where a map's look renames a tile (map.ts): the Gobi's open ground is
 * sand and its yurts are oases (owner, 2026-10-28; ruins of the old
 * frontier posts on gravel before); the Flaming
 * Mountains' is red earth, a yurt placed there by hand a ruin and their
 * mountains on fire, though they block as any do; the Salt Flats' is salt,
 * their mountains one salt dome and a yurt placed there by hand a ruin;
 * the Fairy Chimneys' is tuff and their yurts fairy chimneys; the
 * Cyclops's cave's is its stone floor.
 */
const MAP_TILE_INFO: Record<string, Partial<Record<Tile, HexInfo>>> = {
  gobi: {
    sand: {name: 'Sand', short: 'Open ground', detail: 'No effect.'},
    obstacle: {
      name: 'Oasis',
      short: 'Blocks movement and arrows',
      detail: 'Blocks movement and arrows.',
    },
  },
  salt: {
    sand: {name: 'Salt flat', short: 'Open ground', detail: 'No effect.'},
    obstacle: {
      name: 'Ruins',
      short: 'Blocks movement and arrows',
      detail: 'Blocks movement and arrows.',
    },
    mountain: {
      name: 'Salt dome',
      short: 'Blocks movement and arrows',
      detail: 'Blocks movement and arrows.',
    },
  },
  tuff: {
    sand: {name: 'Tuff', short: 'Open ground', detail: 'No effect.'},
    obstacle: {
      name: 'Fairy chimney',
      short: 'Blocks movement and arrows',
      detail: 'Blocks movement and arrows.',
    },
  },
  flaming: {
    sand: {name: 'Red earth', short: 'Open ground', detail: 'No effect.'},
    obstacle: {
      name: 'Beacon tower',
      short: 'Blocks movement and arrows',
      detail: 'Blocks movement and arrows.',
    },
    mountain: {
      name: 'Burning mountains',
      short: 'Blocks movement and arrows',
      detail: 'Blocks movement and arrows.',
    },
  },
};
// China's boss's Flaming Mountains (map.ts, `FIRE_MOUNTAIN`), and `ridges`, a fight saved there before.
MAP_TILE_INFO.fireMountain = MAP_TILE_INFO.flaming!;
MAP_TILE_INFO.ridges = MAP_TILE_INFO.flaming!;
// The Cyclops's cave (map.ts, `CAVE`): nothing stands on its floor.
MAP_TILE_INFO.cave = {sand: {name: 'Cave floor', short: 'Open ground', detail: 'No effect.'}};

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
    short: ABILITY.hail.entry
      ? 'Hits and Immobilizes a unit that enters it'
      : 'Immobilizes a unit that enters it',
    detail: `Units here or entering are Immobilized until ${until}${ABILITY.hail.entry ? `; entering takes ${caster ? caster.power : 'its caster’s power'} damage` : ''}.`,
  };
}

/** A burning space (`FireEffect`): until Princess Iron Fan's next turn, or for good once she has fallen. */
export function fireInfo(fire: FireEffect, state: FightState): HexInfo {
  const lady = state.units.find((u) => u.id === fire.source);
  const n = ABILITY.fanFlames.burn;
  const until = lady?.alive
    ? `It goes out at the start of ${HEROES[lady.hero].name}’s next turn.`
    : 'Its fanner has fallen: it burns until put out with her fan.';
  return {
    name: 'Fire',
    short: `Burns ${n} on a unit entering it`,
    detail: `A unit entering it, walking or Moved, takes ${n} damage. ${until}`,
  };
}

/** The fan Princess Iron Fan drops where she falls (`FightState.fan`). */
export const FAN_INFO: HexInfo = {
  name: 'Iron Fan',
  short: 'A hero entering picks it up',
  detail:
    'Dropped by Princess Iron Fan. A hero entering this space picks it up, and may spend a turn with it putting out every fire on the board.',
};

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
  | 'empowered'
  | 'weakened'
  | 'haste'
  | 'shield'
  | 'unstoppable'
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
  empowered: {
    name: 'Empowered',
    detail: 'Its abilities deal that much more damage until the end of its next turn.',
  },
  weakened: {
    name: 'Weakened',
    detail:
      'Its abilities deal that much less damage, to at least 0, until the end of its next turn.',
  },
  shield: {
    name: 'Shield',
    detail: 'Takes damage before health, until the start of its next turn.',
  },
  unstoppable: {
    name: 'Unstoppable',
    detail:
      'Can’t be Pushed, Pulled, Immobilized or Stunned, so it can’t be grappled and hail doesn’t stop its walk.',
  },
  haste: {
    name: 'Haste',
    detail:
      'Its card moves that many slots earlier on the track, never earlier than the next slot.',
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
