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

type Phase = 'betting' | 'insurance' | 'player' | 'dealer' | 'result';

/** One of the player's hands; there are several after a split. */
interface PlayerHand {
  cards: HandCard[];
  bet: number;
  done: boolean;
  doubled: boolean;
  /** Split aces get exactly one card each and can't be hit. */
  splitAces: boolean;
}

interface Button {
  clickable: DataComponent<ClickableData>;
  bg: RenderableComponent;
  color: string;
}

const BTN_DIM = '#555555';
const BUTTON_COLORS: Record<string, string> = {
  hit: '#2ecc71',
  stand: '#e74c3c',
  double: '#f39c12',
  deal: '#3498db',
  betUp: '#7f8c8d',
  betDown: '#7f8c8d',
  split: '#9b59b6',
  surrender: '#95a5a6',
  insurance: '#16a085',
  noInsurance: '#7f8c8d',
};

/** Card value for splitting: tens and faces all count as 10. */
const splitValue = (c: HandCard) => Math.min(c.rank, 10);

export class BlackjackSystem extends BaseSystem {
  readonly priority = 100;

  private config: BlackjackConfigData | null = null;
  private scene: Scene | null = null;
  private eventsRef: EventBus | null = null;

  private phase: Phase = 'betting';
  private shoe: Shoe | null = null;
  private hands: PlayerHand[] = [];
  private active = 0;
  private dealerHand: HandCard[] = [];
  private balance = 0;
  /** The bet chosen with the +/- buttons, staked on each new round. */
  private bet = 0;
  private insuranceBet = 0;

  private playerSlots: CardSlot[] = [];
  private dealerSlots: CardSlot[] = [];

  private balanceText: RenderableComponent | null = null;
  private betText: RenderableComponent | null = null;
  private playerValueText: RenderableComponent | null = null;
  private dealerValueText: RenderableComponent | null = null;
  private statusText: RenderableComponent | null = null;

  private buttons: Partial<Record<keyof typeof BUTTON_COLORS, Button>> = {};

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

    this.playerSlots = this.collectSlots(cfg.playerCardPrefix);
    this.dealerSlots = this.collectSlots(cfg.dealerCardPrefix);

    const renderable = (id: string) => scene.getEntity(id)?.getComponent<RenderableComponent>('Renderable') ?? null;
    this.balanceText = renderable(cfg.balanceTextId);
    this.betText = renderable(cfg.betTextId);
    this.playerValueText = renderable(cfg.playerValueTextId);
    this.dealerValueText = renderable(cfg.dealerValueTextId);
    this.statusText = renderable(cfg.statusTextId);

    const ids: Record<keyof typeof BUTTON_COLORS, string | undefined> = {
      hit: cfg.hitButtonId,
      stand: cfg.standButtonId,
      double: cfg.doubleButtonId,
      deal: cfg.dealButtonId,
      betUp: cfg.betUpButtonId,
      betDown: cfg.betDownButtonId,
      split: cfg.splitButtonId,
      surrender: cfg.surrenderButtonId,
      insurance: cfg.insuranceButtonId,
      noInsurance: cfg.noInsuranceButtonId,
    };
    for (const [name, id] of Object.entries(ids)) {
      const entity = id ? scene.getEntity(id) : undefined;
      const clickable = entity?.getComponent<DataComponent<ClickableData>>('Clickable');
      const bg = entity?.getComponent<RenderableComponent>('Renderable');
      if (clickable && bg) this.buttons[name] = {clickable, bg, color: BUTTON_COLORS[name]!};
    }

    this.render();
    events.on<ClickPayload>('click', this.onClick);
  }

  onUpdate(_context: SystemContext): void {
    // Event-driven: everything happens in the click handler.
  }

  // ── Input ────────────────────────────────────────────────────────────────

  private readonly onClick = ({entityId}: ClickPayload): void => {
    const cfg = this.config;
    if (!cfg) return;
    const is = (name: keyof typeof BUTTON_COLORS) =>
      this.buttons[name]?.clickable.data.enabled && entityId === this.buttonId(name);

    if (this.phase === 'betting') {
      if (is('betUp')) this.bet = Math.min(this.bet + cfg.minBet, this.balance);
      else if (is('betDown')) this.bet = Math.max(this.bet - cfg.minBet, cfg.minBet);
      else if (is('deal')) return this.startDeal();
      this.render();
    } else if (this.phase === 'insurance') {
      if (is('insurance')) this.takeInsurance(true);
      else if (is('noInsurance')) this.takeInsurance(false);
    } else if (this.phase === 'player') {
      if (is('hit')) this.hit();
      else if (is('stand')) this.stand();
      else if (is('double')) this.double();
      else if (is('split')) this.split();
      else if (is('surrender')) this.surrender();
    } else if (this.phase === 'result' && is('deal')) {
      if (this.balance < cfg.minBet) {
        this.eventsRef?.emit('blackjack:gameover', {});
        return;
      }
      this.phase = 'betting';
      this.bet = Math.max(cfg.minBet, Math.min(this.bet, this.balance));
      this.hands = [];
      this.dealerHand = [];
      this.render();
    }
  };

  private buttonId(name: keyof typeof BUTTON_COLORS): string | undefined {
    const cfg = this.config!;
    return {
      hit: cfg.hitButtonId,
      stand: cfg.standButtonId,
      double: cfg.doubleButtonId,
      deal: cfg.dealButtonId,
      betUp: cfg.betUpButtonId,
      betDown: cfg.betDownButtonId,
      split: cfg.splitButtonId,
      surrender: cfg.surrenderButtonId,
      insurance: cfg.insuranceButtonId,
      noInsurance: cfg.noInsuranceButtonId,
    }[name];
  }

  // ── Round flow ───────────────────────────────────────────────────────────

  private startDeal(): void {
    this.shoe!.reshuffleIfLow(); // shuffle between hands, never during one
    this.bet = Math.min(this.bet, this.balance);
    this.balance -= this.bet;
    this.hands = [{cards: [], bet: this.bet, done: false, doubled: false, splitAces: false}];
    this.active = 0;
    this.dealerHand = [];
    this.insuranceBet = 0;

    const hand = this.hands[0]!;
    hand.cards.push(this.draw(true));
    this.dealerHand.push(this.draw(true));
    hand.cards.push(this.draw(true));
    this.dealerHand.push(this.draw(false)); // hole card

    if (this.dealerHand[0]!.rank === 1 && this.buttons.insurance && this.balance >= this.insuranceCost()) {
      this.phase = 'insurance';
      this.setStatus(`Dealer shows an Ace — insurance for $${this.insuranceCost()}?`);
      this.render();
      return;
    }
    this.settleNaturals('');
  }

  private insuranceCost(): number {
    return Math.floor(this.hands[0]!.bet / 2);
  }

  private takeInsurance(yes: boolean): void {
    if (yes) {
      this.insuranceBet = this.insuranceCost();
      this.balance -= this.insuranceBet;
    }
    this.settleNaturals(yes ? 'insured' : '');
  }

  /**
   * The dealer peeks for blackjack before the player acts, so naturals are
   * settled here; insurance (if taken) is paid or lost at the same moment.
   */
  private settleNaturals(insurance: '' | 'insured'): void {
    const hand = this.hands[0]!;
    const playerNatural = this.total(hand.cards) === 21;
    const dealerNatural = this.total(this.dealerHand) === 21;

    let note = '';
    if (insurance) {
      if (dealerNatural) {
        this.balance += this.insuranceBet * 3; // stake back + 2:1
        note = ' Insurance pays 2:1.';
      } else {
        note = ' Insurance lost.';
      }
    }

    if (playerNatural || dealerNatural) {
      this.revealDealer();
      if (playerNatural && dealerNatural) {
        this.balance += hand.bet;
        this.finish(`Push — both have Blackjack!${note}`);
      } else if (playerNatural) {
        this.balance += Math.floor(hand.bet * 2.5); // 3:2
        this.finish(`Blackjack! 🃏 You win!${note}`);
      } else {
        this.finish(`Dealer has Blackjack.${note}`);
      }
      return;
    }

    this.phase = 'player';
    this.setStatus(`${note.trim() ? `No dealer Blackjack —${note.toLowerCase()} ` : ''}Your move`.trim());
    this.render();
  }

  private hit(): void {
    const hand = this.current();
    if (!hand || hand.splitAces) return;
    hand.cards.push(this.draw(true));
    if (this.total(hand.cards) >= 21) hand.done = true;
    this.advance();
  }

  private stand(): void {
    const hand = this.current();
    if (!hand) return;
    hand.done = true;
    this.advance();
  }

  private double(): void {
    const hand = this.current();
    if (!hand || !this.canDouble(hand)) return;
    this.balance -= hand.bet;
    hand.bet *= 2;
    hand.doubled = true;
    hand.cards.push(this.draw(true));
    hand.done = true;
    this.advance();
  }

  private split(): void {
    const hand = this.current();
    if (!hand || !this.canSplit(hand)) return;
    this.balance -= hand.bet;
    const moved = hand.cards.pop()!;
    const aces = moved.rank === 1;
    const newHand: PlayerHand = {cards: [moved], bet: hand.bet, done: false, doubled: false, splitAces: aces};
    hand.splitAces = aces;
    this.hands.splice(this.active + 1, 0, newHand);
    hand.cards.push(this.draw(true));
    newHand.cards.push(this.draw(true));
    // Split aces get one card each; any hand that reached 21 stands.
    for (const h of [hand, newHand]) if (aces || this.total(h.cards) === 21) h.done = true;
    this.advance();
  }

  private surrender(): void {
    const hand = this.current();
    if (!hand || !this.canSurrender()) return;
    this.balance += Math.floor(hand.bet / 2);
    this.revealDealer();
    this.finish('You surrender — half your bet is returned.');
  }

  /** Moves to the next unfinished hand, or to the dealer when all are done. */
  private advance(): void {
    const next = this.hands.findIndex((h) => !h.done);
    if (next !== -1) {
      this.active = next;
      this.setStatus(this.hands.length > 1 ? `Hand ${next + 1} of ${this.hands.length}` : 'Your move');
      this.render();
      return;
    }
    this.dealerTurn();
  }

  private dealerTurn(): void {
    const cfg = this.config!;
    this.phase = 'dealer';
    this.revealDealer();

    // The dealer only draws if some hand is still alive.
    if (this.hands.some((h) => this.total(h.cards) <= 21)) {
      for (;;) {
        const {total, soft} = this.value(this.dealerHand, true);
        if (total > 17 || (total === 17 && !(soft && cfg.dealerHitSoft17))) break;
        this.dealerHand.push(this.draw(true));
      }
    }

    const dealer = this.total(this.dealerHand);
    const results = this.hands.map((h) => {
      const p = this.total(h.cards);
      if (p > 21) return 'bust';
      if (dealer > 21 || p > dealer) {
        this.balance += h.bet * 2;
        return 'win';
      }
      if (p === dealer) {
        this.balance += h.bet;
        return 'push';
      }
      return 'lose';
    });

    if (results.length === 1) {
      const r = results[0]!;
      this.finish(
        r === 'bust' ? 'Bust! Dealer wins.'
        : r === 'push' ? 'Push — tie!'
        : r === 'lose' ? 'Dealer wins.'
        : dealer > 21 ? 'Dealer busts — You win!'
        : 'You win!',
      );
    } else {
      const words = {win: 'win', lose: 'lose', push: 'push', bust: 'bust'};
      this.finish(results.map((r, i) => `Hand ${i + 1}: ${words[r as keyof typeof words]}`).join(' · '));
    }
  }

  private finish(message: string): void {
    const cfg = this.config!;
    this.phase = 'result';
    this.setStatus(this.balance < cfg.minBet ? `${message} Out of chips!` : message);
    this.render();
  }

  // ── Rules helpers ────────────────────────────────────────────────────────

  private current(): PlayerHand | undefined {
    return this.phase === 'player' ? this.hands[this.active] : undefined;
  }

  private canDouble(hand: PlayerHand): boolean {
    return hand.cards.length === 2 && !hand.splitAces && !hand.done && this.balance >= hand.bet;
  }

  private canSplit(hand: PlayerHand): boolean {
    const [a, b] = hand.cards;
    return (
      Boolean(this.buttons.split) &&
      hand.cards.length === 2 &&
      !hand.done &&
      splitValue(a!) === splitValue(b!) &&
      this.hands.length < (this.config?.maxHands ?? 4) &&
      this.balance >= hand.bet
    );
  }

  /** Late surrender: only as the very first decision of an unsplit hand. */
  private canSurrender(): boolean {
    return Boolean(this.buttons.surrender) && this.hands.length === 1 && this.hands[0]!.cards.length === 2;
  }

  private draw(faceUp: boolean): HandCard {
    const {rank, suit} = this.shoe!.deal();
    return {rank, suit, faceUp};
  }

  private revealDealer(): void {
    for (const c of this.dealerHand) c.faceUp = true;
  }

  private total(cards: HandCard[]): number {
    return this.value(cards, true).total;
  }

  private value(cards: HandCard[], includeHidden: boolean): {total: number; soft: boolean} {
    let total = 0;
    let aces = 0;
    for (const card of cards) {
      if (!includeHidden && !card.faceUp) continue;
      total += Math.min(card.rank, 10);
      if (card.rank === 1) aces++;
    }
    if (aces > 0 && total + 10 <= 21) return {total: total + 10, soft: true};
    return {total, soft: false};
  }

  private valueLabel(cards: HandCard[]): string {
    const {total, soft} = this.value(cards, false);
    if (total === 0) return '';
    // Only an unsplit two-card 21 is a blackjack (a split hand's 21 pays 1:1).
    const unsplit = cards !== this.hands[0]?.cards || this.hands.length === 1;
    if (unsplit && cards.length === 2 && total === 21 && cards.every((c) => c.faceUp)) return 'Blackjack';
    return soft && total < 21 ? `${total - 10} / ${total}` : String(total);
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  private collectSlots(prefix: string): CardSlot[] {
    const slots: CardSlot[] = [];
    for (let i = 0; ; i++) {
      const bgEntity = this.scene!.getEntity(`${prefix}-${i}`);
      const bg = bgEntity?.getComponent<RenderableComponent>('Renderable');
      const transform = bgEntity?.getComponent<TransformComponent>('Transform');
      const label = this.scene!.getEntity(`${prefix}-${i}-label`)?.getComponent<RenderableComponent>('Renderable');
      if (!bg || !transform || !label) return slots;
      slots.push({bg, label, transform});
    }
  }

  private setStatus(text: string): void {
    if (this.statusText) this.statusText.text = text;
  }

  private render(): void {
    const cfg = this.config;
    if (!cfg) return;

    // Cards: the dealer centered; split hands share the table width.
    const base = {
      canvasCenterX: cfg.canvasCenterX,
      cardWidth: cfg.cardWidth,
      cardHeight: cfg.cardHeight,
      cardGap: cfg.cardGap,
    };
    renderCardHand(this.dealerHand, this.dealerSlots, cfg.dealerCenterY, base);

    const n = Math.max(1, this.hands.length);
    const tableWidth = cfg.tableWidth ?? cfg.canvasCenterX * 2;
    const perHand = Math.floor(this.playerSlots.length / n);
    for (let i = 0; i < n; i++) {
      const slots = this.playerSlots.slice(i * perHand, (i + 1) * perHand);
      const hand = this.hands[i]?.cards ?? [];
      if (n === 1) {
        renderCardHand(hand, slots, cfg.playerCenterY, base);
        continue;
      }
      const area = tableWidth / n;
      const lift = this.phase === 'player' && i === this.active ? -10 : 0;
      renderCardHand(hand, slots, cfg.playerCenterY + lift, {
        ...base,
        canvasCenterX: area * (i + 0.5),
        maxWidth: area - 12,
      });
    }
    for (const slot of this.playerSlots.slice(n * perHand)) {
      slot.bg.visible = false;
      slot.label.visible = false;
    }

    // Text
    if (this.balanceText) this.balanceText.text = `Balance: $${this.balance}`;
    if (this.betText) this.betText.text = `$${this.bet}`;
    if (this.playerValueText) {
      this.playerValueText.text =
        this.hands.length <= 1
          ? this.valueLabel(this.hands[0]?.cards ?? [])
          : this.hands
              .map((h, i) => {
                const mark = this.phase === 'player' && i === this.active ? '▶' : '';
                return `${mark}${this.valueLabel(h.cards)}${h.doubled ? ' ×2' : ''}`;
              })
              .join('   ');
    }
    if (this.dealerValueText) this.dealerValueText.text = this.valueLabel(this.dealerHand);
    if (this.phase === 'betting') this.setStatus('Place your bet and deal');

    // Buttons
    const hand = this.current();
    const enabled: Record<keyof typeof BUTTON_COLORS, boolean> = {
      hit: Boolean(hand && !hand.splitAces),
      stand: Boolean(hand),
      double: Boolean(hand && this.canDouble(hand)),
      split: Boolean(hand && this.canSplit(hand)),
      surrender: Boolean(hand && this.canSurrender()),
      deal: this.phase === 'betting' || this.phase === 'result',
      betUp: this.phase === 'betting' && this.bet < this.balance,
      betDown: this.phase === 'betting' && this.bet > cfg.minBet,
      insurance: this.phase === 'insurance',
      noInsurance: this.phase === 'insurance',
    };
    for (const [name, button] of Object.entries(this.buttons)) {
      if (!button) continue;
      const on = enabled[name] ?? false;
      button.clickable.data.enabled = on;
      button.bg.color = on ? button.color : BTN_DIM;
    }
  }
}
