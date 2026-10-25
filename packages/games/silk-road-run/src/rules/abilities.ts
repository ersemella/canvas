/**
 * The three prototype heroes' abilities (roster.md; owner, 2026-10-23) and
 * the wolf's. Each lists its legal targets from a hex (for validation,
 * previews and the AI) and resolves on the fight state. Every ability
 * deals exactly its user's power in damage; shapes come from config.ts.
 */
import {hexDirectionTo, hexDistance, hexEquals, hexNeighbors} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY} from './config';
import {
  firstInLane,
  isImmobilized,
  kitOf,
  lane as laneFrom,
  reachableHexes,
  sortByHex,
  spacesWithin,
  steps as stepsFrom,
  unitAt,
} from './board';
import {
  displace,
  endGrapples,
  enhance,
  enterHex,
  hailHolds,
  hit,
  log,
  stun,
  unitName,
} from './resolve';
import type {Ctx} from './resolve';
import {blocks, tileAt} from './map';
import {chargeOf} from './track';
import type {MapData} from './map';
import type {AbilityId, ActionTarget, FightState, Unit} from './types';

/**
 * What an ability is broadly for, shown as an icon by its name: hurting
 * enemies, controlling the board (statuses, hail), or helping (Enhance).
 */
export type AbilityKind = 'attack' | 'control' | 'support';

export interface AbilityDef {
  id: AbilityId;
  name: string;
  /** None for Hold. */
  kind?: AbilityKind;
  /**
   * How far from its user it reaches, for an ability aimed within a range
   * (not Longshot, whose lanes run to the first unit, nor melee); the page
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
  radius?: number;
  /** One line for the side panel, with its damage (the user's power). Range is left out. */
  summary(user: Unit): string;
  /**
   * Aimed at a unit (melee, and Longshot), not at a hex: with no unit to aim
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
   * The unit a target aims at, when it isn't simply the one on its hex
   * (Grapple's throw: the held unit, aimed by where it lands). For the
   * page's offered targets and the AI's guess.
   */
  aimedAt?(state: FightState, user: Unit, target: ActionTarget): Unit | undefined;
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

/** "1 damage", or "no damage" at power 0. */
function damageText(user: Unit): string {
  return user.power > 0 ? `${user.power} damage` : 'no damage';
}

const hold: AbilityDef = {
  id: 'hold',
  name: 'Hold',
  summary: () => 'End the turn with no effect.',
  targets: () => [{}],
  resolve: (ctx, user) => log(ctx, `${unitName(user)} holds.`),
};

// ─── Mangudai Outrider ───────────────────────────────────────────────────────

/** An arrow's flight along one hex direction: the hexes it crosses, and the unit it stops at. */
export interface ArrowLane {
  hexes: Hex[];
  hit?: Unit;
}

/**
 * Longshot's six lanes from `from`: each runs until the first unit (which
 * it hits), yurts or the map's edge (Longshot has no range limit). For the
 * page to show where an arrow can fly, hit or not.
 */
export function arrowLanes(state: FightState, map: MapData, from: Hex): ArrowLane[] {
  return DIRECTIONS.map((dir) => {
    const lane: ArrowLane = {hexes: []};
    for (const h of laneFrom(map, from, dir).slice(0, ABILITY.longshot.range)) {
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

const longshot: AbilityDef = {
  id: 'longshot',
  name: 'Longshot',
  kind: 'attack',
  summary: (user) => `Shoot straight: the first unit in line takes ${damageText(user)}.`,
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

/**
 * Skirmish (owner, 2026-10-23, in place of Volley): one step to a free
 * space next to the Outrider (not while Immobilized), then Longshot's shot
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
      ? `Step one space, then draw on a line: charge ${chargeOf(user, 'skirmish')} (half your action cost). When your card comes back the arrow flies down that line instead of your turn: the first unit in it then takes ${damageText(user)}. Then your card goes on to your next turn.`
      : `Step one space, then shoot straight: the first unit in line takes ${damageText(user)}.`,
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
      ...(user.enhance ? {enhance: user.enhance} : {}),
    });
  },
};

// ─── Yadachy Storm Caller ────────────────────────────────────────────────────

const hail: AbilityDef = {
  id: 'hail',
  name: 'Hail',
  kind: 'control',
  range: ABILITY.hail.range,
  minRange: ABILITY.hail.range,
  radius: 0,
  summary: (user) =>
    `Hail on a space exactly ${ABILITY.hail.range} away until your next turn: a unit there takes ${damageText(user)}, and a unit there or that enters it is Immobilized until the hail is gone.`,
  targets: (_state, map, _user, from) =>
    hexesWithin(
      map,
      from,
      ABILITY.hail.range,
      (h) => hexDistance(from, h) === ABILITY.hail.range && !blocks(tileAt(map, h))
    ),
  resolve(ctx, user, target) {
    const hex = target.hex!;
    ctx.state.effects = ctx.state.effects.filter((e) => !hexEquals(e.hex, hex));
    ctx.state.effects.push({kind: 'hail', hex, source: user.id});
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
 * hits (not Temee) and isn't already Enhanced (renewing an Enhance on
 * itself, the Storm Caller never spent it) is Enhanced until the end of
 * its next turn. The Storm Caller may target itself (`self`). Aimed at a
 * space, since hail alone is a target.
 */
const sunlight: AbilityDef = {
  id: 'sunlight',
  name: 'Sunlight',
  kind: 'support',
  range: ABILITY.sunlight.range,
  summary: () =>
    `Sunlight on a space: hail there melts, and a unit there not Enhanced already, you included, is Enhanced ${ABILITY.sunlight.enhance}: its abilities deal ${ABILITY.sunlight.enhance} more until the end of its next turn.`,
  targets(state, map, user, from) {
    const {range, self, melts} = ABILITY.sunlight;
    return hexesWithin(map, from, range, (h) => {
      if (blocks(tileAt(map, h))) return false;
      if (melts && state.effects.some((e) => hexEquals(e.hex, h))) return true;
      const u = unitAt(state, h);
      return u !== undefined && u.power > 0 && !u.enhance && (u !== user || self);
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
    if (u) enhance(ctx, u, ABILITY.sunlight.enhance);
  },
};

// ─── Bökh Champion ───────────────────────────────────────────────────────────

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
 * Whether `target` is a throw: a space without a unit, or the Champion's
 * own (a swap), rather than a unit to grapple.
 */
function isThrow(state: FightState, user: Unit, target: ActionTarget): boolean {
  const u = unitAt(state, target.hex!);
  return !u || u === user;
}

/**
 * Grapple, with Throw folded in (owner, 2026-10-24; separate abilities
 * before). On a unit next to the Champion, not the one it holds: grapples
 * it. While it holds one, on a free space next to it: Throw (owner,
 * 2026-10-23), the held unit Moved there, then struck; on the Champion's
 * own space: the two swap places, then it is struck. Either way the two
 * stay next to each other, so the grapple holds. An Immobilized Champion
 * still swaps (owner, 2026-10-25): the swap is the grapple's move, not a
 * walk of its own.
 */
const grapple: AbilityDef = {
  id: 'grapple',
  name: 'Grapple',
  kind: 'attack',
  summary: (user) =>
    `Melee: it takes ${damageText(user)} and is Stunned until you take damage, are Stunned or end a turn no longer next to it, taking ${ABILITY.grapple.squeeze} more at each of your turns meanwhile${ABILITY.grapple.enhancedSqueeze ? ' (plus your Enhance)' : ''}. One at a time. While you grapple one, pick a free space next to you to throw it there, or your own to swap places; then it takes ${damageText(user)} and the grapple holds.`,
  targetsUnit: true,
  // Melee only (owner, 2026-10-23; reached 2 spaces, stepping in, before),
  // and not the unit it already grapples: that one is thrown instead.
  targets(state, map, user, from) {
    const out = adjacentUnits(state, from, (u) => u !== user && !grappling(user, u));
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
      hit(ctx, user, u, 'The throw');
      return;
    }
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} grapples ${unitName(u)}.`);
    hit(ctx, user, u, 'The grapple');
    if (!u.alive) return;
    // One target at a time: an earlier grapple lets go.
    endGrapples(ctx, (g) => g.champion === user.id);
    stun(ctx, u, {kind: 'stunned', grapple: {champion: user.id, target: u.id}});
  },
};

// ─── Upgrades of 2026-10-24 ──────────────────────────────────────────────────
// Shove and Haul (the Champion), Feigned Retreat and Volley (the Outrider)
// and Gale (the Storm Caller): owner, 2026-10-24, as measured (balance.md,
// "Second abilities measured").

/** The direction from `from` to `to`, adjacent or in a straight line from it. */
function directionTo(from: Hex, to: Hex): number {
  return hexDirectionTo(from, to)!;
}

/** Shove: melee, Push 2, no damage. */
const shove: AbilityDef = {
  id: 'shove',
  name: 'Shove',
  kind: 'control',
  damages: false,
  summary: () => `Melee: Push it ${ABILITY.shove.push} spaces away. No damage.`,
  targetsUnit: true,
  targets: (state, _map, user, from) => adjacentUnits(state, from, (u) => u !== user),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} shoves ${unitName(u)}.`);
    displace(ctx, u, directionTo(user.hex!, u.hex!), ABILITY.shove.push, 'push');
  },
};

/** Haul: the first unit in a lane within range, not next to the Champion, Pulled 2. No damage. */
const haul: AbilityDef = {
  id: 'haul',
  name: 'Haul',
  kind: 'control',
  damages: false,
  range: ABILITY.haul.range,
  summary: () =>
    `The first unit in a straight line 2 to ${ABILITY.haul.range} spaces away: Pull it ${ABILITY.haul.pull} spaces toward you. No damage.`,
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
  summary: (user) =>
    `Shoot straight: the first unit in line takes ${damageText(user)}. Then walk up to ${ABILITY.feignedRetreat.steps} spaces.`,
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
    const walk = walksWithin(
      ctx.state,
      ctx.map,
      user,
      user.hex!,
      ABILITY.feignedRetreat.steps
    ).find((r) => hexEquals(r.hex, target.to!));
    if (!walk) return;
    for (const [i, h] of walk.path.entries()) {
      if (!user.alive) return;
      enterHex(ctx, user, h, 'walk', i < walk.path.length - 1);
    }
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
  name: 'Gale',
  kind: 'control',
  range: ABILITY.gale.range,
  radius: 1,
  summary: (user) =>
    `A gale bursts from a space: each unit next to it takes ${damageText(user)} and is Pushed ${ABILITY.gale.push} away.`,
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
    `Loose arrows high at a space within ${ABILITY.volley.range}: charge ${chargeOf(user, 'volley')}. When your card comes back they land, and whoever stands there takes ${damageText(user)}.`,
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
      ...(user.enhance ? {enhance: user.enhance} : {}),
    });
  },
};

// ─── Wolf ────────────────────────────────────────────────────────────────────

const bite: AbilityDef = {
  id: 'bite',
  name: 'Bite',
  kind: 'attack',
  summary: (user) => `Melee: ${damageText(user)}.`,
  targetsUnit: true,
  targets: (state, _map, user, from) => adjacentUnits(state, from, (u) => u !== user),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} bites ${unitName(u)}.`);
    hit(ctx, user, u, 'The bite');
  },
};

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  hold,
  longshot,
  skirmish,
  hail,
  sunlight,
  grapple,
  bite,
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
  return null;
}

export function sameTarget(a: ActionTarget, b: ActionTarget): boolean {
  const eq = (x?: Hex, y?: Hex) =>
    x === undefined ? y === undefined : y !== undefined && hexEquals(x, y);
  return eq(a.hex, b.hex) && eq(a.to, b.to);
}
