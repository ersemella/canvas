import {describe, expect, it} from 'vitest';
import {
  hexDirectionTo,
  hexDistance,
  hexKey,
  hexNeighbors,
  hexToOffset,
  hexToPixel,
  offsetToHex,
} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, AI, HEROES, RULES} from './config';
import {
  isFlanked,
  lineOfFire,
  movementCap,
  reachableHexes,
  unitAt,
  vulnerablePercent,
} from './board';
import {ABILITIES, abilitiesOf, arrowLanes, unusableReason} from './abilities';
import {chooseAiTurn, scoreOptions, simulate} from './ai';
import {threatDamage, threatsTo} from './threat';
import {allowedTargets} from './taunt';
import {onlyHold} from './choices';
import {
  RuleError,
  actingUnit,
  advance,
  advanceToDecision,
  applyTurn,
  cloneFight,
  createFight,
  mapOf,
} from './fight';
import {afterAction, previewTurn} from './preview';
import {SALT_FLATS, onMap, tileAt} from './map';
import {abilityDamage, checkEnd, displace, kill, scaled} from './resolve';
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
 * listed is removed (dead), and cards start far apart. The camel, unless
 * listed, isn't there at all, as in a fight saved before it existed: dead,
 * it would lose the fight.
 */
function setup(placements: Record<string, Hex>): FightState {
  const state = createFight(0);
  // The fixed layout, which these tests place units around.
  delete state.tiles;
  state.phase = 'fight';
  state.units = state.units.filter((u) => u.hero !== 'camel' || u.id in placements);
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
  it('skips a turn with only Hold to choose, and marks it till the unit next acts', () => {
    // Immobilized with no one next to it: Throw and Pin have no target, Rampage moves it.
    const s = setup({'p-bokh': at(1, 1), 'e-bokh': at(6, 4), 'p-storm': at(1, 5)});
    const b = unit(s, 'p-bokh');
    b.statuses.push({kind: 'immobilized', value: 0, untilSlot: 1000});
    s.events = [];
    expect(onlyHold(s, mapOf(s), b)).toBe(true);
    const next = advanceToDecision(s)!;
    expect(next.id).not.toBe('p-bokh');
    expect(s.events.some((e) => e.kind === 'skip' && e.unitId === 'p-bokh')).toBe(true);
    expect(b.skipped).toBe(true);
    // Each skip Holds: skipped again and again until the next unit's card comes first.
    const skips = s.events.filter((e) => e.kind === 'skip').length;
    expect(b.slot).toBe(100 + skips * slotsForward(ABILITY.hold.cost, b.speed));
    expect(b.slot).toBeGreaterThan(next.slot!);
    // Free again by its next turn: it acts, and the mark goes.
    b.statuses = [];
    for (let u = next; u.id !== 'p-bokh'; u = advanceToDecision(s)!)
      applyTurn(s, u, {action: {ability: 'hold'}});
    expect(b.skipped).toBeUndefined();
  });

  it('skips a unit whose only targets are allies', () => {
    // Allies aren't offered as targets, so an Immobilized archer with only an ally in its lanes holds.
    const s = setup({'p-mangudai': at(1, 1), 'p-storm': at(3, 1), 'e-bokh': at(6, 6)});
    const m = unit(s, 'p-mangudai');
    m.statuses.push({kind: 'immobilized', value: 0, untilSlot: 120});
    expect(arrowLanes(s, mapOf(s), m.hex!).some((l) => l.hit?.id === 'p-storm')).toBe(true);
    expect(arrowLanes(s, mapOf(s), m.hex!).some((l) => l.hit?.side === 'enemy')).toBe(false);
    expect(onlyHold(s, mapOf(s), m)).toBe(true);
    // An enemy in an open lane gives it a shot.
    const open = arrowLanes(s, mapOf(s), m.hex!).find((l) => !l.hit && l.hexes.length > 0)!;
    unit(s, 'e-bokh').hex = open.hexes[0]!;
    expect(onlyHold(s, mapOf(s), m)).toBe(false);
  });

  it('places by cost × speedScale ÷ (speed + C), rounding down, at least 1 slot (3.2)', () => {
    // The brief's worked example: speed 25, 2 hexes and a typical attack.
    expect(slotsForward(turnCost(100, 2), 25)).toBe(12);
    expect(slotsForward(turnCost(100, 2), 40)).toBe(9);
    expect(slotsForward(1, 40)).toBe(1);
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

  it('starts each side on its outermost column, scattered by the seed, with no deployment', () => {
    const map = SALT_FLATS;
    const starts = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const s = createFight(seed);
      expect(s.phase).toBe('fight');
      expect(JSON.stringify(createFight(seed))).toBe(JSON.stringify(s));
      for (const side of ['player', 'enemy'] as const) {
        const column = new Set(map.startColumns[side].map(hexKey));
        const hexes = s.units.filter((u) => u.side === side).map((u) => hexKey(u.hex!));
        expect(hexes.every((h) => column.has(h))).toBe(true);
        expect(new Set(hexes).size).toBe(hexes.length);
      }
      starts.add(s.units.map((u) => hexKey(u.hex!)).join(' '));
      expect(s.units.every((u) => u.slot !== null)).toBe(true);
    }
    expect(starts.size).toBeGreaterThan(10);
    for (const h of map.startColumns.player) expect([-1, 0]).toContain(hexToOffset(h).col);
    for (const h of map.startColumns.enemy) expect(hexToOffset(h).col).toBe(7);
  });

  it('orders simultaneous placement: speed, then sides alternating from the player, then party order', () => {
    const s = createFight(0);
    const order = simultaneousOrder(s.units).map((u) => u.id);
    // Outriders are fastest; the heroes after them tie, so they alternate
    // sides; the camel, slowest, is last.
    expect(order).toEqual([
      'p-mangudai',
      'e-mangudai',
      'p-bokh',
      'e-bokh',
      'p-storm',
      'e-storm',
      'p-camel',
    ]);
  });

  it('starts equal speeds in an order drawn from the seed, the faster still first', () => {
    const startOrder = (seed: number) =>
      createFight(seed)
        .units.slice()
        .sort((a, b) => a.slot! - b.slot!)
        .map((u) => u.id);
    const orders = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const order = startOrder(seed);
      expect(order).toEqual(startOrder(seed));
      // The camel always acts first; then the Outriders, fastest, in either order.
      expect(order[0]).toBe('p-camel');
      expect(new Set(order.slice(1, 3))).toEqual(new Set(['p-mangudai', 'e-mangudai']));
      orders.add(order.join());
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('starts every card from the starting cost, without two in one slot (3.4)', () => {
    const s = createFight(1);
    const slots = s.units.map((u) => u.slot);
    expect(new Set(slots).size).toBe(7);
    // The Outriders tie as fastest: whichever is placed first gets the formula's slot.
    expect(Math.min(unit(s, 'p-mangudai').slot!, unit(s, 'e-mangudai').slot!)).toBe(
      Math.floor((RULES.startCost * RULES.speedScale) / (unit(s, 'p-mangudai').speed + RULES.C))
    );
  });

  it('spaces the starting cards by speed, as far apart as a typical turn would put them', () => {
    const s = createFight(0);
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
    m.ultimateCharge = RULES.ultimateCharge;
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

  it('Freeze damages, then Immobilizes and exposes, every unit in its area', () => {
    const s = setup({'p-storm': at(1, 3), 'e-bokh': at(4, 3), 'e-storm': at(7, 6)});
    const caster = unit(s, 'p-storm');
    caster.ultimateCharge = RULES.ultimateCharge;
    s.currentSlot = 100;
    s.awaiting = caster.id;
    applyTurn(s, caster, {action: {ability: 'freeze', target: {hex: at(4, 3)}}});
    const b = unit(s, 'e-bokh');
    const hpBefore = b.hp;
    b.slot = 500;
    unit(s, 'e-storm').slot = 600;
    advance(s, () => ({action: {ability: 'hold'}}));
    expect(b.hp).toBeLessThan(hpBefore);
    expect(b.statuses.map((x) => x.kind)).toEqual(
      expect.arrayContaining(['immobilized', 'vulnerable'])
    );
    expect(vulnerablePercent(s, b)).toBeGreaterThanOrEqual(ABILITY.freeze.vulnerable);
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
    const zone = new Set(map.startColumns.enemy.map(hexKey));
    for (const h of map.startColumns.player) expect(zone.has(hexKey(mirror(h)!))).toBe(true);
    expect(map.startColumns.player.some((h) => hexToOffset(h).col === -1)).toBe(true);
    // Every feature has its mirror image.
    for (const [key, tile] of Object.entries(map.tiles)) {
      const [q, r] = key.split(',').map(Number);
      expect(map.tiles[hexKey(mirror({q: q!, r: r!})!)]).toBe(tile);
    }
  });

  it('scatters each fight’s ruins and quicksand by its seed: unmirrored, clear of the edges, the board connected', () => {
    const count = (tiles: Record<string, string>, t: string) =>
      Object.values(tiles).filter((v) => v === t).length;
    const conceal = Object.keys(SALT_FLATS.tiles).filter((k) => SALT_FLATS.tiles[k] === 'conceal');
    const layouts = new Set<string>();
    let asymmetric = 0;
    for (let seed = 0; seed < 40; seed++) {
      const s = createFight(seed);
      const map = mapOf(s);
      expect(map.tiles).toBe(s.tiles);
      expect(JSON.stringify(createFight(seed).tiles)).toBe(JSON.stringify(s.tiles));
      expect(count(map.tiles, 'obstacle')).toBe(4);
      expect(count(map.tiles, 'hazard')).toBe(2);
      for (const k of conceal) expect(map.tiles[k]).toBe('conceal');
      const ruinRows = [];
      for (const [key, tile] of Object.entries(map.tiles)) {
        const [q, r] = key.split(',').map(Number);
        const {col, row} = hexToOffset({q: q!, r: r!});
        // Two columns clear of each edge.
        if (tile !== 'conceal') expect(col >= (row & 1 ? 1 : 2) && col <= 5).toBe(true);
        if (tile === 'obstacle') ruinRows.push(row);
      }
      expect(ruinRows.filter((r) => r <= 3)).toHaveLength(2);
      expect(ruinRows.filter((r) => r >= 5)).toHaveLength(2);
      // Every open hex can be walked to from every other.
      const open = map.hexes.filter((h) => tileAt(map, h) !== 'obstacle');
      const seen = new Set([hexKey(open[0]!)]);
      const queue = [open[0]!];
      for (let h; (h = queue.shift()); )
        for (const n of hexNeighbors(h))
          if (onMap(map, n) && tileAt(map, n) !== 'obstacle' && !seen.has(hexKey(n))) {
            seen.add(hexKey(n));
            queue.push(n);
          }
      expect(seen.size).toBe(open.length);
      layouts.add(JSON.stringify(s.tiles));
      const mirrored = Object.entries(map.tiles).every(([key, tile]) => {
        const [q, r] = key.split(',').map(Number);
        const {col, row} = hexToOffset({q: q!, r: r!});
        return map.tiles[hexKey(offsetToHex({col: (row & 1 ? 6 : 7) - col, row}))] === tile;
      });
      if (!mirrored) asymmetric++;
    }
    expect(layouts.size).toBeGreaterThan(20);
    expect(asymmetric).toBeGreaterThan(30);
  });

  it('blocks allies, enemies and obstacles, routing around units', () => {
    const s = setup({'p-bokh': at(0, 3), 'p-storm': at(1, 3), 'e-bokh': at(1, 2)});
    const reach = reachableHexes(s, mapOf(s), unit(s, 'p-bokh'));
    const keys = reach.map((r) => `${r.hex.q},${r.hex.r}`);
    const key = (h: Hex) => `${h.q},${h.r}`;
    expect(keys).not.toContain(key(at(1, 3))); // ally's hex
    expect(keys).not.toContain(key(at(1, 2))); // enemy
    expect(keys).not.toContain(key(at(2, 2))); // ruins
    for (const r of reach) expect(r.path.map(key)).not.toContain(key(at(1, 3)));
    expect(
      simulate(s, 'p-bokh', {move: [at(1, 3), at(2, 3)], action: {ability: 'hold'}})
    ).toBeNull();
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

  it('a sandstorm Obscures: halves ranged hits on its occupant and by it', () => {
    const s = setup({'p-mangudai': at(0, 2), 'e-bokh': at(4, 2)});
    const m = unit(s, 'p-mangudai');
    const b = unit(s, 'e-bokh');
    const onConceal = abilityDamage(s, mapOf(s), m, b, 60, true);
    b.hex = at(4, 0);
    const inOpen = abilityDamage(s, mapOf(s), m, b, 60, true);
    expect(onConceal).toBeLessThan(inOpen);
    expect(abilityDamage(s, mapOf(s), m, b, 60, false)).toBe(inOpen);
    m.hex = at(4, 2);
    expect(abilityDamage(s, mapOf(s), m, b, 60, true)).toBe(onConceal);
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

  it('an arrow flying through an Obscured hex deals less, once however many', () => {
    // Row 5's sandstorm is at column 3, between ruins at 1 and 5.
    const s = setup({'p-mangudai': at(2, 5), 'e-bokh': at(4, 5)});
    const m = unit(s, 'p-mangudai');
    const b = unit(s, 'e-bokh');
    const map = mapOf(s);
    const open = abilityDamage(s, map, m, b, ABILITY.bow.damage, true);
    const through = abilityDamage(s, map, m, b, ABILITY.bow.damage, true, [at(3, 5)]);
    expect(through).toBeLessThan(open);
    expect(abilityDamage(s, map, m, b, ABILITY.bow.damage, true, [at(3, 5), at(3, 5)])).toBe(
      through
    );
    const hp = b.hp;
    applyTurn(s, m, {action: {ability: 'bow', target: {hex: at(4, 5)}}});
    expect(b.hp).toBe(hp - through);
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
  it('shows every bow lane to the map’s edge, stopping at the first unit or an obstacle', () => {
    const s = setup({'p-mangudai': at(-1, 3), 'e-bokh': at(8, 6)});
    const from = at(-1, 3);
    const east = (l: ReturnType<typeof arrowLanes>) => l[0]!;
    // Nothing in the way: the bow has no range limit, so the lane runs to the edge.
    let lanes = arrowLanes(s, mapOf(s), from);
    expect(lanes).toHaveLength(6);
    expect(east(lanes)).toEqual({hexes: [0, 1, 2, 3, 4, 5, 6, 7].map((c) => at(c, 3))});
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
    // Thrown to another hex beside the Champion: the hold isn't broken,
    // and the Champion itself was never held.
    expect(b.statuses).toEqual([]);
  });

  it('Pin: the Champion is free, and walking away releases the target', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1), 'e-bokh': at(8, 6)});
    const b = unit(s, 'p-bokh');
    const target = unit(s, 'e-storm');
    applyTurn(s, b, {action: {ability: 'pin', target: {hex: at(2, 1)}}});
    expect(b.statuses).toEqual([]);
    const away = reachableHexes(s, mapOf(s), b).find(
      (r) => r.path.length === 1 && hexDistance(r.path[0]!, target.hex!) === 2
    )!;
    applyTurn(s, b, {move: away.path, action: {ability: 'hold'}});
    expect(target.statuses).toEqual([]);
  });

  it('Pin: displacing the target away breaks the pin, freeing it', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1), 'e-bokh': at(8, 6)});
    const b = unit(s, 'p-bokh');
    const target = unit(s, 'e-storm');
    applyTurn(s, b, {action: {ability: 'pin', target: {hex: at(2, 1)}}});
    expect(target.statuses.some((x) => x.kind === 'immobilized')).toBe(true);
    displace({state: s, map: SALT_FLATS, slot: 0}, target, hexDirectionTo(at(1, 1), at(2, 1))!, 1);
    expect(hexDistance(target.hex!, b.hex!)).toBe(2);
    // Breaking it clears everything the Pin gave the target.
    expect(target.statuses).toEqual([]);
  });

  it('Pin: cleansing the Champion keeps the pin', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-mangudai': at(2, 1), 'p-storm': at(0, 1)});
    const b = unit(s, 'p-bokh');
    const target = unit(s, 'e-mangudai');
    applyTurn(s, b, {action: {ability: 'pin', target: {hex: at(2, 1)}}});
    applyTurn(s, unit(s, 'p-storm'), {action: {ability: 'sunlight', target: {hex: at(1, 1)}}});
    expect(target.statuses.map((x) => x.kind).sort()).toEqual([
      'crushed',
      'immobilized',
      'taunted',
    ]);
  });

  it('Pin: cleansing the target breaks the pin', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-mangudai': at(2, 1), 'e-storm': at(3, 1)});
    const b = unit(s, 'p-bokh');
    const target = unit(s, 'e-mangudai');
    applyTurn(s, b, {action: {ability: 'pin', target: {hex: at(2, 1)}}});
    applyTurn(s, unit(s, 'e-storm'), {action: {ability: 'sunlight', target: {hex: at(2, 1)}}});
    expect(target.statuses).toEqual([]);
    expect(b.statuses).toEqual([]);
  });

  it('Sunlight clears hail and fog from its target’s hex only', () => {
    const s = setup({'p-storm': at(1, 1), 'p-bokh': at(2, 1), 'e-bokh': at(8, 6)});
    const until = 999;
    const effect = (h: Hex) => ({
      kind: 'hail' as const,
      hex: h,
      untilSlot: until,
      damage: 50,
      slowed: 2,
      statusSlots: 10,
    });
    s.effects = [effect(at(2, 1)), effect(at(3, 1))];
    s.fog = [
      {hex: at(2, 1), untilSlot: until},
      {hex: at(3, 1), untilSlot: until},
    ];
    applyTurn(s, unit(s, 'p-storm'), {action: {ability: 'sunlight', target: {hex: at(2, 1)}}});
    expect(s.effects.map((e) => e.hex)).toEqual([at(3, 1)]);
    expect(s.fog.map((f) => f.hex)).toEqual([at(3, 1)]);
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
    // Slots 1 to 12 crush it, scaled by the Champion's power, through its
    // defence on the total; nothing after.
    const perSlot = scaled(ABILITY.pin.damagePerSlot, unit(s, 'p-bokh').power);
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
    // The page offers the same: only the Champion.
    expect(allowedTargets(s, SALT_FLATS, m, ABILITIES.bow)).toEqual([{hex: at(1, 1)}]);
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
    m.ultimateCharge = RULES.ultimateCharge;
    m.slot = 1;
    m.charging = {ability: 'volley', target: at(4, 5)};
    m.statuses.push({kind: 'taunted', value: 0, untilSlot: 50, source: 'p-bokh'});
    const storm = unit(s, 'p-storm');
    advance(s, chooseAiTurn);
    expect(storm.hp).toBe(storm.maxHp);
    expect(unit(s, 'p-bokh').hp).toBeLessThan(unit(s, 'p-bokh').maxHp);
  });

  it('Leap lands exactly two hexes on, over ruins, a unit or quicksand', () => {
    // Ruins at (2, 2); quicksand at (2, 3), with an enemy standing in it.
    const s = setup({'p-mangudai': at(1, 2), 'e-bokh': at(8, 0)});
    const m = unit(s, 'p-mangudai');
    const ends = ABILITIES.leap.targets(s, SALT_FLATS, m, m.hex!).map((t) => t.hex!);
    expect(ends.every((h) => hexDistance(h, m.hex!) === 2)).toBe(true);
    expect(ends).toContainEqual(at(3, 2));
    // Never onto a unit.
    unit(s, 'e-bokh').hex = at(3, 2);
    expect(ABILITIES.leap.targets(s, SALT_FLATS, m, m.hex!)).not.toContainEqual({hex: at(3, 2)});

    const t = setup({'p-mangudai': at(1, 3), 'e-bokh': at(2, 3)});
    const leaper = unit(t, 'p-mangudai');
    const hp = leaper.hp;
    applyTurn(t, leaper, {action: {ability: 'leap', target: {hex: at(3, 3)}}});
    expect(leaper.hex).toEqual(at(3, 3));
    expect(leaper.hp).toBe(hp);
  });

  it('Rampage hits each unit once and knocks it aside', () => {
    const s = setup({
      'p-bokh': at(1, 0),
      'e-bokh': at(3, 0),
      'e-storm': at(2, 1),
      'e-mangudai': at(8, 6),
    });
    const b = unit(s, 'p-bokh');
    b.ultimateCharge = RULES.ultimateCharge;
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
    b.ultimateCharge = RULES.ultimateCharge;
    const hp = unit(s, 'p-storm').hp;
    applyTurn(s, b, {action: {ability: 'rampage', target: {hex: at(2, 0)}}});
    expect(unit(s, 'p-storm').hp).toBeLessThan(hp);
  });

  it('Sunlight heals and cleanses the one unit it targets, enemies included', () => {
    const s = setup({
      'p-storm': at(1, 3),
      'p-bokh': at(1, 2),
      'e-bokh': at(2, 3),
      'e-mangudai': at(8, 6),
    });
    const storm = unit(s, 'p-storm');
    for (const id of ['p-bokh', 'e-bokh']) {
      unit(s, id).hp = 100;
      unit(s, id).statuses.push({kind: 'slowed', value: 2, untilSlot: 999});
    }
    // Any unit within range, itself and enemies included; never an empty hex.
    const targets = ABILITIES.sunlight.targets(s, SALT_FLATS, storm, storm.hex!);
    expect(targets.map((t) => hexKey(t.hex!)).sort()).toEqual(
      [at(1, 3), at(1, 2), at(2, 3)].map(hexKey).sort()
    );
    expect(hexDistance(at(1, 3), at(8, 6))).toBeGreaterThan(ABILITY.sunlight.range);
    applyTurn(s, storm, {action: {ability: 'sunlight', target: {hex: at(2, 3)}}});
    expect(unit(s, 'e-bokh').hp).toBeGreaterThan(100);
    expect(unit(s, 'e-bokh').statuses).toHaveLength(0);
    // Its neighbour is left alone.
    expect(unit(s, 'p-bokh').hp).toBe(100);
    expect(unit(s, 'p-bokh').statuses).toHaveLength(1);
  });

  it('hail slows and exposes whoever stands on it', () => {
    const s = setup({'p-storm': at(1, 3), 'e-bokh': at(3, 1), 'e-mangudai': at(8, 6)});
    applyTurn(s, unit(s, 'p-storm'), {action: {ability: 'hail', target: {hex: at(3, 1)}}});
    expect(movementCap(unit(s, 'e-bokh'))).toBe(RULES.movementCap - ABILITY.hail.slowed);
    expect(s.effects).toHaveLength(1);
  });

  it('hail strikes whoever stands on it, through its defence', () => {
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

describe('the caravan’s camel', () => {
  it('acts first in every fight, despite its speed', () => {
    for (let seed = 0; seed < 10; seed++) {
      const s = createFight(seed);
      expect(unit(s, 'p-camel').slot).toBe(0);
      expect(advanceToDecision(s)!.id).toBe('p-camel');
    }
  });

  it('joins the player’s side in the middle of its column, with very high health and no defence', () => {
    for (const seed of [1, 2, 3]) {
      const s = createFight(seed);
      const camel = unit(s, 'p-camel');
      expect(camel.side).toBe('player');
      expect(camel.hex).toEqual(SALT_FLATS.camelStart);
      expect(hexToOffset(camel.hex!)).toEqual({col: 0, row: 4});
      expect(camel.hp).toBe(HEROES.camel.health);
      expect(camel.defence).toBe(0);
      expect(s.units.filter((u) => u.hex && hexKey(u.hex) === hexKey(camel.hex!))).toHaveLength(1);
      expect(s.units.filter((u) => u.side === 'enemy' && u.hero === 'camel')).toHaveLength(0);
    }
  });

  it('wins by reaching one of the four hexes sticking out on the right edge', () => {
    const layout = {orientation: 'pointy' as const, size: 1, origin: {x: 0, y: 0}};
    const x = (h: Hex) => hexToPixel(h, layout).x;
    const right = Math.max(...SALT_FLATS.hexes.map(x));
    const outermost = SALT_FLATS.hexes.filter((h) => Math.abs(x(h) - right) < 1e-9);
    expect(outermost.map(hexKey).sort()).toEqual(SALT_FLATS.exits.map(hexKey).sort());
    expect(SALT_FLATS.exits.map((h) => hexToOffset(h).row)).toEqual([1, 3, 5, 7]);
  });

  it('moves one hex a turn at a typical action’s cost, and can’t attack', () => {
    const s = setup({'p-camel': at(2, 4), 'p-bokh': at(0, 0), 'e-bokh': at(6, 0)});
    const camel = unit(s, 'p-camel');
    camel.slot = 50;
    expect(advanceToDecision(s)).toBe(camel);
    expect(abilitiesOf(camel).map((d) => d.id)).toEqual(['hold']);
    expect(Math.max(...reachableHexes(s, mapOf(s), camel).map((r) => r.path.length))).toBe(1);
    expect(tryTurn(s, 'p-camel', {move: [at(3, 4), at(4, 4)], action: {ability: 'hold'}})).toThrow(
      RuleError
    );
    applyTurn(s, camel, {move: [at(3, 4)], action: {ability: 'hold'}});
    expect(camel.hex).toEqual(at(3, 4));
    expect(camel.slot).toBe(50 + slotsForward(RULES.cost.typical, HEROES.camel.speed));
    expect(s.phase).toBe('fight');
  });

  it('wins the fight on reaching an exit, with enemies still standing', () => {
    const s = setup({'p-camel': at(6, 3), 'p-bokh': at(0, 0), 'e-bokh': at(6, 0)});
    const camel = unit(s, 'p-camel');
    camel.slot = 50;
    advanceToDecision(s);
    applyTurn(s, camel, {move: [at(7, 3)], action: {ability: 'hold'}});
    expect(s.phase).toBe('won');
  });

  it('is game over when it dies, even if the last enemy falls with it', () => {
    const s = setup({'p-camel': at(2, 4), 'p-bokh': at(0, 0), 'e-bokh': at(6, 0)});
    kill({state: s, map: mapOf(s), slot: 0}, unit(s, 'p-camel'));
    expect(s.phase).toBe('lost');
    const both = setup({'p-camel': at(2, 4), 'p-bokh': at(0, 0), 'e-bokh': at(6, 0)});
    unit(both, 'p-camel').alive = false;
    unit(both, 'e-bokh').alive = false;
    checkEnd(both);
    expect(both.phase).toBe('lost');
  });

  it('can’t win alone: the party falling is still a defeat', () => {
    const s = setup({'p-camel': at(2, 4), 'p-bokh': at(0, 0), 'e-bokh': at(6, 0)});
    kill({state: s, map: mapOf(s), slot: 0}, unit(s, 'p-bokh'));
    expect(s.phase).toBe('lost');
  });

  it('is a target the enemy AI finishes, and a walk the player’s AI completes', () => {
    const s = setup({'p-camel': at(3, 4), 'p-bokh': at(0, 0), 'e-bokh': at(4, 4)});
    unit(s, 'p-camel').hp = 1;
    const champion = unit(s, 'e-bokh');
    champion.slot = 50;
    advanceToDecision(s);
    expect(simulate(s, champion.id, chooseAiTurn(s, champion))!.phase).toBe('lost');

    const walk = setup({'p-camel': at(6, 3), 'p-bokh': at(0, 0), 'e-bokh': at(6, 0)});
    const camel = unit(walk, 'p-camel');
    camel.slot = 50;
    advanceToDecision(walk);
    expect(chooseAiTurn(walk, camel).move).toEqual([at(7, 3)]);
  });
});

describe('previews, the AI and the run', () => {
  it('unlocks the ultimate once its action cost is spent, a Hold without a move not counting', () => {
    const s = setup({'p-mangudai': at(0, 3), 'e-bokh': at(8, 0)});
    const m = unit(s, 'p-mangudai');
    m.ultimateCharge = RULES.ultimateCharge - 1;
    expect(unusableReason(m, ABILITIES.volley)).toMatch(/unlocks after 300/);
    m.ultimateCharge = RULES.ultimateCharge;
    expect(unusableReason(m, ABILITIES.volley)).toBeNull();
  });

  it('a Hold without a move is cheap and doesn’t charge the ultimate', () => {
    const s = setup({'p-mangudai': at(0, 3), 'e-bokh': at(8, 0)});
    const m = unit(s, 'p-mangudai');
    m.slot = s.currentSlot = 100;
    applyTurn(s, m, {action: {ability: 'hold'}});
    expect(m.slot).toBe(100 + slotsForward(ABILITY.hold.cost, m.speed));
    expect(m.ultimateCharge).toBe(0);
    // Moving, then Holding, does count.
    s.currentSlot = m.slot!;
    applyTurn(s, m, {move: [at(1, 3)], action: {ability: 'hold'}});
    expect(m.ultimateCharge).toBe(RULES.moveActionCost + RULES.moveCostPerHex);
  });

  it('rejects walking plus an ability in either order without mutating the fight', () => {
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(4, 3)});
    const shot = {ability: 'bow' as const, target: {hex: at(4, 3)}};
    const before = JSON.stringify(s);
    for (const actFirst of [false, true]) {
      const input: TurnInput = {action: shot, move: [at(0, 3)], actFirst};
      expect(previewTurn(s, 'p-mangudai', input)).toBeNull();
      expect(() => applyTurn(s, unit(s, 'p-mangudai'), input)).toThrow(/separate turns/);
      expect(JSON.stringify(s)).toBe(before);
    }
  });

  it('prices walking at 30, 40, 50 and 60, with matching previews and yielding', () => {
    for (const length of [1, 2, 3, 4]) {
      const s = setup({'p-mangudai': at(0, 0), 'e-bokh': at(7, 0)});
      const actor = unit(s, 'p-mangudai');
      const input: TurnInput = {
        move: Array.from({length}, (_, i) => at(i + 1, 0)),
        action: {ability: 'hold'},
      };
      const aim = slotsForward(20 + 10 * length, actor.speed);
      unit(s, 'e-bokh').slot = aim;
      expect(previewTurn(s, actor.id, input)).toMatchObject({
        aimSlot: aim,
        slot: aim + 1,
        charged: false,
      });
      s.events = [];
      applyTurn(s, actor, input);
      expect(actor.slot).toBe(aim + 1);
      expect(actor.ultimateCharge).toBe(20 + 10 * length);
      expect(s.events.some((e) => e.kind === 'action')).toBe(false);
      expect(s.events.filter((e) => e.kind === 'step')).toHaveLength(length);
    }
  });

  it('a Pin and a move in one turn are refused', () => {
    const s = setup({'p-bokh': at(1, 3), 'e-bokh': at(2, 3)});
    const pin = {ability: 'pin' as const, target: {hex: at(2, 3)}};
    expect(() =>
      applyTurn(s, unit(s, 'p-bokh'), {action: pin, move: [at(0, 3)], actFirst: true})
    ).toThrow(RuleError);
  });

  it('a preview matches the outcome', () => {
    const run = createRun(3);
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

  it('gives a run saved with older stats today’s stats, in its view and its next action', () => {
    const run = createRun(0);
    const saved = JSON.parse(JSON.stringify(run));
    // The Outrider as saved before the shared stat scale, in light armour.
    const old = saved.fight.units.find((u: Unit) => u.id === 'p-mangudai');
    Object.assign(old, {speed: 7, defence: 8, power: 40});
    const m = runView(saved).fight.units.find((u) => u.id === 'p-mangudai')!;
    expect([m.speed, m.defence, m.power]).toEqual([
      HEROES.mangudai.speed,
      HEROES.mangudai.defence,
      HEROES.mangudai.power,
    ]);
    // …and its ultimate's progress, counted in turns then, as cost.
    old.turnsTaken = 2;
    delete old.ultimateCharge;
    expect(runView(saved).fight.units.find((u) => u.id === 'p-mangudai')!.ultimateCharge).toBe(
      2 * RULES.cost.typical
    );
    Object.assign(old, {speed: 7, defence: 8});
    const next = handleRunAction(saved, {type: 'turn', action: {ability: 'hold'}});
    expect(next.fight.units.find((u) => u.id === 'p-mangudai')!.speed).toBe(HEROES.mangudai.speed);
  });

  it('plays a whole fight to an end, AI against AI, within the CPU budget per turn', () => {
    // Seed 0 ends. Some fights stall once only
    // Storm Callers can act (no damage to finish with): an open question,
    // see phase-1-brief.md section 11.
    let run = createRun(0);
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
    // The enemy can shoot along its row however far, but cannot walk and shoot this turn.
    unit(s, 'e-mangudai').slot = 0;
    expect(at3(at(2, 0))).toBeGreaterThan(0);
    expect(at3(at(2, 1))).toBe(0);
    // …but not with a unit in the lane between, which the arrow would hit instead.
    const blocked = setup({
      'p-mangudai': at(0, 0),
      'p-bokh': at(1, 0),
      'e-mangudai': at(5, 0),
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
    const run = createRun(0);
    const enemy = run.fight.units.find((u) => u.side === 'enemy')!;
    expect(scoreOptions(run.fight, enemy, 10)).toHaveLength(10);
    const budget = {left: AI.requestSimulations};
    const first = chooseAiTurn(run.fight, enemy, budget);
    expect(budget.left).toBeLessThan(AI.requestSimulations);
    expect(AI.requestSimulations - budget.left).toBeLessThanOrEqual(AI.maxSimulations);
    // Exhaustion never spends beyond the request budget; Hold is always legal.
    const starved = {left: 0};
    expect(chooseAiTurn(run.fight, enemy, starved)).toEqual({action: {ability: 'hold'}});
    expect(starved.left).toBe(0);
    expect(chooseAiTurn(run.fight, enemy, {left: AI.requestSimulations})).toEqual(first);
  });

  it('refuses a turn that isn’t legal without changing the run', () => {
    const run = createRun(1);
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

describe('events for playback', () => {
  it('a run action records what it set off, ending on the board it leaves', () => {
    let run = createRun(0);
    run = handleRunAction(run, {type: 'turn', action: {ability: 'hold'}});
    const events = run.fight.events!;
    expect(events[0]).toMatchObject({kind: 'action', ability: 'hold'});
    // The track runs on to the next human turn, which is the last thing recorded.
    expect(events[events.length - 1]).toMatchObject({kind: 'turn', unitId: run.fight.awaiting});
    const last = events[events.length - 1]!.after;
    for (const u of run.fight.units) {
      expect(last.units.find((s) => s.id === u.id)).toMatchObject({
        hex: u.hex,
        hp: u.hp,
        alive: u.alive,
        slot: u.slot,
      });
    }
    // The next action starts a fresh list.
    const next = handleRunAction(run, {type: 'turn', action: {ability: 'hold'}});
    expect(next.fight.events![0]).toMatchObject({kind: 'action', ability: 'hold'});
  });

  it('records an ability, then its hit with the damage dealt', () => {
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(4, 3)});
    s.events = [];
    const target = unit(s, 'e-bokh');
    const before = target.hp;
    applyTurn(s, unit(s, 'p-mangudai'), {action: {ability: 'bow', target: {hex: at(4, 3)}}});
    expect(s.events.map((e) => e.kind)).toEqual(['action', 'damage']);
    expect(s.events[1]).toMatchObject({unitId: 'e-bokh', amount: before - target.hp});
    expect(s.events[1]!.after.units.find((u) => u.id === 'e-bokh')!.hp).toBe(target.hp);
  });

  it('records each hex of a move, and a push as a push', () => {
    const s = setup({'p-bokh': at(1, 3), 'e-bokh': at(6, 6)});
    s.events = [];
    applyTurn(s, unit(s, 'p-bokh'), {move: [at(1, 4), at(2, 4)], action: {ability: 'hold'}});
    expect(s.events.filter((e) => e.kind === 'step')).toMatchObject([
      {from: at(1, 3), to: at(1, 4), how: 'walk'},
      {from: at(1, 4), to: at(2, 4), how: 'walk'},
    ]);
    s.events = [];
    displace({state: s, map: SALT_FLATS, slot: 0}, unit(s, 'e-bokh'), 3, 1);
    expect(s.events[0]).toMatchObject({kind: 'step', unitId: 'e-bokh', how: 'push'});
  });

  it('copies for previews and the AI record nothing', () => {
    const s = setup({'p-bokh': at(1, 3), 'e-bokh': at(6, 6)});
    s.events = [];
    const copy = cloneFight(s, true);
    expect(copy.events).toBeUndefined();
    applyTurn(copy, unit(copy, 'p-bokh'), {move: [at(1, 4)], action: {ability: 'hold'}});
    expect(copy.events).toBeUndefined();
    expect(s.events).toEqual([]);
  });
});

describe('headless balance experiments', () => {
  it('blocks walking through allies in both reachability and submitted paths', () => {
    const s = setup({'p-mangudai': at(0, 0), 'p-bokh': at(1, 0), 'e-bokh': at(7, 0)});
    const actor = unit(s, 'p-mangudai');
    s.experiment = {blockAllUnits: false, separateMovement: false, moveActionCost: 20};
    const path = [at(1, 0), at(2, 0)];
    expect(simulate(s, actor.id, {move: path, action: {ability: 'hold'}})).not.toBeNull();
    s.experiment = {blockAllUnits: true, separateMovement: false, moveActionCost: 60};
    expect(simulate(s, actor.id, {move: path, action: {ability: 'hold'}})).toBeNull();
    for (const reach of reachableHexes(s, SALT_FLATS, actor))
      expect(reach.path.some((h) => hexKey(h) === hexKey(at(1, 0)))).toBe(false);
  });

  it('rejects move plus ability in either order, prices movement, and leaves defaults intact', () => {
    const s = setup({'p-mangudai': at(0, 0), 'e-bokh': at(4, 0)});
    s.experiment = {blockAllUnits: false, separateMovement: false, moveActionCost: 20};
    const input: TurnInput = {move: [at(1, 0)], action: {ability: 'bow', target: {hex: at(4, 0)}}};
    expect(simulate(s, 'p-mangudai', input)).not.toBeNull();
    s.experiment = {blockAllUnits: false, separateMovement: true, moveActionCost: 100};
    expect(simulate(s, 'p-mangudai', input)).toBeNull();
    expect(simulate(s, 'p-mangudai', {...input, actFirst: true})).toBeNull();
    const moved = simulate(s, 'p-mangudai', {move: [at(1, 0)], action: {ability: 'hold'}})!;
    expect(unit(moved, 'p-mangudai').slot).toBe(
      slotsForward(100 + RULES.moveCostPerHex, unit(s, 'p-mangudai').speed)
    );
    expect(unit(moved, 'p-mangudai').ultimateCharge).toBe(100 + RULES.moveCostPerHex);
    for (const option of scoreOptions(s, unit(s, 'p-mangudai')))
      expect(!option.input.move?.length || option.input.action.ability === 'hold').toBe(true);
  });

  it('does not project a move-and-melee threat under separate movement', () => {
    const s = setup({'p-mangudai': at(0, 0), 'e-bokh': at(3, 0)});
    const actor = unit(s, 'p-mangudai');
    const threatened = (state: FightState) =>
      threatsTo(state, SALT_FLATS, actor)[0]!.hexes.has(
        (actor.hex!.q + 64) * 128 + actor.hex!.r + 64
      );
    s.experiment = {blockAllUnits: false, separateMovement: false, moveActionCost: 20};
    expect(threatened(s)).toBe(true);
    s.experiment = {blockAllUnits: false, separateMovement: true, moveActionCost: 60};
    expect(threatened(s)).toBe(false);
  });
});
