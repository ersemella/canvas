/**
 * The track (timeline.md, section 3): numbered slots, one card per slot,
 * paced by the camel, Temee: its card goes RULES.roundSlots on each turn,
 * and every other card goes RULES.speedSlots × speed before its next turn
 * (owner, 2026-10-23), yielding on collision.
 */
import {HEROES, RULES} from './config';
import type {FightState, Unit} from './types';

/** The unit that paces the track: the living camel, if its card is placed. */
export function pacer(state: FightState): Unit | undefined {
  return state.units.find((u) => u.alive && u.slot !== null && HEROES[u.hero].walksRoad);
}

/**
 * Where a turn ending at slot `now` aims `unit`'s card, before yielding
 * (3.2): RULES.speedSlots × speed before the first of Temee's turns that
 * leaves it still ahead of `now`, counting its card as going
 * RULES.roundSlots on each turn. Without a camel (a test's fight), rounds
 * start at slot 0.
 */
export function aimSlot(state: FightState, unit: Unit, now = state.currentSlot): number {
  let slot = (pacer(state)?.slot ?? 0) - RULES.speedSlots * unit.speed;
  while (slot <= now) slot += RULES.roundSlots;
  return slot;
}

/** The first free slot at or after `slot` (3.3: the arriving card yields). */
export function freeSlotFrom(state: FightState, slot: number, ignore?: Unit): number {
  const taken = new Set(
    state.units.filter((u) => u.alive && u !== ignore && u.slot !== null).map((u) => u.slot)
  );
  let s = slot;
  while (taken.has(s)) s++;
  return s;
}

/** Places a unit's card at `slot`, yielding forward; cards already placed never move. */
export function placeCard(state: FightState, unit: Unit, slot: number): number {
  unit.slot = freeSlotFrom(state, slot, unit);
  return unit.slot;
}

/**
 * The order for cards placed at the same moment (3.3, brief section 2):
 * higher speed first. Equal speeds are shuffled by `random` (owner,
 * 2026-10-21); without it they follow the fixed order, alternating sides
 * starting with the player's, then party slot order.
 */
export function simultaneousOrder(units: Unit[], random?: () => number): Unit[] {
  const bySpeed = new Map<number, Unit[]>();
  for (const u of units) {
    if (!bySpeed.has(u.speed)) bySpeed.set(u.speed, []);
    bySpeed.get(u.speed)!.push(u);
  }
  const out: Unit[] = [];
  for (const speed of [...bySpeed.keys()].sort((a, b) => b - a)) {
    const group = bySpeed.get(speed)!;
    if (random) {
      out.push(...shuffled(group, random));
      continue;
    }
    const player = group
      .filter((u) => u.side === 'player')
      .sort((a, b) => a.partyIndex - b.partyIndex);
    const enemy = group
      .filter((u) => u.side === 'enemy')
      .sort((a, b) => a.partyIndex - b.partyIndex);
    for (let i = 0; i < Math.max(player.length, enemy.length); i++) {
      if (player[i]) out.push(player[i]!);
      if (enemy[i]) out.push(enemy[i]!);
    }
  }
  return out;
}

/**
 * Starting slots (3.4): the camel, which acts first, takes slot 0; every
 * other card is placed as after a turn at slot 0 (`aimSlot`), so at
 * RULES.roundSlots − RULES.speedSlots × speed, in `simultaneousOrder`.
 */
export function placeStartingCards(state: FightState, random?: () => number): void {
  for (const u of state.units) u.slot = null;
  const alive = state.units.filter((u) => u.alive);
  for (const u of alive) if (HEROES[u.hero].actsFirst) placeCard(state, u, 0);
  for (const u of simultaneousOrder(
    alive.filter((u) => !HEROES[u.hero].actsFirst),
    random
  )) {
    placeCard(state, u, aimSlot(state, u, 0));
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
