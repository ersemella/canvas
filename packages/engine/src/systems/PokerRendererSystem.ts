/**
 * PokerRendererSystem — direct canvas rendering for the poker table area.
 *
 * Runs at priority 996 (after RenderSystem at 995). RenderSystem clears the
 * full canvas and draws panel entities; this system then paints the poker
 * table over the left 820px without touching the panel column.
 *
 * Reads game state from the sharedPokerState module shim, updated by
 * PokerSystem after every state change.
 */

import {BaseSystem} from 'core/System';
import type {SystemContext} from 'core/System';
import {sharedPokerState} from 'systems/pokerGameState';
import type {PokerGameState, PokerCard} from 'systems/pokerTypes';

const TABLE_WIDTH = 820;
const TABLE_CENTER_X = 400;
const TABLE_CENTER_Y = 285;

const SEAT_POSITIONS: [number, number][] = [
  [400, 472], // P0 hero
  [148, 398], // P1
  [125, 160], // P2
  [400, 125], // P3
  [675, 160], // P4
  [652, 398], // P5
];

const COMMUNITY_X = TABLE_CENTER_X;
const COMMUNITY_Y = TABLE_CENTER_Y - 7;

function rankStr(rank: number): string {
  if (rank === 14) return 'A';
  if (rank === 13) return 'K';
  if (rank === 12) return 'Q';
  if (rank === 11) return 'J';
  return String(rank);
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  card: PokerCard | null,
  faceUp: boolean
): void {
  const w = 50, h = 70;
  const cx = x - w / 2;
  const cy = y - h / 2;

  ctx.beginPath();
  ctx.roundRect(cx, cy, w, h, 4);

  if (!card || !faceUp) {
    ctx.fillStyle = '#1a5276';
    ctx.fill();
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.stroke();
    return;
  }

  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.stroke();

  const isRed = card.suit === '♥' || card.suit === '♦';
  ctx.fillStyle = isRed ? '#c0392b' : '#1a1a2e';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(rankStr(card.rank), cx + w / 2, cy + 4);
  ctx.font = '16px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText(card.suit, cx + w / 2, cy + h / 2 + 6);
}

export class PokerRendererSystem extends BaseSystem {
  readonly priority = 996;

  onUpdate({ctx, canvas}: SystemContext): void {
    const gs = sharedPokerState;
    if (!gs) {
      // Draw blank table background so panel entities remain visible
      ctx.fillStyle = '#2e3f5c';
      ctx.fillRect(0, 0, TABLE_WIDTH, canvas.height);
      return;
    }

    this.draw(ctx, canvas.height, gs);
  }

  private draw(ctx: CanvasRenderingContext2D, canvasHeight: number, gs: PokerGameState): void {
    // Fill table area only — panel column already drawn by RenderSystem
    ctx.fillStyle = '#2e3f5c';
    ctx.fillRect(0, 0, TABLE_WIDTH, canvasHeight);

    // Oval table
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(TABLE_CENTER_X, TABLE_CENTER_Y, 315, 195, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1a7a3a';
    ctx.fill();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.restore();

    // Felt inner ring
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(TABLE_CENTER_X, TABLE_CENTER_Y, 300, 180, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#145a2a';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Community cards
    const totalComm = 5;
    const cardW = 50, gap = 8;
    const totalWidth = totalComm * cardW + (totalComm - 1) * gap;
    const startX = COMMUNITY_X - totalWidth / 2 + cardW / 2;
    for (let i = 0; i < totalComm; i++) {
      const card = gs.communityCards[i] ?? null;
      drawCard(ctx, startX + i * (cardW + gap), COMMUNITY_Y, card, card !== null);
    }

    // Pot
    ctx.save();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Pot: $${gs.pot}`, COMMUNITY_X, COMMUNITY_Y - 45);
    ctx.restore();

    // Player seats
    for (let i = 0; i < gs.players.length; i++) {
      const player = gs.players[i]!;
      const pos = SEAT_POSITIONS[i];
      if (!pos) continue;
      const [sx, sy] = pos;
      const isActing = gs.actingIndex === i && (gs.phase !== 'waiting' && gs.phase !== 'showdown');

      // Seat background
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(sx, sy, 65, 38, 0, 0, Math.PI * 2);
      if (player.folded) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
      } else if (isActing) {
        ctx.fillStyle = 'rgba(255,215,0,0.3)';
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
      }
      ctx.fill();
      if (isActing) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();

      // Name + chips + bet
      ctx.save();
      ctx.fillStyle = player.folded ? '#888' : '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(player.name, sx, sy - 12);
      ctx.fillStyle = '#ffd700';
      ctx.font = '11px sans-serif';
      ctx.fillText(`$${player.chips}`, sx, sy + 4);
      if (player.currentBet > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.fillText(`bet: $${player.currentBet}`, sx, sy + 16);
      }
      ctx.restore();

      // Dealer / SB / BB badge
      const badgeX = sx + 50;
      const badgeY = sy - 20;
      if (player.isDealer) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('D', badgeX, badgeY);
        ctx.restore();
      } else if (player.isSB) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#3498db';
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SB', badgeX, badgeY);
        ctx.restore();
      } else if (player.isBB) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#e74c3c';
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BB', badgeX, badgeY);
        ctx.restore();
      }

      // Hole cards
      if (player.holeCards && !player.folded) {
        const faceUp = i === 0 || gs.phase === 'showdown';
        const cardY = sy - 65;
        drawCard(ctx, sx - 28, cardY, player.holeCards[0], faceUp);
        drawCard(ctx, sx + 28, cardY, player.holeCards[1], faceUp);
      }
    }

    // Showdown overlay
    if (gs.showdownResult) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(160, 218, 480, 80);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(gs.showdownResult, TABLE_CENTER_X, 258);
      ctx.restore();
    }
  }
}
