/**
 * The track (timeline.md, section 3): numbered slots, one card per slot.
 * After each turn a card goes its unit's action cost on,
 * RULES.actionBase × RULES.speedPivot ÷ (speed + RULES.speedPivot), rounded
 * (owner, 2026-10-23),
 * the faster card keeping a slot two cards collide on.
 */
import {ABILITY, HEROES, RULES} from './config';
import type {AbilityId, FightState, Unit} from './types';

/** How many slots a unit's card goes on after each of its turns (3.2), at least 1. */
export function actionCost(unit: Unit): number {
  const {actionBase, speedPivot} = RULES;
  return Math.max(1, Math.round((actionBase * speedPivot) / (unit.speed + speedPivot)));
}

/**
 * How many slots a Wait sends `unit`'s card on (3.2): `share` of its
 * action cost (the fight's `waitShare`, else `RULES.waitShare`), rounded,
 * at least 1; the whole cost for Temee, whose walk is the fight's clock.
 */
export function waitCost(unit: Unit, share = RULES.waitShare): number {
  if (HEROES[unit.hero].walksRoad) return actionCost(unit);
  return Math.max(1, Math.round(actionCost(unit) * share));
}

/**
 * A charged ability's charge (owner, 2026-10-23): its user's card goes
 * this many slots on instead of its action cost (Skirmish's: half of it,
 * rounded), greyed while it charges,
 * and the ability lands when the card comes back, in place of a turn
 * (`landCharge` in fight.ts). Skirmish's, Volley's and Invocation's
 * (`ABILITY.invocation.charge` of his turn, 6 slots at speed 1; with it
 * null a Hold's cost, `waitCost` at the fight's `share`); 0 for the rest.
 */
export function chargeOf(unit: Unit, ability: AbilityId, share = RULES.waitShare): number {
  if (ability === 'invocation') {
    const {charge} = ABILITY.invocation;
    if (charge === null) return waitCost(unit, share);
    return Math.max(1, Math.round(actionCost(unit) * charge));
  }
  const charge =
    ability === 'skirmish'
      ? ABILITY.skirmish.charge
      : ability === 'volley'
        ? ABILITY.volley.charge
        : 0;
  if (charge <= 0) return 0;
  return Math.max(1, Math.round(actionCost(unit) * charge));
}

/**
 * Where a turn ending at slot `now` aims `unit`'s card, before yielding
 * (3.2): its action cost on, the charge of a charged `ability`, or a
 * Wait's cost for an `idle` turn (one without a walk or an ability).
 */
export function aimSlot(
  state: FightState,
  unit: Unit,
  now = state.currentSlot,
  ability?: AbilityId,
  idle = false
): number {
  if (idle) return now + waitCost(unit, state.waitShare);
  const charge = ability ? chargeOf(unit, ability, state.waitShare) : 0;
  return now + (charge > 0 ? charge : actionCost(unit));
}

/** The first free slot at or after `slot`. */
export function freeSlotFrom(state: FightState, slot: number, ignore?: Unit): number {
  const taken = new Set(
    state.units.filter((u) => u.alive && u !== ignore && u.slot !== null).map((u) => u.slot)
  );
  let s = slot;
  while (taken.has(s)) s++;
  return s;
}

/**
 * Places a unit's card at `slot`, resolving collisions by speed (3.3;
 * owner, 2026-10-23): a faster arriving card takes the slot and the card
 * there moves on to the next, colliding again by the same rule; an equal
 * or slower one yields to the next slot itself. A `push`ed card takes
 * its slot whatever its speed (a charge's), the card there moving on as
 * above. Returns the unit's slot.
 */
export function placeCard(state: FightState, unit: Unit, slot: number, push = false): number {
  unit.slot = null;
  let moving = unit;
  let s = slot;
  for (;;) {
    const there = state.units.find((u) => u.alive && u !== moving && u.slot === s);
    if (!there) break;
    if (moving.speed > there.speed || (push && moving === unit)) {
      moving.slot = s;
      moving = there;
    }
    s++;
  }
  moving.slot = s;
  return unit.slot!;
}

/**
 * The order for cards placed at the same moment (3.3, brief section 2):
 * higher speed first; equal speeds the player's side first, then the
 * enemy's, each in party slot order (owner, 2026-10-23; were shuffled by
 * the seed).
 */
export function simultaneousOrder(units: Unit[]): Unit[] {
  const bySpeed = new Map<number, Unit[]>();
  for (const u of units) {
    if (!bySpeed.has(u.speed)) bySpeed.set(u.speed, []);
    bySpeed.get(u.speed)!.push(u);
  }
  const out: Unit[] = [];
  for (const speed of [...bySpeed.keys()].sort((a, b) => b - a)) {
    const group = bySpeed.get(speed)!;
    for (const side of ['player', 'enemy'] as const) {
      out.push(...group.filter((u) => u.side === side).sort((a, b) => a.partyIndex - b.partyIndex));
    }
  }
  return out;
}

/**
 * Starting slots (3.4; owner, 2026-10-23): every card but the camel's in
 * `simultaneousOrder` from slot 0, the fastest first, cards of equal speed
 * side by side and a free slot between one speed and the next; the camel
 * last, at RULES.camelStartSlot (after the others, should they reach it).
 */
export function placeStartingCards(state: FightState): void {
  for (const u of state.units) u.slot = null;
  const alive = state.units.filter((u) => u.alive);
  let slot = 0;
  let speed: number | undefined;
  for (const u of simultaneousOrder(alive.filter((u) => !HEROES[u.hero].actsLast))) {
    if (speed !== undefined && u.speed !== speed) slot++;
    u.slot = slot++;
    speed = u.speed;
  }
  for (const u of alive) {
    if (HEROES[u.hero].actsLast) placeCard(state, u, Math.max(RULES.camelStartSlot, slot));
  }
}

/** A Fisher-Yates shuffle of a copy of `items`. */
export function shuffled<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** The unit whose card the track reaches next, or undefined if none is left. */
export function nextCard(state: FightState): Unit | undefined {
  let best: Unit | undefined;
  for (const u of state.units) {
    if (!u.alive || u.slot === null) continue;
    if (!best || u.slot < best.slot!) best = u;
  }
  return best;
}
