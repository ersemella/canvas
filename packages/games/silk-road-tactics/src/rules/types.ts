/**
 * The fight's state and actions. Plain JSON throughout, so the same state
 * is stored by the server, sent as the view and simulated by the browser's
 * previews.
 */
import type {Hex} from '@canvas/engine/server';
import type {Tile} from './map';

export type Side = 'player' | 'enemy';
export type HeroId = 'bokh' | 'mangudai' | 'storm';
export type AbilityId =
  | 'hold'
  | 'bow'
  | 'dash'
  | 'volley'
  | 'sunlight'
  | 'hail'
  | 'fog'
  | 'freeze'
  | 'throw'
  | 'pin'
  | 'rampage';

export type StatusKind = 'immobilized' | 'slowed' | 'vulnerable' | 'crushed' | 'taunted';

/**
 * A status from an ability. Active through `untilSlot` inclusive, so one
 * that ends on the unit's own slot still covers that turn (3.9). Every
 * Phase 1 status combines by max (brief section 2).
 */
export interface Status {
  kind: StatusKind;
  /** Slowed: hexes; Vulnerable: percent; Crushed: damage per slot; Immobilized, Taunted: unused (0). */
  value: number;
  untilSlot: number;
  /** Taunted: the taunter's unit id. */
  source?: string;
  /** From a Pin, on both units: who pinned whom, so breaking the pin clears them all. */
  pin?: {champion: string; target: string};
}

export interface Unit {
  id: string;
  hero: HeroId;
  side: Side;
  /** Who plays it: the PvP seam (a human could control either side). */
  controller: 'human' | 'ai';
  /** Position in its party, for the fixed placement order (3.3). */
  partyIndex: number;
  /** Null once dead. */
  hex: Hex | null;
  hp: number;
  maxHp: number;
  speed: number;
  defence: number;
  power: number;
  /** The unit's card on the track; null when dead or not yet placed. */
  slot: number | null;
  statuses: Status[];
  /** Completed turns this fight that count toward the ultimate (10.10): not those that only Hold. */
  turnsTaken: number;
  ultimateUsed: boolean;
  /** A charged ability waiting for this unit's card (3.7). */
  charging: {ability: AbilityId; target: Hex} | null;
  alive: boolean;
}

/** A temporary board effect: the Storm Caller's hail. */
export interface HailEffect {
  kind: 'hail';
  hex: Hex;
  untilSlot: number;
  /** Damage per hit, already scaled by the caster's power; defence still applies. */
  damage: number;
  slowed: number;
  statusSlots: number;
}

/** A fog hex: the Storm Caller's fog. Ranged hits into it and out of it are weaker. */
export interface FogEffect {
  hex: Hex;
  untilSlot: number;
}

export interface LogEntry {
  slot: number;
  text: string;
}

/**
 * How a unit came to enter a hex: walked, pushed by a hit, thrown, or
 * rushing several hexes at once (Dash, Rampage).
 */
export type Motion = 'walk' | 'push' | 'throw' | 'rush';

/** Something that happened on the board, in the order the rules resolved it. */
export type FightEvent =
  | {kind: 'turn'; unitId: string}
  | {kind: 'step'; unitId: string; from: Hex; to: Hex; how: Motion}
  | {kind: 'action'; unitId: string; ability: AbilityId; target?: Hex; charged?: boolean}
  | {kind: 'charge'; unitId: string; ability: AbilityId; target: Hex}
  | {kind: 'damage'; unitId: string; amount: number}
  | {kind: 'heal'; unitId: string; amount: number}
  | {kind: 'death'; unitId: string; hex: Hex};

/** What the board looks like right after an event: enough to draw it, not to play on. */
export interface BoardSnapshot {
  currentSlot: number;
  units: Pick<Unit, 'id' | 'hex' | 'hp' | 'alive' | 'slot' | 'charging'>[];
  effects: HailEffect[];
  fog: FogEffect[];
}

export type RecordedEvent = FightEvent & {after: BoardSnapshot};

export type FightPhase = 'fight' | 'won' | 'lost';

export interface FightState {
  /** Optional headless balance experiment; absent in normal games. */
  experiment?: {
    blockAllUnits: boolean;
    separateMovement: boolean;
    moveActionCost: number;
  };
  mapId: string;
  /**
   * This fight's tiles by hex key (ruins and quicksand are random per
   * fight); missing in a fight saved before they were, which uses the map's.
   */
  tiles?: Record<string, Tile>;
  mode: 'solo';
  phase: FightPhase;
  /** The slot the track has reached. */
  currentSlot: number;
  units: Unit[];
  effects: HailEffect[];
  /** Fog hexes; missing in a fight saved before fog existed. */
  fog: FogEffect[];
  log: LogEntry[];
  /**
   * What the last action set off, the player's turn and the AI turns after
   * it, for the page to play back. Only the server's fight records (the run
   * starts the list each action); copies for previews and the AI don't.
   */
  events?: RecordedEvent[];
  /** The stopped decision's unit. Live play returns human decisions; search pauses for either side. */
  awaiting: string | null;
}

/** What a turn's action targets. `to` is Throw's landing hex. */
export interface ActionTarget {
  hex?: Hex;
  to?: Hex;
}

export interface TurnAction {
  ability: AbilityId;
  target?: ActionTarget;
}

/**
 * One turn: either an ability without walking, or a nonempty walking path
 * encoded with action Hold. Move-only turns cost 20 + 10 per hex, not Hold's
 * cost. `actFirst` remains for historical headless experiment comparisons.
 */
export interface TurnInput {
  move?: Hex[];
  action: TurnAction;
  actFirst?: boolean;
}

export type RunAction = {type: 'turn'} & TurnInput;
