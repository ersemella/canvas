import {useState} from 'react';
import type {PokerUiState, PokerAction} from './types';
import {pokerActionService} from './pokerActionService';

interface Props {
  uiState: PokerUiState;
}

export function PokerActionPanel({uiState}: Props) {
  const [raiseAmount, setRaiseAmount] = useState(uiState.minRaise);

  const submit = (action: PokerAction) => {
    pokerActionService.submit(action);
  };

  const {isHeroTurn, availableActions, callAmount, minRaise, maxRaise} = uiState;

  if (!isHeroTurn) {
    return (
      <div style={{padding: '16px', color: '#888', fontStyle: 'italic', textAlign: 'center'}}>
        {uiState.phase === 'waiting' ? 'Next hand starting...' :
         uiState.phase === 'showdown' ? 'Showdown!' :
         'Waiting for other players...'}
      </div>
    );
  }

  return (
    <div style={{padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
      <div style={{color: '#ffd700', fontWeight: 'bold', marginBottom: '4px'}}>Your Turn</div>

      <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
        {availableActions.includes('fold') && (
          <button onClick={() => submit({type: 'fold'})} style={btnStyle('#c0392b')}>
            Fold
          </button>
        )}
        {availableActions.includes('check') && (
          <button onClick={() => submit({type: 'check'})} style={btnStyle('#27ae60')}>
            Check
          </button>
        )}
        {availableActions.includes('call') && (
          <button onClick={() => submit({type: 'call'})} style={btnStyle('#2980b9')}>
            Call ${callAmount}
          </button>
        )}
      </div>

      {availableActions.includes('raise') && (
        <div style={{display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px'}}>
          <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
            <label style={{color: '#ccc', fontSize: '12px'}}>Raise to:</label>
            <input
              type="number"
              min={minRaise}
              max={maxRaise}
              value={raiseAmount}
              onChange={e => setRaiseAmount(Number(e.target.value))}
              style={{
                width: '80px',
                padding: '4px',
                background: '#2a2a3e',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '4px',
              }}
            />
          </div>
          <input
            type="range"
            min={minRaise}
            max={maxRaise}
            value={raiseAmount}
            onChange={e => setRaiseAmount(Number(e.target.value))}
            style={{width: '100%'}}
          />
          <button
            onClick={() => submit({type: 'raise', amount: raiseAmount})}
            style={btnStyle('#8e44ad')}
          >
            Raise to ${raiseAmount}
          </button>
        </div>
      )}
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '8px 14px',
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px',
  };
}
