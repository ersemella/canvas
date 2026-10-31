/**
 * The game's one palette (art-direction.md): every colour the board's
 * overlay, the track and the page's panels use comes from here, so the
 * pixel art, the canvas and the HTML read as one game. The terrain and
 * effect art keep their own hand-picked shades.
 *
 * Ramps, darkest first: dusk (the night panels and the track: warm
 * walnut and umber, a lamp-lit caravanserai after dark, owner 2026-10-31), sand (the
 * board), gold (warnings: harmful statuses; the acting unit's border and
 * arrow), lapis (your side: deep for your units, light for your actions:
 * targeting, Confirm),
 * madder (the enemy's side: its units, charges and names), jade (health,
 * healing), plum (ultimates, charging), sky (ice and hail).
 */
export const PALETTE = {
  /** The sprites' outline: every UI frame's edge. */
  ink: '#221816',
  dusk0: '#1e1510',
  dusk1: '#2e2018',
  dusk2: '#443024',
  dusk3: '#654a36',
  /** Dimmed text on the dusk panels. */
  dusk4: '#b9a184',
  sandDark: '#8c7350',
  sand: '#d4b483',
  sandLight: '#efdcbc',
  /** Text on the dusk panels. */
  ivory: '#f6ecd4',
  goldDark: '#a8641e',
  gold: '#e8a93a',
  goldLight: '#ffdf5e',
  lapisDark: '#1f3a6e',
  lapis: '#3563b0',
  /**
   * Your actions (targeting, the path, Confirm) and your names: light
   * and bright, so it reads on the sand (blue is its
   * opposite) and over your own deep lapis hexes.
   */
  lapisLight: '#8ec5ff',
  lapisPale: '#d4ebff',
  madderDark: '#6b2116',
  madder: '#b0402e',
  madderLight: '#f2a48e',
  jadeDark: '#2e6b47',
  jade: '#5bb26f',
  plumDark: '#5a2c63',
  plum: '#8d4a92',
  plumLight: '#e3aee4',
  sky: '#6fb6d8',
  skyLight: '#cfe8f2',
} as const;

export type PaletteColor = keyof typeof PALETTE;

/** A palette colour at some opacity, for canvas fills. */
export function paletteAlpha(color: PaletteColor, alpha: number): string {
  const hex = PALETTE[color];
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * The pixel font every label uses, on the canvas as on the page: Jersey 20,
 * drawn on a fine enough pixel grid to keep detail (accents, distinct 5, B
 * and C) and solid enough to sit beside the sprites. It has one weight.
 */
export const PIXEL_FONT = "'Jersey 20', system-ui, sans-serif";

/** The canvas's text at `size`, scaled up a quarter: the pixel font is narrow and small for its size. */
export function pixelFont(size: number): string {
  return `${Math.round(size * 1.25)}px ${PIXEL_FONT}`;
}
