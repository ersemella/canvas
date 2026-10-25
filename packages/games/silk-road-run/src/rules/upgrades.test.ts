// The upgrades of 2026-10-24 (owner; balance.md, "Second abilities
// measured"): Shove, Haul, Feigned Retreat, Gale and Volley, each given
// here by loadout.
import {describe, expect, it} from 'vitest';
import {hexDistance, hexNeighbor} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {PARTY} from './config';
import {ABILITIES} from './abilities';
import {advanceToDecision, applyTurn, createFight, mapOf} from './fight';
import {STEPPE} from './map';
import type {AbilityId, ActionTarget, FightState, Unit} from './types';

const centre: Hex = {q: 0, r: 0};
/** `n` spaces from the centre along direction `dir`. */
const out = (dir: number, n: number, from: Hex = centre): Hex => {
  let h = from;
  for (let i = 0; i < n; i++) h = hexNeighbor(h, dir);
  return h;
};

/** Units where the test wants them, on open sand, the rest dead; cards far apart. */
function setup(placements: Record<string, Hex>): FightState {
  const state = createFight(0, PARTY, PARTY);
  state.tiles = Object.fromEntries(Object.keys(STEPPE.tiles).map((k) => [k, 'sand']));
  state.units = state.units.filter((u) => u.hero !== 'camel');
  let slot = 100;
  for (const u of state.units) {
    const h = placements[u.id];
    u.hex = h ?? null;
    u.alive = Boolean(h);
    u.slot = h ? slot : null;
    slot += 50;
  }
  state.currentSlot = 0;
  return state;
}

const unit = (s: FightState, id: string): Unit => s.units.find((u) => u.id === id)!;

/** `id` takes `input`, with `ability` in its kit. */
function act(s: FightState, id: string, ability: AbilityId, target: ActionTarget) {
  const u = unit(s, id);
  u.loadout = {abilities: [ability, 'hold']};
  applyTurn(s, u, {action: {ability, target}});
}

describe('the upgrades of 2026-10-24', () => {
  it('Shove Pushes 2, stopping at a unit', () => {
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 1), 'e-storm': out(0, 4)});
    act(s, 'p-bokh', 'shove', {hex: out(0, 1)});
    expect(unit(s, 'e-bokh').hex).toEqual(out(0, 3));
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp);
    const t = setup({'p-bokh': centre, 'e-bokh': out(0, 1), 'e-storm': out(0, 3)});
    act(t, 'p-bokh', 'shove', {hex: out(0, 1)});
    expect(unit(t, 'e-bokh').hex).toEqual(out(0, 2));
  });

  it('Haul Pulls the first unit in a lane within 3, not one next to it', () => {
    const s = setup({'p-bokh': centre, 'e-storm': out(2, 3), 'e-bokh': out(4, 1)});
    const targets = ABILITIES.haul.targets(s, mapOf(s), unit(s, 'p-bokh'), centre);
    expect(targets).toEqual([{hex: out(2, 3)}]);
    act(s, 'p-bokh', 'haul', {hex: out(2, 3)});
    expect(unit(s, 'e-storm').hex).toEqual(out(2, 1));
  });

  it('Feigned Retreat shoots, then walks up to 2', () => {
    const s = setup({'p-mangudai': centre, 'e-bokh': out(0, 3)});
    const e = unit(s, 'e-bokh');
    act(s, 'p-mangudai', 'feignedRetreat', {hex: out(0, 3), to: out(3, 2)});
    expect(e.hp).toBe(e.maxHp - 2);
    expect(unit(s, 'p-mangudai').hex).toEqual(out(3, 2));
    const targets = ABILITIES.feignedRetreat.targets(s, mapOf(s), unit(s, 'p-mangudai'), out(3, 2));
    expect(targets.every((t) => hexDistance(t.to!, out(3, 2)) <= 2)).toBe(true);
  });

  it('Gale hits and Pushes every unit next to its space, allies too', () => {
    const s = setup({'p-storm': out(3, 2), 'e-bokh': out(0, 1), 'p-bokh': out(2, 1)});
    act(s, 'p-storm', 'gale', {hex: centre});
    expect(unit(s, 'e-bokh').hex).toEqual(out(0, 2));
    expect(unit(s, 'p-bokh').hex).toEqual(out(2, 2));
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp - 1);
    expect(unit(s, 'p-bokh').hp).toBe(unit(s, 'p-bokh').maxHp - 1);
  });

  it('Volley is charged and lands on whoever stands there', () => {
    const s = setup({'p-mangudai': centre, 'e-bokh': out(1, 2)});
    unit(s, 'p-mangudai').slot = 0;
    act(s, 'p-mangudai', 'volley', {hex: out(1, 2)});
    expect(s.shots).toEqual([{source: 'p-mangudai', hex: out(1, 2)}]);
    const e = unit(s, 'e-bokh');
    e.slot = 900;
    advanceToDecision(s);
    expect(e.hp).toBe(e.maxHp - 2);
  });
});
