// The balance experiments' abilities (balance.md, "Second abilities
// measured", 2026-10-24): in no hero's kit, given here by loadout.
import {describe, expect, it} from 'vitest';
import {hexDistance, hexEquals, hexNeighbor, offsetToHex} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, PARTY} from './config';
import {isImmobilized, isStunned, unitAt} from './board';
import {ABILITIES} from './abilities';
import {advanceToDecision, applyTurn, createFight, mapOf} from './fight';
import {SALT_FLATS} from './map';
import type {AbilityId, FightState, TurnInput, Unit} from './types';

const centre = offsetToHex({col: 3, row: 3});
/** `n` spaces from the centre along direction `dir`. */
const out = (dir: number, n: number, from: Hex = centre): Hex => {
  let h = from;
  for (let i = 0; i < n; i++) h = hexNeighbor(h, dir);
  return h;
};

/** Units where the test wants them, on open sand, the rest dead; cards far apart. */
function setup(placements: Record<string, Hex>): FightState {
  const state = createFight(0, PARTY, PARTY);
  state.tiles = Object.fromEntries(Object.keys(SALT_FLATS.tiles).map((k) => [k, 'sand']));
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
function act(s: FightState, id: string, ability: AbilityId, target: TurnInput['action']['target']) {
  const u = unit(s, id);
  u.loadout = {abilities: [ability, 'hold']};
  applyTurn(s, u, {action: {ability, target}});
}

describe('experiment abilities', () => {
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

  it('Hold Loose Immobilizes, holds through damage, and squeezes', () => {
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 1)});
    act(s, 'p-bokh', 'holdLoose', {hex: out(0, 1)});
    const e = unit(s, 'e-bokh');
    expect(isImmobilized(e) && !isStunned(e)).toBe(true);
    // The held Champion hits back: the grapple holds.
    act(s, 'e-bokh', 'grapple', {hex: centre});
    expect(e.statuses.some((x) => x.grapple?.loose)).toBe(true);
    const hp = e.hp;
    s.units.forEach((u) => (u.slot = u.id === 'p-bokh' ? 1 : u.alive ? 500 : null));
    advanceToDecision(s);
    // p-bokh is Stunned by the enemy's grapple, but its own loose one squeezed.
    expect(e.hp).toBe(hp - ABILITY.grapple.squeeze);
  });

  it('Hip Toss lands within 2, hits, and ends the grapple', () => {
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 1)});
    act(s, 'p-bokh', 'grapple', {hex: out(0, 1)});
    const e = unit(s, 'e-bokh');
    const hp = e.hp;
    act(s, 'p-bokh', 'hipToss', {hex: out(0, 1), to: out(3, 2)});
    expect(e.hex).toEqual(out(3, 2));
    expect(e.hp).toBe(hp - 1);
    expect(e.statuses).toEqual([]);
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

  it('Squall Line hails three spaces in a line, no damage', () => {
    const s = setup({'p-storm': out(3, 2), 'e-bokh': out(0, 1)});
    act(s, 'p-storm', 'squall', {hex: centre, to: out(0, 1)});
    expect(s.effects.map((e) => e.hex)).toEqual([out(3, 1), centre, out(0, 1)]);
    const e = unit(s, 'e-bokh');
    expect(e.hp).toBe(e.maxHp);
    expect(isImmobilized(e)).toBe(true);
  });

  it('Tailwind Hastes 3, once between turns', () => {
    const s = setup({'p-storm': centre, 'p-bokh': out(0, 2)});
    unit(s, 'p-storm').slot = 0;
    const b = unit(s, 'p-bokh');
    b.slot = 10;
    act(s, 'p-storm', 'tailwind', {hex: out(0, 2)});
    expect(b.slot).toBe(10 - ABILITY.tailwind.haste);
    expect(b.hasted).toBe(true);
    expect(ABILITIES.tailwind.targets(s, mapOf(s), unit(s, 'p-storm'), centre)).toEqual([]);
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

  it('Overwatch shoots the first unit to enter its lane, then lifts', () => {
    const s = setup({'p-mangudai': centre, 'e-bokh': out(1, 2), 'e-storm': out(1, 3)});
    act(s, 'p-mangudai', 'overwatch', {hex: out(0, 1)});
    expect(s.watches).toEqual([{source: 'p-mangudai', dir: 0}]);
    const e = unit(s, 'e-bokh');
    applyTurn(s, e, {move: [out(0, 1, out(1, 1)), out(0, 2)], action: {ability: 'hold'}});
    expect(e.hp).toBe(e.maxHp - 2);
    expect(s.watches).toEqual([]);
    expect(unitAt(s, out(0, 2))).toBe(e);
    expect(hexEquals(e.hex!, out(0, 2))).toBe(true);
  });
});
