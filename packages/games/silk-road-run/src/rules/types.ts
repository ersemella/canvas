/**
 * The fight's state and actions. Plain JSON throughout, so the same state
 * is stored by the server, sent as the view and simulated by the browser's
 * previews.
 */
import type {Hex} from '@canvas/engine/server';
import type {Tile} from './map';

export type Side = 'player' | 'enemy';
/**
 * The three prototype heroes, the caravan's camel (camel.md), a unit that
 * isn't a hero, and the wolf, an enemy NPC.
 */
export type HeroId = 'bokh' | 'mangudai' | 'storm' | 'camel' | 'wolf';
export type AbilityId =
  | 'hold'
  | 'longshot'
  | 'skirmish'
  | 'hail'
  | 'sunlight'
  | 'grapple'
  | 'throw'
  | 'bite'
  // Upgrades (owner, 2026-10-24): Shove, Haul, Feigned Retreat, Gale, Volley;
  // the rest experiments in no kit (balance.md, "Second abilities measured").
  | 'shove'
  | 'haul'
  | 'holdLoose'
  | 'hipToss'
  | 'feignedRetreat'
  | 'gale'
  | 'squall'
  | 'tailwind'
  | 'volley'
  | 'overwatch';

/** keywords.md, 17.5: Immobilized can't move to a different space; Stunned can't take any action. */
export type StatusKind = 'immobilized' | 'stunned';

/**
 * A status from an ability. None has a duration in slots: each lasts as
 * long as what gave it (owner, 2026-10-23), named here, and ends with it.
 */
export interface Status {
  kind: StatusKind;
  /** From a Storm Caller's hail (its unit id): ends when that hail disappears, at the caster's next turn. */
  hail?: string;
  /** From a Grapple: ends when the grapple does (`breakGrapples` in resolve.ts). */
  grapple?: {champion: string; target: string; loose?: boolean};
}

/**
 * A unit's own stats and kit, in place of its hero's (config.ts), set up by
 * the test stage (test-stage.json; `testStage.ts`). A field left out is
 * the hero's.
 */
export interface Loadout {
  speed?: number;
  defence?: number;
  power?: number;
  /** Its abilities, Hold included. */
  abilities?: AbilityId[];
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
  /** The test stage's stats and kit for it; absent for a hero as config.ts has it. */
  loadout?: Loadout;
  /**
   * Enhance (keywords.md, 17.6): its abilities deal this much more until
   * the end of its next turn (the Storm Caller's Sunlight). Absent when it
   * has none.
   */
  enhance?: number;
  /** Its turn has begun since it was Enhanced, so the Enhance ends with that turn. */
  enhanceStarted?: boolean;
  /**
   * Hasted since its last turn (Tailwind, an experiment): it can't be
   * Hasted again until it next acts, the haste limit (keywords.md, 17.3).
   */
  hasted?: boolean;
  /**
   * Its last turn was skipped (it could only Hold): its card shows it until
   * it next acts.
   */
  skipped?: boolean;
  alive: boolean;
}

/**
 * A temporary board effect: the space a Storm Caller's hail covers. It
 * disappears when its caster's next turn starts, or when the caster falls.
 */
export interface HailEffect {
  kind: 'hail';
  hex: Hex;
  /** The caster's unit id. */
  source: string;
}

/**
 * A charged Skirmish shot in the air: its Outrider's unit id, and the hex
 * direction the arrow flies from the Outrider when the charging card comes
 * back, hitting the first unit in that lane then (`shotLane` in board.ts).
 */
export interface ShotInAir {
  source: string;
  /** A Skirmish arrow's lane direction; absent for a Volley. */
  dir?: number;
  /** A Volley's space (an experiment): whoever stands there when it lands is hit. */
  hex?: Hex;
  /**
   * The Outrider's Enhance when it drew: the arrow carries it, though the
   * Enhance itself ends with that turn. Absent when it had none.
   */
  enhance?: number;
}

export interface LogEntry {
  slot: number;
  text: string;
}

/** How a unit came to enter a hex: walked, thrown, or swapped places by a Throw. */
export type Motion = 'walk' | 'throw' | 'swap' | 'push' | 'pull';

/** Something that happened on the board, in the order the rules resolved it. */
export type FightEvent =
  | {kind: 'turn'; unitId: string}
  | {kind: 'step'; unitId: string; from: Hex; to: Hex; how: Motion}
  | {kind: 'action'; unitId: string; ability: AbilityId; target?: Hex}
  /** A charged ability landing as its user's charging card comes back: a Skirmish shot, at what it hits (or the lane's end). */
  | {kind: 'land'; unitId: string; ability: AbilityId; target: Hex}
  | {kind: 'damage'; unitId: string; amount: number}
  | {kind: 'death'; unitId: string; hex: Hex}
  /** Its turn came up with nothing to do but Hold, so the track went on without it. */
  | {kind: 'skip'; unitId: string};

/** What the board looks like right after an event: enough to draw it, not to play on. */
export interface BoardSnapshot {
  currentSlot: number;
  units: Pick<Unit, 'id' | 'hex' | 'hp' | 'alive' | 'slot' | 'skipped'>[];
  effects: HailEffect[];
  shots?: ShotInAir[];
}

export type RecordedEvent = FightEvent & {after: BoardSnapshot};

export type FightPhase = 'fight' | 'won' | 'lost';

export interface FightState {
  mapId: string;
  /** This fight's tiles by hex key (its ruins are random per fight). */
  tiles: Record<string, Tile>;
  mode: 'solo';
  phase: FightPhase;
  /** The slot the track has reached. */
  currentSlot: number;
  units: Unit[];
  effects: HailEffect[];
  /**
   * Skirmish shots in the air: each flies down its lane when its
   * Outrider's charging card comes back.
   */
  shots?: ShotInAir[];
  /**
   * Overwatch lanes (an experiment): each Outrider's lane until its next
   * turn, the first unit to enter it shot.
   */
  watches?: {source: string; dir: number}[];
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

/**
 * What a turn's action targets. `to` is Throw's landing hex: the
 * Champion's own hex swaps the two.
 */
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
 * encoded with action Hold. Either way the card is placed the same (3.2).
 */
export interface TurnInput {
  move?: Hex[];
  action: TurnAction;
}

/** A turn in the fight, or, once a stage short of the last is won, going on to the next stage. */
export type RunAction =
  | ({type: 'turn'} & TurnInput)
  /** The AI's turn that is due, one per request (owner, 2026-10-24). */
  | {type: 'continue'}
  | {type: 'next'};
