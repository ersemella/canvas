import { useEffect, useRef, useState } from 'react';
import { World, Scene } from '@canvas/engine';
import { PokerSystem, PokerRendererSystem, createInitialState } from '@canvas/games-poker';
import type { PokerUiState } from '@canvas/games-poker';
import { PokerActionPanel } from 'components/PokerActionPanel';
import { PokerLog } from 'components/PokerLog';

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

export function PokerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [uiState, setUiState] = useState<PokerUiState>(initialUiState);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gameState = createInitialState();
    const world = new World({ canvas });
    world.registerSystem(new PokerSystem(gameState));
    world.registerSystem(new PokerRendererSystem(gameState));
    const scene = new Scene('poker');
    world.loadScene(scene);
    const unsub = world.events.on<PokerUiState>('poker:ui_update', setUiState);
    world.start();

    return () => {
      unsub();
      world.stop();
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#1a1a2e',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0',
    }}>
      <canvas
        ref={canvasRef}
        width={800}
        height={580}
        style={{ display: 'block', flexShrink: 0 }}
      />
      <div style={{
        width: '280px',
        height: '580px',
        background: '#16213e',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid #333',
        flexShrink: 0,
      }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #333',
          fontWeight: 'bold',
          color: '#ffd700',
          fontSize: '16px',
        }}>
          Texas Hold&apos;em
        </div>
        <PokerActionPanel uiState={uiState} />
        <PokerLog entries={uiState.log} />
      </div>
    </div>
  );
}
