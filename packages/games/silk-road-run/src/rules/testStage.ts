/**
 * The test stage: one fight set up by hand in test-stage.json (explained in
 * test-stage.md), for play-testing a line-up, stats or a kit the run's
 * stages don't bring. Each unit names its hero and may give its own speed,
 * defence, power and abilities (`Unit.loadout`) and its starting space;
 * the camel can be left out. The file is checked when the stage starts,
 * and a mistake is reported on the start menu.
 */
import {hexEquals, hexKey, offsetToHex} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import config from '../../test-stage.json';
import {ABILITIES} from './abilities';
import {canMove} from './board';
import {CAMEL, HEROES} from './config';
import {RuleError, makeUnit, mapOf, seededRandom} from './fight';
import {log} from './resolve';
import {SALT_FLATS, onMap, randomTiles} from './map';
import type {Tile} from './map';
import {placeStartingCards, shuffled} from './track';
import type {AbilityId, FightState, HeroId, Loadout, Unit} from './types';

/** The committed test-stage.json. */
export const TEST_STAGE: unknown = config;

/** One unit of the test stage: its hero, the stats and kit it differs in, and where it starts. */
interface UnitSetup {
  hero: HeroId;
  loadout?: Loadout;
  at?: Hex;
}

interface TestSetup {
  /** Scatters the ruins and the units without an `at`; null: the run's own seed. */
  seed: number | null;
  ruins: 'random' | 'none' | 'map' | Hex[];
  /** Null: no camel, so the fight is won or lost only by beating a side. */
  camel: UnitSetup | null;
  player: UnitSetup[];
  enemy: UnitSetup[];
}

/** The most units a side may bring: its starting column's 9 hexes. */
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

/** A space as the file gives it, `{col, row}` (rows −1 at the top to 7 at the bottom), on the board. */
function parseSpace(where: string, v: unknown): Hex {
  if (!isObject(v) || !Number.isInteger(v.col) || !Number.isInteger(v.row))
    fail(`${where} must be a space like {"col": 0, "row": 3}.`);
  const {col, row} = v as {col: number; row: number};
  onlyKeys(where, v as Record<string, unknown>, ['col', 'row']);
  const hex = offsetToHex({col, row});
  if (!onMap(SALT_FLATS, hex)) fail(`${where} {"col": ${col}, "row": ${row}} is off the board.`);
  return hex;
}

function parseUnit(where: string, v: unknown, camel = false): UnitSetup {
  if (!isObject(v)) fail(`${where} must be an object like {"hero": "wolf"}.`);
  const raw = v as Record<string, unknown>;
  const fields = ['speed', 'defence', 'power', 'abilities', 'at'];
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
    const ids = Object.keys(ABILITIES);
    if (
      !Array.isArray(raw.abilities) ||
      raw.abilities.some((a) => typeof a !== 'string' || !ids.includes(a))
    )
      fail(`${where}.abilities must be a list of ${ids.join(', ')}.`);
    // Hold is always there: a move-only turn is a move and Hold.
    loadout.abilities = [...new Set([...(raw.abilities as AbilityId[]), 'hold' as const])];
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
  onlyKeys('The file', v, ['seed', 'ruins', 'camel', 'player', 'enemy']);
  const seed = v.seed ?? null;
  if (seed !== null && (!Number.isInteger(seed) || (seed as number) < 0))
    fail('seed must be a whole number, or null for a new one each time.');
  let ruins: TestSetup['ruins'] = 'random';
  if (Array.isArray(v.ruins)) ruins = v.ruins.map((h, i) => parseSpace(`ruins[${i}]`, h));
  else if (v.ruins !== undefined) {
    if (v.ruins !== 'random' && v.ruins !== 'none' && v.ruins !== 'map')
      fail('ruins must be "random", "none", "map" or a list of spaces.');
    ruins = v.ruins as 'random' | 'none' | 'map';
  }
  const camel =
    v.camel === false || v.camel === null ? null : parseUnit('camel', v.camel ?? {}, true);
  const setup: TestSetup = {
    seed: seed as number | null,
    ruins,
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
  if (Array.isArray(ruins)) ruins.forEach((h, i) => claim(`ruins[${i}]`, h));
  if (camel) claim('camel', camel.at ?? SALT_FLATS.camelStart);
  for (const side of ['player', 'enemy'] as const)
    setup[side].forEach((u, i) => u.at && claim(`${side}[${i}]`, u.at));
  return setup;
}

/**
 * The test stage's fight, already under way: the units on their spaces,
 * the rest scattered on their side's starting column (the player's left,
 * the enemy's right), the ruins as set; with random ruins, scattered again
 * until no unit starts boxed in, as in a stage's fight (`createFight`).
 */
export function createTestFight(runSeed: number, raw: unknown = TEST_STAGE): FightState {
  const setup = parseTestStage(raw);
  const random = seededRandom(setup.seed ?? runSeed);
  const map = SALT_FLATS;
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
  const state: FightState = {
    mapId: map.id,
    tiles: {},
    mode: 'solo',
    phase: 'fight',
    currentSlot: 0,
    units,
    effects: [],
    log: [],
    awaiting: null,
  };
  const camel = units.find((u) => u.hero === CAMEL);
  for (const [u, {at}] of placed) u.hex = at ?? (u === camel ? map.camelStart : null);
  const fixed = units.filter((u) => u.hex).map((u) => u.hex!);

  for (let attempt = 0; ; attempt++) {
    state.tiles = tilesFor(setup.ruins, random);
    // A placed unit's space is never a ruin.
    for (const h of fixed) delete state.tiles[hexKey(h)];
    for (const side of ['player', 'enemy'] as const) {
      const loose = placed.filter(([u, {at}]) => u.side === side && !at && u !== camel);
      const free = map.startColumns[side].filter(
        (h) => !fixed.some((f) => hexEquals(f, h)) && state.tiles[hexKey(h)] !== 'obstacle'
      );
      if (loose.length > free.length)
        fail(
          `${side} has more units without an "at" than free spaces on its starting column (${free.length}): give some an "at".`
        );
      const hexes = shuffled(free, random);
      loose.forEach(([u], i) => (u.hex = hexes[i]!));
    }
    // Only random ruins can be scattered again; a layout set by hand stays as it is.
    if (setup.ruins !== 'random' || attempt >= 50) break;
    if (units.every((u) => canMove(state, mapOf(state), u))) break;
  }
  placeStartingCards(state);
  log({state, map: mapOf(state), slot: 0}, 'The test stage begins.');
  return state;
}

function tilesFor(ruins: TestSetup['ruins'], random: () => number): Record<string, Tile> {
  if (ruins === 'random') return randomTiles(random);
  if (ruins === 'none') return {};
  if (ruins === 'map') return {...SALT_FLATS.tiles};
  return Object.fromEntries(ruins.map((h) => [hexKey(h), 'obstacle' as const]));
}
