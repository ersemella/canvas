// The generic ability upgrades (progression.md, 19.9; owner, 2026-10-29),
// each given here by loadout, and the rarities the caravanserai draws them
// and the passives by (19.3b).
import {describe, expect, it} from 'vitest';
import {hexNeighbor} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITIES} from './abilities';
import {isImmobilized, isStunned} from './board';
import {offeredTargets} from './choices';
import {ABILITY, PARTY, RARITY_WEIGHT, RULES} from './config';
import {RuleError, advanceToDecision, applyTurn, createFight} from './fight';
import {STEPPE} from './map';
import {PASSIVES, draftPick, fitsKit} from './passives';
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
  it('Concussive Delays the target `RULES.durations.stun` (a Stun for its next turn until 2026-10-29)', () => {
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 1)});
    give(s, 'p-bokh', 'concussive');
    const foe = unit(s, 'e-bokh');
    const before = foe.slot!;
    act(s, 'p-bokh', 'swiftStrike', {hex: out(0, 1)});
    expect(isStunned(foe)).toBe(false);
    expect(foe.slot).toBe(before + RULES.durations.stun);
  });

  it('Staggering Delays 2, Crippling Weakens 1, Sundering Pierces Armour', () => {
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 1)});
    give(s, 'p-bokh', 'staggering', 'crippling', 'sundering');
    const foe = give(s, 'e-bokh', 'armoured');
    const me = unit(s, 'p-bokh');
    me.power = 2;
    const before = foe.slot!;
    act(s, 'p-bokh', 'swiftStrike', {hex: out(0, 1)});
    expect(foe.slot).toBe(before + 2);
    expect(foe.weaken).toBe(1);
    // Armoured's 1 is Pierced: the full 2.
    expect(foe.hp).toBe(foe.maxHp - 2);
  });

  it('Hamstring Immobilizes for `RULES.durations.turn` slots, and sets off Lockdown', () => {
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 1)});
    give(s, 'p-bokh', 'hamstring');
    const now = s.currentSlot;
    act(s, 'p-bokh', 'swiftStrike', {hex: out(0, 1)});
    const foe = unit(s, 'e-bokh');
    expect(isImmobilized(foe)).toBe(true);
    expect(foe.statuses[0]!.until).toBe(now + RULES.durations.turn);
    expect(isStunned(foe)).toBe(false);
    // Past its last slot it ends, whatever turns come in between.
    unit(s, 'p-bokh').slot = 400;
    foe.slot = now + RULES.durations.turn + 1;
    advanceToDecision(s);
    expect(isImmobilized(foe)).toBe(false);

    const t = setup({'p-bokh': centre, 'e-bokh': out(0, 1)});
    give(t, 'p-bokh', 'hamstring', 'lockdown');
    const before = unit(t, 'e-bokh').slot!;
    act(t, 'p-bokh', 'swiftStrike', {hex: out(0, 1)});
    expect(isImmobilized(unit(t, 'e-bokh'))).toBe(true);
    expect(unit(t, 'e-bokh').slot).toBe(before + RULES.durations.stun);
  });

  it('only an enemy is an attack’s target: an ally hit takes none of it', () => {
    const s = setup({'p-bokh': centre, 'p-storm': out(0, 1), 'e-bokh': out(3, 3)});
    give(s, 'p-bokh', 'concussive', 'staggering');
    const ally = unit(s, 'p-storm');
    const before = ally.slot!;
    act(s, 'p-bokh', 'swiftStrike', {hex: out(0, 1)});
    expect(isStunned(ally)).toBe(false);
    expect(ally.slot).toBe(before);
  });

  it('Defy Fate Delays an Inevitable target, though Inevitable; Immovable Object Delays an Unstoppable one 2', () => {
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 1), 'e-storm': out(3, 1)});
    give(s, 'p-bokh', 'defyFate', 'immovableObject');
    give(s, 'e-bokh', 'steadyGait');
    const big = give(s, 'e-storm', 'unstoppable');
    const fated = unit(s, 'e-bokh').slot!;
    act(s, 'p-bokh', 'swiftStrike', {hex: out(0, 1)});
    expect(unit(s, 'e-bokh').slot).toBe(fated + RULES.durations.stun);
    const before = big.slot!;
    s.currentSlot += 1;
    act(s, 'p-bokh', 'swiftStrike', {hex: out(3, 1)});
    expect(big.slot).toBe(before + 2);
    expect(isStunned(big)).toBe(false);
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

  it('Reel In Pulls a ranged attack’s target 1; with Forceful it stays put', () => {
    const s = setup({'p-mangudai': centre, 'e-bokh': out(0, 3)});
    give(s, 'p-mangudai', 'reelIn');
    act(s, 'p-mangudai', 'snapShot', {hex: out(0, 3)});
    expect(unit(s, 'e-bokh').hex).toEqual(out(0, 2));

    const t = setup({'p-mangudai': centre, 'e-bokh': out(0, 3)});
    give(t, 'p-mangudai', 'reelIn', 'forceful');
    act(t, 'p-mangudai', 'snapShot', {hex: out(0, 3)});
    expect(unit(t, 'e-bokh').hex).toEqual(out(0, 3));
  });
});

describe('generic upgrades: keywords', () => {
  it('Wearying Weakens what its Delay reaches; with Lethargy each fires once, no loop', () => {
    const t = setup({'p-bokh': centre, 'e-bokh': out(0, 1)});
    give(t, 'p-bokh', 'staggering', 'wearying', 'lethargy');
    const foe = unit(t, 'e-bokh');
    const before = foe.slot!;
    act(t, 'p-bokh', 'swiftStrike', {hex: out(0, 1)});
    // Staggering's Delay 2, Wearying's Weaken 1, Lethargy's Delay 2; then nothing more.
    expect(foe.weaken).toBe(1);
    expect(foe.slot).toBe(before + 4);
  });

  it('Wearying does nothing where the Delay doesn’t take (Inevitable)', () => {
    const s = setup({'p-bokh': centre, 'e-bokh': out(0, 1)});
    give(s, 'p-bokh', 'staggering', 'wearying');
    give(s, 'e-bokh', 'steadyGait');
    act(s, 'p-bokh', 'swiftStrike', {hex: out(0, 1)});
    expect(unit(s, 'e-bokh').weaken).toBeUndefined();
  });

  it('Inspire Hastens an ally its ability Empowers', () => {
    const s = setup({'p-storm': centre, 'p-bokh': out(0, 2), 'e-bokh': out(3, 3)});
    give(s, 'p-storm', 'inspire');
    const ally = unit(s, 'p-bokh');
    const before = ally.slot!;
    act(s, 'p-storm', 'sunlight', {hex: out(0, 2)});
    expect(ally.empower).toBe(ABILITY.sunlight.empower);
    expect(ally.slot).toBe(before - 2);
  });
});

describe('generic upgrades: healing', () => {
  it('Mending Strike heals an ally next to it its power, Empower counted', () => {
    const s = setup({'p-bokh': centre, 'p-storm': out(0, 1), 'e-bokh': out(3, 3)});
    give(s, 'p-bokh', 'mendingStrike');
    const me = unit(s, 'p-bokh');
    me.power = 1;
    me.empower = 1;
    const ally = unit(s, 'p-storm');
    ally.hp = 1;
    act(s, 'p-bokh', 'swiftStrike', {hex: out(0, 1)});
    expect(ally.hp).toBe(3);
    // Never above full health.
    ally.hp = ally.maxHp - 1;
    s.currentSlot += 1;
    act(s, 'p-bokh', 'swiftStrike', {hex: out(0, 1)});
    expect(ally.hp).toBe(ally.maxHp);
  });

  it('Mending Shot heals an ally at range, and the page offers it as a target', () => {
    const s = setup({'p-mangudai': centre, 'p-storm': out(0, 3), 'e-bokh': out(3, 3)});
    const me = give(s, 'p-mangudai');
    me.loadout = {abilities: ['snapShot', 'hold']};
    const shoot = ABILITIES.snapShot;
    const offered = () => offeredTargets(s, STEPPE, me, shoot).map((t) => t.hex);
    expect(offered()).not.toContainEqual(out(0, 3));
    me.passives = ['mendingShot'];
    expect(offered()).toContainEqual(out(0, 3));
    const ally = unit(s, 'p-storm');
    ally.hp = 1;
    act(s, 'p-mangudai', 'snapShot', {hex: out(0, 3)});
    expect(ally.hp).toBe(1 + me.power);
  });

  it('a mending hit sets off the healing upgrades: Fortify’s Armour and Ward’s Shield', () => {
    const s = setup({'p-bokh': centre, 'p-storm': out(0, 1), 'e-bokh': out(3, 3)});
    give(s, 'p-bokh', 'mendingStrike', 'fortify', 'ward');
    const ally = unit(s, 'p-storm');
    act(s, 'p-bokh', 'swiftStrike', {hex: out(0, 1)});
    expect(ally.armour).toBe(1);
    expect(ally.shield).toBe(1);
  });

  it('Invigorate and Quickening on a Blessing: the ally Empowered 1 and Hastened 2', () => {
    const s = setup({'p-bokh': centre, 'p-storm': out(0, 2), 'e-bokh': out(3, 3)});
    give(s, 'p-bokh', 'invigorate', 'quickening');
    const ally = unit(s, 'p-storm');
    const before = ally.slot!;
    act(s, 'p-bokh', 'blessing', {hex: out(0, 1)});
    expect(ally.empower).toBe(1);
    expect(ally.slot).toBe(before - 2);
  });
});

describe('generic upgrades: chains', () => {
  it('Quickening’s Haste sets off Fervour: the ally healed is Empowered 1', () => {
    const s = setup({'p-bokh': centre, 'p-storm': out(0, 2), 'e-bokh': out(3, 3)});
    give(s, 'p-bokh', 'quickening', 'fervour');
    act(s, 'p-bokh', 'blessing', {hex: out(0, 1)});
    expect(unit(s, 'p-storm').empower).toBe(1);
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
      if (
        ![
          'unstoppable',
          'oneEye',
          'devoted',
          'armoured',
          'serpentKing',
          'regrow',
          'spearhead',
        ].includes(def.id)
      )
        expect(def.rarity, def.id).toBeDefined();
    expect(PASSIVES.concussive.rarity).toBe('legendary');
    expect(PASSIVES.forked.rarity).toBe('legendary');
    expect(PASSIVES.patient.rarity).toBe('common');
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
    expect(fitsKit('priest', 'ward')).toBe(true);
    expect(fitsKit('bokh', 'ward')).toBe(false);
    expect(fitsKit('mangudai', 'mendingShot')).toBe(true);
    expect(draftPick('bokh', ['ward', 'mendingShot', 'patient'])).toBe('patient');
    expect(draftPick('priest', ['ward', 'patient'])).toBe('ward');
  });
});
