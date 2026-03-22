import {BaseSystem} from '@canvas/engine';
import type {SystemContext, Scene, EventBus} from '@canvas/engine';
import type {DataComponent, RenderableComponent, TransformComponent} from '@canvas/engine';
import type {CardData, DraggableData} from '@canvas/engine';
import type {DragDropBeforePayload, DragDropDroppedPayload, ClickPayload} from '@canvas/engine';
import {TOP_Y, TABLEAU_Y, FACE_DOWN_STEP, FACE_UP_STEP, rankLabels, redSuits, colX} from './constants';

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
  private scene: Scene | null = null;
  private eventsRef: EventBus | null = null;

  onInit(context: Omit<SystemContext, 'deltaTime'>): void {
    const {scene, events} = context;
    this.scene = scene;
    this.eventsRef = events;

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

    // Subscribe: add group members for tableau group drag
    events.on<DragDropBeforePayload>('dragdrop:before', ({primaryId, addToDrag}: DragDropBeforePayload) => {
      const cd = this.getCardData(primaryId);
      if (!cd) return;
      const {pileId} = cd.data;
      if (!pileId.startsWith('t')) return;
      const pile = this.piles.get(pileId) ?? [];
      const idx = pile.indexOf(primaryId);
      if (idx === -1) return;
      for (let i = idx + 1; i < pile.length; i++) {
        addToDrag(pile[i]!);
      }
    });

    // Subscribe: stock click → deal
    events.on<ClickPayload>('click', ({entityId}: ClickPayload) => {
      if (entityId === 'stock') this.dealFromStock();
    });

    // Subscribe: validate drop and commit or reject
    events.on<DragDropDroppedPayload>('dragdrop:dropped', ({entityIds, targetId, accept, reject}: DragDropDroppedPayload) => {
      if (!targetId) {
        reject();
        return;
      }
      const leadCd = this.getCardData(entityIds[0]!)?.data;
      if (!leadCd) {
        reject();
        return;
      }

      let valid = false;
      if (targetId.startsWith('f') && entityIds.length === 1) {
        valid = this.canDropOnFoundation(targetId, leadCd);
      } else if (targetId.startsWith('t')) {
        valid = this.canDropOnTableau(targetId, leadCd);
      }

      if (valid) {
        this.commitDrop(entityIds, targetId);
        accept();
      } else {
        reject();
      }
    });
  }

  private setDraggable(entityId: string, enabled: boolean): void {
    const draggable = this.scene?.getEntity(entityId)?.getComponent<DataComponent<DraggableData>>('Draggable');
    if (draggable) draggable.data.enabled = enabled;
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
          renderable.zIndex = i * 2;
        }
      }
    }

    // Update tableau slot transforms to follow pile tops (for DropTarget overlap detection)
    for (let col = 0; col < 7; col++) {
      const pileId = `t${col}`;
      const pile = this.piles.get(pileId) ?? [];
      const slotEntity = this.scene?.getEntity(pileId);
      if (!slotEntity) continue;
      const slotT = slotEntity.getComponent<TransformComponent>('Transform');
      if (!slotT) continue;
      if (pile.length === 0) {
        const anchor = pileAnchor(pileId);
        slotT.position.x = anchor.x;
        slotT.position.y = anchor.y;
      } else {
        const topT = this.getTransform(pile[pile.length - 1]!);
        if (topT) {
          slotT.position.x = topT.position.x;
          slotT.position.y = topT.position.y;
        }
      }
    }
  }

  private getLabelRenderable(cardId: string, suffix: 'tl' | 'br'): RenderableComponent | undefined {
    return this.scene?.getEntity(`${cardId}-label-${suffix}`)?.getComponent<RenderableComponent>('Renderable');
  }

  private updateCardVisuals(entityId: string): void {
    const cd = this.getCardData(entityId);
    const renderable = this.getRenderable(entityId);
    if (!cd || !renderable) return;
    if (cd.data.faceUp) {
      renderable.color = '#ffffff';
      const labelText = rankLabels[cd.data.rank]! + cd.data.suit;
      const labelColor = redSuits.has(cd.data.suit) ? '#cc0000' : '#000000';
      for (const suffix of ['tl', 'br'] as const) {
        const lr = this.getLabelRenderable(entityId, suffix);
        if (!lr) continue;
        lr.text = labelText;
        lr.textColor = labelColor;
        lr.visible = true;
      }
    } else {
      renderable.color = '#1a3a8c';
      for (const suffix of ['tl', 'br'] as const) {
        const lr = this.getLabelRenderable(entityId, suffix);
        if (lr) lr.visible = false;
      }
    }
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

  private commitDrop(cardIds: string[], targetPileId: string): void {
    const leadCd = this.getCardData(cardIds[0]!);
    if (!leadCd) return;
    const originPileId = leadCd.data.pileId;

    const originPile = this.piles.get(originPileId)!;
    const originIndex = originPile.indexOf(cardIds[0]!);
    if (originIndex === -1) return;
    originPile.splice(originIndex, cardIds.length);

    const targetPile = this.piles.get(targetPileId)!;
    for (const cardId of cardIds) {
      const cd = this.getCardData(cardId)!;
      cd.data.pileId = targetPileId;
      cd.data.posInPile = targetPile.length;
      targetPile.push(cardId);
    }

    // Flip newly exposed top card in origin pile
    if (originPileId.startsWith('t') && originPile.length > 0) {
      const topId = originPile[originPile.length - 1]!;
      const topCd = this.getCardData(topId);
      if (topCd && !topCd.data.faceUp) {
        topCd.data.faceUp = true;
        this.updateCardVisuals(topId);
        this.setDraggable(topId, true);
      }
    }

    this.recomputeAllPositions();
    this.checkWin();
  }

  private checkWin(): void {
    for (let i = 0; i < 4; i++) {
      if ((this.piles.get(`f${i}`) ?? []).length !== 13) return;
    }
    this.eventsRef?.emit('solitaire:won', {});
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
          this.setDraggable(id, false);
        }
        stockPile.unshift(id);
      }
    } else {
      // Disable dragging on previous top waste card (it goes below)
      if (wastePile.length > 0) {
        this.setDraggable(wastePile[wastePile.length - 1]!, false);
      }

      const id = stockPile.pop()!;
      const cd = this.getCardData(id);
      if (cd) {
        cd.data.faceUp = true;
        cd.data.pileId = 'waste';
        cd.data.posInPile = wastePile.length;
        this.updateCardVisuals(id);
        this.setDraggable(id, true);
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
