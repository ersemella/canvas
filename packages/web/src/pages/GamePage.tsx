import {useEffect, useState, useCallback} from 'react';
import type {ComponentType} from 'react';
import {useParams, Navigate} from 'react-router-dom';
import {GameCanvas} from 'components/GameCanvas';
import {GameLog} from 'components/GameLog';
import {games} from 'registry/games';
import type {SceneData, BaseSystem, EventBus} from '@canvas/engine';
import {registerBuiltinSystems} from '@canvas/engine';
import styles from './GamePage.module.css';

type LogEntry = {text: string; timestamp: number};

export function GamePage() {
  const {gameId} = useParams<{gameId: string}>();
  const [sceneData, setSceneData] = useState<SceneData | null>(null);
  const [gameSystems, setGameSystems] = useState<BaseSystem[]>([]);
  const [gameEvents, setGameEvents] = useState<Record<string, string>>({});
  const [canvasSize, setCanvasSize] = useState({width: 600, height: 400});
  const [sidePanel, setSidePanel] = useState<ComponentType<{events: EventBus}> | null>(null);
  const [worldEvents, setWorldEvents] = useState<EventBus | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const gameDescriptor = games.find((g) => g.id === gameId);

  useEffect(() => {
    if (!gameDescriptor) return;

    registerBuiltinSystems();
    gameDescriptor
      .load()
      .then((mod) => {
        mod.default.register();
        setSceneData(mod.default.getSceneData());
        setGameSystems(mod.default.getSystems());
        setGameEvents(mod.default.getEvents());
        const size = mod.default.getCanvas();
        if (size) setCanvasSize(size);
        const sp = mod.default.getSidePanel?.();
        if (sp) setSidePanel(() => sp as ComponentType<{events: EventBus}>);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [gameDescriptor]);

  const handleReady = useCallback((events: EventBus) => {
    setWorldEvents(events);
  }, []);

  useEffect(() => {
    if (!worldEvents || !sidePanel) return;
    return worldEvents.on<LogEntry[]>('game:log_update', setLogEntries);
  }, [worldEvents, sidePanel]);

  if (!gameDescriptor) return <Navigate to="/" replace />;

  if (loading) {
    return (
      <div className={styles.center}>
        <p>Loading {gameDescriptor.title}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.center}>
        <p className={styles.error}>Failed to load game: {error}</p>
      </div>
    );
  }

  if (!sceneData) return null;

  const SidePanel = sidePanel;

  if (SidePanel) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        background: '#1a1a2e',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <GameCanvas
          sceneData={sceneData}
          systems={gameSystems}
          events={gameEvents}
          width={canvasSize.width}
          height={canvasSize.height}
          onReady={handleReady}
        />
        <div style={{
          width: '280px',
          height: `${canvasSize.height}px`,
          background: '#16213e',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid #333',
          flexShrink: 0,
        }}>
          {worldEvents && <SidePanel events={worldEvents} />}
          <GameLog entries={logEntries} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>{gameDescriptor.title}</h2>
      <div className={styles.canvasWrapper}>
        <GameCanvas
          sceneData={sceneData}
          systems={gameSystems}
          events={gameEvents}
          width={canvasSize.width}
          height={canvasSize.height}
          onReady={handleReady}
        />
      </div>
    </div>
  );
}
