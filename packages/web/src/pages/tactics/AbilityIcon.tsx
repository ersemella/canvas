import type {AbilityDef, AbilityId, AbilityKind} from '@canvas/games-silk-road-run';

/** What has an icon: every ability but Hold, and Move. */
export type IconId = Exclude<AbilityId, 'hold'> | 'move';

/** An ability's kind, or walking's, for the icons' colours. */
type IconKind = AbilityKind | 'move';

interface Icon {
  /** 12×12 art pixels: `#` its colour, `=` its shade, `+` its accent. */
  rows: string[];
  /** Its colour, shade and accent; its kind's unless it says otherwise. */
  kind?: IconKind;
  colors?: [string, string, string];
}

/**
 * Each ability's own icon, drawn as the pixel art is (owner, 2026-10-21;
 * one icon per kind until then). Simple shapes read at 12×12: Throw, Pin
 * and Lunge as figures didn't.
 */
const ICON: Partial<Record<IconId, Icon>> & Record<'move', Icon> = {
  move: {
    kind: 'move',
    rows: [
      '............', //
      '......#.....',
      '......##....',
      '......###...',
      '......####..',
      '###########.',
      '###########.',
      '......####..',
      '......###...',
      '......##....',
      '......#.....',
      '............',
    ],
  },
  // A bow drawn, its string the accent.
  longshot: {
    kind: 'attack',
    rows: [
      '..##........', //
      '..+.#.......',
      '..+..#......',
      '..+...#.....',
      '=.+...#..#..',
      '###########.',
      '=.+...#..#..',
      '..+...#.....',
      '..+..#......',
      '..+.#.......',
      '..##........',
      '............',
    ],
  },
  // The bow drawn, and a step to one side under it.
  skirmish: {
    kind: 'attack',
    rows: [
      '..##........', //
      '..+.#.......',
      '..+..#......',
      '..+...#..#..',
      '############',
      '..+...#..#..',
      '..+..#......',
      '..+.#.......',
      '..##........',
      '.......=....',
      '=========...',
      '.......=....',
    ],
  },
  // The sun, rays out.
  sunlight: {
    kind: 'support',
    rows: [
      '.....+......', //
      '.+...+...+..',
      '..+.....+...',
      '....###.....',
      '...#####....',
      '++.#####.++.',
      '...#####....',
      '....###.....',
      '..+.....+...',
      '.+...+...+..',
      '.....+......',
      '............',
    ],
  },
  // A white cloud dropping hail's sky blue.
  hail: {
    colors: ['var(--c-ivory)', 'var(--c-dusk4)', 'var(--c-sky)'],
    rows: [
      '.....###....', //
      '...#######..',
      '.##########.',
      '############',
      '.=========..',
      '............',
      '.++..++..++.',
      '.++..++..++.',
      '............',
      '...++..++...',
      '...++..++...',
      '............',
    ],
  },
  // Over and down.
  throw: {
    kind: 'attack',
    rows: [
      '............', //
      '............',
      '..######....',
      '.########...',
      '##......##..',
      '##......##..',
      '##......##..',
      '##....######',
      '##.....####.',
      '##......##..',
      '............',
      '............',
    ],
  },
  // Two links locked together, held until they part.
  grapple: {
    kind: 'control',
    rows: [
      '............', //
      '.######.....',
      '#......#....',
      '#......#....',
      '#......#....',
      '#....======.',
      '.######....=',
      '....=......=',
      '....=......=',
      '....=......=',
      '.....======.',
      '............',
    ],
  },
  // A hand's two chevrons, driving out.
  shove: {
    kind: 'control',
    rows: [
      '............', //
      '.##....##...',
      '..##....##..',
      '...##....##.',
      '....##....##',
      '.....##....#',
      '.....##....#',
      '....##....##',
      '...##....##.',
      '..##....##..',
      '.##....##...',
      '............',
    ],
  },
  // A rope with a hook at its end, drawn in.
  haul: {
    kind: 'control',
    rows: [
      '............', //
      '.......###..',
      '......#...#.',
      '..........#.',
      '.........#..',
      '.+......#...',
      '++======#...',
      '.+..........',
      '............',
      '............',
      '............',
      '............',
    ],
  },
  // An arrow loosed forward, and a step back under it.
  feignedRetreat: {
    kind: 'attack',
    rows: [
      '............', //
      '.........#..',
      '..........#.',
      '############',
      '..........#.',
      '.........#..',
      '............',
      '....=.......',
      '...=........',
      '..=========.',
      '...=........',
      '....=.......',
    ],
  },
  // Three arrows falling from above.
  volley: {
    kind: 'attack',
    rows: [
      '.+...+...+..', //
      '.#...#...#..',
      '.#...#...#..',
      '.#...#...#..',
      '.#...#...#..',
      '.#...#...#..',
      '###.###.###.',
      '.#...#...#..',
      '............',
      '============',
      '............',
      '............',
    ],
  },
  // Gusts of wind curling away.
  gale: {
    colors: ['var(--c-ivory)', 'var(--c-dusk4)', 'var(--c-sky)'],
    rows: [
      '............', //
      '.......##...',
      '.........#..',
      '########.#..',
      '........#...',
      '............',
      '++++++++++..',
      '..........+.',
      '.######...+.',
      '.......#.+..',
      '......#.....',
      '............',
    ],
  },
  // Jaws closing.
  bite: {
    kind: 'attack',
    rows: [
      '............', //
      '############',
      '############',
      '.#.#.#.#.#.#',
      '............',
      '............',
      '............',
      '#.#.#.#.#.#.',
      '############',
      '############',
      '............',
      '............',
    ],
  },
};

/**
 * Each kind's colour, shade and accent, from the palette: damage's light
 * madder, walking's ivory, the harmful statuses' gold, and Enhance's
 * jade under a bright sun.
 */
const KIND_COLORS: Record<IconKind, [string, string, string]> = {
  attack: ['var(--c-madderLight)', 'var(--c-madder)', 'var(--c-ivory)'],
  move: ['var(--c-ivory)', 'var(--c-dusk4)', 'var(--c-lapisLight)'],
  control: ['var(--c-gold)', 'var(--c-goldDark)', 'var(--c-skyLight)'],
  support: ['var(--c-goldLight)', 'var(--c-gold)', 'var(--c-jade)'],
};

export const KIND_NAME: Record<AbilityKind, string> = {
  attack: 'Attack',
  control: 'Control',
  support: 'Support',
};

/**
 * An ability's icon, `px` screen pixels to an art pixel; decorative,
 * before the name, spaced by a margin so the text still starts with it.
 */
export function AbilityIcon({id, px = 2}: {id: IconId; px?: number}) {
  // The balance experiments' abilities (in no kit) have no icon of their own.
  const {rows, kind, colors} = ICON[id] ?? ICON.move;
  const fill = colors ?? KIND_COLORS[kind!];
  return (
    <svg
      width={12 * px}
      height={12 * px}
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      aria-hidden
      style={{
        flex: 'none',
        display: 'inline-block',
        verticalAlign: '-0.2em',
        marginRight: '0.35em',
      }}
      data-icon={id}
    >
      {rows.flatMap((row, y) =>
        [...row].map((c, x) => {
          const i = '#=+'.indexOf(c);
          return i < 0 ? null : (
            <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill={fill[i]} />
          );
        })
      )}
    </svg>
  );
}

/** An ability's icon, or nothing for Hold. */
export function abilityIcon(def: AbilityDef) {
  return def.id === 'hold' ? null : <AbilityIcon id={def.id} />;
}
