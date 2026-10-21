import type {AbilityKind} from '@canvas/games-silk-road-tactics';

/**
 * Each kind of ability's icon, drawn as the pixel art is: 7×7 art pixels,
 * `#` filled. A sword for attacks, a cross for heals, a boot for movement,
 * a padlock for control (statuses, hail, fog).
 */
const ICON: Record<AbilityKind, string[]> = {
  attack: [
    '...#...', //
    '..###..',
    '..###..',
    '..###..',
    '#######',
    '...#...',
    '..###..',
  ],
  heal: [
    '..###..', //
    '..###..',
    '#######',
    '#######',
    '#######',
    '..###..',
    '..###..',
  ],
  move: [
    '.###...', //
    '.###...',
    '.###...',
    '.####..',
    '.#####.',
    '#######',
    '#######',
  ],
  control: [
    '..###..', //
    '.#...#.',
    '.#...#.',
    '#######',
    '###.###',
    '###.###',
    '#######',
  ],
};

/** Its colour, from the palette: damage's, health's, ivory, and the harmful statuses' gold. */
const COLOR: Record<AbilityKind, string> = {
  attack: 'var(--c-madderLight)',
  heal: 'var(--c-jade)',
  move: 'var(--c-ivory)',
  control: 'var(--c-gold)',
};

export const KIND_NAME: Record<AbilityKind, string> = {
  attack: 'Attack',
  heal: 'Heal',
  move: 'Movement',
  control: 'Control',
};

/**
 * An ability kind's icon, `px` screen pixels to an art pixel; decorative,
 * before the name, spaced by a margin so the text still starts with it.
 */
export function AbilityIcon({kind, px = 2}: {kind: AbilityKind; px?: number}) {
  const rows = ICON[kind];
  return (
    <svg
      width={7 * px}
      height={7 * px}
      viewBox="0 0 7 7"
      shapeRendering="crispEdges"
      aria-hidden
      style={{
        flex: 'none',
        display: 'inline-block',
        verticalAlign: '-0.1em',
        marginRight: '0.35em',
      }}
      fill={COLOR[kind]}
      data-kind={kind}
    >
      {rows.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === '#' ? <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} /> : null
        )
      )}
    </svg>
  );
}
