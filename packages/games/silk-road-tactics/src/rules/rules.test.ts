import {describe, expect, it} from 'vitest';
import {
  hexDirectionTo,
  hexDistance,
  hexKey,
  hexToOffset,
  hexToPixel,
  offsetToHex,
} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, AI, RULES} from './config';
import {
  isFlanked,
  lineOfFire,
  movementCap,
  reachableHexes,
  unitAt,
  vulnerablePercent,
} from './board';
import {ABILITIES, arrowLanes} from './abilities';
import {chooseAiTurn, scoreOptions, simulate} from './ai';
import {threatDamage, threatsTo} from './threat';
import {
  RuleError,
  actingUnit,
  advance,
  applyTurn,
  cloneFight,
  createFight,
  defaultDeployment,
  deploy,
  mapOf,
} from './fight';
import {afterAction, previewTurn} from './preview';
import {SALT_FLATS, onMap} from './map';
import {abilityDamage, displace, scaled} from './resolve';
import {createRun, handleRunAction, runView} from './run';
import {
  freeSlotFrom,
  nextCard,
  placeCard,
  simultaneousOrder,
  slotsForward,
  turnCost,
} from './track';
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
/** Applies a turn to a copy of the fight, so a test can try several. */
const tryTurn = (s: FightState, id: string, input: TurnInput) => () => {
  const c = cloneFight(s);
  applyTurn(c, unit(c, id), input);
};
/** Damage after the unit's defence (9.1). */
const defended = (u: Unit, d: number): number =>
  Math.floor((d * RULES.defenceConstant) / (u.defence + RULES.defenceConstant));

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
    expect(unit(s, 'p-mangudai').slot).toBe(
      Math.floor(RULES.startCost / (unit(s, 'p-mangudai').speed + RULES.C))
    );
  });

  it('spaces the starting cards by speed, as far apart as a typical turn would put them', () => {
    const s = createFight(0);
    deploy(s, defaultDeployment(s));
    const fast = unit(s, 'p-mangudai');
    const slow = unit(s, 'p-bokh');
    expect(slow.slot! - fast.slot!).toBeGreaterThanOrEqual(
      slotsForward(RULES.cost.typical, slow.speed) - slotsForward(RULES.cost.typical, fast.speed)
    );
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
    expect(() =>
      applyTurn(cloneFight(s), unit(cloneFight(s), m.id), {
        action: {ability: 'volley', target: {hex: at(5, 1)}},
      })
    ).toThrow(RuleError);
  });
});

describe('the board', () => {
  it('is 8 × 9 with a hex at column −1 on odd rows only, making an exact left-right mirror', () => {
    const map = SALT_FLATS;
    expect(map.hexes).toHaveLength(8 * 5 + 9 * 4);
    for (const row of [1, 3, 5, 7]) expect(onMap(map, at(-1, row))).toBe(true);
    for (const row of [0, 2, 4, 6, 8]) expect(onMap(map, at(-1, row))).toBe(false);
    for (const row of [0, 1]) expect(onMap(map, at(8, row))).toBe(false);
    expect(onMap(map, at(0, 8))).toBe(true);
    expect(onMap(map, at(0, 9))).toBe(false);
    // Mirror about the board's centre line (between columns 3 and 4 on even rows).
    const layout = {orientation: 'pointy' as const, size: 1, origin: {x: 0, y: 0}};
    const mid = (hexToPixel(at(3, 0), layout).x + hexToPixel(at(4, 0), layout).x) / 2;
    const mirror = (h: Hex) => {
      const p = hexToPixel(h, layout);
      return SALT_FLATS.hexes.find((m) => {
        const q = hexToPixel(m, layout);
        return Math.abs(q.x - (2 * mid - p.x)) < 1e-9 && q.y === p.y;
      });
    };
    for (const h of map.hexes) expect(mirror(h)).toBeDefined();
    const zone = new Set(map.deployment.enemy.map(hexKey));
    for (const h of map.deployment.player) expect(zone.has(hexKey(mirror(h)!))).toBe(true);
    expect(map.deployment.player.some((h) => hexToOffset(h).col === -1)).toBe(true);
    // Every feature has its mirror image.
    for (const [key, tile] of Object.entries(map.tiles)) {
      const [q, r] = key.split(',').map(Number);
      expect(map.tiles[hexKey(mirror({q: q!, r: r!})!)]).toBe(tile);
    }
  });

  it('passes allies, is blocked by enemies and obstacles, never ends on a unit', () => {
    const s = setup({'p-bokh': at(0, 3), 'p-storm': at(1, 3), 'e-bokh': at(1, 2)});
    const reach = reachableHexes(s, mapOf(s), unit(s, 'p-bokh'));
    const keys = reach.map((r) => `${r.hex.q},${r.hex.r}`);
    const key = (h: Hex) => `${h.q},${h.r}`;
    expect(keys).not.toContain(key(at(1, 3))); // ally's hex
    expect(keys).not.toContain(key(at(1, 2))); // enemy
    expect(keys).not.toContain(key(at(2, 2))); // ruins
    expect(keys).toContain(key(at(2, 3))); // through the ally
    expect(reach.every((r) => r.path.length <= RULES.movementCap)).toBe(true);
  });

  it('routes around hail as well as quicksand when an equally short path exists', () => {
    const s = setup({'p-bokh': at(4, 3), 'e-bokh': at(7, 6)});
    const b = unit(s, 'p-bokh');
    const dest = at(4, 5); // via (4, 4) or (5, 4)
    const before = reachableHexes(s, mapOf(s), b).find((r) => hexKey(r.hex) === hexKey(dest))!;
    expect(before.path).toHaveLength(2);
    const hailed = before.path[0]!;
    s.effects.push({
      kind: 'hail',
      hex: hailed,
      untilSlot: 999,
      damage: 50,
      slowed: 2,
      vulnerable: 25,
      statusSlots: 10,
    });
    const after = reachableHexes(s, mapOf(s), b).find((r) => hexKey(r.hex) === hexKey(dest))!;
    expect(after.path).toHaveLength(2);
    expect(after.path.map(hexKey)).not.toContain(hexKey(hailed));
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
    // Ruins at (2,2) sit on the line from (1,2) to (3,2).
    expect(lineOfFire(s, map, at(1, 2), at(3, 2)).clear).toBe(false);
    // From o to o + (1,1) the line runs along the border of o + (1,0) and o + (0,1).
    const o = at(1, 0);
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
    const expected = Math.floor(
      (scaled * RULES.defenceConstant) / (b.defence + RULES.defenceConstant)
    );
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

  it('fog weakens ranged hits into it and out of it, and fades', () => {
    const s = setup({'p-storm': at(3, 1), 'p-mangudai': at(1, 1), 'e-mangudai': at(5, 1)});
    const m = unit(s, 'p-mangudai');
    const e = unit(s, 'e-mangudai');
    const open = abilityDamage(s, SALT_FLATS, m, e, 100, true);
    applyTurn(s, unit(s, 'p-storm'), {action: {ability: 'fog', target: {hex: at(5, 1)}}});
    expect(s.fog).toHaveLength(7);
    const into = abilityDamage(s, SALT_FLATS, m, e, 100, true);
    const outOf = abilityDamage(s, SALT_FLATS, e, m, 100, true);
    expect(into).toBeLessThan(open);
    expect(outOf).toBe(into);
    // Melee isn't affected.
    expect(abilityDamage(s, SALT_FLATS, m, e, 100, false)).toBe(open);
    // Gone once its slots pass.
    s.units.forEach((u) => (u.controller = 'human'));
    e.slot = ABILITY.fog.slots + 5;
    m.slot = 500;
    unit(s, 'p-storm').slot = 500;
    advance(s, chooseAiTurn);
    expect(s.fog).toHaveLength(0);
  });

  it('deals collision damage to both units when a displace is stopped', () => {
    const s = setup({'p-storm': at(2, 1), 'e-bokh': at(3, 1), 'e-storm': at(4, 1)});
    const before = [unit(s, 'e-bokh').hp, unit(s, 'e-storm').hp];
    const b = unit(s, 'e-bokh');
    displace({state: s, map: SALT_FLATS, slot: 0}, b, hexDirectionTo(at(2, 1), at(3, 1))!, 1);
    expect(unit(s, 'e-bokh').hex).toEqual(at(3, 1));
    expect(unit(s, 'e-bokh').hp).toBe(before[0]! - RULES.collisionDamage);
    expect(unit(s, 'e-storm').hp).toBe(before[1]! - RULES.collisionDamage);
  });

  it('hurts a unit entering quicksand, through its defence', () => {
    const s = setup({'p-bokh': at(1, 3), 'e-bokh': at(7, 0)});
    const b = unit(s, 'p-bokh');
    applyTurn(s, b, {move: [at(2, 3)], action: {ability: 'hold'}});
    expect(b.hp).toBe(b.maxHp - defended(b, RULES.hazardEnterDamage));
  });

  it('hurts a unit on quicksand every slot the track passes, turn or not', () => {
    const s = setup({'p-bokh': at(2, 3), 'p-storm': at(0, 0), 'e-bokh': at(7, 0)});
    s.units.forEach((u) => (u.controller = 'human'));
    const b = unit(s, 'p-bokh');
    b.slot = 200;
    unit(s, 'p-storm').slot = 10;
    advance(s, chooseAiTurn);
    // Slots 1 to 10 passed: the Storm Caller's turn, not the Bökh's.
    expect(actingUnit(s)!.id).toBe('p-storm');
    expect(b.hp).toBe(b.maxHp - defended(b, 10 * RULES.hazardDamage));
    // Another unit's turn on the same slot passes no more.
    s.awaiting = null;
    unit(s, 'p-storm').slot = null;
    unit(s, 'e-bokh').slot = 10;
    advance(s, chooseAiTurn);
    expect(b.hp).toBe(b.maxHp - defended(b, 10 * RULES.hazardDamage));
  });
});

describe('abilities', () => {
  it('shows every bow lane to its range, stopping at the first unit or an obstacle', () => {
    const s = setup({'p-mangudai': at(-1, 3), 'e-bokh': at(8, 6)});
    const from = at(-1, 3);
    const east = (l: ReturnType<typeof arrowLanes>) => l[0]!;
    // Nothing in the way: the lane still runs its full range.
    let lanes = arrowLanes(s, mapOf(s), from);
    expect(lanes).toHaveLength(6);
    expect(east(lanes)).toEqual({hexes: [at(0, 3), at(1, 3), at(2, 3), at(3, 3), at(4, 3)]});
    expect(ABILITIES.bow.targets(s, mapOf(s), unit(s, 'p-mangudai'), from)).toEqual([]);
    // A unit in it: the lane ends there, and that unit is the bow's target.
    unit(s, 'e-bokh').hex = at(2, 3);
    lanes = arrowLanes(s, mapOf(s), from);
    expect(east(lanes).hexes).toEqual([at(0, 3), at(1, 3), at(2, 3)]);
    expect(east(lanes).hit!.id).toBe('e-bokh');
    expect(ABILITIES.bow.targets(s, mapOf(s), unit(s, 'p-mangudai'), from)).toEqual([
      {hex: at(2, 3)},
    ]);
  });

  it('the bow hits the first unit on its line, an ally included, never past it', () => {
    const s = setup({
      'p-mangudai': at(0, 0),
      'p-bokh': at(1, 0),
      'e-bokh': at(3, 0),
      'e-storm': at(0, 6),
    });
    const m = unit(s, 'p-mangudai');
    const targets = ABILITIES.bow.targets(s, mapOf(s), m, m.hex!);
    expect(
      targets.some(
        (t) => t.hex!.q === unit(s, 'e-bokh').hex!.q && t.hex!.r === unit(s, 'e-bokh').hex!.r
      )
    ).toBe(false);
    expect(
      targets.some(
        (t) => t.hex!.q === unit(s, 'p-bokh').hex!.q && t.hex!.r === unit(s, 'p-bokh').hex!.r
      )
    ).toBe(true);
    const hp = unit(s, 'p-bokh').hp;
    applyTurn(s, m, {action: {ability: 'bow', target: {hex: at(1, 0)}}});
    expect(unit(s, 'p-bokh').hp).toBeLessThan(hp);
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

  it('Pin crushes its target every slot while it lasts', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1)});
    s.units.forEach((u) => (u.controller = 'human'));
    const target = unit(s, 'e-storm');
    applyTurn(s, unit(s, 'p-bokh'), {action: {ability: 'pin', target: {hex: at(2, 1)}}});
    // The Champion's card is next; push it past the pin so the target's turn comes first.
    unit(s, 'p-bokh').slot = 200;
    target.slot = ABILITY.pin.slots + 8;
    advance(s, chooseAiTurn);
    // Slots 1 to 12 crush it, scaled by the Champion's power, through Pin's
    // Vulnerable each slot and its defence on the total; nothing after.
    const perSlot = Math.floor(
      scaled(ABILITY.pin.damagePerSlot, unit(s, 'p-bokh').power) *
        (1 + ABILITY.pin.vulnerable / 100)
    );
    expect(actingUnit(s)!.id).toBe('e-storm');
    expect(target.hp).toBe(target.maxHp - defended(target, ABILITY.pin.slots * perSlot));
  });

  it('Pin taunts: the target must attack the Champion or Hold while it can', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-mangudai': at(2, 1), 'p-storm': at(4, 1)});
    applyTurn(s, unit(s, 'p-bokh'), {action: {ability: 'pin', target: {hex: at(2, 1)}}});
    const m = unit(s, 'e-mangudai');
    // The Storm Caller is in a bow lane too, but only the Champion may be shot (or the turn Held).
    expect(arrowLanes(s, SALT_FLATS, m.hex!).some((l) => l.hit?.id === 'p-storm')).toBe(true);
    const stormHex = unit(s, 'p-storm').hex!;
    expect(tryTurn(s, m.id, {action: {ability: 'bow', target: {hex: stormHex}}})).toThrow(
      RuleError
    );
    expect(tryTurn(s, m.id, {action: {ability: 'hold'}})).not.toThrow();
    expect(chooseAiTurn(s, m).action).toEqual({ability: 'bow', target: {hex: at(1, 1)}});
    // The taunt ends with the taunter.
    unit(s, 'p-bokh').alive = false;
    unit(s, 'p-bokh').hex = null;
    expect(
      tryTurn(s, m.id, {action: {ability: 'bow', target: {hex: unit(s, 'p-storm').hex!}}})
    ).not.toThrow();
  });

  it('a taunt that can’t be obeyed leaves the target free', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1), 'e-bokh': at(8, 6)});
    applyTurn(s, unit(s, 'p-bokh'), {action: {ability: 'pin', target: {hex: at(2, 1)}}});
    const hailElsewhere = {action: {ability: 'hail' as const, target: {hex: at(2, 3)}}};
    expect(tryTurn(s, 'e-storm', hailElsewhere)).toThrow(RuleError);
    // Thrown out of the Storm Caller's reach (it's Immobilized): it acts freely.
    unit(s, 'p-bokh').hex = at(7, 5);
    expect(tryTurn(s, 'e-storm', hailElsewhere)).not.toThrow();
  });

  it('Taunt draws a damaging charge onto the taunter', () => {
    const s = setup({'p-bokh': at(3, 1), 'e-mangudai': at(4, 1), 'p-storm': at(4, 5)});
    s.units.forEach((u) => (u.controller = 'human'));
    const m = unit(s, 'e-mangudai');
    m.turnsTaken = RULES.ultimateUnlockTurns;
    m.slot = 1;
    m.charging = {ability: 'volley', target: at(4, 5)};
    m.statuses.push({kind: 'taunted', value: 0, untilSlot: 50, source: 'p-bokh'});
    const storm = unit(s, 'p-storm');
    advance(s, chooseAiTurn);
    expect(storm.hp).toBe(storm.maxHp);
    expect(unit(s, 'p-bokh').hp).toBeLessThan(unit(s, 'p-bokh').maxHp);
  });

  it('Dash rides any distance up to its limit', () => {
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(8, 0)});
    const m = unit(s, 'p-mangudai');
    const ends = ABILITIES.dash
      .targets(s, SALT_FLATS, m, m.hex!)
      .map((t) => hexDistance(t.hex!, m.hex!));
    expect(new Set(ends)).toEqual(
      new Set(Array.from({length: ABILITY.dash.distance}, (_, i) => i + 1))
    );
  });

  it('Rampage hits each unit once and knocks it aside', () => {
    const s = setup({
      'p-bokh': at(1, 0),
      'e-bokh': at(3, 0),
      'e-storm': at(2, 1),
      'e-mangudai': at(8, 6),
    });
    const b = unit(s, 'p-bokh');
    b.turnsTaken = RULES.ultimateUnlockTurns;
    const hp = [unit(s, 'e-bokh').hp, unit(s, 'e-storm').hp];
    applyTurn(s, b, {action: {ability: 'rampage', target: {hex: at(2, 0)}}});
    expect(unit(s, 'e-bokh').hp).toBeLessThan(hp[0]!);
    expect(unit(s, 'e-storm').hp).toBeLessThan(hp[1]!);
    expect(hexDistance(b.hex!, at(1, 0))).toBeGreaterThan(0);
    expect(unitAt(s, b.hex!)).toBe(b);
  });

  it('Rampage hits allies too', () => {
    const s = setup({'p-bokh': at(1, 0), 'p-storm': at(2, 1), 'e-bokh': at(8, 6)});
    const b = unit(s, 'p-bokh');
    b.turnsTaken = RULES.ultimateUnlockTurns;
    const hp = unit(s, 'p-storm').hp;
    applyTurn(s, b, {action: {ability: 'rampage', target: {hex: at(2, 0)}}});
    expect(unit(s, 'p-storm').hp).toBeLessThan(hp);
  });

  it('Sunlight heals and cleanses every unit within its radius, enemies included', () => {
    const s = setup({
      'p-storm': at(1, 3),
      'p-bokh': at(1, 2),
      'e-bokh': at(2, 3),
      'e-mangudai': at(8, 6),
    });
    expect(hexDistance(at(1, 3), at(1, 2))).toBeLessThanOrEqual(ABILITY.sunlight.radius);
    expect(hexDistance(at(1, 3), at(2, 3))).toBeLessThanOrEqual(ABILITY.sunlight.radius);
    unit(s, 'p-bokh').hp = 100;
    unit(s, 'p-bokh').statuses.push({kind: 'slowed', value: 2, untilSlot: 999});
    unit(s, 'e-bokh').hp = 100;
    unit(s, 'e-bokh').statuses.push({kind: 'vulnerable', value: 25, untilSlot: 999});
    applyTurn(s, unit(s, 'p-storm'), {action: {ability: 'sunlight'}});
    expect(unit(s, 'p-bokh').hp).toBeGreaterThan(100);
    expect(unit(s, 'p-bokh').statuses).toHaveLength(0);
    expect(unit(s, 'e-bokh').hp).toBeGreaterThan(100);
    expect(unit(s, 'e-bokh').statuses).toHaveLength(0);
  });

  it('hail slows and exposes whoever stands on it', () => {
    const s = setup({'p-storm': at(1, 3), 'e-bokh': at(3, 1), 'e-mangudai': at(8, 6)});
    applyTurn(s, unit(s, 'p-storm'), {action: {ability: 'hail', target: {hex: at(3, 1)}}});
    expect(movementCap(unit(s, 'e-bokh'))).toBe(RULES.movementCap - ABILITY.hail.slowed);
    expect(s.effects).toHaveLength(1);
  });

  it('hail strikes whoever stands on it, before its own Vulnerable', () => {
    const s = setup({'p-storm': at(1, 3), 'e-bokh': at(3, 1), 'e-mangudai': at(8, 6)});
    const bokh = unit(s, 'e-bokh');
    const hp = bokh.hp;
    const scaledHail = Math.floor(ABILITY.hail.damage * (1 + unit(s, 'p-storm').power / 50));
    const expected = Math.floor(
      (scaledHail * RULES.defenceConstant) / (bokh.defence + RULES.defenceConstant)
    );
    applyTurn(s, unit(s, 'p-storm'), {action: {ability: 'hail', target: {hex: at(3, 1)}}});
    expect(expected).toBeGreaterThan(1);
    expect(unit(s, 'e-bokh').hp).toBe(hp - expected);
  });
});

describe('previews, the AI and the run', () => {
  it('a Hold without a move is cheap and doesn’t count toward the ultimate', () => {
    const s = setup({'p-mangudai': at(0, 3), 'e-bokh': at(8, 0)});
    const m = unit(s, 'p-mangudai');
    m.slot = s.currentSlot = 100;
    applyTurn(s, m, {action: {ability: 'hold'}});
    expect(m.slot).toBe(100 + slotsForward(ABILITY.hold.cost, m.speed));
    expect(m.turnsTaken).toBe(0);
    // Moving, then Holding, does count.
    s.currentSlot = m.slot!;
    applyTurn(s, m, {move: [at(1, 3)], action: {ability: 'hold'}});
    expect(m.turnsTaken).toBe(1);
  });

  it('acts then moves: the move starts where the action left the unit', () => {
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(4, 3)});
    const m = unit(s, 'p-mangudai');
    const shot = {ability: 'bow' as const, target: {hex: at(4, 3)}};
    // Shoot from range, then step back out of reach.
    const turn: TurnInput = {action: shot, move: [at(0, 3)], actFirst: true};
    expect(previewTurn(s, m.id, turn)).not.toBeNull();
    applyTurn(s, m, turn);
    expect(m.hex).toEqual(at(0, 3));
    expect(unit(s, 'e-bokh').hp).toBeLessThan(unit(s, 'e-bokh').maxHp);
  });

  it('a Pin first leaves nothing to move: the unit is Immobilized', () => {
    const s = setup({'p-bokh': at(1, 3), 'e-bokh': at(2, 3)});
    const pin = {ability: 'pin' as const, target: {hex: at(2, 3)}};
    const after = afterAction(s, 'p-bokh', pin)!;
    expect(
      reachableHexes(after.state, mapOf(after.state), after.unit).filter((r) => r.path.length > 0)
    ).toEqual([]);
    expect(() =>
      applyTurn(s, unit(s, 'p-bokh'), {action: pin, move: [at(0, 3)], actFirst: true})
    ).toThrow(RuleError);
  });

  it('a preview matches the outcome', () => {
    const run = handleRunAction(createRun(3), {
      type: 'deploy',
      placements: defaultDeployment(createRun(3).fight),
    });
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

  it('a preview shows where the card aims and where it yields to', () => {
    const s = setup({'p-bokh': at(1, 3), 'e-bokh': at(5, 3), 'e-storm': at(6, 3)});
    const bokh = unit(s, 'p-bokh');
    s.awaiting = bokh.id;
    const input: TurnInput = {action: {ability: 'hold'}};
    const aim = slotsForward(ABILITIES.hold.cost, bokh.speed);
    expect(previewTurn(s, bokh.id, input)).toMatchObject({aimSlot: aim, slot: aim});
    // Cards in the aimed slot and the one after: the card yields past both.
    unit(s, 'e-bokh').slot = aim;
    unit(s, 'e-storm').slot = aim + 1;
    expect(previewTurn(s, bokh.id, input)).toMatchObject({aimSlot: aim, slot: aim + 2});
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

  it('sees what enemies could do before its next turn, and arrows stop at the first unit', () => {
    const s = setup({'p-mangudai': at(0, 0), 'e-mangudai': at(8, 0), 'e-bokh': at(8, 6)});
    const m = unit(s, 'p-mangudai');
    const threats = threatsTo(s, SALT_FLATS, m);
    const at3 = (h: Hex) => {
      const c = cloneFight(s);
      const me = unit(c, 'p-mangudai');
      me.hex = h;
      me.slot = c.currentSlot + 1;
      return threatDamage(threats, c, SALT_FLATS, me, c.currentSlot);
    };
    // The enemy archer moves up to 4 and shoots 5 along a hex line: the row is in reach…
    unit(s, 'e-mangudai').slot = 0;
    expect(at3(at(2, 0))).toBeGreaterThan(0);
    // …but not with a unit in the lane between, which the arrow would hit instead.
    const blocked = setup({
      'p-mangudai': at(0, 0),
      'p-bokh': at(1, 0),
      'e-mangudai': at(6, 0),
      'e-bokh': at(8, 6),
    });
    unit(blocked, 'e-mangudai').charging = null;
    unit(blocked, 'e-mangudai').statuses.push({kind: 'immobilized', value: 0, untilSlot: 999});
    const bm = unit(blocked, 'p-mangudai');
    const bt = threatsTo(blocked, SALT_FLATS, bm);
    bm.slot = blocked.currentSlot + 1;
    unit(blocked, 'e-mangudai').slot = 0;
    expect(threatDamage(bt, blocked, SALT_FLATS, bm, blocked.currentSlot)).toBe(0);
    // The Champion, a tank, ignores the threat when choosing.
    expect(AI.caution.bokh).toBe(0);
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
    expect(() =>
      handleRunAction(run, {
        type: 'turn',
        action: {ability: 'rampage', target: {hex: {q: 99, r: 99}}},
      })
    ).toThrow(RuleError);
    expect(JSON.stringify(run)).toBe(before);
    expect(
      simulate(run.fight, actingUnit(run.fight)!.id, {
        action: {ability: 'bow', target: {hex: {q: 99, r: 99}}},
      })
    ).toBeNull();
    expect(nextCard(run.fight)).toBeDefined();
  });
});
