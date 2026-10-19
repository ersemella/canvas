/**
 * PokerSystem — the poker table's client side. The room server is
 * authoritative: this system sends the player's actions as `ws:send` and
 * renders the per-viewer state the server sends back as `ws:message`.
 *
 * Reads a PokerConfig entity from the scene for panel entity IDs and the
 * blind size. Drives the SidePanelSystem via sidepanel:update events.
 */

import {BaseSystem} from '@canvas/engine';
import type {
  SystemContext,
  DataComponent,
  ClickPayload,
  WsMessagePayload,
  SidePanelUpdatePayload,
} from '@canvas/engine';
import type {PublicPokerState} from '../publicTypes';
import type {PokerConfigData} from './PokerConfigComponent';
import {setSharedPokerState} from './pokerGameState';
import type {PokerGameState, PokerPlayer, Phase, PokerAction} from './pokerTypes';

const DEFAULT_BB = 10;
const LOG_DISPLAY_COUNT = 5;

/** Before the server's first state arrives: an empty table. */
function emptyState(): PokerGameState {
  return {
    phase: 'waiting',
    players: [],
    communityCards: [],
    pot: 0,
    currentBet: 0,
    actingIndex: 0,
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

  private gameState: PokerGameState = emptyState();
  private cfg: PokerConfigData | null = null;
  private bb = DEFAULT_BB;
  private raiseAmount = DEFAULT_BB * 2;
  private eventsRef: SystemContext['events'] | null = null;

  private myConnectionId: string | null = null;
  private serverMinRaiseTo: number | null = null;

  private unsubClick: (() => void) | null = null;
  private unsubWsMessage: (() => void) | null = null;

  onInit({scene, events}: Omit<SystemContext, 'deltaTime'>): void {
    this.eventsRef = events;

    const cfgEntity = scene.query({all: ['PokerConfig']})[0];
    const comp = cfgEntity?.getComponent<DataComponent<PokerConfigData>>('PokerConfig');
    if (comp) {
      this.cfg = comp.data;
      this.bb = comp.data.bigBlind;
    }
    this.raiseAmount = this.bb * 2;
    setSharedPokerState(this.gameState);

    this.unsubClick = events.on<ClickPayload>('click', this.onEntityClick);
    this.unsubWsMessage = events.on<WsMessagePayload>('ws:message', this.onWsMessage);

    this.emitSidePanelUpdate();
  }

  onUpdate(_context: SystemContext): void {
    // The server drives all state changes.
  }

  onDestroy(_context: Omit<SystemContext, 'deltaTime'>): void {
    this.unsubClick?.();
    this.unsubWsMessage?.();
  }

  // ── Event handlers ──────────────────────────────────────────────────────────

  private readonly onEntityClick = ({entityId}: ClickPayload): void => {
    const cfg = this.cfg;
    const hero = this.gameState.players[0];

    if (cfg && entityId === cfg.raiseDownId) {
      this.raiseAmount = Math.max(this.minRaiseTo(), this.raiseAmount - this.bb);
      this.emitSidePanelUpdate();
      return;
    }
    if (cfg && entityId === cfg.raiseUpId) {
      if (!hero) return;
      const maxRaise = hero.chips + hero.currentBet;
      this.raiseAmount = Math.min(maxRaise, this.raiseAmount + this.bb);
      this.emitSidePanelUpdate();
      return;
    }

    const action = this.entityIdToAction(entityId);
    if (!action) return;
    this.eventsRef?.emit<WsMessagePayload>('ws:send', {type: 'playerAction', payload: action});
  };

  private readonly onWsMessage = ({type, payload}: WsMessagePayload): void => {
    if (type === 'connected') {
      const p = payload as {connectionId?: string};
      if (p.connectionId) this.myConnectionId = p.connectionId;
      return;
    }
    if (type === 'gameStarted' || type === 'stateUpdate') {
      const pub = payload as PublicPokerState;
      this.serverMinRaiseTo = pub.minRaiseTo ?? null;
      this.gameState = this.publicToLocal(pub);
      setSharedPokerState(this.gameState);
      this.clampRaiseAmount();
      this.emitSidePanelUpdate();
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private clampRaiseAmount(): void {
    const gs = this.gameState;
    const hero = gs.players[0];
    if (!hero) return;
    const maxRaise = hero.chips + hero.currentBet;
    this.raiseAmount = Math.max(this.minRaiseTo(), Math.min(maxRaise, this.raiseAmount));
  }

  /** Server-provided minimum (tracks re-raise sizes); one big blind over the bet until the server says. */
  private minRaiseTo(): number {
    return this.serverMinRaiseTo ?? this.gameState.currentBet + this.bb;
  }

  private entityIdToAction(entityId: string): PokerAction | null {
    const cfg = this.cfg;
    if (!cfg) return null;
    if (entityId === cfg.foldBtnId) return {type: 'fold'};
    if (entityId === cfg.checkBtnId) return {type: 'check'};
    if (entityId === cfg.callBtnId) return {type: 'call'};
    if (entityId === cfg.raiseBtnId) return {type: 'raise', amount: this.raiseAmount};
    return null;
  }

  private emitSidePanelUpdate(): void {
    const cfg = this.cfg;
    if (!cfg || !this.eventsRef) return;

    const gs = this.gameState;
    const hero = gs.players[0];
    if (!hero) return;

    const callAmount = gs.currentBet - hero.currentBet;
    const isHeroTurn =
      isActiveBettingPhase(gs.phase) && gs.actingIndex === 0 && !hero.folded && !hero.allIn;

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

  // ── Server state → view ──────────────────────────────────────────────────────

  private publicToLocal(pub: PublicPokerState): PokerGameState {
    const myId = this.myConnectionId;
    const heroIdx = myId ? pub.players.findIndex((p) => p.connectionId === myId) : 0;
    const offset = heroIdx >= 0 ? heroIdx : 0;
    const n = pub.players.length;

    const rotated = Array.from({length: n}, (_, i) => pub.players[(i + offset) % n]!);

    const players: PokerPlayer[] = rotated.map((p) => ({
      name: p.name,
      chips: p.chips,
      holeCards: p.holeCards,
      currentBet: p.currentBet,
      folded: p.folded,
      allIn: p.allIn,
      isDealer: p.isDealer,
      isSB: p.isSB,
      isBB: p.isBB,
      connectionId: p.connectionId,
    }));

    const actingIdx = pub.actingConnectionId
      ? rotated.findIndex((p) => p.connectionId === pub.actingConnectionId)
      : -1;

    return {
      phase: pub.phase,
      players,
      communityCards: pub.communityCards,
      pot: pub.pot,
      currentBet: pub.currentBet,
      actingIndex: actingIdx >= 0 ? actingIdx : 0,
      log: pub.log.map((e) => e.text),
      showdownResult: pub.showdownResult,
    };
  }
}
