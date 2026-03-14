import {useEffect, useRef, useState, useMemo, useCallback} from 'react';
import type {ComponentType} from 'react';
import {useParams, useLocation, useNavigate} from 'react-router-dom';
import {Paper, Title, Text, List, Button, Group, TextInput, Stack, Box} from '@mantine/core';
import {notifications} from '@mantine/notifications';
import {GameCanvas} from 'components/GameCanvas';
import {GameLog} from 'components/GameLog';
import gameLayout from 'styles/gameLayout.module.css';
import {registerBuiltinSystems} from '@canvas/engine';
import type {EventBus, BaseSystem} from '@canvas/engine';
import type {PokerNetworkAdapter, PublicPokerState} from '@canvas/games-poker';
import {createMultiplayerModule} from '@canvas/games-poker';

type LogEntry = {text: string; timestamp: number};

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface SeatInfo {
  name: string;
  seatIndex: number;
}

interface WsMessage {
  type: string;
  connectionId?: string;
  players?: SeatInfo[];
  state?: PublicPokerState;
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
  const [worldEvents, setWorldEvents] = useState<EventBus | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const adapterRef = useRef<PokerNetworkAdapter | null>(null);
  const gameModuleRef = useRef<ReturnType<typeof createMultiplayerModule> | null>(null);
  const systemsRef = useRef<BaseSystem[]>([]);

  // Persist name to localStorage whenever it's committed
  useEffect(() => {
    if (nameSubmitted && roomId && name) {
      localStorage.setItem(storageKey(roomId), name);
    }
  }, [nameSubmitted, roomId, name]);

  // Build module once when name is submitted
  useEffect(() => {
    if (!nameSubmitted || !roomId) return;

    registerBuiltinSystems();

    const adapter: PokerNetworkAdapter = {
      myConnectionId: '',
      latestState: null,
      dirty: false,
      sendAction(action) {
        wsRef.current?.send(JSON.stringify({action: 'playerAction', payload: action}));
      },
    };
    adapterRef.current = adapter;

    const mod = createMultiplayerModule(adapter);
    gameModuleRef.current = mod;
    systemsRef.current = mod.getSystems();

    // Join room via HTTP then open WebSocket
    let cancelled = false;
    const abortController = new AbortController();

    fetch(`${API_URL}/rooms/${roomId}/join`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({playerName: name}),
      signal: abortController.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Join failed: ${res.status} ${text}`);
        }
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
          const ad = adapterRef.current;
          if (!ad) return;

          switch (msg.type) {
            case 'connected':
              if (msg.connectionId) ad.myConnectionId = msg.connectionId;
              if (msg.players) setPlayers(msg.players);
              break;
            case 'playerJoined':
            case 'playerLeft':
              if (msg.players) setPlayers(msg.players);
              break;
            case 'gameStarted':
              if (msg.state) {
                ad.latestState = msg.state;
                ad.dirty = true;
              }
              setGameStarted(true);
              setShowdown(false);
              break;
            case 'stateUpdate':
              if (msg.state) {
                ad.latestState = msg.state;
                ad.dirty = true;
                setShowdown(msg.state.phase === 'showdown');
              }
              break;
          }
        };

        ws.onopen = () => {
          ws.send(JSON.stringify({action: 'sync'}));
        };
        ws.onerror = () => setError('WebSocket connection error.');
        ws.onclose = () => {
          // Connection closed — no action needed
        };
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

  // Subscribe to log updates once worldEvents is available
  useEffect(() => {
    if (!worldEvents) return;
    return worldEvents.on<LogEntry[]>('game:log_update', setLogEntries);
  }, [worldEvents]);

  const handleReady = useCallback((events: EventBus) => {
    setWorldEvents(events);
  }, []);

  const systems = useMemo(() => {
    return systemsRef.current;
    // Re-derive only when game starts so GameCanvas doesn't re-initialize
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted]);

  const sceneData = useMemo(
    () => gameModuleRef.current?.getSceneData() ?? {name: 'poker-mp', entities: []},
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameStarted],
  );

  function handleStartGame() {
    wsRef.current?.send(JSON.stringify({action: 'startGame'}));
  }

  function handleNextHand() {
    wsRef.current?.send(JSON.stringify({action: 'nextHand'}));
  }

  function handleCopyLink() {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      notifications.show({message: 'Link copied!', color: 'green', autoClose: 2000});
    });
  }

  // Name entry prompt (when navigating directly to the URL)
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

  const SidePanel = (gameModuleRef.current?.getSidePanel?.() ?? null) as ComponentType<{events: EventBus}> | null;

  return (
    <Stack align="center" pt="xl">
      {!gameStarted && (
        <Paper bg="dark.7" withBorder p="xl" radius="md" miw={360}>
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
              <Button
                onClick={handleStartGame}
                disabled={players.length < 2}
                color="yellow"
                c="dark.9"
                fw="bold"
              >
                Start Game
              </Button>
            </Group>
          </Stack>
        </Paper>
      )}

      {gameStarted && (
        <Box>
          <Box className={gameLayout.canvasWithPanel!}>
            <GameCanvas
              sceneData={sceneData}
              systems={systems}
              events={{}}
              width={800}
              height={580}
              onReady={handleReady}
            />
            <Box className={gameLayout.sidePanel!} style={{height: 580}}>
              {worldEvents && SidePanel && <SidePanel events={worldEvents} />}
              <GameLog entries={logEntries} />
            </Box>
          </Box>

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
