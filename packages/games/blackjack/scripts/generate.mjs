/**
 * Generates the Blackjack game.json manifest.
 *
 * Run from repo root: node packages/games/blackjack/scripts/generate.mjs
 */

import {writeFileSync} from 'fs';
import {resolve, dirname} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '../game.json');

// ── Layout constants ───────────────────────────────────────────────────────

const W = 500;
const H = 520;
const CX = W / 2; // 250

const CARD_W = 60;
const CARD_H = 84;
const CARD_GAP = 8;
const MAX_CARDS = 10;

const DEALER_CARD_Y = 143;
const PLAYER_CARD_Y = 313;

const FELT = '#0a5c2a';
const WHITE = '#ffffff';
const LABEL_COLOR = '#a8d5a2';
const GOLD = '#f1c40f';
const DIM = '#555555';
const BTN_BET = '#7f8c8d';
const BTN_DEAL = '#3498db';

// ── Helper builders ────────────────────────────────────────────────────────

function transform(x, y) {
  return {position: {x, y}, rotation: 0, scale: {x: 1, y: 1}};
}

function rect(w, h, color, opts = {}) {
  return {
    width: w,
    height: h,
    color,
    zIndex: opts.zIndex ?? 1,
    visible: opts.visible ?? true,
    ...(opts.borderColor ? {borderColor: opts.borderColor} : {}),
    ...(opts.borderWidth !== undefined ? {borderWidth: opts.borderWidth} : {}),
    ...(opts.radius !== undefined ? {radius: opts.radius} : {}),
  };
}

function text(t, color, size, opts = {}) {
  return {
    renderType: 'text',
    text: t,
    textColor: color,
    fontSize: size,
    bold: opts.bold ?? false,
    textAnchor: opts.anchor ?? 'center',
    zIndex: opts.zIndex ?? 2,
    visible: opts.visible ?? true,
  };
}

function clickable() {
  return {enabled: true};
}

function childOf(parentId, offsetX = 0, offsetY = 0, zOff = 1) {
  return {parentId, offsetX, offsetY, zIndexOffset: zOff};
}

// ── Button factory ─────────────────────────────────────────────────────────
// Returns [bgEntity, labelEntity]

function makeButton(id, x, y, w, h, label, color) {
  const bg = {
    id,
    components: {
      Transform: transform(x, y),
      Renderable: rect(w, h, color, {radius: 4, zIndex: 5}),
      Clickable: clickable(),
    },
  };
  const lbl = {
    id: `${id}-label`,
    components: {
      Transform: transform(x, y),
      Renderable: text(label, '#ffffff', 12, {bold: true, zIndex: 6}),
      ChildOf: childOf(id, 0, 0, 1),
    },
  };
  return [bg, lbl];
}

// ── Card slot factory ──────────────────────────────────────────────────────
// All slots start invisible; BlackjackSystem positions and reveals them.

function makeCardSlot(id, x, y) {
  const bg = {
    id,
    components: {
      Transform: transform(x, y),
      Renderable: rect(CARD_W, CARD_H, '#1a5c96', {
        radius: 4,
        borderColor: '#0d3d6b',
        borderWidth: 1,
        visible: false,
        zIndex: 10,
      }),
    },
  };
  const lbl = {
    id: `${id}-label`,
    components: {
      Transform: transform(x, y),
      Renderable: text('', WHITE, 14, {bold: true, zIndex: 11, visible: false}),
      ChildOf: childOf(id, 0, 0, 1),
    },
  };
  return [bg, lbl];
}

// ── Build entities ─────────────────────────────────────────────────────────

const entities = [];

// Background
entities.push({
  id: 'bg',
  components: {
    Transform: transform(CX, H / 2),
    Renderable: rect(W, H, FELT, {zIndex: 0}),
  },
});

// Title
entities.push({
  id: 'title',
  components: {
    Transform: transform(CX, 22),
    Renderable: text('BLACKJACK', GOLD, 22, {bold: true, zIndex: 3}),
  },
});

// ── Dealer section ─────────────────────────────────────────────────────────

entities.push({
  id: 'dealer-label',
  components: {
    Transform: transform(40, 58),
    Renderable: text('DEALER', LABEL_COLOR, 11, {bold: true, anchor: 'top-left', zIndex: 3}),
  },
});

entities.push({
  id: 'dealer-value',
  components: {
    Transform: transform(40, 74),
    Renderable: text('', WHITE, 15, {bold: true, anchor: 'top-left', zIndex: 3}),
  },
});

// Dealer card slots
for (let i = 0; i < MAX_CARDS; i++) {
  entities.push(...makeCardSlot(`d-card-${i}`, CX, DEALER_CARD_Y));
}

// ── Player section ─────────────────────────────────────────────────────────

entities.push({
  id: 'player-label',
  components: {
    Transform: transform(40, 228),
    Renderable: text('YOUR HAND', LABEL_COLOR, 11, {bold: true, anchor: 'top-left', zIndex: 3}),
  },
});

entities.push({
  id: 'player-value',
  components: {
    Transform: transform(40, 244),
    Renderable: text('', WHITE, 15, {bold: true, anchor: 'top-left', zIndex: 3}),
  },
});

// Player card slots
for (let i = 0; i < MAX_CARDS; i++) {
  entities.push(...makeCardSlot(`p-card-${i}`, CX, PLAYER_CARD_Y));
}

// ── Status + info row ──────────────────────────────────────────────────────

entities.push({
  id: 'status-text',
  components: {
    Transform: transform(CX, 393),
    Renderable: text('Place your bet and deal', GOLD, 15, {bold: true, zIndex: 3}),
  },
});

entities.push({
  id: 'balance-text',
  components: {
    Transform: transform(CX, 423),
    Renderable: text('Balance: $1000', WHITE, 12, {zIndex: 3}),
  },
});

// ── Bet controls row (y=454) ───────────────────────────────────────────────

entities.push(...makeButton('bet-down-btn', 162, 454, 70, 28, '-$10', BTN_BET));

entities.push({
  id: 'bet-amount',
  components: {
    Transform: transform(CX, 454),
    Renderable: text('$10', WHITE, 16, {bold: true, zIndex: 3}),
  },
});

entities.push(...makeButton('bet-up-btn', 338, 454, 70, 28, '+$10', BTN_BET));

// ── Action buttons row (y=490) ─────────────────────────────────────────────

entities.push(...makeButton('hit-btn', 75, 490, 80, 32, 'HIT', DIM));
entities.push(...makeButton('stand-btn', 195, 490, 80, 32, 'STAND', DIM));
entities.push(...makeButton('double-btn', 315, 490, 80, 32, 'DOUBLE', DIM));
entities.push(...makeButton('deal-btn', 425, 490, 70, 32, 'DEAL', BTN_DEAL));

// ── BlackjackConfig entity ─────────────────────────────────────────────────

entities.push({
  id: 'blackjack-config',
  components: {
    BlackjackConfig: {
      startingBalance: 1000,
      minBet: 10,
      numDecks: 1,
      dealerHitSoft17: false,
      dealerCenterY: DEALER_CARD_Y,
      playerCenterY: PLAYER_CARD_Y,
      canvasCenterX: CX,
      cardWidth: CARD_W,
      cardHeight: CARD_H,
      cardGap: CARD_GAP,
      maxCards: MAX_CARDS,
      dealerCardPrefix: 'd-card',
      playerCardPrefix: 'p-card',
      balanceTextId: 'balance-text',
      betTextId: 'bet-amount',
      dealerValueTextId: 'dealer-value',
      playerValueTextId: 'player-value',
      statusTextId: 'status-text',
      hitButtonId: 'hit-btn',
      standButtonId: 'stand-btn',
      doubleButtonId: 'double-btn',
      dealButtonId: 'deal-btn',
      betUpButtonId: 'bet-up-btn',
      betDownButtonId: 'bet-down-btn',
    },
  },
});

// ── Manifest ───────────────────────────────────────────────────────────────

const manifest = {
  meta: {
    title: 'Blackjack',
    description: 'Single-player Blackjack against the house. Start with $1,000 — min bet $10.',
  },
  canvas: {width: W, height: H},
  systems: ['MouseSystem', 'ClickSystem', 'BlackjackSystem'],
  events: {onDeath: 'blackjack:gameover'},
  scene: {
    name: 'blackjack-main',
    entities,
  },
};

writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log(`Written: ${outPath} (${entities.length} entities)`);
