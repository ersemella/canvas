import {useEffect, useState, useCallback} from 'react';
import type {ComponentType} from 'react';
import {useParams, Navigate} from 'react-router-dom';
import {Center, Loader, Text, Box, Title, Stack} from '@mantine/core';
import {GameCanvas} from 'components/GameCanvas';
import {GameErrorBoundary} from 'components/GameErrorBoundary';
import {GameLog} from 'components/GameLog';
import {games} from 'registry/games';
import gameLayout from 'styles/gameLayout.module.css';
import styles from './GamePage.module.css';
import type {SceneData, BaseSystem, EventBus} from '@canvas/engine';
import {registerBuiltinSystems} from '@canvas/engine';

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
      <Center h="calc(100vh - 56px)">
        <Loader size="sm" />
        <Text ml="sm">Loading {gameDescriptor.title}...</Text>
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="calc(100vh - 56px)">
        <Text c="red.4">Failed to load game: {error}</Text>
      </Center>
    );
  }

  if (!sceneData) return null;

  const SidePanel = sidePanel;

  if (SidePanel) {
    return (
      <Box className={styles.withSidePanel!}>
        <Box className={gameLayout.canvasWithPanel!}>
          <GameErrorBoundary>
            <GameCanvas
              sceneData={sceneData}
              systems={gameSystems}
              events={gameEvents}
              width={canvasSize.width}
              height={canvasSize.height}
              onReady={handleReady}
            />
          </GameErrorBoundary>
          <Box className={gameLayout.sidePanel!} style={{height: canvasSize.height}}>
            {worldEvents && <SidePanel events={worldEvents} />}
            <GameLog entries={logEntries} />
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Stack align="center" py="xl" gap="lg">
      <Title order={2} fz="xl">{gameDescriptor.title}</Title>
      <Box className={styles.canvasRound!}>
        <GameErrorBoundary>
          <GameCanvas
            sceneData={sceneData}
            systems={gameSystems}
            events={gameEvents}
            width={canvasSize.width}
            height={canvasSize.height}
            onReady={handleReady}
          />
        </GameErrorBoundary>
      </Box>
    </Stack>
  );
}
