import {describe, expect, it} from 'vitest';
import {
  hexDistance,
  hexKey,
  hexNeighbors,
  hexToOffset,
  hexToPixel,
  offsetToHex,
} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {AI, HEROES, PARTY, ROSTER, RULES, STAGES} from './config';
import {canMove, lineOfFire, movementCap, reachableHexes, roadToExit, unitAt} from './board';
import {ABILITIES, abilitiesOf, arrowLanes} from './abilities';
import {chooseAiTurn, scoreOptions, simulate} from './ai';
import {threatDamage, threatsTo} from './threat';
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
  refreshStats,
} from './fight';
import {previewTurn} from './preview';
import {SALT_FLATS, onMap, tileAt} from './map';
import {checkEnd, enterHex, hit, kill} from './resolve';
import {
  RUN_FORMAT,
  createRun,
  handleRunAction,
  runOutdated,
  runStatus,
  runView,
  stageEnemies,
} from './run';
import {aimSlot, freeSlotFrom, nextCard, placeCard, simultaneousOrder} from './track';
import type {FightState, HeroId, TurnInput, Unit} from './types';

const at = (col: number, row: number): Hex => offsetToHex({col, row});

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

describe('the track', () => {
  it('skips a turn with only Hold to choose, and marks it till the unit next acts', () => {
    // Immobilized with no one in reach: Throw and Grapple have no target.
    const s = setup({'p-bokh': at(1, 1), 'e-bokh': at(6, 4), 'p-storm': at(1, 5)});
    const b = unit(s, 'p-bokh');
    b.statuses.push({kind: 'immobilized'});
    s.events = [];
    expect(onlyHold(s, mapOf(s), b)).toBe(true);
    const next = advanceToDecision(s)!;
    expect(next.id).not.toBe('p-bokh');
    expect(s.events.some((e) => e.kind === 'skip' && e.unitId === 'p-bokh')).toBe(true);
    expect(b.skipped).toBe(true);
    // A skipped turn places the card as any turn does: 2 × speed before a
    // round's end (without a camel, rounds end on multiples of 20), skipped
    // again until the next unit's card comes first.
    expect((b.slot! + RULES.speedSlots * b.speed) % RULES.roundSlots).toBe(0);
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
    m.statuses.push({kind: 'immobilized'});
    expect(arrowLanes(s, mapOf(s), m.hex!).some((l) => l.hit?.id === 'p-storm')).toBe(true);
    expect(arrowLanes(s, mapOf(s), m.hex!).some((l) => l.hit?.side === 'enemy')).toBe(false);
    expect(onlyHold(s, mapOf(s), m)).toBe(true);
    // An enemy in an open lane gives it a shot.
    const open = arrowLanes(s, mapOf(s), m.hex!).find((l) => !l.hit && l.hexes.length > 0)!;
    unit(s, 'e-bokh').hex = open.hexes[0]!;
    expect(onlyHold(s, mapOf(s), m)).toBe(false);
  });

  it('places a card 2 × speed slots before Temee’s next turn, whatever the turn did (3.2)', () => {
    const s = setup({
      'p-camel': at(0, 0),
      'p-mangudai': at(1, 3),
      'p-bokh': at(1, 5),
      'e-bokh': at(6, 4),
    });
    const camel = unit(s, 'p-camel');
    camel.slot = 40;
    const m = unit(s, 'p-mangudai');
    const b = unit(s, 'p-bokh');
    s.currentSlot = 25;
    // Before Temee's card: this round's slot.
    expect(aimSlot(s, m)).toBe(40 - 2 * m.speed);
    expect(aimSlot(s, b)).toBe(40 - 2 * b.speed);
    // Too late for this round: the next one's, Temee's card going 20 on.
    s.currentSlot = 35;
    expect(aimSlot(s, m)).toBe(60 - 2 * m.speed);
    expect(aimSlot(s, b)).toBe(40 - 2 * b.speed);
    // A move and an ability place it alike.
    s.currentSlot = 25;
    m.slot = 25;
    s.awaiting = m.id;
    const moved = cloneFight(s);
    applyTurn(moved, unit(moved, m.id), {move: [at(2, 3)], action: {ability: 'hold'}});
    const held = cloneFight(s);
    applyTurn(held, unit(held, m.id), {action: {ability: 'hold'}});
    expect(unit(moved, m.id).slot).toBe(34);
    expect(unit(held, m.id).slot).toBe(34);
  });

  it('gives every unit one turn in each of Temee’s rounds, the faster first', () => {
    const s = createFight(3);
    s.events = [];
    advance(s, chooseAiTurn);
    // Act out a few rounds, everyone holding.
    const turns: string[] = [];
    for (let i = 0; i < 40 && s.phase === 'fight'; i++) {
      const u = actingUnit(s)!;
      applyTurn(s, u, {action: {ability: 'hold'}});
      advance(s, (_s, _u) => ({action: {ability: 'hold'}}));
    }
    for (const e of s.events) if (e.kind === 'turn') turns.push(e.unitId);
    const rounds: string[][] = [[]];
    for (const id of turns) {
      if (id === 'p-camel') rounds.push([]);
      else rounds[rounds.length - 1]!.push(id);
    }
    // Between two of Temee's turns, every other unit acts exactly once.
    for (const round of rounds.slice(1, -1)) {
      expect(new Set(round).size).toBe(round.length);
      expect(round.length).toBe(s.units.filter((u) => u.alive).length - 1);
      // The Outriders (speed 3) act before everyone else.
      expect(new Set(round.slice(0, 2))).toEqual(new Set(['p-mangudai', 'e-mangudai']));
    }
    expect(rounds.length).toBeGreaterThan(3);
  });

  it('moves Temee’s card 20 slots on after each of its turns', () => {
    const s = setup({'p-camel': at(0, 0), 'e-bokh': at(6, 6)});
    const camel = unit(s, 'p-camel');
    camel.slot = 0;
    unit(s, 'e-bokh').slot = 500;
    advanceToDecision(s);
    expect(camel.slot).toBe(RULES.roundSlots);
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

  it('starts Temee at slot 0 and the rest 2 × speed before its next turn, without two in one slot (3.4)', () => {
    const s = createFight(1);
    const slots = s.units.map((u) => u.slot);
    expect(new Set(slots).size).toBe(7);
    expect(unit(s, 'p-camel').slot).toBe(0);
    // The Outriders tie as fastest: whichever is placed first gets the rule's slot, the other yields.
    expect(Math.min(unit(s, 'p-mangudai').slot!, unit(s, 'e-mangudai').slot!)).toBe(
      RULES.roundSlots - RULES.speedSlots * HEROES.mangudai.speed
    );
    for (const u of s.units) if (u.hero !== 'camel') expect(u.slot!).toBeLessThan(RULES.roundSlots);
  });
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

  it('scatters each fight’s ruins by its seed: unmirrored, clear of the edges, the board connected', () => {
    const count = (tiles: Record<string, string>, t: string) =>
      Object.values(tiles).filter((v) => v === t).length;
    const layouts = new Set<string>();
    let asymmetric = 0;
    for (let seed = 0; seed < 40; seed++) {
      const s = createFight(seed);
      const map = mapOf(s);
      expect(map.tiles).toBe(s.tiles);
      expect(JSON.stringify(createFight(seed).tiles)).toBe(JSON.stringify(s.tiles));
      expect(count(map.tiles, 'obstacle')).toBe(6);
      expect(Object.keys(map.tiles)).toHaveLength(6);
      const ruinRows = [];
      for (const [key, tile] of Object.entries(map.tiles)) {
        const [q, r] = key.split(',').map(Number);
        const {col, row} = hexToOffset({q: q!, r: r!});
        // Two columns clear of each edge.
        expect(col >= (row & 1 ? 1 : 2) && col <= 5).toBe(true);
        if (tile === 'obstacle') ruinRows.push(row);
      }
      expect(ruinRows.filter((r) => r <= 3)).toHaveLength(3);
      expect(ruinRows.filter((r) => r >= 5)).toHaveLength(3);
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

  it('ends a move where it enters hail, which Immobilizes', () => {
    const s = setup({'p-bokh': at(4, 3), 'e-storm': at(7, 6)});
    const b = unit(s, 'p-bokh');
    const dest = at(4, 5); // via (4, 4) or (5, 4)
    const before = reachableHexes(s, mapOf(s), b).find((r) => hexKey(r.hex) === hexKey(dest))!;
    expect(before.path).toHaveLength(2);
    // Hail on both ways there: it can be reached, but not passed.
    for (const h of [at(4, 4), at(5, 4)]) s.effects.push({kind: 'hail', hex: h, source: 'e-storm'});
    const reach = reachableHexes(s, mapOf(s), b);
    expect(reach.some((r) => hexKey(r.hex) === hexKey(dest))).toBe(false);
    expect(reach.some((r) => hexKey(r.hex) === hexKey(at(4, 4)))).toBe(true);
    expect(simulate(s, 'p-bokh', {move: [at(4, 4), dest], action: {ability: 'hold'}})).toBeNull();
    s.awaiting = b.id;
    applyTurn(s, b, {move: [at(4, 4)], action: {ability: 'hold'}});
    expect(b.statuses).toEqual([{kind: 'immobilized', hail: 'e-storm'}]);
    expect(movementCap(b)).toBe(0);
  });

  it('can’t move while Immobilized or Stunned', () => {
    const s = setup({'p-bokh': at(0, 3), 'e-bokh': at(8, 3)});
    const b = unit(s, 'p-bokh');
    expect(movementCap(b)).toBe(RULES.movementCap);
    b.statuses.push({kind: 'immobilized'});
    expect(reachableHexes(s, mapOf(s), b)).toHaveLength(1);
    expect(() => applyTurn(s, b, {move: [at(1, 3)], action: {ability: 'hold'}})).toThrow(RuleError);
    b.statuses = [{kind: 'stunned'}];
    expect(movementCap(b)).toBe(0);
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

describe('stats and damage', () => {
  it('gives each unit (1 + defence) × 2 health', () => {
    const s = createFight(0);
    for (const u of s.units) {
      expect(u.maxHp).toBe((1 + HEROES[u.hero].defence) * 2);
      expect(u.hp).toBe(u.maxHp);
    }
    expect(unit(s, 'p-bokh').maxHp).toBe(8);
    expect(unit(s, 'p-mangudai').maxHp).toBe(4);
    expect(unit(s, 'p-storm').maxHp).toBe(6);
  });

  it('deals exactly the user’s power, whatever the target’s defence', () => {
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(4, 3), 'e-mangudai': at(7, 6)});
    const m = unit(s, 'p-mangudai');
    s.awaiting = m.id;
    applyTurn(s, m, {action: {ability: 'bow', target: {hex: at(4, 3)}}});
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp - m.power);
    expect(m.power).toBe(2);
  });

  it('power 0 deals no damage, and says nothing of it', () => {
    const s = setup({'p-storm': at(1, 3), 'e-bokh': at(3, 3), 'e-mangudai': at(7, 6)});
    const storm = unit(s, 'p-storm');
    s.awaiting = storm.id;
    s.events = [];
    applyTurn(s, storm, {action: {ability: 'hail', target: {hex: at(3, 3)}}});
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp);
    expect(s.events.some((e) => e.kind === 'damage')).toBe(false);
  });

  it('refreshes a saved fight’s stats and health from config.ts', () => {
    const s = createFight(0);
    const b = unit(s, 'p-bokh');
    b.speed = 9;
    b.maxHp = 100;
    b.hp = 50;
    refreshStats(s);
    expect(b.speed).toBe(HEROES.bokh.speed);
    expect(b.maxHp).toBe(8);
    expect(b.hp).toBe(8);
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

  it('Grapple: its power in damage, then the target is Stunned; the Champion stays free', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1), 'e-bokh': at(8, 6)});
    const b = unit(s, 'p-bokh');
    const target = unit(s, 'e-storm');
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: at(2, 1)}}});
    expect(target.hp).toBe(target.maxHp - b.power);
    expect(target.statuses).toEqual([
      {kind: 'stunned', grapple: {champion: 'p-bokh', target: 'e-storm'}},
    ]);
    expect(b.statuses).toEqual([]);
  });

  it('Grapple: a Stunned unit’s turns are skipped while the grapple lasts', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1), 'e-mangudai': at(8, 6)});
    s.units.forEach((u) => (u.controller = 'human'));
    applyTurn(s, unit(s, 'p-bokh'), {action: {ability: 'grapple', target: {hex: at(2, 1)}}});
    const target = unit(s, 'e-storm');
    target.slot = 1;
    s.events = [];
    expect(advanceToDecision(s)!.id).not.toBe('e-storm');
    expect(s.events.some((e) => e.kind === 'skip' && e.unitId === 'e-storm')).toBe(true);
    expect(target.skipped).toBe(true);
    expect(target.statuses.map((x) => x.kind)).toEqual(['stunned']);
  });

  it('Grapple ends when the Champion walks away', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1), 'e-bokh': at(8, 6)});
    const b = unit(s, 'p-bokh');
    const target = unit(s, 'e-storm');
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: at(2, 1)}}});
    const away = reachableHexes(s, mapOf(s), b).find(
      (r) => r.path.length === 1 && hexDistance(r.hex, target.hex!) === 2
    )!;
    applyTurn(s, b, {move: away.path, action: {ability: 'hold'}});
    expect(target.statuses).toEqual([]);
  });

  it('Grapple ends when the Champion takes damage, or is Stunned', () => {
    const s = setup({
      'p-bokh': at(1, 1),
      'e-storm': at(2, 1),
      'e-mangudai': at(1, 4),
      'e-bokh': at(0, 1),
    });
    const b = unit(s, 'p-bokh');
    const target = unit(s, 'e-storm');
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: at(2, 1)}}});
    // Struck by the Outrider.
    const struck = cloneFight(s);
    hit(
      {state: struck, map: mapOf(struck), slot: 0},
      unit(struck, 'e-mangudai'),
      unit(struck, 'p-bokh'),
      'An arrow'
    );
    expect(unit(struck, 'p-bokh').hp).toBe(b.hp - 2);
    expect(unit(struck, 'e-storm').statuses).toEqual([]);
    // The enemy Champion grapples it: Stunned, it lets go.
    applyTurn(s, unit(s, 'e-bokh'), {action: {ability: 'grapple', target: {hex: b.hex!}}});
    expect(b.statuses.map((x) => x.kind)).toEqual(['stunned']);
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
    expect(target.statuses.map((x) => x.kind)).toEqual(['stunned']);
    // Next to it, it grapples where it stands; Immobilized, only that.
    target.statuses = [];
    target.hex = at(2, 1);
    b.hex = at(1, 1);
    expect(ABILITIES.grapple.targets(s, SALT_FLATS, b, b.hex!)).toContainEqual({hex: at(2, 1)});
    b.statuses = [{kind: 'immobilized'}];
    target.hex = at(3, 1);
    expect(ABILITIES.grapple.targets(s, SALT_FLATS, b, b.hex!)).toEqual([]);
  });

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
    expect(second.statuses.map((x) => x.kind)).toEqual(['stunned']);
  });

  it('Throw: only the grappled unit, Moved to a free space next to it, then struck', () => {
    const s = setup({
      'p-bokh': at(3, 3),
      'e-storm': hexNeighbors(at(3, 3))[0]!,
      'e-mangudai': at(8, 6),
    });
    const b = unit(s, 'p-bokh');
    const target = unit(s, 'e-storm');
    expect(HEROES.bokh.abilities).toEqual(['grapple', 'throw', 'hold']);
    expect(ABILITIES.throw.targets(s, SALT_FLATS, b, b.hex!)).toEqual([]);
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: target.hex!}}});
    const throws = ABILITIES.throw.targets(s, SALT_FLATS, b, b.hex!);
    expect(throws.length).toBeGreaterThan(0);
    for (const t of throws) {
      expect(t.hex).toEqual(target.hex);
      expect(hexDistance(t.to!, target.hex!)).toBe(1);
      expect(unitAt(s, t.to!)).toBeUndefined();
    }
    // Landing beside the Champion keeps hold.
    const beside = throws.find((t) => hexDistance(t.to!, b.hex!) === 1)!;
    const kept = cloneFight(s);
    applyTurn(kept, unit(kept, b.id), {action: {ability: 'throw', target: beside}});
    expect(unit(kept, target.id).hex).toEqual(beside.to);
    expect(unit(kept, target.id).hp).toBe(target.hp - b.power);
    expect(unit(kept, target.id).statuses.map((x) => x.kind)).toEqual(['stunned']);
    // Landing away from it breaks the grapple.
    const away = throws.find((t) => hexDistance(t.to!, b.hex!) === 2)!;
    applyTurn(s, b, {action: {ability: 'throw', target: away}});
    expect(target.hex).toEqual(away.to);
    expect(target.statuses).toEqual([]);
  });

  it('hail covers one space within three: a unit there is Immobilized until the caster’s next turn', () => {
    const s = setup({'p-storm': at(1, 3), 'e-mangudai': at(4, 3), 'e-bokh': at(8, 6)});
    const storm = unit(s, 'p-storm');
    const targets = ABILITIES.hail.targets(s, SALT_FLATS, storm, storm.hex!);
    expect(targets.some((t) => hexDistance(t.hex!, storm.hex!) === 3)).toBe(true);
    expect(targets.every((t) => hexDistance(t.hex!, storm.hex!) <= 3)).toBe(true);
    s.awaiting = storm.id;
    applyTurn(s, storm, {action: {ability: 'hail', target: {hex: at(4, 3)}}});
    expect(s.effects).toEqual([{kind: 'hail', hex: at(4, 3), source: 'p-storm'}]);
    const m = unit(s, 'e-mangudai');
    expect(m.statuses).toEqual([{kind: 'immobilized', hail: 'p-storm'}]);
    // Moved out of it, it stays Immobilized until the hail is gone.
    enterHex({state: s, map: mapOf(s), slot: s.currentSlot}, m, at(5, 3), 'throw');
    expect(m.statuses.map((x) => x.kind)).toEqual(['immobilized']);
    // The caster's next turn: the hail lifts, and its hold with it.
    s.units.forEach((u) => (u.controller = 'human'));
    for (const u of s.units) if (u !== storm && u.alive) u.slot = storm.slot! + 10;
    expect(advanceToDecision(s)!.id).toBe('p-storm');
    expect(s.effects).toEqual([]);
    expect(m.statuses).toEqual([]);
  });

  it('hail lifts when its caster falls', () => {
    const s = setup({'p-storm': at(1, 3), 'e-mangudai': at(4, 3), 'e-bokh': at(8, 6)});
    const storm = unit(s, 'p-storm');
    applyTurn(s, storm, {action: {ability: 'hail', target: {hex: at(4, 3)}}});
    kill({state: s, map: mapOf(s), slot: 0}, storm);
    expect(s.effects).toEqual([]);
    expect(unit(s, 'e-mangudai').statuses).toEqual([]);
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

  it('joins the player’s side in the top-left corner, with high defence and the health it gives', () => {
    for (const seed of [1, 2, 3]) {
      const s = createFight(seed);
      const camel = unit(s, 'p-camel');
      expect(camel.side).toBe('player');
      expect(camel.controller).toBe('ai');
      expect(camel.hex).toEqual(SALT_FLATS.camelStart);
      expect(hexToOffset(camel.hex!)).toEqual({col: 0, row: 0});
      expect(camel.defence).toBe(HEROES.camel.defence);
      expect(camel.hp).toBe((1 + camel.defence) * 2);
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

  it('walks one space along its road a turn, its card going 20 slots on, and can’t attack', () => {
    const s = setup({'p-camel': at(2, 4), 'p-bokh': at(0, 0), 'e-bokh': at(6, 0)});
    const camel = unit(s, 'p-camel');
    const road = roadToExit(mapOf(s), at(2, 4));
    camel.slot = 90;
    expect(abilitiesOf(camel).map((d) => d.id)).toEqual(['hold']);
    // Bökh's card is at 100: the camel's turn comes first, with no decision.
    expect(advanceToDecision(s)!.id).toBe('p-bokh');
    expect(camel.hex).toEqual(road[0]);
    expect(camel.slot).toBe(90 + 20);
    expect(RULES.roundSlots).toBe(20);
    expect(s.phase).toBe('fight');
  });

  it('walks around a unit on its road, and waits only when Immobilized, Stunned or boxed in', () => {
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
    expect(camel.slot).toBe(110);

    const held = setup({'p-camel': at(2, 4), 'p-bokh': at(0, 0), 'e-bokh': at(6, 0)});
    const pinned = unit(held, 'p-camel');
    pinned.statuses.push({kind: 'immobilized'});
    pinned.slot = 90;
    advanceToDecision(held);
    expect(pinned.hex).toEqual(at(2, 4));
    expect(pinned.skipped).toBe(true);
    pinned.statuses = [{kind: 'stunned'}];
    held.awaiting = null;
    for (const u of held.units) if (u !== pinned && u.alive) u.slot = 500 + u.partyIndex;
    advanceToDecision(held);
    expect(pinned.hex).toEqual(at(2, 4));
    // Waiting, its card still goes a round on each turn: 110, 130, … 510.
    expect(pinned.slot).toBe(510);

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
  it('rejects walking plus an ability without mutating the fight', () => {
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(4, 3)});
    const shot = {ability: 'bow' as const, target: {hex: at(4, 3)}};
    const before = JSON.stringify(s);
    const input: TurnInput = {action: shot, move: [at(0, 3)]};
    expect(previewTurn(s, 'p-mangudai', input)).toBeNull();
    expect(() => applyTurn(s, unit(s, 'p-mangudai'), input)).toThrow(/separate turns/);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('a move places the card as any turn does, with matching previews and yielding', () => {
    expect(RULES.movementCap).toBe(3);
    for (const length of [1, 2, 3]) {
      const s = setup({'p-mangudai': at(0, 0), 'e-bokh': at(7, 0)});
      const actor = unit(s, 'p-mangudai');
      const input: TurnInput = {
        move: Array.from({length}, (_, i) => at(i + 1, 0)),
        action: {ability: 'hold'},
      };
      const aim = RULES.roundSlots - RULES.speedSlots * actor.speed;
      unit(s, 'e-bokh').slot = aim;
      expect(previewTurn(s, actor.id, input)).toMatchObject({aimSlot: aim, slot: aim + 1});
      s.events = [];
      applyTurn(s, actor, input);
      expect(actor.slot).toBe(aim + 1);
      expect(s.events.some((e) => e.kind === 'action')).toBe(false);
      expect(s.events.filter((e) => e.kind === 'step')).toHaveLength(length);
    }
  });

  it('refuses a move longer than 3 spaces', () => {
    const s = setup({'p-mangudai': at(0, 0), 'e-bokh': at(7, 0)});
    expect(
      tryTurn(s, 'p-mangudai', {
        move: [1, 2, 3, 4].map((c) => at(c, 0)),
        action: {ability: 'hold'},
      })
    ).toThrow(/longer than the unit can go/);
    expect(
      Math.max(...reachableHexes(s, mapOf(s), unit(s, 'p-mangudai')).map((r) => r.path.length))
    ).toBe(3);
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
    expect(ABILITIES.bite.targets(s, mapOf(s), w, w.hex)).toEqual([{hex: at(1, 3)}]);
    ABILITIES.bite.resolve({state: s, map: mapOf(s), slot: 0}, w, {hex: at(1, 3)});
    expect(b.hp).toBe(b.maxHp - w.power);
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
    expect(ROSTER).toEqual(PARTY);
    for (const party of [
      ['modao', 'storm'],
      ['bokh', 'mangudai', 'storm', 'wolf'],
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
    const aim = RULES.roundSlots - RULES.speedSlots * bokh.speed;
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
    Object.assign(old, {speed: 7, defence: 8, power: 40, maxHp: 18});
    const m = runView(saved).fight.units.find((u) => u.id === 'p-mangudai')!;
    expect([m.speed, m.defence, m.power, m.maxHp]).toEqual([
      HEROES.mangudai.speed,
      HEROES.mangudai.defence,
      HEROES.mangudai.power,
      4,
    ]);
    Object.assign(old, {speed: 7, defence: 8});
    const next = handleRunAction(saved, {type: 'turn', action: {ability: 'hold'}});
    expect(next.fight.units.find((u) => u.id === 'p-mangudai')!.speed).toBe(HEROES.mangudai.speed);
  });

  it('plays a whole fight to an end, AI against AI, within the CPU budget per turn', () => {
    // Seed 0 ends; the camel's walk ends any fight in time.
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
      return threatDamage(threats, c, me);
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
    unit(blocked, 'e-mangudai').statuses.push({kind: 'immobilized'});
    const bm = unit(blocked, 'p-mangudai');
    const bt = threatsTo(blocked, SALT_FLATS, bm);
    bm.slot = blocked.currentSlot + 1;
    unit(blocked, 'e-mangudai').slot = 0;
    expect(threatDamage(bt, blocked, bm)).toBe(0);
    // A Stunned enemy threatens nothing.
    unit(s, 'e-mangudai').statuses.push({kind: 'stunned'});
    expect(at3(at(2, 0))).toBe(0);
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
        action: {ability: 'grapple', target: {hex: {q: 99, r: 99}}},
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

  it('records each hex of a move, and a throw as a throw', () => {
    const s = setup({'p-bokh': at(1, 3), 'e-bokh': at(6, 6)});
    s.events = [];
    applyTurn(s, unit(s, 'p-bokh'), {move: [at(1, 4), at(2, 4)], action: {ability: 'hold'}});
    expect(s.events.filter((e) => e.kind === 'step')).toMatchObject([
      {from: at(1, 3), to: at(1, 4), how: 'walk'},
      {from: at(1, 4), to: at(2, 4), how: 'walk'},
    ]);
    s.events = [];
    enterHex({state: s, map: SALT_FLATS, slot: 0}, unit(s, 'e-bokh'), at(5, 6), 'throw');
    expect(s.events[0]).toMatchObject({kind: 'step', unitId: 'e-bokh', how: 'throw'});
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
