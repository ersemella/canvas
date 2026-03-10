import { BaseSystem } from '@canvas/engine';
import type { SystemContext } from '@canvas/engine';
import { buildDeck, shuffle, deal } from './deck';
import { findWinner } from './handEvaluator';
import { decideBotAction } from './botAI';
import { pokerActionService } from './pokerActionService';
import type { PokerGameState, PokerUiState, Player, Card, ActionType, LogEntry } from './types';

const SB = 5;
const BB = 10;
const STARTING_CHIPS = 1000;
const BOT_DELAY = 1.2; // seconds

function createInitialPlayers(): Player[] {
  const styles: Player['style'][] = ['tight', 'loose', 'aggressive', 'tight', 'loose'];
  return [
    { id: 0, name: 'You', chips: STARTING_CHIPS, holeCards: null, currentBet: 0, folded: false, allIn: false, hasActed: false, isDealer: false, isSB: false, isBB: false, style: 'loose' },
    { id: 1, name: 'Bot1', chips: STARTING_CHIPS, holeCards: null, currentBet: 0, folded: false, allIn: false, hasActed: false, isDealer: false, isSB: false, isBB: false, style: styles[0]! },
    { id: 2, name: 'Bot2', chips: STARTING_CHIPS, holeCards: null, currentBet: 0, folded: false, allIn: false, hasActed: false, isDealer: false, isSB: false, isBB: false, style: styles[1]! },
    { id: 3, name: 'Bot3', chips: STARTING_CHIPS, holeCards: null, currentBet: 0, folded: false, allIn: false, hasActed: false, isDealer: false, isSB: false, isBB: false, style: styles[2]! },
    { id: 4, name: 'Bot4', chips: STARTING_CHIPS, holeCards: null, currentBet: 0, folded: false, allIn: false, hasActed: false, isDealer: false, isSB: false, isBB: false, style: styles[3]! },
    { id: 5, name: 'Bot5', chips: STARTING_CHIPS, holeCards: null, currentBet: 0, folded: false, allIn: false, hasActed: false, isDealer: false, isSB: false, isBB: false, style: styles[4]! },
  ];
}

export function createInitialState(): PokerGameState {
  return {
    phase: 'waiting',
    players: createInitialPlayers(),
    deck: [],
    communityCards: [],
    pot: 0,
    currentBet: 0,
    actingIndex: 0,
    dealerIndex: 0,
    handNumber: 0,
    log: [],
    showdownResult: null,
  };
}

export class PokerSystem extends BaseSystem {
  readonly priority = 100;
  private gameState: PokerGameState;
  private botTimer = 0;
  private waitTimer = 0;
  private showdownTimer = 0;
  private eventsRef: SystemContext['events'] | null = null;

  constructor(gameState: PokerGameState) {
    super();
    this.gameState = gameState;
  }

  onInit(context: Omit<SystemContext, 'deltaTime'>): void {
    this.eventsRef = context.events;
    this.startHand();
  }

  onUpdate(context: SystemContext): void {
    const { deltaTime, events } = context;
    if (!this.eventsRef) this.eventsRef = events;
    const gs = this.gameState;

    if (gs.phase === 'waiting') {
      this.waitTimer += deltaTime;
      if (this.waitTimer > 1.5) {
        this.waitTimer = 0;
        this.startHand();
      }
      return;
    }

    if (gs.phase === 'showdown') {
      this.showdownTimer += deltaTime;
      if (this.showdownTimer > 3.0) {
        this.showdownTimer = 0;
        gs.phase = 'waiting';
        this.emitUiUpdate();
      }
      return;
    }

    // Active betting phase
    const actingPlayer = gs.players[gs.actingIndex];
    if (!actingPlayer) return;

    if (actingPlayer.folded || actingPlayer.allIn) {
      this.advanceActingIndex();
      return;
    }

    if (actingPlayer.id === 0) {
      // Hero turn
      const action = pokerActionService.consume();
      if (action) {
        this.applyAction(actingPlayer, action);
      }
    } else {
      // Bot turn
      this.botTimer += deltaTime;
      if (this.botTimer >= BOT_DELAY) {
        this.botTimer = 0;
        const action = decideBotAction(actingPlayer, gs);
        this.applyAction(actingPlayer, action);
      }
    }
  }

  private startHand(): void {
    const gs = this.gameState;
    gs.handNumber++;

    // Reset players
    for (const p of gs.players) {
      p.holeCards = null;
      p.currentBet = 0;
      p.folded = false;
      p.allIn = false;
      p.hasActed = false;
      p.isDealer = false;
      p.isSB = false;
      p.isBB = false;
    }

    // Rotate dealer (randomize on first hand)
    gs.dealerIndex = gs.handNumber === 1
      ? Math.floor(Math.random() * 6)
      : (gs.dealerIndex + 1) % 6;

    // Assign roles
    const dealerIdx = gs.dealerIndex;
    const sbIdx = (dealerIdx + 1) % 6;
    const bbIdx = (dealerIdx + 2) % 6;

    gs.players[dealerIdx]!.isDealer = true;
    gs.players[sbIdx]!.isSB = true;
    gs.players[bbIdx]!.isBB = true;

    // Deal cards
    let deck = shuffle(buildDeck());
    for (const p of gs.players) {
      const r1 = deal(deck); deck = r1.remaining;
      const r2 = deal(deck); deck = r2.remaining;
      p.holeCards = [r1.card, r2.card];
    }
    gs.deck = deck;
    gs.communityCards = [];

    // Post blinds
    gs.pot = 0;
    gs.currentBet = BB;

    const sbPlayer = gs.players[sbIdx]!;
    const bbPlayer = gs.players[bbIdx]!;
    const sbAmount = Math.min(SB, sbPlayer.chips);
    const bbAmount = Math.min(BB, bbPlayer.chips);
    sbPlayer.chips -= sbAmount;
    sbPlayer.currentBet = sbAmount;
    if (sbPlayer.chips === 0) sbPlayer.allIn = true;
    bbPlayer.chips -= bbAmount;
    bbPlayer.currentBet = bbAmount;
    if (bbPlayer.chips === 0) bbPlayer.allIn = true;
    gs.pot = sbAmount + bbAmount;

    gs.log = [];
    this.addLog(`--- Hand #${gs.handNumber} ---`);
    this.addLog(`${sbPlayer.name} posts SB $${sbAmount}`);
    this.addLog(`${bbPlayer.name} posts BB $${bbAmount}`);

    // First to act preflop: player after BB
    gs.actingIndex = (bbIdx + 1) % 6;
    gs.phase = 'preflop';
    gs.showdownResult = null;
    this.botTimer = 0;
    this.emitUiUpdate();
  }

  private applyAction(player: Player, action: { type: ActionType; amount?: number }): void {
    const gs = this.gameState;
    const callAmount = gs.currentBet - player.currentBet;

    switch (action.type) {
      case 'fold':
        player.folded = true;
        this.addLog(`${player.name} folds`);
        break;

      case 'check':
        if (callAmount > 0) {
          // Invalid check, treat as fold
          player.folded = true;
          this.addLog(`${player.name} folds`);
        } else {
          this.addLog(`${player.name} checks`);
        }
        break;

      case 'call': {
        const amount = Math.min(callAmount, player.chips);
        player.chips -= amount;
        player.currentBet += amount;
        gs.pot += amount;
        if (player.chips === 0) player.allIn = true;
        this.addLog(`${player.name} calls $${amount}`);
        break;
      }

      case 'raise': {
        const raiseTotal = Math.min(action.amount ?? gs.currentBet * 2, player.chips + player.currentBet);
        const raiseExtra = raiseTotal - player.currentBet;
        const actualPay = Math.min(raiseExtra, player.chips);
        player.chips -= actualPay;
        player.currentBet += actualPay;
        gs.pot += actualPay;
        if (player.chips === 0) player.allIn = true;
        if (player.currentBet > gs.currentBet) {
          gs.currentBet = player.currentBet;
          // Re-open betting: mark others as not acted
          for (const p of gs.players) {
            if (p.id !== player.id && !p.folded && !p.allIn) {
              p.hasActed = false;
            }
          }
        }
        this.addLog(`${player.name} raises to $${player.currentBet}`);
        break;
      }
    }

    player.hasActed = true;

    // Check if only one player left
    const activePlayers = gs.players.filter(p => !p.folded);
    if (activePlayers.length === 1) {
      const winner = activePlayers[0]!;
      winner.chips += gs.pot;
      gs.showdownResult = `${winner.name} wins $${gs.pot}!`;
      this.addLog(gs.showdownResult);
      gs.phase = 'showdown';
      this.showdownTimer = 0;
      this.emitUiUpdate();
      return;
    }

    if (this.isBettingRoundOver()) {
      this.advancePhase();
    } else {
      this.advanceActingIndex();
    }

    this.emitUiUpdate();
  }

  private isBettingRoundOver(): boolean {
    const gs = this.gameState;
    const active = gs.players.filter(p => !p.folded && !p.allIn);
    return active.every(p => p.hasActed && p.currentBet === gs.currentBet);
  }

  private advanceActingIndex(): void {
    const gs = this.gameState;
    let next = (gs.actingIndex + 1) % 6;
    let attempts = 0;
    while (attempts < 6) {
      const p = gs.players[next]!;
      if (!p.folded && !p.allIn) {
        gs.actingIndex = next;
        this.botTimer = 0;
        return;
      }
      next = (next + 1) % 6;
      attempts++;
    }
  }

  private advancePhase(): void {
    const gs = this.gameState;

    // Reset round bets
    for (const p of gs.players) {
      p.currentBet = 0;
      p.hasActed = false;
    }
    gs.currentBet = 0;

    // Set first to act: first active player left of dealer
    gs.actingIndex = (gs.dealerIndex + 1) % 6;
    this.findNextActive();

    switch (gs.phase) {
      case 'preflop': {
        // Deal flop
        let deck = gs.deck;
        const burn1 = deal(deck); deck = burn1.remaining; // burn
        const f1 = deal(deck); deck = f1.remaining;
        const f2 = deal(deck); deck = f2.remaining;
        const f3 = deal(deck); deck = f3.remaining;
        gs.communityCards = [f1.card, f2.card, f3.card];
        gs.deck = deck;
        gs.phase = 'flop';
        this.addLog(`--- Flop: ${this.cardsStr(gs.communityCards)} ---`);
        break;
      }
      case 'flop': {
        let deck = gs.deck;
        const burn2 = deal(deck); deck = burn2.remaining; // burn
        const t1 = deal(deck); deck = t1.remaining;
        gs.communityCards = [...gs.communityCards, t1.card];
        gs.deck = deck;
        gs.phase = 'turn';
        this.addLog(`--- Turn: ${this.cardStr(t1.card)} ---`);
        break;
      }
      case 'turn': {
        let deck = gs.deck;
        const burn3 = deal(deck); deck = burn3.remaining; // burn
        const r1 = deal(deck); deck = r1.remaining;
        gs.communityCards = [...gs.communityCards, r1.card];
        gs.deck = deck;
        gs.phase = 'river';
        this.addLog(`--- River: ${this.cardStr(r1.card)} ---`);
        break;
      }
      case 'river':
        this.resolveShowdown();
        return;
    }

    this.botTimer = 0;
    this.emitUiUpdate();
  }

  private findNextActive(): void {
    const gs = this.gameState;
    let idx = gs.actingIndex;
    for (let i = 0; i < 6; i++) {
      const p = gs.players[idx]!;
      if (!p.folded && !p.allIn) {
        gs.actingIndex = idx;
        return;
      }
      idx = (idx + 1) % 6;
    }
  }

  private resolveShowdown(): void {
    const gs = this.gameState;
    gs.phase = 'showdown';
    this.showdownTimer = 0;

    const result = findWinner(gs.players, gs.communityCards);
    const winner = gs.players[result.winnerIndex];
    if (winner) {
      winner.chips += gs.pot;
      gs.showdownResult = `${winner.name} wins $${gs.pot} with ${result.handName}!`;
      this.addLog(`--- Showdown ---`);
      for (const p of gs.players) {
        if (!p.folded && p.holeCards) {
          this.addLog(`${p.name}: ${this.cardsStr(p.holeCards)}`);
        }
      }
      this.addLog(gs.showdownResult);
    } else {
      gs.showdownResult = 'No winner';
    }

    gs.pot = 0;
    this.emitUiUpdate();
  }

  private addLog(text: string): void {
    const entry: LogEntry = { text, timestamp: Date.now() };
    this.gameState.log.push(entry);
    // Keep last 50 entries
    if (this.gameState.log.length > 50) {
      this.gameState.log = this.gameState.log.slice(-50);
    }
  }

  private cardStr(card: Card): string {
    const rankStr = card.rank === 14 ? 'A' : card.rank === 13 ? 'K' : card.rank === 12 ? 'Q' : card.rank === 11 ? 'J' : String(card.rank);
    return `${rankStr}${card.suit}`;
  }

  private cardsStr(cards: Card[]): string {
    return cards.map(c => this.cardStr(c)).join(' ');
  }

  private emitUiUpdate(): void {
    if (!this.eventsRef) return;
    const gs = this.gameState;
    const hero = gs.players[0]!;
    const callAmount = gs.currentBet - hero.currentBet;
    const isHeroTurn = gs.actingIndex === 0 && !hero.folded && !hero.allIn &&
      (gs.phase === 'preflop' || gs.phase === 'flop' || gs.phase === 'turn' || gs.phase === 'river');

    const availableActions: ActionType[] = [];
    if (isHeroTurn) {
      availableActions.push('fold');
      if (callAmount === 0) availableActions.push('check');
      if (callAmount > 0 && hero.chips >= callAmount) availableActions.push('call');
      if (hero.chips > callAmount) availableActions.push('raise');
    }

    const uiState: PokerUiState = {
      phase: gs.phase,
      isHeroTurn,
      availableActions,
      callAmount,
      minRaise: gs.currentBet + BB,
      maxRaise: hero.chips + hero.currentBet,
      pot: gs.pot,
      players: gs.players.map(p => ({
        name: p.name,
        chips: p.chips,
        currentBet: p.currentBet,
        folded: p.folded,
        isActing: gs.actingIndex === p.id && (gs.phase !== 'waiting' && gs.phase !== 'showdown'),
        isDealer: p.isDealer,
        isSB: p.isSB,
        isBB: p.isBB,
      })),
      log: gs.log,
      showdownResult: gs.showdownResult,
    };

    this.eventsRef.emit('poker:ui_update', uiState);
  }
}
