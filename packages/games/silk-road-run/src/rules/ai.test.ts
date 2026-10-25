import {describe, expect, it} from 'vitest';
import {hexDistance, hexKey} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {chooseAiTurn, evaluatePosition, scoreOptions, simulate} from './ai';
import type {SearchStats} from './ai';
import {AI, HEROES, RULES} from './config';
import {advance, advanceToDecision, applyTurn, cloneFight, createFight} from './fight';
import {createRun} from './run';
import {SALT_FLATS} from './map';
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
    const selected = chooseAiTurn(s, me, {left: AI.maxSimulations}, pruned, {depth: 2});
    const reference = chooseAiTurn(s, me, {left: AI.maxSimulations}, exhaustive, {
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
    // Longshot alone: a second attack would make the tree too big to search exhaustively.
    const kit = HEROES.mangudai.abilities;
    HEROES.mangudai.abilities = ['longshot', 'hold'];
    let selected: TurnInput;
    try {
      selected = chooseAiTurn(s, me, {left: AI.maxSimulations}, pruned);
      expect(chooseAiTurn(s, me, {left: AI.maxSimulations}, exhaustive, {prune: false})).toEqual(
        selected
      );
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
    const expected = chooseAiTurn(s, me, {left: AI.maxSimulations}, completed, {depth: 2});
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
    const selected = chooseAiTurn(s, me, {left: AI.maxSimulations}, detail, {depth: 2});
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
    const input = chooseAiTurn(s, me, {left: AI.maxSimulations}, detail, {depth: 2});
    expect(input.action.ability).toBe('bite');
    expect(detail.completedDepth).toBe(2);
    expect(detail.value).toBeGreaterThanOrEqual(AI.victory);
  });

  it('closes in on Temee once no hero is within a walk and a hit', () => {
    // Opposite edges of the hexagon, 8 apart (on this board's own spaces).
    const wolf: Hex = {q: 4, r: -2};
    const temee: Hex = {q: -4, r: 4};
    const cases = SALT_FLATS.hexes.filter((h) => !SALT_FLATS.tiles[hexKey(h)]);
    // Nearer than Temee either way: in reach (a walk of 2 and a bite), or not.
    const near = cases.find((h) => hexDistance(h, wolf) === 2 && hexDistance(h, temee) > 6)!;
    const far = cases.find((h) => hexDistance(h, wolf) === 5 && hexDistance(h, temee) > 6)!;
    const closesOn = (hero: Hex) => {
      const s = setup({'e-wolf': wolf, 'p-bokh': hero, 'p-camel': temee}, ['wolf']);
      const me = unit(s, 'e-wolf');
      me.slot = 0;
      unit(s, 'p-bokh').slot = 1;
      unit(s, 'p-camel').slot = 2;
      s.awaiting = me.id;
      return chooseAiTurn(s, me).move?.at(-1) ?? wolf;
    };
    expect(hexDistance(closesOn(far), temee)).toBe(hexDistance(wolf, temee) - RULES.movementCap);
    // In reach, the hero is the one to fight: the wolf waits for it, not
    // leaving it for Temee (since 2026-10-24 it may wait a step nearer
    // Temee, the hero no further off).
    expect(hexDistance(closesOn(near), near)).toBeLessThanOrEqual(hexDistance(wolf, near));
  });

  it('goes for the Champion grappling an ally, rather than Holding behind it', () => {
    const rescue = (from: Hex) => {
      const s = setup(
        {'p-bokh': hex(0, 0), 'p-mangudai': hex(-4, 4), 'e-wolf': hex(1, 0), 'e-wolf-2': from},
        ['wolf', 'wolf']
      );
      // On open ground: the fixed yurts sit beside the Champion on this board.
      s.tiles = {};
      const held = unit(s, 'e-wolf');
      held.statuses = [{kind: 'stunned', grapple: {champion: 'p-bokh', target: held.id}}];
      const me = unit(s, 'e-wolf-2');
      me.slot = 0;
      unit(s, 'p-bokh').slot = 1;
      unit(s, 'p-mangudai').slot = 2;
      held.slot = 3;
      s.awaiting = me.id;
      return chooseAiTurn(s, me);
    };
    // Behind its packmate, out of reach: it walks up to the Champion...
    const end = rescue(hex(2, 0)).move?.at(-1);
    expect(end && hexDistance(end, hex(0, 0))).toBe(1);
    // ...and next to it, bites it, which breaks the grapple.
    expect(rescue(hex(0, 1)).action).toEqual({ability: 'bite', target: {hex: hex(0, 0)}});
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
    const s = setup({'e-storm': hex(0, 0), 'p-bokh': hex(2, 0), 'p-mangudai': hex(4, 0)});
    const me = unit(s, 'e-storm');
    me.slot = 0;
    const aimed = scoreOptions(s, me)
      .filter((o) => o.input.action.ability === 'hail')
      .map((o) => o.input.action.target!.hex!);
    // Hail lands only on its ring, 2 away: the Champion, not the Outrider or itself.
    expect(aimed).toEqual([hex(2, 0)]);
  });

  it('plays the turns it guesses best first, so a reply’s few tries include its best', () => {
    for (let seed = 0; seed < 4; seed++) {
      const run = createRun(seed);
      const s = run.fight;
      for (let request = 0; request < 12 && s.phase === 'fight'; request++) {
        const me = unit(s, s.awaiting!);
        const all = scoreOptions(s, me, Infinity, undefined, false);
        const best = Math.max(...all.map((o) => o.score));
        const tried = scoreOptions(s, me, AI.replySimulations, undefined, false);
        expect(Math.max(...tried.map((o) => o.score))).toBe(best);
        applyTurn(s, me, chooseAiTurn(s, me));
        advanceToDecision(s);
      }
    }
  });
});
