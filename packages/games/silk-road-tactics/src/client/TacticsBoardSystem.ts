import {BaseSystem, hexCorners, hexDistance, hexEquals, hexKey, hexToPixel} from '@canvas/engine';
import type {EventBus, Hex, SystemContext} from '@canvas/engine';
import {HEROES} from '../rules/config';
import {isFlanked, statusValue} from '../rules/board';
import {ABILITIES} from '../rules/abilities';
import {ABILITY} from '../rules/config';
import {hailInfo, TILE_INFO} from '../rules/info';
import {MAPS, tileAt} from '../rules/map';
import {unitName} from '../rules/resolve';
import type {FightState, Unit} from '../rules/types';
import {BOARD_LAYOUT, SCENE_SIZE, TRACK_AREA, trackCards} from './layout';
import type {TrackCard} from './layout';
import type {TacticsHoverPayload} from './TacticsInputSystem';

export {BOARD_LAYOUT, SCENE_SIZE};

export type HighlightKind = 'zone' | 'move' | 'path' | 'target' | 'chosen' | 'area' | 'lane' | 'inspect';

/** What the page wants drawn over the board, sent as a `tactics:board` event. */
export interface BoardScene {
  fight: FightState | null;
  highlights: {hex: Hex; kind: HighlightKind}[];
  selectedUnitId: string | null;
  /** Previewed outcome: where units end up and their health. */
  preview: {unitId: string; to: Hex | null; hpAfter: number; hpBefore: number; killed: boolean}[];
  /** Units shown at other hexes than the fight's (deployment being arranged). */
  positions?: Record<string, Hex>;
  /** Where the acting unit's card lands after the planned turn: a ghost card on the track. */
  previewSlot?: number | null;
  /** Arrow flights to draw (the bow's lanes): `hits` when it ends on a unit. */
  arrows?: {from: Hex; to: Hex; hits: boolean}[];
  /** The planned turn's steps, numbered in the order they resolve, at the hex each happens. */
  steps?: {hex: Hex; n: number}[];
}

const SIDE_COLOR = {player: '#60a5fa', enemy: '#f87171'};
const HERO_COLOR = {bokh: '#b45309', mangudai: '#15803d', storm: '#4f46e5'};
const SHORT_NAME = {bokh: 'Bökh', mangudai: 'Mangudai', storm: 'Storm'};
interface HighlightStyle {
  fill: string;
  stroke: string;
  dash?: number[];
}
const HIGHLIGHT: Record<HighlightKind, HighlightStyle> = {
  zone: {fill: 'rgba(96,165,250,0.18)', stroke: 'rgba(96,165,250,0.5)'},
  move: {fill: 'rgba(255,255,255,0.18)', stroke: 'rgba(255,255,255,0.55)'},
  path: {fill: 'rgba(250,204,21,0.25)', stroke: 'rgba(250,204,21,0.8)'},
  target: {fill: 'rgba(248,113,113,0.22)', stroke: 'rgba(248,113,113,0.8)'},
  chosen: {fill: 'rgba(248,113,113,0.45)', stroke: '#fde047'},
  area: {fill: 'rgba(251,146,60,0.28)', stroke: 'rgba(251,146,60,0.9)'},
  /** Hexes an arrow flies over. */
  lane: {fill: 'rgba(253,224,71,0.14)', stroke: 'rgba(253,224,71,0.35)'},
  /** Where an inspected unit could move. */
  inspect: {fill: 'rgba(192,132,252,0.12)', stroke: 'rgba(192,132,252,0.75)', dash: [5, 3]},
};

/**
 * Draws everything over the board's tiles (which are hex entities): the
 * track of cards along the top (3.1, as in Mana Khemia), tile markings,
 * highlights, arrow lanes, hail, charging areas, units with health and
 * statuses, the previewed outcome, and a tooltip for the hex under the
 * mouse. Plain shapes and text (brief section 9). The page drives it with
 * `tactics:board` events; taps come from `TacticsInputSystem`.
 */
export class TacticsBoardSystem extends BaseSystem {
  // After RenderSystem (995) has drawn the tiles.
  readonly priority = 996;
  private scene: BoardScene = {fight: null, highlights: [], selectedUnitId: null, preview: []};
  private hover: TacticsHoverPayload = {hex: null, unitId: null};
  private cleanup: (() => void)[] = [];

  onInit({events}: Omit<SystemContext, 'deltaTime'>): void {
    const bus: EventBus = events;
    this.cleanup.push(bus.on<BoardScene>('tactics:board', (scene) => (this.scene = scene)));
    this.cleanup.push(bus.on<TacticsHoverPayload>('tactics:hover', (hover) => (this.hover = hover)));
  }

  onDestroy(): void {
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
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
    for (const a of this.scene.arrows ?? []) drawArrow(ctx, a.from, a.to, a.hits);
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
        selected: u.id === this.scene.selectedUnitId || u.id === this.hover.unitId,
        faded: Boolean(moved || p?.killed),
        hp: u.hp,
      });
      if (p && moved && !p.killed) drawUnit(ctx, u, p.to!, {fight, acting: false, selected: false, faded: false, ghost: true, hp: p.hpAfter});
      if (p && p.hpAfter !== p.hpBefore) {
        const at = center(p.to ?? hex);
        drawDamage(ctx, at.x, at.y - 22, p.hpBefore - p.hpAfter, p.killed);
      }
    }

    const badgesAt = new Map<string, number>();
    for (const step of this.scene.steps ?? []) {
      const k = hexKey(step.hex);
      const i = badgesAt.get(k) ?? 0;
      badgesAt.set(k, i + 1);
      drawStepBadge(ctx, step.hex, step.n, i);
    }

    if (fight.phase !== 'deploy') {
      drawTrack(ctx, fight, trackCards(fight, this.scene.previewSlot ?? null), {
        selected: this.scene.selectedUnitId,
        hovered: this.hover.unitId,
      });
    }
    if (this.hover.hex) drawHover(ctx, fight, this.hover.hex, this.scene.positions);
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

function fillHex(ctx: CanvasRenderingContext2D, h: Hex, style: HighlightStyle): void {
  ctx.save();
  hexPath(ctx, h, style.dash ? 4 : 2);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.setLineDash(style.dash ?? []);
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** An arrow's flight from the archer to where it stops: solid with a head if it hits, dashed if not. */
function drawArrow(ctx: CanvasRenderingContext2D, from: Hex, to: Hex, hits: boolean): void {
  const a = center(from);
  const b = center(to);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len === 0) return;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  // Start clear of the archer's circle; stop short of a target's.
  const sx = a.x + ux * 20;
  const sy = a.y + uy * 20;
  const ex = b.x - ux * (hits ? 18 : 0);
  const ey = b.y - uy * (hits ? 18 : 0);
  ctx.save();
  ctx.strokeStyle = hits ? '#fde047' : 'rgba(253,224,71,0.6)';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = hits ? 2.5 : 2;
  ctx.setLineDash(hits ? [] : [6, 5]);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);
  if (hits) {
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - ux * 9 - uy * 5, ey - uy * 9 + ux * 5);
    ctx.lineTo(ex - ux * 9 + uy * 5, ey - uy * 9 - ux * 5);
    ctx.closePath();
    ctx.fill();
  } else {
    // Where a miss falls: a small cross.
    ctx.beginPath();
    ctx.moveTo(ex - 4, ey - 4);
    ctx.lineTo(ex + 4, ey + 4);
    ctx.moveTo(ex + 4, ey - 4);
    ctx.lineTo(ex - 4, ey + 4);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A numbered step badge on a hex's left edge, clear of the status markers
 * and damage labels above a unit; a second one on the same hex sits on the right.
 */
function drawStepBadge(ctx: CanvasRenderingContext2D, h: Hex, n: number, index: number): void {
  const c = center(h);
  const x = c.x + (index === 0 ? -21 : 21);
  const y = c.y;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 7.5, 0, Math.PI * 2);
  ctx.fillStyle = '#fde047';
  ctx.fill();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  label(ctx, `${n}`, x, y + 0.5, '#111827', 10, true);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * The track as a row of cards in turn order, Mana Khemia style: each shows
 * its slot, the unit and its health; the acting card is first and marked
 * NOW, and a dashed card shows where the planned turn would put it.
 */
function drawTrack(
  ctx: CanvasRenderingContext2D,
  fight: FightState,
  cards: TrackCard[],
  opts: {selected: string | null; hovered: string | null}
): void {
  const {x, y, width, height} = TRACK_AREA;
  ctx.save();
  roundRect(ctx, x, y, width, height, 8);
  ctx.fillStyle = 'rgba(17,24,39,0.92)';
  ctx.fill();
  ctx.translate(x + 17, y + height / 2);
  ctx.rotate(-Math.PI / 2);
  label(ctx, 'TRACK', 0, 0, '#9ca3af', 10, true);
  ctx.restore();

  for (const card of cards) {
    const u = fight.units.find((v) => v.id === card.unitId)!;
    const acting = !card.ghost && u.id === fight.awaiting;
    const {x: cx, y: cy, w, h} = card;
    ctx.save();
    if (card.ghost) ctx.globalAlpha = 0.75;
    roundRect(ctx, cx, cy, w, h, 6);
    ctx.fillStyle = card.ghost ? 'rgba(253,224,71,0.08)' : u.side === 'player' ? '#1e3a8a' : '#7f1d1d';
    ctx.fill();
    ctx.setLineDash(card.ghost ? [4, 3] : []);
    ctx.strokeStyle = card.ghost || acting ? '#fde047' : u.id === opts.selected || u.id === opts.hovered ? '#ffffff' : SIDE_COLOR[u.side];
    ctx.lineWidth = acting || card.ghost ? 2.5 : 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    const mid = cx + w / 2;
    label(ctx, `${card.slot}`, mid, cy + 10, card.ghost ? '#fde047' : '#ffffff', 12, true);

    ctx.beginPath();
    ctx.arc(mid, cy + 32, 12, 0, Math.PI * 2);
    ctx.fillStyle = HERO_COLOR[u.hero];
    ctx.fill();
    ctx.strokeStyle = SIDE_COLOR[u.side];
    ctx.lineWidth = 2;
    ctx.stroke();
    label(ctx, HEROES[u.hero].letter, mid, cy + 33, '#ffffff', 12, true);

    if (!card.ghost) {
      const bw = w - 14;
      const frac = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = '#111827';
      ctx.fillRect(cx + 7, cy + 47, bw, 3);
      ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#f87171';
      ctx.fillRect(cx + 7, cy + 47, bw * frac, 3);
    }
    const caption = card.ghost ? 'lands' : u.charging ? `${ABILITIES[u.charging.ability].name}!` : acting ? 'NOW' : SHORT_NAME[u.hero];
    label(ctx, caption, mid, cy + h - 9, card.ghost || acting ? '#fde047' : u.charging ? '#d8b4fe' : '#d1d5db', 9, acting || Boolean(u.charging));
    ctx.restore();
  }
}

/** The hovered hex: outlined, with a tooltip of its tile, hail and unit. */
function drawHover(ctx: CanvasRenderingContext2D, fight: FightState, h: Hex, positions?: Record<string, Hex>): void {
  fillHex(ctx, h, {fill: 'rgba(255,255,255,0.08)', stroke: '#ffffff'});
  const map = MAPS[fight.mapId]!;
  const lines: {text: string; color: string; bold?: boolean}[] = [];
  const unit = fight.units.find((u) => {
    const at = positions?.[u.id] ?? u.hex;
    return u.alive && at && hexEquals(at, h);
  });
  if (unit) {
    lines.push({text: `${unitName(unit)}  ${unit.hp}/${unit.maxHp}`, color: SIDE_COLOR[unit.side], bold: true});
  }
  const tile = tileAt(map, h);
  if (tile !== 'sand' || !unit) {
    const info = TILE_INFO[tile];
    lines.push({text: tile === 'sand' ? info.name : `${info.name}: ${info.short}`, color: '#f3f4f6', bold: !unit});
  }
  const hail = fight.effects.find((e) => hexEquals(e.hex, h));
  if (hail) {
    const info = hailInfo(hail, fight.currentSlot);
    lines.push({text: `${info.name}: ${info.short}`, color: '#7dd3fc'});
  }
  ctx.save();
  ctx.font = 'bold 11px system-ui, sans-serif';
  const w = Math.max(...lines.map((l) => ctx.measureText(l.text).width)) + 14;
  const lh = 15;
  const boxH = lines.length * lh + 8;
  const c = center(h);
  const bx = Math.min(SCENE_SIZE.width - w - 4, Math.max(4, c.x - w / 2));
  // Above the hex, or below it when that would cover the track.
  const above = c.y - 36 - boxH;
  const by = above < TRACK_AREA.y + TRACK_AREA.height + 2 ? c.y + 36 : above;
  roundRect(ctx, bx, by, w, boxH, 5);
  ctx.fillStyle = 'rgba(17,24,39,0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  lines.forEach((l, i) => {
    ctx.save();
    ctx.font = `${l.bold ? 'bold ' : ''}11px system-ui, sans-serif`;
    ctx.fillStyle = l.color;
    ctx.textBaseline = 'middle';
    ctx.fillText(l.text, bx + 7, by + 4 + lh / 2 + i * lh);
    ctx.restore();
  });
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
