import {describe, expect, it} from 'vitest';
import {hexKey} from '@canvas/engine/server';
import {DOME, spaceAt, spaceOf} from './map';
import {abilitiesOf, unusableReason, ABILITIES} from './abilities';
import {HEROES} from './config';
import {RuleError, refreshStats} from './fight';
import {createRun, handleRunAction, runStatus, runView} from './run';
import {createTestFight, parseTestStage} from './testStage';
import {aimSlot, actionCost} from './track';
import {movementCap} from './board';

const space = (col: number, row: number) => ({col, row});

describe('the test stage', () => {
  it('accepts the committed test-stage.json', () => {
    expect(() => createTestFight(1)).not.toThrow();
    expect(() => createRun(1, {test: true})).not.toThrow();
  });

  it('fights on the map named, the Steppe’s if none, and says which maps there are', () => {
    const units = {player: [{hero: 'bokh'}], enemy: [{hero: 'wolf'}]};
    expect(createTestFight(1, units).mapId).toBe('steppe');
    const gobi = createTestFight(1, {...units, map: 'gobi', yurts: 'map'});
    expect(gobi.mapId).toBe('gobi');
    expect(Object.values(gobi.tiles).filter((t) => t === 'obstacle')).toHaveLength(4);
    expect(() => parseTestStage({...units, map: 'atlantis'})).toThrow(
      'map must be one of "steppe", "gobi", "flaming", "fireMountain", "cave", "palace", "salt", "tuff".'
    );
  });

  it('keeps the Salt Flats’ dome whatever the yurts, and starts no unit inside it', () => {
    const units = {player: [{hero: 'bokh'}], enemy: [{hero: 'wolf'}]};
    for (const yurts of ['none', 'map', [{col: 1, row: 1}]] as const) {
      const s = createTestFight(1, {...units, map: 'salt', yurts});
      for (const h of DOME) expect(s.tiles[hexKey(h)]).toBe('mountain');
    }
    expect(() =>
      createTestFight(1, {...units, map: 'salt', player: [{hero: 'bokh', at: {col: 4, row: 4}}]})
    ).toThrow('No unit can start inside the salt dome');
  });

  it('gives every Duelist the lunge, walk and streak "swiftStrike" sets', () => {
    const raw = {
      player: [{hero: 'youxia'}],
      enemy: [{hero: 'youxia'}, {hero: 'wolf'}],
      swiftStrike: {lunge: 2, walk: 2, streak: [2, 3, 4]},
    };
    const s = createTestFight(1, raw);
    for (const u of s.units.filter((x) => x.hero === 'youxia')) {
      expect([u.lunge, u.moveCap, u.streakHaste]).toEqual([2, 2, [2, 3, 4]]);
      expect(movementCap(u)).toBe(2);
      expect(ABILITIES.swiftStrike.summary(u)).toBe(
        'Lunge up to 2 straight and strike the first unit. When it hits, its card is Hastened 2, then 3, then 4 on turns striking running.'
      );
    }
    expect(s.units.find((u) => u.hero === 'wolf')!.lunge).toBeUndefined();
    // Left out, Swift Strike is as built.
    const built = createTestFight(1, {player: [{hero: 'youxia'}], enemy: [{hero: 'wolf'}]});
    expect(movementCap(built.units.find((u) => u.hero === 'youxia')!)).toBe(3);
    expect(() => parseTestStage({...raw, swiftStrike: {lunge: -1}})).toThrow(/lunge/);
    expect(() => parseTestStage({...raw, swiftStrike: {streak: 3}})).toThrow(/streak/);
    expect(() => parseTestStage({...raw, swiftStrike: {reach: 2}})).toThrow(/unknown field/);
  });

  it('plays with Wait when "wait" says so: true for two thirds of a turn, or a share', () => {
    const units = {player: [{hero: 'bokh'}], enemy: [{hero: 'wolf'}]};
    expect(createTestFight(1, units).waitShare).toBeUndefined();
    expect(createTestFight(1, {...units, wait: false}).waitShare).toBeUndefined();
    const on = createTestFight(1, {...units, wait: true});
    expect(on.waitShare).toBeCloseTo(2 / 3);
    const bokh = on.units.find((u) => u.hero === 'bokh')!;
    // The Grappler, speed 2: a Hold goes 6 slots on, a turn that does something 9.
    expect(aimSlot(on, bokh, 0, 'hold', true)).toBe(6);
    expect(aimSlot(on, bokh, 0, 'hold')).toBe(actionCost(bokh));
    expect(createTestFight(1, {...units, wait: 0.5}).waitShare).toBe(0.5);
    for (const wait of [0, 1.5, 'yes'])
      expect(() => parseTestStage({...units, wait})).toThrow('wait must be true');
  });

  it('brings the units listed, with their own stats and abilities and Hold always', () => {
    const s = createTestFight(7, {
      yurts: 'none',
      player: [{hero: 'mangudai', speed: 5, power: 3, abilities: ['skirmish']}, {hero: 'wolf'}],
      enemy: [{hero: 'storm', defence: 0, abilities: ['sunlight', 'bite']}, {hero: 'storm'}],
    });
    expect(s.units.map((u) => u.id)).toEqual([
      'p-mangudai',
      'p-wolf',
      'p-camel',
      'e-storm',
      'e-storm-2',
    ]);
    const [archer, wolf, , caller, caller2] = s.units;
    expect(archer).toMatchObject({speed: 5, power: 3, defence: HEROES.mangudai.defence});
    expect(abilitiesOf(archer!).map((a) => a.id)).toEqual(['skirmish', 'hold']);
    expect(unusableReason(archer!, ABILITIES.snapShot)).not.toBeNull();
    expect(wolf!.controller).toBe('human');
    expect(caller).toMatchObject({defence: 0, maxHp: 2, hp: 2});
    expect(abilitiesOf(caller!).map((a) => a.id)).toEqual(['sunlight', 'bite', 'hold']);
    expect(abilitiesOf(caller2!).map((a) => a.id)).toEqual(HEROES.storm.abilities);
    expect(Object.keys(s.tiles)).toEqual([]);
  });

  it('keeps its loadouts when a saved fight is refreshed with config.ts', () => {
    const s = createTestFight(1, {player: [{hero: 'bokh', power: 4}], enemy: [{hero: 'wolf'}]});
    refreshStats(s);
    expect(s.units[0]).toMatchObject({power: 4, speed: HEROES.bokh.speed});
  });

  it('places units at their spaces, the camel too, or leaves the camel out', () => {
    const s = createTestFight(3, {
      yurts: [space(3, 3)],
      camel: {at: space(2, 0), defence: 1},
      player: [{hero: 'bokh', at: space(3, 2)}],
      enemy: [{hero: 'wolf', at: space(3, 4)}, {hero: 'wolf'}],
    });
    const at = (id: string) => spaceOf(s.units.find((u) => u.id === id)!.hex!);
    expect(at('p-bokh')).toEqual(space(3, 2));
    expect(at('p-camel')).toEqual(space(2, 0));
    expect(s.units.find((u) => u.id === 'p-camel')!.maxHp).toBe(4);
    expect(at('e-wolf')).toEqual(space(3, 4));
    expect(s.tiles).toEqual({[hexKey(spaceAt(3, 3))]: 'obstacle'});

    const none = createTestFight(3, {
      camel: false,
      player: [{hero: 'bokh'}],
      enemy: [{hero: 'wolf'}],
    });
    expect(none.units.some((u) => u.hero === 'camel')).toBe(false);
  });

  it('scatters the same way for the same seed, whatever the run', () => {
    const setup = {seed: 42, player: [{hero: 'bokh'}], enemy: [{hero: 'wolf'}]};
    expect(createTestFight(1, setup)).toEqual(createTestFight(2, setup));
  });

  it('always lays a range of mountains with "mountains", as a run\'s first stages do', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createTestFight(seed, {
        yurts: 'mountains',
        player: [{hero: 'bokh'}],
        enemy: [{hero: 'wolf'}],
      });
      expect(Object.values(s.tiles)).toContain('mountain');
    }
  });

  it('names what is wrong with the file', () => {
    const bad = (raw: unknown) => {
      try {
        parseTestStage(raw);
      } catch (e) {
        expect(e).toBeInstanceOf(RuleError);
        return (e as Error).message;
      }
      throw new Error('accepted');
    };
    const ok = {player: [{hero: 'bokh'}], enemy: [{hero: 'wolf'}]};
    expect(bad({...ok, player: []})).toMatch(/player must be a list of 1 to 9/);
    expect(bad({...ok, enemy: [{hero: 'dragon'}]})).toMatch(/enemy\[0\]\.hero must be one of/);
    expect(bad({...ok, enemy: [{hero: 'camel'}]})).toMatch(/enemy\[0\]\.hero/);
    expect(bad({...ok, player: [{hero: 'bokh', powr: 2}]})).toMatch(/unknown field "powr"/);
    expect(bad({...ok, player: [{hero: 'bokh', speed: -1}]})).toMatch(/speed must be a whole/);
    expect(bad({...ok, player: [{hero: 'bokh', abilities: ['fireball']}]})).toMatch(
      /abilities must be a list of/
    );
    // At most two besides Hold (owner, 2026-10-25).
    expect(bad({...ok, player: [{hero: 'bokh', abilities: ['grapple', 'haul', 'shove']}]})).toMatch(
      /abilities can have at most 2/
    );
    expect(
      parseTestStage({
        ...ok,
        player: [{hero: 'bokh', abilities: ['grapple', 'haul', 'hold']}],
      }).player[0]!.loadout!.abilities
    ).toEqual(['grapple', 'haul', 'hold']);
    expect(bad({...ok, player: [{hero: 'bokh', at: space(9, 0)}]})).toMatch(/off the board/);
    expect(
      bad({
        ...ok,
        player: [{hero: 'bokh', at: space(2, 2)}],
        enemy: [{hero: 'wolf', at: space(2, 2)}],
      })
    ).toMatch(/enemy\[0\] starts on the same space as player\[0\]/);
    expect(bad({...ok, yurts: 'lots'})).toMatch(/yurts must be/);
  });

  it("puts the start menu's party on the player's side", () => {
    const run = createRun(1, {test: true, party: ['priest', 'archer']});
    const heroes = run.fight.units.filter((u) => u.side === 'player').map((u) => u.hero);
    expect(heroes).toEqual(['priest', 'archer', 'camel']);
    expect(() => createRun(1, {test: true, party: []})).toThrow(RuleError);
  });

  it('is a run of one fight, won to win the run', () => {
    let run = createRun(5, {test: true});
    expect(run.test).toBe(true);
    expect(runView(run).stages).toBe(1);
    // The AI plays both sides to the end.
    for (let guard = 0; guard < 400 && runStatus(run) === 'active'; guard++) {
      const view = runView(run);
      if (view.aiDue) run = handleRunAction(run, {type: 'continue'});
      else run.fight.units.forEach((u) => (u.controller = 'ai'));
    }
    expect(runStatus(run)).not.toBe('active');
    expect(() => handleRunAction(run, {type: 'next'})).toThrow(RuleError);
  });
});
