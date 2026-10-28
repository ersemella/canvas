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
  isImmobilized,
  disarmed,
  lane,
} from './board';
import {ABILITIES, abilitiesOf, arrowLanes, ridePlan, stompPlan, unusableReason} from './abilities';
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
import {PASSIVES, draftPick} from './passives';
import {previewTurn} from './preview';
import {
  DOME,
  FLAMING,
  GOBI,
  MAPS,
  ROUTES,
  SALT,
  STEPPE,
  TUFF,
  blocks,
  depth,
  mapById,
  onMap,
  scorched,
  spaceAt,
  spaceOf,
  tileAt,
} from './map';
import {tileInfo} from './info';
import {
  checkEnd,
  damageOf,
  delay,
  displace,
  weaken,
  empower,
  enterHex,
  haste,
  hit,
  kill,
  applyDamage,
  startTurnPassives,
  endTurnEffects,
  stun,
  unswap,
  heal,
} from './resolve';
import type {Ctx} from './resolve';
import {
  RUN_FORMAT,
  createRun,
  handleRunAction,
  runOutdated,
  runStatus,
  runView,
  draftRivals,
  rivalPicks,
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
  // The fixed layout, which these tests place units around, and the map's first road.
  state.tiles = {...STEPPE.tiles};
  state.route = ROUTES[0]!;
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
    expect(HEROES.mangudai.abilities).toEqual(['snapShot', 'hold']);
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
    // The ally stands between: Snap Shot's lane stops at it.
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
    // The Grappler steps out of the line; the Storm Caller steps into it, nearer.
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

  it('gives the faster more turns: Outriders before Grappler, Grappler before Temee', () => {
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
    // Storm Caller (2) at 10, Temee (0) at 11, Grappler (2) at 12.
    unit(s, 'p-storm').slot = 10;
    unit(s, 'p-camel').slot = 11;
    unit(s, 'e-bokh').slot = 12;
    // The Outrider (3) takes 10; the Storm Caller, moved on, takes Temee's
    // 11; Temee, slower than Grappler, yields past 12 to 13.
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
        // The camel starts at a right-hand corner (tested with the camel).
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
    // The hexagon's two columns on each side: the straight edge, five hexes, and six in from it;
    // the party on the right, the enemy on the left.
    expect(map.startColumns.player.map((h) => h.q)).toEqual([
      ...Array(5).fill(4),
      ...Array(6).fill(3),
    ]);
    expect(map.startColumns.enemy.map((h) => h.q)).toEqual([
      ...Array(5).fill(-4),
      ...Array(6).fill(-3),
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
    expect(Object.keys(MAPS)).toEqual([
      'steppe',
      'gobi',
      'flaming',
      'fireMountain',
      'cave',
      'salt',
      'tuff',
      'ridges',
    ]);
    expect(mapById('gobi')).toBe(GOBI);
    expect(mapById('flaming')).toBe(FLAMING);
    expect(mapById('salt')).toBe(SALT);
    expect(mapById('tuff')).toBe(TUFF);
    expect(() => mapById('atlantis')).toThrow();
    for (const map of [GOBI, FLAMING, SALT, TUFF]) {
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
      expect(mapOf(s).name).toBe('The Gobi Desert');
      const tiles = Object.values(s.tiles);
      // Two or three oases, as many as the Steppe's yurts (owner, 2026-10-28).
      expect([2, 3]).toContain(tiles.filter((t) => t === 'obstacle').length);
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

  it('scatters seven or eight fairy chimneys over the Fairy Chimneys, none side by side, with no mountains', () => {
    for (let seed = 0; seed < 40; seed++) {
      // Even a stage that asks for mountains gets none here.
      const s = createFight(seed, undefined, undefined, true, [], TUFF);
      expect(s.mapId).toBe('tuff');
      expect(mapOf(s).name).toBe('The Fairy Chimneys');
      const chimneys = Object.keys(s.tiles).filter((k) => s.tiles[k] === 'obstacle');
      // Seven or eight (owner, 2026-10-28; three, then five or six, before).
      expect([7, 8]).toContain(chimneys.length);
      expect(Object.values(s.tiles).every((t) => t === 'obstacle')).toBe(true);
      const at = chimneys.map((k) => k.split(',').map(Number)).map(([q, r]) => ({q: q!, r: r!}));
      for (const h of at) {
        // Out to the edge, but off the starting columns.
        expect(Math.abs(h.q)).toBeLessThan(3);
        for (const x of at) if (x !== h) expect(hexDistance(x, h)).toBeGreaterThan(1);
      }
      for (const u of s.units) expect(canMove(s, mapOf(s), u)).toBe(true);
    }
  });

  it('stands one salt dome over the Salt Flats’ middle seven spaces in every fight, and nothing else', () => {
    for (let seed = 0; seed < 40; seed++) {
      const s = createFight(seed, undefined, undefined, false, [], SALT);
      expect(s.mapId).toBe('salt');
      expect(mapOf(s).name).toBe('The Salt Flats');
      expect(Object.keys(s.tiles).sort()).toEqual(DOME.map(hexKey).sort());
      expect(Object.values(s.tiles).every((t) => t === 'mountain')).toBe(true);
      for (const u of s.units) expect(canMove(s, mapOf(s), u)).toBe(true);
    }
  });

  it('spreads patches of scorched ground over the Flaming Mountains, with no mountains and one beacon tower', () => {
    const counts = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      // Even a stage that asks for mountains gets none here.
      const s = createFight(seed, undefined, undefined, true, [], FLAMING);
      expect(s.mapId).toBe('flaming');
      expect(mapOf(s).name).toBe('The Burning Mountains');
      const of = (tile: string) =>
        Object.keys(s.tiles)
          .filter((k) => s.tiles[k] === tile)
          .map((k) => k.split(',').map(Number) as [number, number])
          .map(([q, r]) => ({q, r}));
      expect(of('mountain')).toEqual([]);
      const burnt = of('scorched');
      // Off the starting columns and Humphrey's road, not next to its start or exit.
      const {camelStart, exits} = mapOf(s);
      const length = hexDistance(camelStart, exits[0]!);
      for (const h of burnt) {
        expect(Math.abs(h.q)).toBeLessThan(3);
        expect(hexDistance(camelStart, h) + hexDistance(h, exits[0]!)).toBeGreaterThan(length);
        for (const x of [camelStart, ...exits]) expect(hexDistance(h, x)).toBeGreaterThan(1);
      }
      // Four or five patches of one or two spaces, apart.
      const patches: Hex[][] = [];
      for (const m of burnt) {
        const touching = patches.filter((c) => c.some((n) => hexDistance(n, m) === 1));
        const merged = [m, ...touching.flat()];
        for (const c of touching) patches.splice(patches.indexOf(c), 1);
        patches.push(merged);
      }
      expect(patches.length).toBeGreaterThanOrEqual(4);
      expect(patches.length).toBeLessThanOrEqual(5);
      for (const c of patches) expect(c.length).toBeLessThanOrEqual(2);
      counts.add(burnt.length);
      // One beacon tower, never on scorched ground.
      const towers = of('obstacle');
      expect(towers).toHaveLength(1);
      expect(hexDistance(towers[0]!, {q: 0, r: 0})).toBeLessThanOrEqual(3);
      for (const u of s.units) {
        expect(canMove(s, mapOf(s), u)).toBe(true);
        // No unit starts on it.
        expect(scorched(mapOf(s), u.hex!)).toBe(false);
      }
    }
    expect(counts.size).toBeGreaterThan(1);
  });

  it('burns on scorched ground: Moved onto it or ending a turn there, not walking across', () => {
    const s = setup({'p-bokh': {q: 0, r: 0}, 'e-bokh': {q: 0, r: 2}});
    s.mapId = FLAMING.id;
    s.tiles = {[hexKey({q: 1, r: 0})]: 'scorched', [hexKey({q: 1, r: 1})]: 'scorched'};
    const map = mapOf(s);
    expect(scorched(map, {q: 1, r: 0})).toBe(true);
    expect(scorched(map, {q: 0, r: 0})).toBe(false);
    // It blocks nothing.
    expect(blocks('scorched')).toBe(false);
    const b = unit(s, 'p-bokh');
    // Walking across it, ending off it: no burn.
    s.awaiting = b.id;
    applyTurn(s, b, {
      move: [
        {q: 1, r: 0},
        {q: 1, r: -1},
      ],
      action: {ability: 'hold'},
    });
    expect(b.hp).toBe(b.maxHp);
    // Ending a turn on it burns.
    s.awaiting = b.id;
    applyTurn(s, b, {move: [{q: 1, r: 0}], action: {ability: 'hold'}});
    expect(b.hp).toBe(b.maxHp - RULES.scorch);
    // Moved onto it burns.
    const e = unit(s, 'e-bokh');
    const ctx: Ctx = {state: s, map, slot: 0};
    e.hex = {q: 1, r: 2};
    const dir = [0, 1, 2, 3, 4, 5].find((d) => hexEquals(hexNeighbor(e.hex!, d), {q: 1, r: 1}))!;
    displace(ctx, e, dir, 1, 'push');
    expect(e.hex).toEqual({q: 1, r: 1});
    expect(e.hp).toBe(e.maxHp - RULES.scorch);
    expect(tileInfo('flaming', 'scorched').name).toBe('Scorched ground');
  });

  it('names the ground after the map’s look', () => {
    expect(tileInfo('steppe', 'obstacle').name).toBe('Tent');
    expect(tileInfo('gobi', 'obstacle').name).toBe('Oasis');
    expect(tileInfo('gobi', 'sand').name).toBe('Sand');
    expect(tileInfo('gobi', 'mountain').name).toBe('Mountains');
    expect(tileInfo('flaming', 'sand').name).toBe('Red earth');
    expect(tileInfo('flaming', 'obstacle').name).toBe('Beacon tower');
    expect(tileInfo('flaming', 'mountain').name).toBe('Burning mountains');
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
    // Top to bottom: the top point first, the bottom one last.
    expect(map.hexes[0]).toEqual({q: 0, r: -4});
    expect(map.hexes.at(-1)).toEqual({q: 0, r: 4});
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
    expect(spaceAt(8, 0)).toEqual(map.startColumns.player[0]);
    expect(spaceAt(0, 0)).toEqual(map.startColumns.enemy[0]);
    expect(spaceAt(8, 0)).toEqual(ROUTES[0]!.camelStart);
    expect(spaceAt(8, 4)).toEqual(ROUTES[1]!.camelStart);
  });

  it('raises mountains along the top edge in every Steppe fight, anywhere along it at random, off the sides and the centre', () => {
    const centre: Hex = {q: 0, r: 0};
    const inFromTop = (h: Hex) => h.r + Math.min(h.q, 0) + 4;
    const edge = STEPPE.hexes.filter((h) => inFromTop(h) === 0 && Math.abs(h.q) < 4);
    const covered = new Set<string>();
    const counts = new Set<number>();
    for (let seed = 0; seed < 60; seed++) {
      const tiles = createFight(seed).tiles;
      const mountains = Object.keys(tiles)
        .filter((k) => tiles[k] === 'mountain')
        .map(hexFromKey);
      // One range or two, of 3 to 5 each.
      expect(mountains.length).toBeGreaterThanOrEqual(3);
      expect(mountains.length).toBeLessThanOrEqual(10);
      for (const m of mountains) {
        // In the top half, never near the centre, never on or next to the sides.
        expect(depth(m)).toBeLessThan(0);
        expect(hexDistance(m, centre)).toBeGreaterThanOrEqual(3);
        expect(Math.abs(m.q)).toBeLessThan(4);
        if (Math.abs(m.q) === 3) expect(inFromTop(m)).toBe(0);
        // On the top edge, or one in from it next to a mountain on it.
        expect(inFromTop(m)).toBeLessThanOrEqual(1);
        if (inFromTop(m) === 1)
          expect(mountains.some((n) => inFromTop(n) === 0 && hexDistance(m, n) === 1)).toBe(true);
      }
      const onEdge = mountains.filter((m) => inFromTop(m) === 0);
      onEdge.forEach((m) => covered.add(hexKey(m)));
      counts.add(onEdge.length);
    }
    // Every space along the top edge comes up, some fights take only part of it and some all of it.
    expect(covered).toEqual(new Set(edge.map(hexKey)));
    expect(Math.min(...counts)).toBeLessThanOrEqual(4);
    expect(counts.has(edge.length)).toBe(true);
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
    applyTurn(s, m, {action: {ability: 'snapShot', target: {hex: at(4, 3)}}});
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp - m.power);
    expect(m.power).toBe(2);
  });

  it('hail hits for the Storm Caller’s power', () => {
    const s = setup({'p-storm': at(1, 3), 'e-bokh': at(3, 3), 'e-mangudai': at(7, 6)});
    const storm = unit(s, 'p-storm');
    s.awaiting = storm.id;
    applyTurn(s, storm, {action: {ability: 'hail', target: {hex: at(3, 3)}}});
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp - 2);
    expect(storm.power).toBe(2);
  });

  it('Empower adds to a hit until the end of the unit’s next turn, then ends', () => {
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(4, 3), 'e-mangudai': at(7, 6)});
    s.units.forEach((u) => (u.controller = 'human'));
    const m = unit(s, 'p-mangudai');
    const ctx: Ctx = {state: s, map: mapOf(s), slot: 0};
    empower(ctx, m, 1);
    m.slot = 1;
    expect(advanceToDecision(s)!.id).toBe('p-mangudai');
    applyTurn(s, m, {action: {ability: 'snapShot', target: {hex: at(4, 3)}}});
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
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp - 3);
    expect(storm.empower).toBeUndefined();
  });

  it('a Grappler’s Empower adds to its squeeze when the rule says so, as it does in play', () => {
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
  it('shows every Snap Shot lane to the map’s edge, stopping at the first unit or an obstacle', () => {
    const s = setup({'p-mangudai': at(-1, 3), 'e-bokh': at(3, 6)});
    const from = at(-1, 3);
    const east = (l: ReturnType<typeof arrowLanes>) => l[0]!;
    // Nothing in the way: Snap Shot has no range limit, so the lane runs to the edge.
    let lanes = arrowLanes(s, mapOf(s), from);
    expect(lanes).toHaveLength(6);
    expect(east(lanes)).toEqual({hexes: [0, 1, 2, 3, 4, 5, 6, 7].map((c) => at(c, 3))});
    expect(ABILITIES.snapShot.targets(s, mapOf(s), unit(s, 'p-mangudai'), from)).toEqual([]);
    // A unit in it: the lane ends there, and that unit is Snap Shot's target.
    unit(s, 'e-bokh').hex = at(2, 3);
    lanes = arrowLanes(s, mapOf(s), from);
    expect(east(lanes).hexes).toEqual([at(0, 3), at(1, 3), at(2, 3)]);
    expect(east(lanes).hit!.id).toBe('e-bokh');
    expect(ABILITIES.snapShot.targets(s, mapOf(s), unit(s, 'p-mangudai'), from)).toEqual([
      {hex: at(2, 3)},
    ]);
  });

  it('Snap Shot hits the first unit on its line, an ally included, never past it', () => {
    const s = setup({
      'p-mangudai': at(0, 0),
      'p-bokh': at(1, 0),
      'e-bokh': at(3, 0),
      'e-storm': at(0, 6),
    });
    const m = unit(s, 'p-mangudai');
    const targets = ABILITIES.snapShot.targets(s, mapOf(s), m, m.hex!);
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
    applyTurn(s, m, {action: {ability: 'snapShot', target: {hex: at(1, 0)}}});
    expect(unit(s, 'p-bokh').hp).toBeLessThan(hp);
  });

  it('Grapple: its power in damage, then the target is Stunned; the Grappler stays free', () => {
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

  it('Grapple ends when the Grappler walks away', () => {
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

  it('Grapple isn’t offered on the unit the Grappler already grapples', () => {
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

  it('Grapple holds while the Grappler walks, if the walk ends next to its target', () => {
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

  it('Grapple: each of the Grappler’s turns while it lasts, its target takes 1', () => {
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

  it('Grapple ends when the Grappler takes damage, or is Stunned', () => {
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
    // The enemy Grappler grapples it: Stunned, it lets go.
    applyTurn(s, unit(s, 'e-bokh'), {action: {ability: 'grapple', target: {hex: b.hex!}}});
    expect(b.statuses.map((x) => x.kind)).toEqual(['stunned']);
    expect(target.statuses).toEqual([]);
  });

  it('Grapple is melee: only a unit next to the Grappler, with no step in', () => {
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

  it('Grapple throws the held unit: Moved to the free space picked next to the Grappler, not struck; the grapple holds', () => {
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
    // Every free space around the Grappler, not around the target, and the
    // Grappler's own (a swap): one tap, the held unit implied.
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
    // Only the grapple hit: the throw deals nothing.
    expect(target.hp).toBe(target.maxHp - b.power);
    expect(target.statuses.map((x) => x.kind)).toEqual(['stunned']);
  });

  it('Grapple on the Grappler’s own space swaps: the two trade spaces, it is not struck, and the grapple holds, Immobilized or not', () => {
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
    // Only the grapple hit: the throw deals nothing.
    expect(target.hp).toBe(target.maxHp - b.power);
    expect(target.statuses.map((x) => x.kind)).toEqual(['stunned']);
    // An Immobilized Grappler (in hail, say) still swaps back.
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

  it('a Grappler in hail grapples its caster: the hail hit came first, so the grapple holds and the caster’s turn is skipped', () => {
    const s = setup({'e-storm': at(2, 1), 'p-bokh': at(0, 1), 'e-mangudai': at(8, 6)});
    s.units.forEach((u) => (u.controller = 'human'));
    const storm = unit(s, 'e-storm');
    const b = unit(s, 'p-bokh');
    // The Storm Caller hails the Grappler's space, two away.
    s.awaiting = storm.id;
    applyTurn(s, storm, {action: {ability: 'hail', target: {hex: b.hex!}}});
    expect(b.hp).toBe(b.maxHp - storm.power);
    expect(b.statuses).toEqual([{kind: 'immobilized', hail: 'e-storm', at: at(0, 1)}]);
    // Moved next to it (by a Haul, say), it stays Immobilized.
    b.hex = at(1, 1);
    // The Grappler's turn, with the Storm Caller's next.
    b.slot = 1;
    storm.slot = 2;
    unit(s, 'e-mangudai').slot = 500;
    expect(advanceToDecision(s)!.id).toBe('p-bokh');
    // Immobilized doesn't stop a melee Grapple: the Grappler doesn't move.
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

describe('the Duelist', () => {
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

describe('the Barbarian', () => {
  const party: HeroId[] = ['varangian', 'modao', 'mangudai'];
  const c = at(4, 4);

  /** `n` spaces from `h` along direction `dir`. */
  const along = (h: Hex, dir: number, n: number): Hex => {
    for (let i = 0; i < n; i++) h = hexNeighbor(h, dir);
    return h;
  };
  /**
   * A fight with no yurts and the Barbarian at `c` to act; with `reave`,
   * carrying Reave in place of Axe Throw, as first built.
   */
  const ready = (placements: Record<string, Hex>, who = 'p-varangian', reave = true) => {
    const s = setup({[who]: c, ...placements}, party);
    s.tiles = {};
    const b = unit(s, who);
    if (reave) b.loadout = {abilities: ['reave', 'hold']};
    b.slot = s.currentSlot;
    s.awaiting = b.id;
    return {s, b};
  };
  const throwing = (placements: Record<string, Hex>, who = 'p-varangian') =>
    ready(placements, who, false);
  const hp = (s: FightState, id: string) => unit(s, id).maxHp - unit(s, id).hp;

  it('has speed 1, power 3, defence 2, Axe Throw, and is on the roster', () => {
    const {b} = throwing({});
    expect([b.speed, b.power, b.defence, b.maxHp]).toEqual([1, 3, 2, healthOf(2)]);
    expect(abilitiesOf(b).map((d) => d.id)).toEqual(['axeThrow', 'hold']);
    expect(ROSTER).toContain('varangian');
  });

  it('Axe Throw reaches any unit within 3 on its six lines, over yurts and units in between', () => {
    const {s, b} = throwing({
      'p-modao': along(c, 3, 1),
      'e-modao': along(c, 3, 3),
      'e-mangudai': along(c, 3, 4),
    });
    s.tiles = {[hexKey(along(c, 3, 2))]: 'obstacle'};
    const targets = ABILITIES.axeThrow.targets(s, mapOf(s), b, b.hex!);
    // The ally next to it and the enemy past it and the yurts; not the one 4 away.
    expect(targets).toEqual([{hex: along(c, 3, 1)}, {hex: along(c, 3, 3)}]);
  });

  it('Axe Throw hits for its power and Pushes the unit 1 away, and the axe needs no fetching', () => {
    const {s, b} = throwing({'p-modao': along(c, 3, 1), 'e-modao': along(c, 3, 3)});
    applyTurn(s, b, {action: {ability: 'axeThrow', target: {hex: along(c, 3, 3)}}});
    expect([hp(s, 'p-modao'), hp(s, 'e-modao')]).toEqual([0, 3]);
    expect(unit(s, 'e-modao').hex).toEqual(along(c, 3, 4));
    expect(b.axe).toBeUndefined();
    expect(unusableReason(b, ABILITIES.axeThrow)).toBeNull();
  });

  it('the AI throws its axe at an enemy in line, and counts it a threat down its lines', () => {
    const {s, b} = throwing({'p-modao': along(c, 3, 3), 'p-mangudai': at(0, 8)}, 'e-varangian');
    b.controller = 'ai';
    const turn = chooseAiTurn(s, b);
    expect(turn.action.ability).toBe('axeThrow');
    const m = unit(s, 'p-modao');
    const threat = threatsTo(s, mapOf(s), m).find((t) => t.enemyId === b.id)!;
    expect(threatDamage([threat], s, m)).toBe(b.power);
  });

  it('Reave swipes three spaces next to it, hitting allies too, and keeps the axe', () => {
    const {s, b} = ready({
      'e-modao': hexNeighbor(c, 0),
      'p-modao': hexNeighbor(c, 1),
      'e-mangudai': hexNeighbor(c, 3),
    });
    applyTurn(s, b, {action: {ability: 'reave', target: {hex: hexNeighbor(c, 0)}}});
    expect([hp(s, 'e-modao'), hp(s, 'p-modao'), hp(s, 'e-mangudai')]).toEqual([3, 3, 0]);
    expect(b.axe).toBeUndefined();
    expect(b.slot).toBe(actionCost(b));
  });

  it('Reave throws the axe down a line of 3, hitting every unit along it, and it lies on the last space', () => {
    const {s, b} = ready({
      'e-modao': along(c, 3, 2),
      'p-modao': along(c, 3, 3),
      'e-mangudai': along(c, 3, 4),
    });
    const targets = ABILITIES.reave.targets(s, mapOf(s), b, b.hex!);
    // A swipe toward each unit next to it (none), and a throw down each line that catches one.
    expect(targets).toEqual([{hex: along(c, 3, 3)}]);
    applyTurn(s, b, {action: {ability: 'reave', target: {hex: along(c, 3, 3)}}});
    expect([hp(s, 'e-modao'), hp(s, 'p-modao'), hp(s, 'e-mangudai')]).toEqual([3, 3, 0]);
    expect(b.axe).toEqual(along(c, 3, 3));
  });

  it('with its axe lying away from it, it can only move and Hold until it walks on or next to it', () => {
    const {s, b} = ready({'e-modao': hexNeighbor(c, 0)});
    b.axe = along(c, 3, 3);
    expect(disarmed(b)).toBe(true);
    expect(unusableReason(b, ABILITIES.reave)).not.toBeNull();
    expect(unusableReason(b, ABILITIES.hold)).toBeNull();
    expect(
      tryTurn(s, b.id, {action: {ability: 'reave', target: {hex: hexNeighbor(c, 0)}}})
    ).toThrow(RuleError);
    // A walk of 2 ends next to the axe: picked up.
    applyTurn(s, b, {move: [along(c, 3, 1), along(c, 3, 2)], action: {ability: 'hold'}});
    expect(b.axe).toBeUndefined();
    expect(disarmed(b)).toBe(false);
  });

  it('a yurt stops the throw short, and a line of fewer than 2 spaces offers none', () => {
    const {s, b} = ready({'e-modao': along(c, 3, 2)});
    s.tiles = {[hexKey(along(c, 3, 3))]: 'obstacle'};
    expect(ABILITIES.reave.targets(s, mapOf(s), b, b.hex!)).toEqual([{hex: along(c, 3, 2)}]);
    s.tiles = {[hexKey(along(c, 3, 2))]: 'obstacle'};
    unit(s, 'e-modao').hex = along(c, 3, 1);
    // Only the swipes that catch it, next to the Barbarian.
    expect(
      ABILITIES.reave.targets(s, mapOf(s), b, b.hex!).every((t) => hexDistance(t.hex!, c) === 1)
    ).toBe(true);
  });

  it('the AI swipes an enemy next to it, and walks back to its thrown axe', () => {
    const {s, b} = ready({'p-modao': hexNeighbor(c, 0), 'p-mangudai': at(4, 8)}, 'e-varangian');
    b.controller = 'ai';
    expect(chooseAiTurn(s, b).action.ability).toBe('reave');
    b.axe = along(c, 3, 3);
    const turn = chooseAiTurn(s, b);
    expect(turn.move?.length).toBeGreaterThan(0);
    expect(hexDistance(turn.move!.at(-1)!, b.axe)).toBeLessThanOrEqual(1);
  });
});

describe('the Magus', () => {
  const party: HeroId[] = ['magus', 'mangudai', 'bokh'];
  const c = at(4, 4);
  const omenTargets = (s: FightState, m: Unit) => ABILITIES.omen.targets(s, mapOf(s), m, m.hex!);

  it('has speed 2, power 0, defence 1, and is Inevitable from the start', () => {
    const s = setup({'p-magus': c}, party);
    const m = unit(s, 'p-magus');
    expect([m.speed, m.power, m.defence, m.maxHp]).toEqual([2, 0, 1, healthOf(1)]);
    expect(m.passives).toEqual(['steadyGait']);
    const ctx: Ctx = {state: s, map: mapOf(s), slot: 0};
    const was = m.slot;
    delay(ctx, m, 3);
    haste(ctx, m, 3);
    expect(m.slot).toBe(was);
  });

  it('Omen as `swap` (the first built) swaps two cards within 2 before its next turn', () => {
    const was = {...ABILITY.omen};
    Object.assign(ABILITY.omen, {mode: 'swap', range: 2});
    try {
      const s = setup(
        {
          'p-magus': c,
          'e-mangudai': hexNeighbor(c, 0),
          'p-bokh': hexNeighbor(hexNeighbor(c, 3), 3),
        },
        party
      );
      const m = unit(s, 'p-magus');
      const e = unit(s, 'e-mangudai');
      const b = unit(s, 'p-bokh');
      m.slot = s.currentSlot;
      e.slot = 1;
      b.slot = 7;
      const targets = omenTargets(s, m);
      expect(targets).toHaveLength(2);
      // Either way round is the same swap.
      applyTurn(s, m, {action: {ability: 'omen', target: {hex: e.hex!, to: b.hex!}}});
      expect([e.slot, b.slot]).toEqual([7, 1]);
      expect(m.slot).toBe(actionCost(m));
      expect(m.power).toBe(0);
      expect(e.hp).toBe(e.maxHp);
    } finally {
      Object.assign(ABILITY.omen, was);
    }
  });

  it('Omen as `bracket` puts the first card next and the second just after its next turn', () => {
    const was = {...ABILITY.omen};
    Object.assign(ABILITY.omen, {mode: 'bracket', range: 2});
    try {
      const s = setup(
        {
          'p-magus': c,
          'e-mangudai': hexNeighbor(c, 0),
          'p-bokh': hexNeighbor(hexNeighbor(c, 3), 3),
        },
        party
      );
      const m = unit(s, 'p-magus');
      const e = unit(s, 'e-mangudai');
      const b = unit(s, 'p-bokh');
      m.slot = s.currentSlot;
      e.slot = 1;
      b.slot = 7;
      // Which is aimed first matters: both orders are offered.
      expect(omenTargets(s, m)).toHaveLength(2);
      applyTurn(s, m, {action: {ability: 'omen', target: {hex: b.hex!, to: e.hex!}}});
      expect([b.slot, e.slot]).toEqual([s.currentSlot + 1, actionCost(m) + 1]);
      expect(m.slot).toBe(actionCost(m));
      // With no guard, the Outrider can be put back again before it acts.
      s.currentSlot = actionCost(m);
      s.awaiting = m.id;
      b.slot = actionCost(m) + 2;
      const seconds = () => omenTargets(s, m).map((t) => unitAt(s, t.to!)!.id);
      expect(seconds().sort()).toEqual(['e-mangudai', 'p-bokh']);
      // With `once` (a switch, off), not until it has acted: only aimed first.
      Object.assign(ABILITY.omen, {once: true});
      expect(seconds()).toEqual(['p-bokh']);
    } finally {
      Object.assign(ABILITY.omen, was);
    }
  });

  it('Omen as `before` puts the first card next and the second just before its next turn', () => {
    const was = {...ABILITY.omen};
    Object.assign(ABILITY.omen, {mode: 'before', range: 2});
    try {
      const s = setup(
        {
          'p-magus': c,
          'e-mangudai': hexNeighbor(c, 0),
          'p-bokh': hexNeighbor(hexNeighbor(c, 3), 3),
        },
        party
      );
      const m = unit(s, 'p-magus');
      const e = unit(s, 'e-mangudai');
      const b = unit(s, 'p-bokh');
      m.slot = s.currentSlot;
      e.slot = 1;
      b.slot = 7;
      applyTurn(s, m, {action: {ability: 'omen', target: {hex: b.hex!, to: e.hex!}}});
      expect([b.slot, e.slot, m.slot]).toEqual([
        s.currentSlot + 1,
        actionCost(m) - 1,
        actionCost(m),
      ]);
    } finally {
      Object.assign(ABILITY.omen, was);
    }
  });

  it('Omen aims one unit within 3: an ally acts next, an enemy after its next turn', () => {
    const was = {...ABILITY.omen};
    try {
      expect([ABILITY.omen.mode, ABILITY.omen.range]).toEqual(['single', 3]);
      const s = setup(
        {
          'p-magus': c,
          'e-mangudai': hexNeighbor(c, 0),
          'p-bokh': hexNeighbor(hexNeighbor(c, 3), 3),
        },
        party
      );
      const m = unit(s, 'p-magus');
      const e = unit(s, 'e-mangudai');
      const b = unit(s, 'p-bokh');
      m.slot = s.currentSlot;
      e.slot = 1;
      b.slot = 7;
      expect(omenTargets(s, m).map((t) => [unitAt(s, t.hex!)!.id, t.to])).toEqual(
        expect.arrayContaining([
          ['e-mangudai', undefined],
          ['p-bokh', undefined],
        ])
      );
      applyTurn(s, m, {action: {ability: 'omen', target: {hex: b.hex!}}});
      expect(b.slot).toBe(s.currentSlot + 1);
      const s2 = setup({'p-magus': c, 'e-mangudai': hexNeighbor(c, 0)}, party);
      const m2 = unit(s2, 'p-magus');
      const e2 = unit(s2, 'e-mangudai');
      m2.slot = s2.currentSlot;
      e2.slot = 1;
      applyTurn(s2, m2, {action: {ability: 'omen', target: {hex: e2.hex!}}});
      expect(e2.slot).toBe(actionCost(m2) + 1);
    } finally {
      Object.assign(ABILITY.omen, was);
    }
  });

  it('Omen as `bracket` passes over cards after its next turn, units beyond 2, the Inevitable and itself', () => {
    const was = {...ABILITY.omen};
    Object.assign(ABILITY.omen, {mode: 'bracket', range: 2});
    try {
      const s = setup(
        {
          'p-magus': c,
          'e-mangudai': hexNeighbor(c, 0),
          'e-bokh': hexNeighbor(c, 1),
          'p-bokh': hexNeighbor(c, 2),
          'p-mangudai': at(4, 7),
          'p-camel': hexNeighbor(c, 4),
        },
        party
      );
      const m = unit(s, 'p-magus');
      m.slot = s.currentSlot;
      const next = aimSlot(s, m);
      unit(s, 'e-mangudai').slot = next - 1;
      unit(s, 'e-bokh').slot = next + 1;
      unit(s, 'p-bokh').slot = 2;
      unit(s, 'p-bokh').passives = ['steadyGait'];
      unit(s, 'p-mangudai').slot = 3;
      unit(s, 'p-camel').slot = 4;
      // Only the Outrider next to it and Humphrey remain: one pair, either way round.
      const ids = omenTargets(s, m).map((t) => [unitAt(s, t.hex!)!.id, unitAt(s, t.to!)!.id]);
      expect(ids).toEqual(
        expect.arrayContaining([
          ['e-mangudai', 'p-camel'],
          ['p-camel', 'e-mangudai'],
        ])
      );
      expect(ids).toHaveLength(2);
      // With one unit left, there is nothing to swap.
      unit(s, 'p-camel').slot = next + 2;
      expect(omenTargets(s, m)).toEqual([]);
      expect(offeredTargets(s, mapOf(s), m, ABILITIES.omen)).toEqual([]);
    } finally {
      Object.assign(ABILITY.omen, was);
    }
  });

  it('an Inevitable card is still bumped on by a collision', () => {
    const s = setup({'p-magus': c, 'e-mangudai': at(4, 7)}, party);
    const m = unit(s, 'p-magus');
    const e = unit(s, 'e-mangudai');
    m.slot = 5;
    placeCard(s, e, 5);
    // The faster card keeps the slot (3.3).
    expect([e.slot, m.slot]).toEqual([5, 6]);
  });
});

describe('the Juggernaut', () => {
  const party: HeroId[] = ['mahout', 'bokh', 'storm'];
  const c = at(4, 4);
  /** `n` spaces from `h` along direction `dir`. */
  const along = (h: Hex, dir: number, n: number): Hex => {
    for (let i = 0; i < n; i++) h = hexNeighbor(h, dir);
    return h;
  };
  /** A fight with the Juggernaut at `c` to act, and units where `placements` puts them. */
  const ready = (placements: Record<string, Hex>) => {
    const s = setup({'p-mahout': c, ...placements}, party);
    // Open ground: the layout's yurts taken off, so every line runs on.
    s.tiles = Object.fromEntries(
      Object.entries(s.tiles).map(([k, t]) => [k, t === 'obstacle' ? 'sand' : t])
    );
    const e = unit(s, 'p-mahout');
    e.slot = s.currentSlot;
    s.awaiting = e.id;
    return {s, e};
  };
  const stomp = (s: FightState, e: Unit, hex: Hex) =>
    applyTurn(s, e, {action: {ability: 'stomp', target: {hex}}});
  /** `fn` with Stomp switched to `patch` (the charge, as first built, or the stomp in place). */
  const withStomp = (patch: Partial<typeof ABILITY.stomp>, fn: () => void) => {
    const was = {...ABILITY.stomp};
    Object.assign(ABILITY.stomp, patch);
    try {
      fn();
    } finally {
      Object.assign(ABILITY.stomp, was);
    }
  };
  const charge = {mode: 'charge'} as const;

  it('has speed 1, defence 3, power 2, and is Unstoppable from the start', () => {
    const {s, e} = ready({});
    expect([e.speed, e.defence, e.power, e.maxHp]).toEqual([1, 3, 2, healthOf(3)]);
    expect(e.passives).toEqual(['unstoppable']);
    expect(ROSTER).toContain('mahout');
    const ctx: Ctx = {state: s, map: mapOf(s), slot: 0};
    displace(ctx, e, 0, 2, 'push');
    expect(e.hex).toEqual(c);
    stun(ctx, e, {kind: 'stunned'});
    expect(e.statuses).toEqual([]);
  });

  it('can’t be grappled: Unstoppable means it can’t be Stunned', () => {
    const {s} = ready({'e-bokh': hexNeighbor(c, 0)});
    const g = unit(s, 'e-bokh');
    expect(ABILITIES.grapple.targets(s, mapOf(s), g, g.hex!)).toEqual([]);
  });

  it('the charge (first built): with no one in the way is a walk of up to 2 in a straight line', () =>
    withStomp(charge, () => {
      const {s, e} = ready({});
      const targets = ABILITIES.stomp.targets(s, mapOf(s), e, c);
      expect(targets).toHaveLength(12);
      stomp(s, e, along(c, 0, 2));
      expect(e.hex).toEqual(along(c, 0, 2));
      expect(e.hp).toBe(e.maxHp);
    }));

  it('the charge (first built): hits every unit lined up in its way and Pushes the whole row back', () =>
    withStomp(charge, () => {
      // Direction 2, the longest line from the middle: room for the row to go.
      const {s, e} = ready({'e-bokh': along(c, 2, 1), 'p-bokh': along(c, 2, 2)});
      stomp(s, e, along(c, 2, 2));
      // Each takes the Juggernaut's power once, its ally too, and is Pushed 2.
      for (const [id, n] of [
        ['e-bokh', 3],
        ['p-bokh', 4],
      ] as const) {
        expect(unit(s, id).hex).toEqual(along(c, 2, n));
        expect(unit(s, id).hp).toBe(unit(s, id).maxHp - 2);
      }
      expect(e.hex).toEqual(along(c, 2, 2));
    }));

  it('the charge (first built): a row that can’t be Pushed stops the Juggernaut behind it, hit all the same', () =>
    withStomp(charge, () => {
      const {s, e} = ready({'e-bokh': along(c, 0, 1), 'e-storm': along(c, 0, 2)});
      unit(s, 'e-storm').passives = ['rooted'];
      stomp(s, e, along(c, 0, 2));
      expect(e.hex).toEqual(c);
      expect(unit(s, 'e-bokh').hex).toEqual(along(c, 0, 1));
      expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp - 2);
      expect(unit(s, 'e-storm').hp).toBe(unit(s, 'e-storm').maxHp - 2);
    }));

  it('the charge (first built): a row Pushed after a step only once it is reached: a unit 2 away is Pushed 1', () =>
    withStomp(charge, () => {
      const {s, e} = ready({'e-bokh': along(c, 0, 2)});
      stomp(s, e, along(c, 0, 2));
      expect(e.hex).toEqual(along(c, 0, 2));
      expect(unit(s, 'e-bokh').hex).toEqual(along(c, 0, 3));
      expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp - 2);
    }));

  it('the charge (first built): walks through hail, hit but not held, and a unit Pushed into hail is held', () =>
    withStomp(charge, () => {
      const {s, e} = ready({'e-storm': at(0, 0), 'e-bokh': along(c, 0, 2)});
      s.effects.push({kind: 'hail', hex: along(c, 0, 1), source: 'e-storm', turns: 2});
      s.effects.push({kind: 'hail', hex: along(c, 0, 3), source: 'e-storm', turns: 2});
      // An ordinary walk goes on through hail too.
      const past = hexNeighbor(along(c, 0, 1), 1);
      expect(invalidPath(s, mapOf(s), e, [along(c, 0, 1), past])).toBeNull();
      expect(reachableHexes(s, mapOf(s), e).some((r) => hexEquals(r.hex, past))).toBe(true);
      stomp(s, e, along(c, 0, 2));
      expect(e.hex).toEqual(along(c, 0, 2));
      expect(e.statuses).toEqual([]);
      // The hail's sting on entering: the Storm Caller's power.
      expect(e.hp).toBe(e.maxHp - unit(s, 'e-storm').power);
      const b = unit(s, 'e-bokh');
      expect(b.hex).toEqual(along(c, 0, 3));
      expect(b.statuses.some((x) => x.kind === 'immobilized')).toBe(true);
    }));

  it('Stomp in place hits every unit next to it and Pushes each 1 away', () =>
    withStomp({step: 0}, () => {
      // An ally caught too; a unit behind another isn't Pushed into it.
      const {s, e} = ready({
        'e-bokh': along(c, 0, 1),
        'p-bokh': along(c, 3, 1),
        'e-storm': along(c, 2, 1),
        'p-storm': along(c, 2, 2),
      });
      unit(s, 'e-storm').hp = 2;
      expect(ABILITIES.stomp.targets(s, mapOf(s), e, c)).toEqual([{hex: c}]);
      stomp(s, e, c);
      expect(e.hex).toEqual(c);
      expect(unit(s, 'e-bokh').hex).toEqual(along(c, 0, 2));
      expect(unit(s, 'p-bokh').hex).toEqual(along(c, 3, 2));
      for (const id of ['e-bokh', 'p-bokh']) expect(unit(s, id).hp).toBe(unit(s, id).maxHp - 2);
      // Felled by the hit, so not Pushed; the one past it untouched.
      expect(unit(s, 'e-storm').alive).toBe(false);
      expect(unit(s, 'p-storm').hp).toBe(unit(s, 'p-storm').maxHp);
      expect(unit(s, 'p-storm').hex).toEqual(along(c, 2, 2));
    }));

  it('a stomped unit with no room behind it is hit but stays', () => {
    const {s, e} = ready({'e-bokh': along(c, 0, 1), 'p-bokh': along(c, 0, 2)});
    stomp(s, e, c);
    expect(unit(s, 'e-bokh').hex).toEqual(along(c, 0, 1));
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp - 2);
    expect(unit(s, 'p-bokh').hp).toBe(unit(s, 'p-bokh').maxHp);
    // The AI plays it too.
    e.controller = 'ai';
    e.slot = s.currentSlot;
    s.awaiting = e.id;
    applyTurn(s, e, chooseAiTurn(s, e));
  });

  it('Stomp steps 1 first, or stays, and stomps where it lands', () => {
    const {s, e} = ready({'e-bokh': along(c, 0, 2)});
    // In place, or onto any of the six free spaces next to it.
    expect(ABILITIES.stomp.targets(s, mapOf(s), e, c)).toHaveLength(7);
    const to = along(c, 0, 1);
    stomp(s, e, to);
    expect(e.hex).toEqual(to);
    expect(unit(s, 'e-bokh').hex).toEqual(along(c, 0, 3));
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp - 2);
    // The AI steps in to stomp an enemy 2 away.
    const t = ready({'e-bokh': along(c, 2, 2), 'e-storm': at(8, 8)});
    t.e.controller = 'ai';
    const turn = chooseAiTurn(t.s, t.e);
    expect(turn.action.ability).toBe('stomp');
    applyTurn(t.s, t.e, turn);
    expect(unit(t.s, 'e-bokh').hp).toBe(unit(t.s, 'e-bokh').maxHp - 2);
  });

  it('Stomp steps into an enemy next to it, shoving it on, then stomps it again', () => {
    const {s, e} = ready({'e-bokh': along(c, 0, 1), 'p-bokh': along(c, 3, 1)});
    // An enemy's space is a target; an ally's isn't.
    const targets = ABILITIES.stomp.targets(s, mapOf(s), e, c);
    expect(targets.some((t) => hexEquals(t.hex!, along(c, 0, 1)))).toBe(true);
    expect(targets.some((t) => hexEquals(t.hex!, along(c, 3, 1)))).toBe(false);
    stomp(s, e, along(c, 0, 1));
    expect(e.hex).toEqual(along(c, 0, 1));
    // Shoved 1 along the step, then Pushed 1 more by the stomp, hit once.
    const b = unit(s, 'e-bokh');
    expect(b.hex).toEqual(along(c, 0, 3));
    expect(b.hp).toBe(b.maxHp - 2);
    // The ally it stepped away from is no longer next to it.
    expect(unit(s, 'p-bokh').hp).toBe(unit(s, 'p-bokh').maxHp);
  });

  it('an enemy that can’t be shoved on isn’t a target', () => {
    const {s, e} = ready({
      'e-bokh': along(c, 0, 1),
      'p-bokh': along(c, 0, 2),
      'e-storm': along(c, 1, 1),
    });
    unit(s, 'e-storm').passives = ['rooted'];
    const targets = ABILITIES.stomp.targets(s, mapOf(s), e, c);
    // Blocked by an ally behind it, and Rooted: neither space offered.
    for (const h of [along(c, 0, 1), along(c, 1, 1)])
      expect(targets.some((t) => hexEquals(t.hex!, h))).toBe(false);
    expect(() => stomp(s, e, along(c, 0, 1))).toThrow();
  });

  it('the AI’s guess at a stomp counts only the units next to where it lands', () => {
    const {s} = ready({'e-bokh': along(c, 0, 1), 'e-storm': along(c, 3, 1)});
    const plan = stompPlan(s, mapOf(s), c, along(c, 0, 1));
    expect(plan.end).toEqual(along(c, 0, 1));
    expect(plan.caught.map((u) => u.id)).toEqual(['e-bokh']);
  });

  it('a Juggernaut felled by hail on its step doesn’t stomp', () => {
    const {s, e} = ready({'e-storm': at(0, 0), 'e-bokh': along(c, 0, 2)});
    s.effects.push({kind: 'hail', hex: along(c, 0, 1), source: 'e-storm', turns: 2});
    e.hp = 1;
    stomp(s, e, along(c, 0, 1));
    expect(e.alive).toBe(false);
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp);
  });

  it('the AI weighs Stomp and plays a legal turn with it', () => {
    const {s, e} = ready({'e-bokh': hexNeighbor(c, 0), 'e-storm': at(8, 8)});
    e.controller = 'ai';
    const turn = chooseAiTurn(s, e);
    expect(turn.action.ability).toBe('stomp');
    applyTurn(s, e, turn);
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp - 2);
  });
});

describe('the Ranger', () => {
  const party: HeroId[] = ['archer', 'bokh', 'storm'];
  const c = at(1, 4);
  /** `n` spaces from `h` along direction `dir`. */
  const along = (h: Hex, dir: number, n: number): Hex => {
    for (let i = 0; i < n; i++) h = hexNeighbor(h, dir);
    return h;
  };
  /** A fight with the Ranger at `c` to act, and units where `placements` puts them. */
  const ready = (placements: Record<string, Hex>) => {
    const s = setup({'p-archer': c, ...placements}, party);
    const a = unit(s, 'p-archer');
    a.slot = s.currentSlot;
    s.awaiting = a.id;
    return {s, a};
  };
  const isTarget = (s: FightState, a: Unit, h: Hex) =>
    ABILITIES.longshot.targets(s, mapOf(s), a, a.hex!).some((t) => hexEquals(t.hex!, h));

  it('has speed 2, defence 1, power 3, and is on the roster', () => {
    const {a} = ready({});
    expect([a.speed, a.defence, a.power, a.maxHp]).toEqual([2, 1, 3, healthOf(1)]);
    expect(abilitiesOf(a).map((d) => d.id)).toEqual(['longshot', 'hold']);
    expect(ROSTER).toContain('archer');
  });

  it('Longshot as first built (`first` off) hits any unit on its six lines, past the units and yurts in between', () => {
    const was = {...ABILITY.longshot};
    Object.assign(ABILITY.longshot, {first: false, pierce: false, minRange: 1, push: 0, delay: 0});
    try {
      const {s, a} = ready({
        'p-bokh': along(c, 0, 1),
        'e-bokh': along(c, 0, 2),
        'e-storm': along(c, 0, 4),
      });
      // A yurt in the line too, between the Grappler and the Storm Caller.
      s.tiles = {...s.tiles, [`${along(c, 0, 3).q},${along(c, 0, 3).r}`]: 'obstacle'};
      for (const id of ['p-bokh', 'e-bokh', 'e-storm'])
        expect(isTarget(s, a, unit(s, id).hex!)).toBe(true);
      const storm = unit(s, 'e-storm');
      applyTurn(s, a, {action: {ability: 'longshot', target: {hex: storm.hex!}}});
      expect(storm.hp).toBe(storm.maxHp - 3);
      // The units it flew over are untouched.
      expect(unit(s, 'p-bokh').hp).toBe(unit(s, 'p-bokh').maxHp);
      expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp);
    } finally {
      Object.assign(ABILITY.longshot, was);
    }
  });

  it('Longshot reaches only its six lines', () => {
    const {s, a} = ready({'e-bokh': hexNeighbor(along(c, 0, 2), 1)});
    expect(isTarget(s, a, unit(s, 'e-bokh').hex!)).toBe(false);
    expect(ABILITIES.longshot.targets(s, mapOf(s), a, a.hex!)).toEqual([]);
  });

  it('as first built, threatens its whole lines, whatever stands in them', () => {
    const was = {...ABILITY.longshot};
    Object.assign(ABILITY.longshot, {first: false, pierce: false, delay: 0});
    try {
      const {s} = ready({'e-bokh': along(c, 0, 1), 'e-storm': along(c, 0, 3)});
      for (const u of s.units) u.side = u.id === 'p-archer' ? 'enemy' : 'player';
      const storm = unit(s, 'e-storm');
      const threats = threatsTo(s, mapOf(s), storm);
      const archer = threats.find((t) => t.enemyId === 'p-archer')!;
      const key = (h: Hex) => (h.q + 64) * 128 + (h.r + 64);
      expect(archer.hexes.get(key(storm.hex!))).toBe(3);
    } finally {
      Object.assign(ABILITY.longshot, was);
    }
  });

  it('Longshot hits the first unit in line, Piercing, and stays put', () => {
    const {s, a} = ready({'e-bokh': along(c, 0, 2), 'e-storm': along(c, 0, 4)});
    const bokh = unit(s, 'e-bokh');
    bokh.passives = ['hardened'];
    bokh.slot = 5;
    expect(isTarget(s, a, bokh.hex!)).toBe(true);
    expect(isTarget(s, a, unit(s, 'e-storm').hex!)).toBe(false);
    applyTurn(s, a, {action: {ability: 'longshot', target: {hex: bokh.hex!}}});
    // Armour 1 (Hardened) Pierced: the full 3.
    expect(bokh.hp).toBe(bokh.maxHp - 3);
    expect(bokh.hex).toEqual(along(c, 0, 2));
    expect(bokh.slot).toBe(5);
  });

  it('Longshot with `push` Pushes the unit it hits', () => {
    const was = {...ABILITY.longshot};
    Object.assign(ABILITY.longshot, {push: 1});
    try {
      const {s, a} = ready({'e-bokh': along(c, 0, 2)});
      const bokh = unit(s, 'e-bokh');
      applyTurn(s, a, {action: {ability: 'longshot', target: {hex: bokh.hex!}}});
      expect(bokh.hex).toEqual(along(c, 0, 3));
    } finally {
      Object.assign(ABILITY.longshot, was);
    }
  });

  it('Longshot flies over a unit next to the Ranger and hits the first one beyond', () => {
    const {s, a} = ready({
      'e-bokh': along(c, 0, 1),
      'e-storm': along(c, 0, 3),
      'p-bokh': along(c, 0, 4),
    });
    expect(isTarget(s, a, unit(s, 'e-bokh').hex!)).toBe(false);
    expect(isTarget(s, a, unit(s, 'e-storm').hex!)).toBe(true);
    expect(isTarget(s, a, unit(s, 'p-bokh').hex!)).toBe(false);
    const storm = unit(s, 'e-storm');
    applyTurn(s, a, {action: {ability: 'longshot', target: {hex: storm.hex!}}});
    expect(storm.hp).toBe(storm.maxHp - 3);
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp);
  });

  it('Longshot flies over a yurt next to the Ranger', () => {
    const {s, a} = ready({'e-storm': along(c, 0, 3)});
    s.tiles = {...s.tiles, [`${along(c, 0, 1).q},${along(c, 0, 1).r}`]: 'obstacle'};
    expect(isTarget(s, a, unit(s, 'e-storm').hex!)).toBe(true);
  });

  it('threatens past a unit next to the Ranger, but not the space it stands on', () => {
    const {s} = ready({'e-bokh': along(c, 0, 1), 'e-storm': along(c, 0, 3)});
    for (const u of s.units) u.side = u.id === 'p-archer' ? 'enemy' : 'player';
    const archer = threatsTo(s, mapOf(s), unit(s, 'e-storm')).find(
      (t) => t.enemyId === 'p-archer'
    )!;
    const key = (h: Hex) => (h.q + 64) * 128 + (h.r + 64);
    expect(archer.hexes.get(key(unit(s, 'e-storm').hex!))).toBe(3);
    expect(archer.hexes.get(key(unit(s, 'e-bokh').hex!))).toBeUndefined();
  });

  it('Longshot stops at a yurt in line', () => {
    const {s, a} = ready({'e-storm': along(c, 0, 4)});
    s.tiles = {...s.tiles, [`${along(c, 0, 2).q},${along(c, 0, 2).r}`]: 'obstacle'};
    expect(isTarget(s, a, unit(s, 'e-storm').hex!)).toBe(false);
  });

  it('Longshot with `delay` Delays the unit it hits', () => {
    const was = {...ABILITY.longshot};
    Object.assign(ABILITY.longshot, {first: true, push: 0, delay: 3});
    try {
      const {s, a} = ready({'e-bokh': along(c, 0, 2)});
      const bokh = unit(s, 'e-bokh');
      bokh.slot = 5;
      applyTurn(s, a, {action: {ability: 'longshot', target: {hex: bokh.hex!}}});
      expect(bokh.slot).toBe(5 + 3);
    } finally {
      Object.assign(ABILITY.longshot, was);
    }
  });

  it('Longshot with `pin` Immobilizes the unit it hits through its next turn', () => {
    const was = {...ABILITY.longshot};
    Object.assign(ABILITY.longshot, {first: true, pin: true});
    try {
      const {s, a} = ready({'e-bokh': along(c, 0, 2)});
      const bokh = unit(s, 'e-bokh');
      applyTurn(s, a, {action: {ability: 'longshot', target: {hex: bokh.hex!}}});
      expect(isImmobilized(bokh)).toBe(true);
      endTurnEffects(bokh);
      expect(isImmobilized(bokh)).toBe(false);
    } finally {
      Object.assign(ABILITY.longshot, was);
    }
  });

  it('the AI shoots with Longshot and plays a legal turn', () => {
    const {s, a} = ready({'e-bokh': along(c, 0, 2), 'e-storm': along(c, 0, 4)});
    a.controller = 'ai';
    const turn = chooseAiTurn(s, a);
    expect(turn.action.ability).toBe('longshot');
    applyTurn(s, a, turn);
    expect(s.units.some((u) => u.side === 'enemy' && u.hp < u.maxHp)).toBe(true);
  });
});

describe('the Cataphract', () => {
  const party: HeroId[] = ['cataphract', 'bokh', 'storm'];
  const c = at(4, 4);
  /** `n` spaces from `h` along direction `dir`. */
  const along = (h: Hex, dir: number, n: number): Hex => {
    for (let i = 0; i < n; i++) h = hexNeighbor(h, dir);
    return h;
  };
  /** A fight on open ground with the Cataphract at `c` to act, and units where `placements` puts them. */
  const ready = (placements: Record<string, Hex>) => {
    const s = setup({'p-cataphract': c, ...placements}, party);
    s.tiles = Object.fromEntries(
      Object.entries(s.tiles).map(([k, t]) => [k, t === 'obstacle' ? 'sand' : t])
    );
    const k = unit(s, 'p-cataphract');
    k.slot = s.currentSlot;
    s.awaiting = k.id;
    return {s, k};
  };
  const charge = (s: FightState, k: Unit, hex: Hex) =>
    applyTurn(s, k, {action: {ability: 'charge', target: {hex}}});
  const isTarget = (s: FightState, k: Unit, h: Hex) =>
    ABILITIES.charge.targets(s, mapOf(s), k, k.hex!).some((t) => hexEquals(t.hex!, h));
  // Direction 2, the longest line from the middle.
  const dir = 2;

  it('has speed 2, defence 3, power 1, and no walk of its own: it moves by Charge', () => {
    const {s, k} = ready({});
    expect([k.speed, k.defence, k.power, k.maxHp]).toEqual([2, 3, 1, healthOf(3)]);
    expect(HEROES.cataphract.abilities).toEqual(['charge', 'hold']);
    expect(ROSTER).toContain('cataphract');
    expect(canMove(s, mapOf(s), k)).toBe(false);
    expect(tryTurn(s, k.id, {move: [hexNeighbor(c, 0)], action: {ability: 'hold'}})).toThrow(
      RuleError
    );
  });

  it('with no one in the way rides any distance straight, to a lane’s end', () => {
    const {s, k} = ready({});
    const end = lane(mapOf(s), c, dir).at(-1)!;
    expect(hexDistance(c, end)).toBeGreaterThan(2);
    // Every space of all six lanes.
    const all = [0, 1, 2, 3, 4, 5].flatMap((d) => lane(mapOf(s), c, d));
    expect(ABILITIES.charge.targets(s, mapOf(s), k, c)).toHaveLength(all.length);
    charge(s, k, end);
    expect(k.hex).toEqual(end);
    expect(k.hp).toBe(k.maxHp);
  });

  it('hits the first unit in its way and carries it on to the space aimed at, riding in behind', () => {
    const {s, k} = ready({'e-bokh': along(c, dir, 2)});
    charge(s, k, along(c, dir, 4));
    const b = unit(s, 'e-bokh');
    expect(b.hex).toEqual(along(c, dir, 4));
    expect(b.hp).toBe(b.maxHp - k.power);
    expect(k.hex).toEqual(along(c, dir, 3));
  });

  it('hits an ally in its way too', () => {
    const {s, k} = ready({'p-bokh': along(c, dir, 1)});
    charge(s, k, along(c, dir, 3));
    const b = unit(s, 'p-bokh');
    expect(b.hex).toEqual(along(c, dir, 3));
    expect(b.hp).toBe(b.maxHp - k.power);
  });

  it('aimed at the unit’s own space hits it where it stands', () => {
    const {s, k} = ready({'e-bokh': along(c, dir, 3)});
    charge(s, k, along(c, dir, 3));
    expect(unit(s, 'e-bokh').hex).toEqual(along(c, dir, 3));
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp - k.power);
    expect(k.hex).toEqual(along(c, dir, 2));
  });

  it('yurts stop the unit it carries short, and the Cataphract behind it', () => {
    const {s, k} = ready({'e-bokh': along(c, dir, 1)});
    s.tiles[hexKey(along(c, dir, 3))] = 'obstacle';
    // The lane ends at the yurts.
    expect(isTarget(s, k, along(c, dir, 2))).toBe(true);
    expect(isTarget(s, k, along(c, dir, 3))).toBe(false);
    charge(s, k, along(c, dir, 2));
    expect(unit(s, 'e-bokh').hex).toEqual(along(c, dir, 2));
    expect(k.hex).toEqual(along(c, dir, 1));
    // The map's edge stops it the same way.
    const {s: s2, k: k2} = ready({'e-bokh': along(c, dir, 1)});
    const end = lane(mapOf(s2), c, dir).at(-1)!;
    charge(s2, k2, end);
    expect(unit(s2, 'e-bokh').hex).toEqual(end);
    expect(hexDistance(k2.hex!, end)).toBe(1);
  });

  it('a second unit in the way joins the row: both hit once and carried on together', () => {
    const {s, k} = ready({'e-bokh': along(c, dir, 1), 'e-storm': along(c, dir, 3)});
    // Aimed past both.
    expect(isTarget(s, k, along(c, dir, 5))).toBe(true);
    charge(s, k, along(c, dir, 4));
    const b = unit(s, 'e-bokh');
    const st = unit(s, 'e-storm');
    expect(b.hex).toEqual(along(c, dir, 4));
    expect(st.hex).toEqual(along(c, dir, 5));
    expect(b.hp).toBe(b.maxHp - k.power);
    expect(st.hp).toBe(st.maxHp - k.power);
    expect(k.hex).toEqual(along(c, dir, 3));
  });

  it('a row of three is carried as far as there is room, yurts stopping it', () => {
    const {s, k} = ready({
      'e-bokh': along(c, dir, 1),
      'e-storm': along(c, dir, 2),
      'p-bokh': along(c, dir, 3),
    });
    s.tiles[hexKey(along(c, dir, 5))] = 'obstacle';
    charge(s, k, along(c, dir, 4));
    // One space of room before the yurts: the row moves 1, and stops.
    expect(['e-bokh', 'e-storm', 'p-bokh'].map((id) => unit(s, id).hex)).toEqual([
      along(c, dir, 2),
      along(c, dir, 3),
      along(c, dir, 4),
    ]);
    for (const id of ['e-bokh', 'e-storm', 'p-bokh'])
      expect(unit(s, id).hp).toBe(unit(s, id).maxHp - k.power);
    expect(k.hex).toEqual(along(c, dir, 1));
  });

  it('aimed short of the second unit carries the first there, with no collision', () => {
    const {s, k} = ready({'e-bokh': along(c, dir, 1), 'e-storm': along(c, dir, 4)});
    charge(s, k, along(c, dir, 3));
    expect(unit(s, 'e-bokh').hex).toEqual(along(c, dir, 3));
    expect(unit(s, 'e-storm').hp).toBe(unit(s, 'e-storm').maxHp);
  });

  it('a Rooted unit isn’t carried: hit, it stops the Cataphract behind it', () => {
    const {s, k} = ready({'e-bokh': along(c, dir, 2)});
    unit(s, 'e-bokh').passives = ['rooted'];
    // Nothing past it to aim at: the charge would end the same.
    expect(isTarget(s, k, along(c, dir, 3))).toBe(false);
    charge(s, k, along(c, dir, 2));
    expect(unit(s, 'e-bokh').hex).toEqual(along(c, dir, 2));
    expect(unit(s, 'e-bokh').hp).toBe(unit(s, 'e-bokh').maxHp - k.power);
    expect(k.hex).toEqual(along(c, dir, 1));
  });

  it('rides on when the unit in its way falls to the hit', () => {
    const {s, k} = ready({'e-bokh': along(c, dir, 1)});
    unit(s, 'e-bokh').hp = 1;
    charge(s, k, along(c, dir, 3));
    expect(unit(s, 'e-bokh').alive).toBe(false);
    expect(k.hex).toEqual(along(c, dir, 3));
  });

  it('hail ends the ride where it enters, and Immobilized it can’t charge', () => {
    const {s, k} = ready({'e-storm': at(0, 0)});
    s.effects.push({kind: 'hail', hex: along(c, dir, 2), source: 'e-storm', turns: 2});
    charge(s, k, along(c, dir, 4));
    expect(k.hex).toEqual(along(c, dir, 2));
    expect(isImmobilized(k)).toBe(true);
    expect(ABILITIES.charge.targets(s, mapOf(s), k, k.hex!)).toEqual([]);
  });

  it('its plan for the AI matches what it does', () => {
    for (const [placements, n] of [
      [{'e-bokh': along(c, dir, 2)}, 4],
      [{'e-bokh': along(c, dir, 1), 'e-storm': along(c, dir, 3)}, 3],
      [{'e-bokh': along(c, dir, 1), 'e-storm': along(c, dir, 3)}, 5],
      [{'e-bokh': along(c, dir, 1)}, 2],
      [{}, 3],
    ] as const) {
      const {s, k} = ready(placements);
      const plan = ridePlan(s, mapOf(s), k, c, along(c, dir, n));
      const caught = plan.caught.map((u) => u.id).sort();
      charge(s, k, along(c, dir, n));
      expect(k.hex).toEqual(plan.end);
      expect(
        s.units
          .filter((u) => u.hp < u.maxHp)
          .map((u) => u.id)
          .sort()
      ).toEqual(caught);
    }
  });

  it('the AI charges an enemy in line, and counts it a threat down its lanes', () => {
    const {s, k} = ready({'e-bokh': along(c, dir, 3)});
    k.controller = 'ai';
    const turn = chooseAiTurn(s, k);
    expect(turn.action.ability).toBe('charge');
    const b = unit(s, 'e-bokh');
    const threat = threatsTo(s, mapOf(s), b).find((t) => t.enemyId === k.id)!;
    expect(threatDamage([threat], s, b)).toBe(k.power);
  });
});

describe('the Priest', () => {
  const party: HeroId[] = ['priest', 'bokh', 'storm'];
  const c = at(1, 4);
  /** A fight with the Priest at `c` to act, and units where `placements` puts them. */
  const ready = (placements: Record<string, Hex>) => {
    const s = setup({'p-priest': c, ...placements}, party);
    const p = unit(s, 'p-priest');
    p.slot = s.currentSlot;
    s.awaiting = p.id;
    return {s, p};
  };
  const isTarget = (s: FightState, p: Unit, h: Hex) =>
    ABILITIES.blessing.targets(s, mapOf(s), p, p.hex!).some((t) => hexEquals(t.hex!, h));
  const bless = (s: FightState, p: Unit, u: Unit) =>
    applyTurn(s, p, {action: {ability: 'blessing', target: {hex: u.hex!}}});

  it('has speed 2, defence 1, power 3, and is on the roster', () => {
    const {p} = ready({});
    expect([p.speed, p.defence, p.power, p.maxHp]).toEqual([2, 1, 3, healthOf(1)]);
    expect(abilitiesOf(p).map((d) => d.id)).toEqual(['blessing', 'hold']);
    expect(ROSTER).toContain('priest');
  });

  it('Blessing reaches allies within 2, the Priest too, and no enemy', () => {
    const {s, p} = ready({
      'p-bokh': hexNeighbor(hexNeighbor(c, 0), 0),
      'p-storm': hexNeighbor(hexNeighbor(hexNeighbor(c, 3), 3), 3),
      'e-bokh': hexNeighbor(c, 1),
    });
    expect(isTarget(s, p, c)).toBe(true);
    expect(isTarget(s, p, unit(s, 'p-bokh').hex!)).toBe(true);
    expect(isTarget(s, p, unit(s, 'p-storm').hex!)).toBe(false);
    expect(isTarget(s, p, unit(s, 'e-bokh').hex!)).toBe(false);
  });

  it('heals its power; what it can’t heal and 1 more become Shield, at most 3', () => {
    const {s, p} = ready({'p-bokh': hexNeighbor(c, 0)});
    const ally = unit(s, 'p-bokh');
    ally.hp = ally.maxHp - 2;
    bless(s, p, ally);
    expect(ally.hp).toBe(ally.maxHp);
    expect(ally.shield).toBe(2);
    // Unhurt: 3 and 1 more, held to 3.
    p.slot = s.currentSlot;
    s.awaiting = p.id;
    bless(s, p, ally);
    expect(ally.shield).toBe(3);
  });

  it('a badly hurt ally heals the whole power and gains Shield 1', () => {
    const {s, p} = ready({'p-bokh': hexNeighbor(c, 0)});
    const ally = unit(s, 'p-bokh');
    ally.hp = 2;
    bless(s, p, ally);
    expect(ally.hp).toBe(5);
    expect(ally.shield).toBe(1);
  });

  it('the Shield takes hits first, stays past the ally’s turn, and goes when spent', () => {
    const {s, p} = ready({'p-bokh': hexNeighbor(c, 0), 'e-priest': at(5, 4)});
    const ally = unit(s, 'p-bokh');
    bless(s, p, ally);
    expect(ally.shield).toBe(3);
    const ctx: Ctx = {state: s, map: mapOf(s), slot: s.currentSlot};
    startTurnPassives(ctx, ally);
    expect(ally.shield).toBe(3);
    // A hit of 3 from the enemy's Priest, its power.
    hit(ctx, unit(s, 'e-priest'), ally, 'The blow');
    expect(ally.hp).toBe(ally.maxHp);
    expect(ally.shield).toBeUndefined();
    hit(ctx, unit(s, 'e-priest'), ally, 'The blow');
    expect(ally.hp).toBe(ally.maxHp - 3);
  });

  it('a Shield that isn’t his (Rally’s) adds to his and still goes at the ally’s turn', () => {
    const {s, p} = ready({'p-bokh': hexNeighbor(c, 0)});
    const ally = unit(s, 'p-bokh');
    ally.hp = 2;
    ally.shield = 1;
    bless(s, p, ally);
    expect([ally.shield, ally.lastingShield]).toEqual([2, 1]);
    startTurnPassives({state: s, map: mapOf(s), slot: s.currentSlot}, ally);
    expect(ally.shield).toBe(1);
  });

  it('as a Shield (`heal` off), Shields its power in place of healing', () => {
    const {s, p} = ready({'p-bokh': hexNeighbor(c, 0)});
    const blessing = ABILITY.blessing as {heal: boolean};
    onTestFinished(() => {
      blessing.heal = true;
    });
    blessing.heal = false;
    const ally = unit(s, 'p-bokh');
    ally.hp = 2;
    bless(s, p, ally);
    expect(ally.hp).toBe(2);
    expect(ally.shield).toBe(3);
  });

  it('as an aura, Shields every ally within its radius, the Priest too', () => {
    const {s, p} = ready({
      'p-bokh': hexNeighbor(c, 0),
      'p-storm': hexNeighbor(hexNeighbor(c, 3), 3),
    });
    const blessing = ABILITY.blessing as {heal: boolean; shape: string; radius: number};
    const saved = {...blessing};
    onTestFinished(() => {
      Object.assign(blessing, saved);
    });
    Object.assign(blessing, {heal: false, shape: 'aura', radius: 1});
    expect(ABILITIES.blessing.targets(s, mapOf(s), p, c)).toEqual([{hex: c}]);
    applyTurn(s, p, {action: {ability: 'blessing', target: {hex: c}}});
    expect([p.shield, unit(s, 'p-bokh').shield, unit(s, 'p-storm').shield]).toEqual([
      3,
      3,
      undefined,
    ]);
  });

  it('as a Shield, it stays past the ally’s turn until spent, at most 3', () => {
    const {s, p} = ready({'p-bokh': hexNeighbor(c, 0), 'e-priest': at(5, 4)});
    const blessing = ABILITY.blessing as {heal: boolean};
    onTestFinished(() => {
      blessing.heal = true;
    });
    blessing.heal = false;
    const ally = unit(s, 'p-bokh');
    const ctx: Ctx = {state: s, map: mapOf(s), slot: s.currentSlot};
    bless(s, p, ally);
    expect([ally.shield, ally.lastingShield]).toEqual([3, 3]);
    // At most his power: a second Blessing adds nothing.
    p.slot = s.currentSlot;
    s.awaiting = p.id;
    bless(s, p, ally);
    expect(ally.shield).toBe(3);
    startTurnPassives(ctx, ally);
    expect(ally.shield).toBe(3);
    // Rally's Shield on top goes first, and the lasting part with the hit.
    ally.shield = 4;
    hit(ctx, unit(s, 'e-priest'), ally, 'The blow');
    expect([ally.shield, ally.lastingShield]).toEqual([1, 1]);
    startTurnPassives(ctx, ally);
    expect(ally.shield).toBe(1);
    hit(ctx, unit(s, 'e-priest'), ally, 'The blow');
    expect(ally.shield).toBeUndefined();
    expect(ally.lastingShield).toBeUndefined();
    expect(ally.hp).toBe(ally.maxHp - 2);
  });

  it('the AI blesses a hurt ally rather than hold', () => {
    const {s, p} = ready({'p-bokh': hexNeighbor(c, 0), 'e-bokh': at(6, 4)});
    p.controller = 'ai';
    const ally = unit(s, 'p-bokh');
    ally.hp = 3;
    const turn = chooseAiTurn(s, p);
    expect(turn.action.ability).toBe('blessing');
    applyTurn(s, p, turn);
    expect(ally.hp).toBe(6);
  });

  it('a Shield lowers the threat the AI fears', () => {
    const {s, p} = ready({'e-bokh': hexNeighbor(c, 3)});
    unit(s, 'e-bokh').slot = 1;
    p.slot = 50;
    const threats = threatsTo(s, mapOf(s), p);
    const bare = threatDamage(threats, s, p);
    expect(bare).toBeGreaterThan(0);
    p.shield = 1;
    expect(threatDamage(threats, s, p)).toBe(bare - 1);
  });
});

describe('the Vanguard and the Alchemist', () => {
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
  const single = {
    range: 2,
    shape: 'unit',
    fixed: 1,
    heal: 'all',
    empower: 0,
    weaken: 0,
    haste: 0,
    delay: 0,
    self: true,
  } as const;

  // Cleave's shape from `c`: hex directions 2 and 5 run straight up and down the
  // (flat-topped) board; 0 and 1 are the right-hand diagonals, `across` the space
  // straight right beyond them, `diag(n)` the space `n` out along direction 0.
  const c = at(4, 4);
  const up = (n: number) => ({q: c.q, r: c.r - n});
  const diag = (n: number): Hex => (n === 1 ? hexNeighbor(c, 0) : hexNeighbor(diag(n - 1), 0));
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

  it('Cleave hits a line of 2 along a diagonal too, and not the spaces beside it', () => {
    const s = setup(
      {
        'p-modao': c,
        'e-mangudai': diag(1),
        'p-alchemist': diag(2),
        'e-modao': across,
        'p-mangudai': hexNeighbor(c, 1),
      },
      party
    );
    const modao = unit(s, 'p-modao');
    applyTurn(s, modao, {action: {ability: 'cleave', target: {hex: diag(1)}}});
    for (const id of ['e-mangudai', 'p-alchemist'])
      expect(unit(s, id).hp).toBe(unit(s, id).maxHp - modao.power);
    for (const id of ['e-modao', 'p-mangudai']) expect(unit(s, id).hp).toBe(unit(s, id).maxHp);
  });

  it('Cleave is aimed at its line’s first space, even when only the second holds a unit', () => {
    const s = setup({'p-modao': c, 'e-mangudai': diag(2)}, party);
    const modao = unit(s, 'p-modao');
    const targets = ABILITIES.cleave.targets(s, mapOf(s), modao, modao.hex!);
    expect(targets).toEqual([{hex: diag(1)}]);
    applyTurn(s, modao, {action: {ability: 'cleave', target: {hex: diag(1)}}});
    expect(unit(s, 'e-mangudai').hp).toBe(unit(s, 'e-mangudai').maxHp - modao.power);
  });

  it('Cleave no longer reaches the space straight across between two diagonals', () => {
    const s = setup({'p-modao': c, 'e-mangudai': across}, party);
    const modao = unit(s, 'p-modao');
    expect(ABILITIES.cleave.targets(s, mapOf(s), modao, modao.hex!)).toEqual([]);
  });

  it('Cleave is picked by a tap on either space of its line', () => {
    const s = setup({'p-modao': c, 'e-mangudai': up(2), 'e-modao': diag(2)}, party);
    const modao = unit(s, 'p-modao');
    const targets = offeredTargets(s, mapOf(s), modao, ABILITIES.cleave);
    const tap = (h: Hex) => targetAt(mapOf(s), modao.hex!, ABILITIES.cleave, targets, h);
    expect(tap(up(2))).toEqual({hex: up(1)});
    expect(tap(up(1))).toEqual({hex: up(1)});
    expect(tap(up(3))).toBeUndefined();
    for (const h of [diag(1), diag(2)]) expect(tap(h)).toEqual({hex: diag(1)});
    expect(tap(across)).toBeUndefined();
  });

  it('the built Elixir: a unit within 2, the Alchemist too; an ally healed 1 and Empowered 2, an enemy hit for 1 and Weakened 2', () => {
    const s = setup(
      {
        'p-alchemist': at(1, 3),
        'e-mangudai': at(2, 3),
        'p-mangudai': at(3, 3),
        'p-camel': at(1, 4),
        'e-modao': at(8, 6),
      },
      party
    );
    const alchemist = unit(s, 'p-alchemist');
    expect(alchemist.power).toBe(1);
    expect(ABILITIES.elixir.targetsUnit).toBe(true);
    expect(ABILITIES.elixir.range).toBe(2);
    // The ally, the enemy and the Alchemist; not the healthy camel (no power to Empower).
    expect(
      offeredTargets(s, mapOf(s), alchemist, ABILITIES.elixir)
        .map((t) => hexKey(t.hex!))
        .sort()
    ).toEqual([at(1, 3), at(2, 3), at(3, 3)].map(hexKey).sort());
    expect(ABILITIES.elixir.summary(alchemist)).toBe(
      'A unit within 2, yourself too: allies heal 1 and are Empowered 2, enemies are hit, then Weakened 2, until the end of its next turn.'
    );
    // An ally down 2 heals 1 and is Empowered 2, its card not Hastened.
    const a = cloneFight(s);
    const ally = unit(a, 'p-mangudai');
    ally.hp -= 2;
    ally.slot = a.currentSlot + 10;
    applyTurn(a, unit(a, 'p-alchemist'), {action: {ability: 'elixir', target: {hex: at(3, 3)}}});
    expect(ally.hp).toBe(ally.maxHp - 1);
    expect(ally.empower).toBe(2);
    expect(ally.slot).toBe(a.currentSlot + 10);
    // An enemy takes the Alchemist's power and is Weakened 2.
    const e = cloneFight(s);
    applyTurn(e, unit(e, 'p-alchemist'), {action: {ability: 'elixir', target: {hex: at(2, 3)}}});
    expect(unit(e, 'e-mangudai').hp).toBe(unit(e, 'e-mangudai').maxHp - 1);
    expect(unit(e, 'e-mangudai').weaken).toBe(2);
  });

  it('the Alchemist’s Elixir on itself heals it and Empowers it 2 through the end of its next turn', () => {
    const s = setup({'p-alchemist': at(1, 3), 'e-mangudai': at(3, 3), 'e-modao': at(8, 6)}, party);
    s.units.forEach((u) => (u.controller = 'human'));
    const alchemist = unit(s, 'p-alchemist');
    alchemist.slot = 1;
    alchemist.hp -= 2;
    expect(advanceToDecision(s)!.id).toBe('p-alchemist');
    applyTurn(s, alchemist, {action: {ability: 'elixir', target: {hex: at(1, 3)}}});
    expect(alchemist.hp).toBe(alchemist.maxHp - 1);
    // Its own turn ending doesn't take it off.
    expect(alchemist.empower).toBe(2);
    alchemist.slot = s.currentSlot + 1;
    expect(advanceToDecision(s)!.id).toBe('p-alchemist');
    // Its next turn: a hit of its power 1 + Empower 2, then the Empower ends.
    applyTurn(s, alchemist, {action: {ability: 'elixir', target: {hex: at(3, 3)}}});
    expect(unit(s, 'e-mangudai').hp).toBe(unit(s, 'e-mangudai').maxHp - 3);
    expect(alchemist.empower).toBeUndefined();
  });

  /** The burst (2026-10-26, built until later that day). */
  const burst = {
    range: 1,
    shape: 'burst',
    heal: false,
    empower: 0,
    weaken: 0,
    fixed: 0,
    self: false,
    haste: 3,
    delay: 3,
  } as const;

  it('Elixir as a burst (a switch): a space next to the Alchemist, every unit around it but the Alchemist, allies Hastened 3 and enemies Delayed 3', () =>
    withElixir(burst, 1, () => {
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
      // Power 1, which the burst doesn't turn into an Empower or Weaken.
      expect(alchemist.power).toBe(1);
      expect(ABILITIES.elixir.targetsUnit).toBe(false);
      expect(ABILITIES.elixir.radius).toBe(1);
      // Offered: the spaces within 1 whose burst catches a unit.
      const offered = offeredTargets(s, mapOf(s), alchemist, ABILITIES.elixir).map((t) => t.hex!);
      expect(offered.every((h) => hexDistance(h, c) <= 1)).toBe(true);
      expect(offered.some((h) => hexEquals(h, hexNeighbor(c, 0)))).toBe(true);
      const ally = unit(s, 'p-mangudai');
      const enemy = unit(s, 'e-mangudai');
      // Far enough off that a Haste of 3 isn't cut short at the next slot.
      ally.slot = s.currentSlot + 10;
      const enemyBefore = enemy.slot!;
      applyTurn(s, alchemist, {action: {ability: 'elixir', target: {hex: hexNeighbor(c, 0)}}});
      expect(ally.slot).toBe(s.currentSlot + 7);
      expect(enemy.slot).toBeGreaterThanOrEqual(enemyBefore + 3);
      // No Empower or Weaken, no hit, and not the Alchemist itself, though its burst covers it.
      expect(ally.empower).toBeUndefined();
      expect(enemy.weaken).toBeUndefined();
      expect(enemy.hp).toBe(enemy.maxHp);
      expect(s.log.some((l) => l.text === 'Your Alchemist is Hastened 3.')).toBe(false);
      // The camel, out of the burst, takes nothing.
      expect(s.log.some((l) => l.text.startsWith(`${HEROES.camel.name} is`))).toBe(false);
    }));

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

  it('the single-unit Elixir within 3 (switches) heals an ally its power and makes it Unstoppable until its next turn', () =>
    withElixir({...single, range: 3, fixed: 0, self: false, unstoppable: true}, 1, () => {
      const s = setup(
        {
          'p-alchemist': at(1, 3),
          'p-mangudai': at(4, 3),
          'e-mangudai': at(2, 3),
          'e-modao': at(8, 6),
        },
        party
      );
      const alchemist = unit(s, 'p-alchemist');
      // Allies only, the Alchemist not, healthy or not: nothing it does reaches an enemy.
      expect(
        offeredTargets(s, mapOf(s), alchemist, ABILITIES.elixir).map((t) => hexKey(t.hex!))
      ).toEqual([hexKey(at(4, 3))]);
      expect(ABILITIES.elixir.summary(alchemist)).toBe(
        'A unit within 3: allies heal 1 and are Unstoppable until its next turn.'
      );
      const m = unit(s, 'p-mangudai');
      m.hp -= 2;
      m.statuses.push({kind: 'immobilized', hail: 'e-storm'});
      applyTurn(s, alchemist, {action: {ability: 'elixir', target: {hex: at(4, 3)}}});
      expect(m.hp).toBe(m.maxHp - 1);
      expect(m.unstoppable).toBe(true);
      // The hail holding it lets go, and a Push doesn't move it.
      expect(m.statuses).toEqual([]);
      const ctx: Ctx = {state: s, map: mapOf(s), slot: s.currentSlot};
      displace(ctx, m, 0, 2, 'push');
      expect(m.hex).toEqual(at(4, 3));
      // Its next turn starts: no longer Unstoppable.
      startTurnPassives(ctx, m);
      expect(m.unstoppable).toBeUndefined();
    }));

  it('the Elixir swapping speed and health (a switch) lasts through the ally’s next turn', () =>
    withElixir(
      {...single, range: 3, fixed: 0, heal: false, self: false, swap: 'carry', swapUntil: 'end'},
      0,
      () => {
        const s = setup(
          {
            'p-alchemist': at(1, 3),
            'p-modao': at(3, 3),
            'e-mangudai': at(8, 3),
            'e-modao': at(8, 6),
          },
          party
        );
        const v = unit(s, 'p-modao');
        applyTurn(s, unit(s, 'p-alchemist'), {
          action: {ability: 'elixir', target: {hex: at(3, 3)}},
        });
        expect([v.speed, v.hp]).toEqual([8, 1]);
        // Its next turn: its card goes on at speed 8, then its own speed and health come back.
        s.currentSlot = 20;
        s.awaiting = v.id;
        applyTurn(s, v, {action: {ability: 'hold'}});
        expect(v.slot).toBe(20 + actionCost({...v, speed: 8}));
        expect([v.speed, v.hp, v.swapped]).toEqual([1, 8, undefined]);
      }
    ));

  it('a swapped unit’s health comes back whole (`pool`) or less what it lost (`carry`)', () => {
    for (const swap of ['pool', 'carry'] as const)
      withElixir({...single, range: 3, fixed: 0, heal: false, self: false, swap}, 0, () => {
        const s = setup(
          {'p-alchemist': at(1, 3), 'p-mangudai': at(3, 3), 'e-modao': at(8, 6)},
          party
        );
        const ctx: Ctx = {state: s, map: mapOf(s), slot: s.currentSlot};
        const m = unit(s, 'p-mangudai');
        m.hp = 1;
        applyTurn(s, unit(s, 'p-alchemist'), {
          action: {ability: 'elixir', target: {hex: at(3, 3)}},
        });
        expect([m.speed, m.hp]).toEqual([1, 3]);
        applyDamage(ctx, m, 2, 'Hit');
        unswap(ctx, m);
        expect(m.speed).toBe(3);
        // `pool`: its own 1 back; `carry`: 1 less the 2 it lost, so it falls.
        expect(m.alive).toBe(swap === 'pool');
      });
  });

  it('the Elixir making an ally Immortal (a switch) keeps its health until its next turn', () =>
    withElixir(
      {...single, range: 3, fixed: 0, heal: false, self: false, immortal: 'heroes'},
      0,
      () => {
        const s = setup(
          {'p-alchemist': at(1, 3), 'p-mangudai': at(3, 3), 'e-modao': at(8, 6)},
          party
        );
        const ctx: Ctx = {state: s, map: mapOf(s), slot: s.currentSlot};
        const m = unit(s, 'p-mangudai');
        applyTurn(s, unit(s, 'p-alchemist'), {
          action: {ability: 'elixir', target: {hex: at(3, 3)}},
        });
        expect(m.immortal).toBe(true);
        m.shield = 1;
        applyDamage(ctx, m, 9, 'Hit');
        // Its Shield still takes damage; its health none.
        expect([m.shield, m.hp]).toEqual([undefined, m.maxHp]);
        startTurnPassives(ctx, m);
        applyDamage(ctx, m, 1, 'Hit');
        expect(m.hp).toBe(m.maxHp - 1);
      }
    ));

  it('a delayed Immortal (a switch) begins with the ally’s next turn and lasts until the turn after', () =>
    withElixir(
      {
        ...single,
        range: 3,
        fixed: 0,
        heal: false,
        self: false,
        immortal: 'heroes',
        immortalWhen: 'delayed',
      },
      0,
      () => {
        const s = setup(
          {'p-alchemist': at(1, 3), 'p-mangudai': at(3, 3), 'e-modao': at(8, 6)},
          party
        );
        const ctx: Ctx = {state: s, map: mapOf(s), slot: s.currentSlot};
        const m = unit(s, 'p-mangudai');
        applyTurn(s, unit(s, 'p-alchemist'), {
          action: {ability: 'elixir', target: {hex: at(3, 3)}},
        });
        // Not yet: a hit before its turn takes health.
        expect([m.immortal, m.immortalDue]).toEqual([undefined, true]);
        applyDamage(ctx, m, 1, 'Hit');
        expect(m.hp).toBe(m.maxHp - 1);
        // Its turn starts: Immortal through it and until the next.
        startTurnPassives(ctx, m);
        applyDamage(ctx, m, 1, 'Hit');
        expect(m.hp).toBe(m.maxHp - 1);
        startTurnPassives(ctx, m);
        expect(m.immortal).toBeUndefined();
      }
    ));

  it('a card Delayed or Hastened onto a taken slot collides by speed', () => {
    const s = setup({'p-modao': at(1, 3), 'e-mangudai': at(2, 3), 'e-modao': at(8, 6)}, party);
    const ctx = {state: s, map: mapOf(s), slot: s.currentSlot};
    const slow = unit(s, 'p-modao');
    const fast = unit(s, 'e-mangudai');
    const other = unit(s, 'e-modao');
    slow.speed = 1;
    fast.speed = 3;
    other.speed = 3;
    // Delayed, the faster card onto the slower card's slot: it takes it, the
    // slower card moving on.
    slow.slot = 8;
    fast.slot = 5;
    other.slot = 20;
    delay(ctx, fast, 3);
    expect(fast.slot).toBe(8);
    expect(slow.slot).toBe(9);
    // Hastened onto a faster card's slot: it yields.
    other.slot = 4;
    haste(ctx, slow, 5);
    expect(slow.slot).toBe(5);
    expect(other.slot).toBe(4);
    // Hastened onto a slower card's slot: it takes it, the slower card moving on.
    slow.slot = 6;
    haste(ctx, fast, 2);
    expect(fast.slot).toBe(6);
    expect(slow.slot).toBe(7);
  });

  it('Cleave Delays every unit it leaves standing 6 slots, and not the ones it kills', () => {
    const s = setup({'p-modao': at(1, 3), 'e-mangudai': at(2, 3), 'e-modao': at(8, 6)}, party);
    expect(ABILITY.cleave.delay).toBe(6);
    const m = unit(s, 'e-mangudai');
    const before = m.slot!;
    applyTurn(s, unit(s, 'p-modao'), {action: {ability: 'cleave', target: {hex: at(2, 3)}}});
    expect(m.alive).toBe(true);
    expect(m.slot).toBeGreaterThanOrEqual(before + 6);
    expect(s.log.some((l) => l.text.endsWith('is Delayed 6.'))).toBe(true);
    const k = setup({'p-modao': at(1, 3), 'e-mangudai': at(2, 3), 'e-modao': at(8, 6)}, party);
    unit(k, 'e-mangudai').hp = 1;
    applyTurn(k, unit(k, 'p-modao'), {action: {ability: 'cleave', target: {hex: at(2, 3)}}});
    expect(unit(k, 'e-mangudai').alive).toBe(false);
    expect(k.log.some((l) => l.text.includes('Delayed'))).toBe(false);
  });

  it('Elixir as a burst or an aura reaches every unit around its centre', () =>
    withElixir(
      {range: 2, fixed: 1, heal: 'all', empower: 0, weaken: 0, haste: 0, delay: 0, self: true},
      1,
      () => {
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
      }
    ));

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
      Object.assign(elixir, {shape: 'aura', fixed: 0, empower: 2, weaken: 1, haste: 0, delay: 0});
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
    applyTurn(s, m, {action: {ability: 'snapShot', target: {hex: at(4, 3)}}});
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

  it('joins the player’s side at the top-right or bottom-right corner, with high defence and the health it gives', () => {
    const starts = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const s = createFight(seed);
      const camel = unit(s, 'p-camel');
      expect(camel.side).toBe('player');
      expect(camel.controller).toBe('ai');
      expect(camel.hex).toEqual(s.route.camelStart);
      expect(mapOf(s).camelStart).toEqual(s.route.camelStart);
      expect(ROUTES).toContain(s.route);
      starts.add(hexKey(camel.hex!));
      expect(camel.defence).toBe(HEROES.camel.defence);
      expect(camel.hp).toBe((1 + camel.defence) * 2);
      expect(s.units.filter((u) => u.hex && hexKey(u.hex) === hexKey(camel.hex!))).toHaveLength(1);
      expect(s.units.filter((u) => u.side === 'enemy' && u.hero === 'camel')).toHaveLength(0);
      // No one else starts on the exit.
      expect(s.units.some((u) => hexKey(u.hex!) === hexKey(s.route.exits[0]!))).toBe(false);
    }
    expect(starts).toEqual(new Set(['4,-4', '4,0']));
  });

  it('wins by reaching the one exit, the corner opposite its start', () => {
    expect(ROUTES).toEqual([
      {camelStart: {q: 4, r: -4}, exits: [{q: -4, r: 4}]},
      {camelStart: {q: 4, r: 0}, exits: [{q: -4, r: 0}]},
    ]);
    for (const {camelStart, exits} of ROUTES) expect(hexDistance(camelStart, exits[0]!)).toBe(8);
  });

  it('follows a fixed shortest road around the yurts to the exit', () => {
    for (let seed = 0; seed < 20; seed++) {
      const map = mapOf(createFight(seed));
      const road = roadToExit(map, map.camelStart);
      // Every step to a neighbour, never onto yurts, ending on the exit.
      let from = map.camelStart;
      for (const h of road) {
        expect(hexDistance(from, h)).toBe(1);
        expect(blocks(tileAt(map, h))).toBe(false);
        from = h;
      }
      expect(road[road.length - 1]).toEqual(map.exits[0]);
      // Shortest: no walk around the yurts is shorter.
      const dist = new Map([[hexKey(map.camelStart), 0]]);
      const queue = [map.camelStart];
      for (let h; (h = queue.shift()); )
        for (const n of hexNeighbors(h))
          if (onMap(map, n) && !blocks(tileAt(map, n)) && !dist.has(hexKey(n))) {
            dist.set(hexKey(n), dist.get(hexKey(h))! + 1);
            queue.push(n);
          }
      expect(road).toHaveLength(dist.get(hexKey(map.exits[0]!))!);
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
    // Grappler's card is at 95: the camel's turn comes first, with no decision.
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
    const s = setup({'p-camel': {q: -3, r: 3}, 'p-bokh': at(0, 0), 'e-bokh': at(6, 0)});
    unit(s, 'p-camel').slot = 50;
    expect(advanceToDecision(s)).toBeUndefined();
    expect(unit(s, 'p-camel').hex).toEqual({q: -4, r: 4});
    expect(s.phase).toBe('won');
  });

  it('lets an enemy walk through the exit but not end its move there', () => {
    const s = setup({'p-camel': at(2, 4), 'p-bokh': at(0, 0), 'e-bokh': {q: -3, r: 4}});
    const map = mapOf(s);
    const exit = map.exits[0]!;
    expect(exit).toEqual({q: -4, r: 4});
    const e = unit(s, 'e-bokh');
    expect(invalidPath(s, map, e, [exit])).toBe('An enemy can’t end its move on the exit.');
    expect(invalidPath(s, map, e, [exit, {q: -4, r: 3}])).toBeNull();
    const reach = reachableHexes(s, map, e);
    expect(reach.some((r) => hexEquals(r.hex, exit))).toBe(false);
    expect(reach.some((r) => hexEquals(r.hex, {q: -4, r: 3}))).toBe(true);
    // The party may still stand on it.
    const b = unit(s, 'p-bokh');
    b.hex = {q: -3, r: 3};
    expect(reachableHexes(s, map, b).some((r) => hexEquals(r.hex, exit))).toBe(true);
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
    expect(input.action.ability).toBe('snapShot');
    expect(simulate(shot, archer.id, input)!.phase).toBe('lost');
  });
});

describe('previews, the AI and the run', () => {
  it('rejects walking plus an ability without mutating the fight', () => {
    const s = setup({'p-mangudai': at(1, 3), 'e-bokh': at(4, 3)});
    const shot = {ability: 'snapShot' as const, target: {hex: at(4, 3)}};
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
      // The Outrider (3) is faster than Grappler (2): it takes the slot, and the preview says Grappler moves on.
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

  it('the stages: per region, one of its heroes at random and two creatures or outsiders, it, another and one more, its three, then its boss', () => {
    const row = (
      region: string,
      boss: boolean,
      heroes: number,
      outsiders: number,
      creatures: number,
      map: string
    ) => ({
      region,
      boss,
      heroes,
      outsiders,
      creatures,
      map,
    });
    expect(
      STAGES.map((s) => row(s.region, s.boss, s.heroes, s.outsiders, s.creatures, s.map))
    ).toEqual([
      row('steppe', false, 1, 0, 2, 'steppe'),
      row('steppe', false, 2, 0, 1, 'steppe'),
      row('steppe', false, 3, 0, 0, 'steppe'),
      row('steppe', true, 3, 0, 2, 'cave'),
      row('china', false, 1, 2, 0, 'gobi'),
      row('china', false, 2, 1, 0, 'gobi'),
      row('china', false, 3, 0, 0, 'gobi'),
      row('china', true, 3, 0, 0, 'fireMountain'),
      row('persia', false, 1, 2, 0, 'salt'),
      row('persia', false, 2, 1, 0, 'salt'),
      row('persia', false, 3, 0, 0, 'salt'),
      row('persia', true, 3, 0, 0, 'salt'),
    ]);
    // Provisions after a region's stages 1, 2 and 3 (owner, 2026-10-28), a
    // passive after its 4th, the boss's, but the run's last.
    expect(STAGES.map((s) => [s.provision, s.passive])).toEqual([
      ...[1, 2].flatMap(() => [
        [true, false],
        [true, false],
        [true, false],
        [false, true],
      ]),
      [true, false],
      [true, false],
      [true, false],
      [false, false],
    ]);
    expect(REGIONS).toEqual({
      steppe: {heroes: ['mangudai', 'bokh', 'storm'], creature: 'wolf', boss: ['giant']},
      china: {
        heroes: ['youxia', 'modao', 'alchemist'],
        creature: null,
        boss: ['oxKing', 'fanLady'],
      },
      persia: {heroes: ['archer', 'mahout', 'magus'], creature: null, boss: null},
      byzantium: {heroes: ['varangian', 'cataphract', 'priest'], creature: null, boss: null},
    });
    expect(
      Object.values(REGIONS)
        .flatMap((r) => r.heroes)
        .sort()
    ).toEqual([...ROSTER].sort());
    // The Steppe's boss stage: the Cyclops and two wolves, whatever the seed.
    for (let seed = 0; seed < 5; seed++)
      expect(stageEnemies(seed, 3)).toEqual(['giant', 'wolf', 'wolf']);
    // China's: the Bull Demon King and Princess Iron Fan, in the Flaming Mountains.
    for (let seed = 0; seed < 5; seed++)
      expect(stageEnemies(seed, 7)).toEqual(['oxKing', 'fanLady']);
    expect(STAGES[7]!.map).toBe('fireMountain');
    const firsts = new Set<HeroId>();
    const outsiders = new Set<HeroId>();
    for (let seed = 0; seed < 30; seed++) {
      STAGES.forEach(({region, boss, heroes, outsiders: count, creatures}, stage) => {
        // A boss stage with its boss built is checked above.
        if (boss && REGIONS[region].boss) return;
        const own = REGIONS[region].heroes;
        const regions = Object.keys(REGIONS) as (keyof typeof REGIONS)[];
        const before = regions.slice(0, regions.indexOf(region)).flatMap((r) => REGIONS[r].heroes);
        const enemies = stageEnemies(seed, stage);
        expect(enemies).toHaveLength(heroes + count + creatures);
        const picked = enemies.slice(0, heroes);
        expect(new Set(picked).size).toBe(heroes);
        expect(picked.every((h) => own.includes(h))).toBe(true);
        const others = enemies.slice(heroes, heroes + count);
        expect(new Set(others).size).toBe(count);
        expect(others.every((h) => before.includes(h))).toBe(true);
        if (region === 'persia') others.forEach((h) => outsiders.add(h));
        expect(enemies.slice(heroes + count)).toEqual(
          Array<HeroId | null>(creatures).fill(REGIONS[region].creature)
        );
        // No fox spirits, nor any creature, past the Steppe.
        if (region !== 'steppe') expect(creatures).toBe(0);
        // The same seed, the same enemy.
        expect(stageEnemies(seed, stage)).toEqual(enemies);
        // Each stage brings the last one's heroes in its region, and more,
        // and of the last one's outsiders all it brings.
        if (stage > 0 && STAGES[stage - 1]!.region === region) {
          const last = STAGES[stage - 1]!;
          const prev = stageEnemies(seed, stage - 1);
          expect(picked.slice(0, last.heroes)).toEqual(prev.slice(0, last.heroes));
          expect(others).toEqual(prev.slice(last.heroes, last.heroes + count));
        }
      });
      for (const stage of [0, 4, 8]) firsts.add(stageEnemies(seed, stage)[0]!);
    }
    // Random from the first: each region's every hero leads its stages for
    // some seed, but Byzantium's, which has no stages yet.
    expect(firsts.size).toBe(ROSTER.length - REGIONS.byzantium.heroes.length);
    expect(STAGES.some((s) => s.region === 'byzantium')).toBe(false);
    // Persia's outsiders are any of the Steppe's and China's heroes.
    expect(outsiders.size).toBe(6);
  });

  it('winning a stage before the last goes on to the next, with the survivors', () => {
    const run = createRun(5);
    expect(runView(run)).toMatchObject({stage: 0, stages: STAGES.length});
    expect(() => handleRunAction(run, {type: 'next'})).toThrow(RuleError);
    // Win the first stage with the Outrider fallen.
    const won = {...run, fight: cloneFight(run.fight)};
    won.fight.phase = 'won';
    won.fight.units.find((u) => u.hero === 'camel')!.damaged = true;
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

  it('the camel takes the health it ended a stage with to the next; the heroes start at full health', () => {
    const run = createRun(5);
    const won = {...run, fight: cloneFight(run.fight)};
    won.fight.phase = 'won';
    const camel = won.fight.units.find((u) => u.hero === 'camel')!;
    camel.hp = camel.maxHp - 7;
    camel.damaged = true;
    camel.statuses = [{kind: 'immobilized'}];
    const bokh = won.fight.units.find((u) => u.id === 'p-bokh')!;
    bokh.hp = 1;
    const next = handleRunAction(won, {type: 'next', provision: {hero: 'bokh', stat: 'speed'}});
    const taken = (id: string) =>
      next.fight
        .events!.filter((e) => e.kind === 'damage' && e.unitId === id)
        .reduce((sum, e) => sum + (e as {amount: number}).amount, 0);
    const after = next.fight.units.find((u) => u.hero === 'camel')!;
    expect(after.hp + taken(after.id)).toBe(camel.maxHp - 7);
    expect(after.statuses).toEqual([]);
    const fresh = next.fight.units.find((u) => u.id === 'p-bokh')!;
    expect(fresh.hp + taken(fresh.id)).toBe(fresh.maxHp);
  });

  it("the caravanserai after stages 1 and 2: a provision raises one survivor's stat for the rest of the run", () => {
    const win = (r: RunState): RunState => {
      const fight = cloneFight(r.fight);
      fight.phase = 'won';
      // The camel hurt in it: no extra provision (Humphrey unhurt earns one).
      fight.units.find((u) => u.hero === 'camel')!.damaged = true;
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
    // The third earns one too (owner, 2026-10-28); the fourth, the boss's,
    // none but the passive offer (its upgrade isn't built).
    expect(runView(third).provision).toBe(true);
    expect(runView(third).passives).toEqual([]);
    const fourth = handleRunAction(win(third), {
      type: 'next',
      provision: {hero: 'bokh', stat: 'power'},
    });
    expect(fourth.fight.units.find((u) => u.id === 'p-bokh')!.power).toBe(HEROES.bokh.power + 1);
    expect(runView(fourth).provision).toBe(false);
    expect(runView(fourth).passives).toHaveLength(PASSIVE_OFFER);
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

  it('the caravanserai: the provision heals the camel 4, up to its full health, in place of a stat', () => {
    const win = (r: RunState, camelHp?: number): RunState => {
      const fight = cloneFight(r.fight);
      fight.phase = 'won';
      if (camelHp !== undefined) fight.units.find((u) => u.hero === 'camel')!.hp = camelHp;
      // The camel hurt in it: no extra provision (Humphrey unhurt earns one).
      fight.units.find((u) => u.hero === 'camel')!.damaged = true;
      return {...r, fight};
    };
    const camelAfter = (r: RunState) => {
      const camel = r.fight.units.find((u) => u.hero === 'camel')!;
      const taken = r.fight
        .events!.filter((e) => e.kind === 'damage' && e.unitId === camel.id)
        .reduce((sum, e) => sum + (e as {amount: number}).amount, 0);
      return camel.hp + taken;
    };
    const run = createRun(7);
    const maxHp = run.fight.units.find((u) => u.hero === 'camel')!.maxHp;
    const hurt = win(run, maxHp - 7);

    const healed = handleRunAction(hurt, {type: 'next', heal: true});
    expect(RULES.camelHeal).toBe(4);
    expect(camelAfter(healed)).toBe(maxHp - 3);
    // Never past its full health.
    expect(camelAfter(handleRunAction(win(run, maxHp - 2), {type: 'next', heal: true}))).toBe(
      maxHp
    );
    expect(healed.provisions).toEqual([]);
    for (const u of healed.fight.units) expect(u.provisions).toBeUndefined();
    // One or the other, never both; not at full health; nothing but `true`.
    expect(() =>
      handleRunAction(hurt, {type: 'next', heal: true, provision: {hero: 'bokh', stat: 'power'}})
    ).toThrow(RuleError);
    expect(() => handleRunAction(win(run), {type: 'next', heal: true})).toThrow(RuleError);
    expect(() => handleRunAction(hurt, {type: 'next', heal: 'yes'})).toThrow(RuleError);
    // A stat taken instead leaves the camel's wounds.
    const raised = handleRunAction(hurt, {type: 'next', provision: {hero: 'bokh', stat: 'power'}});
    expect(camelAfter(raised)).toBe(maxHp - 7);

    // With every stat of every hero at the most, a hurt camel still earns its heal.
    const maxed = win(run, maxHp - 7);
    for (const u of maxed.fight.units.filter((u) => u.side === 'player' && u.hero !== 'camel'))
      Object.assign(u, {
        speed: 10,
        defence: 10,
        power: 10,
        provisions: {speed: 10, defence: 10, power: 10},
      });
    expect(runView(maxed).provision).toBe(true);
    expect(() => handleRunAction(maxed, {type: 'next'})).toThrow(RuleError);
    expect(camelAfter(handleRunAction(maxed, {type: 'next', heal: true}))).toBe(maxHp - 3);

    // No heal where no provision is earned: between regions.
    expect(() =>
      handleRunAction(win({...run, stage: 3}, maxHp - 7), {type: 'next', heal: true})
    ).toThrow(RuleError);
  });

  it('the caravanserai: Humphrey unhurt all stage earns an extra provision, taken the same way', () => {
    const run = createRun(7);
    const win = (r: RunState, camelHp?: number): RunState => {
      const fight = cloneFight(r.fight);
      fight.phase = 'won';
      if (camelHp !== undefined) fight.units.find((u) => u.hero === 'camel')!.hp = camelHp;
      return {...r, fight};
    };
    const camelOf = (r: RunState) => r.fight.units.find((u) => u.hero === 'camel')!;
    const maxHp = camelOf(run).maxHp;

    // Damage marks it, healed back or not; a Shield taking it whole doesn't.
    const s = cloneFight(run.fight);
    const ctx: Ctx = {state: s, map: mapOf(s), slot: s.currentSlot};
    const camel = s.units.find((u) => u.hero === 'camel')!;
    camel.shield = 2;
    applyDamage(ctx, camel, 2, 'Hit');
    expect(camel.damaged).toBeUndefined();
    applyDamage(ctx, camel, 1, 'Hit');
    heal(ctx, camel, 1);
    expect([camel.hp, camel.damaged]).toEqual([maxHp, true]);
    expect(runView({...run, fight: {...s, phase: 'won'}}).extraProvision).toBe(false);

    // Unhurt: two provisions, each owed.
    const won = win(run);
    expect(runView(won)).toMatchObject({provision: true, extraProvision: true});
    expect(() =>
      handleRunAction(won, {type: 'next', provision: {hero: 'bokh', stat: 'power'}})
    ).toThrow(RuleError);
    const two = handleRunAction(won, {
      type: 'next',
      provision: {hero: 'bokh', stat: 'power'},
      extra: {hero: 'bokh', stat: 'power'},
    });
    expect(two.provisions).toEqual([
      {hero: 'bokh', stat: 'power'},
      {hero: 'bokh', stat: 'power'},
    ]);
    expect(two.fight.units.find((u) => u.id === 'p-bokh')!.power).toBe(HEROES.bokh.power + 2);
    // A new stage starts with the camel unmarked.
    expect(camelOf(two).damaged).toBeFalsy();
    // Malformed, or both a stat and a heal, refused.
    expect(() =>
      handleRunAction(won, {type: 'next', provision: {hero: 'bokh', stat: 'power'}, extra: 'x'})
    ).toThrow(RuleError);
    expect(() =>
      handleRunAction(win(run, maxHp - 7), {
        type: 'next',
        heal: true,
        extra: {hero: 'bokh', stat: 'power'},
        extraHeal: true,
      })
    ).toThrow(RuleError);

    // Both as heals: carried health hurt before this stage, healed twice, up to full.
    const camelAfter = (r: RunState) => {
      const c = camelOf(r);
      const taken = r.fight
        .events!.filter((e) => e.kind === 'damage' && e.unitId === c.id)
        .reduce((sum, e) => sum + (e as {amount: number}).amount, 0);
      return c.hp + taken;
    };
    const hurt = win(run, maxHp - 10);
    expect(camelAfter(handleRunAction(hurt, {type: 'next', heal: true, extraHeal: true}))).toBe(
      maxHp - 2
    );
    // The second heal needs the camel still hurt after the first.
    expect(() =>
      handleRunAction(win(run, maxHp - 3), {type: 'next', heal: true, extraHeal: true})
    ).toThrow(RuleError);

    // The cap counts the first: a stat at 9 takes one, not two.
    const nine = win(run);
    Object.assign(nine.fight.units.find((u) => u.id === 'p-bokh')!, {
      power: RULES.statMax - 1,
      provisions: {power: RULES.statMax - 1},
    });
    expect(() =>
      handleRunAction(nine, {
        type: 'next',
        provision: {hero: 'bokh', stat: 'power'},
        extra: {hero: 'bokh', stat: 'power'},
      })
    ).toThrow(RuleError);

    // Nothing left to raise or heal after the first: the extra is let go.
    const last = win(run);
    for (const u of last.fight.units.filter((u) => u.side === 'player' && u.hero !== 'camel'))
      Object.assign(u, {
        speed: 10,
        defence: 10,
        power: u.hero === 'bokh' ? 9 : 10,
        provisions: {speed: 10, defence: 10, power: 10},
      });
    expect(
      handleRunAction(last, {type: 'next', provision: {hero: 'bokh', stat: 'power'}}).stage
    ).toBe(1);

    // Between regions too, alongside the passive; never after the run's last, nor on a test stage.
    const between = win({...run, stage: 3});
    const view = runView(between);
    expect(view).toMatchObject({provision: false, extraProvision: true});
    const [first, , , fourth] = view.passives;
    const second = view.rivalTakes[first!] === fourth ? view.passives[1]! : fourth!;
    const china = handleRunAction(between, {
      type: 'next',
      passives: [
        {hero: 'bokh', passive: first!},
        {hero: 'bokh', passive: second},
      ],
      extra: {hero: 'storm', stat: 'speed'},
    });
    expect(china.provisions).toEqual([{hero: 'storm', stat: 'speed'}]);
    expect(runView(win({...run, stage: STAGES.length - 1})).extraProvision).toBe(false);
    expect(runView(win(createRun(7, {test: true}))).extraProvision).toBe(false);
  });

  it('the caravanserai between regions: four passives drafted, two to the party and two to the rival’s next heroes, for the rest of the run', () => {
    const win = (r: RunState): RunState => {
      const fight = cloneFight(r.fight);
      fight.phase = 'won';
      // The camel hurt in it: no extra provision (Humphrey unhurt earns one).
      fight.units.find((u) => u.hero === 'camel')!.damaged = true;
      return {...r, fight};
    };
    const at = (r: RunState, stage: number): RunState => ({...r, stage});
    const run = createRun(11);
    expect(runView(run)).toMatchObject({passives: [], rivalTakes: {}});
    // No passive on a stage that offers none.
    expect(() =>
      handleRunAction(win(run), {
        type: 'next',
        provision: {hero: 'bokh', stat: 'power'},
        passives: [{hero: 'bokh', passive: 'rooted'}],
      })
    ).toThrow(RuleError);

    const last = win(at(run, 3));
    const view = runView(last);
    expect(view.provision).toBe(false);
    const offer = view.passives;
    expect(PASSIVE_OFFER).toBe(4);
    expect(offer).toHaveLength(PASSIVE_OFFER);
    expect(new Set(offer).size).toBe(PASSIVE_OFFER);
    expect(offer.every((id) => Object.hasOwn(PASSIVES, id))).toBe(true);
    // The rival drafts for China's first two heroes, in the order they come.
    const rivals = draftRivals(last);
    expect(rivals).toEqual(stageEnemies(run.seed, 5).slice(0, 2));
    expect(REGIONS.china.heroes).toEqual(expect.arrayContaining(rivals));
    // The view tells the page what the rival takes, never who it drafts for.
    expect(Object.keys(view)).not.toContain('rivals');
    expect(JSON.stringify(view.rivalTakes)).not.toMatch(new RegExp(rivals.join('|')));
    for (const id of offer)
      expect(view.rivalTakes[id]).toBe(rivalPicks(offer, rivals, [id])[0]!.passive);
    // The same offer on a reload; another run's differs for some seed.
    expect(runView(last).passives).toEqual(offer);
    const offers = new Set<string>();
    for (let seed = 0; seed < 20; seed++)
      offers.add(runView(win(at(createRun(seed), 3))).passives.join());
    expect(offers.size).toBeGreaterThan(10);

    // The party picks; the rival answers with what fits its first hero best, then takes the last.
    const [a] = offer as [PassiveId];
    const [first] = rivalPicks(offer, rivals, [a]);
    expect(first).toEqual({
      hero: rivals[0],
      passive: draftPick(
        rivals[0]!,
        offer.filter((id) => id !== a)
      ),
    });
    const b = offer.find((id) => id !== a && id !== first!.passive)!;
    const lastOne = offer.find((id) => ![a, b, first!.passive].includes(id))!;
    expect(rivalPicks(offer, rivals, [a, b])).toEqual([first, {hero: rivals[1], passive: lastOne}]);

    const notOffered = (Object.keys(PASSIVES) as PassiveId[]).find((id) => !offer.includes(id))!;
    // Two picks are owed: none, one, a malformed one, one not offered, the
    // rival's, the same twice, three, or one for the camel, refused.
    for (const passives of [
      undefined,
      [{hero: 'bokh', passive: a}],
      [{hero: 'bokh'}, {hero: 'bokh', passive: b}],
      [
        {hero: 'bokh', passive: 'flying'},
        {hero: 'bokh', passive: b},
      ],
      [
        {hero: 'bokh', passive: notOffered},
        {hero: 'bokh', passive: b},
      ],
      [
        {hero: 'bokh', passive: a},
        {hero: 'storm', passive: first!.passive},
      ],
      [
        {hero: 'bokh', passive: a},
        {hero: 'storm', passive: a},
      ],
      [
        {hero: 'bokh', passive: a},
        {hero: 'storm', passive: b},
        {hero: 'mangudai', passive: lastOne},
      ],
      [
        {hero: 'camel', passive: a},
        {hero: 'bokh', passive: b},
      ],
      [
        {hero: 'wolf', passive: a},
        {hero: 'bokh', passive: b},
      ],
    ])
      expect(() => handleRunAction(last, {type: 'next', passives})).toThrow(RuleError);
    // Only to a hero still standing.
    const fallen = win(at(run, 3));
    Object.assign(fallen.fight.units.find((u) => u.id === 'p-storm')!, {alive: false, hex: null});
    expect(() =>
      handleRunAction(fallen, {
        type: 'next',
        passives: [
          {hero: 'storm', passive: a},
          {hero: 'bokh', passive: b},
        ],
      })
    ).toThrow(RuleError);

    const china = handleRunAction(last, {
      type: 'next',
      passives: [
        {hero: 'storm', passive: a},
        {hero: 'bokh', passive: b},
      ],
    });
    expect(china.stage).toBe(4);
    expect(china.passives).toEqual([
      {hero: 'storm', passive: a},
      {hero: 'bokh', passive: b},
    ]);
    expect(china.rivalPassives).toEqual(rivalPicks(offer, rivals, [a, b]));
    expect(china.fight.mapId).toBe('gobi');
    expect(china.fight.units.filter((u) => u.side === 'enemy').map((u) => u.hero)).toEqual(
      stageEnemies(run.seed, 4)
    );
    expect(runView(china)).toMatchObject({provision: true, passives: [], rivalTakes: {}});
    expect(china.fight.units.find((u) => u.id === 'p-storm')!.passives).toEqual([a]);
    expect(china.fight.units.find((u) => u.id === 'p-bokh')!.passives).toEqual([b]);
    // The region's first hero carries the rival's first pick, beside its own.
    const rival = china.fight.units.find((u) => u.side === 'enemy' && u.hero === rivals[0])!;
    expect(rival.passives).toContain(first!.passive);
    // No one else: not the party's other heroes, nor the enemy's outsiders.
    for (const u of china.fight.units.filter(
      (u) => u.id !== 'p-storm' && u.id !== 'p-bokh' && u !== rival
    ))
      expect(u.passives).toEqual(HEROES[u.hero].passives);
    // Carried into the stages after, the second hero's pick with it once it comes.
    const next = handleRunAction(win(china), {
      type: 'next',
      provision: {hero: 'bokh', stat: 'power'},
    });
    expect(next.fight.units.find((u) => u.id === 'p-storm')!.passives).toEqual([a]);
    expect(next.rivalPassives).toEqual(china.rivalPassives);
    const second = next.fight.units.find((u) => u.side === 'enemy' && u.hero === rivals[1])!;
    expect(second.passives).toContain(lastOne);
    // A hero can't take one it already carries; another hero can.
    const again = win(at({...run, passives: [{hero: 'storm', passive: a}]}, 3));
    again.fight.units.find((u) => u.id === 'p-storm')!.passives = [a];
    expect(() =>
      handleRunAction(again, {
        type: 'next',
        passives: [
          {hero: 'storm', passive: a},
          {hero: 'bokh', passive: b},
        ],
      })
    ).toThrow(RuleError);
    expect(
      handleRunAction(again, {
        type: 'next',
        passives: [
          {hero: 'bokh', passive: a},
          {hero: 'storm', passive: b},
        ],
      }).passives
    ).toEqual([
      {hero: 'storm', passive: a},
      {hero: 'bokh', passive: a},
      {hero: 'storm', passive: b},
    ]);
    // The run's last stage offers none, nor does a test stage.
    expect(runView(win(at(run, STAGES.length - 1))).passives).toEqual([]);
    expect(runView(win(createRun(7, {test: true}))).passives).toEqual([]);
  });

  it('the rival drafts the passive that supplements its hero most', () => {
    // The Duelist keeps its tempo; it never takes Steady Gait, which would undo Swift Strike's Haste.
    expect(draftPick('youxia', ['rooted', 'momentum', 'steadyGait'])).toBe('momentum');
    expect(draftPick('youxia', ['steadyGait', 'rebound'])).toBe('rebound');
    // A slow tank holds the line.
    expect(draftPick('modao', ['glassCannon', 'loneWolf', 'bulwark'])).toBe('bulwark');
    // Nothing the Juggernaut's Unstoppable already gives it, nor the Magus's own Steady Gait.
    expect(draftPick('mahout', ['rooted', 'ironWill', 'patient'])).toBe('patient');
    expect(draftPick('magus', ['steadyGait', 'glassCannon'])).toBe('glassCannon');
    // With one left, that one.
    expect(draftPick('archer', ['bulwark'])).toBe('bulwark');
  });

  it('a party must be one to three different heroes of the roster', () => {
    expect(ROSTER).toEqual([
      ...PARTY,
      'modao',
      'alchemist',
      'youxia',
      'magus',
      'mahout',
      'archer',
      'varangian',
      'priest',
      'cataphract',
    ]);
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
    // The Grappler, a tank, ignores the threat when choosing.
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
        action: {ability: 'snapShot', target: {hex: {q: 99, r: 99}}},
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
    applyTurn(s, unit(s, 'p-mangudai'), {action: {ability: 'snapShot', target: {hex: at(4, 3)}}});
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

  it('records a Stomp landing once the Juggernaut has stepped, before its hits', () => {
    const c = at(3, 3);
    const s = setup({'p-mahout': c, 'e-bokh': hexNeighbor(hexNeighbor(c, 0), 0)}, [
      'mahout',
      'bokh',
      'storm',
    ]);
    s.tiles = Object.fromEntries(
      Object.entries(s.tiles).map(([k, t]) => [k, t === 'obstacle' ? 'sand' : t])
    );
    const e = unit(s, 'p-mahout');
    e.slot = s.currentSlot;
    s.awaiting = e.id;
    s.events = [];
    const to = hexNeighbor(c, 0);
    applyTurn(s, e, {action: {ability: 'stomp', target: {hex: to}}});
    const kinds = s.events.map((ev) => ev.kind);
    expect(kinds.slice(0, 5)).toEqual(['action', 'step', 'land', 'damage', 'step']);
    expect(s.events[2]).toMatchObject({unitId: 'p-mahout', ability: 'stomp', target: to});
    expect(s.events[2]!.after.units.find((u) => u.id === 'p-mahout')!.hex).toEqual(to);
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
