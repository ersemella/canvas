// China's boss, the Ox King and the Fan Lady (owner, 2026-10-28; enemies.md):
// Gore, the Banana-leaf Fan, Fan the Flames and its fire, Devoted, and the
// fan she drops.
import {describe, expect, it} from 'vitest';
import {hexDistance, hexKey, hexNeighbor} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, DEVOTED} from './config';
import {advanceToDecision, applyTurn, createFight, mapOf, seededRandom} from './fight';
import {kitOf, reachableHexes} from './board';
import {RIDGES, STEPPE, randomTiles} from './map';
import type {AbilityId, ActionTarget, FightState, Unit} from './types';

const centre: Hex = {q: 0, r: 0};
/** `n` spaces from `from` along direction `dir`. */
const out = (dir: number, n: number, from: Hex = centre): Hex => {
  let h = from;
  for (let i = 0; i < n; i++) h = hexNeighbor(h, dir);
  return h;
};

const CHINA = ['youxia', 'modao', 'alchemist'] as const;

/**
 * China's party against the two of them, units where the test wants them
 * on open ground (a burning ridge on each of `ridges`), the rest dead;
 * cards far apart.
 */
function setup(placements: Record<string, Hex>, ridges: Hex[] = []): FightState {
  const state = createFight(0, [...CHINA], ['oxKing', 'fanLady']);
  state.tiles = Object.fromEntries(Object.keys(STEPPE.tiles).map((k) => [k, 'sand']));
  for (const h of ridges) state.tiles[hexKey(h)] = 'mountain';
  state.units = state.units.filter((u) => u.hero !== 'camel');
  let slot = 100;
  for (const u of state.units) {
    const h = placements[u.id];
    u.hex = h ?? null;
    u.alive = Boolean(h);
    u.slot = h ? slot : null;
    slot += 50;
  }
  state.currentSlot = 0;
  return state;
}

const unit = (s: FightState, id: string): Unit => s.units.find((u) => u.id === id)!;

/** `id`'s turn now, its card on the current slot, taking `ability` on `target`. */
function act(s: FightState, id: string, ability: AbilityId, target: ActionTarget = {}) {
  const u = unit(s, id);
  u.slot = s.currentSlot;
  applyTurn(s, u, {action: {ability, target}});
}

describe('the Ox King', () => {
  it('Gore: charges up to 2 in a line, hitting the row in its way and Pushing it back', () => {
    const s = setup({'e-oxKing': centre, 'p-youxia': out(0, 1), 'p-modao': out(0, 2)});
    act(s, 'e-oxKing', 'gore', {hex: out(0, 2)});
    const duelist = unit(s, 'p-youxia');
    const vanguard = unit(s, 'p-modao');
    expect(duelist.hp).toBe(duelist.maxHp - 3);
    expect(vanguard.hp).toBe(vanguard.maxHp - 3);
    expect(unit(s, 'e-oxKing').hex).toEqual(out(0, 2));
    expect(duelist.hex).toEqual(out(0, 3));
    expect(vanguard.hex).toEqual(out(0, 4));
  });

  it('Gore is a charge whatever Stomp’s mode, stopped behind a row that can’t be Pushed', () => {
    expect(ABILITY.stomp.mode).toBe('stomp');
    // The Duelist with the board's edge right behind it.
    const edge = out(0, 4);
    const s = setup({'e-oxKing': out(3, 1, edge), 'p-youxia': edge});
    act(s, 'e-oxKing', 'gore', {hex: edge});
    const duelist = unit(s, 'p-youxia');
    expect(duelist.hp).toBe(duelist.maxHp - 3);
    expect(duelist.hex).toEqual(edge);
    expect(unit(s, 'e-oxKing').hex).toEqual(out(3, 1, edge));
  });

  it('an Alchemist’s Weaken 2 cuts Gore to 1', () => {
    const s = setup({'e-oxKing': centre, 'p-youxia': out(0, 1)});
    const king = unit(s, 'e-oxKing');
    king.weaken = 2;
    act(s, 'e-oxKing', 'gore', {hex: out(0, 1)});
    const duelist = unit(s, 'p-youxia');
    expect(duelist.hp).toBe(duelist.maxHp - 1);
  });
});

describe('the Fan Lady', () => {
  it('Banana-leaf Fan: every unit in a line of 3 Pushed 2, the farthest first, unhurt', () => {
    const lady = out(0, 3);
    const s = setup({
      'e-fanLady': lady,
      'p-youxia': out(3, 1, lady),
      'p-modao': out(3, 2, lady),
      'e-oxKing': out(3, 3, lady),
    });
    act(s, 'e-fanLady', 'bananaFan', {hex: out(3, 1, lady)});
    expect(unit(s, 'e-oxKing').hex).toEqual(out(3, 5, lady));
    expect(unit(s, 'p-modao').hex).toEqual(out(3, 4, lady));
    expect(unit(s, 'p-youxia').hex).toEqual(out(3, 3, lady));
    for (const u of s.units) if (u.alive) expect(u.hp).toBe(u.maxHp);
  });

  it('Fan the Flames: the spaces next to a burning ridge catch fire, sparing who stands there', () => {
    const ridge = out(1, 2);
    const s = setup({'e-fanLady': centre, 'p-youxia': out(0, 1, ridge)}, [ridge]);
    act(s, 'e-fanLady', 'fanFlames', {hex: ridge});
    expect(s.fires).toHaveLength(6);
    for (const f of s.fires!) expect(hexDistance(f.hex, ridge)).toBe(1);
    const duelist = unit(s, 'p-youxia');
    expect(duelist.hp).toBe(duelist.maxHp);
  });

  it('Fan the Flames aims only at a burning ridge', () => {
    const s = setup({'e-fanLady': centre}, []);
    expect(() => act(s, 'e-fanLady', 'fanFlames', {hex: out(0, 2)})).toThrow();
  });

  it('entering fire burns 1, walking in or Pushed in, a space at a time', () => {
    const ridge: Hex = {q: 2, r: -2};
    const s = setup({'e-fanLady': {q: -3, r: 0}, 'p-youxia': {q: -1, r: -1}}, [ridge]);
    act(s, 'e-fanLady', 'fanFlames', {hex: ridge});
    // The Duelist walks into the fire next to the ridge.
    const duelist = unit(s, 'p-youxia');
    duelist.slot = s.currentSlot;
    applyTurn(s, duelist, {
      move: [
        {q: 0, r: -1},
        {q: 1, r: -1},
      ],
      action: {ability: 'hold'},
    });
    expect(duelist.hp).toBe(duelist.maxHp - ABILITY.fanFlames.burn);
  });

  it('the Fan blows a hero into the fire: it burns', () => {
    // The Fan Lady, the Vanguard next to her, the fire beyond it, then the ridge.
    const ridge: Hex = {q: 2, r: -2};
    const s = setup({'e-fanLady': {q: -1, r: 1}, 'p-modao': centre}, [ridge]);
    act(s, 'e-fanLady', 'fanFlames', {hex: ridge});
    act(s, 'e-fanLady', 'bananaFan', {hex: centre});
    const vanguard = unit(s, 'p-modao');
    // Blown into the fire, then stopped by the ridge.
    expect(vanguard.hex).toEqual({q: 1, r: -1});
    expect(vanguard.hp).toBe(vanguard.maxHp - ABILITY.fanFlames.burn);
  });

  it('her fire goes out as her next turn starts', () => {
    const ridge = out(1, 2);
    const s = setup({'e-fanLady': centre, 'p-modao': out(3, 4)}, [ridge]);
    act(s, 'e-fanLady', 'fanFlames', {hex: ridge});
    expect(s.fires?.length).toBeGreaterThan(0);
    const lady = unit(s, 'e-fanLady');
    s.units.filter((u) => u !== lady).forEach((u) => (u.slot = u.alive ? 900 : null));
    const next = advanceToDecision(s);
    expect(next).toBe(lady);
    expect(s.fires).toBeUndefined();
  });

  it('a walk goes round the fire when a walk as short does', () => {
    const ridge = out(1, 2);
    const s = setup({'e-fanLady': out(3, 4), 'p-youxia': out(4, 1, ridge)}, [ridge]);
    act(s, 'e-fanLady', 'fanFlames', {hex: ridge});
    const duelist = unit(s, 'p-youxia');
    // Out of the fire it stands in, two spaces on, each walk to there as short.
    for (const r of reachableHexes(s, mapOf(s), duelist))
      if (r.path.length === 2) {
        const burns = r.path.filter((h) => s.fires!.some((f) => hexKey(f.hex) === hexKey(h)));
        // Only the end may burn when it is itself on fire.
        const endBurns = s.fires!.some((f) => hexKey(f.hex) === hexKey(r.hex)) ? 1 : 0;
        expect(burns.length).toBeLessThanOrEqual(1 + endBurns);
      }
  });
});

describe('Devoted', () => {
  it('a hit on one Hastens the other’s card 3', () => {
    const s = setup({'e-oxKing': centre, 'e-fanLady': out(3, 3), 'p-youxia': out(0, 1)});
    const lady = unit(s, 'e-fanLady');
    const before = lady.slot!;
    act(s, 'p-youxia', 'swiftStrike', {hex: centre});
    expect(lady.slot).toBe(before - DEVOTED.haste);
  });

  it('the Vanguard’s Cleave through both: Hastened 3 each, then Delayed 6, a net Delay of 3', () => {
    const s = setup({'p-modao': centre, 'e-oxKing': out(0, 1), 'e-fanLady': out(0, 2)});
    const king = unit(s, 'e-oxKing');
    const lady = unit(s, 'e-fanLady');
    const [k, l] = [king.slot!, lady.slot!];
    act(s, 'p-modao', 'cleave', {hex: out(0, 1)});
    expect(king.slot).toBe(k + ABILITY.cleave.delay - DEVOTED.haste);
    expect(lady.slot).toBe(l + ABILITY.cleave.delay - DEVOTED.haste);
  });

  it('the Duelist, Empowered 2 by the Alchemist, fells the Fan Lady in two strikes', () => {
    const s = setup({'p-youxia': centre, 'e-fanLady': out(0, 1)});
    const duelist = unit(s, 'p-youxia');
    const lady = unit(s, 'e-fanLady');
    duelist.empower = 2;
    act(s, 'p-youxia', 'swiftStrike', {hex: out(0, 1)});
    expect(lady.alive).toBe(true);
    duelist.empower = 2;
    act(s, 'p-youxia', 'swiftStrike', {hex: out(0, 1)});
    expect(lady.alive).toBe(false);
  });
});

describe('the fan she drops', () => {
  it('falls where she does; her fire burns on; a hero picks it up and puts the fire out', () => {
    const ridge = out(1, 2);
    const s = setup({'e-fanLady': out(3, 2), 'p-youxia': out(3, 3), 'p-modao': out(4, 1)}, [ridge]);
    act(s, 'e-fanLady', 'fanFlames', {hex: ridge});
    const lady = unit(s, 'e-fanLady');
    lady.hp = 1;
    act(s, 'p-youxia', 'swiftStrike', {hex: out(3, 2)});
    expect(lady.alive).toBe(false);
    expect(s.fan).toEqual(out(3, 2));
    expect(s.fires?.length).toBeGreaterThan(0);
    // Only a hero carrying it has the Borrowed Fan.
    const duelist = unit(s, 'p-youxia');
    expect(kitOf(duelist)).not.toContain('quench');
    duelist.slot = s.currentSlot;
    applyTurn(s, duelist, {move: [out(3, 2)], action: {ability: 'hold'}});
    expect(s.fan).toBeUndefined();
    expect(kitOf(duelist)).toContain('quench');
    act(s, 'p-youxia', 'quench');
    expect(s.fires).toBeUndefined();
    expect(kitOf(duelist)).not.toContain('quench');
  });
});

describe('the Flaming Mountains with their ridges burning', () => {
  it('raise two or three single ridges near the middle, none side by side', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const tiles = randomTiles(seededRandom(seed), false, RIDGES);
      const ridges = Object.keys(tiles)
        .filter((k) => tiles[k] === 'mountain')
        .map((k) => RIDGES.hexes.find((h) => hexKey(h) === k)!);
      expect(ridges.length).toBeGreaterThanOrEqual(2);
      expect(ridges.length).toBeLessThanOrEqual(3);
      for (const a of ridges) {
        expect(hexDistance(a, centre)).toBeLessThanOrEqual(3);
        for (const b of ridges) if (a !== b) expect(hexDistance(a, b)).toBeGreaterThan(1);
      }
      expect(Object.values(tiles)).not.toContain('scorched');
    }
  });
});
