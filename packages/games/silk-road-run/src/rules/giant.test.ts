// The Cyclops (owner, 2026-10-28; enemies.md): One Eye's Armour,
// its facing, Smash and Boulder.
import {describe, expect, it} from 'vitest';
import {hexNeighbor} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ONE_EYE, PARTY} from './config';
import {applyTurn, createFight, mapOf} from './fight';
import {STEPPE} from './map';
import {squeezeGrapples} from './resolve';
import type {AbilityId, ActionTarget, FightState, Unit} from './types';

const centre: Hex = {q: 0, r: 0};
/** `n` spaces from `from` along direction `dir`. */
const out = (dir: number, n: number, from: Hex = centre): Hex => {
  let h = from;
  for (let i = 0; i < n; i++) h = hexNeighbor(h, dir);
  return h;
};

/**
 * The party against the giant and a wolf, units where the test wants them
 * on open sand, the rest dead; cards far apart. The giant faces direction 0.
 */
function setup(placements: Record<string, Hex>): FightState {
  const state = createFight(0, PARTY, ['giant', 'wolf']);
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
  unit(state, 'e-giant').facing = 0;
  state.currentSlot = 0;
  return state;
}

const unit = (s: FightState, id: string): Unit => s.units.find((u) => u.id === id)!;

/** `id`'s turn now, its card on the current slot, taking `ability` on `target`. */
function act(s: FightState, id: string, ability: AbilityId, target: ActionTarget = {}) {
  const u = unit(s, id);
  u.slot = s.currentSlot;
  if (u.hero !== 'giant') u.loadout = {abilities: [ability, 'hold']};
  applyTurn(s, u, {action: {ability, target}});
}

describe('the Cyclops', () => {
  it('starts the fight facing across the board, toward the party', () => {
    const s = createFight(0, PARTY, ['giant']);
    expect([0, 1]).toContain(unit(s, 'e-giant').facing);
    // No one else faces a way.
    expect(s.units.filter((u) => u.facing !== undefined)).toHaveLength(1);
  });

  it('One Eye: a hit from outside its front lane loses its Armour', () => {
    const s = setup({'e-giant': centre, 'p-mangudai': out(2, 3)});
    const giant = unit(s, 'e-giant');
    act(s, 'p-mangudai', 'snapShot', {hex: centre});
    expect(ONE_EYE.armour).toBeGreaterThanOrEqual(2);
    expect(giant.hp).toBe(giant.maxHp);
  });

  it('One Eye: a hit from its front lane, at any distance, lands in full', () => {
    const s = setup({'e-giant': centre, 'p-mangudai': out(0, 4)});
    const giant = unit(s, 'e-giant');
    act(s, 'p-mangudai', 'snapShot', {hex: centre});
    expect(giant.hp).toBe(giant.maxHp - 2);
  });

  it('One Eye: a Piercing hit ignores the Armour (Longshot)', () => {
    const s = setup({'e-giant': centre, 'p-mangudai': out(3, 3)});
    const giant = unit(s, 'e-giant');
    act(s, 'p-mangudai', 'longshot', {hex: centre});
    expect(giant.hp).toBe(giant.maxHp - 2);
  });

  it('One Eye: the Armour holds against a grapple’s squeeze from the side', () => {
    const s = setup({'e-giant': centre, 'p-bokh': out(3, 1)});
    const giant = unit(s, 'e-giant');
    const grappler = unit(s, 'p-bokh');
    act(s, 'p-bokh', 'grapple', {hex: centre});
    squeezeGrapples({state: s, map: mapOf(s), slot: s.currentSlot}, grappler);
    expect(giant.hp).toBe(giant.maxHp);
    // From the front the squeeze gets through.
    grappler.hex = out(0, 1);
    squeezeGrapples({state: s, map: mapOf(s), slot: s.currentSlot}, grappler);
    expect(giant.hp).toBe(giant.maxHp - 1);
  });

  it('Smash: a melee hit for its power, turning it toward its target', () => {
    const s = setup({'e-giant': centre, 'p-bokh': out(4, 1)});
    const grappler = unit(s, 'p-bokh');
    act(s, 'e-giant', 'smash', {hex: out(4, 1)});
    expect(grappler.hp).toBe(grappler.maxHp - 3);
    expect(unit(s, 'e-giant').facing).toBe(4);
  });

  it('a walk turns it the way it last stepped', () => {
    const s = setup({'e-giant': centre, 'p-bokh': out(0, 4)});
    const giant = unit(s, 'e-giant');
    giant.slot = s.currentSlot;
    applyTurn(s, giant, {move: [out(2, 1), out(1, 1, out(2, 1))], action: {ability: 'hold'}});
    expect(giant.facing).toBe(1);
  });

  it('a Push leaves its facing as it was', () => {
    const s = setup({'e-giant': centre, 'p-bokh': out(3, 1)});
    act(s, 'p-bokh', 'shove', {hex: centre});
    const giant = unit(s, 'e-giant');
    expect(giant.hex).toEqual(out(0, 2));
    expect(giant.facing).toBe(0);
  });

  it('Boulder: hits the first unit in a lane and Pushes the units next to it away, unhurt', () => {
    // The Outrider down lane 2, the Storm Caller beside it, the Grappler behind it.
    const at = out(2, 2);
    const s = setup({
      'e-giant': centre,
      'p-mangudai': at,
      'p-storm': out(1, 1, at),
      'p-bokh': out(2, 1, at),
    });
    act(s, 'e-giant', 'boulder', {hex: at});
    const archer = unit(s, 'p-mangudai');
    const storm = unit(s, 'p-storm');
    const grappler = unit(s, 'p-bokh');
    expect(archer.hp).toBe(archer.maxHp - 3);
    expect(archer.hex).toEqual(at);
    expect(storm.hex).toEqual(out(1, 2, at));
    expect(storm.hp).toBe(storm.maxHp);
    expect(grappler.hex).toEqual(out(2, 2, at));
    expect(grappler.hp).toBe(grappler.maxHp);
    // It turns to face down the lane it threw along.
    expect(unit(s, 'e-giant').facing).toBe(2);
  });

  it('Boulder: stops at the first unit, as Snap Shot does', () => {
    const s = setup({'e-giant': centre, 'p-bokh': out(2, 2), 'p-mangudai': out(2, 4)});
    act(s, 'e-giant', 'boulder', {hex: out(2, 2)});
    const grappler = unit(s, 'p-bokh');
    const archer = unit(s, 'p-mangudai');
    expect(grappler.hp).toBe(grappler.maxHp - 3);
    expect(archer.hp).toBe(archer.maxHp);
    expect(() => act(s, 'e-giant', 'boulder', {hex: out(2, 4)})).toThrow();
  });
});
