// The Cyclops (owner, 2026-10-28; enemies.md): Smash and Boulder.
import {describe, expect, it} from 'vitest';
import {hexNeighbor} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {PARTY} from './config';
import {applyTurn, createFight} from './fight';
import {STEPPE} from './map';
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
 * on open sand, the rest dead; cards far apart.
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
  it('has no facing: a hit lands in full from any side', () => {
    for (const dir of [0, 2, 3]) {
      const s = setup({'e-giant': centre, 'p-mangudai': out(dir, 3)});
      const giant = unit(s, 'e-giant');
      act(s, 'p-mangudai', 'snapShot', {hex: centre});
      expect(giant.hp).toBe(giant.maxHp - 2);
    }
  });

  it('Smash: a melee hit for its power', () => {
    const s = setup({'e-giant': centre, 'p-bokh': out(4, 1)});
    const grappler = unit(s, 'p-bokh');
    act(s, 'e-giant', 'smash', {hex: out(4, 1)});
    expect(grappler.hp).toBe(grappler.maxHp - 3);
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
