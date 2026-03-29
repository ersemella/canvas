/**
 * PokerSystem — Texas Hold'em game logic.
 *
 * Single-player: hero (seat 0) vs 5 bots. Game starts automatically.
 * Multiplayer: emits ws:send for actions; renders server-filtered state
 * received via ws:message. Bot AI disabled.
 *
 * Reads a PokerConfig entity from the scene for panel entity IDs and
 * game constants. Drives the SidePanelSystem via sidepanel:update events.
 */

import {BaseSystem} from 'core/System';
import type {SystemContext} from 'core/System';
import type {DataComponent} from 'core/Component';
import type {PokerConfigData} from 'components/PokerConfigComponent';
import {buildPokerDeck, shuffleDeck, dealCard, findWinner} from 'util/handEvaluator';
import {decideBotAction} from 'util/botAI';
import {setSharedPokerState} from 'systems/pokerGameState';
import type {PokerGameState, PokerPlayer, PokerCard, Phase, ActionType} from 'systems/pokerTypes';
import type {ClickPayload} from 'systems/ClickSystem';
import type {WsMessagePayload, NetworkConfigPayload} from 'systems/NetworkSystem';
import type {SidePanelUpdatePayload} from 'systems/SidePanelSystem';

const DEFAULT_SB = 5;
const DEFAULT_BB = 10;
const DEFAULT_CHIPS = 1000;
const BOT_DELAY = 1.2;
const WAIT_DELAY = 1.5;
const SHOWDOWN_DELAY = 3.0;
const MAX_LOG = 50;
const LOG_DISPLAY_COUNT = 5;
const NUM_PLAYERS = 6;

const BOT_STYLES: PokerPlayer['style'][] = ['tight', 'loose', 'aggressive', 'tight', 'loose'];

// ── Server public state shape (matches publicTypes.ts in the poker package) ──

interface PublicPlayer {
  connectionId: string;
  name: string;
  chips: number;
  currentBet: number;
  folded: boolean;
  allIn: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  holeCards: [PokerCard, PokerCard] | null;
}

interface PublicPokerState {
  phase: Phase;
  communityCards: PokerCard[];
  pot: number;
  currentBet: number;
  actingConnectionId: string | null;
  showdownResult: string | null;
  log: Array<{text: string}>;
  players: PublicPlayer[];
}

// ─────────────────────────────────────────────────────────────────────────────

function createInitialPlayers(chips: number): PokerPlayer[] {
  return [
    {id: 0, name: 'You', chips, holeCards: null, currentBet: 0, folded: false, allIn: false, hasActed: false, isDealer: false, isSB: false, isBB: false, style: 'loose', connectionId: null},
    {id: 1, name: 'Bot1', chips, holeCards: null, currentBet: 0, folded: false, allIn: false, hasActed: false, isDealer: false, isSB: false, isBB: false, style: BOT_STYLES[0]!, connectionId: null},
    {id: 2, name: 'Bot2', chips, holeCards: null, currentBet: 0, folded: false, allIn: false, hasActed: false, isDealer: false, isSB: false, isBB: false, style: BOT_STYLES[1]!, connectionId: null},
    {id: 3, name: 'Bot3', chips, holeCards: null, currentBet: 0, folded: false, allIn: false, hasActed: false, isDealer: false, isSB: false, isBB: false, style: BOT_STYLES[2]!, connectionId: null},
    {id: 4, name: 'Bot4', chips, holeCards: null, currentBet: 0, folded: false, allIn: false, hasActed: false, isDealer: false, isSB: false, isBB: false, style: BOT_STYLES[3]!, connectionId: null},
    {id: 5, name: 'Bot5', chips, holeCards: null, currentBet: 0, folded: false, allIn: false, hasActed: false, isDealer: false, isSB: false, isBB: false, style: BOT_STYLES[4]!, connectionId: null},
  ];
}

function createInitialState(chips: number): PokerGameState {
  return {
    phase: 'waiting',
    players: createInitialPlayers(chips),
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

function isActiveBettingPhase(phase: Phase): boolean {
  return phase === 'preflop' || phase === 'flop' || phase === 'turn' || phase === 'river';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────

export class PokerSystem extends BaseSystem {
  readonly priority = 100;

  private gameState!: PokerGameState;
  private cfg: PokerConfigData | null = null;
  private sb = DEFAULT_SB;
  private bb = DEFAULT_BB;
  private raiseAmount = DEFAULT_BB * 2;

  private botTimer = 0;
  private waitTimer = 0;
  private showdownTimer = 0;
  private eventsRef: SystemContext['events'] | null = null;

  private isMultiplayer = false;
  private myConnectionId: string | null = null;

  private unsubClick: (() => void) | null = null;
  private unsubWsMessage: (() => void) | null = null;
  private unsubNetConfigure: (() => void) | null = null;

  onInit({scene, events}: Omit<SystemContext, 'deltaTime'>): void {
    this.eventsRef = events;

    const cfgEntity = scene.query({all: ['PokerConfig']})[0];
    if (cfgEntity) {
      const comp = cfgEntity.getComponent<DataComponent<PokerConfigData>>('PokerConfig');
      if (comp) {
        this.cfg = comp.data;
        this.sb = comp.data.smallBlind;
        this.bb = comp.data.bigBlind;
      }
    }

    this.gameState = createInitialState(this.cfg?.startingChips ?? DEFAULT_CHIPS);
    this.raiseAmount = this.bb * 2;
    setSharedPokerState(this.gameState);

    this.unsubClick = events.on<ClickPayload>('click', this.onEntityClick);
    this.unsubWsMessage = events.on<WsMessagePayload>('ws:message', this.onWsMessage);
    this.unsubNetConfigure = events.on<NetworkConfigPayload>('network:configure', () => {
      this.isMultiplayer = true;
      // Reset to a clean waiting state; server will send gameStarted
      this.gameState = createInitialState(this.cfg?.startingChips ?? DEFAULT_CHIPS);
      setSharedPokerState(this.gameState);
      this.emitSidePanelUpdate();
    });

    this.emitSidePanelUpdate();
  }

  onUpdate({deltaTime}: SystemContext): void {
    const gs = this.gameState;

    if (this.isMultiplayer) return; // server drives state in multiplayer

    if (gs.phase === 'waiting') {
      this.waitTimer += deltaTime;
      if (this.waitTimer >= WAIT_DELAY) {
        this.waitTimer = 0;
        this.startHand();
      }
      return;
    }

    if (gs.phase === 'showdown') {
      this.showdownTimer += deltaTime;
      if (this.showdownTimer >= SHOWDOWN_DELAY) {
        this.showdownTimer = 0;
        gs.phase = 'waiting';
        this.publishState();
      }
      return;
    }

    const actor = gs.players[gs.actingIndex];
    if (!actor) return;

    if (actor.folded || actor.allIn) {
      this.advanceActingIndex();
      this.publishState();
      return;
    }

    if (actor.id !== 0) {
      this.botTimer += deltaTime;
      if (this.botTimer >= BOT_DELAY) {
        this.botTimer = 0;
        const action = decideBotAction(actor, gs);
        this.applyAction(actor, action);
      }
    }
  }

  onDestroy(_context: Omit<SystemContext, 'deltaTime'>): void {
    this.unsubClick?.();
    this.unsubWsMessage?.();
    this.unsubNetConfigure?.();
  }

  // ── Event handlers ──────────────────────────────────────────────────────────

  private readonly onEntityClick = ({entityId}: ClickPayload): void => {
    const cfg = this.cfg;
    const gs = this.gameState;

    if (cfg && entityId === cfg.raiseDownId) {
      const hero = gs.players[0]!;
      const minRaise = gs.currentBet + this.bb;
      this.raiseAmount = Math.max(minRaise, this.raiseAmount - this.bb);
      this.emitSidePanelUpdate();
      return;
    }
    if (cfg && entityId === cfg.raiseUpId) {
      const hero = gs.players[0]!;
      const maxRaise = hero.chips + hero.currentBet;
      this.raiseAmount = Math.min(maxRaise, this.raiseAmount + this.bb);
      this.emitSidePanelUpdate();
      return;
    }

    const action = this.entityIdToAction(entityId);
    if (!action) return;

    if (this.isMultiplayer) {
      this.eventsRef?.emit<WsMessagePayload>('ws:send', {type: 'playerAction', payload: action});
    } else {
      const gs = this.gameState;
      const hero = gs.players[0];
      if (!hero || gs.actingIndex !== 0 || !isActiveBettingPhase(gs.phase)) return;
      if (hero.folded || hero.allIn) return;
      this.applyAction(hero, action);
    }
  };

  private readonly onWsMessage = ({type, payload}: WsMessagePayload): void => {
    if (type === 'connected') {
      const p = payload as {connectionId?: string};
      if (p.connectionId) this.myConnectionId = p.connectionId;
      return;
    }
    if (type === 'gameStarted' || type === 'stateUpdate') {
      const pub = payload as PublicPokerState;
      this.gameState = this.publicToLocal(pub);
      setSharedPokerState(this.gameState);
      this.clampRaiseAmount();
      this.emitSidePanelUpdate();
    }
  };

  // ── Game logic ───────────────────────────────────────────────────────────────

  private startHand(): void {
    const gs = this.gameState;
    gs.handNumber++;

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

    gs.dealerIndex = gs.handNumber === 1
      ? Math.floor(Math.random() * NUM_PLAYERS)
      : (gs.dealerIndex + 1) % NUM_PLAYERS;

    const dealerIdx = gs.dealerIndex;
    const sbIdx = (dealerIdx + 1) % NUM_PLAYERS;
    const bbIdx = (dealerIdx + 2) % NUM_PLAYERS;

    gs.players[dealerIdx]!.isDealer = true;
    gs.players[sbIdx]!.isSB = true;
    gs.players[bbIdx]!.isBB = true;

    let deck = shuffleDeck(buildPokerDeck());
    for (const p of gs.players) {
      const r1 = dealCard(deck); deck = r1.remaining;
      const r2 = dealCard(deck); deck = r2.remaining;
      p.holeCards = [r1.card, r2.card];
    }
    gs.deck = deck;
    gs.communityCards = [];
    gs.pot = 0;
    gs.currentBet = this.bb;

    const sbPlayer = gs.players[sbIdx]!;
    const bbPlayer = gs.players[bbIdx]!;
    const sbAmount = Math.min(this.sb, sbPlayer.chips);
    const bbAmount = Math.min(this.bb, bbPlayer.chips);
    sbPlayer.chips -= sbAmount; sbPlayer.currentBet = sbAmount;
    if (sbPlayer.chips === 0) sbPlayer.allIn = true;
    bbPlayer.chips -= bbAmount; bbPlayer.currentBet = bbAmount;
    if (bbPlayer.chips === 0) bbPlayer.allIn = true;
    gs.pot = sbAmount + bbAmount;

    gs.log = [];
    this.addLog(`--- Hand #${gs.handNumber} ---`);
    this.addLog(`${sbPlayer.name} posts SB $${sbAmount}`);
    this.addLog(`${bbPlayer.name} posts BB $${bbAmount}`);

    gs.actingIndex = (bbIdx + 1) % NUM_PLAYERS;
    gs.phase = 'preflop';
    gs.showdownResult = null;
    this.botTimer = 0;
    this.clampRaiseAmount();
    this.publishState();
  }

  private applyAction(player: PokerPlayer, action: {type: ActionType; amount?: number}): void {
    const gs = this.gameState;
    const callAmount = gs.currentBet - player.currentBet;

    switch (action.type) {
      case 'fold':
        player.folded = true;
        this.addLog(`${player.name} folds`);
        break;

      case 'check':
        if (callAmount > 0) {
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
        const raiseTotal = Math.min(
          action.amount ?? gs.currentBet * 2,
          player.chips + player.currentBet
        );
        const actualPay = Math.min(raiseTotal - player.currentBet, player.chips);
        player.chips -= actualPay;
        player.currentBet += actualPay;
        gs.pot += actualPay;
        if (player.chips === 0) player.allIn = true;
        if (player.currentBet > gs.currentBet) {
          gs.currentBet = player.currentBet;
          for (const p of gs.players) {
            if (p.id !== player.id && !p.folded && !p.allIn) p.hasActed = false;
          }
        }
        this.addLog(`${player.name} raises to $${player.currentBet}`);
        break;
      }
    }

    player.hasActed = true;

    const activePlayers = gs.players.filter((p) => !p.folded);
    if (activePlayers.length === 1) {
      const winner = activePlayers[0]!;
      winner.chips += gs.pot;
      gs.showdownResult = `${winner.name} wins $${gs.pot}!`;
      this.addLog(gs.showdownResult);
      gs.phase = 'showdown';
      this.showdownTimer = 0;
      this.publishState();
      return;
    }

    if (this.isBettingRoundOver()) {
      this.advancePhase();
    } else {
      this.advanceActingIndex();
      this.publishState();
    }
  }

  private isBettingRoundOver(): boolean {
    const gs = this.gameState;
    return gs.players
      .filter((p) => !p.folded && !p.allIn)
      .every((p) => p.hasActed && p.currentBet === gs.currentBet);
  }

  private advanceActingIndex(): void {
    const gs = this.gameState;
    let next = (gs.actingIndex + 1) % NUM_PLAYERS;
    for (let i = 0; i < NUM_PLAYERS; i++) {
      const p = gs.players[next]!;
      if (!p.folded && !p.allIn) {
        gs.actingIndex = next;
        this.botTimer = 0;
        return;
      }
      next = (next + 1) % NUM_PLAYERS;
    }
  }

  private findNextActive(): void {
    const gs = this.gameState;
    let idx = gs.actingIndex;
    for (let i = 0; i < NUM_PLAYERS; i++) {
      if (!gs.players[idx]!.folded && !gs.players[idx]!.allIn) {
        gs.actingIndex = idx;
        return;
      }
      idx = (idx + 1) % NUM_PLAYERS;
    }
  }

  private advancePhase(): void {
    const gs = this.gameState;

    for (const p of gs.players) {
      p.currentBet = 0;
      p.hasActed = false;
    }
    gs.currentBet = 0;
    gs.actingIndex = (gs.dealerIndex + 1) % NUM_PLAYERS;
    this.findNextActive();

    switch (gs.phase) {
      case 'preflop': {
        let deck = gs.deck;
        const burn1 = dealCard(deck); deck = burn1.remaining;
        const f1 = dealCard(deck); deck = f1.remaining;
        const f2 = dealCard(deck); deck = f2.remaining;
        const f3 = dealCard(deck); deck = f3.remaining;
        gs.communityCards = [f1.card, f2.card, f3.card];
        gs.deck = deck;
        gs.phase = 'flop';
        this.addLog(`--- Flop: ${this.cardsStr(gs.communityCards)} ---`);
        break;
      }
      case 'flop': {
        let deck = gs.deck;
        const burn2 = dealCard(deck); deck = burn2.remaining;
        const t1 = dealCard(deck); deck = t1.remaining;
        gs.communityCards = [...gs.communityCards, t1.card];
        gs.deck = deck;
        gs.phase = 'turn';
        this.addLog(`--- Turn: ${this.cardStr(t1.card)} ---`);
        break;
      }
      case 'turn': {
        let deck = gs.deck;
        const burn3 = dealCard(deck); deck = burn3.remaining;
        const r1 = dealCard(deck); deck = r1.remaining;
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

    if (this.isBettingRoundOver()) {
      this.advancePhase();
      return;
    }

    this.botTimer = 0;
    this.clampRaiseAmount();
    this.publishState();
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
      this.addLog('--- Showdown ---');
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
    this.publishState();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private addLog(text: string): void {
    this.gameState.log.push(text);
    if (this.gameState.log.length > MAX_LOG) {
      this.gameState.log = this.gameState.log.slice(-MAX_LOG);
    }
  }

  private cardStr(card: PokerCard): string {
    const r = card.rank === 14 ? 'A' : card.rank === 13 ? 'K' : card.rank === 12 ? 'Q' : card.rank === 11 ? 'J' : String(card.rank);
    return `${r}${card.suit}`;
  }

  private cardsStr(cards: PokerCard[]): string {
    return cards.map((c) => this.cardStr(c)).join(' ');
  }

  private clampRaiseAmount(): void {
    const gs = this.gameState;
    const hero = gs.players[0];
    if (!hero) return;
    const minRaise = gs.currentBet + this.bb;
    const maxRaise = hero.chips + hero.currentBet;
    this.raiseAmount = Math.max(minRaise, Math.min(maxRaise, this.raiseAmount));
  }

  private entityIdToAction(entityId: string): {type: ActionType; amount?: number} | null {
    const cfg = this.cfg;
    if (!cfg) return null;
    if (entityId === cfg.foldBtnId) return {type: 'fold'};
    if (entityId === cfg.checkBtnId) return {type: 'check'};
    if (entityId === cfg.callBtnId) return {type: 'call'};
    if (entityId === cfg.raiseBtnId) return {type: 'raise', amount: this.raiseAmount};
    return null;
  }

  /** Publish state to the renderer shim and emit sidepanel:update */
  private publishState(): void {
    setSharedPokerState(this.gameState);
    this.emitSidePanelUpdate();
  }

  private emitSidePanelUpdate(): void {
    const cfg = this.cfg;
    if (!cfg || !this.eventsRef) return;

    const gs = this.gameState;
    const hero = gs.players[0];
    if (!hero) return;

    const callAmount = gs.currentBet - hero.currentBet;
    const isHeroTurn = isActiveBettingPhase(gs.phase) &&
      gs.actingIndex === 0 && !hero.folded && !hero.allIn;

    const minRaise = gs.currentBet + this.bb;
    const maxRaise = hero.chips + hero.currentBet;

    let phaseText: string;
    if (gs.phase === 'waiting') {
      phaseText = 'Waiting...';
    } else if (gs.phase === 'showdown') {
      phaseText = gs.showdownResult ?? 'Showdown';
    } else {
      const actor = gs.players[gs.actingIndex];
      const callStr = callAmount > 0 ? ` (call $${callAmount})` : '';
      phaseText = isHeroTurn
        ? `${capitalize(gs.phase)} — Your turn${callStr}`
        : `${capitalize(gs.phase)} — ${actor?.name ?? ''}`;
    }

    // Log: newest at top (reverse, take 5)
    const logLines = gs.log.slice().reverse().slice(0, LOG_DISPLAY_COUNT);
    const logTexts = cfg.logIds.map((id, i) => ({id, text: logLines[i] ?? ''}));

    const foldEn = isHeroTurn;
    const checkEn = isHeroTurn && callAmount === 0;
    const callEn = isHeroTurn && callAmount > 0 && hero.chips >= callAmount;
    const raiseEn = isHeroTurn && hero.chips > callAmount;
    const raiseDownEn = isHeroTurn && this.raiseAmount > minRaise;
    const raiseUpEn = isHeroTurn && this.raiseAmount < maxRaise;

    const payload: SidePanelUpdatePayload = {
      buttons: [
        {id: cfg.foldBtnId, enabled: foldEn, color: foldEn ? '#c0392b' : '#4a4a4a'},
        {id: cfg.checkBtnId, enabled: checkEn, color: checkEn ? '#2980b9' : '#4a4a4a'},
        {id: cfg.callBtnId, enabled: callEn, color: callEn ? '#27ae60' : '#4a4a4a'},
        {id: cfg.raiseBtnId, enabled: raiseEn, color: raiseEn ? '#d35400' : '#4a4a4a'},
        {id: cfg.raiseDownId, enabled: raiseDownEn, color: raiseDownEn ? '#555' : '#333'},
        {id: cfg.raiseUpId, enabled: raiseUpEn, color: raiseUpEn ? '#555' : '#333'},
      ],
      texts: [
        {id: cfg.potValueId, text: `$${gs.pot}`},
        {id: cfg.heroChipsId, text: `$${hero.chips}`},
        {id: cfg.phaseTextId, text: phaseText},
        {id: cfg.raiseAmountId, text: `$${this.raiseAmount}`},
        ...logTexts,
      ],
    };

    this.eventsRef.emit<SidePanelUpdatePayload>('sidepanel:update', payload);
  }

  // ── Multiplayer helpers ──────────────────────────────────────────────────────

  private publicToLocal(pub: PublicPokerState): PokerGameState {
    const myId = this.myConnectionId;
    const heroIdx = myId ? pub.players.findIndex((p) => p.connectionId === myId) : 0;
    const offset = heroIdx >= 0 ? heroIdx : 0;
    const n = pub.players.length;

    const rotated = Array.from({length: n}, (_, i) => pub.players[(i + offset) % n]!);

    const players: PokerPlayer[] = rotated.map((p, i) => ({
      id: i,
      name: p.name,
      chips: p.chips,
      holeCards: p.holeCards,
      currentBet: p.currentBet,
      folded: p.folded,
      allIn: p.allIn,
      hasActed: false,
      isDealer: p.isDealer,
      isSB: p.isSB,
      isBB: p.isBB,
      style: 'loose' as const,
      connectionId: p.connectionId,
    }));

    const actingIdx = pub.actingConnectionId
      ? rotated.findIndex((p) => p.connectionId === pub.actingConnectionId)
      : -1;
    const dealerIdx = rotated.findIndex((p) => p.isDealer);

    return {
      phase: pub.phase,
      players,
      deck: [],
      communityCards: pub.communityCards,
      pot: pub.pot,
      currentBet: pub.currentBet,
      actingIndex: actingIdx >= 0 ? actingIdx : 0,
      dealerIndex: dealerIdx >= 0 ? dealerIdx : 0,
      handNumber: 0,
      log: pub.log.map((e) => e.text),
      showdownResult: pub.showdownResult,
    };
  }
}
