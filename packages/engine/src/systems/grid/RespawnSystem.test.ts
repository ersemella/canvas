import {describe, expect, it} from 'vitest';
import {pickFreeCell} from 'systems/grid/RespawnSystem';

describe('pickFreeCell', () => {
  it('never picks an occupied cell', () => {
    // 3x3 grid of 20px cells; everything but the bottom-right cell is taken.
    const occupied = new Set<string>();
    for (let c = 0; c < 3; c++)
      for (let r = 0; r < 3; r++) occupied.add(`${c * 20 + 10},${r * 20 + 10}`);
    occupied.delete('50,50');
    for (let i = 0; i < 50; i++) {
      expect(pickFreeCell(3, 3, 20, occupied)).toEqual({x: 50, y: 50});
    }
  });

  it('returns null when the grid is full', () => {
    const occupied = new Set(['10,10', '10,30', '30,10', '30,30']);
    expect(pickFreeCell(2, 2, 20, occupied)).toBeNull();
  });

  it('can reach every free cell', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const cell = pickFreeCell(4, 4, 10, new Set())!;
      seen.add(`${cell.x},${cell.y}`);
    }
    expect(seen.size).toBe(16);
  });
});
