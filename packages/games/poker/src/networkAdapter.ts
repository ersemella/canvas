import type {PublicPokerState} from './publicTypes';
import type {PokerAction} from './types';

export interface PokerNetworkAdapter {
  myConnectionId: string;
  latestState: PublicPokerState | null;
  dirty: boolean;
  sendAction(action: PokerAction): void;
}
