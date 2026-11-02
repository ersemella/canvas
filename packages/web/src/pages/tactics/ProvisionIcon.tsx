import {PASSIVES, isStatCard} from '@canvas/games-silk-road-run';
import type {CardId, PassiveGroup, StatId} from '@canvas/games-silk-road-run';
import {PixelIcon} from './AbilityIcon';

interface Art {
  /** 12×12 art pixels: `#` its colour, `=` its shade, `+` its accent. */
  rows: string[];
  colors: [string, string, string];
}

const LAPIS: [string, string, string] = [
  'var(--c-lapisLight)',
  'var(--c-lapis)',
  'var(--c-lapisPale)',
];
const MADDER: [string, string, string] = [
  'var(--c-madderLight)',
  'var(--c-madder)',
  'var(--c-ivory)',
];
const GOLD: [string, string, string] = ['var(--c-gold)', 'var(--c-goldDark)', 'var(--c-goldLight)'];
const JADE: [string, string, string] = ['var(--c-jade)', 'var(--c-jadeDark)', 'var(--c-ivory)'];
const IVORY: [string, string, string] = ['var(--c-ivory)', 'var(--c-sand)', 'var(--c-gold)'];

/** The stat upgrades' icons: Speed's chevrons, Power's sword, Defence's shield. */
const STAT_ART: Record<StatId, Art> = {
  speed: {
    colors: LAPIS,
    rows: [
      '............', //
      '.#....#.....',
      '.##...##....',
      '..##...##...',
      '...##...##..',
      '....##...##.',
      '....##...##.',
      '...##...##..',
      '..##...##...',
      '.##...##....',
      '.#....#.....',
      '............',
    ],
  },
  power: {
    colors: [MADDER[2], MADDER[1], 'var(--c-gold)'],
    rows: [
      '.....#......', //
      '....###.....',
      '....###.....',
      '....###.....',
      '....###.....',
      '....###.....',
      '....###.....',
      '.+++++++++..',
      '.....=......',
      '.....=......',
      '....+++.....',
      '............',
    ],
  },
  defence: {
    colors: ['var(--c-ivory)', 'var(--c-lapis)', 'var(--c-goldLight)'],
    rows: [
      '.##########.', //
      '.#========#.',
      '.#===++===#.',
      '.#===++===#.',
      '.#=++++++=#.',
      '.#=++++++=#.',
      '.#===++===#.',
      '..#==++==#..',
      '..#======#..',
      '...#====#...',
      '....#==#....',
      '.....##.....',
    ],
  },
};

/** Each passive group's icon, so cards that bend the same rule look alike. */
const GROUP_ART: Record<PassiveGroup, Art> = {
  // An hourglass: the track.
  track: {
    colors: LAPIS,
    rows: [
      '.##########.', //
      '..#......#..',
      '..#=....=#..',
      '...#====#...',
      '....#==#....',
      '.....##.....',
      '.....##.....',
      '....#..#....',
      '...#....#...',
      '..#..==..#..',
      '..#======#..',
      '.##########.',
    ],
  },
  // Footprints: walking and being moved.
  board: {
    colors: IVORY,
    rows: [
      '.......##...', //
      '......####..',
      '......####..',
      '......####..',
      '.......##...',
      '..##...==...',
      '.####.......',
      '.####.......',
      '.####.......',
      '..##........',
      '..==........',
      '............',
    ],
  },
  // A burst: damage dealt and taken.
  damage: {
    colors: MADDER,
    rows: [
      '.....##.....', //
      '.#...##...#.',
      '..#.####.#..',
      '...######...',
      '..###++###..',
      '#####++#####',
      '#####++#####',
      '..###++###..',
      '...######...',
      '..#.####.#..',
      '.#...##...#.',
      '.....##.....',
    ],
  },
  // A padlock: statuses that hold a unit.
  control: {
    colors: GOLD,
    rows: [
      '....####....', //
      '...#....#...',
      '..#......#..',
      '..#......#..',
      '.##########.',
      '.#========#.',
      '.#===++===#.',
      '.#===++===#.',
      '.#====+===#.',
      '.#========#.',
      '.##########.',
      '............',
    ],
  },
  // Two figures side by side: allies.
  allies: {
    colors: JADE,
    rows: [
      '............', //
      '..==....##..',
      '.====..####.',
      '.====..####.',
      '..==....##..',
      '............',
      '.====..####.',
      '======######',
      '======######',
      '======######',
      '======######',
      '............',
    ],
  },
  // An arrow, fletched: attacks.
  attacks: {
    colors: [MADDER[0], MADDER[1], 'var(--c-sand)'],
    rows: [
      '.....##.....', //
      '....####....',
      '...######...',
      '..########..',
      '.....==.....',
      '.....==.....',
      '.....==.....',
      '.....==.....',
      '....+==+....',
      '...+.==.+...',
      '..+..==..+..',
      '............',
    ],
  },
  // A cross: healing.
  healing: {
    colors: ['var(--c-ivory)', 'var(--c-ink)', 'var(--c-jade)'],
    rows: [
      '............', //
      '....####....',
      '....#++#....',
      '....#++#....',
      '.####++####.',
      '.#++++++++#.',
      '.#++++++++#.',
      '.####++####.',
      '....#++#....',
      '....#++#....',
      '....####....',
      '............',
    ],
  },
  // Crosshairs: who it can aim at.
  targeting: {
    colors: GOLD,
    rows: [
      '.....#......', //
      '...#####....',
      '..#..#..#...',
      '.#...#...#..',
      '.#.......#..',
      '####.+.####.',
      '.#.......#..',
      '.#...#...#..',
      '..#..#..#...',
      '...#####....',
      '.....#......',
      '............',
    ],
  },
};

/** A provision card's icon: its stat's, or its passive group's. */
export function ProvisionIcon(props: {card: CardId; px?: number; inline?: boolean}) {
  const art = isStatCard(props.card) ? STAT_ART[props.card] : GROUP_ART[PASSIVES[props.card].group];
  return (
    <PixelIcon
      rows={art.rows}
      colors={art.colors}
      px={props.px ?? 2}
      inline={props.inline ?? false}
      id={props.card}
    />
  );
}
