/**
 * The fight's state and actions. Plain JSON throughout, so the same state
 * is stored by the server, sent as the view and simulated by the browser's
 * previews.
 */
import type {Hex} from '@canvas/engine/server';
import type {Tile} from './map';

export type Side = 'player' | 'enemy';
/**
 * The three prototype heroes, the Vanguard and the Alchemist
 * (owner, 2026-10-25), the Swordsman (owner, 2026-10-26), the
 * caravan's camel (camel.md), a unit that isn't a
 * hero, and the enemy NPCs, the wolf and the fox.
 */
export type HeroId =
  | 'bokh'
  | 'mangudai'
  | 'storm'
  | 'modao'
  | 'alchemist'
  | 'youxia'
  | 'camel'
  | 'wolf'
  | 'fox';
export type AbilityId =
  | 'hold'
  | 'longshot'
  | 'skirmish'
  | 'hail'
  | 'eye'
  | 'sunlight'
  | 'grapple'
  | 'bite'
  | 'cleave'
  | 'elixir'
  | 'swiftStrike'
  // Upgrades (owner, 2026-10-24; balance.md, "Second abilities measured").
  | 'shove'
  | 'haul'
  | 'feignedRetreat'
  | 'gale'
  | 'volley';

/**
 * The passives (progression.md, 19.8; owner, 2026-10-24): hero-agnostic
 * rules a unit carries, from an upgrade offer's passive slot (19.3). No
 * hero has one yet; the test stage gives them (`Loadout.passives`).
 */
export type PassiveId =
  // Track
  | 'steadyGait'
  | 'secondWind'
  | 'patient'
  | 'momentum'
  // Board
  | 'rooted'
  | 'lightStep'
  | 'rebound'
  // Damage and survival
  | 'hardened'
  | 'lastStand'
  | 'piercingEye'
  | 'opportunist'
  | 'bulwark'
  | 'glassCannon'
  // Control
  | 'ironWill'
  | 'shakeLoose'
  // Position and allies
  | 'flanker'
  | 'loneWolf'
  | 'rally'
  | 'vengeance';

/** The stats a provision raises (heroes-and-gear.md, 9.1). */
export type StatId = 'speed' | 'defence' | 'power';

/**
 * A provision (progression.md, 19.2): 1 more of one stat for one hero of
 * the party, from the stage it was earned on for the rest of the run.
 */
export interface Provision {
  hero: HeroId;
  stat: StatId;
}

/**
 * A passive taken at the caravanserai between regions (progression.md,
 * 19.3, the passive slot): one hero of the party carries it from the next
 * stage for the rest of the run.
 */
export interface PassivePick {
  hero: HeroId;
  passive: PassiveId;
}

/** keywords.md, 17.5: Immobilized can't move to a different space; Stunned can't take any action. */
export type StatusKind = 'immobilized' | 'stunned';

/**
 * A status from an ability. None has a duration in slots: each lasts as
 * long as what gave it (owner, 2026-10-23), named here, and ends with it.
 */
export interface Status {
  kind: StatusKind;
  /** From a Storm Caller's hail (its unit id): ends when that hail disappears (`HailEffect`). */
  hail?: string;
  /** With `hail`, the space of the hail that gave it (`ABILITY.hail.max`); absent before 2026-10-26. */
  at?: Hex;
  /** From a Grapple: ends when the grapple does (`breakGrapples` in resolve.ts). */
  grapple?: {champion: string; target: string};
  /** From Last Stand (19.8): Stunned for the unit's next turn, ending with it. */
  lastStand?: boolean;
  /** From Eye of the Storm (`ABILITY.eye.immobilize`): Immobilized for the unit's next turn, ending with it. */
  eye?: boolean;
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
  /** Its passives (progression.md, 19.8). */
  passives?: PassiveId[];
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
  /** Its provisions, stat by stat, added to its hero's or loadout's stats; absent with none. */
  provisions?: Partial<Record<StatId, number>>;
  /**
   * Empower (keywords.md, 17.6): its abilities deal this much more until
   * the end of its next turn (the Storm Caller's Sunlight). Absent when it
   * has none.
   */
  empower?: number;
  /** Its turn has begun since it was Empowered, so the Empower ends with that turn. */
  empowerStarted?: boolean;
  /**
   * Weaken (keywords.md, 17.6): its abilities deal this much less, to at
   * least 0, until the end of its next turn (the Alchemist's
   * Elixir). Absent when it has none.
   */
  weaken?: number;
  /**
   * The storm of its Eye of the Storm following a unit (`ABILITY.eye.follows`):
   * the unit it follows, and the units it has caught, each caught once. It
   * ends as its caster's next turn starts.
   */
  storm?: {target: string; caught: string[]};
  /** Its turn has begun since it was Weakened, so the Weaken ends with that turn. */
  weakenStarted?: boolean;
  /** Its passives (progression.md, 19.8); absent with none. */
  passives?: PassiveId[];
  /**
   * Its passives that work once a fight (Second Wind, Hardened, Last Stand,
   * Iron Will) and have been used this fight. Absent while none has.
   */
  spent?: PassiveId[];
  /**
   * Shield (keywords.md, 17.6): a pool reduced before health, until the
   * start of the unit's next turn (Rally). Absent when it has none.
   */
  shield?: number;
  /**
   * Unstoppable (keywords.md, 17.4): can't be Pushed, Pulled or
   * Immobilized, until the start of the unit's next turn (an Elixir, a
   * switch: `ABILITY.elixir.unstoppable`). Absent when it isn't.
   */
  unstoppable?: boolean;
  /**
   * Haste (keywords.md, 17.3) given while its own turn was under way, its
   * card not yet placed: taken off as the card is placed at the turn's end.
   */
  hasteDue?: number;
  /** It took a unit off the board this turn (Momentum, 19.8). */
  tookOff?: boolean;
  /** The slots its last two turns started on, the latest last (Opportunist, 19.8). */
  turns?: number[];
  /**
   * The allies next to it that have taken their first hit since its last
   * turn (Bulwark, 19.8), by unit id. Absent while none has.
   */
  covered?: string[];
  /**
   * Its last turn was skipped (it could only Hold): its card shows it until
   * it next acts.
   */
  skipped?: boolean;
  alive: boolean;
}

/**
 * A temporary board effect: the space a Storm Caller's hail covers. It
 * disappears as its caster's `turns`th turn from now starts, when the
 * caster casts it again, or when the caster falls.
 */
export interface HailEffect {
  kind: 'hail';
  hex: Hex;
  /** The caster's unit id. */
  source: string;
  /**
   * Its caster's turns still to start before it lifts, counting the one it
   * lifts on. Absent in runs saved before 2026-10-25, when hail lasted 1.
   */
  turns?: number;
}

/**
 * A charged Skirmish shot in the air: its Horse Archer's unit id, and the hex
 * direction the arrow flies from the Horse Archer when the charging card comes
 * back, hitting the first unit in that lane then (`shotLane` in board.ts).
 */
export interface ShotInAir {
  source: string;
  /** A Skirmish arrow's lane direction; absent for a Volley. */
  dir?: number;
  /** A Volley's space: whoever stands there when it lands is hit. */
  hex?: Hex;
  /**
   * The Horse Archer's Empower when it drew: the arrow carries it, though the
   * Empower itself ends with that turn. Absent when it had none.
   */
  empower?: number;
}

export interface LogEntry {
  slot: number;
  text: string;
}

/** How a unit came to enter a hex: walked, thrown, or swapped places by a Grapple's throw. */
export type Motion = 'walk' | 'throw' | 'swap' | 'push' | 'pull';

/** Something that happened on the board, in the order the rules resolved it. */
export type FightEvent =
  | {kind: 'turn'; unitId: string}
  | {kind: 'step'; unitId: string; from: Hex; to: Hex; how: Motion}
  | {kind: 'action'; unitId: string; ability: AbilityId; target?: Hex}
  /** A charged ability landing as its user's charging card comes back: a Skirmish shot, at what it hits (or the lane's end). */
  | {kind: 'land'; unitId: string; ability: AbilityId; target: Hex}
  | {kind: 'damage'; unitId: string; amount: number}
  | {kind: 'heal'; unitId: string; amount: number}
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
  /** This fight's tiles by hex key (its yurts are random per fight). */
  tiles: Record<string, Tile>;
  mode: 'solo';
  phase: FightPhase;
  /** The slot the track has reached. */
  currentSlot: number;
  units: Unit[];
  effects: HailEffect[];
  /**
   * Skirmish shots in the air: each flies down its lane when its
   * Horse Archer's charging card comes back.
   */
  shots?: ShotInAir[];
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
 * What a turn's action targets. `to` is a second space: where Skirmish
 * steps first, or where Feigned Retreat falls back to.
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
  /**
   * On to the next stage from the caravanserai, with the provision the
   * stage won earned, if it earned one (`STAGES[stage].provision`), and the
   * passive taken from its offer, if it made one (`STAGES[stage].passive`).
   */
  | {type: 'next'; provision?: Provision; passive?: PassivePick};
