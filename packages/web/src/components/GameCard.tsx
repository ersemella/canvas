import {Link} from 'react-router-dom';
import {Card, Text, Title, Button} from '@mantine/core';
import type {GameDescriptor} from 'registry/games';

interface Props {
  game: GameDescriptor;
}

export function GameCard({game}: Props) {
  return (
    <Card
      bg="dark.7"
      withBorder
      radius="md"
      style={{transition: 'transform 0.2s, border-color 0.2s'}}
      styles={{root: {'&:hover': {transform: 'translateY(-2px)', borderColor: 'var(--mantine-color-violet-5)'}}}}
    >
      <Title order={3} fz="md" fw={600} mb={8}>{game.title}</Title>
      <Text fz="sm" c="dimmed" mb="md" style={{lineHeight: 1.5}}>{game.description}</Text>
      <Button component={Link} to={`/play/${game.id}`} color="violet" size="sm" fw={600}>
        Play
      </Button>
    </Card>
  );
}
