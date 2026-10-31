/**
 * The three prototype heroes' abilities (roster.md; owner, 2026-10-23),
 * the Vanguard's and the Alchemist's (owner, 2026-10-25), the
 * Duelist's (owner, 2026-10-26), the Magus's, the Juggernaut's and the Ranger's (owner, 2026-10-27), the Priest's, the Cataphract's, the wolf's, the Cyclops's, and the Bull Demon King's and Princess Iron Fan's (owner, 2026-10-28). Each lists its legal targets from a hex (for validation,
 * previews and the AI) and resolves on the fight state. Every ability
 * deals exactly its user's power in damage; shapes come from config.ts.
 */
import {
  hexDirectionTo,
  hexDistance,
  hexEquals,
  hexNeighbor,
  hexNeighbors,
} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, CAMEL, RULES} from './config';
import {
  hostile,
  cleaveAreas,
  disarmed,
  firstInLane,
  isImmobilized,
  isUnstoppable,
  kitOf,
  lane as laneFrom,
  line as lineFrom,
  mayEndOn,
  reachableHexes,
  sortByHex,
  spacesWithin,
  steps as stepsFrom,
  stopsWalk,
  unitAt,
  walkable,
} from './board';
import {
  clearHail,
  weaken,
  delay,
  displace,
  displaced,
  endGrapples,
  endGrapplesApart,
  empower,
  enterHex,
  hailHolds,
  liftHail,
  haste,
  damageOf,
  heal,
  hit,
  hitFor,
  immobilize,
  log,
  record,
  stun,
  stunForATurn,
  takeOffTrack,
  lastsThrough,
  swapCards,
  setCard,
  shield,
  unitName,
  walk,
} from './resolve';
import type {Ctx} from './resolve';
import {blocks, onMap, tileAt} from './map';
import {aimSlot, chargeOf, placeCard, simultaneousOrder} from './track';
import {hasPassive} from './passives';
import type {MapData} from './map';
import type {AbilityId, ActionTarget, FightState, Unit} from './types';

/**
 * What an ability is broadly for, shown as an icon by its name: hurting
 * enemies, controlling the board (statuses, hail), or helping (Empower).
 */
export type AbilityKind = 'attack' | 'control' | 'support';

export interface AbilityDef {
  id: AbilityId;
  name: string;
  /** None for Hold. */
  kind?: AbilityKind;
  /**
   * How far from its user it reaches, for an ability aimed within a range
   * (not Snap Shot, whose lanes run to the first unit, nor melee); the page
   * outlines it.
   */
  range?: number;
  /** The nearest it reaches, when nearer spaces are out of it (Hail's ring); the page outlines it too. */
  minRange?: number;
  /**
   * A ground-targeted area (hail): the spaces within this of the target
   * (0: the space alone). Its effect doesn't depend on where the user
   * stands. None for the rest.
   */
  radius?: number | undefined;
  /**
   * The spaces it covers, for an ability whose area runs from its user
   * rather than around its target (Cleave's line): the page and the
   * playback light these up in place of `radius`'s.
   */
  area?: ((map: MapData, from: Hex, target: Hex) => Hex[]) | undefined;
  /** One line for the side panel, with its damage (the user's power). Range is left out. */
  summary(user: Unit): string;
  /**
   * Aimed at a unit (melee, and Snap Shot), not at a hex: with no unit to aim
   * at, the page disables it. Ground-targeted abilities can be aimed at an
   * empty hex on purpose (hail to deny it).
   */
  targetsUnit?: boolean;
  /** Legal targets with the user standing on `from`. */
  targets(state: FightState, map: MapData, user: Unit, from: Hex): ActionTarget[];
  /**
   * Its target's `to` is a space its user steps to first, as a walk, before
   * the ability resolves from there (Skirmish).
   */
  steps?: boolean;
  /**
   * Its user walks to `to` after the ability resolves (Feigned Retreat):
   * the page aims the unit first, then the space.
   */
  walksAfter?: boolean;
  /**
   * False for an ability aimed at a unit that deals no damage (Shove,
   * Haul), so the AI's guess doesn't count a hit.
   */
  damages?: boolean;
  /**
   * Helps a unit of its user's side and hinders one of the other (Elixir:
   * Empower or Weaken), so the page offers units of either side.
   */
  bothSides?: boolean;
  /**
   * Aimed at two units, `hex` and `to`, either way round (Omen as `bracket` or `swap`): the
   * page aims one and then the other, and the AI tries each pair once.
   */
  pairs?: boolean;
  /**
   * Its target is a space its user may step to first, or its own, and the
   * ability resolves from there (Stomp): the page shows the free
   * ones as a move's, and draws the step.
   */
  stepsTo?: boolean;
  /** With `pairs`, which unit is aimed first matters (Omen as `bracket`). */
  ordered?: boolean;
  /** It Pushes what it hits of its own (Gale, Axe Throw), so Forceful adds none (19.9). */
  pushes?: boolean;
  /**
   * Aimed at one unit or space, nothing more (Snap Shot, Blessing): with
   * Forked (19.9) it takes one extra target (`ActionTarget.also`).
   */
  single?: boolean;
  /**
   * The unit a target aims at, when it isn't simply the one on its hex
   * (Grapple's throw: the held unit, aimed by where it lands). For the
   * page's offered targets and the AI's guess.
   */
  aimedAt?(state: FightState, user: Unit, target: ActionTarget): Unit | undefined;
  /**
   * It records its own actions as it resolves (Swift Strike's dash, one for
   * each unit it cuts, so the page plays a stroke on each), in place of the
   * one at its target.
   */
  recordsOwn?(user: Unit): boolean;
  /** Resolves the ability now. */
  resolve(ctx: Ctx, user: Unit, target: ActionTarget): void;
}

const DIRECTIONS = [0, 1, 2, 3, 4, 5];

function adjacentUnits(state: FightState, from: Hex, keep: (u: Unit) => boolean): ActionTarget[] {
  return hexNeighbors(from)
    .map((h) => unitAt(state, h))
    .filter((u): u is Unit => u !== undefined && keep(u))
    .map((u) => ({hex: u.hex!}));
}

function hexesWithin(
  map: MapData,
  from: Hex,
  range: number,
  keep: (h: Hex) => boolean = () => true
): ActionTarget[] {
  return spacesWithin(map, from, range)
    .filter(keep)
    .map((hex) => ({hex}));
}

const hold: AbilityDef = {
  id: 'hold',
  name: 'Hold',
  summary: () => 'End the turn with no effect.',
  targets: () => [{}],
  resolve: (ctx, user) => log(ctx, `${unitName(user)} holds.`),
};

// ─── Outrider ────────────────────────────────────────────────────────────────

/** An arrow's flight along one hex direction: the hexes it crosses, and the unit it stops at. */
export interface ArrowLane {
  hexes: Hex[];
  hit?: Unit;
}

/**
 * Snap Shot's six lanes from `from`: each runs until the first unit (which
 * it hits), yurts or the map's edge (Snap Shot has no range limit). For the
 * page to show where an arrow can fly, hit or not.
 */
export function arrowLanes(state: FightState, map: MapData, from: Hex): ArrowLane[] {
  return DIRECTIONS.map((dir) => {
    const lane: ArrowLane = {hexes: []};
    for (const h of laneFrom(map, from, dir).slice(0, ABILITY.snapShot.range)) {
      lane.hexes.push(h);
      const u = unitAt(state, h);
      if (u) {
        lane.hit = u;
        break;
      }
    }
    return lane;
  });
}

const snapShot: AbilityDef = {
  id: 'snapShot',
  single: true,
  name: 'Snap Shot',
  kind: 'attack',
  summary: () => 'Shoot straight: hits the first unit in line.',
  targetsUnit: true,
  targets(state, map, _user, from) {
    return arrowLanes(state, map, from)
      .filter((lane) => lane.hit)
      .map((lane) => ({hex: lane.hit!.hex!}));
  },
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    hit(ctx, user, u, `${unitName(user)}'s arrow`);
  },
};

// ─── Ranger ──────────────────────────────────────────────────────────────────

/**
 * Longshot's six lines from `from`, as first built (`ABILITY.longshot.first` off): each runs to the
 * map's edge, through units and yurts, since nothing blocks it.
 */
export function longshotLines(map: MapData, from: Hex): Hex[][] {
  const {minRange, range} = ABILITY.longshot;
  return DIRECTIONS.map((dir) => lineFrom(map, from, dir).slice(minRange - 1, range));
}

/**
 * Longshot's six lanes from `from` (`ABILITY.longshot.first` on): the arrow
 * flies over the spaces nearer than `minRange` (the ones next to the Ranger,
 * as built), units and yurts there included (owner, 2026-10-28), then hits
 * the first unit in line, stopped by yurts, the map's edge or `range`.
 * `ignore`: the Ranger itself, when `from` is not its space.
 */
export function longshotLanes(
  state: FightState,
  map: MapData,
  from: Hex,
  ignore?: Unit
): ArrowLane[] {
  const {minRange, range} = ABILITY.longshot;
  return DIRECTIONS.map((dir) => {
    const lane: ArrowLane = {hexes: []};
    for (const [i, h] of lineFrom(map, from, dir).slice(0, range).entries()) {
      const over = i + 1 < minRange;
      if (!over && !walkable(map, h)) break;
      lane.hexes.push(h);
      const u = over ? undefined : unitAt(state, h);
      if (u && u !== ignore) {
        lane.hit = u;
        break;
      }
    }
    return lane;
  });
}

/**
 * Longshot (owner, 2026-10-27; roster.md): any unit on one of the six
 * straight lines from the Ranger, at any range, ally or enemy; it flies
 * over everything in between.
 */
const longshot: AbilityDef = {
  id: 'longshot',
  single: true,
  get pushes() {
    return ABILITY.longshot.push > 0;
  },
  name: 'Longshot',
  kind: 'attack',
  summary: () => {
    const {first, minRange, pierce, push, delay: slots} = ABILITY.longshot;
    const shot = first
      ? `Shoot straight: hits the first unit in line${minRange > 1 ? ', flying over the spaces next to you' : ''}`
      : 'Shoot straight at any unit in line: nothing blocks it';
    const more = [
      pierce && 'Pierces',
      push > 0 && `Pushes it ${push}`,
      slots > 0 && `Delays it ${slots}`,
    ].filter(Boolean);
    return more.length ? `${shot}. ${more.join(', ')}.` : `${shot}.`;
  },
  targetsUnit: true,
  targets(state, map, _user, from) {
    const out: ActionTarget[] = [];
    const {first, camel} = ABILITY.longshot;
    if (first) {
      for (const {hit: u} of longshotLanes(state, map, from, _user))
        if (u && (camel || u.hero !== CAMEL)) out.push({hex: {...u.hex!}});
      return out;
    }
    for (const l of longshotLines(map, from))
      for (const h of l) {
        const u = unitAt(state, h);
        if (u && (camel || u.hero !== CAMEL)) out.push({hex: h});
      }
    return out;
  },
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    const far = hexDistance(user.hex!, u.hex!) > ABILITY.longshot.falloff;
    hit(
      ctx,
      user,
      u,
      `${unitName(user)}'s arrow`,
      (user.empower ?? 0) - (far ? 1 : 0),
      ABILITY.longshot.pierce
    );
    const {push, delay: slots, weaken: less, pin} = ABILITY.longshot;
    if (!u.alive || !u.hex) return;
    if (push && user.hex) displace(ctx, u, directionTo(user.hex, u.hex), push, 'push');
    delay(ctx, u, slots, user);
    if (less) weaken(ctx, u, less, user);
    if (pin) {
      log(ctx, `${unitName(u)} is pinned.`);
      immobilize(ctx, u, {kind: 'immobilized', pinned: true}, user);
    }
  },
};

/**
 * Skirmish (owner, 2026-10-23, in place of Volley): one step to a free
 * space next to the Outrider (not while Immobilized), then Snap Shot's shot
 * from there, its old space no longer in the way. The step is taken by
 * `applyTurn` before the action, as a walk (`steps`). Charged
 * (`ABILITY.skirmish.charge`), the arrow flies when the charging card comes
 * back, down the same lane (`landShots`), so the unit aimed at can step
 * out of it, or another step into it.
 */
const skirmish: AbilityDef = {
  id: 'skirmish',
  name: 'Skirmish',
  kind: 'attack',
  steps: true,
  summary: (user) =>
    ABILITY.skirmish.charge > 0
      ? `Step 1 space, then draw on a line: charge ${chargeOf(user, 'skirmish')}. When your card comes back, the arrow hits the first unit in that line instead of your turn.`
      : 'Step 1 space, then shoot straight: hits the first unit in line.',
  targetsUnit: true,
  targets(state, map, user, from) {
    if (isImmobilized(user)) return [];
    const out: ActionTarget[] = [];
    const steps = stepsFrom(map, from).filter((h) => !unitAt(state, h));
    for (const to of sortByHex(steps, (h) => h))
      for (const dir of DIRECTIONS) {
        const u = firstInLane(state, map, to, dir, user);
        if (u) out.push({hex: u.hex!, to});
      }
    return out;
  },
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    if (ABILITY.skirmish.charge <= 0) {
      hit(ctx, user, u, `${unitName(user)}'s skirmish arrow`);
      return;
    }
    const dir = DIRECTIONS.find((d) => firstInLane(ctx.state, ctx.map, user.hex!, d, user) === u)!;
    log(ctx, `${unitName(user)} draws on ${unitName(u)}.`);
    (ctx.state.shots ??= []).push({
      source: user.id,
      dir,
      ...(user.empower ? {empower: user.empower} : {}),
    });
  },
};

// ─── Storm Caller ────────────────────────────────────────────────────────────

const hail: AbilityDef = {
  id: 'hail',
  name: 'Hail',
  kind: 'control',
  range: ABILITY.hail.range,
  minRange: ABILITY.hail.range,
  radius: 0,
  summary: () =>
    `A space exactly ${ABILITY.hail.range} away, for ${RULES.durations.hail} slots: hits a unit there; units there or entering are Immobilized, and entering hits them too. Up to ${ABILITY.hail.max} stand at once.`,
  targets: (_state, map, _user, from) =>
    hexesWithin(
      map,
      from,
      ABILITY.hail.range,
      (h) => hexDistance(from, h) === ABILITY.hail.range && !blocks(tileAt(map, h))
    ),
  resolve(ctx, user, target) {
    const hex = target.hex!;
    // `ABILITY.hail.max` a caster (2 since 2026-10-26): a new one past it
    // replaces the oldest; at 1, the last (owner, 2026-10-25).
    if (ABILITY.hail.max <= 1) clearHail(ctx.state, user);
    else {
      const mine = ctx.state.effects.filter((e) => e.source === user.id);
      for (const old of mine.slice(0, Math.max(0, mine.length - ABILITY.hail.max + 1)))
        liftHail(ctx.state, old);
    }
    ctx.state.effects = ctx.state.effects.filter((e) => !hexEquals(e.hex, hex));
    ctx.state.effects.push({
      kind: 'hail',
      hex,
      source: user.id,
      until: lastsThrough(ctx.state, RULES.durations.hail),
    });
    log(ctx, `${unitName(user)} calls down hail.`);
    const u = unitAt(ctx.state, hex);
    if (!u) return;
    hit(ctx, user, u, 'The hail');
    hailHolds(ctx, u);
  },
};

/**
 * Sunlight (owner, 2026-10-23): a space within `ABILITY.sunlight.range`.
 * Hail there melts (`melts`), freeing whoever it held; a unit there that
 * hits (not Temee) and isn't already Empowered (renewing an Empower on
 * itself, the Storm Caller never spent it) is Empowered until the end of
 * its next turn. The Storm Caller may target itself (`self`). Aimed at a
 * space, since hail alone is a target.
 */
const sunlight: AbilityDef = {
  id: 'sunlight',
  single: true,
  name: 'Sunlight',
  kind: 'support',
  range: ABILITY.sunlight.range,
  summary: () =>
    `A space within ${ABILITY.sunlight.range}: hail there melts; a unit there is Empowered ${ABILITY.sunlight.empower} for ${RULES.durations.turn} slots.`,
  targets(state, map, user, from) {
    const {range, self, melts} = ABILITY.sunlight;
    return hexesWithin(map, from, range, (h) => {
      if (blocks(tileAt(map, h))) return false;
      if (melts && state.effects.some((e) => hexEquals(e.hex, h))) return true;
      const u = unitAt(state, h);
      return u !== undefined && u.power > 0 && !u.empower && (u !== user || self);
    });
  },
  resolve(ctx, user, target) {
    const hex = target.hex!;
    log(ctx, `${unitName(user)} calls down sunlight.`);
    if (ABILITY.sunlight.melts) {
      const hail = ctx.state.effects.find((e) => hexEquals(e.hex, hex));
      if (hail) {
        ctx.state.effects = ctx.state.effects.filter((e) => e !== hail);
        for (const u of ctx.state.units)
          u.statuses = u.statuses.filter((s) => s.hail !== hail.source);
        log(ctx, 'The sunlight melts the hail.');
      }
    }
    const u = unitAt(ctx.state, hex);
    if (u) empower(ctx, u, ABILITY.sunlight.empower, user);
  },
};

// ─── Grappler ────────────────────────────────────────────────────────────────

/** Whether `user` is grappling `u`. */
export function grappling(user: Unit, u: Unit): boolean {
  return u.statuses.some((s) => s.grapple?.champion === user.id && s.grapple.target === u.id);
}

/** The unit `user` grapples next to `from`, if any. */
function heldNextTo(state: FightState, user: Unit, from: Hex): Unit | undefined {
  return hexNeighbors(from)
    .map((h) => unitAt(state, h))
    .find((u) => u !== undefined && u !== user && grappling(user, u));
}

/**
 * Whether `target` is a throw: a space without a unit, or the Grappler's
 * own (a swap), rather than a unit to grapple.
 */
function isThrow(state: FightState, user: Unit, target: ActionTarget): boolean {
  const u = unitAt(state, target.hex!);
  return !u || u === user;
}

/**
 * Grapple, with Throw folded in (owner, 2026-10-24; separate abilities
 * before). On a unit next to the Grappler, not the one it holds: grapples
 * it. While it holds one, on a free space next to it: Throw (owner,
 * 2026-10-23), the held unit Moved there; on the Grappler's own space: the
 * two swap places. Neither hits (owner, 2026-10-26: the squeeze is the
 * grapple's damage, so a held unit takes the Grappler's power once a turn,
 * not twice). Either way the two stay next to each other, so the grapple
 * holds. An Immobilized Grappler
 * still swaps (owner, 2026-10-25): the swap is the grapple's move, not a
 * walk of its own.
 */
const grapple: AbilityDef = {
  id: 'grapple',
  name: 'Grapple',
  kind: 'attack',
  summary: () =>
    `Melee: hits it, and its card leaves the track until you take damage or are grappled, then comes back just before your next turn; it takes ${ABILITY.grapple.squeeze} more damage every ${RULES.durations.turn} slots. While grappling: Move it to a free space next to you, or swap places.`,
  targetsUnit: true,
  // Melee only (owner, 2026-10-23; reached 2 spaces, stepping in, before),
  // and not the unit it already grapples: that one is thrown instead. Nor
  // an Unstoppable one (17.4), which a grapple's Stun can't hold.
  targets(state, map, user, from) {
    const out = adjacentUnits(
      state,
      from,
      (u) => u !== user && !grappling(user, u) && !isUnstoppable(u)
    );
    if (heldNextTo(state, user, from)) {
      const landings = stepsFrom(map, from).filter((h) => !unitAt(state, h));
      for (const hex of sortByHex([...landings, from], (h) => h)) out.push({hex});
    }
    return out;
  },
  aimedAt: (state, user, target) =>
    isThrow(state, user, target) ? heldNextTo(state, user, user.hex!) : unitAt(state, target.hex!),
  resolve(ctx, user, target) {
    if (isThrow(ctx.state, user, target)) {
      const u = heldNextTo(ctx.state, user, user.hex!)!;
      if (hexEquals(target.hex!, user.hex!)) {
        const at = u.hex!;
        log(ctx, `${unitName(user)} swaps places with ${unitName(u)}.`);
        // Each enters the other's space; side by side still, the grapple holds.
        enterHex(ctx, u, user.hex!, 'swap', true);
        enterHex(ctx, user, at, 'swap', true);
      } else {
        log(ctx, `${unitName(user)} throws ${unitName(u)}.`);
        enterHex(ctx, u, target.hex!, 'throw');
      }
      // The held unit is Moved: with Rebound it Pushes its new neighbours (19.8).
      displaced(ctx, u);
      return;
    }
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} grapples ${unitName(u)}.`);
    hit(ctx, user, u, 'The grapple');
    if (!u.alive) return;
    // One target at a time: an earlier grapple lets go.
    endGrapples(ctx, (g) => g.champion === user.id);
    stun(ctx, u, {
      kind: 'stunned',
      grapple: {champion: user.id, target: u.id},
      squeezeAt: lastsThrough(ctx.state),
    });
    if (grappling(user, u)) takeOffTrack(ctx, u, user);
  },
};

// ─── Upgrades of 2026-10-24 ──────────────────────────────────────────────────
// Shove and Haul (the Grappler), Feigned Retreat and Volley (the Outrider)
// and Gale (the Storm Caller): owner, 2026-10-24, as measured (balance.md,
// "Second abilities measured").

/** The direction from `from` to `to`, adjacent or in a straight line from it. */
function directionTo(from: Hex, to: Hex): number {
  return hexDirectionTo(from, to)!;
}

/** Shove: melee, Push 2, no damage. */
const shove: AbilityDef = {
  id: 'shove',
  pushes: true,
  single: true,
  name: 'Shove',
  kind: 'control',
  damages: false,
  summary: () => `Melee: Push ${ABILITY.shove.push}.`,
  targetsUnit: true,
  targets: (state, _map, user, from) => adjacentUnits(state, from, (u) => u !== user),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} shoves ${unitName(u)}.`);
    displace(ctx, u, directionTo(user.hex!, u.hex!), ABILITY.shove.push, 'push');
  },
};

/** Haul: the first unit in a lane within range, not next to the Grappler, Pulled 2. No damage. */
const haul: AbilityDef = {
  id: 'haul',
  single: true,
  name: 'Haul',
  kind: 'control',
  damages: false,
  range: ABILITY.haul.range,
  summary: () =>
    `First unit in a line 2–${ABILITY.haul.range} spaces away: Pull ${ABILITY.haul.pull}.`,
  targetsUnit: true,
  targets(state, map, user, from) {
    const out: ActionTarget[] = [];
    for (const dir of DIRECTIONS) {
      const u = firstInLane(state, map, from, dir, user);
      const d = u ? hexDistance(from, u.hex!) : 0;
      if (u && d >= 2 && d <= ABILITY.haul.range) out.push({hex: u.hex!});
    }
    return out;
  },
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} hauls ${unitName(u)}.`);
    displace(ctx, u, directionTo(u.hex!, user.hex!), ABILITY.haul.pull, 'pull');
  },
};

/** The spaces `user` could walk to from `from` in at most `cap` steps, its own left out. */
function walksWithin(state: FightState, map: MapData, user: Unit, from: Hex, cap: number) {
  const at = user.hex;
  user.hex = from;
  try {
    return reachableHexes(state, map, user).filter(
      (r) => r.path.length > 0 && r.path.length <= cap
    );
  } finally {
    user.hex = at;
  }
}

/**
 * Feigned Retreat: the Bow's shot, then a walk of 1 to
 * `ABILITY.feignedRetreat.steps` spaces (`to`), at full damage. Not while
 * Immobilized.
 */
const feignedRetreat: AbilityDef = {
  id: 'feignedRetreat',
  name: 'Feigned Retreat',
  kind: 'attack',
  walksAfter: true,
  summary: () =>
    `Shoot straight: hits the first unit in line. Then walk up to ${ABILITY.feignedRetreat.steps} spaces.`,
  targetsUnit: true,
  targets(state, map, user, from) {
    if (isImmobilized(user)) return [];
    const walks = walksWithin(state, map, user, from, ABILITY.feignedRetreat.steps);
    const out: ActionTarget[] = [];
    for (const lane of arrowLanes(state, map, from))
      if (lane.hit) for (const w of walks) out.push({hex: lane.hit.hex!, to: w.hex});
    return out;
  },
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    hit(ctx, user, u, `${unitName(user)}'s parting arrow`);
    if (!user.alive || isImmobilized(user)) return;
    const back = walksWithin(
      ctx.state,
      ctx.map,
      user,
      user.hex!,
      ABILITY.feignedRetreat.steps
    ).find((r) => hexEquals(r.hex, target.to!));
    if (!back) return;
    walk(ctx, user, back.path);
    log(ctx, `${unitName(user)} falls back.`);
  },
};

/**
 * Gale: a space within range (not yurts); each unit next to it, ally or
 * enemy, the Storm Caller included, takes its power and is Pushed 1 away
 * from it.
 */
const gale: AbilityDef = {
  id: 'gale',
  pushes: true,
  name: 'Gale',
  kind: 'control',
  range: ABILITY.gale.range,
  radius: 1,
  summary: () =>
    `A space within ${ABILITY.gale.range}: each unit next to it is hit and Pushed ${ABILITY.gale.push}.`,
  targets: (_state, map, _user, from) =>
    hexesWithin(map, from, ABILITY.gale.range, (h) => !blocks(tileAt(map, h))),
  resolve(ctx, user, target) {
    const centre = target.hex!;
    log(ctx, `${unitName(user)} calls up a gale.`);
    const caught = sortByHex(
      hexNeighbors(centre)
        .map((h) => unitAt(ctx.state, h))
        .filter((u): u is Unit => u !== undefined),
      (u) => u.hex!
    );
    for (const u of caught) hit(ctx, user, u, 'The gale');
    for (const u of caught)
      if (u.alive) displace(ctx, u, directionTo(centre, u.hex!), ABILITY.gale.push, 'push');
  },
};

/**
 * Volley: arrows from above on a space within range, no line of fire,
 * charged as Skirmish (`ABILITY.volley.charge`): whoever stands there when
 * the Outrider's card comes back takes its power (`landShots`).
 */
const volley: AbilityDef = {
  id: 'volley',
  name: 'Volley',
  kind: 'attack',
  range: ABILITY.volley.range,
  radius: 0,
  summary: (user) =>
    `A space within ${ABILITY.volley.range}: charge ${chargeOf(user, 'volley')}. When your card comes back, hits whoever is there.`,
  targets: (_state, map, _user, from) =>
    hexesWithin(
      map,
      from,
      ABILITY.volley.range,
      (h) => !hexEquals(h, from) && !blocks(tileAt(map, h))
    ),
  resolve(ctx, user, target) {
    log(ctx, `${unitName(user)} looses a volley.`);
    (ctx.state.shots ??= []).push({
      source: user.id,
      hex: {...target.hex!},
      ...(user.empower ? {empower: user.empower} : {}),
    });
  },
};

// ─── Vanguard ────────────────────────────────────────────────────────────────

/** The Cleave area (see `cleaveAreas`) from `from` that holds `target`. */
function cleaveArea(map: MapData, from: Hex, target: Hex): Hex[] {
  const areas = cleaveAreas(map, from);
  // Aimed at its first space; the switches' areas overlap (`ABILITY.cleave.shape`).
  return (
    areas.find((a) => hexEquals(a[0]!, target)) ??
    areas.find((a) => a.some((h) => hexEquals(h, target))) ??
    []
  );
}

/**
 * Cleave (owner, 2026-10-25; its shape, 2026-10-27): a line of 2 spaces
 * straight out from the Vanguard in any of the six directions; each unit
 * in it, ally or enemy, takes the Vanguard's power, and each one left
 * standing is Delayed `ABILITY.cleave.delay` (8, owner, 2026-10-26).
 * Aimed at the line's first space, which may be empty when a unit stands
 * in the second.
 */
const cleave: AbilityDef = {
  id: 'cleave',
  name: 'Cleave',
  kind: 'attack',
  summary: () =>
    `A line of ${ABILITY.cleave.reach} spaces straight out from you, any way: hits every unit in it, allies included, and Delays ${ABILITY.cleave.delay} each one left standing.`,
  area: cleaveArea,
  targets(state, map, user, from) {
    const out: ActionTarget[] = [];
    for (const area of cleaveAreas(map, from))
      if (area.some((h) => unitAt(state, h) && unitAt(state, h) !== user))
        out.push({hex: area[0]!});
    return out;
  },
  resolve(ctx, user, target) {
    const area = cleaveArea(ctx.map, user.hex!, target.hex!);
    log(ctx, `${unitName(user)} cleaves.`);
    // Who stands in the area as it swings: a kill doesn't let the blade reach further.
    const caught = area.map((h) => unitAt(ctx.state, h)).filter((u): u is Unit => u !== undefined);
    for (const u of caught) hit(ctx, user, u, 'The cleave');
    for (const u of caught) delay(ctx, u, ABILITY.cleave.delay, user);
  },
};

// ─── Alchemist ───────────────────────────────────────────────────────────────

/**
 * Whether Elixir does anything to `u`: an ally it Empowers (one that hits),
 * Hastens, makes Unstoppable or heals (one that's hurt); an enemy it hits
 * (`fixed`), Weakens (one that hits) or Delays. Not the Alchemist with
 * `self` off.
 */
const elixirTakes =
  (user: Unit) =>
  (u: Unit | undefined): u is Unit => {
    if (u === undefined || (!ABILITY.elixir.self && u.id === user.id)) return false;
    const {fixed, haste, delay, mode} = ABILITY.elixir;
    // Poison: any unit. Turn about: an ally (hurt or not, to turn it) or an enemy.
    if (mode === 'poison') return u.alive;
    if (mode === 'alternate')
      return elixirHits(user) ? u.side !== user.side : u.side === user.side && elixirHeals(u);
    if (u.side !== user.side)
      return fixed > 0 || delay > 0 || (u.power > 0 && elixirAmount('weaken') > 0);
    return (
      haste > 0 ||
      (u.power > 0 && elixirAmount('empower') > 0) ||
      (elixirHeals(u) && u.hp < u.maxHp)
    );
  };

/**
 * Whether `user`'s next Elixir hits, with `ABILITY.elixir.mode`
 * `alternate`: every second cast (`Unit.elixirCasts`), the first healing.
 */
export const elixirHits = (user: Unit): boolean =>
  ABILITY.elixir.mode === 'alternate' && (user.elixirCasts ?? 0) % 2 === 1;

/** What an Elixir's poison takes in all (`ABILITY.elixir.mode` `poison`): its user's power + `poisonExtra`. */
export const elixirPoison = (user: Unit): number => user.power + ABILITY.elixir.poisonExtra;

/**
 * How far `user`'s Elixir reaches along its lines, or 0 if it isn't aimed
 * in lines: its own setting (`Unit.elixirLine`), else `ABILITY.elixir`'s
 * `range` with `line`.
 */
export const elixirLineRange = (user: Unit): number =>
  user.elixirLine ?? (ABILITY.elixir.line ? ABILITY.elixir.range : 0);

/**
 * Elixir's six lines from `from` for `user` (`elixirLineRange`): 1 to its
 * range straight out, through units and yurts, as Axe Throw's.
 */
export function elixirLines(map: MapData, from: Hex, user: Unit): Hex[][] {
  return DIRECTIONS.map((dir) => lineFrom(map, from, dir).slice(0, elixirLineRange(user)));
}

/** Elixir's Empower or Weaken: `ABILITY.elixir`'s own amount if set, else `fixed` (0: none). */
export const elixirAmount = (which: 'empower' | 'weaken'): number =>
  ABILITY.elixir[which] || ABILITY.elixir.fixed;

/** Whether Elixir heals `u` its user's power (`ABILITY.elixir.heal`). */
export const elixirHeals = (u: Unit): boolean =>
  ABILITY.elixir.heal === 'all' || (ABILITY.elixir.heal === 'heroes' && u.hero !== CAMEL);

/**
 * The units an Elixir aimed at `target` from `from` reaches, by
 * `ABILITY.elixir.shape`: the one on it, those within the radius of it
 * (`burst`), or those within the radius of the Alchemist (`aura`).
 */
export function elixirCaught(state: FightState, user: Unit, from: Hex, target: Hex): Unit[] {
  const {shape, radius} = ABILITY.elixir;
  if (shape === 'unit') return [unitAt(state, target)].filter(elixirTakes(user));
  const centre = shape === 'aura' ? from : target;
  return state.units.filter(
    (u) => u.alive && u.hex && hexDistance(u.hex, centre) <= radius && elixirTakes(user)(u)
  );
}

/**
 * Elixir (owner, 2026-10-25; as built since late on 2026-10-26): an ally
 * within `ABILITY.elixir.range` (3) but the Alchemist, no line of fire,
 * heals the Alchemist's power, is Empowered `empower` (1) and Hastened
 * `haste` (3); nothing on an enemy. Earlier that day a burst next to the
 * Alchemist, Hastening allies 3 and Delaying enemies 3. Other shapes and
 * amounts, a hit and Unstoppable, for measuring, by `ABILITY.elixir`
 * (`elixirCaught`).
 */
const elixir: AbilityDef = {
  id: 'elixir',
  get single() {
    return ABILITY.elixir.shape === 'unit';
  },
  name: 'Elixir',
  kind: 'support',
  bothSides: true,
  // Getters, so the measuring switches (`ABILITY.elixir`) reach the page and the AI.
  get damages() {
    return ABILITY.elixir.mode === 'alternate';
  },
  // No reach to outline in lines: it isn't every space within range.
  get range() {
    return ABILITY.elixir.line ? 0 : ABILITY.elixir.range;
  },
  /** A burst's area, round the space it's aimed at; the other shapes have none. */
  get radius() {
    return ABILITY.elixir.shape === 'burst' ? ABILITY.elixir.radius : undefined;
  },
  /** Only the single-unit shape is aimed at a unit; a burst can land on an empty space. */
  get targetsUnit() {
    return ABILITY.elixir.shape === 'unit';
  },
  summary(user) {
    const {shape, range, radius, fixed, heal, haste: hastes, delay: delays} = ABILITY.elixir;
    const empowers = elixirAmount('empower');
    const weakens = elixirAmount('weaken');
    const effect = () => {
      // Each side's part, the amounts at 0 left out (with Haste and Delay alone, only those).
      const ally = [
        empowers ? `Empowered ${empowers}` : '',
        hastes ? `Hastened ${hastes}` : '',
      ].filter(Boolean);
      const enemy = [
        weakens ? `Weakened ${weakens}` : '',
        delays ? `Delayed ${delays}` : '',
      ].filter(Boolean);
      const allies = heal
        ? `allies heal ${user.power}${ally.length ? ` and are ${ally.join(' and ')}` : ''}`
        : ally.length
          ? `allies are ${ally.join(' and ')}`
          : '';
      const enemies = fixed
        ? `enemies are hit${enemy.length ? `, then ${enemy.join(' and ')}` : ''}`
        : enemy.length
          ? `enemies ${enemy.join(' and ')}`
          : '';
      return `${[allies, enemies].filter(Boolean).join(', ')}${empowers || weakens ? `, for ${RULES.durations.turn} slots` : ''}.`;
    };
    const where = elixirLineRange(user)
      ? `A unit within ${elixirLineRange(user)} in a straight line, over anything in between`
      : `A unit within ${range}${ABILITY.elixir.self ? ', yourself too' : ''}`;
    if (ABILITY.elixir.mode === 'alternate')
      return `${where}: ${elixirHits(user) ? `this time an enemy, hit for ${user.power}` : `this time an ally, healed ${user.power}`}; heal and hit by turns.`;
    if (ABILITY.elixir.mode === 'poison')
      return `${where}: healed ${user.power}, then it loses 1 every ${ABILITY.elixir.poisonEvery} slots until ${elixirPoison(user)} is lost.`;
    const who = `${hastes || delays ? 'unit' : 'unit that hits'}${ABILITY.elixir.self ? '' : ' but you'}`;
    if (shape === 'burst')
      return `${range === 1 ? 'A space next to you, or your own' : `A space within ${range}`}, and every ${who} within ${radius} of it: ${effect()}`;
    if (shape === 'aura') return `Every ${who} within ${radius} of you: ${effect()}`;
    return `${where}: ${effect()}`;
  },
  targets(state, map, user, from) {
    const {shape, range} = ABILITY.elixir;
    if (shape === 'aura')
      return elixirCaught(state, user, from, from).length > 0 ? [{hex: {...from}}] : [];
    if (shape === 'burst')
      return spacesWithin(map, from, range)
        .filter((h) => elixirCaught(state, user, from, h).length > 0)
        .map((h) => ({hex: h}));
    if (elixirLineRange(user))
      return elixirLines(map, from, user)
        .flat()
        .map((h) => unitAt(state, h))
        .filter(elixirTakes(user))
        .map((u) => ({hex: u.hex!}));
    return spacesWithin(map, from, range)
      .map((h) => unitAt(state, h))
      .filter(elixirTakes(user))
      .map((u) => ({hex: u.hex!}));
  },
  resolve(ctx, user, target) {
    const caught = elixirCaught(ctx.state, user, user.hex!, target.hex!);
    const {fixed, haste: hastes, delay: delays, mode, poisonEvery} = ABILITY.elixir;
    if (mode === 'alternate') {
      const hits = elixirHits(user);
      user.elixirCasts = (user.elixirCasts ?? 0) + 1;
      for (const u of caught) {
        log(ctx, `${unitName(user)} gives ${unitName(u)} an elixir.`);
        if (hits) hit(ctx, user, u, 'The elixir');
        else heal(ctx, u, user.power, user);
      }
      return;
    }
    if (mode === 'poison') {
      for (const u of caught) {
        log(ctx, `${unitName(user)} gives ${unitName(u)} an elixir.`);
        heal(ctx, u, user.power, user);
        // A second dose adds to what's left, on the first's clock.
        u.poison = {
          left: (u.poison?.left ?? 0) + elixirPoison(user),
          at: u.poison?.at ?? ctx.slot + poisonEvery,
          by: user.id,
        };
      }
      return;
    }
    for (const u of caught) {
      log(ctx, `${unitName(user)} gives ${unitName(u)} an elixir.`);
      if (u.side === user.side) {
        if (elixirHeals(u)) heal(ctx, u, user.power, user);
        // An amount of 0 gives none, rather than replacing an Empower it has.
        const empowers = elixirAmount('empower');
        if (u.power > 0 && empowers > 0) empower(ctx, u, empowers, user);
        haste(ctx, u, hastes, user);
      } else {
        if (fixed) hit(ctx, user, u, 'The elixir');
        const weakens = elixirAmount('weaken');
        if (u.alive && u.power > 0 && weakens > 0) weaken(ctx, u, weakens, user);
        delay(ctx, u, delays, user);
      }
    }
  },
};

// ─── Priest ──────────────────────────────────────────────────────────────────

/**
 * Whether Blessing can take `u`: an ally of `user`'s, the Priest himself
 * with `ABILITY.blessing.self`, the camel with `.camel`.
 */
const blessingTakes =
  (user: Unit) =>
  (u: Unit | undefined): u is Unit =>
    u !== undefined &&
    u.alive &&
    (u.side === user.side || ABILITY.blessing.smite) &&
    (ABILITY.blessing.self || u.id !== user.id) &&
    (ABILITY.blessing.camel || u.hero !== CAMEL);

/**
 * What Blessing gives `u` from `user`: the health it heals (the Priest's
 * power, up to what `u` is missing) and the Shield it gains (the rest of
 * the heal, with `overheal`, and `ABILITY.blessing.shield` more).
 */
export function blessingOf(user: Unit, u: Unit): {heal: number; shield: number} {
  const {overheal, shield: extra} = ABILITY.blessing;
  // `heal` off: a Shield of his power in place of the heal.
  const healed = ABILITY.blessing.heal ? Math.min(user.power, Math.max(0, u.maxHp - u.hp)) : 0;
  const given = ABILITY.blessing.heal
    ? (overheal ? user.power - healed : 0) + extra
    : user.power + extra;
  // `lasts`: a unit holds at most `cap` of lasting Shield.
  const room = ABILITY.blessing.lasts
    ? Math.max(0, ABILITY.blessing.cap - (u.lastingShield ?? 0))
    : Infinity;
  return {heal: healed, shield: Math.min(given, room)};
}

/**
 * A Blessing on `u` by the track (`ABILITY.blessing.mode` `track`): its
 * card `d` slots past the current one (the Priest's own, acting, 0), a heal
 * below `split` and a hit above it, the amount by `scale` from the Priest's
 * power with his Empower, Weaken and passives.
 */
export function trackBlessing(state: FightState, user: Unit, u: Unit): {heal: number; hit: number} {
  const {split, scale} = ABILITY.blessing;
  if (u.slot === null && u.id !== user.id) return {heal: 0, hit: 0};
  if (!u.alive) return {heal: 0, hit: 0};
  const d = u.id === user.id ? 0 : u.slot! - state.currentSlot;
  const power = damageOf(user, user.empower ?? 0, state);
  const off = Math.abs(d - split);
  const amount =
    scale === 'cap'
      ? Math.min(power, off)
      : off >= 2
        ? power
        : off === 1
          ? Math.floor(power / 2)
          : 0;
  return d < split ? {heal: amount, hit: 0} : {heal: 0, hit: amount};
}

/**
 * A track Blessing's heal on ally `u` (`trackBlessing`): what it restores,
 * and with `ABILITY.blessing.trackShield` the rest of it as Shield, held
 * to `cap` of lasting Shield as `blessingOf`'s.
 */
export function trackHealOf(
  state: FightState,
  user: Unit,
  u: Unit
): {heal: number; shield: number} {
  const {heal: amount} = trackBlessing(state, user, u);
  const healed = Math.min(amount, Math.max(0, u.maxHp - u.hp));
  if (!ABILITY.blessing.trackShield) return {heal: healed, shield: 0};
  const room = ABILITY.blessing.lasts
    ? Math.max(0, ABILITY.blessing.cap - (u.lastingShield ?? 0))
    : Infinity;
  return {heal: healed, shield: Math.min(amount - healed, room)};
}

/**
 * Whether a track Blessing can take `u`: within reach as `blessingTakes`
 * allows, of either side, an ally it would heal or an enemy it would hit.
 */
function trackTakes(state: FightState, user: Unit, u: Unit | undefined): u is Unit {
  if (
    u === undefined ||
    !u.alive ||
    (!ABILITY.blessing.self && u.id === user.id) ||
    (!ABILITY.blessing.camel && u.hero === CAMEL)
  )
    return false;
  const given = trackBlessing(state, user, u);
  return u.side === user.side ? given.heal > 0 : ABILITY.blessing.trackSmite && given.hit > 0;
}

/** Whether `user`'s Blessing in a line blesses itself: its own setting, else `ABILITY.blessing.lineSelf`. */
function blessesSelf(user: Unit): boolean {
  return user.blessesSelf ?? ABILITY.blessing.lineSelf;
}

/**
 * Blessing's six lines from `from` (`ABILITY.blessing.shape` `line`): each
 * straight out to the map's edge through anything, for the page's lanes.
 */
export function blessingLines(map: MapData, from: Hex): Hex[][] {
  return DIRECTIONS.map((dir) => lineFrom(map, from, dir));
}

/**
 * A Blessing's line (`ABILITY.blessing.shape` `line`) from `from` toward
 * `target`: every space straight out to the map's edge, through anything.
 */
export function blessingLine(map: MapData, from: Hex, target: Hex): Hex[] {
  const dir = hexDirectionTo(from, target);
  return dir === null ? [] : lineFrom(map, from, dir);
}

/**
 * The allies a Blessing from `from` aimed at `target` reaches: the one on
 * `target`, or with `ABILITY.blessing.shape` `aura` every ally within
 * `radius` of the Priest.
 */
export function blessingCaught(
  state: FightState,
  user: Unit,
  from: Hex,
  target: Hex,
  map?: MapData
): Unit[] {
  const {shape, radius} = ABILITY.blessing;
  if (shape === 'unit') return [unitAt(state, target)].filter(blessingTakes(user));
  if (shape === 'line') {
    const caught = blessingLine(map!, from, target)
      .map((h) => unitAt(state, h))
      .filter(
        (u): u is Unit => u !== undefined && u.alive && (ABILITY.blessing.camel || u.hero !== CAMEL)
      );
    return blessesSelf(user) ? [user, ...caught] : caught;
  }
  return state.units.filter(
    (u) =>
      u.side === user.side &&
      u.hex !== null &&
      hexDistance(u.id === user.id ? from : u.hex, from) <= radius &&
      blessingTakes(user)(u)
  );
}

/**
 * Blessing as built since 2026-10-30 (owner; balance.md, "Blessing in a
 * line"): `ABILITY.blessing.shape` `line` with `lineSelf`, every unit on
 * one of the Priest's six lines, through anything, and the Priest himself,
 * blessed as below. As first built (owner, 2026-10-28; roster.md): one ally within
 * `ABILITY.blessing.range` (2), the Priest himself too, the camel too, no
 * line of fire, heals the Priest's power; what the heal can't restore
 * becomes Shield until the start of the ally's next turn (keywords.md,
 * 17.6). Nothing on an enemy, unless `ABILITY.blessing.smite`: then it
 * hits an enemy for the Priest's power.
 */
const blessing: AbilityDef = {
  id: 'blessing',
  get single() {
    return ABILITY.blessing.shape === 'unit';
  },
  name: 'Blessing',
  kind: 'support',
  get damages() {
    return ABILITY.blessing.mode === 'track' && ABILITY.blessing.trackSmite;
  },
  get targetsUnit() {
    return ABILITY.blessing.shape === 'unit';
  },
  get area() {
    return ABILITY.blessing.shape === 'line' ? blessingLine : undefined;
  },
  get bothSides() {
    return (
      ABILITY.blessing.shape === 'line' ||
      ABILITY.blessing.smite ||
      (ABILITY.blessing.mode === 'track' && ABILITY.blessing.trackSmite)
    );
  },
  // No reach to outline: an aura is around him, a line runs to the map's edge.
  get range() {
    return ABILITY.blessing.shape === 'unit' ? ABILITY.blessing.range : 0;
  },
  summary(user) {
    const {range, self, overheal, shield: extra, shape, radius} = ABILITY.blessing;
    if (ABILITY.blessing.mode === 'track') {
      const {split, scale} = ABILITY.blessing;
      const power = damageOf(user);
      const half = Math.floor(power / 2);
      const by =
        scale === 'cap'
          ? `1 a slot from ${split}, at most ${power}`
          : `${power}, or ${half} a slot either side of ${split}`;
      const rest = ABILITY.blessing.trackShield
        ? ` What it can’t heal becomes Shield, ${ABILITY.blessing.lasts ? `until spent, at most ${ABILITY.blessing.cap} on a unit` : `for ${RULES.durations.turn} slots`}.`
        : '';
      const smites = ABILITY.blessing.trackSmite ? `, an enemy’s over ${split} hit` : '';
      return `${ABILITY.blessing.trackSmite ? 'A unit' : 'An ally'} within ${range}${self ? ', yourself too' : ''}, by its card: an ally’s under ${split} slots on healed${smites}, ${by}.${rest}`;
    }
    const who =
      shape === 'line'
        ? `Every unit in a straight line out from you, through anything, enemies too${blessesSelf(user) ? ', and yourself' : ''}`
        : shape === 'aura'
          ? `Every ally within ${radius} of you${self ? ', yourself too' : ''}`
          : `An ally within ${range}${self ? ', yourself too' : ''}`;
    const until = ABILITY.blessing.lasts
      ? `until spent, at most ${ABILITY.blessing.cap} on a unit`
      : `for ${RULES.durations.turn} slots`;
    if (!ABILITY.blessing.heal) return `${who}: Shield ${user.power + extra} ${until}.`;
    const shields = [
      overheal ? 'what it can’t heal becomes Shield' : '',
      extra ? `Shield ${extra}${overheal ? ' more' : ''}` : '',
    ].filter(Boolean);
    const smite = ABILITY.blessing.smite ? ` An enemy within ${range} is hit instead.` : '';
    return `${who}: heals ${user.power}${shields.length ? `; ${shields.join(', and ')}, ${until}` : ''}.${smite}`;
  },
  targets(state, map, user, from) {
    if (ABILITY.blessing.mode === 'track')
      return spacesWithin(map, from, ABILITY.blessing.range)
        .map((h) => unitAt(state, h))
        .filter((u): u is Unit => trackTakes(state, user, u))
        .map((u) => ({hex: u.hex!}));
    if (ABILITY.blessing.shape === 'aura')
      return blessingCaught(state, user, from, from, map).length > 0 ? [{hex: {...from}}] : [];
    // A line: any of the six, aimed at its first space (a tap anywhere along it
    // aims it, as `area`), with or without a unit on it (owner, 2026-10-30).
    if (ABILITY.blessing.shape === 'line')
      return blessingLines(map, from)
        .filter((l) => l.length > 0)
        .map((l) => ({hex: {...l[0]!}}));
    return spacesWithin(map, from, ABILITY.blessing.range)
      .map((h) => unitAt(state, h))
      .filter(blessingTakes(user))
      .map((u) => ({hex: u.hex!}));
  },
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!);
    if (u && ABILITY.blessing.mode === 'track') {
      const given = trackBlessing(ctx.state, user, u);
      if (u.side === user.side) {
        log(ctx, `${unitName(user)} blesses ${unitName(u)}.`);
        const healed = trackHealOf(ctx.state, user, u);
        heal(ctx, u, given.heal, user);
        shield(ctx, u, healed.shield, ABILITY.blessing.lasts);
      } else {
        log(ctx, `${unitName(user)} smites ${unitName(u)}.`);
        hitFor(ctx, user, u, 'The smiting', given.hit);
      }
      return;
    }
    if (u && u.side !== user.side && ABILITY.blessing.shape !== 'line') {
      log(ctx, `${unitName(user)} smites ${unitName(u)}.`);
      hit(ctx, user, u, 'The smiting');
      return;
    }
    for (const a of blessingCaught(ctx.state, user, user.hex!, target.hex!, ctx.map)) {
      const given = blessingOf(user, a);
      log(ctx, `${unitName(user)} blesses ${unitName(a)}.`);
      heal(ctx, a, given.heal, user);
      shield(ctx, a, given.shield, ABILITY.blessing.lasts);
    }
  },
};

// ─── Duelist ─────────────────────────────────────────────────────────────────

/**
 * Where a lunge from `from` at the unit on `to` ends: the space next to it,
 * straight back toward `from` (`from` itself when they are next to each other).
 */
export function lungeEnd(from: Hex, to: Hex): Hex {
  const dir = hexDirectionTo(from, to)!;
  let at = from;
  while (hexDistance(at, to) > 1) at = hexNeighbor(at, dir);
  return at;
}

/** `u`'s Swift Strike lunge: its own (the test stage's), else `ABILITY.swiftStrike.lunge`. */
export const lungeOf = (u: Unit): number => u.lunge ?? ABILITY.swiftStrike.lunge;
/** Whether `u`'s Swift Strike jumps: its own (the test stage's), else `ABILITY.swiftStrike.jump`. */
export const jumps = (u: Unit): boolean => u.jump ?? ABILITY.swiftStrike.jump;

/** `u`'s Swift Strike dash, in spaces (`ABILITY.swiftStrike.dash`), its own first; 0: none. */
export const dashOf = (u: Unit): number => u.dash ?? ABILITY.swiftStrike.dash;

/**
 * Swift Strike's dashes from `from` (`dashOf`), aimed at the space it lands
 * on: along each of the six directions, exactly `dash` spaces out when that
 * space is free, or, with yurts or the map's edge on it, one fewer; with at
 * least one unit on the spaces before the landing. Not Immobilized.
 */
function dashTargets(state: FightState, map: MapData, user: Unit, from: Hex): ActionTarget[] {
  const n = dashOf(user);
  if (isImmobilized(user) || n < 2) return [];
  const out: ActionTarget[] = [];
  const shortest = user.dashMin ?? ABILITY.swiftStrike.dashMin;
  if (shortest > 0) {
    // Any length from `dashMin` to `dash`, on a free space, a unit passed on the way.
    for (const dir of DIRECTIONS) {
      const way = laneFrom(map, from, dir);
      for (let len = Math.max(2, shortest); len <= n && len <= way.length; len++) {
        const land = way[len - 1]!;
        const other = unitAt(state, land);
        if ((other && other !== user) || !mayEndOn(map, user, land)) continue;
        if (way.slice(0, len - 1).some((h) => unitAt(state, h))) out.push({hex: land});
      }
    }
    return sortByHex(out, (t) => t.hex!);
  }
  for (const dir of DIRECTIONS) {
    const way = laneFrom(map, from, dir);
    // Yurts or the edge on the last space: one fewer.
    const len = way.length >= n ? n : way.length === n - 1 ? n - 1 : 0;
    if (len === 0) continue;
    const land = way[len - 1]!;
    const other = unitAt(state, land);
    if (other && other !== user) continue;
    if (!mayEndOn(map, user, land)) continue;
    if (way.slice(0, len - 1).some((h) => unitAt(state, h))) out.push({hex: land});
  }
  return sortByHex(out, (t) => t.hex!);
}

/**
 * A dash to `to` (`dashTargets`): each unit on the way hit as it goes by,
 * hail on a free space ending it there; Hastened once if it hit.
 */
function dash(ctx: Ctx, user: Unit, to: Hex): void {
  const dir = hexDirectionTo(user.hex!, to)!;
  log(ctx, `${unitName(user)} dashes.`);
  let hits = 0;
  let at = user.hex!;
  while (user.alive && !hexEquals(at, to)) {
    at = hexNeighbor(at, dir);
    const u = unitAt(ctx.state, at);
    if (u && u !== user) {
      record(ctx.state, {kind: 'action', unitId: user.id, ability: 'swiftStrike', target: at});
      log(ctx, `${unitName(user)} cuts ${unitName(u)} passing.`);
      hit(ctx, user, u, 'The sword');
      hits++;
      continue;
    }
    if (!walkable(ctx.map, at)) break;
    enterHex(ctx, user, at, 'walk', !hexEquals(at, to));
    if (isImmobilized(user)) break;
  }
  if (user.alive) endGrapplesApart(ctx, user);
  if (hits > 0 && user.alive) struck(ctx, user);
}

/**
 * Swift Strike's jumps from `from` (`jumps`): over a unit next to it, not
 * one it has jumped this turn, to the free space straight past it, which a
 * jump is aimed at. Not Immobilized.
 */
function jumpTargets(state: FightState, map: MapData, user: Unit, from: Hex): ActionTarget[] {
  if (isImmobilized(user)) return [];
  const out: ActionTarget[] = [];
  for (const dir of DIRECTIONS) {
    const over = hexNeighbor(from, dir);
    const u = unitAt(state, over);
    if (!u || u === user || user.jumped?.includes(u.id)) continue;
    const land = hexNeighbor(over, dir);
    if (walkable(map, land) && !unitAt(state, land) && mayEndOn(map, user, land))
      out.push({hex: land});
  }
  return out;
}

/** Whether `target` is a jump (`jumpTargets`): a free space 2 away, a unit between. */
function isJump(state: FightState, user: Unit, target: ActionTarget): boolean {
  const h = target.hex!;
  if (!jumps(user) || unitAt(state, h) || hexDistance(user.hex!, h) !== 2) return false;
  const dir = hexDirectionTo(user.hex!, h);
  return dir !== null && Boolean(unitAt(state, hexNeighbor(user.hex!, dir)));
}

/**
 * A jump over the unit next to it to `to`: the unit hit, the Duelist on
 * `to`; if it can jump again from there, its turn goes on (`Unit.chaining`).
 */
function jump(ctx: Ctx, user: Unit, to: Hex): void {
  const dir = hexDirectionTo(user.hex!, to)!;
  const u = unitAt(ctx.state, hexNeighbor(user.hex!, dir))!;
  log(ctx, `${unitName(user)} leaps over ${unitName(u)}, cutting it.`);
  user.jumped = [...(user.jumped ?? []), u.id];
  hit(ctx, user, u, 'The sword');
  const first = !user.struck;
  if (user.alive) enterHex(ctx, user, to, 'walk');
  if (first && user.alive) struck(ctx, user);
  else user.struck = true;
  user.chaining =
    (user.chain ?? ABILITY.swiftStrike.chain) &&
    user.alive &&
    ctx.state.phase === 'fight' &&
    jumpTargets(ctx.state, ctx.map, user, to).length > 0;
}

/** Whether `u`'s lunge passes through units: its own (the test stage's), else `ABILITY.swiftStrike.passThrough`. */
export const passesThrough = (u: Unit): boolean => u.passThrough ?? ABILITY.swiftStrike.passThrough;
/** `u`'s flat Swift Strike Haste: its own, else `ABILITY.swiftStrike.haste`. */
const hasteOf = (u: Unit): number => u.swiftHaste ?? ABILITY.swiftStrike.haste;
/** `u`'s Swift Strike streak: its own, else `ABILITY.swiftStrike.streak`. */
const streakOf = (u: Unit): number[] => u.streakHaste ?? ABILITY.swiftStrike.streak;

/**
 * Swift Strike's targets from `from`: the units next to it, and with a
 * lunge (`ABILITY.swiftStrike.lunge`), the first unit straight out along
 * each of the six directions with no more than `lunge` free spaces before
 * it, stopped by yurts, the map's edge and other units; a lunge into hail
 * ends there (it Immobilizes), so only the space past it is still in reach.
 * An Immobilized Duelist strikes next to it only.
 */
function swiftStrikeTargets(
  state: FightState,
  map: MapData,
  user: Unit,
  from: Hex
): ActionTarget[] {
  if (dashOf(user) > 0) return dashTargets(state, map, user, from);
  if (jumps(user)) {
    const out = jumpTargets(state, map, user, from);
    if (user.chaining) return out;
    out.push(...lungeTargets(state, map, user, from));
    return sortByHex(out, (t) => t.hex!);
  }
  return lungeTargets(state, map, user, from);
}

/** Swift Strike's strikes from `from`, next to it or after a lunge (`swiftStrikeTargets`). */
function lungeTargets(state: FightState, map: MapData, user: Unit, from: Hex): ActionTarget[] {
  const reach = isImmobilized(user) ? 0 : lungeOf(user);
  if (reach === 0) return adjacentUnits(state, from, (u) => u !== user);
  const out: ActionTarget[] = [];
  for (const dir of DIRECTIONS) {
    const way = laneFrom(map, from, dir);
    let limit = reach;
    for (let i = 0; i <= limit && i < way.length; i++) {
      const h = way[i]!;
      const u = unitAt(state, h);
      if (u && u !== user) {
        // An enemy can't end its lunge on the camel's exit (`mayEndOn`).
        if (i === 0 || mayEndOn(map, user, way[i - 1]!)) out.push({hex: h});
        break;
      }
      if (stopsWalk(state, user, h)) limit = Math.min(limit, i + 1);
    }
    if (passesThrough(user)) out.push(...passTargets(state, map, user, way, reach));
  }
  return sortByHex(out, (t) => t.hex!);
}

/**
 * A lunge through units (`passesThrough`) along `way`: landing on a free
 * space up to `reach` out with a unit on a space before it, each unit
 * passed through hit, then the unit in front, if any. Aimed at the landing
 * space, so a free space aims it through and a unit aims it at that unit.
 * Yurts stop it; hail on a free space it would cross does too (it ends a walk).
 */
function passTargets(
  state: FightState,
  map: MapData,
  user: Unit,
  way: Hex[],
  reach: number
): ActionTarget[] {
  const out: ActionTarget[] = [];
  let passed = false;
  for (let i = 0; i < reach && i < way.length; i++) {
    const h = way[i]!;
    const u = unitAt(state, h);
    if (u && u !== user) {
      passed = true;
      continue;
    }
    if (passed && mayEndOn(map, user, h)) out.push({hex: h});
    if (stopsWalk(state, user, h)) break;
  }
  return out;
}

/**
 * The spaces of the units a Swift Strike from `from` at `target` hits: the
 * unit aimed at, or, aimed at a free space (`passTargets`), those passed
 * through on the way there and the one in front of it.
 */
export function lungeCaught(
  state: FightState,
  from: Hex,
  target: ActionTarget,
  user?: Unit
): Hex[] {
  const to = target.hex!;
  // A dash (`dashTargets`): the units on the way, none past it.
  if (user && dashOf(user) > 0) {
    const dir = hexDirectionTo(from, to)!;
    const out: Hex[] = [];
    for (let at = hexNeighbor(from, dir); !hexEquals(at, to); at = hexNeighbor(at, dir))
      if (unitAt(state, at)) out.push(at);
    return out;
  }
  if (unitAt(state, to)) return [to];
  // A jump (`jumpTargets`): the unit jumped only.
  if (user && isJump(state, {...user, hex: from}, target))
    return [hexNeighbor(from, hexDirectionTo(from, to)!)];
  const dir = hexDirectionTo(from, to)!;
  const out: Hex[] = [];
  for (let at = hexNeighbor(from, dir); !hexEquals(at, to); at = hexNeighbor(at, dir))
    if (unitAt(state, at)) out.push(at);
  const front = hexNeighbor(to, dir);
  if (unitAt(state, front)) out.push(front);
  return out;
}

/**
 * Swift Strike's Haste on `u`'s `n`th hit of a streak (`streakOf`), or
 * `ABILITY.swiftStrike.haste` without one.
 */
export function swiftStrikeHaste(u: Unit, n: number): number {
  const streak = streakOf(u);
  return streak.length === 0 ? hasteOf(u) : streak[Math.min(n, streak.length) - 1]!;
}

/**
 * Swift Strike (owner, 2026-10-26): melee, the Duelist's power; when it
 * hits, its card is Hastened `ABILITY.swiftStrike.haste`, taken off as its
 * card is placed after this turn (`haste`). Two switches, off as built
 * (2026-10-30, measured in balance.md, "The Duelist's lunge and streak"):
 * `lunge`, a walk of up to that many spaces straight at the unit first,
 * ending next to it (`swiftStrikeTargets`); `streak`, the Haste by how many
 * turns running it has struck (`Unit.streak`), a turn without a strike
 * starting it again.
 */
const swiftStrike: AbilityDef = {
  id: 'swiftStrike',
  // Aimed at one unit, as first built; a dash moves him, so not Forked (19.9).
  get single() {
    return ABILITY.swiftStrike.dash === 0;
  },
  name: 'Swift Strike',
  kind: 'attack',
  summary: (user) => {
    const lunge = lungeOf(user);
    const streak = streakOf(user);
    const first =
      dashOf(user) > 0
        ? (user.dashMin ?? ABILITY.swiftStrike.dashMin) > 0
          ? `Dash ${user.dashMin ?? ABILITY.swiftStrike.dashMin} to ${dashOf(user)} straight, through units, hitting each passed.`
          : `Dash exactly ${dashOf(user)} straight, through units, hitting each passed (${dashOf(user) - 1} if yurts or the edge are in the way).`
        : jumps(user)
          ? `${lunge > 0 ? `Strike a unit up to ${lunge + 1} away in line, stepping in` : 'Melee'}, or jump a unit next to you to the space past it, hitting it${(user.chain ?? ABILITY.swiftStrike.chain) ? ', and jump again from there' : ''}.`
          : lunge === 0
            ? 'Melee.'
            : passesThrough(user)
              ? `Lunge up to ${lunge} straight and strike the first unit, or through units to a free space, hitting each passed and the one in front.`
              : `Lunge up to ${lunge} straight and strike the first unit.`;
    const then =
      streak.length > 0
        ? ` When it hits, its card is Hastened ${streak.join(', then ')} on turns striking running.`
        : hasteOf(user) > 0
          ? ` When it hits, its card is Hastened ${hasteOf(user)}.`
          : '';
    return `${first}${then}`;
  },
  /** Aimed through units at a free space: an enemy it would hit there, else the first unit. */
  aimedAt(state, user, target) {
    const caught = lungeCaught(state, user.hex!, target, user).map((h) => unitAt(state, h)!);
    return caught.find((u) => hostile(u, user)) ?? caught[0];
  },
  targetsUnit: true,
  targets: swiftStrikeTargets,
  recordsOwn: (user) => dashOf(user) > 0,
  resolve(ctx, user, target) {
    if (dashOf(user) > 0) return dash(ctx, user, target.hex!);
    if (isJump(ctx.state, user, target)) return jump(ctx, user, target.hex!);
    if (!unitAt(ctx.state, target.hex!)) return lungeThrough(ctx, user, target.hex!);
    const goal = target.hex!;
    const dir = hexDirectionTo(user.hex!, goal)!;
    if (hexDistance(user.hex!, goal) > 1) {
      log(ctx, `${unitName(user)} lunges.`);
      while (user.alive && user.hex && hexDistance(user.hex, goal) > 1 && !isImmobilized(user)) {
        const next = hexNeighbor(user.hex, dir);
        if (!walkable(ctx.map, next) || unitAt(ctx.state, next)) break;
        enterHex(ctx, user, next, 'walk', true);
      }
      if (user.alive) endGrapplesApart(ctx, user);
    }
    const u = unitAt(ctx.state, goal);
    if (!user.alive || !user.hex || !u || hexDistance(user.hex, goal) !== 1) return;
    log(ctx, `${unitName(user)} strikes ${unitName(u)} with the sword.`);
    hit(ctx, user, u, 'The sword');
    struck(ctx, user);
  },
};

/** Swift Strike's Haste once it has hit, and its streak (`Unit.streak`). */
function struck(ctx: Ctx, user: Unit): void {
  if (!user.struck) user.streak = (user.streak ?? 0) + 1;
  user.struck = true;
  haste(ctx, user, swiftStrikeHaste(user, user.streak ?? 1));
}

/**
 * A lunge through units to `to` (`passTargets`): each unit passed through
 * hit as it goes by, then the unit in front of `to`, if any; hail on a free
 * space on the way ends it there.
 */
function lungeThrough(ctx: Ctx, user: Unit, to: Hex): void {
  const dir = hexDirectionTo(user.hex!, to)!;
  log(ctx, `${unitName(user)} lunges through.`);
  let hits = 0;
  let at = user.hex!;
  while (user.alive && !hexEquals(at, to)) {
    at = hexNeighbor(at, dir);
    const u = unitAt(ctx.state, at);
    if (u && u !== user) {
      log(ctx, `${unitName(user)} cuts ${unitName(u)} passing.`);
      hit(ctx, user, u, 'The sword');
      hits++;
      continue;
    }
    if (!walkable(ctx.map, at)) break;
    enterHex(ctx, user, at, 'walk', true);
    if (isImmobilized(user)) break;
  }
  if (user.alive) endGrapplesApart(ctx, user);
  const front = user.alive && user.hex ? unitAt(ctx.state, hexNeighbor(user.hex, dir)) : undefined;
  if (front && hexEquals(user.hex!, to)) {
    log(ctx, `${unitName(user)} strikes ${unitName(front)} with the sword.`);
    hit(ctx, user, front, 'The sword');
    hits++;
  }
  if (hits > 0 && user.alive) struck(ctx, user);
}

// ─── Magus ───────────────────────────────────────────────────────────────────

/**
 * The units Omen can take from `from`: within its range, not the
 * Magus, not Inevitable, and with a card before the Magus's next turn
 * (its action cost on from now), so each still acts before it does again.
 */
export function omenTakes(state: FightState, user: Unit, from: Hex): Unit[] {
  const next = aimSlot(state, user);
  return state.units.filter(
    (u) =>
      u.alive &&
      u !== user &&
      u.hex !== null &&
      u.slot !== null &&
      u.slot > state.currentSlot &&
      u.slot < next &&
      hexDistance(u.hex, from) <= ABILITY.omen.range &&
      !hasPassive(u, 'steadyGait')
  );
}

/**
 * Omen (owner, 2026-10-28; roster.md), the Magus's: one unit, an ally to
 * act next, an enemy after his next turn (`mode: 'single'`). Named
 * Conjunction until then, when it was two units (`swap`, then `bracket`).
 */
const omen: AbilityDef = {
  id: 'omen',
  get single() {
    return ABILITY.omen.mode === 'single';
  },
  name: 'Omen',
  kind: 'control',
  damages: false,
  bothSides: true,
  // Omen aims one unit.
  get pairs() {
    return ABILITY.omen.mode !== 'single';
  },
  get ordered() {
    return ABILITY.omen.mode !== 'swap';
  },
  targetsUnit: true,
  get range() {
    return ABILITY.omen.range;
  },
  summary: () =>
    ABILITY.omen.mode === 'single'
      ? `A unit within ${ABILITY.omen.range} whose turn comes before your next: an ally acts next, an enemy just after your next turn.`
      : ABILITY.omen.mode === 'before'
        ? `Two units within ${ABILITY.omen.range} whose turns come before your next: the first acts next, the second just before your next turn.`
        : ABILITY.omen.mode === 'bracket'
          ? `Two units within ${ABILITY.omen.range} whose turns come before your next: the first acts next, the second just after your next turn.`
          : `Two units within ${ABILITY.omen.range} whose turns come before your next swap places on the track.`,
  targets(state, _map, user, from) {
    const units = sortByHex(omenTakes(state, user, from), (u) => u.hex!);
    const {mode, once} = ABILITY.omen;
    const out: ActionTarget[] = [];
    if (mode === 'single') return units.map((u) => ({hex: {...u.hex!}}));
    for (const a of units)
      for (const b of units)
        if (a !== b && !(mode === 'bracket' && once && b.bracketed))
          out.push({hex: {...a.hex!}, to: {...b.hex!}});
    return out;
  },
  resolve(ctx, user, target) {
    const a = unitAt(ctx.state, target.hex!)!;
    if (ABILITY.omen.mode === 'single') {
      const {rider} = ABILITY.omen;
      log(ctx, `${unitName(user)} reads an omen in the stars.`);
      if (a.side === user.side) {
        setCard(ctx, a, ctx.state.currentSlot + 1);
        log(ctx, `${unitName(a)} acts next.`);
        if (rider) empower(ctx, a, rider, user);
      } else {
        setCard(ctx, a, aimSlot(ctx.state, user) + 1);
        log(ctx, `${unitName(a)} waits until after ${unitName(user)} again.`);
        if (rider) weaken(ctx, a, rider, user);
      }
      return;
    }
    const b = unitAt(ctx.state, target.to!)!;
    log(ctx, `${unitName(user)} reads a conjunction in the stars.`);
    if (ABILITY.omen.mode === 'bracket') {
      setCard(ctx, a, ctx.state.currentSlot + 1);
      setCard(ctx, b, aimSlot(ctx.state, user) + 1);
      b.bracketed = true;
      log(ctx, `${unitName(a)} acts next; ${unitName(b)} after ${unitName(user)} again.`);
    } else if (ABILITY.omen.mode === 'before') {
      setCard(ctx, a, ctx.state.currentSlot + 1);
      setCard(ctx, b, aimSlot(ctx.state, user) - 1);
      log(ctx, `${unitName(a)} acts next; ${unitName(b)} just before ${unitName(user)} again.`);
    } else swapCards(ctx, a, b);
    for (const u of [a, b]) {
      if (u.side === user.side) continue;
      if (ABILITY.omen.hit) hit(ctx, user, u, `${unitName(user)}'s stars`);
      delay(ctx, u, ABILITY.omen.delay, user);
    }
  },
};

// ─── Juggernaut ──────────────────────────────────────────────────────────────

/** The units standing in a row from `h` along direction `dir`, `h`'s first; none if it is free. */
function rowFrom(state: FightState, h: Hex, dir: number): Unit[] {
  const row: Unit[] = [];
  for (let at = h, u = unitAt(state, at); u; at = hexNeighbor(at, dir), u = unitAt(state, at))
    row.push(u);
  return row;
}

/** Whether a row of units can be Pushed 1 along `dir`: none Rooted or Unstoppable, and free ground past it. */
function rowGives(state: FightState, map: MapData, row: Unit[], dir: number): boolean {
  const past = hexNeighbor(row[row.length - 1]!.hex!, dir);
  return (
    walkable(map, past) &&
    !unitAt(state, past) &&
    row.every((u) => !isUnstoppable(u) && !hasPassive(u, 'rooted'))
  );
}

/**
 * What a Stomp from `from` aimed at `target` would do, without doing it:
 * the units it would hit, and where the Juggernaut would end, if no
 * one falls and nothing it enters on the way changes the board (hail's
 * hits, Rebound). For the AI's guess.
 */
export function stompPlan(
  state: FightState,
  map: MapData,
  from: Hex,
  target: Hex
): {caught: Unit[]; end: Hex} {
  // A stomp's target is where it lands, an enemy there shoved on ahead,
  // next to it again.
  if (ABILITY.stomp.mode === 'stomp') {
    const shoved = hexEquals(target, from) ? undefined : unitAt(state, target);
    const caught = stompCaught(state, target).filter((u) => !hexEquals(u.hex!, from));
    return {caught: shoved ? [...caught, shoved] : caught, end: target};
  }
  return chargePlan(state, map, from, target);
}

/**
 * What a charge (Stomp's `charge` mode, the Bull Demon King's Gore) from `from`
 * toward `target` would do, as `stompPlan`: whom it hits and where it ends.
 */
export function chargePlan(
  state: FightState,
  map: MapData,
  from: Hex,
  target: Hex
): {caught: Unit[]; end: Hex} {
  const dir = hexDirectionTo(from, target)!;
  const caught = new Set<Unit>();
  let at = from;
  // A copy of the units' spaces, the row Pushed along in it.
  const view: FightState = {
    ...state,
    units: state.units.map((u) => (u.hex ? {...u, hex: {...u.hex}} : u)),
  };
  for (let i = hexDistance(from, target); i > 0; i--) {
    const next = hexNeighbor(at, dir);
    const row = rowFrom(view, next, dir);
    for (const u of row) caught.add(state.units.find((o) => o.id === u.id)!);
    if (row.length > 0) {
      if (!rowGives(view, map, row, dir)) break;
      for (const u of row) u.hex = hexNeighbor(u.hex!, dir);
    }
    at = next;
  }
  return {caught: [...caught], end: at};
}

/**
 * Whether a stomp's step onto `to` shoves `u`, standing there, 1 on along
 * the step: not Rooted or Unstoppable, and free ground past it.
 */
function shoveGives(state: FightState, map: MapData, u: Unit, dir: number): boolean {
  const past = hexNeighbor(u.hex!, dir);
  return (
    walkable(map, past) && !unitAt(state, past) && !isUnstoppable(u) && !hasPassive(u, 'rooted')
  );
}

/** The units next to `from`: those a stomp catches. */
function stompCaught(state: FightState, from: Hex): Unit[] {
  return hexNeighbors(from)
    .map((h) => unitAt(state, h))
    .filter((u): u is Unit => u !== undefined);
}

/**
 * Stomp (owner, 2026-10-28; balance.md; Trample until renamed that day): the Juggernaut steps
 * onto `to`, a space next to it (`ABILITY.stomp.step`), or stays. An
 * enemy on `to` is first Pushed 1 on along the step; one that can't be (a
 * unit or yurts past it, the map's edge, Rooted or Unstoppable) isn't a
 * target, so the stomp never lands where it started unless aimed there.
 * Each unit next to where it lands, ally or enemy, the shoved one too,
 * takes its power, and those still standing
 * are Pushed 1 away from it, one at a time in the order for cards placed
 * at the same moment, as Rebound's.
 */
function resolveStomp(ctx: Ctx, user: Unit, to: Hex): void {
  const from = user.hex!;
  if (!hexEquals(to, from)) {
    const u = unitAt(ctx.state, to);
    if (u) {
      log(ctx, `${unitName(user)} shoves ${unitName(u)} aside.`);
      displace(ctx, u, hexDirectionTo(from, to)!, 1, 'push');
    }
    // Still held (its target checked, so not as aimed): no step, no stomp.
    if (unitAt(ctx.state, to)) return;
    enterHex(ctx, user, to);
    log(ctx, `${unitName(user)} steps.`);
  }
  // Felled by hail on its step: no stomp.
  if (!user.alive || !user.hex) return;
  log(ctx, `${unitName(user)} stomps.`);
  // The stomp itself, once the Juggernaut is in place, for the playback's flourish.
  record(ctx.state, {kind: 'land', unitId: user.id, ability: 'stomp', target: {...user.hex}});
  const caught = stompCaught(ctx.state, user.hex!);
  for (const u of caught) hit(ctx, user, u, 'The stomp');
  for (const u of simultaneousOrder(caught)) {
    if (!u.alive || !u.hex || !user.alive || !user.hex || hexDistance(u.hex, user.hex) !== 1)
      continue;
    displace(ctx, u, hexDirectionTo(user.hex, u.hex)!, 1, 'push');
  }
}

/**
 * Stomp's charge, Trample as first built (`ABILITY.stomp.mode: 'charge'`;
 * owner, 2026-10-27; roster.md): the Juggernaut walks 1 to
 * `ABILITY.stomp.steps` spaces straight out in any of the six
 * directions, stopped by yurts and the map's edge; with no one in its way
 * it is just that walk. The units in its way, ally or enemy, the whole row
 * when they stand in a line, each take its power once and are Pushed back
 * ahead of it, a space for each it walks, the farthest first. A row that
 * can't be Pushed (yurts, a unit past it, the map's edge, or a Rooted or
 * Unstoppable unit in it) stops the Juggernaut behind it, hit all the
 * same. Its walk goes through hail, which hits but can't hold it
 * (Unstoppable); a unit Pushed into hail is held and hit as any entering it.
 */
const stomp: AbilityDef = {
  id: 'stomp',
  pushes: true,
  name: 'Stomp',
  kind: 'attack',
  // The stomp: aimed at where it stomps from, the ring around it lit.
  get stepsTo() {
    return ABILITY.stomp.mode === 'stomp';
  },
  get area() {
    return ABILITY.stomp.mode === 'stomp'
      ? (map: MapData, from: Hex, target: Hex) =>
          hexNeighbors(target).filter((h) => onMap(map, h) && !hexEquals(h, from))
      : undefined;
  },
  summary: () =>
    ABILITY.stomp.mode === 'stomp'
      ? `${ABILITY.stomp.step > 0 ? 'Step 1 space or stay, shoving an enemy there on ahead, then stomp: e' : 'E'}very unit next to you is hit and Pushed 1 away.`
      : `Walk up to ${ABILITY.stomp.steps} spaces straight. Units in the way, a whole row together, are hit and Pushed back ahead of you.`,
  targets(state, map, user, from) {
    if (ABILITY.stomp.mode === 'stomp') {
      if (ABILITY.stomp.step <= 0 || isImmobilized(user)) return [{hex: from}];
      const out: ActionTarget[] = [{hex: from}];
      // Free spaces, and enemies' that can be shoved on ahead (`resolveStomp`).
      for (const to of sortByHex(stepsFrom(map, from), (h) => h)) {
        const u = unitAt(state, to);
        if (!u || (hostile(u, user) && shoveGives(state, map, u, hexDirectionTo(from, to)!)))
          out.push({hex: to});
      }
      return out;
    }
    return chargeTargets(map, user, from, ABILITY.stomp.steps);
  },
  resolve(ctx, user, target) {
    if (ABILITY.stomp.mode === 'stomp') return resolveStomp(ctx, user, target.hex!);
    resolveCharge(ctx, user, target.hex!, 'The charge');
  },
};

/** A charge's targets (`resolveCharge`): 1 to `steps` spaces straight out, up to yurts or the map's edge. */
function chargeTargets(map: MapData, user: Unit, from: Hex, steps: number): ActionTarget[] {
  if (isImmobilized(user)) return [];
  const out: ActionTarget[] = [];
  for (const dir of DIRECTIONS)
    for (const hex of laneFrom(map, from, dir).slice(0, steps)) out.push({hex});
  return sortByHex(out, (t) => t.hex!);
}

/**
 * A charge toward `to`, straight out from `user` (Stomp's `charge` mode;
 * the Bull Demon King's Gore): each unit in its way, a whole row together, takes
 * `user`'s power once (`what` hits it), and the row is Pushed back ahead
 * of it, a space for each it walks, the farthest first; a row that can't
 * be Pushed stops it behind.
 */
function resolveCharge(ctx: Ctx, user: Unit, to: Hex, what: string): void {
  const dir = hexDirectionTo(user.hex!, to)!;
  log(ctx, `${unitName(user)} charges.`);
  const struck = new Set<string>();
  for (let i = hexDistance(user.hex!, to); i > 0 && user.alive && user.hex; i--) {
    const next = hexNeighbor(user.hex, dir);
    if (!walkable(ctx.map, next)) break;
    for (const u of rowFrom(ctx.state, next, dir))
      if (!struck.has(u.id)) {
        struck.add(u.id);
        hit(ctx, user, u, what);
      }
    // Those still standing are Pushed, the farthest first, so each has room.
    const row = rowFrom(ctx.state, next, dir);
    if (row.length > 0 && !rowGives(ctx.state, ctx.map, row, dir)) {
      log(ctx, `${unitName(user)} is stopped.`);
      break;
    }
    for (const u of [...row].reverse()) displace(ctx, u, dir, 1, 'push');
    if (unitAt(ctx.state, next) || !user.alive) break;
    enterHex(ctx, user, next, 'walk', true);
  }
  if (user.alive) endGrapplesApart(ctx, user);
}

// ─── Cataphract ──────────────────────────────────────────────────────────────

/** Whether a unit can be Pushed: not Rooted (19.8) or Unstoppable (17.4). */
function pushable(u: Unit): boolean {
  return !isUnstoppable(u) && !hasPassive(u, 'rooted');
}

/**
 * The spaces a Charge from `from` may be aimed at along `dir`: every one to
 * yurts or the map's edge, up to the first unit that can't be Pushed
 * (Rooted or Unstoppable), which stops any row it is in; farther ones would
 * do the same.
 */
function chargeLane(state: FightState, map: MapData, from: Hex, dir: number): Hex[] {
  const out: Hex[] = [];
  for (const h of laneFrom(map, from, dir)) {
    out.push(h);
    const u = unitAt(state, h);
    if (u && !pushable(u)) break;
  }
  return out;
}

/**
 * What a Charge by `user` from `from` aimed at `target` would do, without
 * doing it: the units it would hit, and where the Cataphract would end, if
 * no one falls and nothing on the way changes the board (hail's hits,
 * Rebound). For the AI's guess.
 */
export function ridePlan(
  state: FightState,
  map: MapData,
  user: Unit,
  from: Hex,
  target: Hex
): {caught: Unit[]; end: Hex; slammed: Unit[]} {
  const dir = hexDirectionTo(from, target)!;
  const caught = new Set<Unit>();
  // A copy of the units' spaces, the row Pushed along in it.
  const view: FightState = {
    ...state,
    units: state.units.map((u) => (u.hex ? {...u, hex: {...u.hex}} : u)),
  };
  const real = (u: Unit) => state.units.find((o) => o.id === u.id)!;
  let at = from;
  while (!hexEquals(at, target)) {
    const next = hexNeighbor(at, dir);
    if (!walkable(map, next)) break;
    const row = rowFrom(view, next, dir);
    if (row.length > 0) {
      if (hexEquals(next, target)) {
        caught.add(real(row[0]!));
        break;
      }
      for (const u of row) caught.add(real(u));
      if (!rowGives(view, map, row, dir)) break;
      for (const u of row) u.hex = hexNeighbor(u.hex!, dir);
    }
    at = next;
    if (stopsWalk(state, user, at)) break;
  }
  const slammed = [...caught].filter((u) =>
    slams(map, view.units.find((o) => o.id === u.id)!, dir)
  );
  return {caught: [...caught], end: at, slammed};
}

/** What Charge's summary says of the slam (`ABILITY.charge.slam`). */
function slamSays(): string {
  const {slam, delay: slots} = ABILITY.charge;
  if (slam === 'none') return '';
  const what = `Delayed ${slam === 'delay' ? slots : RULES.durations.stun}`;
  return ` One left against yurts or the edge is ${what}.`;
}

/**
 * Whether a unit a Charge along `dir` has hit is slammed into yurts or the
 * map's edge right behind it (`ABILITY.charge.stun`).
 */
function slams(map: MapData, u: Unit, dir: number): boolean {
  return (
    ABILITY.charge.slam !== 'none' && u.hex !== null && !walkable(map, hexNeighbor(u.hex, dir))
  );
}

/**
 * Charge (owner, 2026-10-28; roster.md), the Cataphract's, and its only
 * way to move: it rides any number of spaces straight out along one of the
 * six directions, as the Outrider does, stopped by yurts and the map's
 * edge, and by hail, which ends a walk where it enters. Each unit in its
 * way, ally or enemy, takes its power once and is Pushed on ahead of it, a
 * whole row together (owner, later 2026-10-28; the first unit only
 * before, a second it met stopping both), until the nearest reaches the
 * space it was aimed at, the Cataphract riding in behind. Yurts or the
 * map's edge past the row, or a Rooted or Unstoppable unit in it, stop the
 * row and the Cataphract behind it; if the units in its way fall, the way
 * is clear and it rides on.
 */
const charge: AbilityDef = {
  id: 'charge',
  pushes: true,
  name: 'Charge',
  kind: 'attack',
  stepsTo: true,
  summary: () =>
    `Ride any distance straight. Every unit in the way is hit and carried ahead, as far as there is room, the nearest to the space aimed at.${slamSays()}`,
  targets(state, map, user, from) {
    if (isImmobilized(user)) return [];
    const out: ActionTarget[] = [];
    for (const dir of DIRECTIONS)
      for (const hex of chargeLane(state, map, from, dir))
        // An enemy can't ride onto the camel's exit (`mayEndOn`) with no one to carry there.
        if (unitAt(state, hex) || mayEndOn(map, user, hex)) out.push({hex});
    return sortByHex(out, (t) => t.hex!);
  },
  resolve(ctx, user, target) {
    const goal = target.hex!;
    const dir = hexDirectionTo(user.hex!, goal)!;
    log(ctx, `${unitName(user)} charges.`);
    const struck = new Set<string>();
    const strike = (u: Unit) => {
      if (struck.has(u.id)) return;
      struck.add(u.id);
      hit(ctx, user, u, 'The charge');
    };
    while (user.alive && user.hex && !hexEquals(user.hex, goal)) {
      const next = hexNeighbor(user.hex, dir);
      if (!walkable(ctx.map, next)) break;
      if (unitAt(ctx.state, next)) {
        // The nearest carried to the space aimed at: no farther.
        if (hexEquals(next, goal)) {
          strike(unitAt(ctx.state, next)!);
          break;
        }
        for (const u of rowFrom(ctx.state, next, dir)) strike(u);
        if (!user.alive || !user.hex) break;
        // Those still standing are Pushed, the farthest first, so each has room.
        const row = rowFrom(ctx.state, next, dir);
        if (row.length > 0) {
          if (!rowGives(ctx.state, ctx.map, row, dir)) {
            log(ctx, `${unitName(user)} is stopped.`);
            break;
          }
          for (const u of [...row].reverse()) displace(ctx, u, dir, 1, 'push');
        }
        if (!user.alive || !user.hex || unitAt(ctx.state, next)) break;
      }
      enterHex(ctx, user, next, 'walk', true);
      // Hail ends the ride where it enters (it Immobilizes).
      if (isImmobilized(user)) break;
    }
    // Each unit it hit left against yurts or the map's edge: slammed into them.
    for (const u of ctx.state.units)
      if (struck.has(u.id) && u.alive && slams(ctx.map, u, dir)) {
        const into = onMap(ctx.map, hexNeighbor(u.hex!, dir))
          ? 'the obstacle behind it'
          : 'the map’s edge';
        log(ctx, `${unitName(u)} is slammed into ${into}.`);
        if (ABILITY.charge.slam === 'delay') delay(ctx, u, ABILITY.charge.delay);
        else stunForATurn(ctx, u);
      }
    if (user.alive) endGrapplesApart(ctx, user);
  },
};

// ─── Barbarian ───────────────────────────────────────────────────────────────

/** Reave's swipe toward direction `dir`: that space next to `from` and the two either side of it, yurts left out. */
function reaveSwipe(map: MapData, from: Hex, dir: number): Hex[] {
  return [dir - 1, dir, dir + 1].map((d) => hexNeighbor(from, d)).filter((h) => walkable(map, h));
}

/** Reave's throw toward direction `dir`: up to `throwRange` spaces straight out, to a yurt or the map's edge. */
function reaveThrow(map: MapData, from: Hex, dir: number): Hex[] {
  return laneFrom(map, from, dir).slice(0, ABILITY.reave.throwRange);
}

/**
 * The spaces Reave covers aimed at `target`: a swipe when it is next to
 * `from` (the arc's middle), a throw when it is further (where the axe lands).
 */
function reaveArea(map: MapData, from: Hex, target: Hex): Hex[] {
  const dir = hexDirectionTo(from, target);
  if (dir === null) return [];
  return hexDistance(from, target) === 1 ? reaveSwipe(map, from, dir) : reaveThrow(map, from, dir);
}

/** Whether Reave aimed at `target` from `from` throws the axe. */
export const reaveThrows = (from: Hex, target: Hex): boolean => hexDistance(from, target) > 1;

/**
 * Reave (owner, 2026-10-28): the Barbarian's great axe, swiped through
 * three spaces next to it or thrown down a line of three, every unit in
 * them hit for its power, allies too. A thrown axe lies where it lands
 * (`Unit.axe`) until the Barbarian enters a space on or next to it; until
 * then it can only move and Hold (`disarmed`). Swipes are offered first,
 * so a tap next to the Barbarian swipes and one further out throws
 * (`targetAt` in choices.ts).
 */
const reave: AbilityDef = {
  id: 'reave',
  name: 'Reave',
  kind: 'attack',
  summary: () =>
    `Swipe three spaces next to you, or throw your axe down a line of ${ABILITY.reave.throwRange}: hits every unit there, allies included. A thrown axe must be picked up, by moving on or next to it, before you can use an ability again.`,
  area: reaveArea,
  targets(state, map, user, from) {
    const catches = (area: Hex[]) =>
      area.some((h) => {
        const u = unitAt(state, h);
        return u !== undefined && u !== user;
      });
    const swipes: ActionTarget[] = [];
    const throws: ActionTarget[] = [];
    for (const dir of DIRECTIONS) {
      const middle = hexNeighbor(from, dir);
      if (walkable(map, middle) && catches(reaveSwipe(map, from, dir))) swipes.push({hex: middle});
      const line = reaveThrow(map, from, dir);
      if (line.length >= 2 && catches(line)) throws.push({hex: line[line.length - 1]!});
    }
    return [...swipes, ...throws];
  },
  resolve(ctx, user, target) {
    const throws = reaveThrows(user.hex!, target.hex!);
    const area = reaveArea(ctx.map, user.hex!, target.hex!);
    log(ctx, `${unitName(user)} ${throws ? 'throws its axe' : 'swings its axe'}.`);
    const caught = area.map((h) => unitAt(ctx.state, h)).filter((u): u is Unit => u !== undefined);
    for (const u of caught) hit(ctx, user, u, 'The axe');
    if (throws) user.axe = {...target.hex!};
  },
};

/**
 * Axe Throw's six lines from `from`: 1 to `range` spaces straight out, to
 * the map's edge, through units and yurts, since the axe flies over them.
 */
export function axeLines(map: MapData, from: Hex): Hex[][] {
  return DIRECTIONS.map((dir) => lineFrom(map, from, dir).slice(0, ABILITY.axeThrow.range));
}

/**
 * Axe Throw (owner, 2026-10-28; roster.md), the Barbarian's in place of
 * Reave: any unit on one of his six lines within `range`, ally or enemy,
 * the camel too, the axe flying over whatever is in between; it hits for
 * his power and Pushes the unit `push` away. Nothing to pick up.
 */
const axeThrow: AbilityDef = {
  id: 'axeThrow',
  pushes: true,
  single: true,
  name: 'Axe Throw',
  kind: 'attack',
  summary: () =>
    `Throw your axe at any unit within ${ABILITY.axeThrow.range} in a straight line, over anything in between. It is hit and Pushed ${ABILITY.axeThrow.push}.`,
  targetsUnit: true,
  targets(state, map, _user, from) {
    const out: ActionTarget[] = [];
    for (const l of axeLines(map, from))
      for (const h of l) if (unitAt(state, h)) out.push({hex: h});
    return out;
  },
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} throws its axe.`);
    hit(ctx, user, u, 'The axe');
    // The thrower can fall to its own throw (Bulwark on an ally next to it).
    if (u.alive && u.hex && user.hex)
      displace(ctx, u, directionTo(user.hex!, u.hex), ABILITY.axeThrow.push, 'push');
  },
};

/**
 * Leap's landing setting out along direction `dir`: one space that way and
 * one turned a sixth to the left, 2 away and off the six straight lines.
 */
const leapLanding = (from: Hex, dir: number): Hex => hexNeighbor(hexNeighbor(from, dir), dir + 1);

/** The direction Leap sets out in from `from` to land on `landing`, or null if it isn't one of its six. */
function leapDirection(from: Hex, landing: Hex): number | null {
  const dir = DIRECTIONS.find((d) => hexEquals(leapLanding(from, d), landing));
  return dir ?? null;
}

/**
 * The directions from a Leap's landing, setting out along `dir`, to the
 * spaces it strikes by `ABILITY.leap.shape`: the two straight ahead first
 * (Leap's front), then for `forward` the one either side of them, and for
 * `splash` the two it flew over too.
 */
function leapDirections(dir: number): number[] {
  const front = [dir, dir + 1];
  if (ABILITY.leap.shape === 'front') return front;
  const sides = [dir - 1, dir + 2];
  return ABILITY.leap.shape === 'forward'
    ? [...front, ...sides]
    : [...front, ...sides, dir + 3, dir + 4];
}

/** Whether a Leap setting out along `dir` hits the space next to its landing in direction `d` for its user's full power. */
const leapsFull = (dir: number, d: number): boolean =>
  ABILITY.leap.shape !== 'splash' || (((d - dir) % 6) + 6) % 6 <= 1;

/**
 * The spaces Leap strikes landing on `landing` from `from`
 * (`ABILITY.leap.shape`), the two straight ahead first, yurts left out,
 * each with whether it takes its user's power (`full`) or `splash`.
 */
export function leapStrikes(map: MapData, from: Hex, landing: Hex): {hex: Hex; full: boolean}[] {
  const dir = leapDirection(from, landing);
  if (dir === null) return [];
  return leapDirections(dir)
    .map((d) => ({hex: hexNeighbor(landing, d), full: leapsFull(dir, d)}))
    .filter((s) => walkable(map, s.hex));
}

/** The spaces Leap strikes (`leapStrikes`). */
export const leapArea = (map: MapData, from: Hex, landing: Hex): Hex[] =>
  leapStrikes(map, from, landing).map((s) => s.hex);

/** What Leap hits, by `ABILITY.leap.shape`. */
function leapSays(): string {
  if (ABILITY.leap.shape === 'forward')
    return 'Hits every unit on the four spaces next to where you land, all but the two you flew over, allies included.';
  if (ABILITY.leap.shape === 'splash')
    return `Hits every unit on the two spaces in front of where you land, and every other unit next to it for ${ABILITY.leap.splash}, allies included.`;
  return 'Hits every unit on the two spaces in front of where you land, allies included.';
}

/**
 * Leap (owner, 2026-10-30), the Barbarian's in place of Axe Throw: he
 * jumps over yurts and units to a free space exactly 2 away that isn't on
 * one of his six straight lines, and brings his axe down on the two spaces
 * in front of where he lands, every unit there hit for his power, allies
 * and the camel too. An Immobilized Barbarian can't leap.
 */
const leap: AbilityDef = {
  id: 'leap',
  name: 'Leap',
  kind: 'attack',
  stepsTo: true,
  summary: () =>
    `Leap over anything to a free space 2 away, off your straight lines. ${leapSays()}${
      ABILITY.leap.shield
        ? ` Gain Shield equal to the damage dealt to enemies, until spent (at most ${ABILITY.leap.shieldCap}); a leap that hits no one loses your Shield.`
        : ''
    }`,
  area: leapArea,
  targets(state, map, user, from) {
    if (isImmobilized(user)) return [];
    const out: ActionTarget[] = [];
    for (const dir of DIRECTIONS) {
      const hex = leapLanding(from, dir);
      if (walkable(map, hex) && !unitAt(state, hex) && mayEndOn(map, user, hex)) out.push({hex});
    }
    return out;
  },
  resolve(ctx, user, target) {
    const strikes = leapStrikes(ctx.map, user.hex!, target.hex!);
    log(ctx, `${unitName(user)} leaps.`);
    enterHex(ctx, user, target.hex!, 'leap');
    // Hail where it lands can fell it.
    if (!user.alive || !user.hex) return;
    const caught = strikes.flatMap(({hex, full}) => {
      const u = unitAt(ctx.state, hex);
      return u ? [{u, full}] : [];
    });
    // What the enemies caught have, health and Shield, for `ABILITY.leap.shield`.
    const standing = () =>
      caught.filter(({u}) => hostile(u, user)).reduce((n, {u}) => n + u.hp + (u.shield ?? 0), 0);
    const before = standing();
    for (const {u, full} of caught)
      if (full) hit(ctx, user, u, 'The axe');
      else hitFor(ctx, user, u, 'The blow', ABILITY.leap.splash);
    if (!ABILITY.leap.shield || !user.alive) return;
    if (caught.length === 0) {
      if (user.shield) log(ctx, `${unitName(user)} loses its Shield.`);
      delete user.shield;
      delete user.shieldUntil;
      delete user.lastingShield;
      return;
    }
    const room = ABILITY.leap.shieldCap - (user.shield ?? 0);
    shield(ctx, user, Math.min(before - standing(), room), true);
  },
};

// ─── Wolf ────────────────────────────────────────────────────────────────────

const bite: AbilityDef = {
  id: 'bite',
  single: true,
  name: 'Bite',
  kind: 'attack',
  summary: () => 'Melee.',
  targetsUnit: true,
  targets: (state, _map, user, from) => adjacentUnits(state, from, (u) => u !== user),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} bites ${unitName(u)}.`);
    hit(ctx, user, u, 'The bite');
  },
};

// ─── Cyclops ──────────────────────────────────────────────────────────

/** Smash (owner, 2026-10-28): the Cyclops's club, a plain melee hit for its power. */
const smash: AbilityDef = {
  id: 'smash',
  name: 'Smash',
  kind: 'attack',
  summary: () => 'Melee.',
  targetsUnit: true,
  targets: (state, _map, user, from) => adjacentUnits(state, from, (u) => u !== user),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} smashes ${unitName(u)}.`);
    hit(ctx, user, u, 'The club');
  },
};

// ─── Zahhak ───────────────────────────────────────────────────────────

/** Feed the Serpents (2026-10-29), Zahhak's: he seizes a unit next to him for his serpents, a melee hit for his power. */
const feed: AbilityDef = {
  id: 'feed',
  name: 'Feed the Serpents',
  kind: 'attack',
  summary: () => 'Melee.',
  targetsUnit: true,
  targets: (state, _map, user, from) => adjacentUnits(state, from, (u) => u !== user),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} seizes ${unitName(u)} for his serpents.`);
    hit(ctx, user, u, 'The serpents’ feast');
  },
};

/** The first of `user`'s serpents (Zahhak's Serpent) that has fallen, if any. */
function fallenSerpent(state: FightState, user: Unit): Unit | undefined {
  return state.units.find((u) => !u.alive && u.side === user.side && hasPassive(u, 'regrow'));
}

/**
 * Regrow (owner, 2026-10-29), Zahhak's: only on his turn, his action. A
 * fallen serpent of his grows back on an open space next to him, at full
 * health and with nothing on it; its card is placed as after a turn of its
 * own, its action cost on (3.2).
 */
const regrowSerpent: AbilityDef = {
  id: 'regrowSerpent',
  name: 'Regrow',
  kind: 'support',
  summary: () => 'A fallen serpent grows back on an open space next to you, at full health.',
  targets(state, map, user, from) {
    if (!fallenSerpent(state, user)) return [];
    return hexNeighbors(from)
      .filter((h) => walkable(map, h) && !unitAt(state, h))
      .map((h) => ({hex: h}));
  },
  resolve(ctx, user, target) {
    const serpent = fallenSerpent(ctx.state, user)!;
    Object.assign(serpent, {alive: true, hex: {...target.hex!}, hp: serpent.maxHp, statuses: []});
    for (const k of [
      'empower',
      'empowerUntil',
      'weaken',
      'weakenUntil',
      'shield',
      'shieldUntil',
      'armour',
      'armourUntil',
    ] as const)
      delete serpent[k];
    delete serpent.lastingShield;
    delete serpent.skipped;
    placeCard(ctx.state, serpent, aimSlot(ctx.state, serpent, ctx.slot));
    log(ctx, `${unitName(serpent)} grows back from ${unitName(user)}’s shoulder.`);
  },
};

/** The spaces next to where a boulder lands, but its thrower's: those it Pushes. */
function boulderRing(map: MapData, from: Hex, target: Hex): Hex[] {
  return hexNeighbors(target).filter((h) => onMap(map, h) && !hexEquals(h, from));
}

/**
 * Boulder (owner, 2026-10-28): the Cyclops hurls a boulder down
 * one of Snap Shot's lanes. The first unit in it takes the giant's power;
 * then every other unit next to where it lands, ally or enemy, the giant
 * aside, is Pushed `ABILITY.boulder.push` away from it, one at a time in
 * the order for cards placed at the same moment, as Stomp's.
 */
const boulder: AbilityDef = {
  id: 'boulder',
  pushes: true,
  name: 'Boulder',
  kind: 'attack',
  area: (map, from, target) => [target, ...boulderRing(map, from, target)],
  summary: () =>
    `Throw straight: hits the first unit in line, and every unit next to it is Pushed ${ABILITY.boulder.push} away.`,
  targetsUnit: true,
  targets: (state, map, user, from) => snapShot.targets(state, map, user, from),
  resolve(ctx, user, target) {
    const at = target.hex!;
    const u = unitAt(ctx.state, at)!;
    // Where it threw from: the hit's answers (a Bulwark, Last Stand) may fell the thrower.
    const from = user.hex!;
    log(ctx, `${unitName(user)} hurls a boulder.`);
    hit(ctx, user, u, 'The boulder');
    const around = boulderRing(ctx.map, from, at)
      .map((h) => unitAt(ctx.state, h))
      .filter((o): o is Unit => o !== undefined && o !== user);
    for (const o of simultaneousOrder(around)) {
      if (!o.alive || !o.hex || hexDistance(o.hex, at) !== 1) continue;
      displace(ctx, o, hexDirectionTo(at, o.hex)!, ABILITY.boulder.push, 'push');
    }
  },
};

// ─── Bull Demon King and Princess Iron Fan ────────────────────────────────────────────────────

/**
 * Gore (owner, 2026-10-28), the Bull Demon King's horns: Trample as first built
 * (`ABILITY.stomp.mode: 'charge'`), a walk of up to `ABILITY.gore.steps`
 * in a line, every unit in its way hit and Pushed back ahead of him
 * (`resolveCharge`).
 */
const gore: AbilityDef = {
  id: 'gore',
  pushes: true,
  name: 'Gore',
  kind: 'attack',
  summary: () =>
    `Charge up to ${ABILITY.gore.steps} spaces straight. Units in the way, a whole row together, are hit and Pushed back ahead of you.`,
  targets: (_state, map, user, from) => chargeTargets(map, user, from, ABILITY.gore.steps),
  resolve(ctx, user, target) {
    resolveCharge(ctx, user, target.hex!, 'The horns');
  },
};

/** The Iron Fan's line from `from` holding `target`: up to `reach` spaces straight out, up to yurts or the map's edge. */
function fanLine(map: MapData, from: Hex, target: Hex): Hex[] {
  const dir = hexDirectionTo(from, target);
  return dir === null ? [] : laneFrom(map, from, dir).slice(0, ABILITY.bananaFan.reach);
}

/**
 * The Iron Fan (owner, 2026-10-28): every unit in a line of
 * `ABILITY.bananaFan.reach` straight out from Princess Iron Fan, ally or enemy,
 * is Pushed `ABILITY.bananaFan.push` along it, the farthest first so each
 * has room; no damage, but a unit blown into fire burns as any entering it.
 * Aimed at the line's first space, as Cleave.
 */
const bananaFan: AbilityDef = {
  id: 'bananaFan',
  pushes: true,
  name: 'Iron Fan',
  kind: 'control',
  damages: false,
  area: fanLine,
  summary: () =>
    `A line of ${ABILITY.bananaFan.reach} spaces straight out from you, any way: every unit in it, allies included, is Pushed ${ABILITY.bananaFan.push}.`,
  targets(state, map, user, from) {
    const out: ActionTarget[] = [];
    for (const dir of DIRECTIONS) {
      const line = laneFrom(map, from, dir).slice(0, ABILITY.bananaFan.reach);
      if (line.some((h) => unitAt(state, h) && unitAt(state, h) !== user))
        out.push({hex: line[0]!});
    }
    return out;
  },
  resolve(ctx, user, target) {
    const line = fanLine(ctx.map, user.hex!, target.hex!);
    const dir = hexDirectionTo(user.hex!, target.hex!)!;
    log(ctx, `${unitName(user)} sweeps the Iron Fan.`);
    const caught = line.map((h) => unitAt(ctx.state, h)).filter((u): u is Unit => u !== undefined);
    for (const u of caught.reverse())
      if (u.alive) displace(ctx, u, dir, ABILITY.bananaFan.push, 'push');
  },
};

/** The spaces Fan the Flames sets alight aimed at `hex`: it and the open ones next to it. */
export function flamesAround(map: MapData, hex: Hex): Hex[] {
  return [hex, ...stepsFrom(map, hex)];
}

/**
 * Fan the Flames (owner, 2026-10-28), Princess Iron Fan's: aimed at an
 * open space within `ABILITY.fanFlames.range`, it and the open spaces
 * next to it catch fire until her next turn (`FireEffect`), any fire of
 * hers before going out. Lighting a space doesn't burn whoever stands
 * there; entering one does (`enterHex`). First aimed at a burning ridge
 * anywhere, its open neighbours alight, until her map lost its ridges
 * (owner, the same day).
 */
const fanFlames: AbilityDef = {
  id: 'fanFlames',
  name: 'Fan the Flames',
  kind: 'control',
  range: ABILITY.fanFlames.range,
  area: (map, _from, target) => flamesAround(map, target),
  summary: () =>
    `A space within ${ABILITY.fanFlames.range}: it and the spaces next to it catch fire for ${RULES.durations.turn} slots. Entering fire burns ${ABILITY.fanFlames.burn}.`,
  targets: (_state, map, _user, from) =>
    hexesWithin(map, from, ABILITY.fanFlames.range, (h) => !blocks(tileAt(map, h))),
  resolve(ctx, user, target) {
    const others = (ctx.state.fires ?? []).filter((f) => f.source !== user.id);
    const lit = flamesAround(ctx.map, target.hex!).filter(
      (h) => !others.some((f) => hexEquals(f.hex, h))
    );
    const until = lastsThrough(ctx.state);
    ctx.state.fires = [...others, ...lit.map((hex) => ({hex: {...hex}, source: user.id, until}))];
    log(ctx, `${unitName(user)} fans the flames.`);
  },
};

/**
 * The Iron Fan, borrowed (owner, 2026-10-28, as Sun Wukong borrows
 * it): a hero carrying the fan Princess Iron Fan dropped (`Unit.fan`) spends a
 * turn putting out every flame on the board; the fan is then spent.
 */
const quench: AbilityDef = {
  id: 'quench',
  name: 'Borrowed Fan',
  kind: 'support',
  summary: () => 'Put out every fire on the board. The fan is then spent.',
  targets: (state) => (state.fires?.length ? [{}] : []),
  resolve(ctx, user) {
    delete ctx.state.fires;
    delete user.fan;
    log(ctx, `${unitName(user)} fans out the flames.`);
  },
};

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  hold,
  snapShot,
  skirmish,
  hail,
  sunlight,
  grapple,
  bite,
  cleave,
  elixir,
  swiftStrike,
  omen,
  stomp,
  longshot,
  blessing,
  reave,
  axeThrow,
  leap,
  smash,
  boulder,
  gore,
  bananaFan,
  fanFlames,
  quench,
  feed,
  regrowSerpent,
  charge,
  shove,
  haul,
  feignedRetreat,
  gale,
  volley,
};

export function abilitiesOf(unit: Unit): AbilityDef[] {
  return kitOf(unit).map((id) => ABILITIES[id]);
}

/** Why the unit can't use the ability at all right now, or null if it can. */
export function unusableReason(unit: Unit, ability: AbilityDef): string | null {
  if (!kitOf(unit).includes(ability.id)) return 'That unit doesn’t have that ability.';
  if (ability.id !== 'hold' && disarmed(unit))
    return 'Its axe lies where it was thrown: move on or next to it to pick it up.';
  return null;
}

export function sameTarget(a: ActionTarget, b: ActionTarget): boolean {
  const eq = (x?: Hex, y?: Hex) =>
    x === undefined ? y === undefined : y !== undefined && hexEquals(x, y);
  return eq(a.hex, b.hex) && eq(a.to, b.to);
}

/** Whether `unit`'s `def` takes one extra target: a single-target ability, with Forked (19.9). */
export function forks(unit: Unit, def: AbilityDef): boolean {
  return Boolean(def.single) && hasPassive(unit, 'forked');
}
