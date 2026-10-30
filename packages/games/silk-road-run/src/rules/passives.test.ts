// The passives (progression.md, 19.8), each given here by loadout: no hero
// carries one yet.
import {describe, expect, it} from 'vitest';
import {hexNeighbor} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {PARTY, RULES, SPEARHEAD} from './config';
import {reachableHexes, isStunned, invalidPath} from './board';
import {advanceToDecision, applyTurn, cloneFight, createFight, makeUnit, mapOf} from './fight';
import {STEPPE} from './map';
import {delay, haste, hit, stun} from './resolve';
import type {Ctx} from './resolve';
import {parseTestStage} from './testStage';
import {PASSIVES} from './passives';
import {actionCost} from './track';
import type {AbilityId, ActionTarget, FightState, PassiveId, Unit} from './types';

const centre: Hex = {q: 0, r: 0};
/** `n` spaces from `from` along direction `dir`. */
const out = (dir: number, n: number, from: Hex = centre): Hex => {
  let h = from;
  for (let i = 0; i < n; i++) h = hexNeighbor(h, dir);
  return h;
};

/** Units where the test wants them, on open sand, the rest dead; cards far apart. */
function setup(placements: Record<string, Hex>): FightState {
  const state = createFight(0, PARTY, PARTY);
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
const ctxOf = (s: FightState): Ctx => ({state: s, map: mapOf(s), slot: s.currentSlot});

function give(s: FightState, id: string, ...passives: PassiveId[]): Unit {
  const u = unit(s, id);
  u.passives = passives;
  return u;
}

/** `id`'s turn now, its card on the current slot, taking `ability` (in its kit) on `target`. */
function act(s: FightState, id: string, ability: AbilityId, target: ActionTarget = {}) {
  const u = unit(s, id);
  u.slot = s.currentSlot;
  u.loadout = {abilities: [ability, 'hold']};
  applyTurn(s, u, {action: {ability, target}});
}

describe('the passives: the track', () => {
  it('Steady Gait: its card is neither Delayed nor Hastened', () => {
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 3)});
    const u = give(s, 'p-bokh', 'steadyGait');
    delay(ctxOf(s), u, 3);
    haste(ctxOf(s), u, 3);
    expect(u.slot).toBe(100);
    const other = unit(s, 'e-bokh');
    haste(ctxOf(s), other, 3);
    expect(other.slot).toBe(247);
  });

  it('Second Wind: Hastened 2 the first time at half health or less', () => {
    const s = setup({'p-bokh': centre, 'e-mangudai': out(0, 3)});
    const u = give(s, 'p-bokh', 'secondWind');
    const archer = unit(s, 'e-mangudai');
    archer.power = 3;
    hit(ctxOf(s), archer, u, 'The arrow');
    expect(u.hp).toBe(u.maxHp - 3);
    expect(u.slot).toBe(100);
    archer.power = 1;
    hit(ctxOf(s), archer, u, 'The arrow');
    expect(u.hp * 2).toBeLessThanOrEqual(u.maxHp);
    expect(u.slot).toBe(98);
    hit(ctxOf(s), archer, u, 'The arrow');
    expect(u.slot).toBe(98);
  });

  it('Patient: a turn without moving or an ability goes 2 fewer slots on', () => {
    const s = setup({'p-bokh': centre, 'p-storm': out(3, 3), 'e-bokh': out(0, 3)});
    give(s, 'p-bokh', 'patient');
    act(s, 'p-bokh', 'hold');
    expect(unit(s, 'p-bokh').slot).toBe(actionCost(unit(s, 'p-bokh')) - 2);
    act(s, 'p-storm', 'hold');
    expect(unit(s, 'p-storm').slot).toBe(actionCost(unit(s, 'p-storm')));
  });

  it('Momentum: Hastened 1 after a turn that takes a unit off the board', () => {
    const s = setup({'p-mangudai': centre, 'e-storm': out(0, 2), 'e-bokh': out(3, 2)});
    give(s, 'p-mangudai', 'momentum');
    unit(s, 'e-storm').hp = 1;
    act(s, 'p-mangudai', 'snapShot', {hex: out(0, 2)});
    expect(unit(s, 'e-storm').alive).toBe(false);
    expect(unit(s, 'p-mangudai').slot).toBe(actionCost(unit(s, 'p-mangudai')) - 1);
    act(s, 'p-mangudai', 'snapShot', {hex: out(3, 2)});
    expect(unit(s, 'p-mangudai').slot).toBe(actionCost(unit(s, 'p-mangudai')));
  });
});

describe('the passives: the board', () => {
  it('Rooted: not Pushed or Pulled, but still Moved', () => {
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 1)});
    give(s, 'e-bokh', 'rooted');
    act(s, 'p-bokh', 'shove', {hex: out(0, 1)});
    expect(unit(s, 'e-bokh').hex).toEqual(out(0, 1));
    // Grappled, then thrown: Moved.
    act(s, 'p-bokh', 'grapple', {hex: out(0, 1)});
    act(s, 'p-bokh', 'grapple', {hex: out(1, 1)});
    expect(unit(s, 'e-bokh').hex).toEqual(out(1, 1));
  });

  it('Light Step: walks through allies and may swap places with one', () => {
    const s = setup({'p-bokh': centre, 'p-storm': out(0, 1), 'e-bokh': out(3, 1)});
    const u = unit(s, 'p-bokh');
    const map = mapOf(s);
    const has = (h: Hex) =>
      reachableHexes(s, map, u).some((r) => r.hex.q === h.q && r.hex.r === h.r);
    expect(has(out(0, 2))).toBe(false);
    expect(has(out(0, 1))).toBe(false);
    give(s, 'p-bokh', 'lightStep');
    expect(has(out(0, 2))).toBe(true);
    expect(has(out(0, 1))).toBe(true);
    // Enemies still block.
    expect(has(out(3, 1))).toBe(false);
    expect(invalidPath(s, map, u, [out(3, 1)])).toBe('Units block that path.');
    // The swap: the ally goes to the space the walk came from.
    u.slot = 0;
    applyTurn(s, u, {move: [out(0, 1)], action: {ability: 'hold'}});
    expect(u.hex).toEqual(out(0, 1));
    expect(unit(s, 'p-storm').hex).toEqual(centre);
  });

  it('Rebound: Pushed, it Pushes each unit next to where it ends 1 away', () => {
    const end = out(0, 1);
    const s = setup({
      'p-bokh': out(3, 2),
      'e-bokh': out(3, 1),
      'e-storm': out(1, 1, end),
      'p-storm': out(5, 1, end),
    });
    give(s, 'e-bokh', 'rebound');
    act(s, 'p-bokh', 'shove', {hex: out(3, 1)});
    expect(unit(s, 'e-bokh').hex).toEqual(end);
    // Both its new neighbours, its own ally among them, moved 1 straight away from it.
    expect(unit(s, 'e-storm').hex).toEqual(out(1, 2, end));
    expect(unit(s, 'p-storm').hex).toEqual(out(5, 2, end));
  });
});

describe('the passives: damage and survival', () => {
  it('Hardened: Armour 1 against the first hit each fight', () => {
    const s = setup({'p-bokh': centre, 'e-mangudai': out(0, 3)});
    const u = give(s, 'p-bokh', 'hardened');
    const archer = unit(s, 'e-mangudai');
    hit(ctxOf(s), archer, u, 'The arrow');
    expect(u.hp).toBe(u.maxHp - 1);
    hit(ctxOf(s), archer, u, 'The arrow');
    expect(u.hp).toBe(u.maxHp - 3);
  });

  it('a copy of the fight (a preview, the AI’s search) spends its own once-a-fight passives', () => {
    const s = setup({'p-bokh': centre, 'p-storm': out(0, 1), 'e-mangudai': out(0, 4)});
    give(s, 'p-bokh', 'hardened', 'bulwark');
    unit(s, 'p-bokh').spent = [];
    unit(s, 'p-bokh').coveredAt = {};
    const copy = cloneFight(s);
    hit(ctxOf(copy), unit(copy, 'e-mangudai'), unit(copy, 'p-bokh'), 'The arrow');
    hit(ctxOf(copy), unit(copy, 'e-mangudai'), unit(copy, 'p-storm'), 'The arrow');
    expect(unit(copy, 'p-bokh').spent).toEqual(['hardened']);
    expect(unit(s, 'p-bokh').spent).toEqual([]);
    expect(unit(s, 'p-bokh').coveredAt).toEqual({});
  });

  it('Last Stand: left at 1 health the first time it would fall, Delayed `RULES.durations.stun`', () => {
    const s = setup({'p-mangudai': centre, 'e-bokh': out(0, 3)});
    const u = give(s, 'p-mangudai', 'lastStand');
    const foe = unit(s, 'e-bokh');
    foe.power = 10;
    const before = u.slot!;
    hit(ctxOf(s), foe, u, 'The blow');
    expect(u.alive).toBe(true);
    expect(u.hp).toBe(1);
    expect(isStunned(u)).toBe(false);
    expect(u.slot).toBe(before + RULES.durations.stun);
    hit(ctxOf(s), foe, u, 'The blow');
    expect(u.alive).toBe(false);
  });

  it('Piercing Eye: its attacks Pierce against an Immobilized or Stunned unit', () => {
    const s = setup({'p-mangudai': centre, 'e-bokh': out(0, 3)});
    const archer = give(s, 'p-mangudai', 'piercingEye');
    const target = give(s, 'e-bokh', 'hardened');
    stun(ctxOf(s), target, {kind: 'stunned'});
    hit(ctxOf(s), archer, target, 'The arrow');
    expect(target.hp).toBe(target.maxHp - archer.power);
  });

  it('Bulwark: an ally next to it takes 1 less of its first hit, the Bulwark 1', () => {
    const s = setup({'p-bokh': centre, 'p-storm': out(0, 1), 'e-mangudai': out(0, 4)});
    const guard = give(s, 'p-bokh', 'bulwark');
    const ally = unit(s, 'p-storm');
    const archer = unit(s, 'e-mangudai');
    hit(ctxOf(s), archer, ally, 'The arrow');
    expect(ally.hp).toBe(ally.maxHp - archer.power + 1);
    expect(guard.hp).toBe(guard.maxHp - 1);
    hit(ctxOf(s), archer, ally, 'The arrow');
    expect(ally.hp).toBe(ally.maxHp - 2 * archer.power + 1);
    expect(guard.hp).toBe(guard.maxHp - 1);
  });

  it('Opportunist: 1 more to a unit whose card is behind its own next card', () => {
    const s = setup({'p-mangudai': centre, 'e-bokh': out(0, 3)});
    const archer = give(s, 'p-mangudai', 'opportunist');
    const target = unit(s, 'e-bokh');
    s.currentSlot = 10;
    // Its turn now, its card landing its cost on: a card behind that, 1 more.
    archer.slot = 10;
    target.slot = 10 + actionCost(archer) + 1;
    hit(ctxOf(s), archer, target, 'The arrow');
    expect(target.hp).toBe(target.maxHp - archer.power - 1);
    // A card before it: no more.
    target.slot = 10 + actionCost(archer) - 1;
    const hp = target.hp;
    hit(ctxOf(s), archer, target, 'The arrow');
    expect(target.hp).toBe(hp - archer.power);
    // Off the track (held by a grapple): 1 more.
    target.slot = null;
    const hp2 = target.hp;
    hit(ctxOf(s), archer, target, 'The arrow');
    expect(target.hp).toBe(hp2 - archer.power - 1);
  });

  it('Opportunist and Bulwark say so', () => {
    expect(PASSIVES.opportunist.rule).toBe(
      'Its attacks deal 1 more to a unit whose card is behind its own next card, or off the track.'
    );
    expect(PASSIVES.bulwark.rule).toBe(
      'When an ally next to it takes its first hit in 8 slots, the ally takes 1 less and this unit takes that 1.'
    );
  });

  it('Bulwark: once every `RULES.durations.turn` slots for each ally', () => {
    const s = setup({'p-bokh': centre, 'p-storm': out(0, 1), 'e-mangudai': out(0, 4)});
    const guard = give(s, 'p-bokh', 'bulwark');
    const ally = unit(s, 'p-storm');
    ally.hp = ally.maxHp = 20;
    const archer = unit(s, 'e-mangudai');
    s.currentSlot = 10;
    hit(ctxOf(s), archer, ally, 'The arrow');
    expect(guard.hp).toBe(guard.maxHp - 1);
    // 7 slots on: not yet.
    s.currentSlot = 17;
    hit(ctxOf(s), archer, ally, 'The arrow');
    expect(guard.hp).toBe(guard.maxHp - 1);
    // 8 on: again, whatever its turns.
    s.currentSlot = 18;
    hit(ctxOf(s), archer, ally, 'The arrow');
    expect(guard.hp).toBe(guard.maxHp - 2);
  });

  it('Glass Cannon: Empower 1, starting each fight at half its health', () => {
    const u = makeUnit('player', 0, 'bokh', 0, {passives: ['glassCannon']});
    expect(u.hp).toBe(u.maxHp / 2);
    const s = setup({'p-mangudai': centre, 'e-bokh': out(0, 3)});
    const archer = give(s, 'p-mangudai', 'glassCannon');
    const target = unit(s, 'e-bokh');
    hit(ctxOf(s), archer, target, 'The arrow');
    expect(target.hp).toBe(target.maxHp - archer.power - 1);
  });
});

describe('the passives: control', () => {
  it('Iron Will: the first Stun each fight doesn’t take', () => {
    const s = setup({'p-bokh': centre, 'e-storm': out(0, 1)});
    const u = give(s, 'e-storm', 'ironWill');
    act(s, 'p-bokh', 'grapple', {hex: out(0, 1)});
    expect(isStunned(u)).toBe(false);
    act(s, 'p-bokh', 'grapple', {hex: out(0, 1)});
    expect(isStunned(u)).toBe(true);
  });

  it('Shake Loose: damage while Stunned ends the Stun, a grapple’s included', () => {
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 1), 'e-mangudai': out(3, 3)});
    const u = give(s, 'e-bokh', 'shakeLoose');
    act(s, 'p-bokh', 'grapple', {hex: out(0, 1)});
    expect(isStunned(u)).toBe(true);
    hit(ctxOf(s), unit(s, 'e-mangudai'), u, 'A stray arrow');
    expect(isStunned(u)).toBe(false);
    expect(u.statuses).toEqual([]);
  });
});

describe('the passives: position and allies', () => {
  it('Flanker: 1 more with an ally on the target’s far side', () => {
    const s = setup({'p-bokh': centre, 'e-storm': out(0, 1), 'p-storm': out(0, 2)});
    const u = give(s, 'p-bokh', 'flanker');
    const target = unit(s, 'e-storm');
    hit(ctxOf(s), u, target, 'The blow');
    expect(target.hp).toBe(target.maxHp - u.power - 1);
    const t = setup({'p-bokh': centre, 'e-storm': out(0, 1), 'p-storm': out(1, 2)});
    give(t, 'p-bokh', 'flanker');
    hit(ctxOf(t), unit(t, 'p-bokh'), unit(t, 'e-storm'), 'The blow');
    expect(unit(t, 'e-storm').hp).toBe(unit(t, 'e-storm').maxHp - 1);
  });

  it('Lone Wolf: Empower 1 while no ally is within 2', () => {
    const s = setup({'p-mangudai': centre, 'p-storm': out(3, 3), 'e-bokh': out(0, 3)});
    const u = give(s, 'p-mangudai', 'loneWolf');
    const target = unit(s, 'e-bokh');
    hit(ctxOf(s), u, target, 'The arrow');
    expect(target.hp).toBe(target.maxHp - u.power - 1);
    unit(s, 'p-storm').hex = out(3, 2);
    const hp = target.hp;
    hit(ctxOf(s), u, target, 'The arrow');
    expect(target.hp).toBe(hp - u.power);
  });

  it('Rally: allies next to it gain Shield 1 at its turn’s start, until their next turn', () => {
    const s = setup({'p-bokh': centre, 'p-storm': out(0, 1), 'e-mangudai': out(0, 4)});
    const rally = give(s, 'p-bokh', 'rally');
    const ally = unit(s, 'p-storm');
    rally.slot = 1;
    ally.slot = 20;
    expect(advanceToDecision(s)?.id).toBe('p-bokh');
    expect(ally.shield).toBe(1);
    hit(ctxOf(s), unit(s, 'e-mangudai'), ally, 'The arrow');
    expect(ally.hp).toBe(ally.maxHp - unit(s, 'e-mangudai').power + 1);
    expect(ally.shield).toBeUndefined();
    // A Shield left over goes as the ally's turn starts.
    ally.shield = 1;
    applyTurn(s, rally, {action: {ability: 'hold'}});
    rally.slot = 50;
    expect(advanceToDecision(s)?.id).toBe('p-storm');
    expect(ally.shield).toBeUndefined();
  });

  it('Spearhead: hit, the allies next to it are Hastened 3, no one else', () => {
    const s = setup({
      'p-bokh': centre,
      'p-storm': out(0, 1),
      'p-mangudai': out(3, 2),
      'e-bokh': out(1, 1),
      'e-mangudai': out(4, 3),
    });
    const u = give(s, 'p-bokh', 'spearhead');
    const [near, far, foe] = [unit(s, 'p-storm'), unit(s, 'p-mangudai'), unit(s, 'e-bokh')];
    const before = [near.slot!, far.slot!, foe.slot!, u.slot!];
    hit(ctxOf(s), unit(s, 'e-mangudai'), u, 'The arrow');
    expect([near.slot, far.slot, foe.slot, u.slot]).toEqual([
      before[0]! - SPEARHEAD.haste,
      before[1],
      before[2],
      before[3],
    ]);
  });

  it('Vengeance: when an ally falls, Hastened 3 and Empowered 1', () => {
    const s = setup({'p-bokh': centre, 'p-storm': out(0, 1), 'e-mangudai': out(0, 4)});
    const u = give(s, 'p-bokh', 'vengeance');
    const ally = unit(s, 'p-storm');
    ally.hp = 1;
    hit(ctxOf(s), unit(s, 'e-mangudai'), ally, 'The arrow');
    expect(ally.alive).toBe(false);
    expect(u.slot).toBe(97);
    expect(u.empower).toBe(1);
  });
});

describe('the passives on the test stage', () => {
  it('reads a unit’s passives, and names a wrong one', () => {
    const base = {
      player: [{hero: 'bokh', passives: ['rally', 'hardened']}],
      enemy: [{hero: 'wolf'}],
    };
    expect(parseTestStage(base).player[0]!.loadout?.passives).toEqual(['rally', 'hardened']);
    expect(() => parseTestStage({...base, player: [{hero: 'bokh', passives: ['rallly']}]})).toThrow(
      /passives must be a list/
    );
  });
});
