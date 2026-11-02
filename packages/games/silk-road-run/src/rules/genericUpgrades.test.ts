// The generic ability upgrades (progression.md, 19.9; owner, 2026-10-29),
// each given here by loadout, and the rarities the caravanserai draws them
// and the passives by (19.3b).
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {hexNeighbor} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITIES} from './abilities';
import {isStunned} from './board';
import {offeredTargets} from './choices';
import {ABILITY, HEROES, PARTY, RARITY_WEIGHT} from './config';

// These tests use Swift Strike as first built, a plain melee strike next to
// the Duelist, and his free walk (the dash and straight walk since 2026-10-31).
const builtSwift = {dash: ABILITY.swiftStrike.dash, straight: HEROES.youxia.movesStraight};
beforeEach(() => {
  Object.assign(ABILITY.swiftStrike, {dash: 0});
  Object.assign(HEROES.youxia, {movesStraight: false});
});
afterEach(() => {
  Object.assign(ABILITY.swiftStrike, {dash: builtSwift.dash});
  Object.assign(HEROES.youxia, {movesStraight: builtSwift.straight});
});
import {RuleError, applyTurn, createFight} from './fight';
import {STEPPE} from './map';
import {NOT_OFFERED, PASSIVES, draftPick, fitsKit} from './passives';
import {weightedDraw} from './run';
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

describe('generic upgrades: attacks', () => {
  it('Concussive I, II and III Delay the target 2, 4 and 6', () => {
    for (const [id, n] of [
      ['concussive1', 2],
      ['concussive2', 4],
      ['concussive3', 6],
    ] as const) {
      const s = setup({'p-bokh': centre, 'e-bokh': out(0, 1)});
      give(s, 'p-bokh', id);
      const foe = unit(s, 'e-bokh');
      const before = foe.slot!;
      act(s, 'p-bokh', 'swiftStrike', {hex: out(0, 1)});
      expect(isStunned(foe)).toBe(false);
      expect(foe.slot, id).toBe(before + n);
    }
  });

  it('with more than one Concussive, only the highest Delays', () => {
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 1)});
    give(s, 'p-bokh', 'concussive1', 'concussive3');
    const foe = unit(s, 'e-bokh');
    const before = foe.slot!;
    act(s, 'p-bokh', 'swiftStrike', {hex: out(0, 1)});
    expect(foe.slot).toBe(before + 6);
  });

  it('Crippling Weakens 1, Sundering Pierces Armour', () => {
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 1)});
    give(s, 'p-bokh', 'crippling', 'sundering');
    const foe = give(s, 'e-bokh', 'armoured');
    const me = unit(s, 'p-bokh');
    me.power = 2;
    act(s, 'p-bokh', 'swiftStrike', {hex: out(0, 1)});
    expect(foe.weaken).toBe(1);
    // Armoured's 1 is Pierced: the full 2.
    expect(foe.hp).toBe(foe.maxHp - 2);
  });

  it('only an enemy is an attack’s target: an ally hit takes none of it', () => {
    const s = setup({'p-bokh': centre, 'p-storm': out(0, 1), 'e-bokh': out(3, 3)});
    give(s, 'p-bokh', 'concussive3');
    const ally = unit(s, 'p-storm');
    const before = ally.slot!;
    act(s, 'p-bokh', 'swiftStrike', {hex: out(0, 1)});
    expect(ally.slot).toBe(before);
  });
});

describe('generic upgrades: the board', () => {
  it('Forceful Pushes 1 after the attack; not with an ability that already Pushes', () => {
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 1)});
    give(s, 'p-bokh', 'forceful');
    act(s, 'p-bokh', 'swiftStrike', {hex: out(0, 1)});
    expect(unit(s, 'e-bokh').hex).toEqual(out(0, 2));

    const s2 = setup({'p-bokh': centre, 'e-bokh': out(0, 2)});
    give(s2, 'p-bokh', 'forceful');
    unit(s2, 'p-bokh').power = 1;
    act(s2, 'p-bokh', 'axeThrow', {hex: out(0, 2)});
    // Axe Throw's own Push only.
    expect(unit(s2, 'e-bokh').hex).toEqual(out(0, 2 + ABILITY.axeThrow.push));
  });
});

describe('generic upgrades: what its abilities reach (owner, 2026-11-02)', () => {
  it('Empowering, Hastening and Sheltering reach an enemy its attack hits', () => {
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 1)});
    give(s, 'p-bokh', 'empowering', 'hastening', 'sheltering');
    const foe = unit(s, 'e-bokh');
    const before = foe.slot!;
    act(s, 'p-bokh', 'swiftStrike', {hex: out(0, 1)});
    expect(foe.empower).toBe(1);
    expect(foe.slot).toBe(before - 2);
    expect(foe.shield).toBe(1);
  });

  it('and an ally its ability Empowers, each once: no loop', () => {
    const s = setup({'p-storm': centre, 'p-bokh': out(0, 2), 'e-bokh': out(3, 3)});
    give(s, 'p-storm', 'empowering', 'hastening', 'sheltering');
    const ally = unit(s, 'p-bokh');
    const before = ally.slot!;
    act(s, 'p-storm', 'sunlight', {hex: out(0, 2)});
    // Sunlight's own Empower stands; Empowering's 1 is weaker.
    expect(ally.empower).toBe(ABILITY.sunlight.empower);
    expect(ally.slot).toBe(before - 2);
    expect(ally.shield).toBe(1);
  });

  it('never the carrier itself', () => {
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 1)});
    const me = give(s, 'p-bokh', 'empowering', 'sheltering');
    act(s, 'p-bokh', 'swiftStrike', {hex: out(0, 1)});
    expect(me.empower).toBeUndefined();
    expect(me.shield).toBeUndefined();
  });
});

describe('targets (owner, 2026-11-02)', () => {
  it('an attack aimed at a unit is offered allies too, and with Sure Hand spares them', () => {
    const s = setup({'p-mangudai': centre, 'p-storm': out(0, 3), 'e-bokh': out(3, 3)});
    const me = give(s, 'p-mangudai', 'sureHand', 'empowering');
    me.loadout = {abilities: ['snapShot', 'hold']};
    const offered = offeredTargets(s, STEPPE, me, ABILITIES.snapShot).map((t) => t.hex);
    expect(offered).toContainEqual(out(0, 3));
    expect(offered).toContainEqual(out(3, 3));
    const ally = unit(s, 'p-storm');
    act(s, 'p-mangudai', 'snapShot', {hex: out(0, 3)});
    // Unhurt, and Empowered by the shot.
    expect(ally.hp).toBe(ally.maxHp);
    expect(ally.empower).toBe(1);
  });
});

describe('generic upgrades: Forked', () => {
  it('takes one extra target, a target of its own, never the same one', () => {
    const s = setup({'p-mangudai': centre, 'e-bokh': out(0, 3), 'e-storm': out(3, 2)});
    const me = give(s, 'p-mangudai', 'forked');
    me.power = 1;
    const a = unit(s, 'e-bokh');
    const b = unit(s, 'e-storm');
    act(s, 'p-mangudai', 'snapShot', {hex: out(0, 3), also: out(3, 2)});
    expect(a.hp).toBe(a.maxHp - 1);
    expect(b.hp).toBe(b.maxHp - 1);
    s.currentSlot += 1;
    expect(() => act(s, 'p-mangudai', 'snapShot', {hex: out(0, 3), also: out(0, 3)})).toThrow(
      RuleError
    );
    expect(() => act(s, 'p-mangudai', 'snapShot', {hex: out(0, 3), also: out(1, 2)})).toThrow(
      RuleError
    );
  });

  it('without Forked, or on an ability with more than one target, a second is refused', () => {
    const s = setup({'p-mangudai': centre, 'e-bokh': out(0, 3), 'e-storm': out(3, 2)});
    expect(() => act(s, 'p-mangudai', 'snapShot', {hex: out(0, 3), also: out(3, 2)})).toThrow(
      RuleError
    );
    const t = setup({'p-bokh': centre, 'e-bokh': out(0, 1), 'e-storm': out(3, 1)});
    give(t, 'p-bokh', 'forked');
    expect(() => act(t, 'p-bokh', 'cleave', {hex: out(0, 1), also: out(3, 1)})).toThrow(RuleError);
  });
});

describe('rarity (19.3b)', () => {
  it('gives every offered passive and upgrade a rarity, the strongest the rarest', () => {
    for (const def of Object.values(PASSIVES))
      if (!NOT_OFFERED.includes(def.id)) expect(def.rarity, def.id).toBeDefined();
    expect(PASSIVES.concussive3.rarity).toBe('legendary');
    expect(PASSIVES.forked.rarity).toBe('legendary');
    expect(PASSIVES.patient.rarity).toBe('common');
    expect(PASSIVES.unstoppable.rarity).toBeDefined();
    expect(RARITY_WEIGHT.common / RARITY_WEIGHT.legendary).toBe(8);
  });

  it('draws each as often as its weight', () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const counts = {a: 0, b: 0};
    for (let i = 0; i < 4000; i++) {
      const [x] = weightedDraw(['a', 'b'] as const, (k) => (k === 'a' ? 1 : 8), random, 1);
      counts[x!]++;
    }
    expect(counts.b / counts.a).toBeGreaterThan(6);
    expect(counts.b / counts.a).toBeLessThan(10);
    // Without putting back: n distinct.
    expect(new Set(weightedDraw([1, 2, 3, 4, 5], () => 1, random, 4)).size).toBe(4);
  });

  it('the rival drafts an upgrade only for a hero whose kit it works on', () => {
    expect(fitsKit('priest', 'empowering')).toBe(true);
    expect(fitsKit('bokh', 'empowering')).toBe(false);
    expect(fitsKit('mangudai', 'concussive2')).toBe(true);
    expect(draftPick('bokh', ['empowering', 'hastening', 'patient'])).toBe('patient');
    expect(draftPick('priest', ['empowering', 'patient'])).toBe('empowering');
  });
});
