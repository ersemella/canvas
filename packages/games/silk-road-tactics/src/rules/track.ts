/**
 * The track (timeline.md, section 3): numbered slots, one card per slot,
 * placement by cost ÷ (speed + C), and yielding on collision.
 */
import {RULES} from './config';
import type {FightState, Unit} from './types';

/** Slots a card moves for a turn costing `cost` (3.2); always at least 1. */
export function slotsForward(cost: number, speed: number): number {
  return Math.max(1, Math.floor(cost / (speed + RULES.C)));
}

/** A turn's total cost: the action plus movement (3.2). */
export function turnCost(actionCost: number, hexesMoved: number): number {
  return actionCost + hexesMoved * RULES.moveCostPerHex;
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
 * The fixed order for cards placed at the same moment (3.3, brief section
 * 2): higher speed first, then alternating sides starting with the
 * player's, then party slot order.
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

/** Starting slots (3.4): startCost ÷ (speed + C), placed in the fixed order. */
export function placeStartingCards(state: FightState): void {
  for (const u of state.units) u.slot = null;
  for (const u of simultaneousOrder(state.units.filter((u) => u.alive))) {
    placeCard(state, u, Math.floor(RULES.startCost / (u.speed + RULES.C)));
  }
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
