/**
 * The test stage: one fight set up by hand in test-stage.json (explained in
 * test-stage.md), for play-testing a line-up, stats or a kit the run's
 * stages don't bring. Each unit names its hero and may give its own speed,
 * defence, power, abilities and passives (`Unit.loadout`) and its starting
 * space;
 * the camel can be left out. The file is checked when the stage starts,
 * and a mistake is reported on the start menu.
 */
import {hexEquals, hexKey} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import config from '../../test-stage.json';
import {ABILITIES} from './abilities';
import {abilityCount, canMove, faceStart} from './board';
import {CAMEL, HEROES, RULES} from './config';
import {RuleError, makeUnit, mapOf, seededRandom} from './fight';
import {PASSIVES} from './passives';
import {log} from './resolve';
import {
  MAPS,
  ROUTES,
  STEPPE,
  blocks,
  fixedTiles,
  mapById,
  onMap,
  randomTiles,
  spaceAt,
} from './map';
import type {MapData, Tile} from './map';
import {placeStartingCards, shuffled} from './track';
import type {AbilityId, FightState, HeroId, Loadout, PassiveId, Unit} from './types';

/** The committed test-stage.json. */
export const TEST_STAGE: unknown = config;

/** One unit of the test stage: its hero, the stats and kit it differs in, and where it starts. */
interface UnitSetup {
  hero: HeroId;
  loadout?: Loadout;
  at?: Hex;
}

interface TestSetup {
  /** Scatters the yurts and the units without an `at`; null: the run's own seed. */
  seed: number | null;
  /** The map's id (MAPS in map.ts): its look, and its name for the yurts. */
  map: string;
  yurts: 'random' | 'mountains' | 'none' | 'map' | Hex[];
  /** Null: no camel, so the fight is won or lost only by beating a side. */
  camel: UnitSetup | null;
  player: UnitSetup[];
  enemy: UnitSetup[];
}

/** The most units a side may bring (those without an "at" must also fit its starting columns). */
const MAX_SIDE = 9;
/** Bounds on a stat, far past the game's own (0 to 9), to catch a typo rather than a test. */
const MAX_STAT = 30;

const fail = (message: string): never => {
  throw new RuleError(`test-stage.json: ${message}`);
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function onlyKeys(where: string, v: Record<string, unknown>, keys: string[]): void {
  for (const k of Object.keys(v))
    if (!keys.includes(k) && !k.startsWith('$'))
      fail(`${where} has an unknown field "${k}" (expected ${keys.join(', ')}).`);
}

/**
 * A space as the file gives it, `{col, row}`: a column 0 to 8, left to
 * right, and a row counted down from that column's top, from 0 (`spaceAt`).
 */
function parseSpace(where: string, v: unknown): Hex {
  if (!isObject(v) || !Number.isInteger(v.col) || !Number.isInteger(v.row))
    fail(`${where} must be a space like {"col": 0, "row": 3}.`);
  const {col, row} = v as {col: number; row: number};
  onlyKeys(where, v as Record<string, unknown>, ['col', 'row']);
  const hex = spaceAt(col, row);
  if (!onMap(STEPPE, hex)) fail(`${where} {"col": ${col}, "row": ${row}} is off the board.`);
  return hex;
}

function parseUnit(where: string, v: unknown, camel = false): UnitSetup {
  if (!isObject(v)) fail(`${where} must be an object like {"hero": "wolf"}.`);
  const raw = v as Record<string, unknown>;
  const fields = ['speed', 'defence', 'power', 'abilities', 'passives', 'at'];
  onlyKeys(where, raw, camel ? fields.filter((f) => f !== 'abilities') : ['hero', ...fields]);
  let hero: HeroId = CAMEL;
  if (!camel) {
    const heroes = Object.keys(HEROES).filter((h) => h !== CAMEL);
    if (typeof raw.hero !== 'string' || !heroes.includes(raw.hero))
      fail(`${where}.hero must be one of ${heroes.join(', ')}.`);
    hero = raw.hero as HeroId;
  }
  const loadout: Loadout = {};
  for (const stat of ['speed', 'defence', 'power'] as const) {
    const n = raw[stat];
    if (n === undefined) continue;
    if (!Number.isInteger(n) || (n as number) < 0 || (n as number) > MAX_STAT)
      fail(`${where}.${stat} must be a whole number from 0 to ${MAX_STAT}.`);
    loadout[stat] = n as number;
  }
  if (raw.abilities !== undefined) {
    // The borrowed fan is picked up in the fight, never a kit's.
    const ids = Object.keys(ABILITIES).filter((a) => a !== 'quench');
    if (
      !Array.isArray(raw.abilities) ||
      raw.abilities.some((a) => typeof a !== 'string' || !ids.includes(a))
    )
      fail(`${where}.abilities must be a list of ${ids.join(', ')}.`);
    if (abilityCount([...new Set(raw.abilities as AbilityId[])]) > RULES.maxAbilities)
      fail(`${where}.abilities can have at most ${RULES.maxAbilities}, besides Hold.`);
    // Hold is always there: a move-only turn is a move and Hold.
    loadout.abilities = [...new Set([...(raw.abilities as AbilityId[]), 'hold' as const])];
  }
  if (raw.passives !== undefined) {
    const ids = Object.keys(PASSIVES);
    if (
      !Array.isArray(raw.passives) ||
      raw.passives.some((a) => typeof a !== 'string' || !ids.includes(a))
    )
      fail(`${where}.passives must be a list of ${ids.join(', ')}.`);
    loadout.passives = [...new Set(raw.passives as PassiveId[])];
  }
  return {
    hero,
    ...(Object.keys(loadout).length ? {loadout} : {}),
    ...(raw.at !== undefined ? {at: parseSpace(`${where}.at`, raw.at)} : {}),
  };
}

function parseSide(where: string, v: unknown): UnitSetup[] {
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_SIDE)
    fail(`${where} must be a list of 1 to ${MAX_SIDE} units.`);
  return (v as unknown[]).map((u, i) => parseUnit(`${where}[${i}]`, u));
}

/** Checks the test stage's setup; a mistake throws a RuleError naming it. */
export function parseTestStage(raw: unknown): TestSetup {
  if (!isObject(raw)) fail('must be an object.');
  const v = raw as Record<string, unknown>;
  onlyKeys('The file', v, ['seed', 'map', 'yurts', 'camel', 'player', 'enemy']);
  const map = v.map ?? STEPPE.id;
  if (typeof map !== 'string' || !MAPS[map])
    fail(
      `map must be one of ${Object.keys(MAPS)
        .map((id) => `"${id}"`)
        .join(', ')}.`
    );
  const seed = v.seed ?? null;
  if (seed !== null && (!Number.isInteger(seed) || (seed as number) < 0))
    fail('seed must be a whole number, or null for a new one each time.');
  let yurts: TestSetup['yurts'] = 'random';
  if (Array.isArray(v.yurts)) yurts = v.yurts.map((h, i) => parseSpace(`yurts[${i}]`, h));
  else if (v.yurts !== undefined) {
    if (!['random', 'mountains', 'none', 'map'].includes(v.yurts as string))
      fail('yurts must be "random", "mountains", "none", "map" or a list of spaces.');
    yurts = v.yurts as 'random' | 'mountains' | 'none' | 'map';
  }
  const camel =
    v.camel === false || v.camel === null ? null : parseUnit('camel', v.camel ?? {}, true);
  const setup: TestSetup = {
    seed: seed as number | null,
    map: map as string,
    yurts,
    camel,
    player: parseSide('player', v.player),
    enemy: parseSide('enemy', v.enemy),
  };
  const taken = new Map<string, string>();
  const claim = (where: string, h: Hex) => {
    const other = taken.get(hexKey(h));
    if (other) fail(`${where} starts on the same space as ${other}.`);
    taken.set(hexKey(h), where);
  };
  if (Array.isArray(yurts)) yurts.forEach((h, i) => claim(`yurts[${i}]`, h));
  if (camel?.at) claim('camel', camel.at);
  for (const side of ['player', 'enemy'] as const)
    setup[side].forEach((u, i) => u.at && claim(`${side}[${i}]`, u.at));
  return setup;
}

/**
 * The test stage's fight, already under way: the units on their spaces,
 * the rest scattered over their side's two starting columns (the player's right,
 * the enemy's left), off the camel's road's ends, the yurts as set; with random yurts, scattered again
 * until no unit starts boxed in, as in a stage's fight (`createFight`).
 */
export function createTestFight(runSeed: number, raw: unknown = TEST_STAGE): FightState {
  const setup = parseTestStage(raw);
  const random = seededRandom(setup.seed ?? runSeed);
  const map = mapById(setup.map);
  const copies = (list: UnitSetup[], i: number) =>
    list.slice(0, i).filter((u) => u.hero === list[i]!.hero).length;
  // Each unit with its setup, in the order a stage's fight lists them: the party, the camel, the enemy.
  const placed: [Unit, UnitSetup][] = [
    ...setup.player.map((u, i): [Unit, UnitSetup] => [
      makeUnit('player', i, u.hero, copies(setup.player, i), u.loadout),
      u,
    ]),
    ...(setup.camel
      ? [
          [makeUnit('player', setup.player.length, CAMEL, 0, setup.camel.loadout), setup.camel] as [
            Unit,
            UnitSetup,
          ],
        ]
      : []),
    ...setup.enemy.map((u, i): [Unit, UnitSetup] => [
      makeUnit('enemy', i, u.hero, copies(setup.enemy, i), u.loadout),
      u,
    ]),
  ];
  const units = placed.map(([u]) => u);
  // The camel's road, at random (`ROUTES`), off any space a unit is set on.
  const setOn = (h: Hex) => placed.some(([u, {at}]) => at && hexEquals(at, h) && u.hero !== CAMEL);
  const roads = ROUTES.filter((r) => !setOn(r.camelStart));
  const route = roads[Math.floor(random() * roads.length)] ?? ROUTES[0]!;
  const state: FightState = {
    mapId: map.id,
    tiles: {},
    route,
    mode: 'solo',
    phase: 'fight',
    currentSlot: 0,
    units,
    effects: [],
    log: [],
    awaiting: null,
  };
  const camel = units.find((u) => u.hero === CAMEL);
  for (const [u, {at}] of placed) u.hex = at ?? (u === camel ? route.camelStart : null);
  if (camel && !setup.camel?.at && setOn(route.camelStart))
    fail('A unit starts on both of the camel\'s starting corners: give the camel an "at".');
  const fixed = units.filter((u) => u.hex).map((u) => u.hex!);
  // The Salt Flats' dome can't be cleared: it is drawn as one.
  const dome = fixedTiles(map);
  for (const h of fixed)
    if (dome[hexKey(h)]) fail(`No unit can start inside the salt dome (${hexKey(h)}).`);

  for (let attempt = 0; ; attempt++) {
    state.tiles = tilesFor(setup.yurts, random, {...map, ...route});
    // A placed unit's space is never a yurt.
    for (const h of fixed) delete state.tiles[hexKey(h)];
    for (const side of ['player', 'enemy'] as const) {
      const loose = placed.filter(([u, {at}]) => u.side === side && !at && u !== camel);
      const free = map.startColumns[side].filter(
        (h) =>
          ![...fixed, route.camelStart, ...route.exits].some((f) => hexEquals(f, h)) &&
          !blocks(state.tiles[hexKey(h)])
      );
      if (loose.length > free.length)
        fail(
          `${side} has more units without an "at" than free spaces on its starting columns (${free.length}): give some an "at".`
        );
      const hexes = shuffled(free, random);
      loose.forEach(([u], i) => (u.hex = hexes[i]!));
    }
    // Only random yurts can be scattered again; a layout set by hand stays as it is.
    if ((setup.yurts !== 'random' && setup.yurts !== 'mountains') || attempt >= 50) break;
    if (units.every((u) => canMove(state, mapOf(state), u))) break;
  }
  faceStart(state, mapOf(state));
  placeStartingCards(state);
  log({state, map: mapOf(state), slot: 0}, 'The test stage begins.');
  return state;
}

function tilesFor(
  yurts: TestSetup['yurts'],
  random: () => number,
  map: MapData
): Record<string, Tile> {
  if (yurts === 'random' || yurts === 'mountains')
    return randomTiles(random, yurts === 'mountains', map);
  // The Salt Flats' dome stands whatever the yurts.
  if (yurts === 'none') return fixedTiles(map);
  if (yurts === 'map') return {...map.tiles};
  return {
    ...fixedTiles(map),
    ...Object.fromEntries(yurts.map((h) => [hexKey(h), 'obstacle' as const])),
  };
}
