import {useEffect, useMemo, useRef, useState, useCallback} from 'react';
import {useParams, useLocation, useNavigate} from 'react-router-dom';
import {Paper, Title, Text, List, Button, Group, TextInput, Stack, Box} from '@mantine/core';
import {notifications} from '@mantine/notifications';
import {GameCanvas} from 'components/GameCanvas';
import gameLayout from 'styles/gameLayout.module.css';
import {registerBuiltinComponents, registerBuiltinSystems, createGameModule} from '@canvas/engine';
import type {EventBus, GameManifest} from '@canvas/engine';
import pokerManifest from '@canvas/games-poker/game.json';
import {API_URL} from 'config/api';

interface SeatInfo {
  name: string;
  seatIndex: number;
  isHost?: boolean;
  connected?: boolean;
}

interface WsMessage {
  type: string;
  connectionId?: string;
  players?: SeatInfo[];
  state?: unknown;
  message?: string;
  turnDeadline?: number | null;
  [key: string]: unknown;
}

interface TableState {
  phase?: string;
  actingConnectionId?: string | null;
  players?: Array<{connectionId: string; name: string}>;
}

function storageKey(roomId: string) {
  return `poker_name_${roomId}`;
}

export function PokerRoomPage() {
  const {roomId} = useParams<{roomId: string}>();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as {name?: string} | null;

  const savedName = roomId ? (localStorage.getItem(storageKey(roomId)) ?? '') : '';
  const initialName = locationState?.name ?? savedName;

  const [name, setName] = useState(initialName);
  const [nameSubmitted, setNameSubmitted] = useState(!!initialName);
  const [nameInput, setNameInput] = useState('');

  const [players, setPlayers] = useState<SeatInfo[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [showdown, setShowdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [table, setTable] = useState<TableState | null>(null);
  const [turnDeadline, setTurnDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const wsRef = useRef<WebSocket | null>(null);
  const worldEventsRef = useRef<EventBus | null>(null);
  const unsubWsSendRef = useRef<(() => void) | null>(null);

  // Persist name
  useEffect(() => {
    if (nameSubmitted && roomId && name) {
      localStorage.setItem(storageKey(roomId), name);
    }
  }, [nameSubmitted, roomId, name]);

  // Join room and open WebSocket
  useEffect(() => {
    if (!nameSubmitted || !roomId) return;

    registerBuiltinSystems();
    registerBuiltinComponents();

    let cancelled = false;
    const abortController = new AbortController();

    fetch(`${API_URL}/rooms/${roomId}/join`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({playerName: name}),
      signal: abortController.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Join failed: ${res.status} ${await res.text()}`);
        return res.json() as Promise<{wsUrl: string}>;
      })
      .then(({wsUrl}) => {
        if (cancelled) return;
        const ws = new WebSocket(
          `${wsUrl}?roomId=${encodeURIComponent(roomId)}&playerName=${encodeURIComponent(name)}`,
        );
        wsRef.current = ws;

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data as string) as WsMessage;
          switch (msg.type) {
            case 'connected':
              if (msg.players) setPlayers(msg.players);
              break;
            case 'playerJoined':
            case 'playerLeft':
              if (msg.players) setPlayers(msg.players);
              break;
            case 'gameStarted':
            case 'stateUpdate': {
              const st = msg.state as TableState | undefined;
              setGameStarted(true);
              setShowdown(st?.phase === 'showdown');
              setTable(st ?? null);
              setTurnDeadline(msg.turnDeadline ?? null);
              break;
            }
            case 'error':
              notifications.show({message: msg.message ?? 'Action rejected', color: 'red', autoClose: 3000});
              break;
          }
          // Bridge all messages to ECS EventBus
          // Server sends {type, state?} — translate to {type, payload}
          worldEventsRef.current?.emit<{type: string; payload?: unknown}>('ws:message', {
            type: msg.type,
            payload: msg.state ?? msg,
          });
        };

        ws.onopen = () => ws.send(JSON.stringify({action: 'sync'}));
        ws.onerror = () => setError('WebSocket connection error.');
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
      });

    return () => {
      cancelled = true;
      abortController.abort();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [nameSubmitted, roomId, name]);

  const handleReady = useCallback((events: EventBus) => {
    worldEventsRef.current = events;

    // Bridge ECS ws:send → WebSocket (translate type→action for the GameRoom DO protocol)
    unsubWsSendRef.current = events.on<{type: string; payload?: unknown}>('ws:send', (msg: {type: string; payload?: unknown}) => {
      wsRef.current?.send(JSON.stringify({action: msg.type, payload: msg.payload}));
    });

    // Put PokerSystem in server-driven mode, then re-request the current state:
    // the messages that started the game arrived before this canvas existed.
    events.emit('network:attached', {});
    wsRef.current?.send(JSON.stringify({action: 'sync'}));
  }, []);

  // Tick once a second while someone's turn timer is running.
  useEffect(() => {
    if (!turnDeadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [turnDeadline]);

  // Unsubscribe ws:send bridge on unmount
  useEffect(() => {
    return () => { unsubWsSendRef.current?.(); };
  }, []);

  function handleStartGame() {
    wsRef.current?.send(JSON.stringify({action: 'startGame'}));
  }

  function handleNextHand() {
    wsRef.current?.send(JSON.stringify({action: 'nextHand'}));
    setShowdown(false);
  }

  function handleCopyLink() {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      notifications.show({message: 'Link copied!', color: 'green', autoClose: 2000});
    });
  }

  // Built once: GameCanvas rebuilds its World whenever these props change identity.
  const game = useMemo(() => {
    registerBuiltinSystems();
    registerBuiltinComponents();
    const module = createGameModule(pokerManifest as GameManifest);
    return {
      sceneData: module.getSceneData(),
      createSystems: () => module.getSystems(),
      events: module.getEvents(),
      canvasSize: module.getCanvas() ?? {width: 1120, height: 620},
    };
  }, []);

  if (!nameSubmitted) {
    return (
      <Stack align="center" pt={80} gap="md">
        <Title order={2} c="yellow">Join Room {roomId}</Title>
        <TextInput
          placeholder="Enter your name"
          value={nameInput}
          onChange={(e) => setNameInput(e.currentTarget.value)}
          maxLength={20}
        />
        <Button
          onClick={() => {
            if (!nameInput.trim()) return;
            setName(nameInput.trim());
            setNameSubmitted(true);
          }}
          color="yellow"
          c="dark.9"
          fw="bold"
        >
          Join
        </Button>
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack align="center" pt={80} gap="md">
        <Text c="red.4">{error}</Text>
        <Button onClick={() => navigate('/play/poker')} color="yellow" c="dark.9" fw="bold">
          Back to Lobby
        </Button>
      </Stack>
    );
  }

  const canvasSize = game.canvasSize;
  const isHost = players.some((p) => p.name === name && p.isHost);
  const hostName = players.find((p) => p.isHost)?.name;
  const disconnected = players.filter((p) => p.connected === false).map((p) => p.name);
  const actingName = table?.players?.find((p) => p.connectionId === table.actingConnectionId)?.name;
  const secondsLeft = turnDeadline ? Math.max(0, Math.ceil((turnDeadline - now) / 1000)) : null;

  return (
    <Stack align="center" pt="xl">
      {!gameStarted && (
        <Paper bg="dark.7" withBorder p="xl" radius="md" miw={{base: '100%', sm: 360}}>
          <Stack gap="md">
            <Title order={2} c="yellow">Room: {roomId}</Title>
            <div>
              <Text c="dimmed" mb={8}>Players ({players.length}):</Text>
              <List>
                {players.map((p, i) => (
                  <List.Item key={i}>{p.name}</List.Item>
                ))}
              </List>
            </div>
            <Group grow>
              <Button variant="outline" onClick={handleCopyLink}>
                Copy Invite Link
              </Button>
              {isHost ? (
                <Button
                  onClick={handleStartGame}
                  disabled={players.length < 2}
                  color="yellow"
                  c="dark.9"
                  fw="bold"
                >
                  Start Game
                </Button>
              ) : (
                <Text c="dimmed" ta="center" size="sm">
                  Waiting for {hostName ?? 'the host'} to start
                </Text>
              )}
            </Group>
          </Stack>
        </Paper>
      )}

      {gameStarted && (
        <Box>
          <Box className={gameLayout.canvasWithPanel!}>
            <GameCanvas
              sceneData={game.sceneData}
              createSystems={game.createSystems}
              events={game.events}
              width={canvasSize.width}
              height={canvasSize.height}
              onReady={handleReady}
            />
          </Box>
          {!showdown && actingName && (
            <Text ta="center" mt="sm" c="dimmed" size="sm">
              {actingName === name ? 'Your turn' : `${actingName} to act`}
              {secondsLeft !== null && ` · ${secondsLeft}s`}
            </Text>
          )}
          {disconnected.length > 0 && (
            <Text ta="center" mt={4} c="orange.4" size="sm">
              Disconnected: {disconnected.join(', ')} — seat held until they rejoin
            </Text>
          )}
          {showdown && (
            <Stack align="center" mt="md">
              <Button onClick={handleNextHand} color="yellow" c="dark.9" fw="bold" size="md" px={32}>
                Next Hand
              </Button>
            </Stack>
          )}
        </Box>
      )}
    </Stack>
  );
}
