// Zahhak (2026-10-29; enemies.md): the Serpent King's guard, his serpents
// growing back (Regrow) and Feed the Serpents.
import {describe, expect, it} from 'vitest';
import {hexDistance, hexNeighbor} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, PARTY, REGIONS, REGROW, STAGES} from './config';
import {advanceToDecision, applyTurn, createFight} from './fight';
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

  it('Regrow: a serpent cut down starts growing back, and he loses his guard', () => {
    const s = setup({'e-zahhak': centre, 'e-serpent': out(0, 2), 'p-mangudai': out(0, 4)});
    s.currentSlot = 5;
    act(s, 'p-mangudai', 'snapShot', {hex: out(0, 2)});
    const serpent = unit(s, 'e-serpent');
    expect(serpent.alive).toBe(false);
    expect(serpent.regrowAt).toBe(5 + REGROW.slots);
  });

  it('Regrow: it grows back next to him, at full health, as its card comes up', () => {
    const s = setup({'e-zahhak': centre, 'p-mangudai': out(0, 4)});
    const serpent = unit(s, 'e-serpent');
    serpent.hp = 0;
    serpent.regrowAt = 20;
    // Every other card later than the regrowth.
    for (const u of s.units) if (u.alive) u.slot = 60;
    const next = advanceToDecision(s);
    expect(serpent.alive).toBe(true);
    expect(serpent.regrowAt).toBeUndefined();
    expect(serpent.hp).toBe(serpent.maxHp);
    expect(hexDistance(serpent.hex!, centre)).toBe(1);
    // The open space next to him nearest the party, along direction 0.
    expect(serpent.hex).toEqual(out(0, 1));
    // It takes its turn as it grows back.
    expect(next?.id).toBe('e-serpent');
    expect(s.currentSlot).toBe(20);
  });

  it('Regrow: with every space next to him taken, it waits for the next card', () => {
    const s = setup({'e-zahhak': centre, 'p-mangudai': out(0, 4)});
    // Wolves of the party's in every space next to him (the test's own).
    for (let d = 0; d < 6; d++) {
      const w = {...unit(s, 'p-mangudai'), id: `p-wall-${d}`, hex: out(d, 1), slot: 200 + d};
      s.units.push(w);
    }
    const serpent = unit(s, 'e-serpent');
    serpent.regrowAt = 20;
    unit(s, 'p-mangudai').slot = 30;
    advanceToDecision(s);
    expect(serpent.alive).toBe(false);
    expect(serpent.regrowAt).toBe(31);
  });

  it('once he falls, his serpents grow back no more', () => {
    const s = setup({'e-zahhak': centre, 'p-mangudai': out(0, 3)});
    const zahhak = unit(s, 'e-zahhak');
    zahhak.hp = 1;
    unit(s, 'e-serpent').regrowAt = 40;
    act(s, 'p-mangudai', 'snapShot', {hex: centre});
    expect(zahhak.alive).toBe(false);
    expect(unit(s, 'e-serpent').regrowAt).toBeUndefined();
    expect(s.phase).toBe('won');
  });

  it('the fight isn’t won while a serpent grows back and he stands', () => {
    const s = setup({'e-zahhak': centre, 'e-serpent': out(0, 2), 'p-mangudai': out(0, 4)});
    act(s, 'p-mangudai', 'snapShot', {hex: out(0, 2)});
    expect(s.phase).toBe('fight');
  });

  it('Feed the Serpents: melee, his power, and his serpents grow back sooner', () => {
    const s = setup({'e-zahhak': centre, 'p-bokh': out(0, 1)});
    s.currentSlot = 10;
    unit(s, 'e-serpent').regrowAt = 30;
    unit(s, 'e-serpent-2').regrowAt = 12;
    const bokh = unit(s, 'p-bokh');
    act(s, 'e-zahhak', 'feed', {hex: out(0, 1)});
    expect(bokh.hp).toBe(bokh.maxHp - unit(s, 'e-zahhak').power);
    expect(unit(s, 'e-serpent').regrowAt).toBe(30 - ABILITY.feed.sooner);
    // At the soonest the next slot.
    expect(unit(s, 'e-serpent-2').regrowAt).toBe(11);
  });

  it('is Persia’s boss: its stage 4 brings him and two serpents, in his palace', () => {
    expect(REGIONS.persia.boss).toEqual(['zahhak', 'serpent', 'serpent']);
    const stage = STAGES.find((st) => st.region === 'persia' && st.boss)!;
    expect(stage.map).toBe('palace');
  });
});
