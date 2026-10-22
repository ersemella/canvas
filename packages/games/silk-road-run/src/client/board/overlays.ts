/**
 * What the turn being planned draws over the board: highlighted hexes,
 * a move's path, an ability's range, the bow's lanes, Throw's arc, and
 * charging areas.
 */
import {hexCorners, hexDistance, hexKey, pixelToHex} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {onMap} from '../../rules/board';
import {ABILITIES} from '../../rules/abilities';
import type {MapData} from '../../rules/map';
import type {Unit} from '../../rules/types';
import {BOARD_LAYOUT} from '../layout';
import {PALETTE, paletteAlpha} from '../palette';
import {
  ENEMY_CHARGE_RED,
  HEX_SCALE,
  TARGET_RGB,
  center,
  hexPath,
  label,
  pixelShadow,
} from './pixels';
import type {HighlightStyle} from './pixels';
import type {HighlightKind} from './scene';

const targeting = (fill: number, stroke: number): HighlightStyle => ({
  fill: `rgba(${TARGET_RGB},${fill})`,
  stroke: `rgba(${TARGET_RGB},${stroke})`,
});
export const HIGHLIGHT: Record<HighlightKind, HighlightStyle> = {
  /** The steps of a planned move. */
  path: targeting(0.25, 0.8),
  /** Hexes an ability can target, or a move can end on: outlined solid, so it shows over a unit's tint. */
  target: targeting(0.14, 0.9),
  /** A unit an ability reaches only after a step (Pin): dashed, as the step's hexes are. */
  reach: {...targeting(0.08, 0.9), dash: [6, 4]},
  /** An ability's second pick, once its target is (Throw's landing, Pin's step): dashed, so it never reads as a target. */
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
 * A throw being aimed: a dashed arc swinging around the thrower (`around`)
 * from the unit thrown to where it lands, the way it goes in the playback,
 * with a head there. It starts and stops clear of the sprites' middles.
 */
export function drawThrowArc(ctx: CanvasRenderingContext2D, from: Hex, around: Hex, to: Hex): void {
  const c = center(around);
  const a = center(from);
  const b = center(to);
  const radius = Math.hypot(a.x - c.x, a.y - c.y);
  const start = Math.atan2(a.y - c.y, a.x - c.x);
  // The shorter way round.
  let turn = Math.atan2(b.y - c.y, b.x - c.x) - start;
  if (turn > Math.PI) turn -= 2 * Math.PI;
  if (turn < -Math.PI) turn += 2 * Math.PI;
  const at = (t: number) => ({
    x: c.x + radius * Math.cos(start + turn * t),
    y: c.y + radius * Math.sin(start + turn * t),
  });
  // Clear of each end's sprite: about a third of a hex along the arc.
  const margin = Math.min(0.35, 22 / (radius * Math.abs(turn) || 1));
  const points = Array.from({length: 17}, (_, i) => at(margin + (i / 16) * (1 - 2 * margin)));
  const end = points[points.length - 1]!;
  const prev = points[points.length - 2]!;
  const len = Math.hypot(end.x - prev.x, end.y - prev.y) || 1;
  const ux = (end.x - prev.x) / len;
  const uy = (end.y - prev.y) / len;
  ctx.save();
  ctx.strokeStyle = PALETTE.lapisLight;
  ctx.fillStyle = PALETTE.lapisLight;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'square';
  pixelShadow(ctx, 1);
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(end.x + ux * 9, end.y + uy * 9);
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
  const corners = hexCorners('pointy', BOARD_LAYOUT.size);
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
 * The bow's lanes from `from`: to a unit it may target, a light lapis
 * arrow pointing at it; along any other lane (blocked by an ally, a ruin
 * or the edge), a faint dashed line to where the arrow would stop, so it's
 * plain why that enemy can't be shot.
 */
export function drawLanes(
  ctx: CanvasRenderingContext2D,
  from: Hex,
  lanes: {hexes: Hex[]; target: boolean}[]
): void {
  const a = center(from);
  for (const lane of lanes) {
    const last = lane.hexes[lane.hexes.length - 1];
    if (!last) continue;
    const b = center(last);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const start = {x: a.x + ux * 26, y: a.y + uy * 26};
    ctx.save();
    ctx.lineCap = 'square';
    if (lane.target) {
      // The head stops at the target's hex, pointing at it.
      const end = {x: b.x - ux * 34, y: b.y - uy * 34};
      ctx.strokeStyle = PALETTE.lapisLight;
      ctx.fillStyle = PALETTE.lapisLight;
      ctx.lineWidth = 3;
      pixelShadow(ctx, 1);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x - ux * 4, end.y - uy * 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(end.x + ux * 8, end.y + uy * 8);
      ctx.lineTo(end.x - ux * 6 - uy * 8, end.y - uy * 6 + ux * 8);
      ctx.lineTo(end.x - ux * 6 + uy * 8, end.y - uy * 6 - ux * 8);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = PALETTE.lapisLight;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * A charging ability's area, until it triggers: light blue for your own, as all
 * your targeting is; for an enemy's a red outline only, so it reads as a
 * threat without looking like the tint under an enemy unit.
 */
export function drawCharge(ctx: CanvasRenderingContext2D, map: MapData, u: Unit): void {
  const {ability, target} = u.charging!;
  const radius = ABILITIES[ability].radius ?? 0;
  const rgb = u.side === 'enemy' ? ENEMY_CHARGE_RED : TARGET_RGB;
  ctx.save();
  ctx.setLineDash([5, 4]);
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const h = {q: target.q + q, r: target.r + r};
      if (hexDistance(h, target) > radius || !onMap(map, h)) continue;
      hexPath(ctx, h, 4);
      if (u.side !== 'enemy') {
        ctx.fillStyle = `rgba(${rgb},0.2)`;
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(${rgb},0.9)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.restore();
  const c = center(target);
  label(ctx, ABILITIES[ability].name, c.x, c.y + 24 * HEX_SCALE, `rgb(${rgb})`, 10);
}
