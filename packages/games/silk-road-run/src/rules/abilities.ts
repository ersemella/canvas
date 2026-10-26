/**
 * The three prototype heroes' abilities (roster.md; owner, 2026-10-23),
 * the Vanguard's and the Alchemist's (owner, 2026-10-25), the
 * Swordsman's (owner, 2026-10-26), and the wolf's. Each lists its legal targets from a hex (for validation,
 * previews and the AI) and resolves on the fight state. Every ability
 * deals exactly its user's power in damage; shapes come from config.ts.
 */
import {hexDirectionTo, hexDistance, hexEquals, hexNeighbors} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, CAMEL} from './config';
import {
  cleaveAreas,
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
  clearHail,
  weaken,
  delay,
  displace,
  displaced,
  endGrapples,
  empower,
  enterHex,
  hailEnds,
  hailHolds,
  liftHail,
  haste,
  heal,
  hit,
  log,
  makeUnstoppable,
  stun,
  unitName,
  walk,
} from './resolve';
import type {Ctx} from './resolve';
import {blocks, tileAt} from './map';
import {chargeOf} from './track';
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
  radius?: number | undefined;
  /**
   * The spaces it covers, for an ability whose area runs from its user
   * rather than around its target (Cleave's line): the page and the
   * playback light these up in place of `radius`'s.
   */
  area?(map: MapData, from: Hex, target: Hex): Hex[];
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
   * Helps a unit of its user's side and hinders one of the other (Elixir:
   * Empower or Weaken), so the page offers units of either side.
   */
  bothSides?: boolean;
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

const hold: AbilityDef = {
  id: 'hold',
  name: 'Hold',
  summary: () => 'End the turn with no effect.',
  targets: () => [{}],
  resolve: (ctx, user) => log(ctx, `${unitName(user)} holds.`),
};

// ─── Horse Archer ────────────────────────────────────────────────────────────

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

/**
 * Skirmish (owner, 2026-10-23, in place of Volley): one step to a free
 * space next to the Horse Archer (not while Immobilized), then Longshot's shot
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
    `A space exactly ${ABILITY.hail.range} away, until ${hailEnds(ABILITY.hail.turns, 'your')}: hits a unit there; units there or entering are Immobilized, and entering hits them too. Up to ${ABILITY.hail.max} stand at once.`,
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
    ctx.state.effects.push({kind: 'hail', hex, source: user.id, turns: ABILITY.hail.turns});
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
  name: 'Sunlight',
  kind: 'support',
  range: ABILITY.sunlight.range,
  summary: () =>
    `A space within ${ABILITY.sunlight.range}: hail there melts; a unit there is Empowered ${ABILITY.sunlight.empower}.`,
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
    if (u) empower(ctx, u, ABILITY.sunlight.empower);
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
 * 2026-10-23), the held unit Moved there, then struck; on the Grappler's
 * own space: the two swap places, then it is struck. Either way the two
 * stay next to each other, so the grapple holds. An Immobilized Grappler
 * still swaps (owner, 2026-10-25): the swap is the grapple's move, not a
 * walk of its own.
 */
const grapple: AbilityDef = {
  id: 'grapple',
  name: 'Grapple',
  kind: 'attack',
  summary: () =>
    `Melee: hits it, and it is Stunned until you take damage or are Stunned, taking ${ABILITY.grapple.squeeze} more damage each of your turns. While grappling: Move it to a free space next to you, or swap places, and hit it again.`,
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
      // The held unit is Moved: with Rebound it Pushes its new neighbours (19.8).
      displaced(ctx, u);
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
// Shove and Haul (the Grappler), Feigned Retreat and Volley (the Horse Archer)
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
 * the Horse Archer's card comes back takes its power (`landShots`).
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
 * Cleave (owner, 2026-10-25; its shape, 2026-10-26): a line of 2 spaces
 * straight up or down from the Vanguard, or a cone to one side (the two
 * diagonal spaces and the one straight across beyond them); each unit in
 * it, ally or enemy, takes the Vanguard's power, and each one left
 * standing is Delayed `ABILITY.cleave.delay` (8, owner, 2026-10-26).
 * Aimed at the area's first space, which may be empty when a unit stands
 * in another.
 */
const cleave: AbilityDef = {
  id: 'cleave',
  name: 'Cleave',
  kind: 'attack',
  summary: () =>
    `A line of ${ABILITY.cleave.reach} spaces straight up or down from you, or a cone of 3 to one side: hits every unit in it, allies included, and Delays ${ABILITY.cleave.delay} each one left standing.`,
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
    for (const u of caught) delay(ctx, u, ABILITY.cleave.delay);
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
    const {fixed, haste, delay, unstoppable} = ABILITY.elixir;
    if (u.side !== user.side)
      return fixed > 0 || delay > 0 || (u.power > 0 && elixirAmount('weaken') > 0);
    return (
      haste > 0 ||
      unstoppable ||
      (u.power > 0 && elixirAmount('empower') > 0) ||
      (elixirHeals(u) && u.hp < u.maxHp)
    );
  };

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
 * Elixir (owner, 2026-10-25; a burst since 2026-10-26): a space within
 * `ABILITY.elixir.range` (1: next to the Alchemist, or its own), no line of
 * fire; each unit within `radius` of it but the Alchemist, either side,
 * takes it: an ally is Hastened `haste` (3), an enemy Delayed `delay` (3)
 * (owner, 2026-10-26; Empowered 2 and Weakened 1 before). No hit, no heal.
 * Other shapes and amounts, a heal and Unstoppable, for measuring, by
 * `ABILITY.elixir` (`elixirCaught`).
 */
const elixir: AbilityDef = {
  id: 'elixir',
  name: 'Elixir',
  kind: 'support',
  damages: false,
  bothSides: true,
  // Getters, so the measuring switches (`ABILITY.elixir`) reach the page and the AI.
  get range() {
    return ABILITY.elixir.range;
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
    const {
      shape,
      range,
      radius,
      fixed,
      heal,
      haste: hastes,
      delay: delays,
      unstoppable,
    } = ABILITY.elixir;
    const empowers = elixirAmount('empower');
    const weakens = elixirAmount('weaken');
    const effect = (them: string) => {
      // Each side's part, the amounts at 0 left out (with Haste and Delay alone, only those).
      const ally = [
        empowers ? `Empowered ${empowers}` : '',
        hastes ? `Hastened ${hastes}` : '',
        unstoppable ? `Unstoppable until ${them} next turn` : '',
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
      return `${[allies, enemies].filter(Boolean).join(', ')}${empowers || weakens ? `, until the end of ${them} next turn` : ''}.`;
    };
    const who = `${hastes || delays ? 'unit' : 'unit that hits'}${ABILITY.elixir.self ? '' : ' but you'}`;
    if (shape === 'burst')
      return `${range === 1 ? 'A space next to you, or your own' : `A space within ${range}`}, and every ${who} within ${radius} of it: ${effect('their')}`;
    if (shape === 'aura') return `Every ${who} within ${radius} of you: ${effect('their')}`;
    return `A unit within ${range}${ABILITY.elixir.self ? ', yourself too' : ''}: ${effect('its')}`;
  },
  targets(state, map, user, from) {
    const {shape, range} = ABILITY.elixir;
    if (shape === 'aura')
      return elixirCaught(state, user, from, from).length > 0 ? [{hex: {...from}}] : [];
    if (shape === 'burst')
      return spacesWithin(map, from, range)
        .filter((h) => elixirCaught(state, user, from, h).length > 0)
        .map((h) => ({hex: h}));
    return spacesWithin(map, from, range)
      .map((h) => unitAt(state, h))
      .filter(elixirTakes(user))
      .map((u) => ({hex: u.hex!}));
  },
  resolve(ctx, user, target) {
    const caught = elixirCaught(ctx.state, user, user.hex!, target.hex!);
    const {fixed, haste: hastes, delay: delays, unstoppable} = ABILITY.elixir;
    for (const u of caught) {
      log(ctx, `${unitName(user)} gives ${unitName(u)} an elixir.`);
      if (u.side === user.side) {
        if (elixirHeals(u)) heal(ctx, u, user.power);
        // An amount of 0 gives none, rather than replacing an Empower it has.
        const empowers = elixirAmount('empower');
        if (u.power > 0 && empowers > 0) empower(ctx, u, empowers);
        haste(ctx, u, hastes);
        if (unstoppable) makeUnstoppable(ctx, u);
      } else {
        if (fixed) hit(ctx, user, u, 'The elixir');
        const weakens = elixirAmount('weaken');
        if (u.alive && u.power > 0 && weakens > 0) weaken(ctx, u, weakens);
        delay(ctx, u, delays);
      }
    }
  },
};

// ─── Swordsman ───────────────────────────────────────────────────────────────

/**
 * Swift Strike (owner, 2026-10-26): melee, the Swordsman's power; when it
 * hits, its card is Hastened `ABILITY.swiftStrike.haste`, taken off as its
 * card is placed after this turn (`haste`).
 */
const swiftStrike: AbilityDef = {
  id: 'swiftStrike',
  name: 'Swift Strike',
  kind: 'attack',
  summary: () => `Melee. When it hits, its card is Hastened ${ABILITY.swiftStrike.haste}.`,
  targetsUnit: true,
  targets: (state, _map, user, from) => adjacentUnits(state, from, (u) => u !== user),
  resolve(ctx, user, target) {
    const u = unitAt(ctx.state, target.hex!)!;
    log(ctx, `${unitName(user)} strikes ${unitName(u)} with the sword.`);
    hit(ctx, user, u, 'The sword');
    haste(ctx, user, ABILITY.swiftStrike.haste);
  },
};

// ─── Wolf ────────────────────────────────────────────────────────────────────

const bite: AbilityDef = {
  id: 'bite',
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

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  hold,
  longshot,
  skirmish,
  hail,
  sunlight,
  grapple,
  bite,
  cleave,
  elixir,
  swiftStrike,
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
