import {describe, expect, it, onTestFinished} from 'vitest';
import {
  hexDistance,
  hexEquals,
  hexKey,
  hexFromKey,
  hexNeighbor,
  hexNeighbors,
  hexToOffset,
  hexToPixel,
  offsetToHex,
} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {
  ABILITY,
  AI,
  FIRST_ENEMY,
  HEROES,
  PARTY,
  PASSIVE_OFFER,
  REGIONS,
  ROSTER,
  RULES,
  STAGES,
  healthOf,
} from './config';
import {
  canMove,
  invalidPath,
  lineOfFire,
  movementCap,
  reachableHexes,
  roadToExit,
  unitAt,
  firstInLane,
  shotLane,
  abilityCount,
  hasRoomForAbility,
} from './board';
import {ABILITIES, abilitiesOf, arrowLanes, unusableReason} from './abilities';
import {chooseAiTurn, scoreOptions, simulate} from './ai';
import {threatDamage, threatsTo} from './threat';
import {offeredTargets, onlyHold, targetAt} from './choices';
import {
  RuleError,
  actingUnit,
  advanceToDecision,
  applyTurn,
  charging,
  cloneFight,
  createFight,
  mapOf,
  refreshStats,
} from './fight';
import {PASSIVES} from './passives';
import {previewTurn} from './preview';
import {
  FLAMING,
  GOBI,
  MAPS,
  MAX_COVERED,
  STEPPE,
  blocks,
  depth,
  mapById,
  onMap,
  spaceAt,
  spaceOf,
  tileAt,
} from './map';
import {tileInfo} from './info';
import {checkEnd, damageOf, weaken, empower, enterHex, hit, kill, stun} from './resolve';
import type {Ctx} from './resolve';
import {
  RUN_FORMAT,
  createRun,
  handleRunAction,
  runOutdated,
  runStatus,
  runView,
  stageEnemies,
} from './run';
import type {RunState} from './run';
import {
  actionCost,
  aimSlot,
  chargeOf,
  freeSlotFrom,
  nextCard,
  placeCard,
  simultaneousOrder,
} from './track';
import type {FightState, HeroId, PassiveId, TurnInput, Unit} from './types';

/**
 * A space written as the old board of rows' column and row (pointy-top,
 * 9 rows, its centre at column 3, row 3), moved so that centre is this
 * board's centre hex: the tests' layouts keep every distance, lane and
 * neighbour they had.
 */
const at = (col: number, row: number): Hex => {
  const h = offsetToHex({col, row});
  return {q: h.q - 2, r: h.r - 3};
};

/**
 * Gives `hero` upgrade abilities (`upgrades` in config.ts; its first by
 * default) for the current test, before Hold: they are earned during a
 * run, not in a starting kit (owner, 2026-10-24), up to two abilities.
 */
function upgrade(hero: HeroId, abilities = HEROES[hero].upgrades!.slice(0, 1)): void {
  const kit = HEROES[hero].abilities;
  HEROES[hero].abilities = [...kit.filter((a) => a !== 'hold'), ...abilities, 'hold'];
  expect(abilityCount(HEROES[hero].abilities)).toBeLessThanOrEqual(RULES.maxAbilities);
  onTestFinished(() => {
    HEROES[hero].abilities = kit;
  });
}

/**
 * A fight in progress with units where a test wants them: every unit not
 * listed is removed (dead), and cards start far apart. The camel, unless
 * listed, isn't there at all: dead, it would lose the fight.
 */
function setup(placements: Record<string, Hex>, party: HeroId[] = PARTY): FightState {
  const state = createFight(0, party, party);
  // The fixed layout, which these tests place units around.
  state.tiles = {...STEPPE.tiles};
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

/**
 * A run's next request, as the page sends it: the AI's turn when one is
 * due (`continue`), otherwise the player's, `turn` or the AI's pick for it.
 */
function request(run: RunState, turn?: TurnInput): RunState {
  if (runView(run).aiDue) return handleRunAction(run, {type: 'continue'});
  return handleRunAction(run, {
    type: 'turn',
    ...(turn ?? chooseAiTurn(run.fight, actingUnit(run.fight)!)),
  });
}

describe('the track', () => {
  it('skips a turn with only Hold to choose, and marks it till the unit next acts', () => {
    // Immobilized with no one in reach: Grapple has no target.
    const s = setup({'p-bokh': at(1, 1), 'e-bokh': at(6, 4), 'p-storm': at(1, 5)});
    const b = unit(s, 'p-bokh');
    b.statuses.push({kind: 'immobilized'});
    s.events = [];
    expect(onlyHold(s, mapOf(s), b)).toBe(true);
    const from = b.slot!;
    const next = advanceToDecision(s)!;
    expect(next.id).not.toBe('p-bokh');
    expect(s.events.some((e) => e.kind === 'skip' && e.unitId === 'p-bokh')).toBe(true);
    expect(b.skipped).toBe(true);
    // A skipped turn places the card as any turn does: its action cost on,
    // skipped again until the next unit's card comes first.
    expect((b.slot! - from) % actionCost(b)).toBe(0);
    expect(b.slot).toBeGreaterThan(next.slot!);
    // Free again by its next turn: it acts, and the mark goes.
    b.statuses = [];
    for (let u = next; u.id !== 'p-bokh'; u = advanceToDecision(s)!)
      applyTurn(s, u, {action: {ability: 'hold'}});
    expect(b.skipped).toBeUndefined();
  });

  it('skips a unit whose only targets are allies', () => {
    // Allies aren't offered as targets, so an Immobilized wolf with only an ally beside it holds.
    const s = setup({'p-wolf': at(1, 1), 'p-bokh': at(2, 1), 'e-bokh': at(6, 6)}, ['wolf', 'bokh']);
    const w = unit(s, 'p-wolf');
    w.statuses.push({kind: 'immobilized'});
    expect(ABILITIES.bite.targets(s, mapOf(s), w, w.hex!).length).toBe(1);
    expect(onlyHold(s, mapOf(s), w)).toBe(true);
    // An enemy beside it gives it a bite.
    unit(s, 'e-bokh').hex = hexNeighbors(w.hex!).find((h) => !unitAt(s, h) && onMap(STEPPE, h))!;
    expect(onlyHold(s, mapOf(s), w)).toBe(false);
  });

  /** A Skirmish on `target`: the first of its steps that has it in line. */
  const skirmishOn = (s: FightState, m: Unit, target: Unit): TurnInput => {
    const t = ABILITIES.skirmish
      .targets(s, mapOf(s), m, m.hex!)
      .find((o) => hexKey(o.hex!) === hexKey(target.hex!))!;
    return {action: {ability: 'skirmish', target: t}};
  };

  it('the second abilities are upgrades, not in a starting kit', () => {
    expect(HEROES.bokh.abilities).toEqual(['grapple', 'hold']);
    expect(HEROES.bokh.upgrades).toEqual(['haul', 'shove']);
    expect(HEROES.mangudai.abilities).toEqual(['longshot', 'hold']);
    expect(HEROES.mangudai.upgrades).toEqual(['skirmish', 'volley', 'feignedRetreat']);
    expect(HEROES.storm.abilities).toEqual(['hail', 'hold']);
    expect(HEROES.storm.upgrades).toEqual(['sunlight', 'gale']);
    // At most two abilities besides Hold (owner, 2026-10-25): each hero
    // takes one of its upgrades.
    for (const h of ROSTER) expect(hasRoomForAbility(HEROES[h].abilities)).toBe(true);
    expect(hasRoomForAbility([...HEROES.bokh.abilities, 'haul'])).toBe(false);
    expect(hasRoomForAbility([...HEROES.mangudai.abilities, 'skirmish'])).toBe(false);
    expect(hasRoomForAbility([...HEROES.storm.abilities, 'sunlight'])).toBe(false);
    for (const h of ROSTER)
      expect(abilityCount(HEROES[h].abilities)).toBeLessThanOrEqual(RULES.maxAbilities);
    const s = setup({'p-mangudai': at(1, 3), 'p-storm': at(2, 3), 'e-bokh': at(5, 4)});
    expect(unusableReason(unit(s, 'p-mangudai'), ABILITIES.skirmish)).not.toBeNull();
    expect(unusableReason(unit(s, 'p-storm'), ABILITIES.sunlight)).not.toBeNull();
    upgrade('mangudai');
    expect(unusableReason(unit(s, 'p-mangudai'), ABILITIES.skirmish)).toBeNull();
  });

  it('Skirmish steps one space, then draws on a unit in line from there, and the arrow flies as its charging card comes back', () => {
    upgrade('mangudai');
    const s = setup({
      'p-mangudai': at(1, 3),
      'p-storm': at(2, 3),
      'e-bokh': at(5, 4),
      'e-storm': at(8, 6),
    });
    const m = unit(s, 'p-mangudai');
    const bokh = unit(s, 'e-bokh');
    // The ally stands between: Longshot's lane stops at it.
    expect(arrowLanes(s, mapOf(s), m.hex!).some((l) => l.hit?.side === 'enemy')).toBe(false);
    const options = ABILITIES.skirmish.targets(s, mapOf(s), m, m.hex!);
    // Every option steps to a free space next to it, with its target first in a lane from there.
    for (const o of options) {
      expect(hexDistance(o.to!, m.hex!)).toBe(1);
      expect(unitAt(s, o.to!)).toBeUndefined();
      expect(
        [0, 1, 2, 3, 4, 5].some((d) => {
          const u = firstInLane(s, mapOf(s), o.to!, d, m);
          return u !== undefined && hexKey(u.hex!) === hexKey(o.hex!);
        })
      ).toBe(true);
    }
    const input = skirmishOn(s, m, bokh);
    expect(input.action.target).toBeDefined();
    const step = input.action.target!.to!;
    // Charged: the card goes half its action cost on (4 of 8), and the preview says so.
    const now = s.currentSlot;
    expect(actionCost(m)).toBe(8);
    expect(chargeOf(m, 'skirmish')).toBe(4);
    expect(previewTurn(s, m.id, input)!.aimSlot).toBe(now + 4);
    applyTurn(s, m, input);
    expect(m.hex).toEqual(step);
    expect(m.slot).toBe(now + 4);
    expect(charging(s, m)).toBe(true);
    expect(bokh.hp).toBe(bokh.maxHp);
    expect(s.shots).toHaveLength(1);
    expect(shotLane(s, mapOf(s), s.shots![0]!).at(-1)).toEqual(bokh.hex);
    // Everyone else holds, so the next decision of the Outrider's is its turn after the shot.
    s.units.forEach((u) => (u.controller = 'human'));
    for (let d = advanceToDecision(s); d && d !== m; d = advanceToDecision(s))
      applyTurn(s, d, {action: {ability: 'hold'}});
    expect(bokh.hp).toBe(bokh.maxHp - m.power);
    expect(s.shots).toEqual([]);
    expect(charging(s, m)).toBe(false);
    // The shot was no turn: the card went its action cost on from there.
    expect(s.currentSlot).toBe(now + 4 + actionCost(m));
  });

  it('Skirmish needs a free space to step to, and none while Immobilized', () => {
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(5, 4), 'e-storm': at(8, 6)});
    const m = unit(s, 'p-mangudai');
    expect(ABILITIES.skirmish.targets(s, mapOf(s), m, m.hex!).length).toBeGreaterThan(0);
    m.statuses.push({kind: 'immobilized'});
    expect(ABILITIES.skirmish.targets(s, mapOf(s), m, m.hex!)).toEqual([]);
  });

  it('a charging card is pushed into its slot, whatever the speed of the card there', () => {
    upgrade('mangudai');
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(5, 4), 'e-storm': at(8, 6)});
    const m = unit(s, 'p-mangudai');
    const storm = unit(s, 'e-storm');
    s.units.forEach((u) => (u.slot = u === m ? 0 : null));
    s.currentSlot = 0;
    storm.speed = m.speed + 5;
    storm.slot = 4;
    applyTurn(s, m, skirmishOn(s, m, unit(s, 'e-bokh')));
    expect(m.slot).toBe(4);
    expect(storm.slot).toBe(5);
  });

  it('a drawn arrow hits the first unit in its lane when it flies: its target can step out, and another step in', () => {
    upgrade('mangudai');
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(5, 4), 'e-storm': at(8, 6)});
    const m = unit(s, 'p-mangudai');
    const bokh = unit(s, 'e-bokh');
    const storm = unit(s, 'e-storm');
    applyTurn(s, m, skirmishOn(s, m, bokh));
    const lane = shotLane(s, mapOf(s), s.shots![0]!);
    expect(lane.at(-1)).toEqual(bokh.hex);
    expect(lane.length).toBeGreaterThan(1);
    // The Champion steps out of the line; the Storm Caller steps into it, nearer.
    const ctx = {state: s, map: mapOf(s), slot: s.currentSlot};
    const away = hexNeighbors(bokh.hex!).find(
      (h) => onMap(STEPPE, h) && !unitAt(s, h) && !lane.some((l) => hexKey(l) === hexKey(h))
    )!;
    enterHex(ctx, bokh, away);
    enterHex(ctx, storm, lane[0]!);
    s.units.forEach((u) => (u.controller = 'human'));
    for (let d = advanceToDecision(s); d && d !== m; d = advanceToDecision(s))
      applyTurn(s, d, {action: {ability: 'hold'}});
    expect(bokh.hp).toBe(bokh.maxHp);
    expect(storm.hp).toBe(storm.maxHp - m.power);
    expect(s.shots).toEqual([]);
  });

  it('a drawn arrow carries the Empower its Outrider drew with, though the Empower ends with that turn', () => {
    upgrade('mangudai');
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(5, 4), 'e-storm': at(8, 6)});
    const m = unit(s, 'p-mangudai');
    const bokh = unit(s, 'e-bokh');
    empower({state: s, map: mapOf(s), slot: s.currentSlot}, m, 2);
    m.empowerStarted = true;
    applyTurn(s, m, skirmishOn(s, m, bokh));
    expect(m.empower).toBeUndefined();
    s.units.forEach((u) => (u.controller = 'human'));
    for (let d = advanceToDecision(s); d && d !== m; d = advanceToDecision(s))
      applyTurn(s, d, {action: {ability: 'hold'}});
    expect(s.shots).toEqual([]);
    expect(bokh.hp).toBe(bokh.maxHp - m.power - 2);
  });

  it('a drawn arrow is lost when its Outrider falls first', () => {
    upgrade('mangudai');
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(5, 4), 'e-storm': at(8, 6)});
    const m = unit(s, 'p-mangudai');
    applyTurn(s, m, skirmishOn(s, m, unit(s, 'e-bokh')));
    kill({state: s, map: mapOf(s), slot: 0}, m);
    expect(s.shots).toEqual([]);
  });

  it('a drawn arrow is lost when its Outrider is Stunned first, and its card comes back as a skipped turn', () => {
    upgrade('mangudai');
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(5, 4), 'e-storm': at(8, 6)});
    const m = unit(s, 'p-mangudai');
    const bokh = unit(s, 'e-bokh');
    applyTurn(s, m, skirmishOn(s, m, bokh));
    const back = m.slot;
    stun({state: s, map: mapOf(s), slot: s.currentSlot}, m, {kind: 'stunned'});
    expect(s.shots).toEqual([]);
    expect(charging(s, m)).toBe(false);
    // Everyone else holds until the Outrider's card has come back.
    s.units.forEach((u) => (u.controller = 'human'));
    for (let d = advanceToDecision(s); d && s.currentSlot <= back!; d = advanceToDecision(s))
      applyTurn(s, d, {action: {ability: 'hold'}});
    expect(bokh.hp).toBe(bokh.maxHp);
    expect(s.log.some((l) => l.slot === back && l.text.includes('Stunned: turn skipped'))).toBe(
      true
    );
  });

  it('places a card 60 ÷ (speed + 5) slots on, rounded, whatever the turn did (3.2)', () => {
    const s = setup({
      'p-camel': at(0, 0),
      'p-mangudai': at(1, 3),
      'p-bokh': at(1, 5),
      'e-bokh': at(6, 4),
    });
    unit(s, 'p-camel').slot = 40;
    const m = unit(s, 'p-mangudai');
    const b = unit(s, 'p-bokh');
    s.currentSlot = 25;
    // Speed 3 costs 8 slots, speed 2 costs 9, wherever Temee's card is.
    expect(aimSlot(s, m)).toBe(33);
    expect(aimSlot(s, b)).toBe(34);
    s.currentSlot = 35;
    expect(aimSlot(s, m)).toBe(43);
    // A move and an ability place it alike.
    s.currentSlot = 25;
    m.slot = 25;
    s.awaiting = m.id;
    const moved = cloneFight(s);
    applyTurn(moved, unit(moved, m.id), {move: [at(2, 3)], action: {ability: 'hold'}});
    const held = cloneFight(s);
    applyTurn(held, unit(held, m.id), {action: {ability: 'hold'}});
    expect(unit(moved, m.id).slot).toBe(33);
    expect(unit(held, m.id).slot).toBe(33);
  });

  it('gives the faster more turns: Outriders before Bökh, Bökh before Temee', () => {
    // A sparse track, so yielding doesn't blur the costs.
    const s = setup({
      'p-camel': at(0, 0),
      'p-mangudai': at(1, 3),
      'p-bokh': at(1, 5),
      'e-bokh': at(6, 4),
    });
    // Held in place, so it never reaches the exit and ends the fight.
    unit(s, 'p-camel').statuses.push({kind: 'immobilized'});
    s.events = [];
    for (let u = advanceToDecision(s); u && s.currentSlot < 600; u = advanceToDecision(s))
      applyTurn(s, u, {action: {ability: 'hold'}});
    const turns = (id: string) =>
      s.events!.filter((e) => e.kind === 'turn' && e.unitId === id).length;
    expect(turns('p-mangudai')).toBeGreaterThan(turns('p-bokh'));
    expect(turns('p-bokh')).toBeGreaterThan(turns('p-camel'));
  });

  it('moves Temee’s card its action cost on after each of its turns', () => {
    const s = setup({'p-camel': at(0, 0), 'e-bokh': at(6, 6)});
    const camel = unit(s, 'p-camel');
    camel.slot = 0;
    unit(s, 'e-bokh').slot = 500;
    advanceToDecision(s);
    expect(camel.slot).toBe(RULES.actionBase);
  });

  it('yields an equal or slower card to the next free slot, cascading (3.3)', () => {
    const s = setup({'p-bokh': at(0, 0), 'p-storm': at(0, 1), 'e-bokh': at(8, 0)});
    unit(s, 'p-storm').slot = 10;
    unit(s, 'e-bokh').slot = 11;
    expect(placeCard(s, unit(s, 'p-bokh'), 10)).toBe(12);
    expect(unit(s, 'p-storm').slot).toBe(10);
    expect(unit(s, 'e-bokh').slot).toBe(11);
    expect(freeSlotFrom(s, 9)).toBe(9);
  });

  it('gives a faster card the slot, moving the slower one on by the same rule (3.3)', () => {
    const s = setup({
      'p-mangudai': at(0, 0),
      'p-storm': at(0, 1),
      'p-camel': at(0, 2),
      'e-bokh': at(8, 0),
    });
    // Storm Caller (2) at 10, Temee (0) at 11, Bökh (2) at 12.
    unit(s, 'p-storm').slot = 10;
    unit(s, 'p-camel').slot = 11;
    unit(s, 'e-bokh').slot = 12;
    // The Outrider (3) takes 10; the Storm Caller, moved on, takes Temee's
    // 11; Temee, slower than Bökh, yields past 12 to 13.
    expect(placeCard(s, unit(s, 'p-mangudai'), 10)).toBe(10);
    expect(unit(s, 'p-storm').slot).toBe(11);
    expect(unit(s, 'p-camel').slot).toBe(13);
    expect(unit(s, 'e-bokh').slot).toBe(12);
  });

  it('starts each side on its two outermost columns, scattered by the seed, with no deployment', () => {
    const map = STEPPE;
    const starts = new Set<string>();
    const columns = new Set<number>();
    for (let seed = 0; seed < 20; seed++) {
      const s = createFight(seed);
      expect(s.phase).toBe('fight');
      expect(JSON.stringify(createFight(seed))).toBe(JSON.stringify(s));
      for (const side of ['player', 'enemy'] as const) {
        const column = new Set(map.startColumns[side].map(hexKey));
        // The camel starts at the top point (tested with the camel).
        const hexes = s.units
          .filter((u) => u.side === side && u.hero !== 'camel')
          .map((u) => hexKey(u.hex!));
        expect(hexes.every((h) => column.has(h))).toBe(true);
        expect(new Set(hexes).size).toBe(hexes.length);
        expect(hexes.every((h) => !blocks(s.tiles[h]))).toBe(true);
        for (const h of hexes) columns.add(hexFromKey(h).q);
      }
      starts.add(s.units.map((u) => hexKey(u.hex!)).join(' '));
      expect(s.units.every((u) => u.slot !== null)).toBe(true);
    }
    expect(starts.size).toBeGreaterThan(10);
    // Both columns are used.
    expect(columns).toEqual(new Set([-4, -3, 3, 4]));
    // The hexagon's two columns on each side: the straight edge, five hexes, and six in from it.
    expect(map.startColumns.player.map((h) => h.q)).toEqual([
      ...Array(5).fill(-4),
      ...Array(6).fill(-3),
    ]);
    expect(map.startColumns.enemy.map((h) => h.q)).toEqual([
      ...Array(5).fill(4),
      ...Array(6).fill(3),
    ]);
  });

  it('starts no unit boxed in by mountains and the units beside it', () => {
    for (let seed = 0; seed < 300; seed++) {
      const s = createFight(seed);
      for (const u of s.units) expect(canMove(s, mapOf(s), u)).toBe(true);
    }
  });

  it('orders simultaneous placement: speed, then the player’s side first, then party order', () => {
    const s = createFight(0);
    const order = simultaneousOrder(s.units).map((u) => u.id);
    // Outriders are fastest; the heroes after them tie, the player's
    // first; the camel, slowest, is last.
    expect(order).toEqual([
      'p-mangudai',
      'e-mangudai',
      'p-bokh',
      'p-storm',
      'e-bokh',
      'e-storm',
      'p-camel',
    ]);
  });

  it('starts every fight in the same order, the faster first, ties the player’s first', () => {
    for (let seed = 0; seed < 20; seed++) {
      const order = createFight(seed)
        .units.slice()
        .sort((a, b) => a.slot! - b.slot!)
        .map((u) => u.id);
      expect(order).toEqual([
        'p-mangudai',
        'e-mangudai',
        'p-bokh',
        'p-storm',
        'e-bokh',
        'e-storm',
        'p-camel',
      ]);
    }
  });

  it('starts the fastest from slot 0, a free slot between speeds, and Temee last at slot 12 (3.4)', () => {
    const s = createFight(1);
    const slots = Object.fromEntries(s.units.map((u) => [u.id, u.slot]));
    expect(slots).toEqual({
      'p-mangudai': 0,
      'e-mangudai': 1,
      'p-bokh': 3,
      'p-storm': 4,
      'e-bokh': 5,
      'e-storm': 6,
      'p-camel': 12,
    });
  });
});

describe('the board', () => {
  it('has a map per region, each the Steppe’s board under another look', () => {
    expect(Object.keys(MAPS)).toEqual(['steppe', 'gobi', 'flaming']);
    expect(mapById('gobi')).toBe(GOBI);
    expect(mapById('flaming')).toBe(FLAMING);
    expect(() => mapById('atlantis')).toThrow();
    for (const map of [GOBI, FLAMING]) {
      expect(map.hexes).toBe(STEPPE.hexes);
      expect(map.camelStart).toEqual(STEPPE.camelStart);
      expect(map.exits).toEqual(STEPPE.exits);
    }
    // Each stage names a map there is.
    for (const stage of STAGES) expect(MAPS[stage.map]).toBeDefined();
  });

  it('fights on the map given, its ruins scattered as the yurts are, the Gobi with no mountains', () => {
    for (let seed = 0; seed < 40; seed++) {
      // Even a stage that always has mountains has none in the Gobi.
      const s = createFight(seed, undefined, undefined, true, [], GOBI);
      expect(s.mapId).toBe('gobi');
      expect(mapOf(s).name).toBe('The Gobi Crossing');
      const tiles = Object.values(s.tiles);
      // More ruins than the Steppe's yurts, since there are no mountains.
      expect([4, 5]).toContain(tiles.filter((t) => t === 'obstacle').length);
      // None next to the camel's start or the exit.
      for (const [key, t] of Object.entries(s.tiles)) {
        const [q, r] = key.split(',').map(Number);
        for (const x of [GOBI.camelStart, ...GOBI.exits])
          if (t === 'obstacle') expect(hexDistance({q: q!, r: r!}, x)).toBeGreaterThan(1);
      }
      expect(tiles).not.toContain('mountain');
      for (const u of s.units) expect(canMove(s, mapOf(s), u)).toBe(true);
    }
    expect(Object.values(createFight(3, undefined, undefined, true).tiles)).toContain('mountain');
  });

  it('raises the Flaming Mountains in every fight, in clumps in the middle, with one or two beacon towers', () => {
    let steppeWithout = 0;
    const towerCounts = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      // Not a stage that asks for mountains: the map raises them itself.
      const s = createFight(seed, undefined, undefined, false, [], FLAMING);
      expect(s.mapId).toBe('flaming');
      expect(mapOf(s).name).toBe('The Flaming Mountains');
      // Two clumps of 2 to 4 in the middle, apart, off the
      // starting columns and Temee's road, not next to its start or exit.
      const mountains = Object.keys(s.tiles)
        .filter((k) => s.tiles[k] === 'mountain')
        .map((k) => k.split(',').map(Number) as [number, number])
        .map(([q, r]) => ({q, r}));
      for (const m of mountains) {
        expect(hexDistance(m, {q: 0, r: 0})).toBeLessThanOrEqual(3);
        expect(Math.abs(m.q)).toBeLessThan(3);
        expect(m.q).not.toBe(0);
        for (const x of [FLAMING.camelStart, ...FLAMING.exits])
          expect(hexDistance(m, x)).toBeGreaterThan(1);
      }
      const clumps: Hex[][] = [];
      for (const m of mountains) {
        const touching = clumps.filter((c) => c.some((n) => hexDistance(n, m) === 1));
        const merged = [m, ...touching.flat()];
        for (const c of touching) clumps.splice(clumps.indexOf(c), 1);
        clumps.push(merged);
      }
      expect(clumps).toHaveLength(2);
      for (const c of clumps) expect(c.length).toBeGreaterThanOrEqual(2);
      for (const c of clumps) expect(c.length).toBeLessThanOrEqual(4);
      // One or two beacon towers, apart from each other and the mountains,
      // covering at most 8 spaces with them.
      const towers = Object.keys(s.tiles)
        .filter((k) => s.tiles[k] === 'obstacle')
        .map((k) => k.split(',').map(Number) as [number, number])
        .map(([q, r]) => ({q, r}));
      expect(towers.length).toBeGreaterThanOrEqual(1);
      expect(towers.length).toBeLessThanOrEqual(2);
      towerCounts.add(towers.length);
      expect(mountains.length + towers.length).toBeLessThanOrEqual(MAX_COVERED);
      expect(MAX_COVERED).toBe(8);
      for (const t of towers) {
        expect(hexDistance(t, {q: 0, r: 0})).toBeLessThanOrEqual(3);
        for (const o of [...towers, ...mountains])
          if (o !== t) expect(hexDistance(t, o)).toBeGreaterThan(1);
      }
      for (const u of s.units) expect(canMove(s, mapOf(s), u)).toBe(true);
      // The same seed's Steppe fight lacks them about half the time.
      const steppe = createFight(seed, undefined, undefined, false);
      if (!Object.values(steppe.tiles).includes('mountain')) steppeWithout++;
    }
    expect(steppeWithout).toBeGreaterThan(0);
    expect([...towerCounts].sort()).toEqual([1, 2]);
  });

  it('names the ground after the map’s look', () => {
    expect(tileInfo('steppe', 'obstacle').name).toBe('Yurt');
    expect(tileInfo('gobi', 'obstacle').name).toBe('Ruins');
    expect(tileInfo('gobi', 'sand').name).toBe('Gravel');
    expect(tileInfo('gobi', 'mountain').name).toBe('Mountains');
    expect(tileInfo('flaming', 'sand').name).toBe('Red earth');
    expect(tileInfo('flaming', 'obstacle').name).toBe('Beacon tower');
    expect(tileInfo('flaming', 'mountain').name).toBe('Flaming Mountains');
  });

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
        run = request(run);
      }
    }
    // Both answers came up, so neither side of the comparison went unchecked.
    expect(checked).toBeGreaterThan(1000);
    expect(boxedIn).toBeGreaterThan(0);
  });

  it('is a hexagon of 61 flat-top hexes, 4 from the centre, its columns 5 to 9 to 5 long, a left-right mirror', () => {
    const map = STEPPE;
    expect(map.hexes).toHaveLength(61);
    expect(new Set(map.hexes.map(hexKey)).size).toBe(61);
    for (const h of map.hexes) expect(hexDistance(h, {q: 0, r: 0})).toBeLessThanOrEqual(4);
    const lengths = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map(
      (q) => map.hexes.filter((h) => h.q === q).length
    );
    expect(lengths).toEqual([5, 6, 7, 8, 9, 8, 7, 6, 5]);
    // Top to bottom: the camel's top point first, the exit last.
    expect(map.hexes[0]).toEqual(map.camelStart);
    expect(map.hexes.at(-1)).toEqual(map.exits[0]);
    // Mirror about the centre column: flat-top hexes keep their height, r + q/2.
    const mirror = (h: Hex): Hex => ({q: -h.q, r: h.r + h.q});
    for (const h of map.hexes) expect(onMap(map, mirror(h))).toBe(true);
    const zone = new Set(map.startColumns.enemy.map(hexKey));
    for (const h of map.startColumns.player) expect(zone.has(hexKey(mirror(h)))).toBe(true);
    // A column and a row down it name each space once.
    for (const h of map.hexes) {
      const {col, row} = spaceOf(h);
      expect(spaceAt(col, row)).toEqual(h);
    }
    expect(spaceAt(0, 0)).toEqual(map.startColumns.player[0]);
    expect(spaceAt(4, 0)).toEqual(map.camelStart);
  });

  it('raises one clump of 3 to 5 mountains along a slanted edge in about half of fights, off the sides, the middle and the centre', () => {
    const centre: Hex = {q: 0, r: 0};
    const corners = new Set<string>();
    let withMountains = 0;
    for (let seed = 0; seed < 60; seed++) {
      const tiles = createFight(seed).tiles;
      const at = (t: string) =>
        Object.keys(tiles)
          .filter((k) => tiles[k] === t)
          .map(hexFromKey);
      const mountains = at('mountain');
      if (!mountains.length) continue;
      withMountains++;
      expect(mountains.length).toBeGreaterThanOrEqual(3);
      expect(mountains.length).toBeLessThanOrEqual(5);
      // Never near the centre.
      for (const m of mountains) expect(hexDistance(m, centre)).toBeGreaterThanOrEqual(3);
      // One clump: every mountain reachable from the first through mountains.
      const seen = new Set([hexKey(mountains[0]!)]);
      const queue = [mountains[0]!];
      for (let h; (h = queue.shift()); )
        for (const n of mountains)
          if (hexDistance(h, n) === 1 && !seen.has(hexKey(n))) {
            seen.add(hexKey(n));
            queue.push(n);
          }
      expect(seen.size).toBe(mountains.length);
      // One corner: all left of the middle column or all right, all in the
      // top half or all in the bottom, never on or next to the sides, at
      // least one on the board's edge.
      const left = mountains[0]!.q < 0;
      const top = depth(mountains[0]!) < 0;
      for (const m of mountains) {
        expect(m.q).not.toBe(0);
        expect(m.q < 0).toBe(left);
        expect(depth(m) < 0).toBe(top);
        expect(Math.abs(m.q)).toBeLessThan(4);
        if (Math.abs(m.q) === 3) expect(hexDistance(m, centre)).toBe(4);
      }
      // Hugging the edge: a hex in from it only once the edge's three are taken.
      const onEdge = mountains.filter((m) => hexDistance(m, centre) === 4).length;
      expect(onEdge).toBe(Math.min(3, mountains.length));
      corners.add(`${left} ${top}`);
    }
    expect(withMountains).toBeGreaterThan(15);
    expect(withMountains).toBeLessThan(45);
    // Every corner comes up.
    expect(corners.size).toBe(4);
  });

  it('always raises mountains in the first three stages of a run', () => {
    const hasMountains = (s: FightState) => Object.values(s.tiles).includes('mountain');
    for (let seed = 0; seed < 40; seed++) {
      expect(hasMountains(createFight(seed, PARTY, PARTY, true))).toBe(true);
      expect(hasMountains(createRun(seed).fight)).toBe(true);
    }
  });

  it('pitches two or three yurts near the middle by each fight’s seed: unmirrored, apart, clear of the outermost columns, the board connected', () => {
    const layouts = new Set<string>();
    const counts = new Set<number>();
    let asymmetric = 0;
    for (let seed = 0; seed < 40; seed++) {
      const s = createFight(seed);
      const map = mapOf(s);
      expect(map.tiles).toBe(s.tiles);
      expect(JSON.stringify(createFight(seed).tiles)).toBe(JSON.stringify(s.tiles));
      // Yurts and mountains (tested above), nothing else.
      expect(Object.values(map.tiles).every((t) => t === 'obstacle' || t === 'mountain')).toBe(
        true
      );
      const yurts = Object.keys(map.tiles)
        .filter((k) => map.tiles[k] === 'obstacle')
        .map(hexFromKey);
      expect(yurts.length).toBeGreaterThanOrEqual(2);
      expect(yurts.length).toBeLessThanOrEqual(3);
      counts.add(yurts.length);
      // Near the middle, no two side by side.
      for (const y of yurts) expect(hexDistance(y, {q: 0, r: 0})).toBeLessThanOrEqual(2);
      for (const a of yurts)
        for (const b of yurts) if (a !== b) expect(hexDistance(a, b)).toBeGreaterThan(1);
      if (!yurts.every((y) => map.tiles[hexKey({q: -y.q, r: y.r + y.q})] === 'obstacle'))
        asymmetric++;
      for (const key of Object.keys(map.tiles)) {
        // Off the outermost columns, the camel's start and the exit.
        expect(Math.abs(hexFromKey(key).q)).toBeLessThan(4);
        expect([map.camelStart, ...map.exits].map(hexKey)).not.toContain(key);
      }
      // Every open hex can be walked to from every other.
      const open = map.hexes.filter((h) => !blocks(tileAt(map, h)));
      const seen = new Set([hexKey(open[0]!)]);
      const queue = [open[0]!];
      for (let h; (h = queue.shift()); )
        for (const n of hexNeighbors(h))
          if (onMap(map, n) && !blocks(tileAt(map, n)) && !seen.has(hexKey(n))) {
            seen.add(hexKey(n));
            queue.push(n);
          }
      expect(seen.size).toBe(open.length);
      layouts.add(JSON.stringify(s.tiles));
    }
    expect(layouts.size).toBeGreaterThan(20);
    expect(counts).toEqual(new Set([2, 3]));
    expect(asymmetric).toBeGreaterThan(30);
  });

  it('blocks allies, enemies and obstacles, routing around units', () => {
    const s = setup({'p-bokh': at(0, 3), 'p-storm': at(1, 3), 'e-bokh': at(1, 2)});
    const reach = reachableHexes(s, mapOf(s), unit(s, 'p-bokh'));
    const keys = reach.map((r) => `${r.hex.q},${r.hex.r}`);
    const key = (h: Hex) => `${h.q},${h.r}`;
    expect(keys).not.toContain(key(at(1, 3))); // ally's hex
    expect(keys).not.toContain(key(at(1, 2))); // enemy
    expect(keys).not.toContain(key(at(2, 2))); // a yurt
    for (const r of reach) expect(r.path.map(key)).not.toContain(key(at(1, 3)));
    expect(
      simulate(s, 'p-bokh', {move: [at(1, 3), at(2, 3)], action: {ability: 'hold'}})
    ).toBeNull();
    expect(reach.every((r) => r.path.length <= RULES.movementCap)).toBe(true);
  });

  it('ends a move where it enters hail, which Immobilizes', () => {
    const s = setup({'p-bokh': at(3, 3), 'e-storm': at(6, 6)});
    const b = unit(s, 'p-bokh');
    const dest = at(3, 5); // via (3, 4) or (4, 4)
    const before = reachableHexes(s, mapOf(s), b).find((r) => hexKey(r.hex) === hexKey(dest))!;
    expect(before.path).toHaveLength(2);
    // Hail on both ways there: it can be reached, but not passed.
    for (const h of [at(3, 4), at(4, 4)])
      s.effects.push({kind: 'hail', hex: h, source: 'e-storm', turns: 1});
    const reach = reachableHexes(s, mapOf(s), b);
    expect(reach.some((r) => hexKey(r.hex) === hexKey(dest))).toBe(false);
    expect(reach.some((r) => hexKey(r.hex) === hexKey(at(3, 4)))).toBe(true);
    expect(simulate(s, 'p-bokh', {move: [at(3, 4), dest], action: {ability: 'hold'}})).toBeNull();
    s.awaiting = b.id;
    applyTurn(s, b, {move: [at(3, 4)], action: {ability: 'hold'}});
    expect(b.statuses).toEqual([{kind: 'immobilized', hail: 'e-storm', at: at(3, 4)}]);
    expect(movementCap(b)).toBe(0);
    // Entering it hits too (owner, 2026-10-26).
    expect(b.hp).toBe(b.maxHp - unit(s, 'e-storm').power);
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

  it('blocks line of fire on a unit or a yurt, and along a border if either hex is taken (6.7, rule 29)', () => {
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
    applyTurn(s, m, {action: {ability: 'longshot', target: {hex: at(4, 3)}}});
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp - m.power);
    expect(m.power).toBe(2);
  });

  it('hail hits for the Storm Caller’s power', () => {
    const s = setup({'p-storm': at(1, 3), 'e-bokh': at(3, 3), 'e-mangudai': at(7, 6)});
    const storm = unit(s, 'p-storm');
    s.awaiting = storm.id;
    applyTurn(s, storm, {action: {ability: 'hail', target: {hex: at(3, 3)}}});
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp - 1);
    expect(storm.power).toBe(1);
  });

  it('Empower adds to a hit until the end of the unit’s next turn, then ends', () => {
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(4, 3), 'e-mangudai': at(7, 6)});
    s.units.forEach((u) => (u.controller = 'human'));
    const m = unit(s, 'p-mangudai');
    const ctx: Ctx = {state: s, map: mapOf(s), slot: 0};
    empower(ctx, m, 1);
    m.slot = 1;
    expect(advanceToDecision(s)!.id).toBe('p-mangudai');
    applyTurn(s, m, {action: {ability: 'longshot', target: {hex: at(4, 3)}}});
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp - 3);
    expect(m.empower).toBeUndefined();
  });

  it('Empower given on the unit’s own turn lasts through its next one', () => {
    const s = setup({'p-storm': at(1, 3), 'e-bokh': at(3, 3), 'e-mangudai': at(7, 6)});
    s.units.forEach((u) => (u.controller = 'human'));
    const storm = unit(s, 'p-storm');
    storm.slot = 1;
    expect(advanceToDecision(s)!.id).toBe('p-storm');
    empower({state: s, map: mapOf(s), slot: s.currentSlot}, storm, 1);
    applyTurn(s, storm, {action: {ability: 'hold'}});
    expect(storm.empower).toBe(1);
    storm.slot = s.currentSlot + 1;
    expect(advanceToDecision(s)!.id).toBe('p-storm');
    applyTurn(s, storm, {action: {ability: 'hail', target: {hex: at(3, 3)}}});
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp - 2);
    expect(storm.empower).toBeUndefined();
  });

  it('a Champion’s Empower adds to its squeeze when the rule says so, as it does in play', () => {
    const squeezed = (empoweredSqueeze: boolean) => {
      const grapple = ABILITY.grapple as {empoweredSqueeze: boolean};
      const saved = grapple.empoweredSqueeze;
      grapple.empoweredSqueeze = empoweredSqueeze;
      try {
        const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1), 'e-mangudai': at(8, 6)});
        s.units.forEach((u) => (u.controller = 'human'));
        const b = unit(s, 'p-bokh');
        const target = unit(s, 'e-storm');
        applyTurn(s, b, {action: {ability: 'grapple', target: {hex: target.hex!}}});
        empower({state: s, map: mapOf(s), slot: s.currentSlot}, b, 1);
        const hp = target.hp;
        b.slot = 1;
        advanceToDecision(s);
        return hp - target.hp;
      } finally {
        grapple.empoweredSqueeze = saved;
      }
    };
    expect(squeezed(false)).toBe(1);
    expect(squeezed(true)).toBe(2);
    // On in play (owner, 2026-10-23).
    expect(ABILITY.grapple.empoweredSqueeze).toBe(true);
  });

  it('Sunlight Empowers a unit within 3 that hits, itself included, not Temee or one already Empowered', () => {
    upgrade('storm');
    const s = setup({
      'p-storm': at(1, 3),
      'p-mangudai': at(2, 3),
      'p-bokh': at(6, 3),
      'p-camel': at(1, 2),
      'e-bokh': at(3, 3),
      'e-mangudai': at(7, 6),
    });
    const storm = unit(s, 'p-storm');
    const targets = () =>
      ABILITIES.sunlight
        .targets(s, mapOf(s), storm, storm.hex!)
        .map((t) => hexKey(t.hex!))
        .sort();
    expect(targets()).toEqual([at(1, 3), at(2, 3), at(3, 3)].map(hexKey).sort());
    // The player is offered its own side only.
    expect(
      offeredTargets(s, mapOf(s), storm, ABILITIES.sunlight)
        .map((t) => hexKey(t.hex!))
        .sort()
    ).toEqual([at(1, 3), at(2, 3)].map(hexKey).sort());
    s.awaiting = storm.id;
    applyTurn(s, storm, {action: {ability: 'sunlight', target: {hex: at(2, 3)}}});
    expect(unit(s, 'p-mangudai').empower).toBe(ABILITY.sunlight.empower);
    expect(ABILITY.sunlight.empower).toBe(2);
    expect(targets()).toEqual([at(1, 3), at(3, 3)].map(hexKey).sort());
  });

  it('Sunlight melts hail on its space, freeing whoever it held; hail alone is a target', () => {
    upgrade('storm');
    const s = setup({
      'p-storm': at(1, 3),
      'p-mangudai': at(2, 3),
      'e-storm': at(5, 3),
      'e-mangudai': at(7, 6),
    });
    const storm = unit(s, 'p-storm');
    const m = unit(s, 'p-mangudai');
    s.effects = [
      {kind: 'hail', hex: at(2, 3), source: 'e-storm', turns: 1},
      {kind: 'hail', hex: at(1, 4), source: 'p-other', turns: 1},
    ];
    m.statuses = [{kind: 'immobilized', hail: 'e-storm'}];
    expect(
      ABILITIES.sunlight
        .targets(s, mapOf(s), storm, storm.hex!)
        .some((t) => hexEquals(t.hex!, at(1, 4)))
    ).toBe(true);
    s.awaiting = storm.id;
    applyTurn(s, storm, {action: {ability: 'sunlight', target: {hex: at(2, 3)}}});
    expect(s.effects.map((e) => hexKey(e.hex))).toEqual([hexKey(at(1, 4))]);
    expect(m.statuses).toEqual([]);
    expect(m.empower).toBe(2);
  });

  it('power 0 deals no damage, and says nothing of it', () => {
    const s = setup({'p-storm': at(1, 3), 'e-bokh': at(3, 3), 'e-mangudai': at(7, 6)});
    const storm = unit(s, 'p-storm');
    storm.power = 0;
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
  it('shows every Longshot lane to the map’s edge, stopping at the first unit or an obstacle', () => {
    const s = setup({'p-mangudai': at(-1, 3), 'e-bokh': at(3, 6)});
    const from = at(-1, 3);
    const east = (l: ReturnType<typeof arrowLanes>) => l[0]!;
    // Nothing in the way: Longshot has no range limit, so the lane runs to the edge.
    let lanes = arrowLanes(s, mapOf(s), from);
    expect(lanes).toHaveLength(6);
    expect(east(lanes)).toEqual({hexes: [0, 1, 2, 3, 4, 5, 6, 7].map((c) => at(c, 3))});
    expect(ABILITIES.longshot.targets(s, mapOf(s), unit(s, 'p-mangudai'), from)).toEqual([]);
    // A unit in it: the lane ends there, and that unit is Longshot's target.
    unit(s, 'e-bokh').hex = at(2, 3);
    lanes = arrowLanes(s, mapOf(s), from);
    expect(east(lanes).hexes).toEqual([at(0, 3), at(1, 3), at(2, 3)]);
    expect(east(lanes).hit!.id).toBe('e-bokh');
    expect(ABILITIES.longshot.targets(s, mapOf(s), unit(s, 'p-mangudai'), from)).toEqual([
      {hex: at(2, 3)},
    ]);
  });

  it('Longshot hits the first unit on its line, an ally included, never past it', () => {
    const s = setup({
      'p-mangudai': at(0, 0),
      'p-bokh': at(1, 0),
      'e-bokh': at(3, 0),
      'e-storm': at(0, 6),
    });
    const m = unit(s, 'p-mangudai');
    const targets = ABILITIES.longshot.targets(s, mapOf(s), m, m.hex!);
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
    applyTurn(s, m, {action: {ability: 'longshot', target: {hex: at(1, 0)}}});
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

  it('Grapple isn’t offered on the unit the Champion already grapples', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1), 'e-bokh': at(8, 6)});
    const b = unit(s, 'p-bokh');
    expect(ABILITIES.grapple.targets(s, STEPPE, b, b.hex!)).toEqual([{hex: at(2, 1)}]);
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: at(2, 1)}}});
    // Only throws are left: free spaces and its own, never the held unit's.
    const after = ABILITIES.grapple.targets(s, STEPPE, b, b.hex!);
    expect(after.length).toBeGreaterThan(0);
    expect(after.some((t) => hexEquals(t.hex!, at(2, 1)))).toBe(false);
    expect(tryTurn(s, 'p-bokh', {action: {ability: 'grapple', target: {hex: at(2, 1)}}})).toThrow(
      RuleError
    );
  });

  it('Grapple holds while the Champion walks, if the walk ends next to its target', () => {
    const s = setup({'p-bokh': at(3, 3), 'e-storm': at(4, 3), 'e-mangudai': at(8, 6)});
    const b = unit(s, 'p-bokh');
    const target = unit(s, 'e-storm');
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: target.hex!}}});
    // A step out of reach and back in, to another space beside the target.
    const start = b.hex!;
    const path = hexNeighbors(start)
      .filter((out) => hexDistance(out, target.hex!) === 2)
      .flatMap((out) =>
        hexNeighbors(out)
          .filter((h) => hexDistance(h, target.hex!) === 1 && hexDistance(h, start) === 1)
          .map((back) => [out, back])
      )
      .find((p) => invalidPath(s, mapOf(s), b, p) === null)!;
    expect(path).toBeDefined();
    const back = path[1]!;
    applyTurn(s, b, {move: path, action: {ability: 'hold'}});
    expect(b.hex).toEqual(back);
    expect(target.statuses.map((x) => x.kind)).toEqual(['stunned']);
  });

  it('Grapple: each of the Champion’s turns while it lasts, its target takes 1', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-storm': at(2, 1), 'e-mangudai': at(8, 6)});
    s.units.forEach((u) => (u.controller = 'human'));
    const b = unit(s, 'p-bokh');
    const target = unit(s, 'e-storm');
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: target.hex!}}});
    const hp = target.hp;
    b.slot = 1;
    s.events = [];
    expect(advanceToDecision(s)!.id).toBe('p-bokh');
    expect(target.hp).toBe(hp - 1);
    expect(s.events.some((e) => e.kind === 'damage' && e.unitId === 'e-storm')).toBe(true);
    expect(target.statuses.map((x) => x.kind)).toEqual(['stunned']);
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

  it('Grapple is melee: only a unit next to the Champion, with no step in', () => {
    const s = setup({'p-bokh': at(1, 1), 'e-storm': at(3, 1), 'e-bokh': at(8, 6)});
    const b = unit(s, 'p-bokh');
    const target = unit(s, 'e-storm');
    // Two spaces away is out of reach.
    expect(ABILITIES.grapple.targets(s, STEPPE, b, b.hex!)).toEqual([]);
    target.hex = at(2, 1);
    expect(ABILITIES.grapple.targets(s, STEPPE, b, b.hex!)).toEqual([{hex: at(2, 1)}]);
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: at(2, 1)}}});
    expect(b.hex).toEqual(at(1, 1));
    expect(target.statuses.map((x) => x.kind)).toEqual(['stunned']);
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

  it('Grapple throws the held unit: Moved to the free space picked next to the Champion, then struck; the grapple holds', () => {
    const s = setup({
      'p-bokh': at(3, 4),
      'e-storm': hexNeighbors(at(3, 4))[0]!,
      'e-mangudai': at(8, 6),
    });
    const b = unit(s, 'p-bokh');
    const target = unit(s, 'e-storm');
    // No one held: only the unit next to it, to grapple.
    expect(ABILITIES.grapple.targets(s, STEPPE, b, b.hex!)).toEqual([{hex: target.hex!}]);
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: target.hex!}}});
    const throws = ABILITIES.grapple.targets(s, STEPPE, b, b.hex!);
    // Every free space around the Champion, not around the target, and the
    // Champion's own (a swap): one tap, the held unit implied.
    expect(throws.length).toBe(6);
    for (const t of throws) {
      expect(t.to).toBeUndefined();
      if (hexDistance(t.hex!, b.hex!) === 0) continue;
      expect(hexDistance(t.hex!, b.hex!)).toBe(1);
      expect(unitAt(s, t.hex!)).toBeUndefined();
    }
    // Offered, as aimed at the held enemy.
    expect(offeredTargets(s, STEPPE, b, ABILITIES.grapple)).toEqual(throws);
    const far = throws.find((t) => hexDistance(t.hex!, target.hex!) === 2)!;
    applyTurn(s, b, {action: {ability: 'grapple', target: far}});
    expect(target.hex).toEqual(far.hex);
    expect(target.hp).toBe(target.maxHp - 2 * b.power);
    expect(target.statuses.map((x) => x.kind)).toEqual(['stunned']);
  });

  it('Grapple on the Champion’s own space swaps: the two trade spaces, it is struck, and the grapple holds, Immobilized or not', () => {
    const s = setup({
      'p-bokh': at(3, 4),
      'e-storm': hexNeighbors(at(3, 4))[0]!,
      'e-mangudai': at(8, 6),
    });
    const b = unit(s, 'p-bokh');
    const target = unit(s, 'e-storm');
    const [bAt, tAt] = [b.hex!, target.hex!];
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: tAt}}});
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: bAt}}});
    expect(b.hex).toEqual(tAt);
    expect(target.hex).toEqual(bAt);
    expect(target.hp).toBe(target.maxHp - 2 * b.power);
    expect(target.statuses.map((x) => x.kind)).toEqual(['stunned']);
    // An Immobilized Champion (in hail, say) still swaps back.
    b.statuses.push({kind: 'immobilized'});
    const landings = ABILITIES.grapple.targets(s, STEPPE, b, b.hex!).map((t) => t.hex!);
    expect(landings.some((h) => hexDistance(h, b.hex!) === 0)).toBe(true);
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: tAt}}});
    expect(b.hex).toEqual(bAt);
    expect(target.hex).toEqual(tAt);
  });

  it('hail covers one space exactly two away: a unit there is Immobilized until the caster’s turn after next', () => {
    const s = setup({'p-storm': at(2, 3), 'e-mangudai': at(4, 3), 'e-bokh': at(8, 6)});
    const storm = unit(s, 'p-storm');
    const targets = ABILITIES.hail.targets(s, STEPPE, storm, storm.hex!);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((t) => hexDistance(t.hex!, storm.hex!) === 2)).toBe(true);
    s.awaiting = storm.id;
    applyTurn(s, storm, {action: {ability: 'hail', target: {hex: at(4, 3)}}});
    expect(s.effects).toEqual([{kind: 'hail', hex: at(4, 3), source: 'p-storm', turns: 2}]);
    const m = unit(s, 'e-mangudai');
    expect(m.statuses).toEqual([{kind: 'immobilized', hail: 'p-storm', at: at(4, 3)}]);
    // Moved out of it, it stays Immobilized until the hail is gone.
    enterHex({state: s, map: mapOf(s), slot: s.currentSlot}, m, at(5, 3), 'throw');
    expect(m.statuses.map((x) => x.kind)).toEqual(['immobilized']);
    // The caster's next turn: the hail stays, and its hold with it.
    s.units.forEach((u) => (u.controller = 'human'));
    for (const u of s.units) if (u !== storm && u.alive) u.slot = storm.slot! + 10;
    expect(advanceToDecision(s)!.id).toBe('p-storm');
    expect(s.effects).toEqual([{kind: 'hail', hex: at(4, 3), source: 'p-storm', turns: 1}]);
    expect(m.statuses.map((x) => x.kind)).toEqual(['immobilized']);
    // The turn after: it lifts.
    applyTurn(s, storm, {action: {ability: 'hold'}});
    for (const u of s.units) if (u !== storm && u.alive) u.slot = storm.slot! + 10;
    expect(advanceToDecision(s)!.id).toBe('p-storm');
    expect(s.effects).toEqual([]);
    expect(m.statuses).toEqual([]);
  });

  it('with `ABILITY.hail.max` 1, hailing again replaces the caster’s last hail, and frees whoever it held', () => {
    const s = setup({'p-storm': at(2, 3), 'e-mangudai': at(4, 3), 'e-bokh': at(8, 6)});
    const storm = unit(s, 'p-storm');
    const hail = ABILITY.hail as {max: number};
    const saved = {...ABILITY.hail};
    try {
      hail.max = 1;
      applyTurn(s, storm, {action: {ability: 'hail', target: {hex: at(4, 3)}}});
      const m = unit(s, 'e-mangudai');
      expect(m.statuses.map((x) => x.kind)).toEqual(['immobilized']);
      s.units.forEach((u) => (u.controller = 'human'));
      for (const u of s.units) if (u !== storm && u.alive) u.slot = storm.slot! + 10;
      expect(advanceToDecision(s)!.id).toBe('p-storm');
      const other = ABILITIES.hail
        .targets(s, STEPPE, storm, storm.hex!)
        .find((t) => !unitAt(s, t.hex!))!.hex!;
      applyTurn(s, storm, {action: {ability: 'hail', target: {hex: other}}});
      expect(s.effects).toEqual([{kind: 'hail', hex: other, source: 'p-storm', turns: 2}]);
      expect(m.statuses).toEqual([]);
    } finally {
      Object.assign(hail, saved);
    }
  });

  it('two hails stand at once, each lifting on its own, and entering one hurts', () => {
    const s = setup({'p-storm': at(2, 3), 'e-mangudai': at(4, 3), 'e-bokh': at(8, 6)});
    const storm = unit(s, 'p-storm');
    applyTurn(s, storm, {action: {ability: 'hail', target: {hex: at(4, 3)}}});
    const m = unit(s, 'e-mangudai');
    s.units.forEach((u) => (u.controller = 'human'));
    for (const u of s.units) if (u !== storm && u.alive) u.slot = storm.slot! + 10;
    expect(advanceToDecision(s)!.id).toBe('p-storm');
    const other = ABILITIES.hail
      .targets(s, STEPPE, storm, storm.hex!)
      .find((t) => !unitAt(s, t.hex!))!.hex!;
    applyTurn(s, storm, {action: {ability: 'hail', target: {hex: other}}});
    expect(s.effects.map((e) => e.turns)).toEqual([1, 2]);
    expect(m.statuses.map((x) => x.kind)).toEqual(['immobilized']);
    // A unit walking into the second takes the caster's power and is held.
    const b = unit(s, 'e-bokh');
    enterHex({state: s, map: mapOf(s), slot: s.currentSlot}, b, other);
    expect(b.hp).toBe(b.maxHp - storm.power);
    expect(b.statuses.map((x) => x.kind)).toEqual(['immobilized']);
    // The caster's next turn: the first lifts, freeing only whoever it held.
    for (const u of s.units) if (u !== storm && u.alive) u.slot = storm.slot! + 10;
    expect(advanceToDecision(s)!.id).toBe('p-storm');
    expect(s.effects).toEqual([{kind: 'hail', hex: other, source: 'p-storm', turns: 1}]);
    expect(m.statuses).toEqual([]);
    expect(b.statuses.map((x) => x.kind)).toEqual(['immobilized']);
  });

  it('a Champion in hail grapples its caster: the hail hit came first, so the grapple holds and the caster’s turn is skipped', () => {
    const s = setup({'e-storm': at(2, 1), 'p-bokh': at(0, 1), 'e-mangudai': at(8, 6)});
    s.units.forEach((u) => (u.controller = 'human'));
    const storm = unit(s, 'e-storm');
    const b = unit(s, 'p-bokh');
    // The Storm Caller hails the Champion's space, two away.
    s.awaiting = storm.id;
    applyTurn(s, storm, {action: {ability: 'hail', target: {hex: b.hex!}}});
    expect(b.hp).toBe(b.maxHp - storm.power);
    expect(b.statuses).toEqual([{kind: 'immobilized', hail: 'e-storm', at: at(0, 1)}]);
    // Moved next to it (by a Haul, say), it stays Immobilized.
    b.hex = at(1, 1);
    // The Champion's turn, with the Storm Caller's next.
    b.slot = 1;
    storm.slot = 2;
    unit(s, 'e-mangudai').slot = 500;
    expect(advanceToDecision(s)!.id).toBe('p-bokh');
    // Immobilized doesn't stop a melee Grapple: the Champion doesn't move.
    applyTurn(s, b, {action: {ability: 'grapple', target: {hex: storm.hex!}}});
    expect(storm.statuses).toEqual([
      {kind: 'stunned', grapple: {champion: 'p-bokh', target: 'e-storm'}},
    ]);
    // The Storm Caller's turn: Stunned, it skips the turn; its hail, cast
    // last turn, stays until the turn after.
    const hp = b.hp;
    storm.slot = 2;
    b.slot = 400;
    s.events = [];
    expect(advanceToDecision(s)!.id).not.toBe('e-storm');
    const skips = s.events.filter((e) => e.kind === 'skip' && e.unitId === 'e-storm');
    expect(skips[0]!.after.effects.map((e) => e.turns)).toEqual([1]);
    // Its next turn, Stunned still, skipped too: the hail lifts.
    expect(skips[1]!.after.effects).toEqual([]);
    expect(b.statuses).toEqual([]);
    expect(b.hp).toBe(hp);
    expect(storm.statuses.map((x) => x.kind)).toEqual(['stunned']);
  });

  it('hail lifts when its caster falls', () => {
    const s = setup({'p-storm': at(2, 3), 'e-mangudai': at(4, 3), 'e-bokh': at(8, 6)});
    const storm = unit(s, 'p-storm');
    applyTurn(s, storm, {action: {ability: 'hail', target: {hex: at(4, 3)}}});
    kill({state: s, map: mapOf(s), slot: 0}, storm);
    expect(s.effects).toEqual([]);
    expect(unit(s, 'e-mangudai').statuses).toEqual([]);
  });
});

describe('the Youxia Swordsman', () => {
  const party: HeroId[] = ['youxia', 'modao', 'mangudai'];
  const c = at(4, 4);

  it('has speed 3, power 2, defence 1 and walks up to 3', () => {
    const s = setup({'p-youxia': c}, party);
    const y = unit(s, 'p-youxia');
    expect([y.speed, y.power, y.defence, y.maxHp]).toEqual([3, 2, 1, healthOf(1)]);
    expect(Math.max(...reachableHexes(s, mapOf(s), y).map((r) => r.path.length))).toBe(3);
  });

  it('Swift Strike hits an enemy next to it, and Hastens its own card', () => {
    const s = setup({'p-youxia': c, 'e-modao': hexNeighbor(c, 0), 'e-mangudai': at(4, 7)}, party);
    const y = unit(s, 'p-youxia');
    const targets = ABILITIES.swiftStrike.targets(s, mapOf(s), y, y.hex!);
    expect(targets).toEqual([{hex: hexNeighbor(c, 0)}]);
    y.slot = s.currentSlot;
    applyTurn(s, y, {action: {ability: 'swiftStrike', target: {hex: hexNeighbor(c, 0)}}});
    expect(unit(s, 'e-modao').hp).toBe(unit(s, 'e-modao').maxHp - y.power);
    expect(y.slot).toBe(actionCost(y) - ABILITY.swiftStrike.haste);
  });

  it('a walk and Hold leave its card where it was due', () => {
    const s = setup({'p-youxia': c, 'e-modao': at(4, 7)}, party);
    const y = unit(s, 'p-youxia');
    y.slot = s.currentSlot;
    applyTurn(s, y, {action: {ability: 'hold', target: {}}});
    expect(y.slot).toBe(actionCost(y));
  });
});

describe('the Modao Vanguard and the Waidan Alchemist', () => {
  const party: HeroId[] = ['modao', 'alchemist', 'mangudai'];

  /** Runs `test` with the Elixir set by `settings` and the Alchemist's `power`, then restores them. */
  function withElixir(settings: Partial<typeof ABILITY.elixir>, power: number, test: () => void) {
    const elixir = ABILITY.elixir as Record<string, unknown>;
    const saved = {...ABILITY.elixir};
    const savedPower = HEROES.alchemist.power;
    Object.assign(elixir, settings);
    (HEROES.alchemist as {power: number}).power = power;
    try {
      test();
    } finally {
      Object.assign(elixir, saved);
      (HEROES.alchemist as {power: number}).power = savedPower;
    }
  }
  /** The single-unit Elixir before the burst (2026-10-26). */
  const single = {range: 2, shape: 'unit', fixed: 1, heal: 'all', empower: 0, weaken: 0} as const;

  // Cleave's shape from `c`: hex directions 2 and 5 run straight up and down the
  // (flat-topped) board; 0 and 1 are the right-hand diagonals, `across` the space
  // straight right beyond them.
  const c = at(4, 4);
  const up = (n: number) => ({q: c.q, r: c.r - n});
  const across = hexNeighbor(hexNeighbor(c, 0), 1);

  it('Cleave hits every unit in a line of 2 straight up, allies included, and nothing past it', () => {
    const s = setup(
      {'p-modao': c, 'e-mangudai': up(1), 'p-alchemist': up(2), 'e-modao': up(3)},
      party
    );
    const modao = unit(s, 'p-modao');
    applyTurn(s, modao, {action: {ability: 'cleave', target: {hex: up(1)}}});
    expect(unit(s, 'e-mangudai').hp).toBe(unit(s, 'e-mangudai').maxHp - modao.power);
    expect(unit(s, 'p-alchemist').hp).toBe(unit(s, 'p-alchemist').maxHp - modao.power);
    expect(unit(s, 'e-modao').hp).toBe(unit(s, 'e-modao').maxHp);
  });

  it('Cleave to the side hits a cone: both diagonals and the space straight across', () => {
    const s = setup(
      {
        'p-modao': c,
        'e-mangudai': hexNeighbor(c, 0),
        'p-alchemist': hexNeighbor(c, 1),
        'e-modao': across,
        'p-mangudai': hexNeighbor(hexNeighbor(c, 0), 0),
      },
      party
    );
    const modao = unit(s, 'p-modao');
    applyTurn(s, modao, {action: {ability: 'cleave', target: {hex: hexNeighbor(c, 0)}}});
    for (const id of ['e-mangudai', 'p-alchemist', 'e-modao'])
      expect(unit(s, id).hp).toBe(unit(s, id).maxHp - modao.power);
    // Two out along a diagonal is outside the cone.
    expect(unit(s, 'p-mangudai').hp).toBe(unit(s, 'p-mangudai').maxHp);
  });

  it('Cleave is aimed at its area’s first space, even when only another holds a unit', () => {
    const s = setup({'p-modao': c, 'e-mangudai': across}, party);
    const modao = unit(s, 'p-modao');
    const targets = ABILITIES.cleave.targets(s, mapOf(s), modao, modao.hex!);
    expect(targets).toEqual([{hex: hexNeighbor(c, 0)}]);
    applyTurn(s, modao, {action: {ability: 'cleave', target: {hex: hexNeighbor(c, 0)}}});
    expect(unit(s, 'e-mangudai').hp).toBe(unit(s, 'e-mangudai').maxHp - modao.power);
  });

  it('Cleave no longer reaches two out along a diagonal', () => {
    const s = setup({'p-modao': c, 'e-mangudai': hexNeighbor(hexNeighbor(c, 0), 0)}, party);
    const modao = unit(s, 'p-modao');
    expect(ABILITIES.cleave.targets(s, mapOf(s), modao, modao.hex!)).toEqual([]);
  });

  it('Cleave is picked by a tap on any space of its line or cone', () => {
    const s = setup({'p-modao': c, 'e-mangudai': up(2), 'e-modao': across}, party);
    const modao = unit(s, 'p-modao');
    const targets = offeredTargets(s, mapOf(s), modao, ABILITIES.cleave);
    const tap = (h: Hex) => targetAt(mapOf(s), modao.hex!, ABILITIES.cleave, targets, h);
    expect(tap(up(2))).toEqual({hex: up(1)});
    expect(tap(up(1))).toEqual({hex: up(1)});
    expect(tap(up(3))).toBeUndefined();
    for (const h of [hexNeighbor(c, 0), hexNeighbor(c, 1), across])
      expect(tap(h)).toEqual({hex: hexNeighbor(c, 0)});
  });

  it('Elixir as a burst: a space next to the Alchemist, every unit around it that hits, allies Empowered 2 and enemies Weakened 1', () => {
    const s = setup(
      {
        'p-alchemist': c,
        'p-mangudai': hexNeighbor(c, 0),
        // Two away, next to the space aimed at.
        'e-mangudai': hexNeighbor(hexNeighbor(c, 0), 0),
        'p-camel': hexNeighbor(c, 3),
        'e-modao': at(0, 0),
      },
      party
    );
    const alchemist = unit(s, 'p-alchemist');
    expect(alchemist.power).toBe(0);
    expect(ABILITIES.elixir.targetsUnit).toBe(false);
    expect(ABILITIES.elixir.radius).toBe(1);
    // Offered: the spaces within 1 whose burst catches a unit that hits.
    const offered = offeredTargets(s, mapOf(s), alchemist, ABILITIES.elixir).map((t) => t.hex!);
    expect(offered.every((h) => hexDistance(h, c) <= 1)).toBe(true);
    expect(offered.some((h) => hexEquals(h, hexNeighbor(c, 0)))).toBe(true);
    const camel = unit(s, 'p-camel');
    camel.hp -= 2;
    applyTurn(s, alchemist, {action: {ability: 'elixir', target: {hex: hexNeighbor(c, 0)}}});
    expect(unit(s, 'p-mangudai').empower).toBe(2);
    expect(unit(s, 'e-mangudai').weaken).toBe(1);
    // No hit, no heal, and not the Alchemist itself (it doesn't hit).
    expect(unit(s, 'e-mangudai').hp).toBe(unit(s, 'e-mangudai').maxHp);
    expect(alchemist.empower).toBeUndefined();
    expect(camel.hp).toBe(camel.maxHp - 2);
  });

  it('the single-unit Elixir (a switch) heals an ally its power and Empowers it 1, and hits an enemy for its power and Weakens it 1', () =>
    withElixir(single, 1, () => {
      const s = setup(
        {
          'p-alchemist': at(1, 3),
          'e-mangudai': at(2, 3),
          'p-mangudai': at(3, 3),
          'e-modao': at(8, 6),
        },
        party
      );
      const alchemist = unit(s, 'p-alchemist');
      expect(alchemist.power).toBe(1);
      // The player is offered both: an ally to heal and Empower, an enemy to
      // hit and Weaken, and the Alchemist itself.
      expect(
        offeredTargets(s, mapOf(s), alchemist, ABILITIES.elixir)
          .map((t) => hexKey(t.hex!))
          .sort()
      ).toEqual([at(1, 3), at(2, 3), at(3, 3)].map(hexKey).sort());
      // On itself: hurt, it heals its power and is Empowered 1, lasting through its next turn.
      const m = cloneFight(s);
      unit(m, 'p-alchemist').hp -= 2;
      applyTurn(m, unit(m, 'p-alchemist'), {action: {ability: 'elixir', target: {hex: at(1, 3)}}});
      expect(unit(m, 'p-alchemist').hp).toBe(unit(m, 'p-alchemist').maxHp - 1);
      expect(unit(m, 'p-alchemist').empower).toBe(1);
      // An ally down 2 heals 1 (the Alchemist's power) and is Empowered 1.
      const a = cloneFight(s);
      a.events = [];
      unit(a, 'p-mangudai').hp -= 2;
      applyTurn(a, unit(a, 'p-alchemist'), {action: {ability: 'elixir', target: {hex: at(3, 3)}}});
      expect(unit(a, 'p-mangudai').hp).toBe(unit(a, 'p-mangudai').maxHp - 1);
      expect(unit(a, 'p-mangudai').empower).toBe(1);
      expect(a.events!.some((e) => e.kind === 'heal' && e.amount === 1)).toBe(true);
      // A healthy ally isn't healed past its health.
      const f = cloneFight(s);
      applyTurn(f, unit(f, 'p-alchemist'), {action: {ability: 'elixir', target: {hex: at(3, 3)}}});
      expect(unit(f, 'p-mangudai').hp).toBe(unit(f, 'p-mangudai').maxHp);
      // An enemy takes the Alchemist's power and is Weakened 1.
      const e = cloneFight(s);
      applyTurn(e, unit(e, 'p-alchemist'), {action: {ability: 'elixir', target: {hex: at(2, 3)}}});
      expect(unit(e, 'e-mangudai').hp).toBe(unit(e, 'e-mangudai').maxHp - 1);
      expect(unit(e, 'e-mangudai').weaken).toBe(1);
    }));

  it('the single-unit Elixir heals the camel once it is hurt, and leaves it alone at full health', () =>
    withElixir(single, 1, () => {
      const s = setup({'p-alchemist': at(1, 3), 'p-camel': at(2, 3), 'e-modao': at(8, 6)}, party);
      const alchemist = unit(s, 'p-alchemist');
      const offered = () =>
        ABILITIES.elixir
          .targets(s, mapOf(s), alchemist, alchemist.hex!)
          .some((t) => hexEquals(t.hex!, at(2, 3)));
      expect(offered()).toBe(false);
      unit(s, 'p-camel').hp -= 3;
      expect(offered()).toBe(true);
      applyTurn(s, alchemist, {action: {ability: 'elixir', target: {hex: at(2, 3)}}});
      expect(unit(s, 'p-camel').hp).toBe(unit(s, 'p-camel').maxHp - 2);
    }));

  it('Cleave Delays every unit it leaves standing 8 slots, and not the ones it kills', () => {
    const s = setup({'p-modao': at(1, 3), 'e-mangudai': at(2, 3), 'e-modao': at(8, 6)}, party);
    expect(ABILITY.cleave.delay).toBe(8);
    const m = unit(s, 'e-mangudai');
    const before = m.slot!;
    applyTurn(s, unit(s, 'p-modao'), {action: {ability: 'cleave', target: {hex: at(2, 3)}}});
    expect(m.alive).toBe(true);
    expect(m.slot).toBeGreaterThanOrEqual(before + 8);
    expect(s.log.some((l) => l.text.endsWith('is Delayed 8.'))).toBe(true);
    const k = setup({'p-modao': at(1, 3), 'e-mangudai': at(2, 3), 'e-modao': at(8, 6)}, party);
    unit(k, 'e-mangudai').hp = 1;
    applyTurn(k, unit(k, 'p-modao'), {action: {ability: 'cleave', target: {hex: at(2, 3)}}});
    expect(unit(k, 'e-mangudai').alive).toBe(false);
    expect(k.log.some((l) => l.text.includes('Delayed'))).toBe(false);
  });

  it('Elixir as a burst or an aura reaches every unit around its centre', () =>
    withElixir({range: 2, fixed: 1, heal: 'all', empower: 0, weaken: 0}, 1, () => {
      const s = setup(
        {
          'p-alchemist': at(1, 3),
          'p-mangudai': at(2, 3),
          'e-mangudai': at(2, 2),
          'e-modao': at(8, 6),
        },
        party
      );
      const elixir = ABILITY.elixir as {shape: string};
      const saved = {...ABILITY.elixir};
      try {
        for (const shape of ['burst', 'aura'] as const) {
          elixir.shape = shape;
          const c = cloneFight(s);
          const hex = shape === 'aura' ? at(1, 3) : at(2, 3);
          applyTurn(c, unit(c, 'p-alchemist'), {action: {ability: 'elixir', target: {hex}}});
          expect(unit(c, 'p-mangudai').empower).toBe(unit(c, 'p-alchemist').power);
          expect(unit(c, 'e-mangudai').weaken).toBe(unit(c, 'p-alchemist').power);
          // The Alchemist is within the radius too, so it takes the elixir.
          expect(unit(c, 'p-alchemist').empower).toBe(unit(c, 'p-alchemist').power);
        }
      } finally {
        Object.assign(elixir, saved);
      }
    }));

  it('Elixir’s `empower` and `weaken` switches set each side’s amount apart', () => {
    const s = setup(
      {
        'p-alchemist': at(1, 3),
        'p-mangudai': at(2, 3),
        'e-mangudai': at(2, 2),
        'e-modao': at(8, 6),
      },
      party
    );
    const elixir = ABILITY.elixir as {
      shape: string;
      fixed: number;
      empower: number;
      weaken: number;
    };
    const saved = {...ABILITY.elixir};
    try {
      Object.assign(elixir, {shape: 'aura', fixed: 0, empower: 2, weaken: 1});
      applyTurn(s, unit(s, 'p-alchemist'), {action: {ability: 'elixir', target: {hex: at(1, 3)}}});
      expect(unit(s, 'p-mangudai').empower).toBe(2);
      expect(unit(s, 'e-mangudai').weaken).toBe(1);
      expect(unit(s, 'e-mangudai').hp).toBe(unit(s, 'e-mangudai').maxHp);
    } finally {
      Object.assign(elixir, saved);
    }
  });

  it('Weaken takes off a hit until the end of the unit’s next turn, then ends', () => {
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(4, 3), 'e-mangudai': at(7, 6)});
    s.units.forEach((u) => (u.controller = 'human'));
    const m = unit(s, 'p-mangudai');
    weaken({state: s, map: mapOf(s), slot: 0}, m, 1);
    m.slot = 1;
    expect(advanceToDecision(s)!.id).toBe('p-mangudai');
    applyTurn(s, m, {action: {ability: 'longshot', target: {hex: at(4, 3)}}});
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp - (m.power - 1));
    expect(m.weaken).toBeUndefined();
  });

  it('a Weaken as large as the hit takes it all, and Empower and Weaken net out', () => {
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(4, 3)});
    const m = unit(s, 'p-mangudai');
    const target = unit(s, 'e-bokh');
    const ctx: Ctx = {state: s, map: mapOf(s), slot: 0};
    weaken(ctx, m, m.power + 1);
    hit(ctx, m, target, 'The test');
    expect(target.hp).toBe(target.maxHp);
    empower(ctx, m, 2);
    weaken(ctx, m, 1);
    expect(damageOf(m)).toBe(m.power + 1);
  });

  it('plays whole fights with both to an end, AI against AI, using Cleave and Elixir', () => {
    const used = new Set<string>();
    // A seed's fight may end before one of them acts: a few seeds, until both have.
    for (let seed = 0; seed < 5 && !(used.has('cleave') && used.has('elixir')); seed++) {
      let run = createRun(seed, {party});
      for (let turns = 0; turns < 300 && run.fight.phase === 'fight'; turns++) {
        run = request(run);
        for (const e of run.fight.events ?? []) if (e.kind === 'action') used.add(e.ability);
      }
      expect(['won', 'lost']).toContain(run.fight.phase);
    }
    expect(used.has('cleave')).toBe(true);
    expect(used.has('elixir')).toBe(true);
  });
});

describe('the caravan’s camel', () => {
  it('acts last in the starting order, at slot 12, despite its speed', () => {
    for (let seed = 0; seed < 10; seed++) {
      const s = createFight(seed);
      const camel = unit(s, 'p-camel');
      expect(camel.slot).toBe(RULES.camelStartSlot);
      expect(s.units.every((u) => u === camel || u.slot! < camel.slot!)).toBe(true);
    }
  });

  it('joins the player’s side at the top point, with high defence and the health it gives', () => {
    for (const seed of [1, 2, 3]) {
      const s = createFight(seed);
      const camel = unit(s, 'p-camel');
      expect(camel.side).toBe('player');
      expect(camel.controller).toBe('ai');
      expect(camel.hex).toEqual(STEPPE.camelStart);
      expect(camel.hex).toEqual({q: 0, r: -4});
      expect(camel.defence).toBe(HEROES.camel.defence);
      expect(camel.hp).toBe((1 + camel.defence) * 2);
      expect(s.units.filter((u) => u.hex && hexKey(u.hex) === hexKey(camel.hex!))).toHaveLength(1);
      expect(s.units.filter((u) => u.side === 'enemy' && u.hero === 'camel')).toHaveLength(0);
    }
  });

  it('wins by reaching the one exit, at the bottom point', () => {
    expect(STEPPE.exits).toEqual([{q: 0, r: 4}]);
  });

  it('follows a fixed shortest road around the yurts to the exit', () => {
    for (let seed = 0; seed < 20; seed++) {
      const map = mapOf(createFight(seed));
      const road = roadToExit(map, STEPPE.camelStart);
      // Every step to a neighbour, never onto yurts, ending on the exit.
      let from = STEPPE.camelStart;
      for (const h of road) {
        expect(hexDistance(from, h)).toBe(1);
        expect(blocks(tileAt(map, h))).toBe(false);
        from = h;
      }
      expect(road[road.length - 1]).toEqual(STEPPE.exits[0]);
      // Shortest: no walk around the yurts is shorter.
      const dist = new Map([[hexKey(STEPPE.camelStart), 0]]);
      const queue = [STEPPE.camelStart];
      for (let h; (h = queue.shift()); )
        for (const n of hexNeighbors(h))
          if (onMap(map, n) && !blocks(tileAt(map, n)) && !dist.has(hexKey(n))) {
            dist.set(hexKey(n), dist.get(hexKey(h))! + 1);
            queue.push(n);
          }
      expect(road).toHaveLength(dist.get(hexKey(STEPPE.exits[0]!))!);
      // Fixed: the road from a hex on it is the rest of it.
      expect(roadToExit(map, road[2]!)).toEqual(road.slice(3));
    }
  });

  it('walks one space along its road a turn, its card going its action cost on, and can’t attack', () => {
    const s = setup({'p-camel': at(2, 4), 'p-bokh': at(0, 0), 'e-bokh': at(6, 0)});
    const camel = unit(s, 'p-camel');
    const road = roadToExit(mapOf(s), at(2, 4));
    camel.slot = 90;
    unit(s, 'p-bokh').slot = 95;
    expect(abilitiesOf(camel).map((d) => d.id)).toEqual(['hold']);
    // Bökh's card is at 95: the camel's turn comes first, with no decision.
    expect(advanceToDecision(s)!.id).toBe('p-bokh');
    expect(camel.hex).toEqual(road[0]);
    expect(camel.slot).toBe(90 + actionCost(camel));
    expect(actionCost(camel)).toBe(12);
    expect(s.phase).toBe('fight');
  });

  it('walks around a unit on its road, and waits only when Immobilized, Stunned or boxed in', () => {
    const s = setup({'p-camel': at(2, 4), 'p-bokh': at(0, 0), 'e-bokh': at(6, 0)});
    const camel = unit(s, 'p-camel');
    const road = roadToExit(mapOf(s), at(2, 4));
    unit(s, 'e-bokh').hex = road[0]!;
    camel.slot = 90;
    unit(s, 'p-bokh').slot = 95;
    advanceToDecision(s);
    expect(camel.hex).not.toEqual(at(2, 4));
    expect(camel.hex).not.toEqual(road[0]);
    expect(hexDistance(camel.hex!, at(2, 4))).toBe(1);
    expect(camel.skipped).toBeUndefined();
    expect(camel.slot).toBe(102);

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
    // Waiting, its card still goes its action cost on each turn: 102, 114,
    // … 510.
    expect(pinned.slot).toBe(510);

    // In the corner, its three neighbours taken: nowhere to go.
    const boxed = setup({
      'p-camel': at(0, -1),
      'p-bokh': at(1, -1),
      'p-mangudai': at(0, 0),
      'e-bokh': at(1, 0),
    });
    const cornered = unit(boxed, 'p-camel');
    expect(hexNeighbors(at(0, -1)).filter((h) => onMap(STEPPE, h) && !unitAt(boxed, h))).toEqual(
      []
    );
    cornered.slot = 90;
    advanceToDecision(boxed);
    expect(cornered.hex).toEqual(at(0, -1));
    expect(cornered.skipped).toBe(true);
  });

  it('wins the fight on reaching the exit, with enemies still standing', () => {
    const s = setup({'p-camel': at(4, 7), 'p-bokh': at(0, 0), 'e-bokh': at(6, 0)});
    unit(s, 'p-camel').slot = 50;
    expect(advanceToDecision(s)).toBeUndefined();
    expect(unit(s, 'p-camel').hex).toEqual(at(5, 7));
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
    expect(input.action.ability).toBe('longshot');
    expect(simulate(shot, archer.id, input)!.phase).toBe('lost');
  });
});

describe('previews, the AI and the run', () => {
  it('rejects walking plus an ability without mutating the fight', () => {
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(4, 3)});
    const shot = {ability: 'longshot' as const, target: {hex: at(4, 3)}};
    const before = JSON.stringify(s);
    const input: TurnInput = {action: shot, move: [at(0, 3)]};
    expect(previewTurn(s, 'p-mangudai', input)).toBeNull();
    expect(() => applyTurn(s, unit(s, 'p-mangudai'), input)).toThrow(/separate turns/);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('a move places the card as any turn does, with matching previews, taking a slower card’s slot', () => {
    expect(RULES.movementCap).toBe(2);
    for (const length of [1, 2]) {
      const s = setup({'p-mangudai': at(0, 0), 'e-bokh': at(7, 0)});
      const actor = unit(s, 'p-mangudai');
      const input: TurnInput = {
        move: Array.from({length}, (_, i) => at(i + 1, 0)),
        action: {ability: 'hold'},
      };
      const aim = s.currentSlot + actionCost(actor);
      unit(s, 'e-bokh').slot = aim;
      // The Outrider (3) is faster than Bökh (2): it takes the slot, and the preview says Bökh moves on.
      expect(previewTurn(s, actor.id, input)).toMatchObject({
        aimSlot: aim,
        slot: aim,
        bumped: {'e-bokh': aim + 1},
      });
      s.events = [];
      applyTurn(s, actor, input);
      expect(actor.slot).toBe(aim);
      expect(unit(s, 'e-bokh').slot).toBe(aim + 1);
      expect(s.events.some((e) => e.kind === 'action')).toBe(false);
      expect(s.events.filter((e) => e.kind === 'step')).toHaveLength(length);
    }
  });

  it('refuses a move longer than 2 spaces', () => {
    const s = setup({'p-storm': at(0, 0), 'e-bokh': at(7, 0)});
    expect(
      tryTurn(s, 'p-storm', {
        move: [1, 2, 3].map((c) => at(c, 0)),
        action: {ability: 'hold'},
      })
    ).toThrow(/longer than the unit can go/);
    expect(
      Math.max(...reachableHexes(s, mapOf(s), unit(s, 'p-storm')).map((r) => r.path.length))
    ).toBe(2);
  });

  it('moves the Outrider any number of spaces straight, up to the first unit', () => {
    const s = setup({'p-mangudai': at(0, 0), 'e-bokh': at(7, 0)});
    const outrider = unit(s, 'p-mangudai');
    const reaches = reachableHexes(s, mapOf(s), outrider);
    // Every reach keeps to one direction from its space.
    for (const {path} of reaches.filter((r) => r.path.length > 0)) {
      const dir = hexNeighbors(outrider.hex!).findIndex((n) => hexEquals(n, path[0]!));
      path.forEach((h, i) => expect(h).toEqual(hexNeighbor(i ? path[i - 1]! : outrider.hex!, dir)));
    }
    expect(reaches.some((r) => hexEquals(r.hex, at(6, 0)))).toBe(true);
    expect(reaches.some((r) => hexEquals(r.hex, at(7, 0)))).toBe(false);
    const bent = [at(1, 0), hexNeighbors(at(1, 0)).find((n) => hexDistance(n, at(0, 0)) === 1)!];
    expect(invalidPath(s, mapOf(s), outrider, bent)).not.toBeNull();
    applyTurn(s, outrider, {
      move: [1, 2, 3, 4, 5, 6].map((c) => at(c, 0)),
      action: {ability: 'hold'},
    });
    expect(outrider.hex).toEqual(at(6, 0));
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

  it('the stages: per region, its first enemy and two creatures, it, a random other and a creature, then three', () => {
    expect(STAGES).toEqual([
      {region: 'steppe', heroes: 1, creatures: 2, provision: true, passive: false, map: 'steppe'},
      {region: 'steppe', heroes: 2, creatures: 1, provision: true, passive: false, map: 'steppe'},
      {region: 'steppe', heroes: 3, creatures: 0, provision: false, passive: true, map: 'steppe'},
      {region: 'china', heroes: 1, creatures: 2, provision: true, passive: false, map: 'flaming'},
      {region: 'china', heroes: 2, creatures: 1, provision: true, passive: false, map: 'flaming'},
      {region: 'china', heroes: 3, creatures: 0, provision: false, passive: false, map: 'flaming'},
    ]);
    expect(FIRST_ENEMY).toBe('mangudai');
    expect(REGIONS.steppe).toMatchObject({creature: 'wolf', firstEnemy: 'mangudai'});
    expect(REGIONS.china).toMatchObject({creature: 'fox', firstEnemy: 'youxia'});
    const seconds = new Set<HeroId>();
    for (let seed = 0; seed < 30; seed++) {
      STAGES.forEach(({region, heroes, creatures}, stage) => {
        const {creature, firstEnemy} = REGIONS[region];
        const enemies = stageEnemies(seed, stage);
        const picked = enemies.filter((h) => h !== creature);
        expect(picked).toHaveLength(heroes);
        expect(new Set(picked).size).toBe(heroes);
        expect(picked.every((h) => ROSTER.includes(h))).toBe(true);
        expect(picked[0]).toBe(firstEnemy);
        expect(enemies.filter((h) => h === creature)).toHaveLength(creatures);
        // The same seed, the same enemy.
        expect(stageEnemies(seed, stage)).toEqual(enemies);
        // Each stage brings the last one's heroes in its region, and more.
        if (stage > 0 && STAGES[stage - 1]!.region === region) {
          const before = stageEnemies(seed, stage - 1).filter((h) => h !== creature);
          expect(picked.slice(0, before.length)).toEqual(before);
        }
      });
      // The first stage always brings the Outrider.
      expect(stageEnemies(seed, 0)[0]).toBe(FIRST_ENEMY);
      seconds.add(stageEnemies(seed, 1)[1]!);
    }
    // Random after that: every other hero of the roster is the second to come for some seed.
    expect(seconds.size).toBe(ROSTER.length - 1);
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
    const next = handleRunAction(won, {type: 'next', provision: {hero: 'bokh', stat: 'power'}});
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
    expect(() =>
      handleRunAction(last, {type: 'next', provision: {hero: 'bokh', stat: 'power'}})
    ).toThrow(RuleError);
    // A lost stage loses the run, whatever its number.
    expect(runStatus({...run, fight: {...run.fight, phase: 'lost'}})).toBe('lost');
  });

  it("the caravanserai after stages 1 and 2: a provision raises one survivor's stat for the rest of the run", () => {
    const win = (r: RunState): RunState => {
      const fight = cloneFight(r.fight);
      fight.phase = 'won';
      return {...r, fight};
    };
    const run = createRun(7);
    expect(runView(run).provision).toBe(true);
    const won = win(run);
    // A provision is owed: none, or a malformed one, is refused.
    for (const provision of [
      undefined,
      {hero: 'bokh'},
      {hero: 'bokh', stat: 'health'},
      {hero: 'wolf', stat: 'power'},
      {hero: 'camel', stat: 'speed'},
      'bokh',
    ])
      expect(() => handleRunAction(won, {type: 'next', provision})).toThrow(RuleError);
    // Only to a hero still standing.
    const fallen = win(run);
    const s = fallen.fight.units.find((u) => u.id === 'p-storm')!;
    s.alive = false;
    s.hex = null;
    expect(() =>
      handleRunAction(fallen, {type: 'next', provision: {hero: 'storm', stat: 'power'}})
    ).toThrow(RuleError);

    const second = handleRunAction(won, {type: 'next', provision: {hero: 'bokh', stat: 'defence'}});
    expect(second.provisions).toEqual([{hero: 'bokh', stat: 'defence'}]);
    const bokh = second.fight.units.find((u) => u.id === 'p-bokh')!;
    expect(bokh).toMatchObject({
      defence: HEROES.bokh.defence + 1,
      maxHp: healthOf(HEROES.bokh.defence + 1),
      provisions: {defence: 1},
    });
    // Never the enemy's copy of the hero, and the others untouched.
    for (const u of second.fight.units.filter((u) => u.id !== 'p-bokh')) {
      expect(u.provisions).toBeUndefined();
      expect(u.defence).toBe(HEROES[u.hero].defence);
    }
    // Kept when the stats are refreshed, and into the stage after, with the next one.
    expect(runView(second).fight.units.find((u) => u.id === 'p-bokh')!.defence).toBe(
      HEROES.bokh.defence + 1
    );
    expect(runView(second).provision).toBe(true);
    const third = handleRunAction(win(second), {
      type: 'next',
      provision: {hero: 'bokh', stat: 'speed'},
    });
    expect(third.fight.units.find((u) => u.id === 'p-bokh')).toMatchObject({
      speed: HEROES.bokh.speed + 1,
      defence: HEROES.bokh.defence + 1,
      provisions: {speed: 1, defence: 1},
    });
    // The third stage earns none (its reassignment and upgrade aren't built).
    expect(runView(third).provision).toBe(false);
    expect(runView(third).passives).toHaveLength(PASSIVE_OFFER);
    // No stat goes above RULES.statMax: not by a provision, nor at all.
    expect(RULES.statMax).toBe(10);
    const capped = win(run);
    Object.assign(capped.fight.units.find((u) => u.id === 'p-bokh')!, {
      power: RULES.statMax,
      provisions: {power: RULES.statMax},
    });
    expect(() =>
      handleRunAction(capped, {type: 'next', provision: {hero: 'bokh', stat: 'power'}})
    ).toThrow(RuleError);
    expect(
      handleRunAction(capped, {type: 'next', provision: {hero: 'bokh', stat: 'speed'}}).provisions
    ).toEqual([{hero: 'bokh', stat: 'speed'}]);
    const piled = {
      ...run,
      provisions: Array.from({length: 12}, () => ({hero: 'bokh' as const, stat: 'power' as const})),
    };
    const over = handleRunAction(win(piled), {
      type: 'next',
      provision: {hero: 'storm', stat: 'power'},
    });
    expect(over.fight.units.find((u) => u.id === 'p-bokh')!.power).toBe(RULES.statMax);
    // Every stat of every hero standing at the most: no provision to take.
    const full = win(run);
    for (const u of full.fight.units.filter((u) => u.side === 'player' && u.hero !== 'camel'))
      Object.assign(u, {
        speed: 10,
        defence: 10,
        power: 10,
        provisions: {speed: 10, defence: 10, power: 10},
      });
    expect(runView(full).provision).toBe(false);
    expect(handleRunAction(full, {type: 'next'}).stage).toBe(1);
    expect(() =>
      handleRunAction(full, {type: 'next', provision: {hero: 'bokh', stat: 'speed'}})
    ).toThrow(RuleError);
    // A test stage earns none either.
    expect(runView(createRun(7, {test: true})).provision).toBe(false);
  });

  it('the caravanserai between regions: three passives at random, one taken by a survivor for the rest of the run', () => {
    const win = (r: RunState): RunState => {
      const fight = cloneFight(r.fight);
      fight.phase = 'won';
      return {...r, fight};
    };
    const at = (r: RunState, stage: number): RunState => ({...r, stage});
    const run = createRun(11);
    expect(runView(run).passives).toEqual([]);
    // No passive on a stage that offers none.
    expect(() =>
      handleRunAction(win(run), {
        type: 'next',
        provision: {hero: 'bokh', stat: 'power'},
        passive: {hero: 'bokh', passive: 'rooted'},
      })
    ).toThrow(RuleError);

    const last = win(at(run, 2));
    const view = runView(last);
    expect(view.provision).toBe(false);
    const offer = view.passives;
    expect(offer).toHaveLength(PASSIVE_OFFER);
    expect(new Set(offer).size).toBe(PASSIVE_OFFER);
    expect(offer.every((id) => Object.hasOwn(PASSIVES, id))).toBe(true);
    // The same offer on a reload; another run's differs for some seed.
    expect(runView(last).passives).toEqual(offer);
    const offers = new Set<string>();
    for (let seed = 0; seed < 20; seed++)
      offers.add(runView(win(at(createRun(seed), 2))).passives.join());
    expect(offers.size).toBeGreaterThan(10);

    const [pick, other] = offer as [PassiveId, PassiveId];
    const notOffered = (Object.keys(PASSIVES) as PassiveId[]).find((id) => !offer.includes(id))!;
    // A passive is owed: none, a malformed one, one not offered, or for the camel, refused.
    for (const passive of [
      undefined,
      {hero: 'bokh'},
      {hero: 'bokh', passive: 'flying'},
      {hero: 'bokh', passive: notOffered},
      {hero: 'camel', passive: pick},
      {hero: 'wolf', passive: pick},
    ])
      expect(() => handleRunAction(last, {type: 'next', passive})).toThrow(RuleError);
    // Only to a hero still standing.
    const fallen = win(at(run, 2));
    Object.assign(fallen.fight.units.find((u) => u.id === 'p-storm')!, {alive: false, hex: null});
    expect(() =>
      handleRunAction(fallen, {type: 'next', passive: {hero: 'storm', passive: pick}})
    ).toThrow(RuleError);

    const china = handleRunAction(last, {type: 'next', passive: {hero: 'storm', passive: pick}});
    expect(china.stage).toBe(3);
    expect(china.passives).toEqual([{hero: 'storm', passive: pick}]);
    expect(china.fight.mapId).toBe('flaming');
    expect(china.fight.units.filter((u) => u.side === 'enemy').map((u) => u.hero)).toEqual([
      'youxia',
      'fox',
      'fox',
    ]);
    expect(runView(china)).toMatchObject({provision: true, passives: []});
    const storm = china.fight.units.find((u) => u.id === 'p-storm')!;
    expect(storm.passives).toEqual([pick]);
    // Never the enemy's copy, nor another hero.
    for (const u of china.fight.units.filter((u) => u.id !== 'p-storm'))
      expect(u.passives).toBeUndefined();
    // Carried into the stages after.
    const next = handleRunAction(win(china), {
      type: 'next',
      provision: {hero: 'bokh', stat: 'power'},
    });
    expect(next.fight.units.find((u) => u.id === 'p-storm')!.passives).toEqual([pick]);
    expect(next.passives).toEqual([{hero: 'storm', passive: pick}]);
    // A hero can't take one it already carries; another hero can.
    const again = win(at({...run, passives: [{hero: 'storm', passive: pick}]}, 2));
    again.fight.units.find((u) => u.id === 'p-storm')!.passives = [pick];
    expect(() =>
      handleRunAction(again, {type: 'next', passive: {hero: 'storm', passive: pick}})
    ).toThrow(RuleError);
    expect(
      handleRunAction(again, {type: 'next', passive: {hero: 'bokh', passive: other}}).passives
    ).toEqual([
      {hero: 'storm', passive: pick},
      {hero: 'bokh', passive: other},
    ]);
    // The run's last stage offers none, nor does a test stage.
    expect(runView(win(at(run, STAGES.length - 1))).passives).toEqual([]);
    expect(runView(win(createRun(7, {test: true}))).passives).toEqual([]);
  });

  it('a party must be one to three different heroes of the roster', () => {
    expect(ROSTER).toEqual([...PARTY, 'modao', 'alchemist', 'youxia']);
    expect(() => createRun(5, {party: ['modao', 'alchemist']})).not.toThrow();
    for (const party of [
      ['modao', 'alchemist', 'storm', 'bokh'],
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
    const aim = s.currentSlot + actionCost(bokh);
    expect(previewTurn(s, bokh.id, input)).toMatchObject({aimSlot: aim, slot: aim});
    // Cards in the aimed slot and the one after: the card yields past both.
    unit(s, 'e-bokh').slot = aim;
    unit(s, 'e-storm').slot = aim + 1;
    expect(previewTurn(s, bokh.id, input)).toMatchObject({aimSlot: aim, slot: aim + 2});
  });

  it('plays each AI turn in a request of its own, and only when it is due', () => {
    // An enemy Outrider, the fastest, acts before a party without one.
    const runs = Array.from({length: 30}, (_, seed) => createRun(seed, {party: ['storm']}));
    const run = runs.find((r) => runView(r).aiDue)!;
    expect(run).toBeDefined();
    const view = runView(run);
    // The page has no unit to control while the AI's turn is due.
    expect(view.fight.awaiting).toBeNull();
    expect(actingUnit(run.fight)!.controller).toBe('ai');
    const before = JSON.stringify(run);
    expect(() => handleRunAction(run, {type: 'turn', action: {ability: 'hold'}})).toThrow(
      'It is not your turn.'
    );
    expect(JSON.stringify(run)).toBe(before);
    // One `continue`, one AI turn: the events hold one turn's action.
    const ai = actingUnit(run.fight)!.id;
    const next = handleRunAction(run, {type: 'continue'});
    expect(next.version).toBe(run.version + 1);
    const acted = next.fight.events!.filter((e) => e.kind === 'action' || e.kind === 'step');
    expect(new Set(acted.map((e) => e.unitId))).toEqual(new Set([ai]));
    // On the player's turn there is no AI turn to ask for.
    let mine = next;
    while (runView(mine).aiDue) mine = handleRunAction(mine, {type: 'continue'});
    expect(runView(mine).fight.awaiting).toBe(actingUnit(mine.fight)!.id);
    expect(() => handleRunAction(mine, {type: 'continue'})).toThrow('No AI turn is due.');
  });

  it('given a clock, plays an AI turn searched as long as AI.browser.thinkMs allows', () => {
    const run = Array.from({length: 30}, (_, seed) => createRun(seed, {party: ['storm']})).find(
      (r) => runView(r).aiDue
    )!;
    const before = JSON.stringify(run);
    // A clock that runs out after a few reads: the search stops early, legally.
    let t = 0;
    const now = () => (t += AI.browser.thinkMs / 4);
    const next = handleRunAction(run, {type: 'continue'}, {now});
    expect(JSON.stringify(run)).toBe(before);
    expect(next.version).toBe(run.version + 1);
    expect(t).toBeGreaterThan(AI.browser.thinkMs);
    expect(t).toBeLessThan(AI.browser.thinkMs * 2);
  });

  it('is deterministic: the same seed and actions give the same fight', () => {
    const play = () => {
      let run = createRun(7);
      for (let i = 0; i < 5 && run.fight.phase === 'fight'; i++) {
        run = request(run, {action: {ability: 'hold'}});
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
      const t0 = performance.now();
      run = request(run);
      worst = Math.max(worst, performance.now() - t0);
    }
    expect(['won', 'lost']).toContain(run.fight.phase);
    // Generous for a test machine (a request here includes the player's pick);
    // the Worker's limit is 10 ms per request.
    expect(worst).toBeLessThan(200);
  });

  it('sees what enemies could do before its next turn, and arrows stop at the first unit', () => {
    upgrade('mangudai');
    const s = setup({'p-mangudai': at(0, 0), 'e-mangudai': at(6, 0), 'e-bokh': at(6, 6)});
    const m = unit(s, 'p-mangudai');
    const threats = threatsTo(s, STEPPE, m);
    const at3 = (h: Hex) => {
      const c = cloneFight(s);
      const me = unit(c, 'p-mangudai');
      me.hex = h;
      me.slot = c.currentSlot + 1;
      return threatDamage(threats, c, me);
    };
    // The enemy can shoot along its row however far; a row away only by
    // Skirmish's step, whose drawn arrow can be dodged; further, not this turn.
    const e = unit(s, 'e-mangudai');
    e.slot = 0;
    expect(at3(at(2, 0))).toBe(e.power);
    expect(at3(at(2, 1))).toBe(e.power * AI.dodgeShare);
    expect(at3(at(2, 3))).toBe(0);
    // …but not with a unit in the lane between, which the arrow would hit instead.
    const blocked = setup({
      'p-mangudai': at(0, 0),
      'p-bokh': at(1, 0),
      'e-mangudai': at(5, 0),
      'e-bokh': at(8, 6),
    });
    unit(blocked, 'e-mangudai').statuses.push({kind: 'immobilized'});
    const bm = unit(blocked, 'p-mangudai');
    const bt = threatsTo(blocked, STEPPE, bm);
    bm.slot = blocked.currentSlot + 1;
    unit(blocked, 'e-mangudai').slot = 0;
    expect(threatDamage(bt, blocked, bm)).toBe(0);
    // A Stunned enemy threatens nothing.
    unit(s, 'e-mangudai').statuses.push({kind: 'stunned'});
    expect(at3(at(2, 0))).toBe(0);
    // The Champion, a tank, ignores the threat when choosing.
    expect(AI.caution.bokh).toBe(0);
  });

  it('caps the AI’s search per turn, deterministically', () => {
    const run = createRun(0);
    const enemy = run.fight.units.find((u) => u.side === 'enemy')!;
    expect(scoreOptions(run.fight, enemy, 6)).toHaveLength(6);
    const budget = {left: 2 * AI.maxSimulations};
    const first = chooseAiTurn(run.fight, enemy, budget);
    expect(budget.left).toBeLessThan(2 * AI.maxSimulations);
    expect(2 * AI.maxSimulations - budget.left).toBeLessThanOrEqual(AI.maxSimulations);
    // Exhaustion never spends beyond the request budget; Hold is always legal.
    const starved = {left: 0};
    expect(chooseAiTurn(run.fight, enemy, starved)).toEqual({action: {ability: 'hold'}});
    expect(starved.left).toBe(0);
    expect(chooseAiTurn(run.fight, enemy, {left: 2 * AI.maxSimulations})).toEqual(first);
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
        action: {ability: 'longshot', target: {hex: {q: 99, r: 99}}},
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
    // The track runs on to the next decision, either side's, the last thing recorded.
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
    const next = request(run, {action: {ability: 'hold'}});
    expect(['action', 'step']).toContain(next.fight.events![0]!.kind);
    expect(next.fight.events).not.toContain(events[0]);
  });

  it('records an ability, then its hit with the damage dealt', () => {
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(4, 3)});
    s.events = [];
    const target = unit(s, 'e-bokh');
    const before = target.hp;
    applyTurn(s, unit(s, 'p-mangudai'), {action: {ability: 'longshot', target: {hex: at(4, 3)}}});
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
    enterHex({state: s, map: STEPPE, slot: 0}, unit(s, 'e-bokh'), at(5, 6), 'throw');
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
