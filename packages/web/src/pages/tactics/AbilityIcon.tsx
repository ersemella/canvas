import type {AbilityDef, AbilityId, AbilityKind} from '@canvas/games-silk-road-run';

/** What has an icon: every ability but Hold, and Move. */
export type IconId = Exclude<AbilityId, 'hold'> | 'move';

interface Icon {
  /** 12×12 art pixels: `#` its colour, `=` its shade, `+` its accent. */
  rows: string[];
  /** Its colour, shade and accent; its kind's unless it says otherwise. */
  kind?: AbilityKind;
  colors?: [string, string, string];
}

/**
 * Each ability's own icon, drawn as the pixel art is (owner, 2026-10-21;
 * one icon per kind until then). Simple shapes read at 12×12: Throw, Pin
 * and Rampage as figures didn't.
 */
const ICON: Record<IconId, Icon> = {
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
  bow: {
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
  // A jump's arc, landing.
  leap: {
    kind: 'move',
    rows: [
      '............', //
      '...####.....',
      '.##....##...',
      '.#.......#..',
      '#........#..',
      '#......#####',
      '#.......###.',
      '#........#..',
      '#...........',
      '............',
      '============',
      '............',
    ],
  },
  // Three arrows falling.
  volley: {
    kind: 'attack',
    rows: [
      '.=#=........', //
      '.......=#=..',
      '..#.......#.',
      '..#..=#=..#.',
      '..#...#...#.',
      '..#...#...#.',
      '..#...#...#.',
      '.###..#...#.',
      '..#...#..###',
      '......#...#.',
      '.....###....',
      '......#.....',
    ],
  },
  // A sun, yellow rather than health's jade.
  sunlight: {
    colors: ['var(--c-goldLight)', 'var(--c-gold)', 'var(--c-ivory)'],
    rows: [
      '.....##.....', //
      '.#...##...#.',
      '..#......#..',
      '....####....',
      '...######...',
      '##.######.##',
      '##.######.##',
      '...######...',
      '....####....',
      '..#......#..',
      '.#...##...#.',
      '.....##.....',
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
  // A snowflake, in ice's sky blue.
  freeze: {
    colors: ['var(--c-sky)', 'var(--c-lapisDark)', 'var(--c-skyLight)'],
    rows: [
      '.....##.....', //
      '.#..####..#.',
      '..#..##..#..',
      '...#.##.#...',
      '....####....',
      '#####++#####',
      '#####++#####',
      '....####....',
      '...#.##.#...',
      '..#..##..#..',
      '.#..####..#.',
      '.....##.....',
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
  // Pressed down.
  pin: {
    kind: 'control',
    rows: [
      '............', //
      '....####....',
      '....####....',
      '....####....',
      '..########..',
      '...######...',
      '....####....',
      '.....##.....',
      '............',
      '############',
      '############',
      '............',
    ],
  },
  // Rushing on.
  rampage: {
    kind: 'attack',
    rows: [
      '............', //
      '##....##....',
      '.##....##...',
      '..##....##..',
      '...##....##.',
      '....##....##',
      '....##....##',
      '...##....##.',
      '..##....##..',
      '.##....##...',
      '##....##....',
      '............',
    ],
  },
  // A banner raised: the call to fight.
  challenge: {
    kind: 'control',
    rows: [
      '............', //
      '.##.........',
      '.#######....',
      '.########...',
      '.#######....',
      '.######.....',
      '.##.........',
      '.##.........',
      '.##.........',
      '.##.........',
      '.##.........',
      '............',
    ],
  },
  // The long blade's sweep.
  reap: {
    kind: 'attack',
    rows: [
      '............', //
      '.......###..',
      '.........##.',
      '..........##',
      '..........##',
      '..........##',
      '.........##.',
      '.......###..',
      '......#.....',
      '.....#......',
      '....#.......',
      '............',
    ],
  },
  // A wall of blades.
  advance: {
    kind: 'attack',
    rows: [
      '............', //
      '.#..#..#..#.',
      '.#..#..#..#.',
      '.#..#..#..#.',
      '############',
      '############',
      '#..#..#..#.#',
      '############',
      '############',
      '.#..#..#..#.',
      '.#..#..#..#.',
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
 * madder, health's jade, ivory, and the harmful statuses' gold.
 */
const KIND_COLORS: Record<AbilityKind, [string, string, string]> = {
  attack: ['var(--c-madderLight)', 'var(--c-madder)', 'var(--c-ivory)'],
  heal: ['var(--c-jade)', 'var(--c-jadeDark)', 'var(--c-goldLight)'],
  move: ['var(--c-ivory)', 'var(--c-dusk4)', 'var(--c-lapisLight)'],
  control: ['var(--c-gold)', 'var(--c-goldDark)', 'var(--c-skyLight)'],
};

export const KIND_NAME: Record<AbilityKind, string> = {
  attack: 'Attack',
  heal: 'Heal',
  move: 'Movement',
  control: 'Control',
};

/**
 * An ability's icon, `px` screen pixels to an art pixel; decorative,
 * before the name, spaced by a margin so the text still starts with it.
 */
export function AbilityIcon({id, px = 2}: {id: IconId; px?: number}) {
  const {rows, kind, colors} = ICON[id];
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
