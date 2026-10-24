import {describe, expect, it} from 'vitest';
import {hexKey} from '@canvas/engine/server';
import {spaceAt, spaceOf} from './map';
import {abilitiesOf, unusableReason, ABILITIES} from './abilities';
import {HEROES} from './config';
import {RuleError, refreshStats} from './fight';
import {createRun, handleRunAction, runStatus, runView} from './run';
import {createTestFight, parseTestStage} from './testStage';

const space = (col: number, row: number) => ({col, row});

describe('the test stage', () => {
  it('accepts the committed test-stage.json', () => {
    expect(() => createTestFight(1)).not.toThrow();
    expect(() => createRun(1, {test: true})).not.toThrow();
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
    expect(unusableReason(archer!, ABILITIES.longshot)).not.toBeNull();
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
    // At most three besides Hold (owner, 2026-10-24).
    expect(
      bad({...ok, player: [{hero: 'bokh', abilities: ['grapple', 'throw', 'haul', 'shove']}]})
    ).toMatch(/abilities can have at most 3/);
    expect(
      parseTestStage({
        ...ok,
        player: [{hero: 'bokh', abilities: ['grapple', 'throw', 'haul', 'hold']}],
      }).player[0]!.loadout!.abilities
    ).toEqual(['grapple', 'throw', 'haul', 'hold']);
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
