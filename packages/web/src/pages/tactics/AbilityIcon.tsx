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
  snapShot: {
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
  // Two clenched fists, side on, knuckles lit (owner, 2026-10-24; two
  // chain links until then).
  grapple: {
    kind: 'control',
    colors: ['var(--c-gold)', 'var(--c-goldDark)', 'var(--c-goldLight)'],
    rows: [
      '............', //
      '..++....++..',
      '.####..####.',
      '+##=#..#=##+',
      '#####..#####',
      '##===..===##',
      '###+#..#+###',
      '##===..===##',
      '###+#..#+###',
      '.##==..==##.',
      '..###..###..',
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
  // The long blade's sweep (the first Vanguard's Reap, 2026-10-22).
  cleave: {
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
  // A jian, the straight sword, drawn on the slant: its guard the accent, its grip the shade.
  swiftStrike: {
    kind: 'attack',
    rows: [
      '...........#', //
      '..........##',
      '.........##.',
      '........##..',
      '.......##...',
      '......##....',
      '.....##.....',
      '..+.##......',
      '...++.......',
      '..=+.+......',
      '.=..........',
      '=...........',
    ],
  },
  // Two stars meeting, the brighter one the accent.
  omen: {
    kind: 'control',
    rows: [
      '............', //
      '..#.........',
      '..#.........',
      '#####.......',
      '..#.....+...',
      '..#.....+...',
      '......+++++.',
      '........+...',
      '........+...',
      '...=........',
      '..===.......',
      '...=........',
    ],
  },
  // Alignment: three stars in a line, the middle one the accent.
  alignment: {
    kind: 'control',
    rows: [
      '............', //
      '.........#..',
      '........###.',
      '.........#..',
      '......=.....',
      '.....+......',
      '....+++.....',
      '.....+......',
      '....=.......',
      '..#.........',
      '.###........',
      '..#.........',
    ],
  },
  // An arrow flying over a block in its way, its fletching the accent.
  longshot: {
    kind: 'attack',
    rows: [
      '............', //
      '........#...',
      '........##..',
      '++.########.',
      '........##..',
      '........#...',
      '............',
      '....===.....',
      '...=====....',
      '...=====....',
      '...=====....',
      '............',
    ],
  },
  // A great axe on the slant, its edge the accent, its haft the shade.
  reave: {
    kind: 'attack',
    rows: [
      '............', //
      '......##....',
      '.....####+..',
      '....#####+..',
      '....=####+..',
      '...=..###+..',
      '...=...##...',
      '..=.........',
      '..=.........',
      '.=..........',
      '.=..........',
      '............',
    ],
  },
  // Hew: the same great axe, swung through a funnel.
  hew: {
    kind: 'attack',
    rows: [
      '............', //
      '......##....',
      '.....####+..',
      '....#####+..',
      '....=####+..',
      '...=..###+..',
      '...=...##...',
      '..=.........',
      '..=.........',
      '.=..........',
      '.=..........',
      '............',
    ],
  },
  // A great axe in flight, turned on its side, with lines behind it.
  axeThrow: {
    kind: 'attack',
    rows: [
      '............', //
      '.......###..',
      '......#####.',
      '=.....#####.',
      '......+###..',
      '==.====+....',
      '......+.....',
      '=.....+.....',
      '............',
      '............',
      '............',
      '............',
    ],
  },
  // The leap's arc, and the great axe coming down at its end.
  leap: {
    kind: 'attack',
    rows: [
      '............', //
      '...+.+......',
      '.+.......#..',
      '........###.',
      '+......####.',
      '......=###..',
      '+....=..#...',
      '....=.......',
      '+..=........',
      '..=.........',
      '............',
      '............',
    ],
  },
  // A knotted club, its studs the accent.
  smash: {
    kind: 'attack',
    rows: [
      '........###.', //
      '.......#####',
      '......##+###',
      '.....####+#.',
      '....#####...',
      '...###......',
      '..###.......',
      '.===........',
      '===.........',
      '==..........',
      '............',
      '............',
    ],
  },
  // A boulder in flight, the dust it trails the accent.
  boulder: {
    kind: 'attack',
    rows: [
      '............', //
      '......####..',
      '.....######.',
      '+...#######=',
      '.+..###=###=',
      '+.+.######==',
      '.+..#####==.',
      '+....#===...',
      '............',
      '............',
      '............',
      '............',
    ],
  },
  // A bull's horns, lowered to charge, their tips the accent.
  gore: {
    kind: 'attack',
    rows: [
      '+..........+', //
      '#..........#',
      '##........##',
      '.##......##.',
      '..###..###..',
      '...######...',
      '...#=##=#...',
      '...######...',
      '....####....',
      '....#==#....',
      '.....##.....',
      '............',
    ],
  },
  // A banana-leaf fan, its ribs the shade, the gust it blows the accent.
  bananaFan: {
    kind: 'control',
    rows: [
      '.....####...', //
      '...#######..',
      '..###=####.+',
      '.#####=###..',
      '.######=##.+',
      '..######=#..',
      '...######=.+',
      '....####=...',
      '.......==...',
      '........=...',
      '.........=..',
      '............',
    ],
  },
  // A flame fanned up, its heart the accent.
  fanFlames: {
    kind: 'control',
    colors: ['var(--c-madderLight)', 'var(--c-madder)', 'var(--c-goldLight)'],
    rows: [
      '.....#......', //
      '.....##.....',
      '....###..#..',
      '...####.##..',
      '..#######...',
      '..###+###...',
      '.###+++###..',
      '.##+++++##..',
      '.##+++++##..',
      '..#+++++#...',
      '...#####....',
      '............',
    ],
  },
  // The borrowed fan over a flame gone out, the smoke the accent.
  quench: {
    kind: 'support',
    rows: [
      '..+...+.....', //
      '.+...+......',
      '..+...+.....',
      '............',
      '...#######..',
      '..###=####..',
      '.#####=###..',
      '..######=#..',
      '....####=...',
      '.......==...',
      '........=...',
      '............',
    ],
  },
  // A serpent's head striking, jaws open, its forked tongue the accent.
  feed: {
    kind: 'attack',
    rows: [
      '............', //
      '.....####...',
      '....##=###..',
      '...###.###+.',
      '..###...+.+.',
      '..##.###....',
      '..##.####...',
      '..###.......',
      '...###......',
      '....=###....',
      '.....=####..',
      '.......===..',
    ],
  },
  // A serpent's head rising from a shoulder, new growth the accent.
  regrowSerpent: {
    kind: 'support',
    rows: [
      '......####..', //
      '.....##=###.',
      '.....#..###+',
      '.....#...+.+',
      '....##......',
      '....#.......',
      '...##....+..',
      '...#....+++.',
      '..##.....+..',
      '=###=.......',
      '======......',
      '=======.....',
    ],
  },
  // An elephant's foot coming down, the dust it raises the accent.
  stomp: {
    kind: 'attack',
    rows: [
      '............', //
      '...######...',
      '...######...',
      '...######...',
      '...######...',
      '..########..',
      '..########..',
      '..=.=..=.=..',
      '............',
      '+.+......+.+',
      '.+.+....+.+.',
      '............',
    ],
  },
  // A couched lance, its pennant and the dust of the charge the accents.
  charge: {
    kind: 'attack',
    rows: [
      '............', //
      '...++.......',
      '...+++......',
      '...++.......',
      '...#.##.....',
      '...######...',
      '...#########',
      '...######...',
      '...#.##.....',
      '............',
      '=.=.........',
      '.=.=........',
    ],
  },
  // An elixir gourd, its stopper the accent.
  elixir: {
    kind: 'support',
    rows: [
      '.....++.....', //
      '.....##.....',
      '....####....',
      '....####....',
      '.....##.....',
      '...######...',
      '..########..',
      '..##=#####..',
      '..##=#####..',
      '..########..',
      '...######...',
      '............',
    ],
  },
  // A slim vial, a drop falling from it the accent.
  sedative: {
    kind: 'support',
    rows: [
      '.....##.....', //
      '.....==.....',
      '.....##.....',
      '....####....',
      '....#==#....',
      '....####....',
      '....####....',
      '....####....',
      '.....##.....',
      '............',
      '.....++.....',
      '.....++.....',
    ],
  },
  // Rays falling from above on a cross, the accent.
  invocation: {
    kind: 'support',
    rows: [
      '.#...#...#..', //
      '.#...#...#..',
      '..#..#..#...',
      '..#..#..#...',
      '............',
      '.....++.....',
      '.....++.....',
      '...++++++...',
      '...++++++...',
      '.....++.....',
      '..==.++.==..',
      '.===.++.===.',
    ],
  },
  // A shield, a mending cross on it the accent.
  blessing: {
    kind: 'support',
    rows: [
      '............', //
      '.##########.',
      '.####++####.',
      '.####++####.',
      '.##++++++##.',
      '.##++++++##.',
      '.=###++###=.',
      '..=##++##=..',
      '..==####==..',
      '...==##==...',
      '.....==.....',
      '............',
    ],
  },
};

/**
 * Each kind's colour, shade and accent, from the palette: damage's light
 * madder, walking's ivory, the harmful statuses' gold, and Empower's
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
