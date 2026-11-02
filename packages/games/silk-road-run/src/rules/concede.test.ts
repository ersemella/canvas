// The enemy yields (`CONCEDE`, owner, 2026-11-02): its last unit, outnumbered,
// with only a Hold worth playing, gives the fight up.
import {describe, expect, it} from 'vitest';
import {PARTY} from './config';
import {kitOf} from './board';
import {concede, concedes, createFight} from './fight';
import type {FightState, TurnInput, Unit} from './types';

const hold: TurnInput = {action: {ability: 'hold'}};
const unit = (s: FightState, id: string): Unit => s.units.find((u) => u.id === id)!;

/** A fight with only the named units (and the camel) still standing. */
function standing(...ids: string[]): FightState {
  const state = createFight(0, PARTY, PARTY);
  for (const u of state.units)
    if (u.hero !== 'camel' && !ids.includes(u.id)) {
      u.alive = false;
      u.hex = null;
      u.slot = null;
    }
  return state;
}

describe('Concede', () => {
  const party = PARTY.map((h) => `p-${h}`);
  const last = `e-${PARTY[0]}`;

  it('the last enemy, outnumbered three to one, yields rather than Hold', () => {
    const s = standing(...party, last);
    expect(concedes(s, unit(s, last), hold)).toBe(true);
    concede(s, unit(s, last));
    expect(s.phase).toBe('won');
    expect(s.awaiting).toBeNull();
    expect(s.log.at(-1)!.text).toMatch(/yields/);
  });

  it('not with a walk or an ability to play', () => {
    const s = standing(...party, last);
    const u = unit(s, last);
    expect(concedes(s, u, {move: [u.hex!], action: {ability: 'hold'}})).toBe(false);
    expect(concedes(s, u, {action: {ability: kitOf(u)[0]!}})).toBe(false);
  });

  it('two to one too', () => {
    const s = standing(party[0]!, party[1]!, last);
    expect(concedes(s, unit(s, last), hold)).toBe(true);
  });

  it('not one to one, nor with an ally standing', () => {
    let s = standing(party[0]!, last);
    expect(concedes(s, unit(s, last), hold)).toBe(false);
    s = standing(...party, last, `e-${PARTY[1]}`);
    expect(concedes(s, unit(s, last), hold)).toBe(false);
  });

  it('never the player’s side', () => {
    const s = standing(party[0]!, ...PARTY.map((h) => `e-${h}`));
    expect(concedes(s, unit(s, party[0]!), hold)).toBe(false);
  });
});
