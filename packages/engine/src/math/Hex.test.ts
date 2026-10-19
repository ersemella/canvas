import {describe, expect, it} from 'vitest';
import {
  HEX_DIRECTIONS,
  hex,
  hexCorners,
  hexDirectionTo,
  hexDistance,
  hexEquals,
  hexFromKey,
  hexKey,
  hexLine,
  hexLineSides,
  hexNeighbor,
  hexNeighbors,
  hexOppositePairs,
  hexRing,
  hexToOffset,
  hexToPixel,
  hexesInRange,
  offsetRectangle,
  offsetToHex,
  pixelToHex,
} from './Hex';
import type {HexLayout} from './Hex';

const origin = hex(0, 0);

describe('hex geometry', () => {
  it('measures distance in steps', () => {
    expect(hexDistance(origin, origin)).toBe(0);
    for (const d of HEX_DIRECTIONS) expect(hexDistance(origin, d)).toBe(1);
    expect(hexDistance(hex(0, 0), hex(3, -1))).toBe(3);
    expect(hexDistance(hex(-2, 3), hex(2, -1))).toBe(4);
  });

  it('has six neighbours, opposite at i and i + 3', () => {
    const n = hexNeighbors(hex(2, 1));
    expect(n).toHaveLength(6);
    expect(new Set(n.map(hexKey)).size).toBe(6);
    for (let i = 0; i < 3; i++) {
      const a = hexNeighbor(origin, i);
      const b = hexNeighbor(origin, i + 3);
      expect(hexEquals({q: a.q + b.q, r: a.r + b.r}, origin)).toBe(true);
    }
    expect(hexNeighbor(origin, -1)).toEqual(hexNeighbor(origin, 5));
  });

  it('lists the three opposite pairs around a hex (flanking)', () => {
    const pairs = hexOppositePairs(hex(1, 1));
    expect(pairs).toHaveLength(3);
    for (const [a, b] of pairs) {
      expect(hexDistance(a, b)).toBe(2);
      expect(hexDistance(a, hex(1, 1))).toBe(1);
    }
  });

  it('finds the direction along a straight hex line', () => {
    expect(hexDirectionTo(origin, hex(3, 0))).toBe(0);
    expect(hexDirectionTo(origin, hex(0, 2))).toBe(5);
    expect(hexDirectionTo(origin, hex(-2, 2))).toBe(4);
    expect(hexDirectionTo(origin, hex(2, 1))).toBeNull();
    expect(hexDirectionTo(origin, origin)).toBeNull();
  });

  it('round-trips keys', () => {
    expect(hexFromKey(hexKey(hex(-3, 7)))).toEqual(hex(-3, 7));
  });

  it('counts areas and rings', () => {
    expect(hexesInRange(origin, 0)).toEqual([origin]);
    expect(hexesInRange(origin, 1)).toHaveLength(7);
    expect(hexesInRange(origin, 2)).toHaveLength(19);
    expect(hexesInRange(hex(4, -2), 2).every((h) => hexDistance(h, hex(4, -2)) <= 2)).toBe(true);
    expect(hexRing(origin, 0)).toEqual([origin]);
    const ring = hexRing(hex(1, 1), 2);
    expect(ring).toHaveLength(12);
    expect(new Set(ring.map(hexKey)).size).toBe(12);
    expect(ring.every((h) => hexDistance(h, hex(1, 1)) === 2)).toBe(true);
  });
});

describe('hex lines', () => {
  it('runs from a to b, one hex per step, each adjacent to the last', () => {
    const line = hexLine(hex(0, 0), hex(4, -1));
    expect(line).toHaveLength(5);
    expect(line[0]).toEqual(hex(0, 0));
    expect(line.at(-1)).toEqual(hex(4, -1));
    for (let i = 1; i < line.length; i++) expect(hexDistance(line[i - 1]!, line[i]!)).toBe(1);
  });

  it('follows a hex direction exactly', () => {
    expect(hexLine(origin, hex(3, 0))).toEqual([hex(0, 0), hex(1, 0), hex(2, 0), hex(3, 0)]);
  });

  it('gives both hexes where the line runs along a border', () => {
    // (0,0) to (1,1) runs along the border between (1,0) and (0,1).
    const sides = hexLineSides(origin, hex(1, 1));
    expect(sides).toHaveLength(3);
    expect(sides[0]).toEqual([origin]);
    expect(sides[2]).toEqual([hex(1, 1)]);
    expect(sides[1]!.map(hexKey).sort()).toEqual(['0,1', '1,0']);
    // A line through hex centres has no border steps.
    expect(hexLineSides(origin, hex(3, 0)).every((s) => s.length === 1)).toBe(true);
  });
});

describe('offset maps', () => {
  it('round-trips column/row for every orientation and parity', () => {
    for (const orientation of ['pointy', 'flat'] as const) {
      for (const parity of ['odd', 'even'] as const) {
        for (let row = -3; row < 7; row++) {
          for (let col = -3; col < 9; col++) {
            const h = offsetToHex({col, row}, orientation, parity);
            expect(hexToOffset(h, orientation, parity)).toEqual({col, row});
          }
        }
      }
    }
  });

  it('shoves odd rows right in a pointy odd-r map', () => {
    const layout: HexLayout = {orientation: 'pointy', size: 10, origin: {x: 0, y: 0}};
    const row0 = hexToPixel(offsetToHex({col: 0, row: 0}), layout);
    const row1 = hexToPixel(offsetToHex({col: 0, row: 1}), layout);
    const row2 = hexToPixel(offsetToHex({col: 0, row: 2}), layout);
    expect(row1.x).toBeCloseTo(row0.x + (Math.sqrt(3) * 10) / 2);
    expect(row2.x).toBeCloseTo(row0.x);
  });

  it('lists every hex of the rectangle once', () => {
    const hexes = offsetRectangle(9, 7);
    expect(hexes).toHaveLength(63);
    expect(new Set(hexes.map(hexKey)).size).toBe(63);
  });
});

describe('pixels', () => {
  const layouts: HexLayout[] = [
    {orientation: 'pointy', size: 16, origin: {x: 40, y: 30}},
    {orientation: 'flat', size: 12, origin: {x: -5, y: 8}},
  ];

  it('picks the hex whose centre a pixel is drawn at, and points near it', () => {
    for (const layout of layouts) {
      for (const h of hexesInRange(hex(1, 1), 3)) {
        const {x, y} = hexToPixel(h, layout);
        expect(pixelToHex({x, y}, layout)).toEqual(h);
        // Just inside the hex, towards each corner.
        for (const c of hexCorners(layout.orientation, layout.size)) {
          expect(pixelToHex({x: x + c.x * 0.9, y: y + c.y * 0.9}, layout)).toEqual(h);
        }
      }
    }
  });

  it('puts corners one size from the centre, a vertex on top for pointy', () => {
    const corners = hexCorners('pointy', 10);
    expect(corners).toHaveLength(6);
    for (const c of corners) expect(Math.hypot(c.x, c.y)).toBeCloseTo(10);
    expect(corners[0]!.x).toBeCloseTo(0);
    expect(corners[0]!.y).toBeCloseTo(-10);
    expect(hexCorners('flat', 10)[0]!.y).toBeCloseTo(0);
  });
});
