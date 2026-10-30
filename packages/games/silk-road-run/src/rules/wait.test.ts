// Wait (timeline.md, 3.2; `RULES.waitShare`): a turn that does nothing
// sends the card a share of its action cost on.
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {hexNeighbor} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {PARTY, RULES} from './config';
import {advanceToDecision, applyTurn, createFight} from './fight';
import {STEPPE} from './map';
import {previewTurn} from './preview';
import {actionCost, waitCost} from './track';
import type {FightState, Unit} from './types';

const centre: Hex = {q: 0, r: 0};
const out = (dir: number, n: number): Hex => {
  let h = centre;
  for (let i = 0; i < n; i++) h = hexNeighbor(h, dir);
  return h;
};
const unit = (s: FightState, id: string): Unit => s.units.find((u) => u.id === id)!;

/** Units where the test wants them, on open sand, the rest dead; cards far apart. */
function setup(placements: Record<string, Hex>, camel = false): FightState {
  const state = createFight(0, PARTY, PARTY);
  state.tiles = Object.fromEntries(Object.keys(STEPPE.tiles).map((k) => [k, 'sand']));
  if (!camel) state.units = state.units.filter((u) => u.hero !== 'camel');
  let slot = 100;
  for (const u of state.units) {
    const h = placements[u.id];
    if (u.hero === 'camel') continue;
    u.hex = h ?? null;
    u.alive = Boolean(h);
    u.slot = h ? slot : null;
    slot += 50;
  }
  state.currentSlot = 0;
  return state;
}

/** RULES, writable for these tests. */
const rules = RULES as {waitShare: number};

describe('Wait', () => {
  let saved: number;
  beforeEach(() => {
    saved = RULES.waitShare;
    rules.waitShare = 2 / 3;
  });
  afterEach(() => {
    rules.waitShare = saved;
  });

  it('costs two thirds of the action cost, rounded: 5, 6 and 7 for speeds 3, 2 and 1', () => {
    const s = setup({});
    const costs = [3, 2, 1].map((speed) => waitCost({...unit(s, 'p-bokh'), speed}));
    expect(costs).toEqual([5, 6, 7]);
  });

  it('a Hold goes a Wait on; a walk, an ability, and every turn with Wait off, the full cost', () => {
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 4)});
    const u = unit(s, 'p-bokh');
    u.slot = 0;
    applyTurn(s, u, {action: {ability: 'hold'}});
    expect(u.slot).toBe(waitCost(u));
    expect(waitCost(u)).toBeLessThan(actionCost(u));
    s.currentSlot = u.slot!;
    applyTurn(s, u, {move: [out(0, 1)], action: {ability: 'hold'}});
    expect(u.slot).toBe(s.currentSlot + actionCost(u));
    s.currentSlot = u.slot!;
    rules.waitShare = 1;
    applyTurn(s, u, {action: {ability: 'hold'}});
    expect(u.slot).toBe(s.currentSlot + actionCost(u));
  });

  it('the preview aims a Hold at its Wait', () => {
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 4)});
    const u = unit(s, 'p-bokh');
    u.slot = 0;
    s.awaiting = u.id;
    const preview = previewTurn(s, u.id, {action: {ability: 'hold'}})!;
    expect(preview.aimSlot).toBe(waitCost(u));
    expect(preview.slot).toBe(waitCost(u));
  });

  it('Temee waiting on its road still goes its full cost', () => {
    const s = setup({}, true);
    const camel = s.units.find((u) => u.hero === 'camel')!;
    expect(waitCost(camel)).toBe(actionCost(camel));
  });

  it('a turn skipped with only Hold to choose is a Wait', () => {
    // No one to grapple, and Immobilized, nowhere to walk.
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 4)});
    const u = unit(s, 'p-bokh');
    u.statuses.push({kind: 'immobilized'});
    u.slot = 0;
    unit(s, 'e-bokh').slot = 50;
    // Skipped a Wait on each time, until the enemy's card at 50 comes first.
    expect(advanceToDecision(s)!.id).toBe('e-bokh');
    expect(u.skipped).toBe(true);
    expect(u.slot! % waitCost(u)).toBe(0);
    expect(u.slot).toBe(54);
  });
});
