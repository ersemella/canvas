/**
 * What the turn being planned draws over the board: highlighted hexes,
 * a move's path, an ability's range, Longshot's lanes and drawn arrows in
 * the air, Throw's arc, and charging areas.
 */
import {hexCorners, hexKey, pixelToHex} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {BOARD_LAYOUT} from '../layout';
import {PALETTE, paletteAlpha} from '../palette';
import {TARGET_RGB, center, pixelShadow} from './pixels';
import type {HighlightStyle} from './pixels';
import type {BowLane, HighlightKind} from './scene';

const targeting = (fill: number, stroke: number): HighlightStyle => ({
  fill: `rgba(${TARGET_RGB},${fill})`,
  stroke: `rgba(${TARGET_RGB},${stroke})`,
});
export const HIGHLIGHT: Record<HighlightKind, HighlightStyle> = {
  /** The steps of a planned move. */
  path: targeting(0.25, 0.8),
  /** Hexes an ability can target, or a move can end on: outlined solid, so it shows over a unit's tint. */
  target: targeting(0.14, 0.9),
  /** An ability's second pick, once its target is (Feigned Retreat's fall-back), or where a Grapple throws: dashed, so it never reads as a target. */
  landing: {...targeting(0.08, 1), dash: [6, 4]},
  /** The whole area an aimed ability strikes, around its target. */
  area: targeting(0.42, 1),
  chosen: targeting(0.6, 1),
};

/** The hovered hex's outline. */
export const HOVER: HighlightStyle = {fill: paletteAlpha('ivory', 0.1), stroke: PALETTE.ivory};

/** A planned move's route: a line through the hexes' centres, with a head on the last. */
export function drawPath(ctx: CanvasRenderingContext2D, path: Hex[]): void {
  const points = path.map(center);
  const a = points[points.length - 2]!;
  const b = points[points.length - 1]!;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  // Stop short of the last centre, so the head sits clear of the ghost's feet.
  const end = {x: b.x - ux * 12, y: b.y - uy * 12};
  ctx.save();
  ctx.strokeStyle = PALETTE.lapisLight;
  ctx.fillStyle = PALETTE.lapisLight;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'square';
  pixelShadow(ctx, 1);
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (const p of points.slice(1, -1)) ctx.lineTo(p.x, p.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(end.x + ux * 8, end.y + uy * 8);
  ctx.lineTo(end.x - ux * 4 - uy * 7, end.y - uy * 4 + ux * 7);
  ctx.lineTo(end.x - ux * 4 + uy * 7, end.y - uy * 4 - ux * 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * The edge of an ability's range: a dashed light lapis line, over ink so
 * it reads on the sand and the rugs, along every side of `hexes` that
 * borders a hex outside them.
 */
export function drawRangeOutline(ctx: CanvasRenderingContext2D, hexes: Hex[]): void {
  const inside = new Set(hexes.map(hexKey));
  const corners = hexCorners('flat', BOARD_LAYOUT.size);
  const edges: [{x: number; y: number}, {x: number; y: number}][] = [];
  for (const h of hexes) {
    const c = center(h);
    corners.forEach((p, i) => {
      const q = corners[(i + 1) % corners.length]!;
      // The hex across this side has its centre twice as far as the side's middle.
      const across = pixelToHex({x: c.x + p.x + q.x, y: c.y + p.y + q.y}, BOARD_LAYOUT);
      if (!inside.has(hexKey(across)))
        edges.push([
          {x: c.x + p.x, y: c.y + p.y},
          {x: c.x + q.x, y: c.y + q.y},
        ]);
    });
  }
  ctx.save();
  ctx.lineCap = 'round';
  for (const [color, width, dash] of [
    [PALETTE.ink, 5, []],
    [PALETTE.lapisLight, 2.5, [7, 5]],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash([...dash]);
    ctx.beginPath();
    for (const [a, b] of edges) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A targeting arrow from `from` towards `to`, its head stopping at `to`'s
 * hex and pointing at it: Longshot's lanes, and (`dotted`) a drawn arrow in
 * the air.
 */
export function drawLaneArrow(
  ctx: CanvasRenderingContext2D,
  from: Hex,
  to: Hex,
  color: string = PALETTE.lapisLight,
  dotted = false
): void {
  const a = center(from);
  const b = center(to);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const start = {x: a.x + ux * 26, y: a.y + uy * 26};
  const end = {x: b.x - ux * 34, y: b.y - uy * 34};
  ctx.save();
  ctx.lineCap = 'square';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  pixelShadow(ctx, 1);
  // Square caps grow each 2px dash into a 5px square dot.
  if (dotted) ctx.setLineDash([2, 8]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x - ux * 4, end.y - uy * 4);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(end.x + ux * 8, end.y + uy * 8);
  ctx.lineTo(end.x - ux * 6 - uy * 8, end.y - uy * 6 + ux * 8);
  ctx.lineTo(end.x - ux * 6 + uy * 8, end.y - uy * 6 - ux * 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Longshot's lanes from `from`: to a unit it may target, a light lapis
 * arrow pointing at it; along any other lane (blocked by an ally, a yurt
 * or the edge), a faint dashed line to where the arrow would stop, so it's
 * plain why that enemy can't be shot.
 */
export function drawLanes(ctx: CanvasRenderingContext2D, from: Hex, lanes: BowLane[]): void {
  const a = center(from);
  for (const lane of lanes) {
    const last = lane.hexes[lane.hexes.length - 1];
    if (!last) continue;
    if (lane.target) {
      drawLaneArrow(ctx, from, last);
      continue;
    }
    // To the last hex's centre.
    const b = center(last);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    ctx.save();
    ctx.lineCap = 'square';
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = PALETTE.lapisLight;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(a.x + ux * 26, a.y + uy * 26);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }
}
