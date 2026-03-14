import {BaseSystem} from '@canvas/engine';
import type {SystemContext} from '@canvas/engine';
import {pokerActionService} from './pokerActionService';
import type {PokerGameState, Player, ActionType, PokerUiState} from './types';
import type {PublicPokerState, PublicPlayer} from './publicTypes';
import type {PokerNetworkAdapter} from './networkAdapter';

const BB = 10;
const BETTING_PHASES = new Set(['preflop', 'flop', 'turn', 'river']);

function makeEmptySeat(id: number): Player {
  return {
    id,
    name: '',
    chips: 0,
    holeCards: null,
    currentBet: 0,
    folded: true,
    allIn: false,
    hasActed: false,
    isDealer: false,
    isSB: false,
    isBB: false,
    style: 'tight',
  };
}

function toClientPlayer(p: PublicPlayer, id: number): Player {
  return {
    id,
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
    style: 'tight',
  };
}

function serverStateToClientState(
  state: PublicPokerState,
  myConnectionId: string,
  gameState: PokerGameState,
): void {
  const players = state.players;
  const myIdx = players.findIndex((p) => p.connectionId === myConnectionId);
  const viewerIdx = myIdx === -1 ? 0 : myIdx;

  // Rotate so viewer is at index 0
  const rotated: (PublicPlayer | null)[] = [
    ...players.slice(viewerIdx),
    ...players.slice(0, viewerIdx),
  ];

  // Pad to 6
  while (rotated.length < 6) {
    rotated.push(null);
  }

  const clientPlayers: Player[] = rotated.map((p, i) =>
    p ? toClientPlayer(p, i) : makeEmptySeat(i),
  );

  let actingIndex = 0;
  if (state.actingConnectionId) {
    const rotatedIdx = rotated.findIndex(
      (p) => p?.connectionId === state.actingConnectionId,
    );
    if (rotatedIdx !== -1) actingIndex = rotatedIdx;
  }

  const dealerIndex = rotated.findIndex((p) => p?.isDealer);

  Object.assign(gameState, {
    phase: state.phase,
    players: clientPlayers,
    communityCards: state.communityCards,
    pot: state.pot,
    currentBet: state.currentBet,
    actingIndex,
    dealerIndex: dealerIndex === -1 ? 0 : dealerIndex,
    showdownResult: state.showdownResult,
    log: state.log,
  });
}

function buildUiState(gs: PokerGameState): PokerUiState {
  const hero = gs.players[0]!;
  const callAmount = gs.currentBet - hero.currentBet;
  const isBettingPhase = BETTING_PHASES.has(gs.phase);
  const isHeroTurn =
    gs.actingIndex === 0 && !hero.folded && !hero.allIn && isBettingPhase;

  const availableActions: ActionType[] = [];
  if (isHeroTurn) {
    availableActions.push('fold');
    if (callAmount === 0) availableActions.push('check');
    if (callAmount > 0 && hero.chips >= callAmount) availableActions.push('call');
    if (hero.chips > callAmount) availableActions.push('raise');
  }

  return {
    phase: gs.phase,
    isHeroTurn,
    availableActions,
    callAmount,
    minRaise: gs.currentBet + BB,
    maxRaise: hero.chips + hero.currentBet,
    pot: gs.pot,
    players: gs.players.map((p) => ({
      name: p.name,
      chips: p.chips,
      currentBet: p.currentBet,
      folded: p.folded,
      isActing:
        gs.actingIndex === p.id && gs.phase !== 'waiting' && gs.phase !== 'showdown',
      isDealer: p.isDealer,
      isSB: p.isSB,
      isBB: p.isBB,
    })),
    log: gs.log,
    showdownResult: gs.showdownResult,
  };
}

export class PokerNetworkSystem extends BaseSystem {
  readonly priority = 100;
  private gameState: PokerGameState;
  private adapter: PokerNetworkAdapter;
  private eventsRef: SystemContext['events'] | null = null;

  constructor(gameState: PokerGameState, adapter: PokerNetworkAdapter) {
    super();
    this.gameState = gameState;
    this.adapter = adapter;
  }

  onInit(context: Omit<SystemContext, 'deltaTime'>): void {
    this.eventsRef = context.events;
  }

  onUpdate(context: SystemContext): void {
    if (!this.eventsRef) this.eventsRef = context.events;
    const adapter = this.adapter;

    if (adapter.dirty && adapter.latestState) {
      serverStateToClientState(adapter.latestState, adapter.myConnectionId, this.gameState);
      adapter.dirty = false;

      const uiState = buildUiState(this.gameState);
      this.eventsRef.emit('poker:ui_update', uiState);
      this.eventsRef.emit('game:log_update', uiState.log);
    }

    // Forward hero action to server when it's hero's turn
    const gs = this.gameState;
    const isBettingPhase = BETTING_PHASES.has(gs.phase);
    if (gs.actingIndex === 0 && isBettingPhase) {
      const action = pokerActionService.consume();
      if (action) {
        adapter.sendAction(action);
      }
    }
  }
}
