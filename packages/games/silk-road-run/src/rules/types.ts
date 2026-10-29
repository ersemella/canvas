/**
 * The fight's state and actions. Plain JSON throughout, so the same state
 * is stored by the server, sent as the view and simulated by the browser's
 * previews.
 */
import type {Hex} from '@canvas/engine/server';
import type {Route, Tile} from './map';

export type Side = 'player' | 'enemy';
/**
 * The three prototype heroes, the Vanguard and the Alchemist
 * (owner, 2026-10-25), the Duelist (owner, 2026-10-26), the Magus
 * (owner, 2026-10-27), the Juggernaut (`mahout`, owner, 2026-10-27), the
 * Ranger (owner, 2026-10-27), the Barbarian (`varangian`, owner,
 * 2026-10-28), the Priest and the Cataphract (owner, 2026-10-28), the
 * caravan's camel (camel.md), a unit that isn't a
 * hero, the enemy NPCs, the wolf and the fox, the Steppe's boss, the
 * Cyclops (`giant`, owner, 2026-10-28; enemies.md), and China's,
 * the Bull Demon King and Princess Iron Fan (`oxKing`, `fanLady`, owner, 2026-10-28;
 * enemies.md), and Persia's, Zahhak and the serpents on his shoulders
 * (`zahhak`, `serpent`, 2026-10-29; enemies.md).
 */
export type HeroId =
  | 'bokh'
  | 'mangudai'
  | 'storm'
  | 'modao'
  | 'alchemist'
  | 'youxia'
  | 'magus'
  | 'mahout'
  | 'archer'
  | 'priest'
  | 'varangian'
  | 'cataphract'
  | 'camel'
  | 'wolf'
  | 'fox'
  | 'giant'
  | 'oxKing'
  | 'fanLady'
  | 'zahhak'
  | 'serpent';
export type AbilityId =
  | 'hold'
  | 'snapShot'
  | 'skirmish'
  | 'hail'
  | 'sunlight'
  | 'grapple'
  | 'bite'
  | 'cleave'
  | 'elixir'
  | 'swiftStrike'
  | 'omen'
  | 'stomp'
  | 'longshot'
  | 'blessing'
  | 'reave'
  | 'axeThrow'
  | 'charge'
  // The Cyclops's (owner, 2026-10-28).
  | 'smash'
  | 'boulder'
  // The Bull Demon King's and Princess Iron Fan's (owner, 2026-10-28), and the fan she
  // drops (`quench`).
  | 'gore'
  | 'bananaFan'
  | 'fanFlames'
  | 'quench'
  // Zahhak's (2026-10-29).
  | 'feed'
  | 'regrowSerpent'
  // Upgrades (owner, 2026-10-24; balance.md, "Second abilities measured").
  | 'shove'
  | 'haul'
  | 'feignedRetreat'
  | 'gale'
  | 'volley';

/**
 * The passives (progression.md, 19.8; owner, 2026-10-24): hero-agnostic
 * rules a unit carries, from an upgrade offer's passive slot (19.3), or
 * from the start (`HeroStats.passives`: the Magus's Steady Gait, the
 * Juggernaut's Unstoppable); the test
 * stage gives them too (`Loadout.passives`).
 */
export type PassiveId =
  // Track
  | 'steadyGait'
  | 'secondWind'
  | 'patient'
  | 'momentum'
  // Board
  | 'rooted'
  | 'unstoppable'
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
  | 'vengeance'
  // A boss's own, not in 19.8's pool: the Cyclops's (owner, 2026-10-28),
  // and the Bull Demon King's and Princess Iron Fan's (owner, 2026-10-28).
  | 'oneEye'
  | 'devoted'
  // Zahhak's and his serpents' (2026-10-29).
  | 'serpentKing'
  | 'regrow'
  // A hero's own, not in 19.8's pool: the Cataphract's (owner, 2026-10-29).
  | 'armoured'
  // The generic ability upgrades (progression.md, 19.9; owner, 2026-10-29),
  // drafted with the passives. Track
  | 'wearying'
  | 'lethargy'
  | 'inspire'
  | 'fervour'
  // Board
  | 'forceful'
  | 'reelIn'
  // Attacks
  | 'staggering'
  | 'hamstring'
  | 'concussive'
  | 'sundering'
  | 'crippling'
  // Control
  | 'lockdown'
  | 'defyFate'
  | 'immovableObject'
  // Healing
  | 'invigorate'
  | 'quickening'
  | 'fortify'
  | 'ward'
  | 'mendingStrike'
  | 'mendingShot'
  // Targeting
  | 'forked';

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
 * A passive drafted at the caravanserai between regions (progression.md,
 * 19.3a): one hero carries it from the next stage for the rest of the
 * run, of the party (`RunState.passives`) or of the rival's
 * (`RunState.rivalPassives`).
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
  /** From a Charge slamming it into yurts or the map's edge: Stunned for its next turn, ending with it. */
  slammed?: boolean;
  /**
   * From a pinning Longshot (`ABILITY.longshot.pin`) or Hamstring (19.9):
   * Immobilized until the end of the unit's next turn.
   */
  pinned?: boolean;
  /** From Concussive, Lockdown or Defy Fate (19.9): Stunned for the unit's next turn, ending with it. */
  dazed?: boolean;
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
  /** With `RULES.trackTime`, the last slot its Empower lasts through. */
  empowerUntil?: number;
  /**
   * Weaken (keywords.md, 17.6): its abilities deal this much less, to at
   * least 0, until the end of its next turn (the Alchemist's
   * Elixir). Absent when it has none.
   */
  weaken?: number;
  /** Its turn has begun since it was Weakened, so the Weaken ends with that turn. */
  weakenStarted?: boolean;
  /** With `RULES.trackTime`, the last slot its Weaken lasts through. */
  weakenUntil?: number;
  /** Its passives (progression.md, 19.8); absent with none. */
  passives?: PassiveId[];
  /**
   * Where its thrown axe lies (the Barbarian's Reave): until it enters a
   * space on or next to it, it can only move and Hold (`disarmed` in
   * board.ts). Absent while it holds its axe.
   */
  axe?: Hex;
  /**
   * The hex direction (0 to 5) it faces, for One Eye: set as the fight
   * starts, turned by its walks and its abilities (`faceAfterTurn` in
   * fight.ts), kept when it is displaced. Absent for a unit without it.
   */
  facing?: number;
  /**
   * It carries Princess Iron Fan's fan, picked up where she fell (`FightState.fan`):
   * it may spend a turn putting out every flame (`quench`). Absent otherwise.
   */
  fan?: boolean;
  /**
   * Its passives that work once a fight (Second Wind, Hardened, Last Stand,
   * Iron Will) and have been used this fight. Absent while none has.
   */
  spent?: PassiveId[];
  /**
   * Shield (keywords.md, 17.6): a pool reduced before health, until the
   * start of the unit's next turn (Rally, the Priest's Blessing). Absent
   * when it has none.
   */
  shield?: number;
  /** With `RULES.trackTime`, the last slot its Shield (but a lasting one) lasts through. */
  shieldUntil?: number;
  /**
   * Armour (keywords.md, 17.6) until the start of its next turn, from an
   * ally's Fortify (19.9). Absent when it has none.
   */
  armour?: number;
  /**
   * The part of its Shield that stays until damage spends it, not going at
   * its next turn (a Blessing with `ABILITY.blessing.lasts`). Absent when
   * none does.
   */
  lastingShield?: number;
  /**
   * Unstoppable (keywords.md, 17.4): can't be Pushed, Pulled, Immobilized
   * or Stunned, until the start of the unit's next turn (an Elixir, a
   * switch: `ABILITY.elixir.unstoppable`); always with the Unstoppable
   * passive (`isUnstoppable`). Absent when it isn't.
   */
  unstoppable?: boolean;
  /**
   * Its speed and health swapped by an Elixir (a switch:
   * `ABILITY.elixir.swap`), with the speed and health it had before.
   * Absent when they aren't.
   */
  swapped?: {speed: number; hp: number};
  /**
   * Immortal (keywords.md, 17.6): its health can't be reduced, until the
   * start of its next turn (an Elixir, a switch: `ABILITY.elixir.immortal`).
   * Absent when it isn't.
   */
  immortal?: boolean;
  /** An Immortal due from the start of its next turn (`ABILITY.elixir.immortalWhen: 'delayed'`). */
  immortalDue?: boolean;
  /**
   * Haste (keywords.md, 17.3) given while its own turn was under way, its
   * card not yet placed: taken off as the card is placed at the turn's end.
   */
  hasteDue?: number;
  /**
   * Put after the Magus's next turn by an Omen (`bracket`) and not
   * yet acted since: with `ABILITY.omen.once`, not put there again.
   */
  bracketed?: boolean;
  /** It took a unit off the board this turn (Momentum, 19.8). */
  tookOff?: boolean;
  /**
   * It has lost health this fight, healed back or not: Humphrey unhurt all
   * fight earns an extra provision (camel.md, 18.4). Absent while it hasn't.
   */
  damaged?: boolean;
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
  /** With `RULES.trackTime`, the last slot it stands through, in place of `turns`. */
  until?: number;
}

/**
 * A burning space (Princess Iron Fan's Fan the Flames, owner, 2026-10-28): a
 * unit entering it, by walking or Moved there, takes `ABILITY.fanFlames.burn`.
 * It goes out as its source's next turn starts; once she has fallen, only
 * the fan she drops puts it out (`quench`).
 */
export interface FireEffect {
  hex: Hex;
  /** Princess Iron Fan's unit id. */
  source: string;
  /** With `RULES.trackTime`, the last slot it burns through while she stands. */
  until?: number;
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
  /** A Volley's space: whoever stands there when it lands is hit. */
  hex?: Hex;
  /**
   * The Outrider's Empower when it drew: the arrow carries it, though the
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
  /**
   * An ability landing after its user's action: a charged one as its
   * user's charging card comes back (a Skirmish shot, at what it hits, or
   * the lane's end), or a Stomp once the Juggernaut has stepped, where it stomps.
   */
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
  fires?: FireEffect[];
  fan?: Hex;
}

export type RecordedEvent = FightEvent & {after: BoardSnapshot};

export type FightPhase = 'fight' | 'won' | 'lost';

export interface FightState {
  mapId: string;
  /** This fight's tiles by hex key (its yurts are random per fight). */
  tiles: Record<string, Tile>;
  /** The camel's road this fight, one of the map's `ROUTES` at random (owner, 2026-10-28). */
  route: Route;
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
  /** Burning spaces (`FireEffect`); absent with none. */
  fires?: FireEffect[];
  /**
   * Where Princess Iron Fan's fan lies, dropped where she fell (owner,
   * 2026-10-28): a hero entering the space picks it up (`Unit.fan`).
   */
  fan?: Hex;
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
  /**
   * A second target for a single-target ability, with Forked (19.9): the
   * ability resolves on `hex`, then again on this one, if it is still a
   * target then.
   */
  also?: Hex;
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
   * The party's first pick in the caravanserai's passive draft, kept for
   * good (progression.md, 19.3a): the rival answers it at once.
   */
  | {type: 'draft'; passive: PassivePick}
  /**
   * On to the next stage from the caravanserai, with the provision the
   * stage won earned, if it earned one (`STAGES[stage].provision`), and the
   * party's two picks of the passives drafted there, in the order picked, if
   * it offered them (`STAGES[stage].passive`; the rival's picks follow from
   * them, `draftPicks` in run.ts).
   * `heal` takes the provision as a heal of the camel (RULES.camelHeal), in
   * place of a stat: one or the other. `extra` and `extraHeal` are the same
   * for the extra provision Humphrey earns by taking no damage in the stage.
   */
  | {
      type: 'next';
      provision?: Provision;
      passive?: PassivePick;
      heal?: boolean;
      extra?: Provision;
      extraHeal?: boolean;
    };
