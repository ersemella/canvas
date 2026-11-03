// The passives (progression.md, 19.8), each given here by loadout: no hero
// carries one yet.
import {describe, expect, it} from 'vitest';
import {hexNeighbor} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {HEROES, PARTY, RULES, SPEARHEAD} from './config';
import {reachableHexes, isStunned, invalidPath} from './board';
import {applyTurn, cloneFight, createFight, makeUnit, mapOf} from './fight';
import {STEPPE} from './map';
import {delay, haste, hit} from './resolve';
import type {Ctx} from './resolve';
import {parseTestStage} from './testStage';
import {NOT_OFFERED, PASSIVES} from './passives';
import {actionCost, waitCost} from './track';
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

  it('Second Wind: Hastened 4 the first time at half health or less', () => {
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
    expect(u.slot).toBe(96);
    hit(ctxOf(s), archer, u, 'The arrow');
    expect(u.slot).toBe(96);
  });

  it('Patient: a turn without moving or an ability goes 2 fewer slots on, after Wait', () => {
    const s = setup({'p-bokh': centre, 'p-storm': out(3, 3), 'e-bokh': out(0, 3)});
    give(s, 'p-bokh', 'patient');
    act(s, 'p-bokh', 'hold');
    expect(unit(s, 'p-bokh').slot).toBe(waitCost(unit(s, 'p-bokh')) - 2);
    act(s, 'p-storm', 'hold');
    expect(unit(s, 'p-storm').slot).toBe(waitCost(unit(s, 'p-storm')));
  });

  it('Momentum: Hastened 2 after a turn that takes a unit off the board', () => {
    const s = setup({'p-mangudai': centre, 'e-storm': out(0, 2), 'e-bokh': out(3, 2)});
    give(s, 'p-mangudai', 'momentum');
    unit(s, 'e-storm').hp = 1;
    act(s, 'p-mangudai', 'snapShot', {hex: out(0, 2)});
    expect(unit(s, 'e-storm').alive).toBe(false);
    expect(unit(s, 'p-mangudai').slot).toBe(actionCost(unit(s, 'p-mangudai')) - 2);
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
});

describe('the passives: damage and survival', () => {
  it('a copy of the fight (a preview, the AI’s search) spends its own once-a-fight passives', () => {
    const s = setup({'p-bokh': centre, 'e-mangudai': out(0, 4)});
    give(s, 'p-bokh', 'lastStand');
    unit(s, 'p-bokh').spent = [];
    const copy = cloneFight(s);
    unit(copy, 'e-mangudai').power = 99;
    hit(ctxOf(copy), unit(copy, 'e-mangudai'), unit(copy, 'p-bokh'), 'The arrow');
    expect(unit(copy, 'p-bokh').spent).toEqual(['lastStand']);
    expect(unit(s, 'p-bokh').spent).toEqual([]);
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

  it('Opportunist says so', () => {
    expect(PASSIVES.opportunist.rule).toBe(
      '+1 attack damage against units whose card is behind the carrier’s next card or off the track.'
    );
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

  it('Plated: Armour 1 against every hit, unless it Pierces', () => {
    const s = setup({'p-bokh': centre, 'e-mangudai': out(0, 3)});
    const u = give(s, 'p-bokh', 'plated');
    const archer = unit(s, 'e-mangudai');
    archer.power = 3;
    hit(ctxOf(s), archer, u, 'The arrow');
    hit(ctxOf(s), archer, u, 'The arrow');
    expect(u.hp).toBe(u.maxHp - 4);
    archer.passives = ['sundering'];
    hit(ctxOf(s), archer, u, 'The arrow');
    expect(u.hp).toBe(u.maxHp - 7);
  });

  it('Braced: starts each fight with Shield 2, lasting until spent', () => {
    const u = makeUnit('player', 0, 'bokh', 0, {passives: ['braced']});
    expect([u.shield, u.lastingShield, u.shieldUntil]).toEqual([2, 2, undefined]);
    const s = setup({'p-bokh': centre, 'e-mangudai': out(0, 3)});
    const v = give(s, 'p-bokh', 'braced');
    Object.assign(v, {shield: 2, lastingShield: 2});
    const archer = unit(s, 'e-mangudai');
    archer.power = 3;
    hit(ctxOf(s), archer, v, 'The arrow');
    expect(v.shield).toBeUndefined();
    expect(v.hp).toBe(v.maxHp - 1);
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

  it('Spearhead (the Vanguard’s): hit, its allies within 2 are Hastened 3, no one else', () => {
    const s = setup({
      'p-bokh': centre,
      'p-storm': out(0, 2),
      'p-mangudai': out(3, 3),
      'e-bokh': out(1, 1),
      'e-mangudai': out(4, 3),
    });
    const u = give(s, 'p-bokh', 'spearhead');
    const [near, far, foe] = [unit(s, 'p-storm'), unit(s, 'p-mangudai'), unit(s, 'e-bokh')];
    const before = [near.slot!, far.slot!, foe.slot!, u.slot!];
    hit(ctxOf(s), unit(s, 'e-mangudai'), u, 'The arrow');
    expect(SPEARHEAD.range).toBe(2);
    expect([near.slot, far.slot, foe.slot, u.slot]).toEqual([
      before[0]! - SPEARHEAD.haste,
      before[1],
      before[2],
      before[3],
    ]);
  });

  it('Spearhead is no hero’s, never offered at the caravanserai', () => {
    for (const hero of Object.values(HEROES))
      expect(hero.passives ?? []).not.toContain('spearhead');
    expect(NOT_OFFERED).toContain('spearhead');
  });

  it('Spearhead at range 1: only the allies next to it', () => {
    const spearhead = SPEARHEAD as {range: number};
    const saved = spearhead.range;
    spearhead.range = 1;
    try {
      const s = setup({
        'p-bokh': centre,
        'p-storm': out(0, 1),
        'p-mangudai': out(3, 2),
        'e-mangudai': out(4, 3),
      });
      const u = give(s, 'p-bokh', 'spearhead');
      const [near, far] = [unit(s, 'p-storm'), unit(s, 'p-mangudai')];
      const before = [near.slot!, far.slot!];
      hit(ctxOf(s), unit(s, 'e-mangudai'), u, 'The arrow');
      expect([near.slot, far.slot]).toEqual([before[0]! - SPEARHEAD.haste, before[1]]);
    } finally {
      spearhead.range = saved;
    }
  });

  it('Sure Hand: its abilities don’t damage allies, but still hit enemies', () => {
    const s = setup({'p-bokh': centre, 'p-storm': out(0, 1), 'e-bokh': out(3, 1)});
    give(s, 'p-bokh', 'sureHand');
    const [ally, foe] = [unit(s, 'p-storm'), unit(s, 'e-bokh')];
    act(s, 'p-bokh', 'cleave', {hex: out(0, 1)});
    expect(ally.hp).toBe(ally.maxHp);
    s.currentSlot += 1;
    act(s, 'p-bokh', 'cleave', {hex: out(3, 1)});
    expect(foe.hp).toBeLessThan(foe.maxHp);
    // Without it, the ally is hit.
    const t = setup({'p-bokh': centre, 'p-storm': out(0, 1), 'e-bokh': out(3, 1)});
    act(t, 'p-bokh', 'cleave', {hex: out(0, 1)});
    expect(unit(t, 'p-storm').hp).toBeLessThan(unit(t, 'p-storm').maxHp);
  });

  it('Unstoppable is offered at the caravanserai since 2026-11-02', () => {
    expect(NOT_OFFERED).not.toContain('unstoppable');
    expect(PASSIVES.unstoppable.rarity).toBe('rare');
  });
});

describe('the passives on the test stage', () => {
  it('reads a unit’s passives, and names a wrong one', () => {
    const base = {
      player: [{hero: 'bokh', passives: ['plated', 'braced']}],
      enemy: [{hero: 'wolf'}],
    };
    expect(parseTestStage(base).player[0]!.loadout?.passives).toEqual(['plated', 'braced']);
    expect(() =>
      parseTestStage({...base, player: [{hero: 'bokh', passives: ['platted']}]})
    ).toThrow(/passives must be a list/);
  });
});
