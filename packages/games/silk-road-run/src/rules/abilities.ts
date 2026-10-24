/**
 * The three prototype heroes' abilities (roster.md; owner, 2026-10-23) and
 * the wolf's. Each lists its legal targets from a hex (for validation,
 * previews and the AI) and resolves on the fight state. Every ability
 * deals exactly its user's power in damage; shapes come from config.ts.
 */
import {hexEquals, hexNeighbors} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY} from './config';
import {
  firstInLane,
  isImmobilized,
  kitOf,
  lane as laneFrom,
  sortByHex,
  spacesWithin,
  steps as stepsFrom,
  unitAt,
} from './board';
import {endGrapples, enhance, enterHex, hailHolds, hit, log, stun, unitName} from './resolve';
import type {Ctx} from './resolve';
import {tileAt} from './map';
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
   * the ability resolves from there (Skirmish); otherwise `to` is where the
   * target lands (Throw).
   */
  steps?: boolean;
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
 * it hits), ruins or the map's edge (Longshot has no range limit). For the
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
  radius: 0,
  summary: (user) =>
    `Hail on a space until your next turn: a unit there takes ${damageText(user)}, and a unit there or that enters it is Immobilized until the hail is gone.`,
  targets: (_state, map, _user, from) =>
    hexesWithin(map, from, ABILITY.hail.range, (h) => tileAt(map, h) !== 'obstacle'),
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
      if (tileAt(map, h) === 'obstacle') return false;
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

/**
 * Throw (owner, 2026-10-23): only the unit the Champion grapples, Moved to
 * any free space next to the Champion, or swapping places with it (the
 * Champion's own hex as the landing; owner, 2026-10-23), then struck. Either
 * way the two stay next to each other, so the grapple holds. An Immobilized
 * Champion can't swap: it would move itself.
 */
const throwAbility: AbilityDef = {
  id: 'throw',
  name: 'Throw',
  kind: 'attack',
  summary: (user) =>
    `Melee, on the unit you grapple: Move it to a free space next to you, or swap places with it, then it takes ${damageText(user)}. The grapple holds.`,
  targetsUnit: true,
  targets(state, map, user, from) {
    const out: ActionTarget[] = [];
    for (const t of adjacentUnits(state, from, (u) => u !== user && grappling(user, u))) {
      const landings = stepsFrom(map, from).filter((h) => !unitAt(state, h));
      if (!isImmobilized(user)) landings.push(from);
      for (const to of sortByHex(landings, (h) => h)) out.push({hex: t.hex!, to});
    }
    return out;
  },
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    if (hexEquals(target.to!, user.hex!)) {
      const at = u.hex!;
      log(ctx, `${unitName(user)} swaps places with ${unitName(u)}.`);
      // Each enters the other's space; side by side still, the grapple holds.
      enterHex(ctx, u, user.hex!, 'swap', true);
      enterHex(ctx, user, at, 'swap', true);
    } else {
      log(ctx, `${unitName(user)} throws ${unitName(u)}.`);
      enterHex(ctx, u, target.to!, 'throw');
    }
    hit(ctx, user, u, 'The throw');
  },
};

const grapple: AbilityDef = {
  id: 'grapple',
  name: 'Grapple',
  kind: 'attack',
  summary: (user) =>
    `Melee: it takes ${damageText(user)} and is Stunned until you take damage, are Stunned or end a turn no longer next to it, taking ${ABILITY.grapple.squeeze} more at each of your turns meanwhile${ABILITY.grapple.enhancedSqueeze ? ' (plus your Enhance)' : ''}. One at a time.`,
  targetsUnit: true,
  // Melee only (owner, 2026-10-23; reached 2 spaces, stepping in, before),
  // and not the unit it already grapples.
  targets: (state, _map, user, from) =>
    adjacentUnits(state, from, (u) => u !== user && !grappling(user, u)),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} grapples ${unitName(u)}.`);
    hit(ctx, user, u, 'The grapple');
    if (!u.alive) return;
    // One target at a time: an earlier grapple lets go.
    endGrapples(ctx, (g) => g.champion === user.id);
    stun(ctx, u, {kind: 'stunned', grapple: {champion: user.id, target: u.id}});
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
  throw: throwAbility,
  bite,
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
