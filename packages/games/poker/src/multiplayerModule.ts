import type {GameModule, SceneData} from '@canvas/engine';
import {PokerNetworkSystem} from './PokerNetworkSystem';
import {PokerRendererSystem} from './PokerRendererSystem';
import {PokerSidePanel} from './PokerSidePanel';
import type {PokerNetworkAdapter} from './networkAdapter';
import type {PokerGameState} from './types';

function createEmptyGameState(): PokerGameState {
  const players = Array.from({length: 6}, (_, i) => ({
    id: i,
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
    style: 'tight' as const,
  }));

  return {
    phase: 'waiting',
    players,
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

export function createMultiplayerModule(adapter: PokerNetworkAdapter): GameModule {
  const gameState = createEmptyGameState();
  const networkSystem = new PokerNetworkSystem(gameState, adapter);
  const rendererSystem = new PokerRendererSystem(gameState);

  return {
    register(): void {},
    getSceneData(): SceneData {
      return {name: 'poker-mp', entities: []};
    },
    getSystems() {
      return [networkSystem, rendererSystem];
    },
    getEvents() {
      return {};
    },
    getCanvas() {
      return {width: 800, height: 580};
    },
    getSidePanel(): unknown {
      return PokerSidePanel;
    },
  } satisfies GameModule;
}
