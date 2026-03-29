import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Container, Paper, Title, TextInput, Button, Text, Stack, Divider} from '@mantine/core';

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
        body: JSON.stringify({hostName: name.trim(), serverSystem: 'PokerServerSystem', maxPlayers: 6}),
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
    <Container size="xs" pt={80}>
      <Title order={1} ta="center" c="yellow" mb="xl">Texas Hold&apos;em Poker</Title>
      <Paper bg="dark.7" withBorder p="xl" radius="md">
        <Stack gap="md">
          <TextInput
            label="Username"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            maxLength={20}
          />
          <Button onClick={() => void handleCreate()} loading={loading} fullWidth color="yellow" c="dark.9" fw="bold">
            Create Room
          </Button>
          <Divider label="or" labelPosition="center" />
          <TextInput
            label="Room Code"
            placeholder="ENTER CODE"
            value={roomCode}
            onChange={(e) => setRoomCode(e.currentTarget.value.toUpperCase())}
            maxLength={8}
            styles={{input: {letterSpacing: '2px'}}}
          />
          <Button onClick={handleJoin} fullWidth variant="outline" color="yellow" fw="bold">
            Join Room
          </Button>
          {error && <Text c="red.4" ta="center">{error}</Text>}
        </Stack>
      </Paper>
    </Container>
  );
}
