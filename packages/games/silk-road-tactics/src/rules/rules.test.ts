import {describe, expect, it} from 'vitest';
import {hexDistance, offsetToHex} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, AI, RULES} from './config';
import {isFlanked, lineOfFire, movementCap, reachableHexes, unitAt, vulnerablePercent} from './board';
import {ABILITIES} from './abilities';
import {chooseAiTurn, scoreOptions, simulate} from './ai';
import {RuleError, actingUnit, advance, applyTurn, cloneFight, createFight, defaultDeployment, deploy, mapOf} from './fight';
import {previewTurn} from './preview';
import {abilityDamage} from './resolve';
import {createRun, handleRunAction, runView} from './run';
import {freeSlotFrom, nextCard, placeCard, simultaneousOrder, slotsForward, turnCost} from './track';
import type {FightState, TurnInput, Unit} from './types';

const at = (col: number, row: number): Hex => offsetToHex({col, row});

/**
 * A fight in progress with units where a test wants them: every unit not
 * listed is removed (dead), and cards start far apart.
 */
function setup(placements: Record<string, Hex>): FightState {
  const state = createFight(0);
  state.phase = 'fight';
  let slot = 100;
  for (const u of state.units) {
    const h = placements[u.id];
    if (h) {
      u.hex = h;
      u.slot = slot;
      slot += 50;
    } else {
      u.alive = false;
      u.hex = null;
      u.slot = null;
    }
  }
  state.currentSlot = 0;
  return state;
}

const unit = (s: FightState, id: string): Unit => s.units.find((u) => u.id === id)!;

describe('the track', () => {
  it('places by cost ÷ (speed + C), rounding down, at least 1 slot (3.2)', () => {
    // The brief's worked example: speed 4, 2 hexes and a typical attack.
    expect(slotsForward(turnCost(100, 2), 4)).toBe(12);
    expect(slotsForward(turnCost(100, 2), 7)).toBe(9);
    expect(slotsForward(1, 10)).toBe(1);
  });

  it('yields to the next free slot, cascading; placed cards never move (3.3)', () => {
    const s = setup({'p-bokh': at(0, 0), 'p-storm': at(0, 1), 'e-bokh': at(8, 0)});
    unit(s, 'p-storm').slot = 10;
    unit(s, 'e-bokh').slot = 11;
    expect(placeCard(s, unit(s, 'p-bokh'), 10)).toBe(12);
    expect(unit(s, 'p-storm').slot).toBe(10);
    expect(unit(s, 'e-bokh').slot).toBe(11);
    expect(freeSlotFrom(s, 9)).toBe(9);
  });

  it('orders simultaneous placement: speed, then sides alternating from the player, then party order', () => {
    const s = createFight(0);
    const order = simultaneousOrder(s.units).map((u) => u.id);
    // Outriders are fastest; the others tie, so they alternate sides.
    expect(order).toEqual(['p-mangudai', 'e-mangudai', 'p-bokh', 'e-bokh', 'p-storm', 'e-storm']);
  });

  it('starts every card from the starting cost, without two in one slot (3.4)', () => {
    const s = createFight(1);
    deploy(s, defaultDeployment(s));
    const slots = s.units.map((u) => u.slot);
    expect(new Set(slots).size).toBe(6);
    expect(unit(s, 'p-mangudai').slot).toBe(Math.floor(RULES.startCost / (unit(s, 'p-mangudai').speed + RULES.C)));
  });

  it('expires a status after the slot it ends on, so it covers that turn (3.9)', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-bokh': at(7, 5)});
    const b = unit(s, 'p-bokh');
    b.statuses.push({kind: 'slowed', value: 2, untilSlot: 100});
    b.slot = 100;
    unit(s, 'e-bokh').slot = 200;
    advance(s, chooseAiTurn);
    expect(s.awaiting).toBe('p-bokh');
    expect(movementCap(b)).toBe(RULES.movementCap - 2);
    applyTurn(s, b, {action: {ability: 'hold'}});
    unit(s, 'e-bokh').alive = false; // stop the track at Bökh's next card
    s.phase = 'fight';
    advance(s, chooseAiTurn);
    expect(b.statuses).toHaveLength(0);
  });

  it('charges, triggers when the card is reached, then recovers (3.7)', () => {
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(5, 1), 'e-storm': at(7, 6)});
    const m = unit(s, 'p-mangudai');
    m.turnsTaken = RULES.ultimateUnlockTurns;
    s.currentSlot = 100;
    s.awaiting = m.id;
    const target = unitAt(s, at(5, 1))!.hex!;
    applyTurn(s, m, {action: {ability: 'volley', target: {hex: target}}});
    expect(m.charging).not.toBeNull();
    expect(m.slot).toBe(100 + slotsForward(ABILITY.volley.chargeCost, m.speed));
    const hpBefore = unit(s, 'e-bokh').hp;
    // Bökh's card is at 150, after the charge triggers.
    unit(s, 'e-bokh').slot = 500;
    unit(s, 'e-storm').slot = 600;
    advance(s, () => ({action: {ability: 'hold'}}));
    expect(unit(s, 'e-bokh').hp).toBeLessThan(hpBefore);
    expect(m.charging).toBeNull();
    expect(m.ultimateUsed).toBe(true);
  });

  it('keeps the ultimate locked until enough turns are taken', () => {
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(5, 1)});
    const m = unit(s, 'p-mangudai');
    expect(() => applyTurn(cloneFight(s), unit(cloneFight(s), m.id), {action: {ability: 'volley', target: {hex: at(5, 1)}}})).toThrow(RuleError);
  });
});

describe('the board', () => {
  it('passes allies, is blocked by enemies and obstacles, never ends on a unit', () => {
    const s = setup({'p-bokh': at(0, 3), 'p-storm': at(1, 3), 'e-bokh': at(1, 2)});
    const reach = reachableHexes(s, mapOf(s), unit(s, 'p-bokh'));
    const keys = reach.map((r) => `${r.hex.q},${r.hex.r}`);
    const key = (h: Hex) => `${h.q},${h.r}`;
    expect(keys).not.toContain(key(at(1, 3))); // ally's hex
    expect(keys).not.toContain(key(at(1, 2))); // enemy
    expect(keys).not.toContain(key(at(3, 2))); // ruins
    expect(keys).toContain(key(at(2, 3))); // through the ally
    expect(reach.every((r) => r.path.length <= RULES.movementCap)).toBe(true);
  });

  it('can’t move while Immobilized, and moves less while Slowed', () => {
    const s = setup({'p-bokh': at(0, 3), 'e-bokh': at(8, 3)});
    const b = unit(s, 'p-bokh');
    b.statuses.push({kind: 'slowed', value: 9, untilSlot: 999});
    expect(movementCap(b)).toBe(1);
    b.statuses.push({kind: 'immobilized', value: 0, untilSlot: 999});
    expect(reachableHexes(s, mapOf(s), b)).toHaveLength(1);
    expect(() => applyTurn(s, b, {move: [at(1, 3)], action: {ability: 'hold'}})).toThrow(RuleError);
  });

  it('flanks a unit between two hostile units opposite each other (6.3)', () => {
    const center = at(4, 3);
    const s = setup({'e-bokh': center, 'p-bokh': at(3, 3), 'p-storm': at(5, 3)});
    expect(isFlanked(s, unit(s, 'e-bokh'))).toBe(true);
    expect(vulnerablePercent(s, unit(s, 'e-bokh'))).toBe(RULES.flankVulnerable);
    unit(s, 'p-storm').hex = at(5, 2);
    expect(isFlanked(s, unit(s, 'e-bokh'))).toBe(false);
  });

  it('blocks line of fire on a unit or ruins, and along a border if either hex is taken (6.7, rule 29)', () => {
    const s = setup({'p-mangudai': at(0, 0), 'p-bokh': at(8, 6), 'e-bokh': at(0, 6)});
    const map = mapOf(s);
    const b = unit(s, 'p-bokh');
    expect(lineOfFire(s, map, at(0, 0), at(2, 0)).clear).toBe(true);
    b.hex = at(1, 0);
    expect(lineOfFire(s, map, at(0, 0), at(2, 0))).toMatchObject({clear: false, blocker: b});
    // Ruins at (3,2) sit on the line from (2,2) to (4,2).
    expect(lineOfFire(s, map, at(2, 2), at(4, 2)).clear).toBe(false);
    // From o to o + (1,1) the line runs along the border of o + (1,0) and o + (0,1).
    const o = at(1, 1);
    const t = {q: o.q + 1, r: o.r + 1};
    b.hex = at(8, 6);
    expect(lineOfFire(s, map, o, t).clear).toBe(true);
    b.hex = {q: o.q + 1, r: o.r};
    expect(lineOfFire(s, map, o, t).clear).toBe(false);
    b.hex = {q: o.q, r: o.r + 1};
    expect(lineOfFire(s, map, o, t).clear).toBe(false);
  });
});

describe('damage', () => {
  it('scales by power, then Vulnerable, then defence, rounding down each step; minimum 1', () => {
    const s = setup({'p-mangudai': at(0, 3), 'e-bokh': at(6, 6)});
    const m = unit(s, 'p-mangudai');
    const b = unit(s, 'e-bokh');
    const base = 60;
    const scaled = Math.floor(base * (1 + m.power / 50));
    const expected = Math.floor((scaled * RULES.defenceConstant) / (b.defence + RULES.defenceConstant));
    expect(abilityDamage(s, mapOf(s), m, b, base, false)).toBe(expected);
    b.statuses.push({kind: 'vulnerable', value: 25, untilSlot: 999});
    const vuln = Math.floor(scaled * 1.25);
    expect(abilityDamage(s, mapOf(s), m, b, base, false)).toBe(
      Math.floor((vuln * RULES.defenceConstant) / (b.defence + RULES.defenceConstant))
    );
    b.defence = 1_000_000;
    expect(abilityDamage(s, mapOf(s), m, b, base, false)).toBe(1);
  });

  it('halves ranged damage on conceal', () => {
    const s = setup({'p-mangudai': at(0, 2), 'e-bokh': at(4, 2)});
    const m = unit(s, 'p-mangudai');
    const b = unit(s, 'e-bokh');
    const onConceal = abilityDamage(s, mapOf(s), m, b, 60, true);
    b.hex = at(4, 0);
    const inOpen = abilityDamage(s, mapOf(s), m, b, 60, true);
    expect(onConceal).toBeLessThan(inOpen);
    expect(abilityDamage(s, mapOf(s), m, b, 60, false)).toBe(inOpen);
  });

  it('deals collision damage to both units when a displace is stopped', () => {
    const s = setup({'p-storm': at(2, 1), 'e-bokh': at(3, 1), 'e-storm': at(4, 1)});
    const before = [unit(s, 'e-bokh').hp, unit(s, 'e-storm').hp];
    applyTurn(s, unit(s, 'p-storm'), {action: {ability: 'gale', target: {hex: at(3, 1)}}});
    expect(unit(s, 'e-bokh').hex).toEqual(at(3, 1));
    expect(unit(s, 'e-bokh').hp).toBe(before[0]! - RULES.collisionDamage);
    expect(unit(s, 'e-storm').hp).toBe(before[1]! - RULES.collisionDamage);
  });

  it('hurts a unit entering quicksand', () => {
    const s = setup({'p-bokh': at(2, 3), 'e-bokh': at(8, 0)});
    const b = unit(s, 'p-bokh');
    applyTurn(s, b, {move: [at(3, 3)], action: {ability: 'hold'}});
    expect(b.hp).toBe(b.maxHp - RULES.hazardDamage);
  });
});

describe('abilities', () => {
  it('the bow hits the first unit on its line, never past an ally', () => {
    const s = setup({'p-mangudai': at(0, 0), 'p-bokh': at(1, 0), 'e-bokh': at(3, 0), 'e-storm': at(0, 6)});
    const m = unit(s, 'p-mangudai');
    const targets = ABILITIES.bow.targets(s, mapOf(s), m, m.hex!);
    expect(targets.some((t) => t.hex!.q === unit(s, 'e-bokh').hex!.q && t.hex!.r === unit(s, 'e-bokh').hex!.r)).toBe(false);
    unit(s, 'p-bokh').hex = at(0, 1);
    expect(ABILITIES.bow.targets(s, mapOf(s), m, m.hex!).length).toBeGreaterThan(0);
  });

  it('Pin then Throw: the target lands where chosen, still Immobilized', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1), 'e-bokh': at(8, 6)});
    const b = unit(s, 'p-bokh');
    applyTurn(s, b, {action: {ability: 'pin', target: {hex: at(2, 1)}}});
    expect(unit(s, 'e-storm').statuses.some((x) => x.kind === 'immobilized')).toBe(true);
    applyTurn(s, b, {action: {ability: 'throw', target: {hex: at(2, 1), to: at(0, 1)}}});
    expect(unit(s, 'e-storm').hex).toEqual(at(0, 1));
    expect(unit(s, 'e-storm').statuses.some((x) => x.kind === 'immobilized')).toBe(true);
  });

  it('Rampage hits each unit once and knocks it aside', () => {
    const s = setup({'p-bokh': at(1, 0), 'e-bokh': at(3, 0), 'e-storm': at(2, 1), 'e-mangudai': at(8, 6)});
    const b = unit(s, 'p-bokh');
    b.turnsTaken = RULES.ultimateUnlockTurns;
    const hp = [unit(s, 'e-bokh').hp, unit(s, 'e-storm').hp];
    applyTurn(s, b, {action: {ability: 'rampage', target: {hex: at(2, 0)}}});
    expect(unit(s, 'e-bokh').hp).toBeLessThan(hp[0]!);
    expect(unit(s, 'e-storm').hp).toBeLessThan(hp[1]!);
    expect(hexDistance(b.hex!, at(1, 0))).toBeGreaterThan(0);
    expect(unitAt(s, b.hex!)).toBe(b);
  });

  it('Clear the Storm heals and cleanses allies only', () => {
    const s = setup({'p-storm': at(1, 3), 'p-bokh': at(1, 2), 'e-bokh': at(2, 3), 'e-mangudai': at(8, 6)});
    unit(s, 'p-bokh').hp = 100;
    unit(s, 'p-bokh').statuses.push({kind: 'slowed', value: 2, untilSlot: 999});
    unit(s, 'e-bokh').hp = 100;
    applyTurn(s, unit(s, 'p-storm'), {action: {ability: 'clearStorm'}});
    expect(unit(s, 'p-bokh').hp).toBeGreaterThan(100);
    expect(unit(s, 'p-bokh').statuses).toHaveLength(0);
    expect(unit(s, 'e-bokh').hp).toBe(100);
  });

  it('hail slows and exposes whoever stands on it', () => {
    const s = setup({'p-storm': at(1, 3), 'e-bokh': at(3, 1), 'e-mangudai': at(8, 6)});
    applyTurn(s, unit(s, 'p-storm'), {action: {ability: 'hail', target: {hex: at(3, 1)}}});
    expect(movementCap(unit(s, 'e-bokh'))).toBe(RULES.movementCap - ABILITY.hail.slowed);
    expect(s.effects).toHaveLength(1);
  });
});

describe('previews, the AI and the run', () => {
  it('a preview matches the outcome', () => {
    const run = handleRunAction(createRun(3), {type: 'deploy', placements: defaultDeployment(createRun(3).fight)});
    const acting = actingUnit(run.fight)!;
    const reach = reachableHexes(run.fight, mapOf(run.fight), acting);
    const input: TurnInput = {move: reach[reach.length - 1]!.path, action: {ability: 'hold'}};
    const preview = previewTurn(run.fight, acting.id, input)!;
    const after = cloneFight(run.fight);
    applyTurn(after, after.units.find((u) => u.id === acting.id)!, input);
    expect(preview.slot).toBe(after.units.find((u) => u.id === acting.id)!.slot);
    for (const c of preview.changes) {
      const u = after.units.find((x) => x.id === c.unitId)!;
      expect(u.hp).toBe(c.hpAfter);
      expect(u.hex).toEqual(c.to);
    }
  });

  it('is deterministic: the same seed and actions give the same fight', () => {
    const play = () => {
      let run = createRun(7);
      run = handleRunAction(run, {type: 'deploy', placements: defaultDeployment(run.fight)});
      for (let i = 0; i < 5 && run.fight.phase === 'fight'; i++) {
        run = handleRunAction(run, {type: 'turn', action: {ability: 'hold'}});
      }
      return run;
    };
    expect(JSON.stringify(play())).toEqual(JSON.stringify(play()));
  });

  it('never puts the seed in the view', () => {
    const run = createRun(123456789);
    const view = JSON.stringify(runView(run));
    expect(view).not.toContain('seed');
    expect(view).not.toContain('123456789');
  });

  it('plays a whole fight to an end, AI against AI, within the CPU budget per turn', () => {
    // Seed 0 with the default deployment ends. Some fights stall once only
    // Storm Callers can act (no damage to finish with): an open question,
    // see phase-1-brief.md section 11.
    let run = createRun(0);
    run = handleRunAction(run, {type: 'deploy', placements: defaultDeployment(run.fight)});
    let worst = 0;
    for (let turns = 0; turns < 300 && run.fight.phase === 'fight'; turns++) {
      const me = actingUnit(run.fight)!;
      const t0 = performance.now();
      const input = chooseAiTurn(run.fight, me);
      worst = Math.max(worst, performance.now() - t0);
      run = handleRunAction(run, {type: 'turn', ...input});
    }
    expect(['won', 'lost']).toContain(run.fight.phase);
    // Generous for a test machine; the Worker's limit is 10 ms per request.
    expect(worst).toBeLessThan(200);
  });

  it('caps the AI’s search per request, deterministically', () => {
    let run = createRun(0);
    run = handleRunAction(run, {type: 'deploy', placements: defaultDeployment(run.fight)});
    const enemy = run.fight.units.find((u) => u.side === 'enemy')!;
    expect(scoreOptions(run.fight, enemy, 10)).toHaveLength(10);
    const budget = {left: AI.requestSimulations};
    const first = chooseAiTurn(run.fight, enemy, budget);
    expect(budget.left).toBeLessThan(AI.requestSimulations);
    expect(AI.requestSimulations - budget.left).toBeLessThanOrEqual(AI.maxSimulations);
    // An exhausted budget still allows the minimum search, and the same budget gives the same choice.
    const starved = {left: 0};
    chooseAiTurn(run.fight, enemy, starved);
    expect(-starved.left).toBeLessThanOrEqual(AI.minSimulations);
    expect(chooseAiTurn(run.fight, enemy, {left: AI.requestSimulations})).toEqual(first);
  });

  it('refuses a turn that isn’t legal without changing the run', () => {
    let run = createRun(1);
    run = handleRunAction(run, {type: 'deploy', placements: defaultDeployment(run.fight)});
    const before = JSON.stringify(run);
    expect(() => handleRunAction(run, {type: 'turn', action: {ability: 'rampage', target: {hex: {q: 99, r: 99}}}})).toThrow(RuleError);
    expect(JSON.stringify(run)).toBe(before);
    expect(simulate(run.fight, actingUnit(run.fight)!.id, {action: {ability: 'bow', target: {hex: {q: 99, r: 99}}}})).toBeNull();
    expect(nextCard(run.fight)).toBeDefined();
  });
});
