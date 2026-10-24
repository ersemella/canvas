/**
 * What the page sends the board to draw (`tactics:board`).
 */
import type {Hex} from '@canvas/engine';
import type {FightState} from '../../rules/types';

export type HighlightKind = 'path' | 'target' | 'landing' | 'chosen' | 'area';

/** What the page wants drawn over the board, sent as a `tactics:board` event. */
export interface BoardScene {
  fight: FightState | null;
  highlights: {hex: Hex; kind: HighlightKind}[];
  selectedUnitId: string | null;
  /** The unit tapped to look at (touch can't hover): it shows its health bar, as a hovered one does. */
  inspectedUnitId?: string | null;
  /** Units that show their health bar however they're looked at (an attack's targets while aiming). */
  healthUnitIds?: string[];
  /** Previewed outcome: where units end up and their health. */
  preview: {unitId: string; to: Hex | null; hpAfter: number; hpBefore: number; killed: boolean}[];
  /** A planned move's route, from where the unit stands to where it ends: a line along it. */
  path?: Hex[];
  /** The hexes the picked ability reaches from its user: outlined, so its range shows. */
  range?: Hex[];
  /**
   * Longshot's lanes from its user: an arrow along each to a unit it may
   * target, a faint dashed line along the rest to where the arrow stops.
   */
  lanes?: {from: Hex; lanes: BowLane[]};
  /**
   * The one-space move Throw makes its unit: a move's arrow, drawn over the units, since the moving
   * unit's ghost would hide it under them.
   */
  step?: [Hex, Hex];
  /** Where the acting unit's card lands after the planned turn: a ghost card on the track. */
  previewSlot?: number | null;
  /** The slot the planned turn aims at (3.2); when it's taken, the card yields on to `previewSlot`. */
  aimSlot?: number | null;
  /** Cards the planned turn's landing moves on, by unit id (`TurnPreview.bumped`). */
  previewBumps?: Record<string, number>;
  /**
   * The arrow over the unit you're controlling (on unless false). Phones
   * leave it off: there it reads as "tap here", and the action bar shows the
   * unit's portrait instead.
   */
  turnArrow?: boolean;
}

/** One of Longshot's lanes, as the board draws it (see `BoardScene.lanes`). */
export interface BowLane {
  hexes: Hex[];
  target: boolean;
}
