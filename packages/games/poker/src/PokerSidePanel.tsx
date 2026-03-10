import {useEffect, useState} from 'react';
import type {EventBus} from '@canvas/engine';
import type {PokerUiState} from './types';
import {PokerActionPanel} from './PokerActionPanel';

const initialUiState: PokerUiState = {
  phase: 'waiting',
  isHeroTurn: false,
  availableActions: [],
  callAmount: 0,
  minRaise: 20,
  maxRaise: 1000,
  pot: 0,
  players: [],
  log: [],
  showdownResult: null,
};

interface Props {
  events: EventBus;
}

export function PokerSidePanel({events}: Props) {
  const [uiState, setUiState] = useState<PokerUiState>(initialUiState);

  useEffect(() => {
    return events.on<PokerUiState>('poker:ui_update', setUiState);
  }, [events]);

  return (
    <>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #333',
        fontWeight: 'bold',
        color: '#ffd700',
        fontSize: '16px',
        flexShrink: 0,
      }}>
        Texas Hold&apos;em
      </div>
      <PokerActionPanel uiState={uiState} />
    </>
  );
}
