import {useEffect, useRef, useState, useMemo, useCallback} from 'react';
import type {ComponentType} from 'react';
import {useParams, useLocation, useNavigate} from 'react-router-dom';
import {GameCanvas} from 'components/GameCanvas';
import {GameLog} from 'components/GameLog';
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
    void navigator.clipboard.writeText(window.location.href);
  }

  // Name entry prompt (when navigating directly to the URL)
  if (!nameSubmitted) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '80px',
        gap: '16px',
        color: '#eee',
      }}>
        <h2 style={{color: '#ffd700'}}>Join Room {roomId}</h2>
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Enter your name"
          maxLength={20}
          style={{
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid #555',
            background: '#0f3460',
            color: '#eee',
            fontSize: '16px',
          }}
        />
        <button
          onClick={() => {
            if (!nameInput.trim()) return;
            setName(nameInput.trim());
            setNameSubmitted(true);
          }}
          style={{
            padding: '10px 24px',
            borderRadius: '4px',
            border: 'none',
            background: '#ffd700',
            color: '#1a1a2e',
            fontWeight: 'bold',
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          Join
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '80px',
        gap: '16px',
        color: '#eee',
      }}>
        <p style={{color: '#e74c3c'}}>{error}</p>
        <button onClick={() => navigate('/play/poker')} style={{
          padding: '10px 24px',
          borderRadius: '4px',
          border: 'none',
          background: '#ffd700',
          color: '#1a1a2e',
          fontWeight: 'bold',
          cursor: 'pointer',
        }}>
          Back to Lobby
        </button>
      </div>
    );
  }

  const SidePanel = (gameModuleRef.current?.getSidePanel?.() ?? null) as ComponentType<{events: EventBus}> | null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '24px',
      color: '#eee',
    }}>
      {!gameStarted && (
        <div style={{
          background: '#16213e',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '32px',
          minWidth: '360px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <h2 style={{color: '#ffd700', margin: 0}}>Room: {roomId}</h2>

          <div>
            <p style={{color: '#aaa', margin: '0 0 8px'}}>Players ({players.length}):</p>
            <ul style={{margin: 0, padding: '0 0 0 20px'}}>
              {players.map((p, i) => (
                <li key={i} style={{marginBottom: '4px'}}>{p.name}</li>
              ))}
            </ul>
          </div>

          <div style={{display: 'flex', gap: '8px'}}>
            <button
              onClick={handleCopyLink}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #555',
                background: 'transparent',
                color: '#eee',
                cursor: 'pointer',
              }}
            >
              Copy Invite Link
            </button>
            <button
              onClick={handleStartGame}
              disabled={players.length < 2}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '4px',
                border: 'none',
                background: players.length < 2 ? '#555' : '#ffd700',
                color: players.length < 2 ? '#888' : '#1a1a2e',
                fontWeight: 'bold',
                cursor: players.length < 2 ? 'not-allowed' : 'pointer',
              }}
            >
              Start Game
            </button>
          </div>
        </div>
      )}

      {gameStarted && (
        <div>
          <div style={{display: 'flex', borderRadius: '8px', overflow: 'hidden'}}>
            <GameCanvas
              sceneData={sceneData}
              systems={systems}
              events={{}}
              width={800}
              height={580}
              onReady={handleReady}
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
              {worldEvents && SidePanel && <SidePanel events={worldEvents} />}
              <GameLog entries={logEntries} />
            </div>
          </div>

          {showdown && (
            <div style={{marginTop: '16px', textAlign: 'center'}}>
              <button
                onClick={handleNextHand}
                style={{
                  padding: '10px 32px',
                  borderRadius: '4px',
                  border: 'none',
                  background: '#ffd700',
                  color: '#1a1a2e',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  cursor: 'pointer',
                }}
              >
                Next Hand
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
