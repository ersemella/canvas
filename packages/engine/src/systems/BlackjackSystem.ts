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
import {Shoe} from 'util/Shoe';
import {renderCardHand} from 'util/CardHandRenderer';
import type {HandCard, CardSlot} from 'util/CardHandRenderer';

type Phase = 'betting' | 'player' | 'dealer' | 'result' | 'gameover';

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
  private shoe: Shoe | null = null;
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
    this.shoe = new Shoe(cfg.numDecks);

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
      const shouldHit = dv.total < 17 || (dv.soft && dv.total === 17 && cfg.dealerHitSoft17);
      if (!shouldHit) break;
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
    const {rank, suit} = this.shoe!.deal();
    const handCard: HandCard = {rank, suit, faceUp};
    if (to === 'player') {
      this.playerHand.push(handCard);
    } else {
      this.dealerHand.push(handCard);
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

  private updateCardVisuals(): void {
    const cfg = this.config;
    if (!cfg) return;
    const layout = {
      canvasCenterX: cfg.canvasCenterX,
      cardWidth: cfg.cardWidth,
      cardHeight: cfg.cardHeight,
      cardGap: cfg.cardGap,
    };
    renderCardHand(this.playerHand, this.playerSlots, cfg.playerCenterY, layout);
    renderCardHand(this.dealerHand, this.dealerSlots, cfg.dealerCenterY, layout);
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
