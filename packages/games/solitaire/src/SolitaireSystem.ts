import {BaseSystem, mouseService} from '@canvas/engine';
import type {SystemContext, IEntity, Scene} from '@canvas/engine';
import type {DataComponent, RenderableComponent, TransformComponent} from '@canvas/engine';
import type {CardData} from '@canvas/engine';

const CARD_W = 70;
const CARD_H = 96;
const COL_STEP = 82;
const MARGIN_X = 14;
const FACE_DOWN_STEP = 20;
const FACE_UP_STEP = 28;
const TOP_Y = 58;
const TABLEAU_Y = 168;

const rankLabels = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const redSuits = new Set(['♥', '♦']);

function colX(col: number): number {
  return MARGIN_X + CARD_W / 2 + col * COL_STEP;
}

function pileAnchor(pileId: string): {x: number; y: number} {
  if (pileId === 'stock') return {x: colX(0), y: TOP_Y};
  if (pileId === 'waste') return {x: colX(1), y: TOP_Y};
  if (pileId === 'f0') return {x: colX(3), y: TOP_Y};
  if (pileId === 'f1') return {x: colX(4), y: TOP_Y};
  if (pileId === 'f2') return {x: colX(5), y: TOP_Y};
  if (pileId === 'f3') return {x: colX(6), y: TOP_Y};
  const col = parseInt(pileId[1]!);
  return {x: colX(col), y: TABLEAU_Y};
}

export class SolitaireSystem extends BaseSystem {
  readonly priority = 100;

  private piles: Map<string, string[]> = new Map();
  private drag: {
    cards: string[];
    originPileId: string;
    originIndex: number;
    offsets: Array<{x: number; y: number}>;
  } | null = null;
  private scene: Scene | null = null;

  onInit(context: Omit<SystemContext, 'deltaTime'>): void {
    const {scene} = context;
    this.scene = scene;

    const pileIds = ['stock', 'waste', 'f0', 'f1', 'f2', 'f3', 't0', 't1', 't2', 't3', 't4', 't5', 't6'];
    for (const id of pileIds) {
      this.piles.set(id, []);
    }

    const cardEntities = scene.query({all: ['Card', 'Transform', 'Renderable']});
    const byPile = new Map<string, Array<{entityId: string; posInPile: number}>>();

    for (const entity of cardEntities) {
      const cardComp = entity.getComponent<DataComponent<CardData>>('Card')!;
      const {pileId, posInPile} = cardComp.data;
      if (!byPile.has(pileId)) byPile.set(pileId, []);
      byPile.get(pileId)!.push({entityId: entity.id, posInPile});
    }

    for (const [pileId, cards] of byPile) {
      cards.sort((a, b) => a.posInPile - b.posInPile);
      this.piles.set(pileId, cards.map((c) => c.entityId));
    }

    this.recomputeAllPositions();
  }

  private getCardData(entityId: string): DataComponent<CardData> | undefined {
    return this.scene?.getEntity(entityId)?.getComponent<DataComponent<CardData>>('Card');
  }

  private getRenderable(entityId: string): RenderableComponent | undefined {
    return this.scene?.getEntity(entityId)?.getComponent<RenderableComponent>('Renderable');
  }

  private getTransform(entityId: string): TransformComponent | undefined {
    return this.scene?.getEntity(entityId)?.getComponent<TransformComponent>('Transform');
  }

  private cardY(pileId: string, posInPile: number): number {
    const anchor = pileAnchor(pileId);
    if (!pileId.startsWith('t')) return anchor.y;

    const pile = this.piles.get(pileId) ?? [];
    let y = anchor.y;
    for (let i = 0; i < posInPile && i < pile.length; i++) {
      const cd = this.getCardData(pile[i]!);
      y += cd?.data.faceUp ? FACE_UP_STEP : FACE_DOWN_STEP;
    }
    return y;
  }

  private recomputeAllPositions(): void {
    for (const [pileId, pile] of this.piles) {
      const anchor = pileAnchor(pileId);
      for (let i = 0; i < pile.length; i++) {
        const entityId = pile[i]!;
        const transform = this.getTransform(entityId);
        if (transform) {
          transform.position.x = anchor.x;
          transform.position.y = this.cardY(pileId, i);
        }
        const renderable = this.getRenderable(entityId);
        if (renderable) {
          renderable.zIndex = i;
        }
      }
    }
  }

  private updateCardVisuals(entityId: string): void {
    const cd = this.getCardData(entityId);
    const renderable = this.getRenderable(entityId);
    if (!cd || !renderable) return;
    if (cd.data.faceUp) {
      renderable.color = '#ffffff';
      renderable.text = rankLabels[cd.data.rank]! + cd.data.suit;
      renderable.textColor = redSuits.has(cd.data.suit) ? '#cc0000' : '#000000';
    } else {
      renderable.color = '#1a3a8c';
      renderable.text = ' ';
    }
  }

  private hitTest(mx: number, my: number, entityId: string): boolean {
    const t = this.getTransform(entityId);
    if (!t) return false;
    return (
      mx >= t.position.x - CARD_W / 2 &&
      mx <= t.position.x + CARD_W / 2 &&
      my >= t.position.y - CARD_H / 2 &&
      my <= t.position.y + CARD_H / 2
    );
  }

  private canDropOnFoundation(pileId: string, card: CardData): boolean {
    const pile = this.piles.get(pileId) ?? [];
    if (pile.length === 0) return card.rank === 1;
    const topCd = this.getCardData(pile[pile.length - 1]!);
    if (!topCd) return false;
    return topCd.data.suit === card.suit && card.rank === topCd.data.rank + 1;
  }

  private canDropOnTableau(pileId: string, card: CardData): boolean {
    const pile = this.piles.get(pileId) ?? [];
    if (pile.length === 0) return card.rank === 13;
    const topCd = this.getCardData(pile[pile.length - 1]!);
    if (!topCd || !topCd.data.faceUp) return false;
    return (
      card.rank === topCd.data.rank - 1 &&
      redSuits.has(card.suit) !== redSuits.has(topCd.data.suit)
    );
  }

  private commitDrop(targetPileId: string, events: SystemContext['events']): void {
    if (!this.drag) return;
    const {cards, originPileId, originIndex} = this.drag;

    const originPile = this.piles.get(originPileId)!;
    originPile.splice(originIndex, cards.length);

    const targetPile = this.piles.get(targetPileId)!;
    for (const cardId of cards) {
      const cd = this.getCardData(cardId)!;
      cd.data.pileId = targetPileId;
      cd.data.posInPile = targetPile.length;
      targetPile.push(cardId);
    }

    if (originPileId.startsWith('t') && originPile.length > 0) {
      const topId = originPile[originPile.length - 1]!;
      const topCd = this.getCardData(topId);
      if (topCd && !topCd.data.faceUp) {
        topCd.data.faceUp = true;
        this.updateCardVisuals(topId);
      }
    }

    this.drag = null;
    this.recomputeAllPositions();
    this.checkWin(events);
  }

  private revertDrag(): void {
    this.drag = null;
    this.recomputeAllPositions();
  }

  private checkWin(events: SystemContext['events']): void {
    for (let i = 0; i < 4; i++) {
      if ((this.piles.get(`f${i}`) ?? []).length !== 13) return;
    }
    events.emit('solitaire:won', {});
  }

  onUpdate(context: SystemContext): void {
    const {events} = context;
    const {justDown, isDown, justUp, position} = mouseService;

    if (justDown) {
      this.handleMouseDown(position.x, position.y);
    }
    if (isDown && this.drag) {
      this.handleDrag(position.x, position.y);
    }
    if (justUp) {
      this.handleMouseUp(position.x, position.y, events);
    }
  }

  private handleMouseDown(mx: number, my: number): void {
    const stockAnchor = pileAnchor('stock');
    if (
      mx >= stockAnchor.x - CARD_W / 2 &&
      mx <= stockAnchor.x + CARD_W / 2 &&
      my >= stockAnchor.y - CARD_H / 2 &&
      my <= stockAnchor.y + CARD_H / 2
    ) {
      this.dealFromStock();
      return;
    }

    if (!this.scene) return;
    const cardEntities = this.scene.query({all: ['Card', 'Transform', 'Renderable']});
    let best: IEntity | null = null;
    let bestZ = -Infinity;

    for (const entity of cardEntities) {
      const cd = entity.getComponent<DataComponent<CardData>>('Card')!;
      if (!cd.data.faceUp) continue;
      if (!this.hitTest(mx, my, entity.id)) continue;
      const r = entity.getComponent<RenderableComponent>('Renderable')!;
      if (r.zIndex > bestZ) {
        bestZ = r.zIndex;
        best = entity;
      }
    }

    if (!best) return;

    const bestCd = best.getComponent<DataComponent<CardData>>('Card')!;
    const {pileId} = bestCd.data;
    const pile = this.piles.get(pileId) ?? [];
    const cardIndex = pile.indexOf(best.id);
    if (cardIndex === -1) return;

    let dragCards: string[];
    if (pileId.startsWith('t')) {
      dragCards = pile.slice(cardIndex);
    } else {
      if (cardIndex !== pile.length - 1) return;
      dragCards = [best.id];
    }

    const offsets = dragCards.map((id) => {
      const t = this.getTransform(id)!;
      return {x: t.position.x - mx, y: t.position.y - my};
    });

    for (const id of dragCards) {
      const r = this.getRenderable(id);
      if (r) r.zIndex = 999;
    }

    this.drag = {cards: dragCards, originPileId: pileId, originIndex: cardIndex, offsets};
  }

  private handleDrag(mx: number, my: number): void {
    if (!this.drag) return;
    const {cards, offsets} = this.drag;
    for (let i = 0; i < cards.length; i++) {
      const t = this.getTransform(cards[i]!);
      if (t) {
        t.position.x = mx + offsets[i]!.x;
        t.position.y = my + offsets[i]!.y;
      }
    }
  }

  // Returns true when the dragged lead card's rect overlaps the target rect.
  // Using card dimensions for both means any visual overlap registers as a hit.
  private overlaps(leadPos: {x: number; y: number}, targetPos: {x: number; y: number}): boolean {
    return (
      Math.abs(leadPos.x - targetPos.x) < CARD_W &&
      Math.abs(leadPos.y - targetPos.y) < CARD_H
    );
  }

  private handleMouseUp(_mx: number, _my: number, events: SystemContext['events']): void {
    if (!this.drag) return;

    const leadCd = this.getCardData(this.drag.cards[0]!)?.data;
    const leadT = this.getTransform(this.drag.cards[0]!);
    if (!leadCd || !leadT) {
      this.revertDrag();
      return;
    }

    const leadPos = leadT.position;
    let targetPileId: string | null = null;

    for (let i = 0; i < 4 && !targetPileId; i++) {
      const pid = `f${i}`;
      const anchor = pileAnchor(pid);
      if (this.overlaps(leadPos, anchor)) {
        if (this.drag.cards.length === 1 && this.canDropOnFoundation(pid, leadCd)) {
          targetPileId = pid;
        }
      }
    }

    if (!targetPileId) {
      for (let i = 0; i < 7 && !targetPileId; i++) {
        const pid = `t${i}`;
        const pile = this.piles.get(pid) ?? [];
        let targetPos: {x: number; y: number};
        if (pile.length === 0) {
          targetPos = pileAnchor(pid);
        } else {
          const topT = this.getTransform(pile[pile.length - 1]!);
          targetPos = topT ? topT.position : pileAnchor(pid);
        }
        if (this.overlaps(leadPos, targetPos)) {
          if (this.canDropOnTableau(pid, leadCd)) {
            targetPileId = pid;
          }
        }
      }
    }

    if (targetPileId) {
      this.commitDrop(targetPileId, events);
    } else {
      this.revertDrag();
    }
  }

  private dealFromStock(): void {
    const stockPile = this.piles.get('stock')!;
    const wastePile = this.piles.get('waste')!;

    if (stockPile.length === 0) {
      while (wastePile.length > 0) {
        const id = wastePile.pop()!;
        const cd = this.getCardData(id);
        if (cd) {
          cd.data.faceUp = false;
          cd.data.pileId = 'stock';
          cd.data.posInPile = stockPile.length;
          this.updateCardVisuals(id);
        }
        stockPile.unshift(id);
      }
    } else {
      const id = stockPile.pop()!;
      const cd = this.getCardData(id);
      if (cd) {
        cd.data.faceUp = true;
        cd.data.pileId = 'waste';
        cd.data.posInPile = wastePile.length;
        this.updateCardVisuals(id);
      }
      wastePile.push(id);
    }

    for (let i = 0; i < stockPile.length; i++) {
      const cd = this.getCardData(stockPile[i]!);
      if (cd) cd.data.posInPile = i;
    }
    for (let i = 0; i < wastePile.length; i++) {
      const cd = this.getCardData(wastePile[i]!);
      if (cd) cd.data.posInPile = i;
    }

    this.recomputeAllPositions();
  }
}
