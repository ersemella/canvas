import {BaseSystem} from 'core/System';
import type {SystemContext} from 'core/System';
import type {DataComponent} from 'core/Component';
import type {EventBus} from 'core/EventBus';
import type {Scene} from 'core/Scene';
import type {TransformComponent} from 'components/TransformComponent';
import type {RenderableComponent} from 'components/RenderableComponent';
import type {ClickableData} from 'components/ClickableComponent';
import type {BlackjackConfigData} from 'components/BlackjackConfigComponent';
import type {ClickPayload} from 'systems/ClickSystem';

type Phase = 'betting' | 'player' | 'dealer' | 'result' | 'gameover';

interface HandCard {
  suit: string;
  rank: number;
  faceUp: boolean;
}

interface CardSlot {
  bg: RenderableComponent;
  label: RenderableComponent;
  transform: TransformComponent;
}

const CARD_BACK_COLOR = '#1a5c96';
const CARD_BACK_BORDER = '#0d3d6b';
const CARD_FACE_BORDER = '#888888';

const BTN_HIT = '#2ecc71';
const BTN_STAND = '#e74c3c';
const BTN_DOUBLE = '#f39c12';
const BTN_DEAL = '#3498db';
const BTN_BET = '#7f8c8d';
const BTN_DIM = '#555555';

export class BlackjackSystem extends BaseSystem {
  readonly priority = 100;

  private config: BlackjackConfigData | null = null;
  private scene: Scene | null = null;
  private eventsRef: EventBus | null = null;

  private phase: Phase = 'betting';
  private shoe: HandCard[] = [];
  private playerHand: HandCard[] = [];
  private dealerHand: HandCard[] = [];
  private balance = 0;
  private bet = 0;

  private playerSlots: CardSlot[] = [];
  private dealerSlots: CardSlot[] = [];

  private balanceText: RenderableComponent | null = null;
  private betText: RenderableComponent | null = null;
  private playerValueText: RenderableComponent | null = null;
  private dealerValueText: RenderableComponent | null = null;
  private statusText: RenderableComponent | null = null;

  private hitClickable: DataComponent<ClickableData> | null = null;
  private standClickable: DataComponent<ClickableData> | null = null;
  private doubleClickable: DataComponent<ClickableData> | null = null;
  private dealClickable: DataComponent<ClickableData> | null = null;
  private betUpClickable: DataComponent<ClickableData> | null = null;
  private betDownClickable: DataComponent<ClickableData> | null = null;

  private hitBg: RenderableComponent | null = null;
  private standBg: RenderableComponent | null = null;
  private doubleBg: RenderableComponent | null = null;
  private dealBg: RenderableComponent | null = null;
  private betUpBg: RenderableComponent | null = null;
  private betDownBg: RenderableComponent | null = null;

  onInit({scene, events}: Omit<SystemContext, 'deltaTime'>): void {
    this.scene = scene;
    this.eventsRef = events;

    const configEntity = scene.query({all: ['BlackjackConfig']})[0];
    if (!configEntity) return;
    this.config = configEntity.getComponent<DataComponent<BlackjackConfigData>>('BlackjackConfig')!.data;
    const cfg = this.config;

    this.balance = cfg.startingBalance;
    this.bet = cfg.minBet;

    // Cache card slots
    for (let i = 0; i < cfg.maxCards; i++) {
      const pBgEntity = scene.getEntity(`${cfg.playerCardPrefix}-${i}`);
      const pBg = pBgEntity?.getComponent<RenderableComponent>('Renderable');
      const pTf = pBgEntity?.getComponent<TransformComponent>('Transform');
      const pLabel = scene.getEntity(`${cfg.playerCardPrefix}-${i}-label`)?.getComponent<RenderableComponent>('Renderable');
      if (pBg && pTf && pLabel) {
        this.playerSlots.push({bg: pBg, label: pLabel, transform: pTf});
      }

      const dBgEntity = scene.getEntity(`${cfg.dealerCardPrefix}-${i}`);
      const dBg = dBgEntity?.getComponent<RenderableComponent>('Renderable');
      const dTf = dBgEntity?.getComponent<TransformComponent>('Transform');
      const dLabel = scene.getEntity(`${cfg.dealerCardPrefix}-${i}-label`)?.getComponent<RenderableComponent>('Renderable');
      if (dBg && dTf && dLabel) {
        this.dealerSlots.push({bg: dBg, label: dLabel, transform: dTf});
      }
    }

    // Cache UI text refs
    this.balanceText = scene.getEntity(cfg.balanceTextId)?.getComponent<RenderableComponent>('Renderable') ?? null;
    this.betText = scene.getEntity(cfg.betTextId)?.getComponent<RenderableComponent>('Renderable') ?? null;
    this.playerValueText = scene.getEntity(cfg.playerValueTextId)?.getComponent<RenderableComponent>('Renderable') ?? null;
    this.dealerValueText = scene.getEntity(cfg.dealerValueTextId)?.getComponent<RenderableComponent>('Renderable') ?? null;
    this.statusText = scene.getEntity(cfg.statusTextId)?.getComponent<RenderableComponent>('Renderable') ?? null;

    // Cache button clickables
    const getClickable = (id: string): DataComponent<ClickableData> | null =>
      scene.getEntity(id)?.getComponent<DataComponent<ClickableData>>('Clickable') ?? null;
    this.hitClickable = getClickable(cfg.hitButtonId);
    this.standClickable = getClickable(cfg.standButtonId);
    this.doubleClickable = getClickable(cfg.doubleButtonId);
    this.dealClickable = getClickable(cfg.dealButtonId);
    this.betUpClickable = getClickable(cfg.betUpButtonId);
    this.betDownClickable = getClickable(cfg.betDownButtonId);

    // Cache button backgrounds for color updates
    const getBg = (id: string): RenderableComponent | null =>
      scene.getEntity(id)?.getComponent<RenderableComponent>('Renderable') ?? null;
    this.hitBg = getBg(cfg.hitButtonId);
    this.standBg = getBg(cfg.standButtonId);
    this.doubleBg = getBg(cfg.doubleButtonId);
    this.dealBg = getBg(cfg.dealButtonId);
    this.betUpBg = getBg(cfg.betUpButtonId);
    this.betDownBg = getBg(cfg.betDownButtonId);

    this.initShoe();
    this.updateUI();
    this.updateCardVisuals();

    events.on<ClickPayload>('click', this.onClickHandler);
  }

  onUpdate(_context: SystemContext): void {
    // All logic handled via event listeners registered in onInit
  }

  private readonly onClickHandler = ({entityId}: ClickPayload): void => {
    const cfg = this.config;
    const scene = this.scene;
    const events = this.eventsRef;
    if (!cfg || !scene || !events) return;

    if (this.phase === 'betting') {
      if (entityId === cfg.betUpButtonId) {
        this.bet = Math.min(this.bet + cfg.minBet, this.balance);
        this.updateUI();
      } else if (entityId === cfg.betDownButtonId) {
        this.bet = Math.max(this.bet - cfg.minBet, cfg.minBet);
        this.updateUI();
      } else if (entityId === cfg.dealButtonId) {
        this.startDeal(events);
      }
    } else if (this.phase === 'player') {
      if (entityId === cfg.hitButtonId) {
        this.doHit(events);
      } else if (entityId === cfg.standButtonId) {
        this.doStand(events);
      } else if (entityId === cfg.doubleButtonId && this.playerHand.length === 2) {
        this.doDouble(events);
      }
    } else if (this.phase === 'result') {
      if (entityId === cfg.dealButtonId) {
        const cfg2 = this.config!;
        if (this.balance < cfg2.minBet) {
          events.emit('blackjack:gameover', {});
          return;
        }
        this.phase = 'betting';
        this.bet = Math.min(this.bet, this.balance);
        if (this.bet < cfg2.minBet) this.bet = cfg2.minBet;
        this.playerHand = [];
        this.dealerHand = [];
        this.updateUI();
        this.updateCardVisuals();
      }
    }
  };

  private startDeal(events: EventBus): void {
    const cfg = this.config!;
    if (this.bet > this.balance) this.bet = this.balance;
    this.balance -= this.bet;
    this.playerHand = [];
    this.dealerHand = [];

    this.dealCard('player', true);
    this.dealCard('dealer', true);
    this.dealCard('player', true);
    this.dealCard('dealer', false); // hole card

    this.phase = 'player';

    // Check for player blackjack (natural 21 in 2 cards)
    const pv = this.handValue(this.playerHand, true);
    if (pv.total === 21) {
      const dv = this.handValue(this.dealerHand, true);
      this.dealerHand.forEach((c) => { c.faceUp = true; });
      if (dv.total === 21) {
        this.balance += this.bet; // push
        this.setResult('Push — both have Blackjack!', events);
      } else {
        this.balance += Math.floor(this.bet * 2.5); // 3:2 payout
        this.setResult('Blackjack! \uD83C\uDCCF You win!', events);
      }
    } else {
      this.updateUI();
      this.updateCardVisuals();
    }
  }

  private doHit(events: EventBus): void {
    this.dealCard('player', true);
    const pv = this.handValue(this.playerHand, true);
    if (pv.total > 21) {
      this.dealerHand.forEach((c) => { c.faceUp = true; });
      this.setResult('Bust! Dealer wins.', events);
    } else {
      this.updateUI();
      this.updateCardVisuals();
    }
  }

  private doStand(events: EventBus): void {
    this.runDealerTurn(events);
  }

  private doDouble(events: EventBus): void {
    const extra = Math.min(this.bet, this.balance);
    this.balance -= extra;
    this.bet += extra;
    this.dealCard('player', true);
    const pv = this.handValue(this.playerHand, true);
    if (pv.total > 21) {
      this.dealerHand.forEach((c) => { c.faceUp = true; });
      this.setResult('Bust! Dealer wins.', events);
    } else {
      this.runDealerTurn(events);
    }
  }

  private runDealerTurn(events: EventBus): void {
    this.phase = 'dealer';
    const cfg = this.config!;
    this.dealerHand.forEach((c) => { c.faceUp = true; });

    while (true) {
      const dv = this.handValue(this.dealerHand, true);
      if (dv.total > 21) break;
      if (dv.total > 17) break;
      if (dv.total === 17 && (!dv.soft || !cfg.dealerHitSoft17)) break;
      this.dealCard('dealer', true);
    }

    const pv = this.handValue(this.playerHand, true);
    const dv = this.handValue(this.dealerHand, true);

    if (dv.total > 21) {
      this.balance += this.bet * 2;
      this.setResult('Dealer busts — You win!', events);
    } else if (pv.total > dv.total) {
      this.balance += this.bet * 2;
      this.setResult('You win!', events);
    } else if (pv.total === dv.total) {
      this.balance += this.bet;
      this.setResult('Push — tie!', events);
    } else {
      this.setResult('Dealer wins.', events);
    }
  }

  private setResult(msg: string, events: EventBus): void {
    const cfg = this.config!;
    this.phase = 'result';
    if (this.statusText) this.statusText.text = msg;
    this.updateUI();
    this.updateCardVisuals();

    if (this.balance < cfg.minBet) {
      if (this.statusText) this.statusText.text = `${msg} Out of chips!`;
      // Emit gameover on next deal button click (player sees the final result first)
    }
  }

  private dealCard(to: 'player' | 'dealer', faceUp: boolean): void {
    if (this.shoe.length === 0) this.initShoe();
    const card = this.shoe.pop()!;
    const handCard: HandCard = {suit: card.suit, rank: card.rank, faceUp};
    if (to === 'player') {
      this.playerHand.push(handCard);
    } else {
      this.dealerHand.push(handCard);
    }
  }

  private initShoe(): void {
    const numDecks = this.config?.numDecks ?? 1;
    const suits = ['\u2660', '\u2665', '\u2666', '\u2663']; // ♠♥♦♣
    this.shoe = [];
    for (let d = 0; d < numDecks; d++) {
      for (const suit of suits) {
        for (let rank = 1; rank <= 13; rank++) {
          this.shoe.push({suit, rank, faceUp: true});
        }
      }
    }
    for (let i = this.shoe.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = this.shoe[i]!;
      this.shoe[i] = this.shoe[j]!;
      this.shoe[j] = tmp;
    }
  }

  private handValue(cards: HandCard[], includeHidden: boolean): {total: number; soft: boolean} {
    let total = 0;
    let aces = 0;
    for (const card of cards) {
      if (!includeHidden && !card.faceUp) continue;
      total += Math.min(card.rank, 10);
      if (card.rank === 1) aces++;
    }
    let soft = false;
    if (aces > 0 && total + 10 <= 21) {
      total += 10;
      soft = true;
    }
    return {total, soft};
  }

  private cardXPositions(count: number): number[] {
    const cfg = this.config!;
    const cx = cfg.canvasCenterX;
    const cw = cfg.cardWidth;
    const gap = cfg.cardGap;
    if (count === 0) return [];
    if (count === 1) return [cx];
    const maxStep = cw + gap;
    const step = Math.min(maxStep, (cfg.canvasCenterX * 1.6) / (count - 1));
    const totalW = step * (count - 1) + cw;
    const startX = cx - totalW / 2 + cw / 2;
    return Array.from({length: count}, (_, i) => startX + i * step);
  }

  private rankLabel(rank: number): string {
    if (rank === 1) return 'A';
    if (rank === 11) return 'J';
    if (rank === 12) return 'Q';
    if (rank === 13) return 'K';
    return String(rank);
  }

  private suitColor(suit: string): string {
    return suit === '\u2665' || suit === '\u2666' ? '#cc2200' : '#111111';
  }

  private updateCardVisuals(): void {
    const cfg = this.config;
    if (!cfg) return;

    const updateSlots = (hand: HandCard[], slots: CardSlot[], centerY: number): void => {
      const xs = this.cardXPositions(hand.length);
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i]!;
        if (i >= hand.length) {
          slot.bg.visible = false;
          slot.label.visible = false;
          continue;
        }
        const card = hand[i]!;
        slot.transform.position.x = xs[i]!;
        slot.transform.position.y = centerY;
        slot.bg.visible = true;
        slot.bg.width = cfg.cardWidth;
        slot.bg.height = cfg.cardHeight;
        slot.bg.zIndex = 10 + i;
        slot.bg.radius = 4;

        if (card.faceUp) {
          slot.bg.color = '#ffffff';
          slot.bg.borderColor = CARD_FACE_BORDER;
          slot.bg.borderWidth = 1;
          slot.label.visible = true;
          slot.label.text = `${this.rankLabel(card.rank)}${card.suit}`;
          slot.label.textColor = this.suitColor(card.suit);
          slot.label.fontSize = 14;
          slot.label.bold = true;
          slot.label.zIndex = 11 + i;
        } else {
          slot.bg.color = CARD_BACK_COLOR;
          slot.bg.borderColor = CARD_BACK_BORDER;
          slot.bg.borderWidth = 1;
          slot.label.visible = false;
        }
      }
    };

    updateSlots(this.playerHand, this.playerSlots, cfg.playerCenterY);
    updateSlots(this.dealerHand, this.dealerSlots, cfg.dealerCenterY);
  }

  private updateUI(): void {
    const cfg = this.config;
    if (!cfg) return;

    if (this.balanceText) this.balanceText.text = `Balance: $${this.balance}`;
    if (this.betText) this.betText.text = `$${this.bet}`;

    // Player hand value
    if (this.playerValueText) {
      if (this.playerHand.length > 0) {
        const {total, soft} = this.handValue(this.playerHand, false);
        this.playerValueText.text = soft ? `${total - 10} / ${total}` : String(total);
        this.playerValueText.visible = true;
      } else {
        this.playerValueText.text = '';
      }
    }

    // Dealer hand value (visible cards only, or all after reveal)
    if (this.dealerValueText) {
      if (this.dealerHand.length > 0) {
        const {total, soft} = this.handValue(this.dealerHand, false);
        if (total > 0) {
          this.dealerValueText.text = soft ? `${total - 10} / ${total}` : String(total);
        } else {
          this.dealerValueText.text = '';
        }
        this.dealerValueText.visible = true;
      } else {
        this.dealerValueText.text = '';
      }
    }

    if (this.phase === 'betting' && this.statusText) {
      this.statusText.text = 'Place your bet and deal';
    }

    // Button enable/disable + color
    const isBetting = this.phase === 'betting';
    const isPlayer = this.phase === 'player';
    const isResult = this.phase === 'result';
    const canDouble = isPlayer && this.playerHand.length === 2 && this.balance >= this.bet;
    const canDeal = isBetting || isResult;
    const canBetUp = isBetting && this.bet < this.balance;
    const canBetDown = isBetting && this.bet > cfg.minBet;

    if (this.hitClickable) this.hitClickable.data.enabled = isPlayer;
    if (this.standClickable) this.standClickable.data.enabled = isPlayer;
    if (this.doubleClickable) this.doubleClickable.data.enabled = canDouble;
    if (this.dealClickable) this.dealClickable.data.enabled = canDeal;
    if (this.betUpClickable) this.betUpClickable.data.enabled = canBetUp;
    if (this.betDownClickable) this.betDownClickable.data.enabled = canBetDown;

    if (this.hitBg) this.hitBg.color = isPlayer ? BTN_HIT : BTN_DIM;
    if (this.standBg) this.standBg.color = isPlayer ? BTN_STAND : BTN_DIM;
    if (this.doubleBg) this.doubleBg.color = canDouble ? BTN_DOUBLE : BTN_DIM;
    if (this.dealBg) this.dealBg.color = canDeal ? BTN_DEAL : BTN_DIM;
    if (this.betUpBg) this.betUpBg.color = canBetUp ? BTN_BET : BTN_DIM;
    if (this.betDownBg) this.betDownBg.color = canBetDown ? BTN_BET : BTN_DIM;
  }
}
