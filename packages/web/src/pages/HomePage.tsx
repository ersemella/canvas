import {useState, useEffect} from 'react';
import {Container, Title, Text, SimpleGrid, Center, Loader} from '@mantine/core';
import {GameCard} from 'components/GameCard';
import {getGames} from 'registry/games';
import type {GameDescriptor} from 'registry/games';

export function HomePage() {
  const [games, setGames] = useState<GameDescriptor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGames().then((g) => {
      setGames(g);
      setLoading(false);
    });
  }, []);

  return (
    <Container size="xl" py="xl">
      <Title order={1} mb={8}>Games</Title>
      <Text c="dimmed" mb="xl">HTML5 canvas games built with a custom ECS engine</Text>
      {loading ? (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      ) : (
        <SimpleGrid cols={{base: 1, sm: 2, md: 3}} spacing="lg">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </SimpleGrid>
      )}
    </Container>
  );
}
