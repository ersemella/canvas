import {useEffect, useState} from 'react';
import {useParams, Navigate} from 'react-router-dom';
import {GameCanvas} from 'components/GameCanvas';
import {games} from 'registry/games';
import type {SceneData, BaseSystem} from '@canvas/engine';
import {registerBuiltinSystems} from '@canvas/engine';
import styles from './GamePage.module.css';

export function GamePage() {
  const {gameId} = useParams<{gameId: string}>();
  const [sceneData, setSceneData] = useState<SceneData | null>(null);
  const [gameSystems, setGameSystems] = useState<BaseSystem[]>([]);
  const [gameEvents, setGameEvents] = useState<Record<string, string>>({});
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
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [gameDescriptor]);

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

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>{gameDescriptor.title}</h2>
      <div className={styles.canvasWrapper}>
        <GameCanvas sceneData={sceneData} systems={gameSystems} events={gameEvents} width={600} height={400} />
      </div>
    </div>
  );
}
