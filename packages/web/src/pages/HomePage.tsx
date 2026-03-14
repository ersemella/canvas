import {Container, Title, Text, SimpleGrid} from '@mantine/core';
import {GameCard} from 'components/GameCard';
import {games} from 'registry/games';

export function HomePage() {
  return (
    <Container size="xl" py="xl">
      <Title order={1} mb={8}>Games</Title>
      <Text c="dimmed" mb="xl">HTML5 canvas games built with a custom ECS engine</Text>
      <SimpleGrid cols={{base: 1, sm: 2, md: 3}} spacing="lg">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </SimpleGrid>
    </Container>
  );
}
