import {BaseSystem} from 'core/System';
import type {SystemContext} from 'core/System';
import type {Scene} from 'core/Scene';
import type {EventBus} from 'core/EventBus';
import type {DataComponent} from 'core/Component';
import type {RenderableComponent} from 'components/RenderableComponent';
import type {CardData} from 'components/CardComponent';
import type {DraggableData} from 'components/DraggableComponent';
import type {DragGroupData} from 'components/DragGroupComponent';
import type {PileMemberData} from 'components/PileMemberComponent';
import type {PileLayoutData} from 'components/PileLayoutComponent';
import type {ClickPayload} from 'systems/ClickSystem';
import type {DragDropDroppedPayload} from 'systems/DragDropSystem';
import type {
  CardPileConfigData,
  DropRule,
  DropCondition,
  BehaviorConfig,
  TargetMatch,
} from 'components/CardPileConfigComponent';
import type {DeckConfigData, DealPatternConfig} from 'components/DeckConfigComponent';
import {loadEntity} from 'loader/EntityLoader';
import {mouseService} from 'systems/MouseSystem';
import type {TransformComponent} from 'components/TransformComponent';

/** One undo step: every pile's cards (bottom to top) with their face-up state. */
type Snapshot = Array<[string, Array<{id: string; faceUp: boolean}>]>;

const DEFAULT_RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const DEFAULT_FACE_UP_COLOR = '#ffffff';
const DEFAULT_FACE_DOWN_COLOR = '#1a3a8c';

export class CardPileSystem extends BaseSystem {
  readonly priority = 100;

  private piles: Map<string, string[]> = new Map();
  private config: CardPileConfigData | null = null;
  private deckConfig: DeckConfigData | null = null;
  private colorGroupOf: Map<string, string> = new Map();
  private pileAnchorCache: Map<string, {x: number; y: number}> = new Map();
  private scene: Scene | null = null;
  private eventsRef: EventBus | null = null;
  private history: Snapshot[] = [];
  private drawCount = 1;
  private finishTimer = 0;
  private won = false;

  onInit({scene, events}: Omit<SystemContext, 'deltaTime'>): void {
    this.scene = scene;
    this.eventsRef = events;

    const configEntities = scene.query({all: ['CardPileConfig']});
    const configEntity = configEntities[0];
    if (!configEntity) return;

    const configComp = configEntity.getComponent<DataComponent<CardPileConfigData>>('CardPileConfig')!;
    const config = configComp.data;
    this.config = config;

    for (const [groupName, suits] of Object.entries(config.colorGroups ?? {})) {
      for (const suit of suits) {
        this.colorGroupOf.set(suit, groupName);
      }
    }

    for (const id of config.pileIds) {
      this.piles.set(id, []);
    }

    // Build pile anchor cache from PileLayout entities
    for (const e of scene.query({all: ['PileLayout']})) {
      const pl = e.getComponent<DataComponent<PileLayoutData>>('PileLayout')!;
      this.pileAnchorCache.set(pl.data.pileId, {x: pl.data.anchorX, y: pl.data.anchorY});
    }

    // If a DeckConfig entity exists, generate and deal the deck instead of reading scene cards
    const deckConfigEntity = scene.query({all: ['DeckConfig']})[0];
    if (deckConfigEntity) {
      const deckData = deckConfigEntity.getComponent<DataComponent<DeckConfigData>>('DeckConfig')!.data;
      this.deckConfig = deckData;
      this.initializeDeck(deckData);
    } else {
      const cardEntities = scene.query({all: ['Card', 'Transform', 'Renderable']});
      const byPile = new Map<string, Array<{entityId: string; posInPile: number}>>();
      for (const entity of cardEntities) {
        const card = entity.getComponent<DataComponent<CardData>>('Card')!;
        const {pileId, posInPile} = card.data;
        if (!byPile.has(pileId)) byPile.set(pileId, []);
        byPile.get(pileId)!.push({entityId: entity.id, posInPile});
      }
      for (const [pileId, cards] of byPile) {
        cards.sort((a, b) => a.posInPile - b.posInPile);
        this.piles.set(pileId, cards.map((c) => c.entityId));
      }
    }

    this.drawCount = this.stockBehavior()?.count ?? 1;
    this.refreshDraggable();
    this.syncPileMembers();
    this.updateDrawLabel();
    this.updateStatus();

    events.on<ClickPayload>('click', ({entityId}: ClickPayload) => {
      for (const behavior of config.behaviors) {
        if (behavior.type === 'dealFromStock' && entityId === behavior.stockId) {
          this.dealFromStock(behavior);
        }
      }
      if (entityId === config.undo?.buttonId) this.undo();
      if (entityId === config.drawToggle?.buttonId) this.cycleDrawCount();
    });

    events.on<DragDropDroppedPayload>('dragdrop:dropped', ({entityIds, targetId, accept, reject}: DragDropDroppedPayload) => {
      if (!targetId) {reject(); return;}
      const leadCard = this.getCardData(entityIds[0]!)?.data;
      if (!leadCard) {reject(); return;}

      const rule = this.findDropRule(targetId, entityIds.length);
      if (!rule) {reject(); return;}

      const pile = this.piles.get(targetId) ?? [];
      const conditions = pile.length === 0 ? (rule.emptyConditions ?? []) : rule.conditions;
      const topCard = pile.length > 0 ? this.getCardData(pile[pile.length - 1]!)?.data : undefined;

      if (this.evaluateConditions(conditions, leadCard, topCard)) {
        this.commitDrop(entityIds, targetId);
        accept();
      } else {
        reject();
      }
    });
  }

  private matchesPile(match: TargetMatch, pileId: string): boolean {
    if ('prefix' in match) return pileId.startsWith(match.prefix);
    if ('ids' in match) return match.ids.includes(pileId);
    // tag matching requires entity lookup — not yet implemented
    return false;
  }

  private findDropRule(targetId: string, groupSize: number): DropRule | null {
    if (!this.config) return null;
    for (const rule of this.config.dropRules) {
      if (!this.matchesPile(rule.target, targetId)) continue;
      if (rule.maxGroupSize !== undefined && groupSize > rule.maxGroupSize) continue;
      return rule;
    }
    return null;
  }

  private isGroupPile(pileId: string): boolean {
    if (!this.config) return false;
    for (const rule of this.config.dropRules) {
      if (!this.matchesPile(rule.target, pileId)) continue;
      return !rule.maxGroupSize || rule.maxGroupSize > 1;
    }
    return false;
  }

  private evaluateConditions(conditions: DropCondition[], card: CardData, top: CardData | undefined): boolean {
    for (const cond of conditions) {
      if (cond.type === 'sameSuit') {
        if (!top || card.suit !== top.suit) return false;
      } else if (cond.type === 'alternateColor') {
        if (!top) return false;
        if (this.colorGroupOf.get(card.suit) === this.colorGroupOf.get(top.suit)) return false;
      } else if (cond.type === 'rankDelta') {
        if (!top || card.rank !== top.rank + cond.value) return false;
      } else if (cond.type === 'rankEquals') {
        if (card.rank !== cond.value) return false;
      }
    }
    return true;
  }

  private commitDrop(cardIds: string[], targetPileId: string): void {
    const leadCard = this.getCardData(cardIds[0]!);
    if (!leadCard) return;
    const originPileId = leadCard.data.pileId;
    this.pushHistory();

    const originPile = this.piles.get(originPileId)!;
    const originIndex = originPile.indexOf(cardIds[0]!);
    if (originIndex === -1) return;
    originPile.splice(originIndex, cardIds.length);

    const targetPile = this.piles.get(targetPileId)!;
    const groupPile = this.isGroupPile(targetPileId);
    for (const cardId of cardIds) {
      const cd = this.getCardData(cardId)!;
      cd.data.pileId = targetPileId;
      cd.data.posInPile = targetPile.length;
      targetPile.push(cardId);
      this.setDragGroup(cardId, groupPile ? targetPileId : '', cd.data.posInPile);
    }

    if (this.config) {
      for (const behavior of this.config.behaviors) {
        if (behavior.type === 'flipOriginTopOnDrop' && this.matchesPile(behavior.originMatch, originPileId)) {
          if (originPile.length > 0) {
            const topId = originPile[originPile.length - 1]!;
            const topCard = this.getCardData(topId);
            if (topCard && !topCard.data.faceUp) {
              topCard.data.faceUp = true;
              this.updateCardVisuals(topId);
              this.setDraggable(topId, true);
            }
          }
        } else if (behavior.type === 'dealFromStock' && originPileId === behavior.wasteId) {
          if (originPile.length > 0) {
            this.setDraggable(originPile[originPile.length - 1]!, true);
          }
        }
      }
    }

    this.refreshDraggable();
    this.syncPileMembers();
    this.checkWin();
    this.updateStatus();
  }

  private dealFromStock(behavior: Extract<BehaviorConfig, {type: 'dealFromStock'}>): void {
    const stockPile = this.piles.get(behavior.stockId)!;
    const wastePile = this.piles.get(behavior.wasteId)!;
    if (stockPile.length === 0 && wastePile.length === 0) return;
    this.pushHistory();

    if (stockPile.length === 0) {
      // Recycle: the waste turns over to become the stock again.
      while (wastePile.length > 0) {
        const id = wastePile.pop()!;
        const cd = this.getCardData(id);
        if (cd) {
          cd.data.faceUp = false;
          cd.data.pileId = behavior.stockId;
          this.updateCardVisuals(id);
        }
        stockPile.push(id);
      }
    } else {
      for (let n = 0; n < this.drawCount && stockPile.length > 0; n++) {
        const id = stockPile.pop()!;
        const cd = this.getCardData(id);
        if (cd) {
          cd.data.faceUp = true;
          cd.data.pileId = behavior.wasteId;
          this.updateCardVisuals(id);
          this.setDragGroup(id, '', 0);
        }
        wastePile.push(id);
      }
    }

    this.renumber(behavior.stockId);
    this.renumber(behavior.wasteId);
    this.refreshDraggable();
    this.syncPileMembers();
    this.updateStatus();
  }

  // --- Undo, draw mode, auto-move, auto-finish, stuck detection ---

  onUpdate({deltaTime}: SystemContext): void {
    if (!this.config || this.won) return;
    if (mouseService.justDoubleUp && this.config.autoMove) {
      const cardId = this.topCardAt(mouseService.position);
      if (cardId) this.moveToAutoTargets(cardId);
    }
    if (this.config.autoFinish && this.canAutoFinish()) {
      this.finishTimer += deltaTime * 1000;
      if (this.finishTimer >= (this.config.autoFinish.intervalMs ?? 120)) {
        this.finishTimer = 0;
        this.autoFinishStep();
      }
    }
  }

  private stockBehavior(): Extract<BehaviorConfig, {type: 'dealFromStock'}> | undefined {
    return this.config?.behaviors.find(
      (b): b is Extract<BehaviorConfig, {type: 'dealFromStock'}> => b.type === 'dealFromStock',
    );
  }

  private pushHistory(): void {
    const snap: Snapshot = [];
    for (const [pileId, ids] of this.piles) {
      snap.push([pileId, ids.map((id) => ({id, faceUp: this.getCardData(id)?.data.faceUp ?? false}))]);
    }
    this.history.push(snap);
    const max = this.config?.undo?.maxDepth ?? 500;
    if (this.history.length > max) this.history.shift();
  }

  private undo(): void {
    const snap = this.history.pop();
    if (!snap || this.won) return;
    for (const [pileId, cards] of snap) {
      this.piles.set(pileId, cards.map((c) => c.id));
      const group = this.isGroupPile(pileId);
      cards.forEach((c, i) => {
        const cd = this.getCardData(c.id);
        if (!cd) return;
        cd.data.pileId = pileId;
        cd.data.posInPile = i;
        cd.data.faceUp = c.faceUp;
        this.updateCardVisuals(c.id);
        this.setDragGroup(c.id, group ? pileId : '', i);
      });
    }
    this.finishTimer = 0;
    this.refreshDraggable();
    this.syncPileMembers();
    this.updateStatus();
  }

  private cycleDrawCount(): void {
    const options = this.config?.drawToggle?.options ?? [];
    if (options.length === 0) return;
    const i = options.indexOf(this.drawCount);
    this.drawCount = options[(i + 1) % options.length]!;
    this.updateDrawLabel();
    this.updateStatus();
  }

  private updateDrawLabel(): void {
    const labelId = this.config?.drawToggle?.labelId;
    const label = labelId ? this.getRenderable(labelId) : undefined;
    if (label) label.text = `Draw ${this.drawCount}`;
  }

  private renumber(pileId: string): void {
    (this.piles.get(pileId) ?? []).forEach((id, i) => {
      const cd = this.getCardData(id);
      if (cd) cd.data.posInPile = i;
    });
  }

  /**
   * The single rule for what can be picked up: face-up runs in group piles
   * (the tableau), only the top card elsewhere, nothing in the stock.
   */
  private refreshDraggable(): void {
    const stockId = this.stockBehavior()?.stockId;
    for (const [pileId, ids] of this.piles) {
      const group = this.isGroupPile(pileId);
      ids.forEach((id, i) => {
        const faceUp = this.getCardData(id)?.data.faceUp ?? false;
        const top = i === ids.length - 1;
        this.setDraggable(id, pileId !== stockId && faceUp && (group || top));
      });
    }
  }

  /** The top card of any pile under `pos`, if it's face up (stock excluded). */
  private topCardAt(pos: {x: number; y: number}): string | null {
    const stockId = this.stockBehavior()?.stockId;
    for (const [pileId, ids] of this.piles) {
      const id = ids[ids.length - 1];
      if (!id || pileId === stockId || !this.getCardData(id)?.data.faceUp) continue;
      const entity = this.scene?.getEntity(id);
      const t = entity?.getComponent<TransformComponent>('Transform');
      const r = entity?.getComponent<RenderableComponent>('Renderable');
      if (!t || !r) continue;
      if (Math.abs(pos.x - t.position.x) <= r.width / 2 && Math.abs(pos.y - t.position.y) <= r.height / 2) return id;
    }
    return null;
  }

  /** Whether `cardIds` (a run led by its first card) may legally land on `targetId`. */
  private canDrop(cardIds: string[], targetId: string): boolean {
    const lead = this.getCardData(cardIds[0]!)?.data;
    if (!lead || lead.pileId === targetId) return false;
    const rule = this.findDropRule(targetId, cardIds.length);
    if (!rule) return false;
    const pile = this.piles.get(targetId) ?? [];
    const top = pile.length > 0 ? this.getCardData(pile[pile.length - 1]!)?.data : undefined;
    return this.evaluateConditions(pile.length === 0 ? (rule.emptyConditions ?? []) : rule.conditions, lead, top);
  }

  private autoTargets(): string[] {
    const targets = this.config?.autoMove?.targets;
    return targets ? [...this.piles.keys()].filter((id) => this.matchesPile(targets, id)) : [];
  }

  private moveToAutoTargets(cardId: string): boolean {
    for (const target of this.autoTargets()) {
      if (this.canDrop([cardId], target)) {
        this.commitDrop([cardId], target);
        return true;
      }
    }
    return false;
  }

  private canAutoFinish(): boolean {
    const stock = this.stockBehavior();
    if (stock && ((this.piles.get(stock.stockId)?.length ?? 0) > 0 || (this.piles.get(stock.wasteId)?.length ?? 0) > 0)) {
      return false;
    }
    const targets = new Set(this.autoTargets());
    let remaining = 0;
    for (const [pileId, ids] of this.piles) {
      if (targets.has(pileId)) continue;
      for (const id of ids) {
        if (!this.getCardData(id)?.data.faceUp) return false;
        remaining++;
      }
    }
    return remaining > 0;
  }

  private autoFinishStep(): void {
    const targets = new Set(this.autoTargets());
    for (const [pileId, ids] of this.piles) {
      const top = ids[ids.length - 1];
      if (!top || targets.has(pileId)) continue;
      if (this.moveToAutoTargets(top)) return;
    }
  }

  /**
   * True if some move could still make progress: any stock/waste card that
   * can be played (cycling the stock reaches them all), any tableau card to
   * the foundations, or a tableau run whose move uncovers a card or empties a
   * column. Shuffling a run between two equivalent piles doesn't count.
   */
  private hasUsefulMove(): boolean {
    const stock = this.stockBehavior();
    const targets = [...this.piles.keys()];
    const fromStock = stock
      ? [...(this.piles.get(stock.stockId) ?? []), ...(this.piles.get(stock.wasteId) ?? [])]
      : [];
    for (const id of fromStock) {
      if (targets.some((t) => t !== stock?.stockId && t !== stock?.wasteId && this.canDrop([id], t))) return true;
    }
    const auto = new Set(this.autoTargets());
    for (const [pileId, ids] of this.piles) {
      if (!this.isGroupPile(pileId)) continue;
      for (let i = 0; i < ids.length; i++) {
        if (!this.getCardData(ids[i]!)?.data.faceUp) continue;
        const run = ids.slice(i);
        const uncovers = i === 0 || !this.getCardData(ids[i - 1]!)?.data.faceUp;
        for (const t of targets) {
          if (t === pileId || !this.canDrop(run, t)) continue;
          if (auto.has(t)) return true;
          const toEmpty = (this.piles.get(t)?.length ?? 0) === 0;
          if (uncovers && !(i === 0 && toEmpty)) return true;
        }
      }
    }
    return false;
  }

  private updateStatus(): void {
    const id = this.config?.statusTextId;
    const status = id ? this.getRenderable(id) : undefined;
    if (!status) return;
    status.text = this.won || this.hasUsefulMove() ? '' : 'No moves left — use Undo, or go back for a new deal';
    status.visible = status.text !== '';
  }

  private checkWin(): void {
    const config = this.config;
    if (!config?.winCondition) return;
    const wc = config.winCondition;

    let won = false;
    if (wc.type === 'allPilesFull') {
      won = wc.piles.every((id) => (this.piles.get(id) ?? []).length === wc.size);
    } else if (wc.type === 'allPilesEmpty') {
      won = wc.piles.every((id) => (this.piles.get(id) ?? []).length === 0);
    }

    if (won) this.won = true;
    if (won && config.events?.onWin) {
      this.eventsRef?.emit(config.events.onWin, {});
    }
  }

  private syncPileMembers(): void {
    for (const [pileId, pile] of this.piles) {
      for (let i = 0; i < pile.length; i++) {
        const entityId = pile[i]!;
        const cd = this.getCardData(entityId);
        const member = this.getPileMember(entityId);
        if (member && cd) {
          member.data.pileId = pileId;
          member.data.posInPile = i;
          member.data.expanded = cd.data.faceUp;
        }
      }
    }
    this.eventsRef?.emit('pile:layout_dirty', {});
  }

  private updateCardVisuals(entityId: string): void {
    const cd = this.getCardData(entityId);
    const renderable = this.getRenderable(entityId);
    if (!cd || !renderable) return;

    const config = this.config;
    const rankLabels = config?.rankLabels ?? DEFAULT_RANK_LABELS;
    const faceUpColor = config?.faceUpColor ?? DEFAULT_FACE_UP_COLOR;
    const faceDownColor = config?.faceDownColor ?? DEFAULT_FACE_DOWN_COLOR;

    const suffixes = this.deckConfig?.labelSuffixes ?? ['tl', 'br'];
    if (cd.data.faceUp) {
      renderable.color = faceUpColor;
      const labelText = (rankLabels[cd.data.rank] ?? '') + cd.data.suit;
      const group = this.colorGroupOf.get(cd.data.suit) ?? '';
      const labelColor = this.config?.groupColors?.[group] ?? '#000000';
      for (const suffix of suffixes) {
        const lr = this.getLabelRenderable(entityId, suffix);
        if (!lr) continue;
        lr.text = labelText;
        lr.textColor = labelColor;
        lr.visible = true;
      }
    } else {
      renderable.color = faceDownColor;
      for (const suffix of suffixes) {
        const lr = this.getLabelRenderable(entityId, suffix);
        if (lr) lr.visible = false;
      }
    }
  }

  private getCardData(entityId: string): DataComponent<CardData> | undefined {
    return this.scene?.getEntity(entityId)?.getComponent<DataComponent<CardData>>('Card');
  }

  private getRenderable(entityId: string): RenderableComponent | undefined {
    return this.scene?.getEntity(entityId)?.getComponent<RenderableComponent>('Renderable');
  }

  private getPileMember(entityId: string): DataComponent<PileMemberData> | undefined {
    return this.scene?.getEntity(entityId)?.getComponent<DataComponent<PileMemberData>>('PileMember');
  }

  private getLabelRenderable(cardId: string, suffix: string): RenderableComponent | undefined {
    return this.scene?.getEntity(`${cardId}-label-${suffix}`)?.getComponent<RenderableComponent>('Renderable');
  }

  private setDraggable(entityId: string, enabled: boolean): void {
    const draggable = this.scene?.getEntity(entityId)?.getComponent<DataComponent<DraggableData>>('Draggable');
    if (draggable) draggable.data.enabled = enabled;
  }

  private setDragGroup(entityId: string, groupId: string, groupOrder: number): void {
    const dg = this.scene?.getEntity(entityId)?.getComponent<DataComponent<DragGroupData>>('DragGroup');
    if (dg) {dg.data.groupId = groupId; dg.data.groupOrder = groupOrder;}
  }

  // --- Deck initialization ---

  private shuffleDeck<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]!; a[i] = a[j]!; a[j] = tmp;
    }
    return a;
  }

  private getPileAnchor(pileId: string): {x: number; y: number} {
    return this.pileAnchorCache.get(pileId) ?? {x: 0, y: 0};
  }

  private initializeDeck(deckConfig: DeckConfigData): void {
    const deck: Array<{rank: number; suit: string}> = [];
    for (const suit of deckConfig.suits) {
      for (let rank = 1; rank <= deckConfig.ranks; rank++) {
        deck.push({rank, suit});
      }
    }
    const shuffled = this.shuffleDeck(deck);

    const pattern = deckConfig.dealPattern;
    if (pattern.type === 'klondike') {
      this.dealKlondike(shuffled, deckConfig, pattern);
    }
  }

  private dealKlondike(
    deck: Array<{rank: number; suit: string}>,
    deckConfig: DeckConfigData,
    pattern: Extract<DealPatternConfig, {type: 'klondike'}>,
  ): void {
    const rankLabels = this.config?.rankLabels ?? DEFAULT_RANK_LABELS;
    let deckIndex = 0;

    for (let col = 0; col < pattern.tableauCount; col++) {
      const pileId = `${pattern.tableauPrefix}${col}`;
      for (let pos = 0; pos <= col; pos++) {
        const card = deck[deckIndex++]!;
        const faceUp = pos === col;
        const cardId = `card-${card.suit}-${card.rank}`;
        const labelText = faceUp ? (rankLabels[card.rank] ?? '') + card.suit : '';
        const group = this.colorGroupOf.get(card.suit) ?? '';
        const labelColor = this.config?.groupColors?.[group] ?? '#000000';
        this.createCardEntity(cardId, card.rank, card.suit, faceUp, pileId, pos, deckConfig, labelText, labelColor);
        this.piles.get(pileId)!.push(cardId);
      }
    }

    let pos = 0;
    while (deckIndex < deck.length) {
      const card = deck[deckIndex++]!;
      const cardId = `card-${card.suit}-${card.rank}`;
      this.createCardEntity(cardId, card.rank, card.suit, false, pattern.stockId, pos, deckConfig, '', '#000000');
      this.piles.get(pattern.stockId)!.push(cardId);
      pos++;
    }
  }

  private createCardEntity(
    cardId: string,
    rank: number,
    suit: string,
    faceUp: boolean,
    pileId: string,
    posInPile: number,
    deckConfig: DeckConfigData,
    labelText: string,
    labelColor: string,
  ): void {
    const scene = this.scene!;
    const anchor = this.getPileAnchor(pileId);
    const faceUpColor = this.config?.faceUpColor ?? DEFAULT_FACE_UP_COLOR;
    const faceDownColor = this.config?.faceDownColor ?? DEFAULT_FACE_DOWN_COLOR;
    const groupId = this.isGroupPile(pileId) ? pileId : '';
    const hw = deckConfig.cardWidth / 2;
    const hh = deckConfig.cardHeight / 2;

    scene.addEntity(loadEntity({
      id: cardId,
      components: {
        Transform: {position: {x: anchor.x, y: anchor.y}, rotation: 0, scale: {x: 1, y: 1}},
        Renderable: {
          width: deckConfig.cardWidth, height: deckConfig.cardHeight,
          color: faceUp ? faceUpColor : faceDownColor,
          zIndex: posInPile, visible: true, borderColor: '#cccccc', borderWidth: 1,
        },
        Card: {rank, suit, faceUp, pileId, posInPile},
        Draggable: {enabled: faceUp},
        DragGroup: {groupId, groupOrder: posInPile},
        PileMember: {pileId, posInPile, expanded: faceUp},
      },
    }));

    const suffixes = deckConfig.labelSuffixes ?? ['tl', 'br'];
    const labelSlots = [
      {offsetX: -hw + 4, offsetY: -hh + 4, rotation: 0},
      {offsetX: hw - 4, offsetY: hh - 4, rotation: Math.PI},
    ];
    for (let i = 0; i < suffixes.length && i < labelSlots.length; i++) {
      const slot = labelSlots[i]!;
      scene.addEntity(loadEntity({
        id: `${cardId}-label-${suffixes[i]}`,
        components: {
          Transform: {position: {x: anchor.x, y: anchor.y}, rotation: slot.rotation, scale: {x: 1, y: 1}},
          Renderable: {
            renderType: 'text', width: 0, height: 0,
            zIndex: posInPile + 1, visible: faceUp,
            text: labelText, textColor: labelColor, fontSize: 14, textAnchor: 'top-left',
          },
          ChildOf: {parentId: cardId, offsetX: slot.offsetX, offsetY: slot.offsetY, zIndexOffset: 1},
        },
      }));
    }
  }
}
