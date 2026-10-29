// Zahhak (2026-10-29; enemies.md): the Serpent King's guard, Regrow (his
// serpents grown back on his turn) and Feed the Serpents.
import {describe, expect, it} from 'vitest';
import {hexNeighbor} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITIES} from './abilities';
import {allowedTargets} from './choices';
import {PARTY, REGIONS, STAGES} from './config';
import {advanceToDecision, applyTurn, createFight, mapOf} from './fight';
import {actionCost} from './track';
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
 * The party against Zahhak and his two serpents, units where the test
 * wants them on open sand, the rest dead; cards far apart.
 */
function setup(placements: Record<string, Hex>): FightState {
  const state = createFight(0, PARTY, ['zahhak', 'serpent', 'serpent']);
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
  if (u.side === 'player') u.loadout = {abilities: [ability, 'hold']};
  applyTurn(s, u, {action: {ability, target}});
}

describe('Zahhak', () => {
  it('Serpent King: no damage reaches him while a serpent is on the board', () => {
    const s = setup({'e-zahhak': centre, 'e-serpent': out(3, 3), 'p-mangudai': out(0, 3)});
    const zahhak = unit(s, 'e-zahhak');
    act(s, 'p-mangudai', 'snapShot', {hex: centre});
    expect(zahhak.hp).toBe(zahhak.maxHp);
  });

  it('with both serpents down, he is hit in full', () => {
    const s = setup({'e-zahhak': centre, 'p-mangudai': out(0, 3)});
    const zahhak = unit(s, 'e-zahhak');
    act(s, 'p-mangudai', 'snapShot', {hex: centre});
    expect(zahhak.hp).toBe(zahhak.maxHp - unit(s, 'p-mangudai').power);
  });

  it('a serpent cut down stays down, its card off the track, and he loses his guard', () => {
    const s = setup({'e-zahhak': centre, 'e-serpent': out(0, 2), 'p-mangudai': out(0, 4)});
    act(s, 'p-mangudai', 'snapShot', {hex: out(0, 2)});
    const serpent = unit(s, 'e-serpent');
    expect(serpent.alive).toBe(false);
    expect(serpent.slot).toBeNull();
    // Nothing brings it back as the track runs on: only Zahhak, on his turn.
    for (const u of s.units) if (u.alive) u.slot = 60;
    const next = advanceToDecision(s);
    expect(next?.id).not.toBe('e-serpent');
    expect(serpent.alive).toBe(false);
  });

  it('the fight isn’t won while he stands with his serpents down', () => {
    const s = setup({'e-zahhak': centre, 'e-serpent': out(0, 2), 'p-mangudai': out(0, 4)});
    act(s, 'p-mangudai', 'snapShot', {hex: out(0, 2)});
    expect(s.phase).toBe('fight');
  });

  it('Regrow: on his turn, a fallen serpent grows back next to him at full health', () => {
    const s = setup({'e-zahhak': centre, 'p-mangudai': out(0, 4)});
    s.currentSlot = 10;
    const serpent = unit(s, 'e-serpent');
    serpent.hp = 0;
    const options = allowedTargets(s, mapOf(s), unit(s, 'e-zahhak'), ABILITIES.regrowSerpent);
    // Each open space next to him.
    expect(options).toHaveLength(6);
    act(s, 'e-zahhak', 'regrowSerpent', {hex: out(3, 1)});
    expect(serpent.alive).toBe(true);
    expect(serpent.hex).toEqual(out(3, 1));
    expect(serpent.hp).toBe(serpent.maxHp);
    // Its card placed as after a turn of its own.
    expect(serpent.slot).toBe(10 + actionCost(serpent));
    // The other serpent grows back only on a turn of his own.
    expect(unit(s, 'e-serpent-2').alive).toBe(false);
    // And his guard is back.
    act(s, 'p-mangudai', 'snapShot', {hex: centre});
    expect(unit(s, 'e-zahhak').hp).toBe(unit(s, 'e-zahhak').maxHp);
  });

  it('Regrow: nothing to do with both serpents standing, or no space next to him', () => {
    const s = setup({
      'e-zahhak': centre,
      'e-serpent': out(0, 2),
      'e-serpent-2': out(3, 2),
      'p-mangudai': out(0, 4),
    });
    const zahhak = unit(s, 'e-zahhak');
    expect(allowedTargets(s, mapOf(s), zahhak, ABILITIES.regrowSerpent)).toEqual([]);
    unit(s, 'e-serpent').alive = false;
    unit(s, 'e-serpent').hex = null;
    for (let d = 0; d < 6; d++) {
      const w = {...unit(s, 'p-mangudai'), id: `p-wall-${d}`, hex: out(d, 1), slot: 200 + d};
      s.units.push(w);
    }
    expect(allowedTargets(s, mapOf(s), zahhak, ABILITIES.regrowSerpent)).toEqual([]);
  });

  it('once he falls with his serpents down, the fight is won', () => {
    const s = setup({'e-zahhak': centre, 'p-mangudai': out(0, 3)});
    const zahhak = unit(s, 'e-zahhak');
    zahhak.hp = 1;
    act(s, 'p-mangudai', 'snapShot', {hex: centre});
    expect(zahhak.alive).toBe(false);
    expect(s.phase).toBe('won');
  });

  it('Feed the Serpents: melee, his power', () => {
    const s = setup({'e-zahhak': centre, 'p-bokh': out(0, 1)});
    const bokh = unit(s, 'p-bokh');
    act(s, 'e-zahhak', 'feed', {hex: out(0, 1)});
    expect(bokh.hp).toBe(bokh.maxHp - unit(s, 'e-zahhak').power);
  });

  it('is Persia’s boss: its stage 4 brings him and two serpents, in his palace', () => {
    expect(REGIONS.persia.boss).toEqual(['zahhak', 'serpent', 'serpent']);
    const stage = STAGES.find((st) => st.region === 'persia' && st.boss)!;
    expect(stage.map).toBe('palace');
  });
});
