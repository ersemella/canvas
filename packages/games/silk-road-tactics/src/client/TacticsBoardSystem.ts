import {BaseSystem, hexCorners, hexDistance, hexKey, hexToPixel} from '@canvas/engine';
import type {Hex, HexLayout, SystemContext} from '@canvas/engine';
import {HEROES} from '../rules/config';
import {isFlanked, statusValue} from '../rules/board';
import {ABILITIES} from '../rules/abilities';
import {ABILITY} from '../rules/config';
import {MAPS} from '../rules/map';
import type {FightState, Unit} from '../rules/types';

/** Where the board sits on the 600×400 canvas: 9 × 7 pointy hexes of size 32. */
export const BOARD_LAYOUT: HexLayout = {orientation: 'pointy', size: 32, origin: {x: 64, y: 56}};

export type HighlightKind = 'zone' | 'move' | 'path' | 'target' | 'chosen' | 'area';

/** What the page wants drawn over the board, sent as a `tactics:board` event. */
export interface BoardScene {
  fight: FightState | null;
  highlights: {hex: Hex; kind: HighlightKind}[];
  selectedUnitId: string | null;
  /** Previewed outcome: where units end up and their health. */
  preview: {unitId: string; to: Hex | null; hpAfter: number; hpBefore: number; killed: boolean}[];
  /** Units shown at other hexes than the fight's (deployment being arranged). */
  positions?: Record<string, Hex>;
}

const SIDE_COLOR = {player: '#60a5fa', enemy: '#f87171'};
const HERO_COLOR = {bokh: '#b45309', mangudai: '#15803d', storm: '#4f46e5'};
const HIGHLIGHT: Record<HighlightKind, {fill: string; stroke: string}> = {
  zone: {fill: 'rgba(96,165,250,0.18)', stroke: 'rgba(96,165,250,0.5)'},
  move: {fill: 'rgba(255,255,255,0.18)', stroke: 'rgba(255,255,255,0.55)'},
  path: {fill: 'rgba(250,204,21,0.25)', stroke: 'rgba(250,204,21,0.8)'},
  target: {fill: 'rgba(248,113,113,0.22)', stroke: 'rgba(248,113,113,0.8)'},
  chosen: {fill: 'rgba(248,113,113,0.45)', stroke: '#fde047'},
  area: {fill: 'rgba(251,146,60,0.28)', stroke: 'rgba(251,146,60,0.9)'},
};

/**
 * Draws everything over the board's tiles (which are hex entities): tile
 * markings, highlights, hail, charging areas, units with health and
 * statuses, and the previewed outcome. Plain shapes and text (brief
 * section 9). The page drives it with `tactics:board` events.
 */
export class TacticsBoardSystem extends BaseSystem {
  // After RenderSystem (995) has drawn the tiles.
  readonly priority = 996;
  private scene: BoardScene = {fight: null, highlights: [], selectedUnitId: null, preview: []};
  private unsubscribe: (() => void) | null = null;

  onInit({events}: Omit<SystemContext, 'deltaTime'>): void {
    this.unsubscribe = events.on<BoardScene>('tactics:board', (scene) => (this.scene = scene));
  }

  onDestroy(): void {
    this.unsubscribe?.();
  }

  onUpdate({ctx}: SystemContext): void {
    const {fight} = this.scene;
    if (!fight) return;
    const map = MAPS[fight.mapId]!;
    for (const [key, tile] of Object.entries(map.tiles)) {
      const [q, r] = key.split(',').map(Number);
      drawTileMark(ctx, center({q: q!, r: r!}), tile);
    }
    for (const effect of fight.effects) drawHail(ctx, effect.hex, effect.untilSlot - fight.currentSlot + 1);
    for (const h of this.scene.highlights) fillHex(ctx, h.hex, HIGHLIGHT[h.kind]);
    for (const u of fight.units) if (u.alive && u.charging) drawCharge(ctx, u);

    const previewed = new Map(this.scene.preview.map((p) => [p.unitId, p]));
    const acting = fight.awaiting;
    for (const u of fight.units) {
      const hex = this.scene.positions?.[u.id] ?? u.hex;
      if (!u.alive || !hex) continue;
      const p = previewed.get(u.id);
      const moved = p && p.to && hexKey(p.to) !== hexKey(hex);
      drawUnit(ctx, u, hex, {
        fight,
        acting: u.id === acting,
        selected: u.id === this.scene.selectedUnitId,
        faded: Boolean(moved || p?.killed),
        hp: u.hp,
      });
      if (p && moved && !p.killed) drawUnit(ctx, u, p.to!, {fight, acting: false, selected: false, faded: false, ghost: true, hp: p.hpAfter});
      if (p && p.hpAfter !== p.hpBefore) {
        const at = center(p.to ?? hex);
        drawDamage(ctx, at.x, at.y - 22, p.hpBefore - p.hpAfter, p.killed);
      }
    }
  }
}

function center(h: Hex): {x: number; y: number} {
  return hexToPixel(h, BOARD_LAYOUT);
}

function hexPath(ctx: CanvasRenderingContext2D, h: Hex, inset = 1): void {
  const c = center(h);
  ctx.beginPath();
  hexCorners('pointy', BOARD_LAYOUT.size - inset).forEach((p, i) =>
    i === 0 ? ctx.moveTo(c.x + p.x, c.y + p.y) : ctx.lineTo(c.x + p.x, c.y + p.y)
  );
  ctx.closePath();
}

function fillHex(ctx: CanvasRenderingContext2D, h: Hex, style: {fill: string; stroke: string}): void {
  hexPath(ctx, h, 2);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** Each tile type has its own shape, not only its own colour (art direction). */
function drawTileMark(ctx: CanvasRenderingContext2D, c: {x: number; y: number}, tile: string): void {
  ctx.save();
  if (tile === 'obstacle') {
    // Ruins: stacked blocks.
    ctx.fillStyle = '#4a3f35';
    ctx.strokeStyle = '#2b241e';
    ctx.lineWidth = 1.5;
    for (const [dx, dy, w, h] of [
      [-14, 2, 13, 10],
      [1, 2, 13, 10],
      [-7, -9, 14, 10],
    ] as const) {
      ctx.fillRect(c.x + dx, c.y + dy, w, h);
      ctx.strokeRect(c.x + dx, c.y + dy, w, h);
    }
  } else if (tile === 'hazard') {
    // Quicksand: a spiral.
    ctx.strokeStyle = '#5c4320';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.2) {
      const r = 2 + a * 1.1;
      const x = c.x + Math.cos(a) * r;
      const y = c.y + Math.sin(a) * r * 0.75;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (tile === 'conceal') {
    // Sandstorm: drifting wavy lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    for (const dy of [-10, 0, 10]) {
      ctx.beginPath();
      for (let dx = -16; dx <= 16; dx += 2) {
        const y = c.y + dy + Math.sin((dx + dy) / 4) * 2.5;
        if (dx === -16) ctx.moveTo(c.x + dx, y);
        else ctx.lineTo(c.x + dx, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawHail(ctx: CanvasRenderingContext2D, h: Hex, slotsLeft: number): void {
  fillHex(ctx, h, {fill: 'rgba(186,230,253,0.45)', stroke: '#7dd3fc'});
  const c = center(h);
  ctx.fillStyle = '#e0f2fe';
  for (const [dx, dy] of [
    [-12, -12],
    [10, -14],
    [-16, 6],
    [14, 8],
    [0, 16],
  ] as const) {
    ctx.beginPath();
    ctx.arc(c.x + dx, c.y + dy, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  label(ctx, `${slotsLeft}`, c.x + 18, c.y - 20, '#0c4a6e', 10);
}

function drawCharge(ctx: CanvasRenderingContext2D, u: Unit): void {
  const {ability, target} = u.charging!;
  const radius = ability === 'volley' ? ABILITY.volley.radius : ABILITY.freeze.radius;
  ctx.save();
  ctx.setLineDash([5, 4]);
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const h = {q: target.q + q, r: target.r + r};
      if (hexDistance(h, target) > radius) continue;
      hexPath(ctx, h, 4);
      ctx.strokeStyle = SIDE_COLOR[u.side];
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.restore();
  const c = center(target);
  label(ctx, ABILITIES[ability].name, c.x, c.y + 24, SIDE_COLOR[u.side], 10);
}

function drawUnit(
  ctx: CanvasRenderingContext2D,
  u: Unit,
  hex: Hex,
  opts: {fight: FightState; acting: boolean; selected: boolean; faded: boolean; ghost?: boolean; hp: number}
): void {
  const c = center(hex);
  ctx.save();
  ctx.globalAlpha = opts.faded ? 0.35 : opts.ghost ? 0.85 : 1;
  if (opts.acting || opts.selected) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 19, 0, Math.PI * 2);
    ctx.strokeStyle = opts.acting ? '#fde047' : '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(c.x, c.y, 15, 0, Math.PI * 2);
  ctx.fillStyle = HERO_COLOR[u.hero];
  ctx.fill();
  if (opts.ghost) ctx.setLineDash([4, 3]);
  ctx.strokeStyle = SIDE_COLOR[u.side];
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.setLineDash([]);
  label(ctx, HEROES[u.hero].letter, c.x, c.y + 1, '#ffffff', 15, true);

  // Health bar.
  const w = 30;
  const frac = Math.max(0, opts.hp / u.maxHp);
  ctx.fillStyle = '#111827';
  ctx.fillRect(c.x - w / 2, c.y + 17, w, 5);
  ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#f87171';
  ctx.fillRect(c.x - w / 2, c.y + 17, w * frac, 5);

  // Status markers: I(mmobilized), S(lowed), V(ulnerable), F(lanked), ★ ultimate ready.
  if (!opts.ghost) {
    const marks: [string, string][] = [];
    if (statusValue(u, 'immobilized')) marks.push(['I', '#38bdf8']);
    if (statusValue(u, 'slowed')) marks.push(['S', '#a78bfa']);
    if (statusValue(u, 'vulnerable')) marks.push(['V', '#fb923c']);
    if (isFlanked(opts.fight, u)) marks.push(['F', '#f472b6']);
    marks.forEach(([m, color], i) => {
      ctx.beginPath();
      ctx.arc(c.x - 14 + i * 10, c.y - 18, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      label(ctx, m, c.x - 14 + i * 10, c.y - 17.5, '#111827', 8, true);
    });
  }
  ctx.restore();
}

function drawDamage(ctx: CanvasRenderingContext2D, x: number, y: number, amount: number, killed: boolean): void {
  const text = killed ? `-${amount} ✕` : amount > 0 ? `-${amount}` : `+${-amount}`;
  ctx.save();
  ctx.font = 'bold 13px monospace';
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = 'rgba(17,24,39,0.85)';
  ctx.fillRect(x - w / 2, y - 9, w, 17);
  ctx.restore();
  label(ctx, text, x, y, amount >= 0 ? '#fca5a5' : '#86efac', 13, true);
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size: number, bold = false): void {
  ctx.save();
  ctx.font = `${bold ? 'bold ' : ''}${size}px system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}
