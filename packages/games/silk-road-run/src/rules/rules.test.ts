import {describe, expect, it} from 'vitest';
import {
  hexDirectionTo,
  hexDistance,
  hexEquals,
  hexKey,
  hexNeighbor,
  hexNeighbors,
  hexToOffset,
  hexToPixel,
  offsetToHex,
} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, AI, HEROES, PARTY, ROSTER, RULES, STAGES} from './config';
import {
  canMove,
  isFlanked,
  lineOfFire,
  movementCap,
  reachableHexes,
  roadToExit,
  unitAt,
  vulnerablePercent,
} from './board';
import {ABILITIES, abilitiesOf, arrowLanes, unusableReason} from './abilities';
import {chooseAiTurn, scoreOptions, simulate} from './ai';
import {threatDamage, threatsTo} from './threat';
import {allowedTargets, taunterOf} from './taunt';
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
import {previewTurn} from './preview';
import {SALT_FLATS, onMap, tileAt} from './map';
import {abilityDamage, checkEnd, displace, kill, scaled} from './resolve';
import {advanceLandings, reapCone} from './abilities';
import {barrierOf, cleanse, setBarrier} from './board';
import {
  RUN_FORMAT,
  createRun,
  handleRunAction,
  runOutdated,
  runStatus,
  runView,
  stageEnemies,
} from './run';
import {
  freeSlotFrom,
  nextCard,
  placeCard,
  pushCard,
  simultaneousOrder,
  slotsForward,
  turnCost,
} from './track';
import type {FightState, HeroId, TurnInput, Unit} from './types';
import {withFullKits} from './testKits';

const at = (col: number, row: number): Hex => offsetToHex({col, row});
/** `n` hexes on from `h` along direction `d`. */
const offsetStep = (h: Hex, d: number, n: number): Hex =>
  n === 0 ? h : offsetStep(hexNeighbor(h, d), d, n - 1);

/**
 * A fight in progress with units where a test wants them: every unit not
 * listed is removed (dead), and cards start far apart. The camel, unless
 * listed, isn't there at all: dead, it would lose the fight.
 */
function setup(placements: Record<string, Hex>, party: HeroId[] = PARTY): FightState {
  const state = createFight(0, party, party);
  // The fixed layout, which these tests place units around.
  state.tiles = {...SALT_FLATS.tiles};
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
    // Immobilized with no one next to it: Throw and Grapple have no target, Lunge is locked.
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

  it(
    'charges, triggers when the card is reached, then recovers (3.7)',
    withFullKits(() => {
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
    })
  );

  it(
    'Freeze damages, then Immobilizes and exposes, every unit in its area',
    withFullKits(() => {
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
    })
  );

  it(
    'keeps the ultimate locked until enough turns are taken',
    withFullKits(() => {
      const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(5, 1)});
      const m = unit(s, 'p-mangudai');
      expect(() =>
        applyTurn(cloneFight(s), unit(cloneFight(s), m.id), {
          action: {ability: 'volley', target: {hex: at(5, 1)}},
        })
      ).toThrow(RuleError);
    })
  );
});

describe('the board', () => {
  it('says a unit can move exactly when its reachable hexes include a move', () => {
    const anyMove = (s: FightState, u: Unit) =>
      reachableHexes(s, mapOf(s), u).some((r) => r.path.length > 0);
    let checked = 0;
    let boxedIn = 0;
    for (let seed = 0; seed < 10; seed++) {
      let run = createRun(seed);
      for (let turn = 0; turn < 120 && run.fight.phase === 'fight'; turn++) {
        for (const u of run.fight.units) {
          if (!u.alive) continue;
          expect(canMove(run.fight, mapOf(run.fight), u), `seed ${seed}, ${u.id}`).toBe(
            anyMove(run.fight, u)
          );
          checked++;
          if (!anyMove(run.fight, u)) boxedIn++;
        }
        const input = chooseAiTurn(run.fight, actingUnit(run.fight)!);
        run = handleRunAction(run, {type: 'turn', ...input});
      }
    }
    // Both answers came up, so neither side of the comparison went unchecked.
    expect(checked).toBeGreaterThan(1000);
    expect(boxedIn).toBeGreaterThan(0);
  });

  it('can move through an ally to a free hex when only enemies block (balance experiment)', () => {
    // Each of the corner's three walkable neighbours holds an ally; past
    // the Outrider, the hex beyond is free.
    const s = setup({
      'p-bokh': at(0, 0),
      'p-mangudai': at(1, 0),
      'p-storm': at(0, 1),
      'p-camel': at(-1, 1),
    });
    const champion = unitAt(s, at(0, 0))!;
    expect(canMove(s, SALT_FLATS, champion)).toBe(false);
    s.experiment = {blockAllUnits: false, separateMovement: true, moveActionCost: 20};
    expect(canMove(s, SALT_FLATS, champion)).toBe(true);
    expect(canMove(s, SALT_FLATS, champion)).toBe(
      reachableHexes(s, SALT_FLATS, champion).some((r) => r.path.length > 0)
    );
  });

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

  it('scatters each fight’s ruins by its seed, with no quicksand or sandstorm: unmirrored, clear of the edges, the board connected', () => {
    const count = (tiles: Record<string, string>, t: string) =>
      Object.values(tiles).filter((v) => v === t).length;
    const layouts = new Set<string>();
    let asymmetric = 0;
    for (let seed = 0; seed < 40; seed++) {
      const s = createFight(seed);
      const map = mapOf(s);
      expect(map.tiles).toBe(s.tiles);
      expect(JSON.stringify(createFight(seed).tiles)).toBe(JSON.stringify(s.tiles));
      expect(count(map.tiles, 'obstacle')).toBe(4);
      // Pared back for balancing (owner, 2026-10-22).
      expect(count(map.tiles, 'hazard')).toBe(0);
      expect(count(map.tiles, 'conceal')).toBe(0);
      const ruinRows = [];
      for (const [key, tile] of Object.entries(map.tiles)) {
        const [q, r] = key.split(',').map(Number);
        const {col, row} = hexToOffset({q: q!, r: r!});
        // Two columns clear of each edge.
        expect(col >= (row & 1 ? 1 : 2) && col <= 5).toBe(true);
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
      push: 2,
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
    expect(abilityDamage(s, m, b, base)).toBe(expected);
    b.statuses.push({kind: 'vulnerable', value: 25, untilSlot: 999});
    const vuln = Math.floor(scaled * 1.25);
    expect(abilityDamage(s, m, b, base)).toBe(
      Math.floor((vuln * RULES.defenceConstant) / (b.defence + RULES.defenceConstant))
    );
    b.defence = 1_000_000;
    expect(abilityDamage(s, m, b, base)).toBe(1);
  });

  // Row 5: ruins at columns 1 and 5, a sandstorm at 3 between them.
  it('the bow can’t target a unit in a sandstorm (Obscured)', () => {
    const s = setup({'p-mangudai': at(2, 5), 'e-bokh': at(3, 5)});
    const m = unit(s, 'p-mangudai');
    const targets = ABILITIES.bow.targets(s, mapOf(s), m, m.hex!);
    expect(targets.some((t) => hexEquals(t.hex!, at(3, 5)))).toBe(false);
  });

  it('the bow can’t target through a sandstorm: its lane stops short of it', () => {
    const s = setup({'p-mangudai': at(2, 5), 'e-bokh': at(4, 5)});
    const m = unit(s, 'p-mangudai');
    const targets = ABILITIES.bow.targets(s, mapOf(s), m, m.hex!);
    expect(targets.some((t) => hexEquals(t.hex!, at(4, 5)))).toBe(false);
    const lanes = arrowLanes(s, mapOf(s), m.hex!);
    expect(lanes.some((l) => l.hexes.some((h) => hexEquals(h, at(3, 5))))).toBe(false);
  });

  it('the bow can’t shoot out of a sandstorm, only from outside one', () => {
    const s = setup({'p-mangudai': at(3, 5), 'e-bokh': at(4, 5)});
    const m = unit(s, 'p-mangudai');
    const b = unit(s, 'e-bokh');
    expect(ABILITIES.bow.targets(s, mapOf(s), m, m.hex!)).toEqual([]);
    expect(arrowLanes(s, mapOf(s), m.hex!).every((l) => l.hexes.length === 0)).toBe(true);
    expect(() => applyTurn(s, m, {action: {ability: 'bow', target: {hex: at(4, 5)}}})).toThrow(
      RuleError
    );
    // Swapped, the archer outside the storm hits the unit next to it.
    m.hex = at(4, 5);
    b.hex = at(4, 4);
    const lane = arrowLanes(s, mapOf(s), m.hex).find((l) => l.hit === b);
    expect(lane).toBeDefined();
    expect(ABILITIES.bow.targets(s, mapOf(s), m, m.hex)).toContainEqual({hex: at(4, 4)});
  });

  it('Sunlight can still be aimed out of a sandstorm', () => {
    const s = setup({'p-storm': at(3, 5), 'p-mangudai': at(4, 5)});
    const storm = unit(s, 'p-storm');
    const targets = ABILITIES.sunlight.targets(s, mapOf(s), storm, storm.hex!);
    expect(targets.some((t) => hexEquals(t.hex!, at(4, 5)))).toBe(true);
  });

  it('a bow lane a sandstorm stops says which enemy it hides', () => {
    const s = setup({'p-mangudai': at(1, 5), 'e-bokh': at(3, 5)});
    const map = mapOf(s);
    expect(tileAt(map, at(3, 5))).toBe('conceal');
    const lanes = arrowLanes(s, map, at(1, 5));
    expect(lanes.some((l) => l.hit?.id === 'e-bokh')).toBe(false);
    const stopped = lanes.find((l) => l.hidden?.id === 'e-bokh')!;
    expect(stopped.storm).toEqual(at(3, 5));
    expect(stopped.hexes).toEqual([at(2, 5)]);
  });

  it(
    'Sunlight heals a unit in, or past, a sandstorm',
    withFullKits(() => {
      const s = setup({'p-storm': at(3, 4), 'e-bokh': at(3, 5), 'e-mangudai': at(8, 6)});
      const storm = unit(s, 'p-storm');
      const target = unit(s, 'e-bokh');
      target.hp = 100;
      const map = mapOf(s);
      expect(tileAt(map, at(3, 5))).toBe('conceal');
      expect(ABILITIES.sunlight.targets(s, map, storm, storm.hex!)).toContainEqual({hex: at(3, 5)});
      applyTurn(s, storm, {action: {ability: 'sunlight', target: {hex: at(3, 5)}}});
      expect(target.hp).toBeGreaterThan(100);
    })
  );

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

  it(
    'Grapple then Throw: the target lands where chosen, still Immobilized',
    withFullKits(() => {
      const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1), 'e-bokh': at(8, 6)});
      const b = unit(s, 'p-bokh');
      applyTurn(s, b, {action: {ability: 'grapple', target: {hex: at(2, 1)}}});
      expect(unit(s, 'e-storm').statuses.some((x) => x.kind === 'immobilized')).toBe(true);
      applyTurn(s, b, {action: {ability: 'throw', target: {hex: at(2, 1), to: at(0, 1)}}});
      expect(unit(s, 'e-storm').hex).toEqual(at(0, 1));
      expect(unit(s, 'e-storm').statuses.some((x) => x.kind === 'immobilized')).toBe(true);
      // Thrown to another hex beside the Champion: the hold isn't broken,
      // and the Champion itself was never held.
      expect(b.statuses).toEqual([]);
    })
  );

  it('Grapple: the Champion is free, and walking away releases the target', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1), 'e-bokh': at(8, 6)});
    const b = unit(s, 'p-bokh');
    const target = unit(s, 'e-storm');
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: at(2, 1)}}});
    expect(b.statuses).toEqual([]);
    const away = reachableHexes(s, mapOf(s), b).find(
      (r) => r.path.length === 1 && hexDistance(r.hex, target.hex!) === 2
    )!;
    applyTurn(s, b, {move: away.path, action: {ability: 'hold'}});
    expect(target.statuses).toEqual([]);
  });

  it('Grapple reaches a unit up to two spaces away, stepping in next to it first', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-storm': at(4, 1), 'e-bokh': at(8, 6)});
    const b = unit(s, 'p-bokh');
    const target = unit(s, 'e-storm');
    expect(ABILITIES.grapple.targets(s, SALT_FLATS, b, b.hex!)).toEqual([]);
    target.hex = at(3, 1);
    const targets = ABILITIES.grapple.targets(s, SALT_FLATS, b, b.hex!);
    // Only with a step: to a free hex next to both.
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) {
      expect(t.hex).toEqual(at(3, 1));
      expect(hexDistance(t.to!, b.hex!)).toBe(1);
      expect(hexDistance(t.to!, at(3, 1))).toBe(1);
    }
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: at(3, 1), to: at(2, 1)}}});
    expect(b.hex).toEqual(at(2, 1));
    expect(target.statuses.map((x) => x.kind)).toEqual(['immobilized']);
    // Next to it, it grapples where it stands; Immobilized, only that.
    target.hex = at(2, 1);
    b.hex = at(1, 1);
    expect(ABILITIES.grapple.targets(s, SALT_FLATS, b, b.hex!)).toContainEqual({hex: at(2, 1)});
    b.statuses = [{kind: 'immobilized', value: 0, untilSlot: 999}];
    target.hex = at(3, 1);
    expect(ABILITIES.grapple.targets(s, SALT_FLATS, b, b.hex!)).toEqual([]);
  });

  it('Grapple: displacing the target away breaks the grapple, freeing it', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1), 'e-bokh': at(8, 6)});
    const b = unit(s, 'p-bokh');
    const target = unit(s, 'e-storm');
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: at(2, 1)}}});
    expect(target.statuses.some((x) => x.kind === 'immobilized')).toBe(true);
    displace({state: s, map: SALT_FLATS, slot: 0}, target, hexDirectionTo(at(1, 1), at(2, 1))!, 1);
    expect(hexDistance(target.hex!, b.hex!)).toBe(2);
    // Breaking it clears everything the Grapple gave the target.
    expect(target.statuses).toEqual([]);
  });

  it('Shove Displaces the unit the Champion pins 1 away, letting it go', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1), 'e-mangudai': at(1, 3)});
    const b = unit(s, 'p-bokh');
    const target = unit(s, 'e-storm');
    // Only the unit it pins.
    expect(ABILITIES.shove.targets(s, SALT_FLATS, b, b.hex!)).toEqual([]);
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: at(2, 1)}}});
    expect(ABILITIES.shove.targets(s, SALT_FLATS, b, b.hex!)).toEqual([{hex: at(2, 1)}]);
    const hp = target.hp;
    applyTurn(s, b, {action: {ability: 'shove', target: {hex: at(2, 1)}}});
    expect(target.hex).toEqual(at(3, 1));
    expect(target.hp).toBe(hp);
    expect(target.statuses).toEqual([]);
  });

  it(
    'Grapple: Sunlight no longer frees its target',
    withFullKits(() => {
      const s = setup({'p-bokh': at(1, 1), 'e-mangudai': at(2, 1), 'e-storm': at(3, 1)});
      const target = unit(s, 'e-mangudai');
      applyTurn(s, unit(s, 'p-bokh'), {action: {ability: 'grapple', target: {hex: at(2, 1)}}});
      applyTurn(s, unit(s, 'e-storm'), {action: {ability: 'sunlight', target: {hex: at(2, 1)}}});
      expect(target.statuses.map((x) => x.kind)).toEqual(['immobilized']);
    })
  );

  it('Grapple holds one target at a time: a new grapple lets the last go', () => {
    const s = setup({
      'p-bokh': at(3, 3),
      'e-mangudai': hexNeighbors(at(3, 3))[0]!,
      'e-storm': hexNeighbors(at(3, 3))[3]!,
    });
    const b = unit(s, 'p-bokh');
    const first = unit(s, 'e-mangudai');
    const second = unit(s, 'e-storm');
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: first.hex!}}});
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: second.hex!}}});
    expect(first.statuses).toEqual([]);
    expect(second.statuses.some((x) => x.kind === 'immobilized')).toBe(true);
  });

  it(
    'Sunlight can clear hail from an empty hex',
    withFullKits(() => {
      const s = setup({'p-storm': at(1, 1), 'e-bokh': at(8, 6)});
      s.effects = [{kind: 'hail', hex: at(3, 1), untilSlot: 999, push: 2}];
      applyTurn(s, unit(s, 'p-storm'), {action: {ability: 'sunlight', target: {hex: at(3, 1)}}});
      expect(s.effects).toEqual([]);
    })
  );

  it(
    'Sunlight clears hail from its target’s hex only',
    withFullKits(() => {
      const s = setup({'p-storm': at(1, 1), 'p-bokh': at(2, 1), 'e-bokh': at(8, 6)});
      const until = 999;
      const effect = (h: Hex) => ({
        kind: 'hail' as const,
        hex: h,
        untilSlot: until,
        push: 2,
      });
      s.effects = [effect(at(2, 1)), effect(at(3, 1))];
      applyTurn(s, unit(s, 'p-storm'), {action: {ability: 'sunlight', target: {hex: at(2, 1)}}});
      expect(s.effects.map((e) => e.hex)).toEqual([at(3, 1)]);
    })
  );

  it('Grapple: damage, then only Immobilized for its duration', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1)});
    const b = unit(s, 'p-bokh');
    const target = unit(s, 'e-storm');
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: at(2, 1)}}});
    expect(target.hp).toBe(
      target.maxHp - defended(target, scaled(ABILITY.grapple.damage, b.power))
    );
    expect(target.statuses.map((x) => x.kind)).toEqual(['immobilized']);
    expect(vulnerablePercent(s, target)).toBe(0);
    expect(target.statuses.every((x) => x.untilSlot === ABILITY.grapple.slots)).toBe(true);
    expect(taunterOf(s, target)).toBeUndefined();
  });

  it('Grapple leaves a pinned unit’s reach alone: it only Immobilizes', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1), 'p-mangudai': at(5, 1)});
    const storm = unit(s, 'e-storm');
    const all = allowedTargets(s, SALT_FLATS, storm, ABILITIES.hail);
    applyTurn(s, unit(s, 'p-bokh'), {action: {ability: 'grapple', target: {hex: at(2, 1)}}});
    expect(allowedTargets(s, SALT_FLATS, storm, ABILITIES.hail)).toEqual(all);
    expect(movementCap(storm)).toBe(0);
  });

  it('Pinned (parked): a unit’s abilities reach only its own space and the ones next to it', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1), 'p-mangudai': at(5, 1)});
    const storm = unit(s, 'e-storm');
    const far = ABILITIES.hail
      .targets(s, SALT_FLATS, storm, storm.hex!)
      .filter((t) => hexDistance(t.hex!, storm.hex!) > 1);
    expect(far.length).toBeGreaterThan(0);
    storm.statuses.push({kind: 'pinned', value: 0, untilSlot: 999});
    const hail = allowedTargets(s, SALT_FLATS, storm, ABILITIES.hail);
    expect(hail.length).toBeGreaterThan(0);
    expect(hail.every((t) => hexDistance(t.hex!, storm.hex!) <= 1)).toBe(true);
    expect(tryTurn(s, storm.id, {action: {ability: 'hail', target: far[0]!}})).toThrow(RuleError);
    expect(tryTurn(s, storm.id, {action: {ability: 'hail', target: hail[0]!}})).not.toThrow();
    // Nor does the AI aim past its reach.
    const choice = chooseAiTurn(s, storm);
    if (choice.action.target?.hex)
      expect(hexDistance(choice.action.target.hex, storm.hex!)).toBeLessThanOrEqual(1);
  });

  it(
    'Throw only the unit the Champion grapples: beside it keeps hold, one space back lets go',
    withFullKits(() => {
      const s = setup({
        'p-bokh': at(3, 3),
        'e-storm': hexNeighbors(at(3, 3))[0]!,
        'e-mangudai': at(8, 6),
      });
      const b = unit(s, 'p-bokh');
      const target = unit(s, 'e-storm');
      expect(ABILITIES.throw.targets(s, SALT_FLATS, b, b.hex!)).toEqual([]);
      applyTurn(s, b, {action: {ability: 'grapple', target: {hex: target.hex!}}});
      const throws = ABILITIES.throw.targets(s, SALT_FLATS, b, b.hex!);
      const back = hexNeighbor(target.hex!, hexDirectionTo(b.hex!, target.hex!)!);
      expect(throws).toContainEqual({hex: target.hex!, to: back});
      for (const t of throws) expect([1, 2]).toContain(hexDistance(t.to!, b.hex!));
      const hp = target.hp;
      applyTurn(s, b, {action: {ability: 'throw', target: {hex: target.hex!, to: back}}});
      expect(target.hex).toEqual(back);
      // Two away: the grapple ends.
      expect(target.statuses).toEqual([]);
      expect(target.hp).toBe(hp - defended(target, scaled(ABILITY.throw.damage, b.power)));
    })
  );

  it(
    'Taunt draws a damaging charge onto the taunter',
    withFullKits(() => {
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
    })
  );

  it(
    'Leap lands exactly two hexes on, over ruins, a unit or quicksand',
    withFullKits(() => {
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
    })
  );

  it(
    'Lunge bounds up to two hexes to a unit, strikes it, and grapples it',
    withFullKits(() => {
      const s = setup({'p-bokh': at(1, 1), 'e-storm': at(4, 1), 'e-bokh': at(8, 6)});
      const b = unit(s, 'p-bokh');
      const target = unit(s, 'e-storm');
      b.ultimateCharge = RULES.ultimateCharge;
      const targets = ABILITIES.lunge.targets(s, SALT_FLATS, b, b.hex!);
      const land = {hex: at(4, 1), to: at(3, 1)};
      expect(targets).toContainEqual(land);
      // Every landing is free, beside its target, and at most two hexes away.
      for (const t of targets) {
        expect(hexDistance(t.hex!, b.hex!)).toBeLessThanOrEqual(ABILITY.lunge.reach);
        if (!t.to) continue;
        expect(hexDistance(t.to, t.hex!)).toBe(1);
        expect(hexDistance(t.to, b.hex!)).toBeLessThanOrEqual(ABILITY.lunge.reach - 1);
        expect(unitAt(s, t.to)).toBeUndefined();
      }
      // Out of reach.
      expect(targets.some((t) => hexEquals(t.hex!, unit(s, 'e-bokh').hex!))).toBe(false);
      applyTurn(s, b, {action: {ability: 'lunge', target: land}});
      expect(b.hex).toEqual(at(3, 1));
      expect(target.hp).toBe(
        target.maxHp - defended(target, scaled(ABILITY.lunge.damage, b.power))
      );
      // Grappled as by Grapple.
      expect(target.statuses.map((x) => x.kind)).toEqual(['immobilized']);
      expect(b.ultimateUsed).toBe(true);
    })
  );

  it(
    'Lunge: next to its target it strikes where it stands; Immobilized, only that',
    withFullKits(() => {
      const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1), 'e-mangudai': at(4, 1)});
      const b = unit(s, 'p-bokh');
      b.ultimateCharge = RULES.ultimateCharge;
      expect(ABILITIES.lunge.targets(s, SALT_FLATS, b, b.hex!)).toContainEqual({hex: at(2, 1)});
      b.statuses = [{kind: 'immobilized', value: 0, untilSlot: 999}];
      expect(ABILITIES.lunge.targets(s, SALT_FLATS, b, b.hex!)).toEqual([{hex: at(2, 1)}]);
      b.statuses = [];
      applyTurn(s, b, {action: {ability: 'lunge', target: {hex: at(2, 1)}}});
      expect(b.hex).toEqual(at(1, 1));
      expect(unit(s, 'e-storm').statuses.some((x) => x.kind === 'immobilized')).toBe(true);
    })
  );

  it(
    'Lunge is locked until the ultimate charges',
    withFullKits(() => {
      const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1), 'e-bokh': at(8, 6)});
      expect(tryTurn(s, 'p-bokh', {action: {ability: 'lunge', target: {hex: at(2, 1)}}})).toThrow(
        RuleError
      );
    })
  );

  it(
    'Sunlight heals the one unit it targets, enemies included, and cleanses nothing',
    withFullKits(() => {
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
      // Any space within range: units of either side, and empty ones.
      const targets = ABILITIES.sunlight.targets(s, SALT_FLATS, storm, storm.hex!);
      for (const h of [at(1, 3), at(1, 2), at(2, 3), at(3, 3)])
        expect(targets.some((t) => hexEquals(t.hex!, h))).toBe(true);
      expect(targets.some((t) => hexEquals(t.hex!, at(8, 6)))).toBe(false);
      expect(hexDistance(at(1, 3), at(8, 6))).toBeGreaterThan(ABILITY.sunlight.range);
      applyTurn(s, storm, {action: {ability: 'sunlight', target: {hex: at(2, 3)}}});
      expect(unit(s, 'e-bokh').hp).toBe(100 + scaled(ABILITY.sunlight.heal, storm.power));
      expect(unit(s, 'e-bokh').statuses).toHaveLength(1);
      // Its neighbour is left alone.
      expect(unit(s, 'p-bokh').hp).toBe(100);
    })
  );

  it('hail covers an area: damage and Push to every unit in it, allies too, but no Push on the Inevitable Champion', () => {
    const centre = at(4, 3);
    const map = mapOf(setup({}));
    const near = hexNeighbors(centre).filter((h) => onMap(map, h) && tileAt(map, h) !== 'obstacle');
    const s = setup({
      'p-storm': at(1, 3),
      'e-mangudai': centre,
      'p-mangudai': near[0]!,
      'e-bokh': near[1]!,
      'e-storm': at(8, 6),
    });
    const storm = unit(s, 'p-storm');
    const before = new Map(s.units.map((u) => [u.id, u.slot]));
    applyTurn(s, storm, {action: {ability: 'hail', target: {hex: centre}}});
    // It stays on the ground (owner, 2026-10-22).
    expect(s.effects).toHaveLength(1 + near.length);
    for (const e of s.effects) {
      expect(e.untilSlot).toBe(ABILITY.hail.hexSlots);
      expect(e.damage).toBe(scaled(ABILITY.hail.turnDamage, storm.power));
    }
    for (const id of ['e-mangudai', 'p-mangudai'])
      expect(unit(s, id).slot).toBe(before.get(id)! + ABILITY.hail.castPush);
    expect(unit(s, 'e-bokh').slot).toBe(before.get('e-bokh'));
    expect(unit(s, 'e-storm').slot).toBe(before.get('e-storm'));
    for (const id of ['e-mangudai', 'p-mangudai', 'e-bokh']) {
      const u = unit(s, id);
      expect(u.hp).toBe(u.maxHp - defended(u, scaled(ABILITY.hail.damage, storm.power)));
    }
    expect(unit(s, 'e-storm').hp).toBe(unit(s, 'e-storm').maxHp);
  });

  it('hail strikes a unit that starts its turn in it', () => {
    const s = setup({'p-mangudai': at(1, 3), 'e-storm': at(8, 6)});
    const m = unit(s, 'p-mangudai');
    s.effects.push({kind: 'hail', hex: at(1, 3), untilSlot: 999, push: 0, damage: 30});
    m.slot = 10;
    advance(s, chooseAiTurn);
    expect(s.awaiting).toBe(m.id);
    expect(m.hp).toBe(m.maxHp - defended(m, 30));
    // Resuming the same turn doesn't strike again.
    expect(advanceToDecision(s)).toBe(m);
    expect(m.hp).toBe(m.maxHp - defended(m, 30));
  });

  it('hail is aimed up to three spaces away', () => {
    const s = setup({'p-storm': at(1, 3), 'e-bokh': at(8, 6)});
    const storm = unit(s, 'p-storm');
    const targets = ABILITIES.hail.targets(s, SALT_FLATS, storm, storm.hex!);
    expect(targets.some((t) => hexDistance(t.hex!, storm.hex!) === 3)).toBe(true);
    expect(targets.every((t) => hexDistance(t.hex!, storm.hex!) <= 3)).toBe(true);
    expect(ABILITY.hail).toMatchObject({range: 3, radius: 1, castPush: 5});
  });

  it('lingering hail (parked): a unit that starts its turn on it is Pushed once the turn has placed its card', () => {
    const s = setup({'p-mangudai': at(1, 3), 'p-bokh': at(1, 1), 'e-storm': at(8, 6)});
    for (const h of [at(1, 3), at(1, 1)])
      s.effects.push({kind: 'hail', hex: h, untilSlot: 999, push: 2});
    const b = unit(s, 'p-bokh');
    const m = unit(s, 'p-mangudai');
    // The Champion is Inevitable: its card isn't pushed.
    s.currentSlot = b.slot!;
    applyTurn(s, b, {action: {ability: 'hold'}});
    expect(b.slot).toBe(s.currentSlot + slotsForward(ABILITY.hold.cost, b.speed));
    s.currentSlot = m.slot!;
    applyTurn(s, m, {action: {ability: 'hold'}});
    expect(m.slot).toBe(s.currentSlot + slotsForward(ABILITY.hold.cost, m.speed) + 2);
  });
});

describe('the caravan’s camel', () => {
  it('acts first in every fight, despite its speed, walking a space before anyone else', () => {
    for (let seed = 0; seed < 10; seed++) {
      const s = createFight(seed);
      const camel = unit(s, 'p-camel');
      expect(camel.slot).toBe(0);
      s.events = [];
      const first = advanceToDecision(s)!;
      // It walks itself: the track never stops for it.
      expect(first.hero).not.toBe('camel');
      expect(s.events[0]).toMatchObject({kind: 'turn', unitId: 'p-camel'});
      expect(s.events[1]).toMatchObject({kind: 'step', unitId: 'p-camel'});
      expect(camel.hex).toEqual(roadToExit(mapOf(s), SALT_FLATS.camelStart)[0]);
    }
  });

  it('joins the player’s side in the top-left corner, with very high health and High defence', () => {
    for (const seed of [1, 2, 3]) {
      const s = createFight(seed);
      const camel = unit(s, 'p-camel');
      expect(camel.side).toBe('player');
      expect(camel.controller).toBe('ai');
      expect(camel.hex).toEqual(SALT_FLATS.camelStart);
      expect(hexToOffset(camel.hex!)).toEqual({col: 0, row: 0});
      expect(camel.hp).toBe(HEROES.camel.health);
      expect(camel.defence).toBe(40);
      expect(s.units.filter((u) => u.hex && hexKey(u.hex) === hexKey(camel.hex!))).toHaveLength(1);
      expect(s.units.filter((u) => u.side === 'enemy' && u.hero === 'camel')).toHaveLength(0);
    }
  });

  it('wins by reaching the one exit, in the bottom-right corner', () => {
    expect(SALT_FLATS.exits.map((h) => hexToOffset(h))).toEqual([{col: 7, row: 8}]);
  });

  it('follows a fixed shortest road around the ruins to the exit', () => {
    for (let seed = 0; seed < 20; seed++) {
      const map = mapOf(createFight(seed));
      const road = roadToExit(map, SALT_FLATS.camelStart);
      // Every step to a neighbour, never onto ruins, ending on the exit.
      let from = SALT_FLATS.camelStart;
      for (const h of road) {
        expect(hexDistance(from, h)).toBe(1);
        expect(tileAt(map, h)).not.toBe('obstacle');
        from = h;
      }
      expect(road[road.length - 1]).toEqual(SALT_FLATS.exits[0]);
      // Shortest: no walk around the ruins is shorter.
      const dist = new Map([[hexKey(SALT_FLATS.camelStart), 0]]);
      const queue = [SALT_FLATS.camelStart];
      for (let h; (h = queue.shift()); )
        for (const n of hexNeighbors(h))
          if (onMap(map, n) && tileAt(map, n) !== 'obstacle' && !dist.has(hexKey(n))) {
            dist.set(hexKey(n), dist.get(hexKey(h))! + 1);
            queue.push(n);
          }
      expect(road).toHaveLength(dist.get(hexKey(SALT_FLATS.exits[0]!))!);
      // Fixed: the road from a hex on it is the rest of it.
      expect(roadToExit(map, road[2]!)).toEqual(road.slice(3));
    }
  });

  it('walks one space along its road every 14 slots, and can’t attack', () => {
    const s = setup({'p-camel': at(2, 4), 'p-bokh': at(0, 0), 'e-bokh': at(6, 0)});
    const camel = unit(s, 'p-camel');
    const road = roadToExit(mapOf(s), at(2, 4));
    camel.slot = 90;
    expect(abilitiesOf(camel).map((d) => d.id)).toEqual(['hold']);
    // Bökh's card is at 100: the camel's turn comes first, with no decision.
    expect(advanceToDecision(s)!.id).toBe('p-bokh');
    expect(camel.hex).toEqual(road[0]);
    expect(camel.slot).toBe(90 + 14);
    expect(HEROES.camel.routeSlots).toBe(14);
    expect(s.phase).toBe('fight');
  });

  it('walks around a unit on its road, and waits only when Immobilized or boxed in', () => {
    const s = setup({'p-camel': at(2, 4), 'p-bokh': at(0, 0), 'e-bokh': at(6, 0)});
    const camel = unit(s, 'p-camel');
    const road = roadToExit(mapOf(s), at(2, 4));
    unit(s, 'e-bokh').hex = road[0]!;
    camel.slot = 90;
    advanceToDecision(s);
    expect(camel.hex).not.toEqual(at(2, 4));
    expect(camel.hex).not.toEqual(road[0]);
    expect(hexDistance(camel.hex!, at(2, 4))).toBe(1);
    expect(camel.skipped).toBeUndefined();
    expect(camel.slot).toBe(104);

    const held = setup({'p-camel': at(2, 4), 'p-bokh': at(0, 0), 'e-bokh': at(6, 0)});
    const pinned = unit(held, 'p-camel');
    pinned.statuses.push({kind: 'immobilized', value: 0, untilSlot: 999});
    pinned.slot = 90;
    advanceToDecision(held);
    expect(pinned.hex).toEqual(at(2, 4));
    expect(pinned.skipped).toBe(true);

    // In the corner, its three neighbours taken: nowhere to go.
    const boxed = setup({
      'p-camel': at(0, 0),
      'p-bokh': at(1, 0),
      'p-mangudai': at(-1, 1),
      'e-bokh': at(0, 1),
    });
    const cornered = unit(boxed, 'p-camel');
    expect(hexNeighbors(at(0, 0)).filter((h) => onMap(SALT_FLATS, h) && !unitAt(boxed, h))).toEqual(
      []
    );
    cornered.slot = 90;
    advanceToDecision(boxed);
    expect(cornered.hex).toEqual(at(0, 0));
    expect(cornered.skipped).toBe(true);
  });

  it('wins the fight on reaching the exit, with enemies still standing', () => {
    const s = setup({'p-camel': at(6, 8), 'p-bokh': at(0, 0), 'e-bokh': at(6, 0)});
    unit(s, 'p-camel').slot = 50;
    expect(advanceToDecision(s)).toBeUndefined();
    expect(unit(s, 'p-camel').hex).toEqual(at(7, 8));
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

  it('is a target the enemy AI finishes', () => {
    const shot = setup({'p-camel': at(3, 4), 'p-bokh': at(0, 0), 'e-mangudai': at(4, 4)});
    unit(shot, 'p-camel').hp = 1;
    unit(shot, 'p-camel').slot = 500;
    const archer = unit(shot, 'e-mangudai');
    archer.slot = 50;
    advanceToDecision(shot);
    const input = chooseAiTurn(shot, archer);
    expect(input.action.ability).toBe('bow');
    expect(simulate(shot, archer.id, input)!.phase).toBe('lost');
  });
});

describe('previews, the AI and the run', () => {
  it(
    'unlocks the ultimate once its action cost is spent, a Hold without a move not counting',
    withFullKits(() => {
      const s = setup({'p-mangudai': at(0, 3), 'e-bokh': at(8, 0)});
      const m = unit(s, 'p-mangudai');
      m.ultimateCharge = RULES.ultimateCharge - 1;
      expect(unusableReason(m, ABILITIES.volley)).toMatch(/unlocks after 300/);
      m.ultimateCharge = RULES.ultimateCharge;
      expect(unusableReason(m, ABILITIES.volley)).toBeNull();
    })
  );

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

  it('rejects walking plus an ability without mutating the fight', () => {
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(4, 3)});
    const shot = {ability: 'bow' as const, target: {hex: at(4, 3)}};
    const before = JSON.stringify(s);
    const input: TurnInput = {action: shot, move: [at(0, 3)]};
    expect(previewTurn(s, 'p-mangudai', input)).toBeNull();
    expect(() => applyTurn(s, unit(s, 'p-mangudai'), input)).toThrow(/separate turns/);
    expect(JSON.stringify(s)).toBe(before);
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

  it('a Grapple and a move in one turn are refused', () => {
    const s = setup({'p-bokh': at(1, 3), 'e-bokh': at(2, 3)});
    const grapple = {ability: 'grapple' as const, target: {hex: at(2, 3)}};
    expect(() => applyTurn(s, unit(s, 'p-bokh'), {action: grapple, move: [at(0, 3)]})).toThrow(
      RuleError
    );
  });

  it('Bite hits one adjacent unit; several wolves get their own ids', () => {
    const s = createFight(0, ['bokh'], ['wolf', 'wolf']);
    expect(s.units.filter((u) => u.side === 'enemy').map((u) => u.id)).toEqual([
      'e-wolf',
      'e-wolf-2',
    ]);
    for (const u of s.units) if (u.hero === 'camel') u.alive = false;
    const b = unit(s, 'p-bokh');
    const w = unit(s, 'e-wolf');
    b.hex = at(1, 3);
    w.hex = at(2, 3);
    unit(s, 'e-wolf-2').hex = at(8, 0);
    expect(HEROES.wolf.ultimate).toBeUndefined();
    expect(ABILITIES.bite.targets(s, mapOf(s), w, w.hex)).toEqual([{hex: at(1, 3)}]);
    ABILITIES.bite.resolve({state: s, map: mapOf(s), slot: 0}, w, {hex: at(1, 3)});
    expect(b.hp).toBe(b.maxHp - defended(b, scaled(ABILITY.bite.damage, w.power)));
  });

  it('the start menu’s party comes to the fight, with the camel; the enemy brings its party', () => {
    const run = createRun(5, {party: ['storm', 'bokh']});
    const player = run.fight.units.filter((u) => u.side === 'player');
    expect(player.map((u) => [u.hero, u.partyIndex])).toEqual([
      ['storm', 0],
      ['bokh', 1],
      ['camel', 2],
    ]);
    expect(player.every((u) => u.hex)).toBe(true);
    expect(run.fight.units.filter((u) => u.side === 'enemy').map((u) => u.hero)).toEqual(
      stageEnemies(5, 0)
    );
    // No party given: everyone comes.
    expect(createRun(5).fight.units.filter((u) => u.side === 'player')).toHaveLength(4);
  });

  it('the stages: one random hero and two wolves, two and one, then all three', () => {
    expect(STAGES).toEqual([
      {heroes: 1, wolves: 2},
      {heroes: 2, wolves: 1},
      {heroes: 3, wolves: 0},
    ]);
    const firsts = new Set<HeroId>();
    for (let seed = 0; seed < 30; seed++) {
      STAGES.forEach(({heroes, wolves}, stage) => {
        const enemies = stageEnemies(seed, stage);
        const picked = enemies.filter((h) => h !== 'wolf');
        expect(picked).toHaveLength(heroes);
        expect(new Set(picked).size).toBe(heroes);
        expect(picked.every((h) => ROSTER.includes(h))).toBe(true);
        expect(enemies.filter((h) => h === 'wolf')).toHaveLength(wolves);
        // The same seed, the same enemy.
        expect(stageEnemies(seed, stage)).toEqual(enemies);
      });
      firsts.add(stageEnemies(seed, 0)[0]!);
    }
    // Random: every hero of the roster leads the first stage for some seed.
    expect(firsts.size).toBe(ROSTER.length);
  });

  it('winning a stage before the last goes on to the next, with the survivors', () => {
    const run = createRun(5);
    expect(runView(run)).toMatchObject({stage: 0, stages: STAGES.length});
    expect(() => handleRunAction(run, {type: 'next'})).toThrow(RuleError);
    // Win the first stage with the Outrider fallen.
    const won = {...run, fight: cloneFight(run.fight)};
    won.fight.phase = 'won';
    const m = won.fight.units.find((u) => u.id === 'p-mangudai')!;
    m.alive = false;
    m.hex = null;
    expect(runStatus(won)).toBe('active');
    const next = handleRunAction(won, {type: 'next'});
    expect(next.stage).toBe(1);
    expect(next.version).toBe(run.version + 1);
    expect(next.fight.phase).toBe('fight');
    expect(next.fight.units.filter((u) => u.side === 'player').map((u) => u.hero)).toEqual([
      'bokh',
      'storm',
      'camel',
    ]);
    expect(next.fight.units.filter((u) => u.side === 'enemy').map((u) => u.hero)).toEqual(
      stageEnemies(5, 1)
    );
    // A new stage: everyone at full health, on the board, but for what the
    // enemy did before the player's first turn (the camel walks itself).
    for (const u of next.fight.units) {
      const taken = next.fight
        .events!.filter((e) => e.kind === 'damage' && e.unitId === u.id)
        .reduce((sum, e) => sum + (e as {amount: number}).amount, 0);
      expect(u.hp + taken).toBe(u.maxHp);
      expect(u.alive ? u.hex : 'dead').not.toBeNull();
    }
    // The last stage won is the run won; there is no next.
    const last = {...next, stage: STAGES.length - 1, fight: cloneFight(next.fight)};
    last.fight.phase = 'won';
    expect(runStatus(last)).toBe('won');
    expect(() => handleRunAction(last, {type: 'next'})).toThrow(RuleError);
    // A lost stage loses the run, whatever its number.
    expect(runStatus({...run, fight: {...run.fight, phase: 'lost'}})).toBe('lost');
  });

  it('a party must be one to three different heroes of the roster', () => {
    // The Modao Vanguard is left out of the roster for now (owner, 2026-10-22).
    expect(ROSTER).toEqual(PARTY);
    for (const party of [
      ['modao', 'storm'],
      ['bokh', 'mangudai', 'storm', 'modao'],
      [],
      ['bokh', 'bokh'],
      ['camel'],
      ['nobody'],
      'bokh',
      ['bokh', 'mangudai', 'storm', 'bokh'],
    ])
      expect(() => createRun(5, {party})).toThrow(RuleError);
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

  it('saves the current format, carries it through every action, and calls any other outdated', () => {
    const run = createRun(0);
    expect(run.format).toBe(RUN_FORMAT);
    expect(runOutdated(run)).toBe(false);
    const next = handleRunAction(run, {type: 'turn', action: {ability: 'hold'}});
    expect(next.format).toBe(RUN_FORMAT);
    expect(runOutdated(next)).toBe(false);
    // Saved before formats existed, or in an older one.
    const {format: _format, ...unversioned} = run;
    expect(runOutdated(unversioned as typeof run)).toBe(true);
    expect(runOutdated({...run, format: RUN_FORMAT - 1})).toBe(true);
  });

  it('gives a run started before the stats were re-tuned today’s, in its view and its next action', () => {
    const run = createRun(0);
    const saved = JSON.parse(JSON.stringify(run));
    const old = saved.fight.units.find((u: Unit) => u.id === 'p-mangudai');
    Object.assign(old, {speed: 7, defence: 8, power: 40});
    const m = runView(saved).fight.units.find((u) => u.id === 'p-mangudai')!;
    expect([m.speed, m.defence, m.power]).toEqual([
      HEROES.mangudai.speed,
      HEROES.mangudai.defence,
      HEROES.mangudai.power,
    ]);
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
        action: {ability: 'lunge', target: {hex: {q: 99, r: 99}}},
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

  it('rejects move plus ability, prices movement, and leaves defaults intact', () => {
    const s = setup({'p-mangudai': at(0, 0), 'e-bokh': at(4, 0)});
    s.experiment = {blockAllUnits: false, separateMovement: false, moveActionCost: 20};
    const input: TurnInput = {move: [at(1, 0)], action: {ability: 'bow', target: {hex: at(4, 0)}}};
    expect(simulate(s, 'p-mangudai', input)).not.toBeNull();
    s.experiment = {blockAllUnits: false, separateMovement: true, moveActionCost: 100};
    expect(simulate(s, 'p-mangudai', input)).toBeNull();
    const moved = simulate(s, 'p-mangudai', {move: [at(1, 0)], action: {ability: 'hold'}})!;
    expect(unit(moved, 'p-mangudai').slot).toBe(
      slotsForward(100 + RULES.moveCostPerHex, unit(s, 'p-mangudai').speed)
    );
    expect(unit(moved, 'p-mangudai').ultimateCharge).toBe(100 + RULES.moveCostPerHex);
    for (const option of scoreOptions(s, unit(s, 'p-mangudai')))
      expect(!option.input.move?.length || option.input.action.ability === 'hold').toBe(true);
  });

  it('does not project a move-and-melee threat under separate movement', () => {
    const s = setup({'p-mangudai': at(0, 0), 'e-wolf': at(3, 0)}, ['mangudai', 'wolf']);
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

describe('the Modao Vanguard', () => {
  const VANGUARD: HeroId[] = ['modao', 'mangudai', 'bokh'];
  const centre = at(3, 3);
  const around = hexNeighbors(centre);

  it('Barrier takes a hit whole, ignoring defence, and the rest of it is lost', () => {
    const s = setup({'p-modao': centre, 'e-mangudai': at(7, 3)}, VANGUARD);
    const v = unit(s, 'p-modao');
    const m = unit(s, 'e-mangudai');
    s.awaiting = m.id;
    setBarrier(v, 80, 1000);
    const lane = ABILITIES.bow.targets(s, mapOf(s), m, m.hex!);
    expect(lane.some((t) => hexEquals(t.hex!, centre))).toBe(true);
    applyTurn(s, m, {action: {ability: 'bow', target: {hex: centre}}});
    expect(v.hp).toBe(v.maxHp);
    expect(barrierOf(v)).toBeUndefined();
    // No barrier left: the next arrow goes through defence to health.
    s.awaiting = m.id;
    applyTurn(s, m, {action: {ability: 'bow', target: {hex: centre}}});
    expect(v.hp).toBe(v.maxHp - defended(v, scaled(ABILITY.bow.damage, m.power)));
  });

  it('Barrier takes damage raised by Vulnerable, at full value, until spent', () => {
    const s = setup({'p-modao': centre, 'e-mangudai': at(7, 3)}, VANGUARD);
    const v = unit(s, 'p-modao');
    const m = unit(s, 'e-mangudai');
    s.awaiting = m.id;
    setBarrier(v, 400, 1000);
    v.statuses.push({kind: 'vulnerable', value: 50, untilSlot: 1000});
    applyTurn(s, m, {action: {ability: 'bow', target: {hex: centre}}});
    const raw = Math.floor(scaled(ABILITY.bow.damage, m.power) * 1.5);
    expect(barrierOf(v)!.value).toBe(400 - raw);
    expect(v.hp).toBe(v.maxHp);
  });

  it('Barrier takes collision damage, and a new one replaces the old', () => {
    const s = setup({'p-modao': centre, 'e-bokh': around[0]!}, VANGUARD);
    const v = unit(s, 'p-modao');
    setBarrier(v, 30, 1000);
    setBarrier(v, 50, 1000);
    expect(v.statuses.filter((x) => x.kind === 'barrier')).toHaveLength(1);
    const ctx = {state: s, map: mapOf(s), slot: 0};
    // Knocked into the Champion: the barrier takes the collision.
    displace(ctx, v, hexDirectionTo(centre, around[0]!)!, 1);
    expect(v.hp).toBe(v.maxHp);
    expect(barrierOf(v)!.value).toBe(50 - RULES.collisionDamage);
  });

  it('Cleanse keeps a Barrier: it is beneficial', () => {
    const s = setup({'p-modao': centre}, VANGUARD);
    const v = unit(s, 'p-modao');
    setBarrier(v, 80, 1000);
    v.statuses.push({kind: 'slowed', value: 2, untilSlot: 1000});
    cleanse(v);
    expect(v.statuses.map((x) => x.kind)).toEqual(['barrier']);
  });

  it('Challenge taunts one unit within range and gives the Vanguard a fresh Barrier', () => {
    const far = setup({'p-modao': centre, 'e-bokh': at(7, 3)}, VANGUARD);
    expect(ABILITIES.challenge.targets(far, mapOf(far), unit(far, 'p-modao'), centre)).toHaveLength(
      0
    );
    const s = setup({'p-modao': centre, 'e-bokh': at(6, 3)}, VANGUARD);
    const v = unit(s, 'p-modao');
    const b = unit(s, 'e-bokh');
    expect(hexDistance(centre, b.hex!)).toBe(ABILITY.challenge.range);
    setBarrier(v, 5, 1000);
    s.awaiting = v.id;
    applyTurn(s, v, {action: {ability: 'challenge', target: {hex: b.hex!}}});
    const taunt = b.statuses.find((x) => x.kind === 'taunted')!;
    expect(taunt.source).toBe(v.id);
    expect(taunt.untilSlot).toBe(ABILITY.challenge.tauntSlots);
    expect(barrierOf(v)).toMatchObject({
      value: ABILITY.challenge.barrier,
      untilSlot: ABILITY.challenge.barrierSlots,
    });
    expect(v.slot).toBe(slotsForward(ABILITY.challenge.cost, v.speed));
  });

  it('a Challenged unit must attack the Vanguard or Hold while it can', () => {
    const s = setup({'p-modao': centre, 'e-bokh': around[0]!, 'p-mangudai': around[3]!}, VANGUARD);
    const v = unit(s, 'p-modao');
    const b = unit(s, 'e-bokh');
    b.statuses.push({kind: 'taunted', value: 0, untilSlot: 1000, source: v.id});
    for (const t of allowedTargets(s, mapOf(s), b, ABILITIES.throw))
      expect(hexEquals(t.hex!, centre)).toBe(true);
  });

  it('Reap sweeps a cone: the space next to the Vanguard and the three behind it, pushing each card', () => {
    const probe = setup({}, VANGUARD);
    // A direction from the centre with its whole cone clear.
    const dir = [0, 1, 2, 3, 4, 5].find((d) => reapCone(mapOf(probe), centre, d).length === 4)!;
    const cone = reapCone(mapOf(probe), centre, dir);
    const [front, ...back] = cone;
    expect(hexDistance(front!, centre)).toBe(1);
    for (const h of back) {
      expect(hexDistance(h, centre)).toBe(2);
      expect(hexDistance(h, front!)).toBe(1);
    }
    const s = setup(
      {
        'p-modao': centre,
        'e-bokh': back[0]!,
        'e-mangudai': back[2]!,
        'e-modao': around[(dir + 3) % 6]!,
      },
      VANGUARD
    );
    const v = unit(s, 'p-modao');
    const before = s.units.map((u) => ({id: u.id, hp: u.hp, slot: u.slot}));
    s.awaiting = v.id;
    // Aimed at the empty space in front: both units behind it are hit.
    applyTurn(s, v, {action: {ability: 'reap', target: {hex: front!}}});
    for (const id of ['e-bokh', 'e-mangudai']) {
      const u = unit(s, id);
      const b = before.find((x) => x.id === id)!;
      expect(u.hp).toBe(b.hp - defended(u, scaled(ABILITY.reap.damage, v.power)));
      // The Champion is Inevitable: its card stays.
      expect(u.slot).toBe(b.slot! + (id === 'e-bokh' ? 0 : ABILITY.reap.push));
    }
    // Behind the Vanguard: untouched.
    const behind = unit(s, 'e-modao');
    expect(behind.hp).toBe(behind.maxHp);
    expect(behind.slot).toBe(before.find((x) => x.id === 'e-modao')!.slot);
  });

  it('Reap is offered only toward a cone with a unit in it, and ruins in front stop the cone', () => {
    const probe = setup({}, VANGUARD);
    const dir = [0, 1, 2, 3, 4, 5].find((d) => reapCone(mapOf(probe), centre, d).length === 4)!;
    const [front, , far] = reapCone(mapOf(probe), centre, dir);
    const s = setup({'p-modao': centre, 'e-bokh': far!}, VANGUARD);
    const v = unit(s, 'p-modao');
    const aims = () => ABILITIES.reap.targets(s, mapOf(s), v, centre);
    expect(aims().map((t) => t.hex)).toEqual([front]);
    s.tiles = {...s.tiles, [hexKey(front!)]: 'obstacle'};
    expect(aims()).toHaveLength(0);
  });

  it('Push yields to the next free slot, and stops at the push limit until the unit acts', () => {
    const s = setup({'p-modao': centre, 'e-bokh': at(6, 3), 'e-mangudai': at(6, 5)}, VANGUARD);
    const b = unit(s, 'e-bokh');
    const m = unit(s, 'e-mangudai');
    b.slot = 20;
    m.slot = 22;
    expect(pushCard(s, b, 2)).toBe(3);
    expect(b.slot).toBe(23);
    // 3 of the 10 spent: the next pushes are cut down to fit.
    expect(pushCard(s, b, 5)).toBe(5);
    expect(pushCard(s, b, 5)).toBe(RULES.pushLimit - 8);
    expect(pushCard(s, b, 5)).toBe(0);
    expect(b.slot).toBe(20 + RULES.pushLimit);
    // Its own turn starts the limit again.
    for (const u of s.units) if (u !== b) u.slot = u.alive ? 500 + u.partyIndex : null;
    s.currentSlot = 0;
    expect(advanceToDecision(s)!.id).toBe(b.id);
    expect(b.pushed).toBeUndefined();
  });

  it('Push yielding past the limit lands on the latest free slot within it', () => {
    const s = setup({'p-modao': centre, 'e-bokh': at(6, 3), 'e-mangudai': at(6, 5)}, VANGUARD);
    const b = unit(s, 'e-bokh');
    b.slot = 20;
    b.pushed = 8;
    // Slot 22, the limit, is taken; 21 is free.
    unit(s, 'e-mangudai').slot = 22;
    expect(pushCard(s, b, 2)).toBe(1);
    expect(b.slot).toBe(21);
  });

  it('Advance hits, knocks back and pushes every unit next to the Vanguard, at once', () => {
    const s = setup(
      {'p-modao': centre, 'e-bokh': around[0]!, 'e-mangudai': around[3]!, 'p-mangudai': around[1]!},
      VANGUARD
    );
    const v = unit(s, 'p-modao');
    v.ultimateCharge = RULES.ultimateCharge;
    s.units.filter((u) => u !== v && u.alive).forEach((u, i) => (u.slot = 900 + 10 * i));
    const before = s.units.map((u) => ({id: u.id, slot: u.slot}));
    s.awaiting = v.id;
    applyTurn(s, v, {action: {ability: 'advance', target: {hex: centre}}});
    expect(v.charging).toBeNull();
    expect(v.ultimateUsed).toBe(true);
    for (const id of ['e-bokh', 'e-mangudai', 'p-mangudai']) {
      const u = unit(s, id);
      expect(u.hp).toBeLessThan(u.maxHp);
      expect(hexDistance(u.hex!, centre)).toBe(2);
      // The Champion is Inevitable: its card stays.
      const pushed = id === 'e-bokh' ? 0 : ABILITY.advance.push;
      expect(u.slot).toBe(before.find((x) => x.id === id)!.slot! + pushed);
    }
    expect(v.slot).toBe(slotsForward(ABILITY.advance.cost, v.speed));
  });

  it('Advance charges up to three spaces in a line over free ground, then strikes around where it stops', () => {
    const probe = setup({}, VANGUARD);
    const map = mapOf(probe);
    // A direction with three walkable spaces, one beyond for a target and one
    // more for it to be knocked back onto.
    const dir = [0, 1, 2, 3, 4, 5].find((d) =>
      [1, 2, 3, 4, 5]
        .map((n) => offsetStep(centre, d, n))
        .every((h) => onMap(map, h) && tileAt(map, h) !== 'obstacle')
    )!;
    const end = offsetStep(centre, dir, 3);
    const target = offsetStep(centre, dir, 4);
    const s = setup({'p-modao': centre, 'e-bokh': target}, VANGUARD);
    const v = unit(s, 'p-modao');
    v.ultimateCharge = RULES.ultimateCharge;
    const landings = advanceLandings(s, mapOf(s), v, centre);
    expect(landings.some((h) => hexEquals(h, end))).toBe(true);
    // Not past a unit: the Champion's own hex is no landing.
    expect(landings.some((h) => hexEquals(h, target))).toBe(false);
    s.awaiting = v.id;
    applyTurn(s, v, {action: {ability: 'advance', target: {hex: end}}});
    expect(v.hex).toEqual(end);
    const b = unit(s, 'e-bokh');
    expect(b.hp).toBeLessThan(b.maxHp);
    expect(hexDistance(b.hex!, end)).toBe(2);
    // Immobilized, it strikes only where it stands.
    v.statuses.push({kind: 'immobilized', value: 0, untilSlot: 1000});
    expect(advanceLandings(s, mapOf(s), v, end)).toEqual([end]);
  });

  it('Hold the Line strikes an enemy that starts next to the Vanguard and walks away', () => {
    const away = offsetStep(centre, 0, 2);
    const s = setup({'p-modao': centre, 'e-bokh': around[0]!}, VANGUARD);
    const v = unit(s, 'p-modao');
    const b = unit(s, 'e-bokh');
    s.awaiting = b.id;
    applyTurn(s, b, {move: [away], action: {ability: 'hold', target: {}}});
    expect(b.hex).toEqual(away);
    expect(b.hp).toBe(b.maxHp - defended(b, scaled(ABILITY.reap.damage, v.power)));
    // Its card is placed by the move's cost; the Champion is Inevitable, so the Push doesn't move it.
    const moveCost = RULES.moveActionCost + RULES.moveCostPerHex;
    expect(b.slot).toBe(slotsForward(moveCost, b.speed));
  });

  it('Hold the Line spares a move that stays next to the Vanguard, and allies', () => {
    const s = setup({'p-modao': centre, 'e-bokh': around[0]!, 'p-mangudai': around[3]!}, VANGUARD);
    const b = unit(s, 'e-bokh');
    s.awaiting = b.id;
    // To another space next to the Vanguard.
    applyTurn(s, b, {move: [around[1]!], action: {ability: 'hold', target: {}}});
    expect(b.hp).toBe(b.maxHp);
    const m = unit(s, 'p-mangudai');
    s.awaiting = m.id;
    applyTurn(s, m, {move: [offsetStep(centre, 3, 2)], action: {ability: 'hold', target: {}}});
    expect(m.hp).toBe(m.maxHp);
  });

  it(
    'Hold the Line strikes a Leap away, where it lands',
    withFullKits(() => {
      const s = setup({'p-modao': centre, 'e-mangudai': around[0]!}, VANGUARD);
      const m = unit(s, 'e-mangudai');
      const land = offsetStep(centre, 0, 3);
      s.awaiting = m.id;
      applyTurn(s, m, {action: {ability: 'leap', target: {hex: land}}});
      expect(m.hex).toEqual(land);
      expect(m.hp).toBeLessThan(m.maxHp);
    })
  );

  it('the AI can play the Vanguard: it picks a legal turn', () => {
    const s = setup({'e-modao': centre, 'p-bokh': around[0]!, 'p-mangudai': at(7, 1)}, VANGUARD);
    const v = unit(s, 'e-modao');
    s.awaiting = v.id;
    const input = chooseAiTurn(s, v);
    expect(simulate(s, v.id, input)).not.toBeNull();
  });
});
