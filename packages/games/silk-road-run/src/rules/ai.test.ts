import {describe, expect, it} from 'vitest';
import {hexDistance} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {chooseAiTurn, evaluatePosition, requestChooser, scoreOptions, simulate} from './ai';
import type {SearchStats} from './ai';
import {ABILITY, AI, RULES} from './config';
import {ABILITIES} from './abilities';
import {advance, advanceToDecision, applyTurn, cloneFight, createFight, mapOf} from './fight';
import {createRun} from './run';
import {scaled} from './resolve';
import {threatsTo} from './threat';
import type {FightState, TurnInput} from './types';

const hex = (q: number, r: number): Hex => ({q, r});
const unit = (s: FightState, id: string) => s.units.find((u) => u.id === id)!;
const stats = (): SearchStats => ({completedDepth: 0, cutoffs: 0, work: 0});
function setup(placements: Record<string, Hex>): FightState {
  const s = createFight(0);
  // The fixed layout, which these tests place units around.
  delete s.tiles;
  s.phase = 'fight';
  // An unlisted camel isn't there at all: dead, it would lose the fight.
  s.units = s.units.filter((u) => u.hero !== 'camel' || u.id in placements);
  for (const u of s.units) {
    u.alive = u.id in placements;
    u.hex = placements[u.id] ?? null;
    u.slot = u.alive ? 100 + u.partyIndex : null;
    u.ultimateUsed = true;
  }
  return s;
}
/** A fight's first hero decision, after the camel's opening turns (it always acts first). */
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
      u.statuses = [{kind: 'immobilized', value: 0, untilSlot: 100}];
    }
    s.awaiting = me.id;
    const pruned = stats();
    const exhaustive = stats();
    const selected = chooseAiTurn(s, me, {left: AI.requestSimulations}, pruned);
    expect(chooseAiTurn(s, me, {left: AI.requestSimulations}, exhaustive, {prune: false})).toEqual(
      selected
    );
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
    // A binding taunt still permits the zero-work fallback.
    me.statuses.push({kind: 'taunted', value: 0, untilSlot: 100, source: 'e-bokh'});
    const copy = cloneFight(s);
    expect(() => applyTurn(copy, unit(copy, me.id), chooseAiTurn(s, me, {left: 0}))).not.toThrow();
  });

  it('avoids a lethal reply that the immediate heuristic overlooks', () => {
    // The Outrider's bow has no range limit (2026-10-20): it stands where
    // stepping off its lanes is still possible, beyond a Pin's step (2026-10-21).
    const s = setup({'e-bokh': hex(2, 0), 'p-bokh': hex(3, 0), 'p-mangudai': hex(-1, 3)});
    const me = unit(s, 'e-bokh');
    me.hp = 70;
    me.slot = 0;
    unit(s, 'p-mangudai').slot = 1;
    unit(s, 'p-bokh').slot = 2;
    s.awaiting = me.id;
    const greedy = scoreOptions(s, me, AI.rootSimulations).sort((a, b) => b.score - a.score)[0]!;
    expect(greedy.input.action).toMatchObject({ability: 'pin', target: {hex: hex(3, 0)}});
    const detail = stats();
    const selected = chooseAiTurn(s, me, {left: AI.requestSimulations}, detail, {depth: 2});
    expect(detail.completedDepth).toBe(2);
    // Walking and Pin can no longer share a turn. Check survival rather
    // than requiring the old move-and-Pin escape sequence.
    expect(selected).not.toEqual(greedy.input);
    const canBeKilled = (input: TurnInput): boolean => {
      const after = simulate(s, me.id, input, false, false)!;
      const reply = advanceToDecision(after)!;
      expect(reply.id).toBe('p-mangudai');
      // Check every legal reply, beyond the search's selective shortlist.
      return scoreOptions(after, reply).some((option) => {
        const position = cloneFight(option.position);
        advanceToDecision(position);
        return !unit(position, me.id).alive;
      });
    };
    expect(canBeKilled(greedy.input)).toBe(true);
    expect(canBeKilled(selected)).toBe(false);
  });

  it('plans a finishing attack with a consecutive ally instead of alternating teams', () => {
    const s = setup({
      'e-mangudai': hex(0, 0),
      'e-bokh': hex(2, 1),
      'p-bokh': hex(3, 0),
      'p-storm': hex(0, 1),
    });
    const me = unit(s, 'e-mangudai');
    me.slot = 0;
    me.statuses = [{kind: 'immobilized', value: 0, untilSlot: 100}];
    unit(s, 'e-bokh').slot = 1;
    unit(s, 'p-bokh').slot = 2;
    unit(s, 'p-bokh').hp = 170;
    unit(s, 'p-storm').slot = 3;
    unit(s, 'p-storm').hp = 30;
    s.awaiting = me.id;
    const greedy = scoreOptions(s, me).sort((a, b) => b.score - a.score)[0]!;
    expect(greedy.input.action.target?.hex).toEqual(hex(0, 1));
    const input = chooseAiTurn(s, me, {left: AI.requestSimulations}, stats(), {depth: 2});
    expect(input.action).toEqual({ability: 'bow', target: {hex: hex(3, 0)}});
    const flipped = cloneFight(s);
    for (const u of flipped.units) u.controller = u.side === 'enemy' ? 'human' : 'ai';
    expect(
      chooseAiTurn(flipped, unit(flipped, me.id), {left: AI.requestSimulations}, stats(), {
        depth: 2,
      })
    ).toEqual(input);
    applyTurn(s, me, input);
    const ally = advanceToDecision(s)!;
    expect(ally.id).toBe('e-bokh');
    const finish = scoreOptions(s, ally).find((o) => !unit(o.position, 'p-bokh').alive);
    expect(finish).toBeDefined();
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
    const after = simulate(s, me.id, input, false, false)!;
    expect(evaluatePosition(after, 'enemy')).toBe(AI.victory);
    expect(evaluatePosition(after, 'player')).toBe(-AI.victory);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('the search timeline', () => {
  it('separates preview damage from a charge and triggers the real charge only once', () => {
    const s = setup({'p-mangudai': hex(0, 0), 'e-bokh': hex(3, 0)});
    const me = unit(s, 'p-mangudai');
    me.slot = 0;
    me.ultimateUsed = false;
    me.ultimateCharge = RULES.ultimateCharge;
    s.awaiting = me.id;
    const option = scoreOptions(s, me).find(
      (o) =>
        o.input.action.ability === 'volley' &&
        o.input.action.target?.hex?.q === 3 &&
        o.input.action.target.hex.r === 0
    )!;
    expect(unit(option.position, 'e-bokh').hp).toBe(unit(s, 'e-bokh').hp);
    expect(unit(option.after, 'e-bokh').hp).toBeLessThan(unit(s, 'e-bokh').hp);
    const position = cloneFight(option.position);
    expect(advanceToDecision(position)?.id).toBe(me.id);
    expect(unit(position, me.id).charging).toBeNull();
    expect(unit(position, 'e-bokh').hp).toBe(unit(option.after, 'e-bokh').hp);
    const stopped = JSON.stringify(position);
    expect(advanceToDecision(position)?.id).toBe(me.id);
    expect(JSON.stringify(position)).toBe(stopped);
  });

  it('scores a charge as missing the units that act before it lands', () => {
    const s = setup({'p-mangudai': hex(0, 0), 'e-bokh': hex(3, 0)});
    const me = unit(s, 'p-mangudai');
    me.slot = 0;
    me.ultimateUsed = false;
    me.ultimateCharge = RULES.ultimateCharge;
    s.awaiting = me.id;
    // Its card comes before the Volley's: it can step out.
    unit(s, 'e-bokh').slot = 1;
    const option = scoreOptions(s, me).find(
      (o) =>
        o.input.action.ability === 'volley' &&
        o.input.action.target?.hex?.q === 3 &&
        o.input.action.target.hex.r === 0
    )!;
    expect(unit(option.after, 'e-bokh').hp).toBe(unit(s, 'e-bokh').hp);
    expect(unit(option.after, 'e-bokh').hex).toEqual(hex(3, 0));
  });

  it('reads an enemy charge with its own damage and area', () => {
    const s = setup({'e-storm': hex(0, 0), 'p-bokh': hex(3, 0)});
    const storm = unit(s, 'e-storm');
    // A Storm Caller charging a Volley: its power, the Volley's damage and area.
    storm.charging = {ability: 'volley', target: hex(3, 0)};
    const threat = threatsTo(s, mapOf(s), unit(s, 'p-bokh')).find((t) => t.enemyId === storm.id)!;
    const volley = scaled(ABILITY.volley.damage, storm.power);
    expect(threat.hexes.size).toBe(7);
    expect([...threat.hexes.values()].every((h) => h.ranged === volley)).toBe(true);
  });

  it('values a charge still pending at the search horizon, unless its target steps out first', () => {
    const s = setup({'e-storm': hex(0, 0), 'p-bokh': hex(3, 0)});
    const storm = unit(s, 'e-storm');
    const target = unit(s, 'p-bokh');
    storm.slot = 5;
    const idle = evaluatePosition(s, 'enemy');
    storm.charging = {ability: 'volley', target: hex(3, 0)};
    // The target's next card comes after the Volley lands: it is caught.
    target.slot = 10;
    const before = JSON.stringify(s);
    expect(evaluatePosition(s, 'enemy')).toBeGreaterThan(idle);
    expect(evaluatePosition(s, 'player')).toBeLessThan(-idle);
    expect(JSON.stringify(s)).toBe(before);
    // Its card comes first and it can move, so it is assumed to escape.
    target.slot = 1;
    expect(evaluatePosition(s, 'enemy')).toBe(idle);
  });

  it('lets a target escape before a pending Volley lands', () => {
    const s = setup({'p-mangudai': hex(0, 0), 'e-mangudai': hex(3, 0)});
    const me = unit(s, 'p-mangudai');
    const target = unit(s, 'e-mangudai');
    me.slot = 0;
    me.ultimateUsed = false;
    me.ultimateCharge = RULES.ultimateCharge;
    target.slot = 1;
    s.awaiting = me.id;
    const after = simulate(
      s,
      me.id,
      {action: {ability: 'volley', target: {hex: target.hex!}}},
      false,
      false
    )!;
    const runner = advanceToDecision(after)!;
    expect(runner.id).toBe(target.id);
    const escape = ABILITIES.leap
      .targets(after, mapOf(after), runner, runner.hex!)
      .find((t) => t.hex && hexDistance(t.hex, target.hex!) > ABILITY.volley.radius)!;
    const hp = runner.hp;
    applyTurn(after, runner, {action: {ability: 'leap', target: escape}});
    advanceToDecision(after);
    expect(unit(after, me.id).charging).toBeNull();
    expect(runner.hp).toBe(hp);
  });

  it('ticks damage and expires statuses before stopping for an AI decision, only once', () => {
    const s = setup({'e-mangudai': hex(0, 0), 'p-bokh': hex(3, 0)});
    const me = unit(s, 'e-mangudai');
    me.slot = 3;
    me.statuses = [
      {kind: 'crushed', value: 6, untilSlot: 2},
      {kind: 'immobilized', value: 0, untilSlot: 2},
    ];
    const hp = me.hp;
    expect(advanceToDecision(s)?.id).toBe(me.id);
    expect(s.currentSlot).toBe(3);
    expect(me.hp).toBeLessThan(hp);
    expect(me.statuses).toEqual([]);
    const stopped = JSON.stringify(s);
    expect(advanceToDecision(s)?.id).toBe(me.id);
    expect(JSON.stringify(s)).toBe(stopped);
  });

  it('never aims Sunlight at a hex with no unit and no hail', () => {
    const s = setup({'e-storm': hex(0, 0), 'p-bokh': hex(3, 0)});
    s.effects.push({
      kind: 'hail',
      hex: hex(1, 1),
      untilSlot: 999,
      damage: 50,
      slowed: 1,
      statusSlots: 10,
    });
    const me = unit(s, 'e-storm');
    me.slot = 0;
    const aimed = scoreOptions(s, me)
      .filter((o) => o.input.action.ability === 'sunlight' && !o.input.move)
      .map((o) => o.input.action.target!.hex!);
    expect(aimed).toContainEqual(hex(0, 0));
    expect(aimed).toContainEqual(hex(1, 1));
    expect(aimed).toContainEqual(hex(3, 0));
    expect(aimed).toHaveLength(3);
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
});
