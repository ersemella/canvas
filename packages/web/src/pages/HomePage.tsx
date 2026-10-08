import {useState, useEffect, useCallback} from 'react';
import {Container, Title, Text, SimpleGrid, Center, Loader, Alert, Button} from '@mantine/core';
import {GameCard} from 'components/GameCard';
import {getGames} from 'registry/games';
import type {GameDescriptor} from 'registry/games';

export function HomePage() {
  const [games, setGames] = useState<GameDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getGames()
      .then(setGames)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  let content;
  if (loading) {
    content = (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  } else if (error) {
    content = (
      <Alert color="red" title="Couldn't load games" maw={560}>
        <Text size="sm" mb="sm">{error}</Text>
        <Button size="xs" variant="light" color="red" onClick={load}>
          Retry
        </Button>
      </Alert>
    );
  } else if (games.length === 0) {
    content = <Text c="dimmed">No games are available right now.</Text>;
  } else {
    content = (
      <SimpleGrid cols={{base: 1, sm: 2, md: 3}} spacing="lg">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </SimpleGrid>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Title order={1} mb={8}>Games</Title>
      <Text c="dimmed" mb="xl">HTML5 canvas games built with a custom ECS engine</Text>
      {content}
    </Container>
  );
}
