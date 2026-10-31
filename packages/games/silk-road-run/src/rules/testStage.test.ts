import {describe, expect, it} from 'vitest';
import {hexDirectionTo, hexKey, hexNeighbor} from '@canvas/engine/server';
import {DOME, spaceAt, spaceOf} from './map';
import {abilitiesOf, unusableReason, ABILITIES} from './abilities';
import {HEROES} from './config';
import {RuleError, advanceToDecision, applyTurn, mapOf, refreshStats} from './fight';
import {previewTurn} from './preview';
import {createRun, handleRunAction, runStatus, runView} from './run';
import {createTestFight, parseTestStage} from './testStage';
import {aimSlot, actionCost} from './track';
import {movementCap, reachableHexes} from './board';

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

  it('leaves every Priest out of his own Blessing with "blessing": {"self": false}', () => {
    const raw = {
      player: [{hero: 'priest', abilities: ['blessing']}],
      enemy: [{hero: 'wolf'}],
      blessing: {self: false},
    };
    const s = createTestFight(1, raw);
    const p = s.units.find((u) => u.hero === 'priest')!;
    expect(p.blessesSelf).toBe(false);
    expect(ABILITIES.blessing.summary(p)).not.toContain('yourself');
    p.hp = 1;
    p.slot = s.currentSlot;
    s.awaiting = p.id;
    const aim = ABILITIES.blessing.targets(s, mapOf(s), p, p.hex!)[0]!;
    applyTurn(s, p, {action: {ability: 'blessing', target: aim}});
    expect(p.hp).toBe(1);
    expect(() => parseTestStage({...raw, blessing: {self: 'no'}})).toThrow(
      'blessing.self must be true or false.'
    );
    expect(createTestFight(1, {...raw, blessing: undefined}).units[0]!.blessesSelf).toBeUndefined();
  });

  it('sets every unit of a hero with "heroes", the party picked too, and every Leap with "leap"', () => {
    const raw = {
      player: [{hero: 'bokh'}],
      enemy: [{hero: 'cataphract'}, {hero: 'varangian', power: 4}],
      heroes: {
        varangian: {defence: 3, power: 2, caution: 0},
        cataphract: {defence: 2, power: 2, passives: []},
      },
      leap: {shape: 'forward', shieldPerHit: 1},
      charge: {armour: 1},
    };
    const s = createTestFight(1, raw, ['varangian', 'cataphract', 'priest']);
    const of = (id: string) => s.units.find((u) => u.id === id)!;
    for (const id of ['p-varangian', 'p-cataphract', 'e-cataphract']) {
      expect(of(id).defence).toBe(id.includes('varangian') ? 3 : 2);
      expect(of(id).power).toBe(2);
    }
    // A unit's own stats over its hero's; Armoured gone; the Barbarian a tank to the AI.
    expect([of('e-varangian').power, of('e-varangian').defence, of('e-varangian').maxHp]).toEqual([
      4, 3, 8,
    ]);
    expect(of('e-cataphract').passives ?? []).not.toContain('armoured');
    expect(of('p-cataphract').maxHp).toBe(6);
    expect([of('p-varangian').caution, of('p-cataphract').caution]).toEqual([0, undefined]);
    expect(s.units.every((u) => u.leapShape === 'forward' && u.leapShieldPerHit === 1)).toBe(true);
    expect(s.units.every((u) => u.chargeArmour === 1)).toBe(true);
    expect(() => parseTestStage({...raw, charge: {armour: -1}})).toThrow(
      'charge.armour must be a whole number from 0 to 8.'
    );
    // Passives given a unit stay beside its hero's own.
    const juggernaut = createTestFight(1, {
      player: [{hero: 'mahout', passives: ['rally']}],
      enemy: [{hero: 'wolf'}],
    });
    expect(juggernaut.units[0]!.passives).toEqual(['unstoppable', 'rally']);
    expect(() => parseTestStage({...raw, heroes: {varangian: {at: space(1, 1)}}})).toThrow(
      'heroes.varangian has an unknown field "at"'
    );
    expect(() => parseTestStage({...raw, heroes: {nobody: {}}})).toThrow(
      'heroes.nobody.hero must be one of'
    );
    expect(() => parseTestStage({...raw, leap: {shape: 'round'}})).toThrow(
      'leap.shape must be "front", "forward" or "splash".'
    );
  });

  it('aims every Elixir in lines to the range given with "elixir": {"line": 3}, over anything', () => {
    const from = spaceAt(3, 4);
    const along = (n: number) => {
      let h = from;
      for (let i = 0; i < n; i++) h = hexNeighbor(h, 0);
      return spaceOf(h);
    };
    const raw = {
      player: [
        {hero: 'alchemist', at: space(3, 4)},
        {hero: 'bokh', at: along(1)},
      ],
      enemy: [
        {hero: 'mangudai', at: along(3)},
        {hero: 'storm', at: along(4)},
      ],
      yurts: 'none' as const,
      camel: null,
      elixir: {line: 3},
    };
    const s = createTestFight(1, raw);
    const a = s.units.find((u) => u.hero === 'alchemist')!;
    expect(s.units.every((u) => u.elixirLine === 3)).toBe(true);
    expect(ABILITIES.elixir.summary(a)).toContain('within 3 in a straight line, over anything');
    // Past the Grappler beside it, the Outrider 3 along the line; not the Storm Caller 4 away, nor itself.
    const aimed = ABILITIES.elixir.targets(s, mapOf(s), a, a.hex!).map((t) => spaceOf(t.hex!));
    expect(aimed).toContainEqual(along(1));
    expect(aimed).toContainEqual(along(3));
    expect(aimed).not.toContainEqual(along(4));
    expect(aimed).not.toContainEqual(space(3, 4));
    expect(() => parseTestStage({...raw, elixir: {line: 'yes'}})).toThrow(
      'elixir.line must be a whole number from 0 to 8.'
    );
    expect(createTestFight(1, {...raw, elixir: undefined}).units[0]!.elixirLine).toBeUndefined();
  });

  it('makes every Elixir an overdose with "elixir": {"overdose": 6}, on ally or enemy', () => {
    const raw = {
      player: [
        {hero: 'alchemist', at: space(3, 4)},
        {hero: 'bokh', at: space(4, 4)},
      ],
      enemy: [{hero: 'mangudai', at: space(8, 4)}],
      yurts: 'none' as const,
      camel: null,
      elixir: {overdose: 6},
    };
    const s = createTestFight(1, raw);
    const a = s.units.find((u) => u.hero === 'alchemist')!;
    expect(s.units.every((u) => u.elixirOverdose === 6)).toBe(true);
    expect(ABILITIES.elixir.summary(a)).toContain('ally or enemy: Empowered until its hits deal 6');
    expect(() => parseTestStage({...raw, elixir: {overdose: -1}})).toThrow(
      'elixir.overdose must be a whole number from 0 to 20.'
    );
    expect(
      createTestFight(1, {...raw, elixir: undefined}).units[0]!.elixirOverdose
    ).toBeUndefined();
  });

  it('gives every Duelist the Swift Strike and walk "swiftStrike" sets', () => {
    const raw = {
      player: [{hero: 'youxia'}],
      enemy: [{hero: 'youxia'}, {hero: 'wolf'}],
      swiftStrike: {dash: 0, lunge: 2, walk: 2, streak: [2, 3, 4]},
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
    // Through units, no Haste.
    const through = createTestFight(1, {
      ...raw,
      swiftStrike: {dash: 0, lunge: 2, walk: 2, passThrough: true, haste: 0},
    });
    const y = through.units.find((u) => u.hero === 'youxia')!;
    expect([y.passThrough, y.swiftHaste]).toEqual([true, 0]);
    expect(ABILITIES.swiftStrike.summary(y)).toBe(
      'Lunge up to 2 straight and strike the first unit, or through units to a free space, hitting each passed and the one in front.'
    );
    expect(() => parseTestStage({...raw, swiftStrike: {passThrough: 1}})).toThrow(/passThrough/);
    expect(() => parseTestStage({...raw, swiftStrike: {jump: 'yes'}})).toThrow(/jump/);
    // A straight walk of 3: every space it reaches on one of its six lines, none farther.
    const lines = createTestFight(1, {
      ...raw,
      yurts: 'none',
      swiftStrike: {walk: 3, straight: true},
    });
    const w = lines.units.find((u) => u.hero === 'youxia' && u.side === 'player')!;
    const reach = reachableHexes(lines, mapOf(lines), w).filter((r) => r.path.length > 0);
    expect(reach.length).toBeGreaterThan(0);
    for (const r of reach) {
      expect(r.path.length).toBeLessThanOrEqual(3);
      expect(hexDirectionTo(w.hex!, r.hex)).not.toBeNull();
    }
    // One jump a turn, Haste 1, 2, 3 on turns striking running.
    const one = createTestFight(1, {
      ...raw,
      swiftStrike: {
        dash: 0,
        lunge: 1,
        walk: 2,
        jump: true,
        chain: false,
        streak: [1, 2, 3],
        streakResets: true,
      },
    });
    const d = one.units.find((u) => u.hero === 'youxia')!;
    expect([d.jump, d.chain, d.streakResets, d.streakHaste]).toEqual([
      true,
      false,
      true,
      [1, 2, 3],
    ]);
    expect(ABILITIES.swiftStrike.summary(d)).toBe(
      'Strike a unit up to 2 away in line, stepping in, or jump a unit next to you to the space past it, hitting it. When it hits, its card is Hastened 1, then 2, then 3 on turns striking running.'
    );
    // Left out, Swift Strike is as built.
    const built = createTestFight(1, {player: [{hero: 'youxia'}], enemy: [{hero: 'wolf'}]});
    expect(movementCap(built.units.find((u) => u.hero === 'youxia')!)).toBe(3);
    expect(() => parseTestStage({...raw, swiftStrike: {dash: 0, lunge: -1}})).toThrow(/lunge/);
    expect(() => parseTestStage({...raw, swiftStrike: {streak: 3}})).toThrow(/streak/);
    expect(() => parseTestStage({...raw, swiftStrike: {reach: 2}})).toThrow(/unknown field/);
  });

  it('with jumps, a Duelist jumps a unit next to it and its turn goes on while another jump is open', () => {
    // The Duelist at (6, 4); the Grappler next to it and the Outrider next to the space past it.
    const raw = {
      seed: 1,
      yurts: 'none',
      camel: false,
      player: [{hero: 'youxia', at: space(6, 4)}],
      enemy: [
        {hero: 'bokh', at: space(5, 4)},
        {hero: 'mangudai', at: space(3, 4)},
      ],
      swiftStrike: {dash: 0, lunge: 1, walk: 2, jump: true, haste: 0},
    };
    const s = createTestFight(1, raw);
    const y = s.units.find((u) => u.hero === 'youxia')!;
    for (const u of s.units) u.slot = u === y ? 0 : 50;
    s.currentSlot = 0;
    s.awaiting = y.id;
    const jumps = ABILITIES.swiftStrike
      .targets(s, mapOf(s), y, y.hex!)
      .filter((t) => !s.units.some((u) => u.hex && hexKey(u.hex) === hexKey(t.hex!)));
    expect(jumps).toHaveLength(1);
    // Its preview: the card as a strike's, the turn not over.
    const first = previewTurn(s, y.id, {action: {ability: 'swiftStrike', target: jumps[0]!}})!;
    expect(first.slot).toBe(actionCost(y));
    applyTurn(s, y, {action: {ability: 'swiftStrike', target: jumps[0]!}});
    expect(advanceToDecision(s)).toBe(y);
    expect(y.chaining).toBe(true);
    // Skip turn mid-chain: a strike's turn, not a Wait.
    expect(previewTurn(s, y.id, {action: {ability: 'hold', target: {}}})!.slot).toBe(actionCost(y));
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
