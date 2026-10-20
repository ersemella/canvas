/**
 * The fight's state and actions. Plain JSON throughout, so the same state
 * is stored by the server, sent as the view and simulated by the browser's
 * previews.
 */
import type {Hex} from '@canvas/engine/server';

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
  /** Taunted: the taunter's unit id. A Pin's Immobilized on the Champion: the pinned unit's id. */
  source?: string;
}

export interface Unit {
  id: string;
  hero: HeroId;
  side: Side;
  /** Who plays it: the PvP seam (a human could control either side). */
  controller: 'human' | 'ai';
  /** Position in its party, for the fixed placement order (3.3). */
  partyIndex: number;
  /** Null before deployment. */
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
  vulnerable: number;
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

export type FightPhase = 'deploy' | 'fight' | 'won' | 'lost';

export interface FightState {
  mapId: string;
  mode: 'solo';
  phase: FightPhase;
  /** The slot the track has reached. */
  currentSlot: number;
  units: Unit[];
  effects: HailEffect[];
  /** Fog hexes; missing in a fight saved before fog existed. */
  fog: FogEffect[];
  log: LogEntry[];
  /** The human-controlled unit whose turn the track has stopped on. */
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
 * One turn of the acting unit: an optional move (the path of hexes entered,
 * not including the start) and a required action, moving first unless
 * `actFirst` (brief section 2: not split around the action).
 */
export interface TurnInput {
  move?: Hex[];
  action: TurnAction;
  actFirst?: boolean;
}

export interface Deployment {
  unitId: string;
  hex: Hex;
}

export type RunAction = {type: 'deploy'; placements: Deployment[]} | ({type: 'turn'} & TurnInput);
