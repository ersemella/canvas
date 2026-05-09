import {Link} from 'react-router-dom';
import {Card, Text, Title, Button} from '@mantine/core';
import type {GameDescriptor} from 'registry/games';
import styles from './GameCard.module.css';

interface Props {
  game: GameDescriptor;
}

export function GameCard({game}: Props) {
  return (
    <Card
      bg="dark.7"
      withBorder
      radius="md"
      className={styles.card!}
    >
      <Title order={3} fz="md" fw={600} mb={8}>{game.title}</Title>
      <Text fz="sm" c="dimmed" mb="md" className={styles.description!}>{game.description}</Text>
      <Button component={Link} to={`/play/${game.id}`} color="green" size="sm" fw={600}>
        Play
      </Button>
    </Card>
  );
}
