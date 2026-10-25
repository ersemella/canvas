import {describe, expect, it} from 'vitest';
import {createFight} from '../../rules/fight';
import {STEPPE} from '../../rules/map';
import type {FightState} from '../../rules/types';
import {camelNextStep} from './camelStep';

/** A fight with Temee at its start and the Champion where `bokh` says. */
function setup(bokh: {q: number; r: number}): FightState {
  const s = createFight(0);
  s.tiles = {...STEPPE.tiles};
  s.phase = 'fight';
  for (const u of s.units) {
    u.alive = u.id === 'p-camel' || u.id === 'p-bokh';
    u.hex = u.id === 'p-camel' ? STEPPE.camelStart : u.id === 'p-bokh' ? bokh : null;
  }
  return s;
}

describe("Temee's next step", () => {
  const start = STEPPE.camelStart;
  const ahead = {q: start.q, r: start.r + 1};

  it('points down its road when nothing is in the way', () => {
    expect(camelNextStep(setup({q: -4, r: 4}), [])).toEqual({from: start, to: ahead});
  });

  it('turns around a unit in its way, and back as the planned turn moves it off', () => {
    const s = setup(ahead);
    const around = camelNextStep(s, [])!;
    expect(around.to).not.toEqual(ahead);
    const plan = [{unitId: 'p-bokh', to: {q: -4, r: 4}, hpBefore: 8, hpAfter: 8, killed: false}];
    expect(camelNextStep(s, plan)).toEqual({from: start, to: ahead});
  });

  it('shows nothing while Temee is Immobilized', () => {
    const s = setup({q: -4, r: 4});
    s.units.find((u) => u.id === 'p-camel')!.statuses = [{kind: 'immobilized'}];
    expect(camelNextStep(s, [])).toBeUndefined();
  });
});
