import type {GameModule, SceneData, EntityData} from '@canvas/engine';
import {SystemRegistry, MouseSystem, DragDropSystem} from '@canvas/engine';
import {SolitaireSystem} from './SolitaireSystem';
import {CARD_W, CARD_H, TOP_Y, TABLEAU_Y, suits, rankLabels, redSuits, colX} from './constants';

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function buildScene(): SceneData {
  const entities: EntityData[] = [];

  // Slot entities
  const slots: Array<{id: string; x: number; y: number}> = [
    {id: 'stock', x: colX(0), y: TOP_Y},
    {id: 'waste', x: colX(1), y: TOP_Y},
    {id: 'f0', x: colX(3), y: TOP_Y},
    {id: 'f1', x: colX(4), y: TOP_Y},
    {id: 'f2', x: colX(5), y: TOP_Y},
    {id: 'f3', x: colX(6), y: TOP_Y},
    ...Array.from({length: 7}, (_, i) => ({id: `t${i}`, x: colX(i), y: TABLEAU_Y})),
  ];

  for (const slot of slots) {
    const isStock = slot.id === 'stock';
    const isWaste = slot.id === 'waste';
    const isDropTarget = !isStock && !isWaste;
    entities.push({
      id: slot.id,
      tags: ['slot'],
      components: {
        Transform: {position: {x: slot.x, y: slot.y}, rotation: 0, scale: {x: 1, y: 1}},
        Renderable: {
          width: CARD_W,
          height: CARD_H,
          color: '#2a4a2a',
          zIndex: -1,
          visible: true,
        },
        ...(isStock ? {Clickable: {enabled: true}} : {}),
        ...(isDropTarget ? {DropTarget: {targetId: slot.id}} : {}),
      },
    });
  }

  // Static label for stock slot (↩ symbol)
  entities.push({
    id: 'stock-label',
    components: {
      Transform: {position: {x: colX(0), y: TOP_Y}, rotation: 0, scale: {x: 1, y: 1}},
      Renderable: {
        renderType: 'text',
        width: 0,
        height: 0,
        zIndex: -1,
        visible: true,
        text: '↩',
        textColor: '#88cc88',
        fontSize: 22,
      },
    },
  });

  // Build and shuffle deck
  const deck = shuffle(
    suits.flatMap((suit) =>
      Array.from({length: 13}, (_, i) => ({rank: i + 1, suit}))
    )
  );

  let deckIndex = 0;

  // Deal tableau
  for (let col = 0; col < 7; col++) {
    for (let pos = 0; pos <= col; pos++) {
      const card = deck[deckIndex++]!;
      const faceUp = pos === col;
      const pileId = `t${col}`;
      const cardId = `card-${card.suit}-${card.rank}`;
      const labelText = faceUp ? rankLabels[card.rank]! + card.suit : '';
      const labelColor = faceUp && redSuits.has(card.suit) ? '#cc0000' : '#000000';

      entities.push({
        id: cardId,
        components: {
          Transform: {position: {x: colX(col), y: TABLEAU_Y}, rotation: 0, scale: {x: 1, y: 1}},
          Renderable: {
            width: CARD_W,
            height: CARD_H,
            color: faceUp ? '#ffffff' : '#1a3a8c',
            zIndex: pos,
            visible: true,
            borderColor: '#cccccc',
            borderWidth: 1,
          },
          Card: {rank: card.rank, suit: card.suit, faceUp, pileId, posInPile: pos},
          Draggable: {enabled: faceUp},
        },
      });

      // Top-left label
      entities.push({
        id: `${cardId}-label-tl`,
        components: {
          Transform: {position: {x: colX(col), y: TABLEAU_Y}, rotation: 0, scale: {x: 1, y: 1}},
          Renderable: {
            renderType: 'text',
            width: 0,
            height: 0,
            zIndex: pos + 1,
            visible: faceUp,
            text: labelText,
            textColor: labelColor,
            fontSize: 14,
            textAnchor: 'top-left',
          },
          ChildOf: {parentId: cardId, offsetX: -(CARD_W / 2) + 4, offsetY: -(CARD_H / 2) + 4, zIndexOffset: 1},
        },
      });

      // Bottom-right label (mirrored via rotation=π)
      entities.push({
        id: `${cardId}-label-br`,
        components: {
          Transform: {position: {x: colX(col), y: TABLEAU_Y}, rotation: Math.PI, scale: {x: 1, y: 1}},
          Renderable: {
            renderType: 'text',
            width: 0,
            height: 0,
            zIndex: pos + 1,
            visible: faceUp,
            text: labelText,
            textColor: labelColor,
            fontSize: 14,
            textAnchor: 'top-left',
          },
          ChildOf: {parentId: cardId, offsetX: (CARD_W / 2) - 4, offsetY: (CARD_H / 2) - 4, zIndexOffset: 1},
        },
      });
    }
  }

  // Remaining cards to stock
  for (let pos = 0; deckIndex < deck.length; pos++, deckIndex++) {
    const card = deck[deckIndex]!;
    const cardId = `card-${card.suit}-${card.rank}`;
    entities.push({
      id: cardId,
      components: {
        Transform: {
          position: {x: colX(0), y: TOP_Y},
          rotation: 0,
          scale: {x: 1, y: 1},
        },
        Renderable: {
          width: CARD_W,
          height: CARD_H,
          color: '#1a3a8c',
          zIndex: pos,
          visible: true,
          borderColor: '#cccccc',
          borderWidth: 1,
        },
        Card: {rank: card.rank, suit: card.suit, faceUp: false, pileId: 'stock', posInPile: pos},
        Draggable: {enabled: false},
      },
    });

    // Top-left label (hidden for face-down stock cards)
    entities.push({
      id: `${cardId}-label-tl`,
      components: {
        Transform: {position: {x: colX(0), y: TOP_Y}, rotation: 0, scale: {x: 1, y: 1}},
        Renderable: {
          renderType: 'text',
          width: 0,
          height: 0,
          zIndex: pos + 1,
          visible: false,
          text: '',
          fontSize: 14,
          textAnchor: 'top-left',
        },
        ChildOf: {parentId: cardId, offsetX: -(CARD_W / 2) + 4, offsetY: -(CARD_H / 2) + 4, zIndexOffset: 1},
      },
    });

    // Bottom-right label (hidden for face-down stock cards)
    entities.push({
      id: `${cardId}-label-br`,
      components: {
        Transform: {position: {x: colX(0), y: TOP_Y}, rotation: Math.PI, scale: {x: 1, y: 1}},
        Renderable: {
          renderType: 'text',
          width: 0,
          height: 0,
          zIndex: pos + 1,
          visible: false,
          text: '',
          fontSize: 14,
          textAnchor: 'top-left',
        },
        ChildOf: {parentId: cardId, offsetX: (CARD_W / 2) - 4, offsetY: (CARD_H / 2) - 4, zIndexOffset: 1},
      },
    });
  }

  return {name: 'solitaire', entities};
}

export default {
  register(): void {
    SystemRegistry.register('SolitaireSystem', SolitaireSystem);
  },
  getSceneData(): SceneData {
    return buildScene();
  },
  getSystems() {
    return [new MouseSystem(), new DragDropSystem(), new SolitaireSystem()];
  },
  getEvents() {
    return {onDeath: 'solitaire:won'};
  },
  getCanvas() {
    return {width: 700, height: 580};
  },
} satisfies GameModule;
