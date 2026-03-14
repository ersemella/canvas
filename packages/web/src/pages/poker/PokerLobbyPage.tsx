import {useState} from 'react';
import {useNavigate} from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export function PokerLobbyPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError('Please enter a username.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/rooms`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({hostName: name.trim(), gameType: 'poker', maxPlayers: 6}),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = (await res.json()) as {roomId: string};
      navigate(`/play/poker/${data.roomId}`, {state: {name: name.trim()}});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  }

  function handleJoin() {
    if (!name.trim()) {
      setError('Please enter a username.');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter a room code.');
      return;
    }
    navigate(`/play/poker/${roomCode.trim().toUpperCase()}`, {state: {name: name.trim()}});
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '80px',
      gap: '24px',
      color: '#eee',
    }}>
      <h1 style={{fontSize: '2rem', color: '#ffd700', margin: 0}}>Texas Hold&apos;em Poker</h1>

      <div style={{
        background: '#16213e',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        minWidth: '320px',
      }}>
        <div>
          <label style={{display: 'block', marginBottom: '6px', color: '#aaa'}}>
            Username
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #555',
              background: '#0f3460',
              color: '#eee',
              fontSize: '16px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={loading}
          style={{
            padding: '10px',
            borderRadius: '4px',
            border: 'none',
            background: '#ffd700',
            color: '#1a1a2e',
            fontWeight: 'bold',
            fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Creating...' : 'Create Room'}
        </button>

        <div style={{textAlign: 'center', color: '#666'}}>— or —</div>

        <div>
          <label style={{display: 'block', marginBottom: '6px', color: '#aaa'}}>
            Room Code
          </label>
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="ENTER CODE"
            maxLength={8}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #555',
              background: '#0f3460',
              color: '#eee',
              fontSize: '16px',
              letterSpacing: '2px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          onClick={handleJoin}
          style={{
            padding: '10px',
            borderRadius: '4px',
            border: '1px solid #ffd700',
            background: 'transparent',
            color: '#ffd700',
            fontWeight: 'bold',
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          Join Room
        </button>

        {error && (
          <p style={{color: '#e74c3c', margin: 0, textAlign: 'center'}}>{error}</p>
        )}
      </div>
    </div>
  );
}
