// Regenerates game.json from the layout constants and config.
// Run: node scripts/generate.mjs
import {writeFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CARD_W = 70;
const CARD_H = 96;
const COL_STEP = 82;
const MARGIN_X = 14;
const MARGIN_Y = 10;
const TOP_Y = MARGIN_Y + CARD_H / 2;   // 58
const TABLEAU_Y = 168;
const FACE_UP_STEP = 28;
const FACE_DOWN_STEP = 20;
const colX = (col) => MARGIN_X + CARD_W / 2 + col * COL_STEP;

const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const slotEntity = (id, x, y, isTableau = false, isStock = false, isDropTarget = false) => ({
  id,
  tags: ['slot'],
  components: {
    Transform: {position: {x, y}, rotation: 0, scale: {x: 1, y: 1}},
    Renderable: {width: CARD_W, height: CARD_H, color: '#2a4a2a', zIndex: -1, visible: true},
    PileLayout: {
      pileId: id,
      anchorX: x,
      anchorY: y,
      expandedStep: isTableau ? FACE_UP_STEP : 0,
      collapsedStep: isTableau ? FACE_DOWN_STEP : 0,
      trackTop: isTableau,
    },
    ...(isStock ? {Clickable: {enabled: true}} : {}),
    ...(isDropTarget ? {DropTarget: {targetId: id}} : {}),
  },
});

const manifest = {
  canvas: {width: 700, height: 580},
  systems: ['MouseSystem', 'DragDropSystem', 'ClickSystem', 'CardPileSystem', 'PileLayoutSystem'],
  events: {onDeath: 'solitaire:won'},
  scene: {
    name: 'solitaire',
    entities: [
      {
        id: 'game-config',
        components: {
          CardPileConfig: {
            pileIds: ['stock', 'waste', 'f0', 'f1', 'f2', 'f3', 't0', 't1', 't2', 't3', 't4', 't5', 't6'],
            colorGroups: {red: ['♥', '♦'], black: ['♠', '♣']},
            rankLabels: RANK_LABELS,
            dropRules: [
              {
                target: {prefix: 'f'},
                maxGroupSize: 1,
                conditions: [{type: 'sameSuit'}, {type: 'rankDelta', value: 1}],
                emptyConditions: [{type: 'rankEquals', value: 1}],
              },
              {
                target: {prefix: 't'},
                conditions: [{type: 'alternateColor'}, {type: 'rankDelta', value: -1}],
                emptyConditions: [{type: 'rankEquals', value: 13}],
              },
            ],
            behaviors: [
              {type: 'dealFromStock', stockId: 'stock', wasteId: 'waste', count: 1},
              {type: 'flipOriginTopOnDrop', originMatch: {prefix: 't'}},
            ],
            winCondition: {type: 'allPilesFull', piles: ['f0', 'f1', 'f2', 'f3'], size: 13},
            events: {onWin: 'solitaire:won'},
          },
        },
      },
      {
        id: 'deck-config',
        components: {
          DeckConfig: {
            suits: ['♠', '♥', '♦', '♣'],
            ranks: 13,
            cardWidth: CARD_W,
            cardHeight: CARD_H,
            dealPattern: {type: 'klondike', tableauPrefix: 't', stockId: 'stock', tableauCount: 7},
          },
        },
      },
      slotEntity('stock', colX(0), TOP_Y, false, true, false),
      slotEntity('waste', colX(1), TOP_Y, false, false, false),
      slotEntity('f0', colX(3), TOP_Y, false, false, true),
      slotEntity('f1', colX(4), TOP_Y, false, false, true),
      slotEntity('f2', colX(5), TOP_Y, false, false, true),
      slotEntity('f3', colX(6), TOP_Y, false, false, true),
      ...Array.from({length: 7}, (_, i) => slotEntity(`t${i}`, colX(i), TABLEAU_Y, true, false, true)),
      {
        id: 'stock-label',
        components: {
          Transform: {position: {x: colX(0), y: TOP_Y}, rotation: 0, scale: {x: 1, y: 1}},
          Renderable: {renderType: 'text', width: 0, height: 0, zIndex: -1, visible: true, text: '↩', textColor: '#88cc88', fontSize: 22},
        },
      },
    ],
  },
};

const outPath = join(__dirname, '..', 'game.json');
writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log(`Written: ${outPath}`);
