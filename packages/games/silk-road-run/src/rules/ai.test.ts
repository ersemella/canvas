import {describe, expect, it} from 'vitest';
import {hexDistance, hexKey} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {chooseAiTurn, evaluatePosition, requestChooser, scoreOptions, simulate} from './ai';
import type {SearchStats} from './ai';
import {AI, HEROES} from './config';
import {advance, advanceToDecision, applyTurn, cloneFight, createFight, mapOf} from './fight';
import {createRun} from './run';
import {SALT_FLATS, tileAt} from './map';
import {arrowLanes} from './abilities';
import {stepToExit} from './board';
import type {FightState, HeroId, TurnInput} from './types';

const hex = (q: number, r: number): Hex => ({q, r});
const unit = (s: FightState, id: string) => s.units.find((u) => u.id === id)!;
const stats = (): SearchStats => ({completedDepth: 0, cutoffs: 0, work: 0});
function setup(placements: Record<string, Hex>, enemies?: HeroId[]): FightState {
  const s = createFight(0, undefined, enemies);
  // The fixed layout, which these tests place units around.
  s.tiles = {...SALT_FLATS.tiles};
  s.phase = 'fight';
  // An unlisted camel isn't there at all: dead, it would lose the fight.
  s.units = s.units.filter((u) => u.hero !== 'camel' || u.id in placements);
  for (const u of s.units) {
    u.alive = u.id in placements;
    u.hex = placements[u.id] ?? null;
    u.slot = u.alive ? 100 + u.partyIndex : null;
  }
  return s;
}
/** A fight's first hero decision, past any camel turns before it. */
function opening(): FightState {
  const s = createFight(0);
  for (let u = advanceToDecision(s)!; u.hero === 'camel'; u = advanceToDecision(s)!)
    applyTurn(s, u, chooseAiTurn(s, u));
  return s;
}

// These tests compare actual decisions and rule outcomes, rather than
// asserting the implementation's recursion order or an elapsed-time ceiling.
describe('budgeted tactical search', () => {
  it('gets the same minimax result with pruning, using less work', () => {
    const s = opening();
    const before = JSON.stringify(s);
    const me = unit(s, s.awaiting!);
    const pruned = stats();
    const exhaustive = stats();
    const selected = chooseAiTurn(s, me, {left: AI.requestSimulations}, pruned, {depth: 2});
    const reference = chooseAiTurn(s, me, {left: AI.requestSimulations}, exhaustive, {
      depth: 2,
      prune: false,
    });
    expect(pruned.completedDepth).toBe(2);
    expect(exhaustive.completedDepth).toBe(2);
    expect(selected).toEqual(reference);
    expect(pruned.value).toBe(exhaustive.value);
    expect(pruned.cutoffs).toBeGreaterThan(0);
    expect(pruned.work).toBeLessThan(exhaustive.work);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('completes three decisions on a small tree and agrees with exhaustive minimax', () => {
    const s = setup({'e-mangudai': hex(0, 0), 'p-mangudai': hex(3, 0)});
    const me = unit(s, 'e-mangudai');
    me.slot = 0;
    unit(s, 'p-mangudai').slot = 1;
    for (const u of s.units) {
      u.statuses = [{kind: 'immobilized'}];
    }
    s.awaiting = me.id;
    const pruned = stats();
    const exhaustive = stats();
    // The bow alone: a second attack would make the tree too big to search exhaustively.
    const kit = HEROES.mangudai.abilities;
    HEROES.mangudai.abilities = ['bow', 'hold'];
    let selected: TurnInput;
    try {
      selected = chooseAiTurn(s, me, {left: AI.requestSimulations}, pruned);
      expect(
        chooseAiTurn(s, me, {left: AI.requestSimulations}, exhaustive, {prune: false})
      ).toEqual(selected);
    } finally {
      HEROES.mangudai.abilities = kit;
    }
    expect(pruned.completedDepth).toBe(3);
    expect(exhaustive.completedDepth).toBe(3);
    expect(pruned.value).toBe(exhaustive.value);
    expect(pruned.work).toBeLessThanOrEqual(exhaustive.work);
  });

  it('keeps the last completed depth when the next iteration is interrupted', () => {
    const s = opening();
    const me = unit(s, s.awaiting!);
    const completed = stats();
    const expected = chooseAiTurn(s, me, {left: AI.requestSimulations}, completed, {depth: 2});
    expect(completed.completedDepth).toBe(2);
    const interrupted = stats();
    const budget = {left: completed.work + 1};
    expect(chooseAiTurn(s, me, budget, interrupted)).toEqual(expected);
    expect(interrupted.completedDepth).toBe(2);
    expect(budget.left).toBe(0);
  });

  it('bounds all turns sharing a request, including tiny and exhausted budgets', () => {
    const s = opening();
    const me = unit(s, s.awaiting!);
    for (const left of [0, 1, 2, AI.rootSimulations - 1, AI.maxSimulations]) {
      const budget = {left};
      for (let turn = 0; turn < 4; turn++) {
        const detail = stats();
        const input = chooseAiTurn(s, me, budget, detail);
        expect(detail.work).toBeLessThanOrEqual(AI.maxSimulations);
        expect(budget.left).toBeGreaterThanOrEqual(0);
        const copy = cloneFight(s);
        expect(() => applyTurn(copy, unit(copy, me.id), input)).not.toThrow();
      }
      expect(budget.left).toBe(0);
    }
    expect(scoreOptions(s, me, Infinity, {left: 0})).toEqual([]);
  });

  it('avoids a lethal reply when a turn can escape it', () => {
    // A wounded wolf next to the Champion, in the Outrider's lane.
    const s = setup({'e-wolf': hex(2, 0), 'p-bokh': hex(3, 0), 'p-mangudai': hex(-1, 0)}, ['wolf']);
    const me = unit(s, 'e-wolf');
    me.hp = 2;
    me.slot = 0;
    unit(s, 'p-mangudai').slot = 1;
    unit(s, 'p-bokh').slot = 2;
    s.awaiting = me.id;
    const canBeKilled = (input: TurnInput): boolean => {
      const after = simulate(s, me.id, input)!;
      const reply = advanceToDecision(after)!;
      expect(reply.id).toBe('p-mangudai');
      // Check every legal reply, beyond the search's selective shortlist.
      return scoreOptions(after, reply).some((option) => !unit(option.after, me.id).alive);
    };
    const options = scoreOptions(s, me);
    expect(options.some((o) => canBeKilled(o.input))).toBe(true);
    expect(options.some((o) => !canBeKilled(o.input))).toBe(true);
    const detail = stats();
    const selected = chooseAiTurn(s, me, {left: AI.requestSimulations}, detail, {depth: 2});
    expect(detail.completedDepth).toBe(2);
    expect(canBeKilled(selected)).toBe(false);
    expect(evaluatePosition(s, 'enemy')).toBe(-evaluatePosition(s, 'player'));
  });

  it('prioritizes terminal victory and preserves deterministic ties', () => {
    const s = setup({'e-mangudai': hex(0, 0), 'p-bokh': hex(3, 0)});
    const me = unit(s, 'e-mangudai');
    me.slot = 0;
    unit(s, 'p-bokh').hp = 1;
    s.awaiting = me.id;
    const before = JSON.stringify(s);
    const input = chooseAiTurn(s, me);
    expect(chooseAiTurn(s, me)).toEqual(input);
    const after = simulate(s, me.id, input)!;
    expect(evaluatePosition(after, 'enemy')).toBe(AI.victory);
    expect(evaluatePosition(after, 'player')).toBe(-AI.victory);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('the search timeline', () => {
  it('follows the track, not alternation: an ally due next maximizes too', () => {
    // Two wolves due back to back, then the last hero, which they can kill
    // between them: a reply assumed to be the opponent's would not bite.
    const s = setup({'e-wolf': hex(2, 0), 'e-wolf-2': hex(4, 0), 'p-mangudai': hex(3, 0)}, [
      'wolf',
      'wolf',
    ]);
    const me = unit(s, 'e-wolf');
    me.slot = 0;
    unit(s, 'e-wolf-2').slot = 1;
    unit(s, 'p-mangudai').slot = 2;
    unit(s, 'p-mangudai').hp = 2;
    s.awaiting = me.id;
    const detail = stats();
    const input = chooseAiTurn(s, me, {left: AI.requestSimulations}, detail, {depth: 2});
    expect(input.action.ability).toBe('bite');
    expect(detail.completedDepth).toBe(2);
    expect(detail.value).toBeGreaterThanOrEqual(AI.victory);
  });

  it('closes in on Temee once no hero is within a walk and a hit', () => {
    const wolf = hex(6, 0);
    const temee = hex(0, 0);
    const cases = SALT_FLATS.hexes.filter((h) => !SALT_FLATS.tiles[hexKey(h)]);
    // Nearer than Temee either way: in reach (a move of 3 and a bite), or not.
    const near = cases.find((h) => hexDistance(h, wolf) === 2 && hexDistance(h, temee) > 6)!;
    const far = cases.find((h) => hexDistance(h, wolf) === 5 && hexDistance(h, temee) > 6)!;
    const closesOn = (hero: Hex) => {
      const s = setup({'e-wolf': wolf, 'p-bokh': hero, 'p-camel': temee}, ['wolf']);
      const me = unit(s, 'e-wolf');
      me.slot = 0;
      unit(s, 'p-bokh').slot = 1;
      unit(s, 'p-camel').slot = 2;
      s.awaiting = me.id;
      const end = chooseAiTurn(s, me).move?.at(-1) ?? wolf;
      return hexDistance(end, temee) < 6
        ? 'temee'
        : hexDistance(end, hero) < hexDistance(wolf, hero)
          ? 'hero'
          : 'neither';
    };
    expect(closesOn(far)).toBe('temee');
    // In reach, the hero is the one to fight (here the wolf waits for it).
    expect(closesOn(near)).not.toBe('temee');
  });

  it('lifts its own hail before stopping for an AI decision, only once', () => {
    const s = setup({'e-storm': hex(0, 0), 'p-bokh': hex(3, 0)});
    const me = unit(s, 'e-storm');
    const held = unit(s, 'p-bokh');
    me.slot = 3;
    s.effects = [{kind: 'hail', hex: hex(3, 0), source: me.id}];
    held.statuses = [{kind: 'immobilized', hail: me.id}];
    expect(advanceToDecision(s)?.id).toBe(me.id);
    expect(s.currentSlot).toBe(3);
    expect(s.effects).toEqual([]);
    expect(held.statuses).toEqual([]);
    const stopped = JSON.stringify(s);
    expect(advanceToDecision(s)?.id).toBe(me.id);
    expect(JSON.stringify(s)).toBe(stopped);
  });

  it('only aims hail where a unit stands', () => {
    const s = setup({'e-storm': hex(0, 0), 'p-bokh': hex(3, 0), 'p-mangudai': hex(8, 0)});
    const me = unit(s, 'e-storm');
    me.slot = 0;
    const aimed = scoreOptions(s, me)
      .filter((o) => o.input.action.ability === 'hail')
      .map((o) => o.input.action.target!.hex!);
    expect(aimed).toEqual(expect.arrayContaining([hex(0, 0), hex(3, 0)]));
    expect(aimed).toHaveLength(2);
  });

  it('leaves every AI unit in a request some of its budget', () => {
    // A stage-one band is a hero and two wolves: three turns in a row.
    for (let seed = 0; seed < 4; seed++) {
      const run = createRun(seed);
      const s = run.fight;
      for (let request = 0; request < 10 && s.phase === 'fight'; request++) {
        const me = unit(s, s.awaiting!);
        applyTurn(s, me, chooseAiTurn(s, me));
        const budget = {left: AI.requestSimulations};
        const choose = requestChooser(budget);
        const given: number[] = [];
        advance(s, (state, u) => {
          given.push(budget.left);
          return choose(state, u);
        });
        expect(budget.left).toBeGreaterThanOrEqual(0);
        // Only a unit acting a second time may find the budget spent.
        expect(given.slice(0, 3).every((left) => left > 0)).toBe(true);
      }
    }
  });

  it('still picks a greedy turn, not a Hold, once a request’s budget is spent', () => {
    const s = opening();
    const me = unit(s, s.awaiting!);
    const budget = {left: 0};
    const input = requestChooser(budget)(s, me);
    const best = scoreOptions(s, me, AI.turnFloorSimulations).sort((a, b) => b.score - a.score)[0]!;
    expect(input).toEqual(best.input);
    expect(input).not.toEqual({action: {ability: 'hold'}});
    expect(budget.left).toBe(0);
  });
});

describe('valuing overwatch', () => {
  it('an Outrider with no shot watches the lane Temee is about to step into', () => {
    const kit = HEROES.mangudai.abilities;
    HEROES.mangudai.abilities = ['bow', 'overwatch', 'hold'];
    try {
      let tried = 0;
      for (const start of SALT_FLATS.hexes) {
        const s = setup({'p-camel': start, 'p-bokh': hex(-3, 7), 'e-mangudai': hex(0, 0)});
        const camel = unit(s, 'p-camel');
        const m = unit(s, 'e-mangudai');
        const step = stepToExit(s, mapOf(s), camel);
        if (!step || tileAt(SALT_FLATS, start) !== 'sand') continue;
        // An Outrider spot with no unit in any lane, one of them through Temee's next step.
        const spot = SALT_FLATS.hexes.find((h) => {
          if (tileAt(SALT_FLATS, h) !== 'sand' || hexDistance(h, start) < 2) return false;
          if (hexDistance(h, hex(-3, 7)) === 0) return false;
          m.hex = h;
          const lanes = arrowLanes(s, mapOf(s), h);
          return (
            lanes.every((l) => !l.hit) &&
            lanes.some((l) => l.hexes.some((x) => hexKey(x) === hexKey(step)))
          );
        });
        if (!spot) continue;
        tried++;
        m.hex = spot;
        // Temee walks before the Outrider's next turn, 6 slots on.
        s.currentSlot = 40;
        m.slot = 40;
        camel.slot = 42;
        unit(s, 'p-bokh').slot = 200;
        s.awaiting = m.id;
        const input = chooseAiTurn(s, m);
        expect(input.action.ability).toBe('overwatch');
        const lane = arrowLanes(s, mapOf(s), spot).find(
          (l) => l.hexes[0] && hexKey(l.hexes[0]) === hexKey(input.action.target!.hex!)
        )!;
        expect(lane.hexes.some((x) => hexKey(x) === hexKey(step))).toBe(true);
        if (tried >= 3) break;
      }
      expect(tried).toBeGreaterThan(0);
    } finally {
      HEROES.mangudai.abilities = kit;
    }
  });
});
